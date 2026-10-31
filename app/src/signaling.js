// Signaling client mirroring the web app's createConnection() (public/app.js)
// and the server protocol (server.js) EXACTLY:
// - Raw WebSocket (NOT socket.io) at wss://<host>/ws.
// - Every message is JSON { e, d } where e is the event name and d the data.
// - Emit with a callback adds an ack id `a`; the server answers with
//   { e: '__ack', a, d } and the callback runs with d.
// - Auto-reconnect with backoff: min(8000, 400 * 2^retry) ms, same as web.
// - Virtual 'connect' / 'disconnect' events, same as web.
// - REST: POST /api/rooms, GET /api/rooms/:id, GET /api/ice.
//
// This file is pure JS (no React Native imports) so the protocol logic can
// be smoke-tested under plain node. The WebSocket implementation is
// injectable (defaults to the global WebSocket, which React Native provides).
const { SERVER_URL, normalizeCode } = require('./constants');

function wsUrl(serverUrl) {
  return serverUrl.replace(/^http/, 'ws') + '/ws';
}

class SignalingClient {
  constructor(wsImpl) {
    this.WSImpl = wsImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    this.listeners = new Map();
    this.acks = new Map();
    this.ws = null;
    this.seq = 0;
    this.retry = 0;
    this.connected = false;
    this._closed = false;
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
    return this;
  }

  off(event, fn) {
    const list = this.listeners.get(event);
    if (list) {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }
    return this;
  }

  once(event, fn) {
    const wrapper = (d) => {
      this.off(event, wrapper);
      fn(d);
    };
    return this.on(event, wrapper);
  }

  fire(event, data) {
    const list = (this.listeners.get(event) || []).slice();
    for (const fn of list) {
      try {
        fn(data);
      } catch (err) {
        console.error(err);
      }
    }
  }

  emit(event, data, cb) {
    if (!this.connected) return false;
    const m = { e: event, d: data };
    if (cb) {
      m.a = ++this.seq;
      this.acks.set(m.a, cb);
    }
    this.ws.send(JSON.stringify(m));
    return true;
  }

  connect(serverUrl) {
    this._closed = false;
    this._open(serverUrl || SERVER_URL);
    return this;
  }

  _open(serverUrl) {
    if (!this.WSImpl) throw new Error('No WebSocket implementation available');
    const ws = new this.WSImpl(wsUrl(serverUrl));
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.connected = true;
      this.fire('connect');
    };
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.e === '__ack') {
        const cb = this.acks.get(m.a);
        this.acks.delete(m.a);
        if (cb) cb(m.d);
        return;
      }
      this.fire(m.e, m.d);
    };
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      this.acks.clear();
      if (was) this.fire('disconnect');
      if (this._closed) return;
      const delay = Math.min(8000, 400 * 2 ** this.retry);
      this.retry += 1;
      setTimeout(() => this._open(serverUrl), delay);
    };
  }

  close() {
    this._closed = true;
    this.connected = false;
    try {
      this.ws && this.ws.close();
    } catch {
      // already gone
    }
  }
}

// ---- REST, mirroring the web app's /api calls ----

async function createRoom({ title, type, waitingRoom }) {
  const r = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, type, waitingRoom: !!waitingRoom }),
  });
  if (!r.ok) throw new Error('Could not start the gathering.');
  return r.json(); // { id, hostKey, title, type }
}

async function lookupRoom(code) {
  const id = normalizeCode(code);
  const r = await fetch(`${SERVER_URL}/api/rooms/${id}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'No gathering found with that code.');
  return d; // { id, title, type, typeLabel, count }
}

async function fetchIce() {
  try {
    const r = await fetch(`${SERVER_URL}/api/ice`);
    return await r.json();
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

module.exports = { SignalingClient, createRoom, lookupRoom, fetchIce, wsUrl };
