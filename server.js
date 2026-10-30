// In the Midst — signaling + room state server.
// Video and audio travel peer-to-peer over WebRTC; this server only relays
// connection setup messages and keeps the shared meeting state.
// No dependencies: plain Node.js (18+), including a small WebSocket layer.

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');

const TYPES = {
  prayer: 'Prayer Meeting',
  bible: 'Bible Study',
  worship: 'Praise & Worship',
  fellowship: 'Fellowship',
};
const REACTIONS = ['🙏', '🙌', '❤️', '👏', '🔥', '🕊️'];

// ---------- tiny WebSocket layer (RFC 6455) with rooms + acks ----------
const clients = new Map();          // id -> Client
const roomSets = new Map();         // room name -> Set<Client>
const MAX_MSG = 1024 * 1024;

function emitRoom(room, e, d, exceptId) {
  const set = roomSets.get(room);
  if (!set) return;
  const msg = JSON.stringify({ e, d });
  for (const c of set) if (c.id !== exceptId) c.send(msg);
}
const io = { to: room => ({ emit: (e, d) => emitRoom(room, e, d) }) };

class Client {
  constructor(sock) {
    this.id = crypto.randomBytes(9).toString('base64url');
    this.sock = sock;
    this.data = {};
    this.rooms = new Set();
    this.handlers = new Map();
    this.buf = Buffer.alloc(0);
    this.frag = null;
    this.alive = true;
    this.dead = false;
    clients.set(this.id, this);
    this.join(this.id);
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.closed());
    sock.on('error', () => this.closed());
  }
  on(e, fn) { this.handlers.set(e, fn); }
  emit(e, d) { this.send(JSON.stringify({ e, d })); }
  to(room) { return { emit: (e, d) => emitRoom(room, e, d, this.id) }; }
  join(r) { this.rooms.add(r); if (!roomSets.has(r)) roomSets.set(r, new Set()); roomSets.get(r).add(this); }
  leave(r) {
    this.rooms.delete(r);
    const s = roomSets.get(r);
    if (s) { s.delete(this); if (!s.size) roomSets.delete(r); }
  }
  frameHeader(op, len) {
    if (len < 126) return Buffer.from([0x80 | op, len]);
    if (len < 65536) { const h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); return h; }
    const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h;
  }
  send(str) {
    if (this.dead) return;
    const p = Buffer.from(str, 'utf8');
    this.sock.write(Buffer.concat([this.frameHeader(0x1, p.length), p]));
  }
  ping() { if (!this.dead) this.sock.write(Buffer.from([0x89, 0])); }
  onData(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (!this.dead) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MSG)) return this.close(1009);
        len = Number(big); off = 10;
      }
      if (len > MAX_MSG) return this.close(1009);
      if (!masked) return this.close(1002);
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.frame(fin, op, payload);
    }
  }
  frame(fin, op, p) {
    this.alive = true;
    if (op === 0x8) return this.close();
    if (op === 0x9) { if (p.length < 126) this.sock.write(Buffer.concat([this.frameHeader(0xA, p.length), p])); return; }
    if (op === 0xA) return;
    if (op === 0x1 || op === 0x2) { if (fin) this.message(p); else this.frag = [p]; return; }
    if (op === 0x0 && this.frag) {
      this.frag.push(p);
      if (this.frag.reduce((n, b) => n + b.length, 0) > MAX_MSG) return this.close(1009);
      if (fin) { const all = Buffer.concat(this.frag); this.frag = null; this.message(all); }
    }
  }
  message(p) {
    let m;
    try { m = JSON.parse(p.toString('utf8')); } catch { return; }
    if (!m || typeof m.e !== 'string' || m.e.startsWith('__') || m.e === 'disconnect') return;
    const fn = this.handlers.get(m.e);
    if (!fn) return;
    const cb = m.a != null ? res => this.send(JSON.stringify({ e: '__ack', a: m.a, d: res })) : undefined;
    try { fn(m.d, cb); } catch (err) { console.error(`Error handling "${m.e}":`, err); }
  }
  close(code = 1000) {
    if (this.dead) return;
    try { const b = Buffer.alloc(4); b[0] = 0x88; b[1] = 2; b.writeUInt16BE(code, 2); this.sock.write(b); } catch { /* socket gone */ }
    this.closed();
  }
  closed() {
    if (this.dead) return;
    this.dead = true;
    try { this.handlers.get('disconnect')?.(); } catch (err) { console.error(err); }
    for (const r of [...this.rooms]) this.leave(r);
    clients.delete(this.id);
    this.sock.destroy();
  }
}

// keep connections alive through proxies and drop dead ones
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.close(1001); continue; }
    c.alive = false;
    c.ping();
  }
}, 25000).unref();

// ---------- HTTP: static files + small JSON API ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 100 * 1024) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function serveStatic(req, res, pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return json(res, 400, { error: 'Bad path' }); }
  if (p === '/') p = '/index.html'; if (p === '/privacy') p = '/privacy.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) return json(res, 404, { error: 'Not found' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self)',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const routes = [];
const app = {
  post: (p, fn) => routes.push({ method: 'POST', p, fn }),
  get: (p, fn) => routes.push({ method: 'GET', p, fn }), delete: (p, fn) => routes.push({ method: 'DELETE', p, fn }),
};
const server = http.createServer(async (req, res) => {
  
const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const keys = [];
    const re = new RegExp('^' + r.p.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    const m = url.pathname.match(re);
    if (!m) continue;
    const params = Object.fromEntries(keys.map((k, i) => [k, m[i + 1]]));
    let body = {};
    if (req.method === 'POST') {
      try { body = await readJson(req); } catch { return json(res, 400, { error: 'Bad request' }); }
    }
    const reply = {
      status(code) { this.code = code; return this; },
      header(name, value) { (this.headers ??= {})[name] = value; return this; }, json(obj) { res.writeHead(this.code || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(this.headers || {}), }); res.end(JSON.stringify(obj)); },
      send(text) { res.writeHead(this.code || 200, { 'Content-Type': 'text/plain' }); res.end(text); },
    };
    try { return r.fn({ params, body, headers: req.headers }, reply); } catch (e) { console.error(e); return json(res, 500, { error: 'Server error' }); }
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
  json(res, 405, { error: 'Method not allowed' });
});

server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://localhost');
  const key = req.headers['sec-websocket-key'];
  if (url.pathname !== '/ws' || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  sock.setTimeout(0);
  onConnection(new Client(sock));
});

// ---------- persistence (room codes, titles, host keys, prayer wall) ----------
let saved = {};
try { saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { saved = {}; }
let persistTimer = null;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(saved, null, 2));
    } catch (e) { console.error('Could not save rooms:', e.message); }
  }, 300);
}

// ---------- helpers ----------
const clean = (v, n) => String(v ?? '').replace(/\s+$/g, '').trim().slice(0, n);
function normalize(code) {
  const d = String(code || '').replace(/\D/g, '').slice(0, 9);
  return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : '';
}
function newCode() {
  let c;
  do { c = [0, 0, 0].map(() => String(crypto.randomInt(100, 1000))).join('-'); } while (saved[c]);
  return c;
}
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) {
    list.push({
      urls: process.env.TURN_URL.split(',').map(s => s.trim()),
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  }
  return list;
}

// ---------- live meeting state ----------
const live = new Map();
function getLive(id) {
  let r = live.get(id);
  if (!r) {
    r = {
      participants: new Map(),
      waiting: new Map(),
      admitted: new Set(),
      recording: new Set(),
      chat: [],
      overlay: null,
      worship: { title: '', slides: [], index: 0, active: false },
      locked: false,
      spotlight: null,
    };
    live.set(id, r);
  }
  return r;
}

function publicState(id) {
  const meta = saved[id];
  const r = getLive(id);
  return {
    id,
    title: meta.title,
    type: meta.type,
    typeLabel: TYPES[meta.type],
    waitingRoom: !!meta.waitingRoom,
    locked: r.locked,
    spotlight: r.spotlight,
    participants: [...r.participants.values()],
    waiting: [...r.waiting.values()],
    recording: [...r.recording].map(sid => r.participants.get(sid)?.name).filter(Boolean),
    prayers: (meta.prayers || []).map(p => ({
      id: p.id, text: p.text, by: p.by, authorId: p.authorId, at: p.at,
      answered: p.answered, prayed: p.prayed,
    })),
    overlay: r.overlay,
    worship: r.worship,
  };
}
const broadcast = id => { if (saved[id]) io.to(id).emit('state', publicState(id)); };

function leaveRoom(sock) {
  const id = sock.data.roomId;
  if (!id) return;
  sock.data.roomId = null;
  const r = live.get(id);
  if (!r) return;
  r.waiting.delete(sock.id);
  r.admitted.delete(sock.id);
  r.recording.delete(sock.id);
  const p = r.participants.get(sock.id);
  if (p) {
    r.participants.delete(sock.id);
    sock.leave(id);
    io.to(id).emit('peer-left', sock.id);
    io.to(id).emit('notice', { text: `${p.name} left` });
    if (r.spotlight === sock.id) r.spotlight = null;
    const rest = [...r.participants.values()];
    if (p.host && rest.length && !rest.some(x => x.host)) {
      const next = rest.sort((a, b) => a.joinedAt - b.joinedAt)[0];
      next.host = true;
      io.to(id).emit('notice', { text: `${next.name} is now the host` });
    }
  }
  if (r.participants.size === 0 && r.waiting.size === 0) live.delete(id);
  else broadcast(id);
}

// ---------- REST ----------
app.post('/api/rooms', (req, res) => {
  const { title, type, waitingRoom } = req.body || {};
  const t = TYPES[type] ? type : 'fellowship';
  const id = newCode();
  const hostKey = crypto.randomBytes(16).toString('hex');
  saved[id] = {
    id, type: t, hostKey,
    title: clean(title, 80) || TYPES[t],
    waitingRoom: !!waitingRoom,
    createdAt: Date.now(),
    prayers: [],
  };
  persist();
  res.json({ id, hostKey, title: saved[id].title, type: t });
});

app.get('/api/rooms/:id', (req, res) => {
  const m = saved[normalize(req.params.id)];
  if (!m) return res.status(404).json({ error: 'No gathering found with that code.' });
  res.json({ id: m.id, title: m.title, type: m.type, typeLabel: TYPES[m.type], count: live.get(m.id)?.participants.size || 0 });
});

app.get('/api/ice', (_req, res) => res.json(iceServers()));
app.get('/healthz', (_req, res) => res.send('ok')); const ADMIN_STARTED_AT = Date.now(); const ADMIN_SESSIONS = new Map(); const ADMIN_TTL_MS = 24 * 60 * 60 * 1000; function adminHash(s) { return crypto.createHash('sha256').update(String(s)).digest(); } function adminPasswordOk(pw) { const configured = process.env.ADMIN_PASSWORD; if (!configured) return false; return crypto.timingSafeEqual(adminHash(pw || ''), adminHash(configured)); } function adminSessionFrom(headers) { const raw = (headers && headers.cookie) || ''; const part = raw.split(';').map(s => s.trim()).find(s => s.startsWith('admin_session=')); if (!part) return null; const token = part.slice('admin_session='.length); const exp = ADMIN_SESSIONS.get(token); if (!exp) return null; if (Date.now() > exp) { ADMIN_SESSIONS.delete(token); return null; } return token; } function adminGuard(h, res) { if (!adminSessionFrom(h.headers)) { res.status(401).json({ error: 'Unauthorized' }); return false; } return true; } function adminSetCookie(res, token, maxAge) { res.header('Set-Cookie', `admin_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}`); } app.post('/api/admin/login', (h, res) => { if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin login is not configured on this server.' }); if (!adminPasswordOk(h.body && h.body.password)) return res.status(401).json({ error: 'Wrong password.' }); const token = crypto.randomBytes(32).toString('hex'); ADMIN_SESSIONS.set(token, Date.now() + ADMIN_TTL_MS); adminSetCookie(res, token, 24 * 60 * 60); return res.json({ ok: true }); }); app.post('/api/admin/logout', (h, res) => { const t = adminSessionFrom(h.headers); if (t) ADMIN_SESSIONS.delete(t); adminSetCookie(res, '', 0); return res.json({ ok: true }); }); app.get('/api/admin/me', (h, res) => { if (!adminGuard(h, res)) return; return res.json({ ok: true }); }); app.get('/api/admin/rooms', (h, res) => { if (!adminGuard(h, res)) return; const rooms = []; for (const [id, r] of live) { const m = saved[id]; if (!m) continue; rooms.push({ id, title: m.title, type: m.type, typeLabel: TYPES[m.type], createdAt: m.createdAt, waitingRoom: !!m.waitingRoom, locked: !!r.locked, participants: [...r.participants.values()].map(p => ({ id: p.id, name: p.name, host: !!p.host, mic: !!p.mic, cam: !!p.cam, hand: !!p.hand, joinedAt: p.joinedAt, })), waiting: [...r.waiting.values()].map(w => ({ id: w.id, name: w.name })), participantCount: r.participants.size, waitingCount: r.waiting.size, }); } rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return res.json({ rooms }); }); app.post('/api/admin/rooms/:id/end', (h, res) => { if (!adminGuard(h, res)) return; const id = normalize(h.params.id); const r = live.get(id); if (!r) return res.json({ ok: true, ended: false }); for (const sid of [...r.participants.keys(), ...r.waiting.keys()]) { const s = clients.get(sid); io.to(sid).emit('ended'); if (s) { s.leave(id); s.data.roomId = null; } } live.delete(id); return res.json({ ok: true, ended: true }); }); app.get('/api/admin/prayers', (h, res) => { if (!adminGuard(h, res)) return; const out = []; for (const [roomId, m] of Object.entries(saved)) { for (const p of (m.prayers || [])) { out.push({ id: p.id, roomId, roomTitle: m.title, text: p.text, by: p.by, at: p.at, answered: !!p.answered, prayedCount: (p.prayed || []).length, }); } } out.sort((a, b) => (b.at || 0) - (a.at || 0)); return res.json({ prayers: out }); }); app.delete('/api/admin/prayers/:id', (h, res) => { if (!adminGuard(h, res)) return; const pid = h.params.id; for (const [roomId, m] of Object.entries(saved)) { const i = (m.prayers || []).findIndex(p => p.id === pid); if (i >= 0) { m.prayers.splice(i, 1); persist(); if (live.has(roomId)) broadcast(roomId); return res.json({ ok: true }); } } return res.status(404).json({ error: 'Prayer post not found.' }); }); app.get('/api/admin/stats', (h, res) => { if (!adminGuard(h, res)) return; let participants = 0, waiting = 0, totalPrayers = 0; for (const r of live.values()) { participants += r.participants.size; waiting += r.waiting.size; } for (const m of Object.values(saved)) totalPrayers += (m.prayers || []).length; return res.json({ liveRooms: live.size, savedRooms: Object.keys(saved).length, participants, waiting, totalPrayers, uptimeSeconds: Math.floor(process.uptime()), startedAt: ADMIN_STARTED_AT, }); });

// ---------- sockets ----------
function onConnection(socket) {
  const room = () => (socket.data.roomId ? live.get(socket.data.roomId) : null);
  const meta = () => (socket.data.roomId ? saved[socket.data.roomId] : null);
  const me = () => room()?.participants.get(socket.id);
  const isHost = () => !!me()?.host;

  socket.on('join', (p, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const id = normalize(p?.roomId);
    const m = saved[id];
    if (!m) return cb({ error: 'No gathering found with that code.' });
    if (socket.data.roomId && socket.data.roomId !== id) leaveRoom(socket);
    const r = getLive(id);
    const name = clean(p.name, 40) || 'Guest';
    const host = !!p.hostKey && p.hostKey === m.hostKey;

    if (!host) {
      if (r.locked) return cb({ error: 'The host has locked this gathering. Ask them to unlock it.' });
      if (m.waitingRoom && !r.admitted.has(socket.id)) {
        socket.data.roomId = id;
        r.waiting.set(socket.id, { id: socket.id, name });
        broadcast(id);
        return cb({ waiting: true, title: m.title });
      }
    }

    socket.data.roomId = id;
    r.waiting.delete(socket.id);
    const peers = [...r.participants.keys()].filter(k => k !== socket.id);
    r.participants.set(socket.id, {
      id: socket.id, name, host,
      mic: !!p.mic, cam: !!p.cam, sharing: false, hand: false,
      joinedAt: Date.now(),
    });
    socket.join(id);
    cb({ ok: true, self: socket.id, peers, state: publicState(id), chat: r.chat.slice(-100) });
    socket.to(id).emit('notice', { text: `${name} joined` });
    broadcast(id);
  });

  socket.on('signal', msg => {
    const r = room();
    if (!r || !r.participants.has(socket.id) || !r.participants.has(msg?.to)) return;
    io.to(msg.to).emit('signal', { from: socket.id, data: msg.data });
  });

  socket.on('media', s => {
    const p = me(); if (!p) return;
    for (const k of ['mic', 'cam', 'sharing']) if (typeof s?.[k] === 'boolean') p[k] = s[k];
    broadcast(socket.data.roomId);
  });

  socket.on('hand', v => {
    const p = me(); if (!p) return;
    p.hand = !!v;
    broadcast(socket.data.roomId);
  });

  socket.on('reaction', emoji => {
    if (!me() || !REACTIONS.includes(emoji)) return;
    io.to(socket.data.roomId).emit('reaction', { from: socket.id, emoji });
  });

  socket.on('chat', ({ text, to } = {}) => {
    const p = me(), r = room(); if (!p) return;
    const t = clean(text, 1000); if (!t) return;
    const msg = { id: crypto.randomUUID(), from: socket.id, name: p.name, text: t, at: Date.now(), to: null };
    if (to && r.participants.has(to)) {
      msg.to = to; msg.toName = r.participants.get(to).name;
      socket.emit('chat', msg);
      if (to !== socket.id) io.to(to).emit('chat', msg);
    } else {
      r.chat.push(msg);
      if (r.chat.length > 300) r.chat.shift();
      io.to(socket.data.roomId).emit('chat', msg);
    }
  });

  // ----- prayer wall (kept between meetings) -----
  const findPrayer = pid => (meta()?.prayers || []).find(x => x.id === pid);
  socket.on('prayer:add', ({ text, anonymous } = {}) => {
    const p = me(), m = meta(); if (!p) return;
    const t = clean(text, 600); if (!t) return;
    m.prayers = m.prayers || [];
    m.prayers.unshift({ id: crypto.randomUUID(), text: t, by: anonymous ? null : p.name, authorId: socket.id, at: Date.now(), answered: false, prayed: [] });
    if (m.prayers.length > 300) m.prayers.length = 300;
    persist();
    socket.to(socket.data.roomId).emit('notice', { text: `New prayer request on the prayer wall`, kind: 'prayer' });
    broadcast(socket.data.roomId);
  });
  socket.on('prayer:pray', pid => {
    if (!me()) return;
    const pr = findPrayer(pid); if (!pr) return;
    const i = pr.prayed.indexOf(socket.id);
    if (i >= 0) pr.prayed.splice(i, 1); else pr.prayed.push(socket.id);
    persist(); broadcast(socket.data.roomId);
  });
  socket.on('prayer:answered', pid => {
    const pr = findPrayer(pid); if (!pr || !(isHost() || pr.authorId === socket.id)) return;
    pr.answered = !pr.answered;
    persist(); broadcast(socket.data.roomId);
  });
  socket.on('prayer:remove', pid => {
    const m = meta(); const pr = findPrayer(pid);
    if (!pr || !(isHost() || pr.authorId === socket.id)) return;
    m.prayers = m.prayers.filter(x => x.id !== pid);
    persist(); broadcast(socket.data.roomId);
  });

  // ----- scripture / prayer focus card on everyone's screen -----
  socket.on('overlay:show', (o = {}) => {
    const p = me(); if (!p) return;
    if (o.kind === 'prayer' && !isHost()) return;
    room().overlay = {
      kind: o.kind === 'prayer' ? 'prayer' : 'verse',
      title: clean(o.title, 120), text: clean(o.text, 2500), by: p.name,
    };
    broadcast(socket.data.roomId);
  });
  socket.on('overlay:clear', () => {
    if (!me()) return;
    room().overlay = null;
    broadcast(socket.data.roomId);
  });

  // ----- worship lyrics (host controls) -----
  socket.on('worship:set', ({ title, lyrics } = {}) => {
    if (!isHost()) return;
    const slides = String(lyrics || '').slice(0, 20000).replace(/\r/g, '')
      .split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).slice(0, 200);
    room().worship = { title: clean(title, 120), slides, index: 0, active: slides.length > 0 };
    broadcast(socket.data.roomId);
  });
  socket.on('worship:go', i => {
    if (!isHost()) return;
    const w = room().worship;
    if (!w.slides.length) return;
    w.index = Math.max(0, Math.min(w.slides.length - 1, Number(i) || 0));
    w.active = true;
    broadcast(socket.data.roomId);
  });
  socket.on('worship:stop', () => {
    if (!isHost()) return;
    room().worship.active = false;
    broadcast(socket.data.roomId);
  });

  socket.on('recording', v => {
    const r = room(); if (!me()) return;
    if (v) r.recording.add(socket.id); else r.recording.delete(socket.id);
    broadcast(socket.data.roomId);
  });

  // ----- host controls -----
  socket.on('host:action', ({ action, target, value } = {}) => {
    if (!isHost()) return;
    const id = socket.data.roomId, r = room(), m = meta();
    const tp = target ? r.participants.get(target) : null;
    switch (action) {
      case 'mute-all':
        for (const p of r.participants.values()) if (!p.host) io.to(p.id).emit('force-mute');
        io.to(id).emit('notice', { text: 'The host muted everyone' });
        break;
      case 'mute': if (tp) io.to(target).emit('force-mute'); break;
      case 'ask-unmute': if (tp) io.to(target).emit('ask-unmute', { by: me().name }); break;
      case 'stop-video': if (tp) io.to(target).emit('force-video-off'); break;
      case 'lower-hand': if (tp) tp.hand = false; break;
      case 'lower-all-hands': for (const p of r.participants.values()) p.hand = false; break;
      case 'make-host': if (tp) { tp.host = true; io.to(id).emit('notice', { text: `${tp.name} is now a host` }); } break;
      case 'spotlight': r.spotlight = (!tp || r.spotlight === target) ? null : target; break;
      case 'lock': r.locked = !!value; io.to(id).emit('notice', { text: value ? 'The host locked the gathering' : 'The host unlocked the gathering' }); break;
      case 'waiting-room': m.waitingRoom = !!value; persist(); break;
      case 'admit':
        if (r.waiting.has(target)) { r.waiting.delete(target); r.admitted.add(target); io.to(target).emit('admitted'); }
        break;
      case 'admit-all':
        for (const wid of r.waiting.keys()) { r.admitted.add(wid); io.to(wid).emit('admitted'); }
        r.waiting.clear();
        break;
      case 'deny':
        if (r.waiting.has(target)) {
          r.waiting.delete(target);
          io.to(target).emit('denied');
          const s = clients.get(target); if (s) s.data.roomId = null;
        }
        break;
      case 'remove': {
        const s = clients.get(target);
        if (tp && s) { io.to(target).emit('removed'); leaveRoom(s); }
        return;
      }
      case 'end': {
        for (const sid of [...r.participants.keys(), ...r.waiting.keys()]) {
          const s = clients.get(sid);
          io.to(sid).emit('ended');
          if (s) { s.leave(id); s.data.roomId = null; }
        }
        live.delete(id);
        return;
      }
      default: return;
    }
    broadcast(id);
  });

  socket.on('leave', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
}

server.listen(PORT, () => console.log(`In the Midst is running on http://localhost:${PORT}`));
