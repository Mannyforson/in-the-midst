/* In the Midst client: WebRTC mesh + meeting UI */
(() => {
'use strict';
  function serverBase() {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return 'https://in-the-midst.onrender.com';
    } catch (e) {}
    return '';
  }

// ---------------------------------------------------------------- utilities
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const fmtTime = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const ago = t => { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`; const d = Math.round(h / 24); return d < 14 ? `${d} day${d > 1 ? 's' : ''} ago` : new Date(t).toLocaleDateString(); };
const formatCode = s => { const d = String(s || '').replace(/\D/g, '').slice(0, 9); return d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d; };
const linkify = html => html.replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);

const ICONS = {
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  micOff: '<path d="M2 2l20 20"/><path d="M18.9 13.9A7 7 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 4.9"/><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1"/><path d="M12 19v3"/>',
  video: '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  videoOff: '<path d="M2 2l20 20"/><path d="M10.7 6H14a2 2 0 0 1 2 2v3.3l1 1L22 7v10"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/>',
  share: '<path d="m9 10 3-3 3 3"/><path d="M12 13V7"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/>',
  record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sliders: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
  leave: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  speaker: '<rect width="20" height="13" x="2" y="3" rx="2"/><rect width="5" height="3" x="3" y="18" rx="1"/><rect width="5" height="3" x="9.5" y="18" rx="1"/><rect width="5" height="3" x="16" y="18" rx="1"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const paintIcons = (root = document) => $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); });

const TYPES = {
  prayer: { label: 'Prayer Meeting', panel: 'prayer' },
  bible: { label: 'Bible Study', panel: 'scripture' },
  worship: { label: 'Praise & Worship', panel: 'worship' },
  fellowship: { label: 'Fellowship', panel: null },
};
const REACTIONS = [['🙏', 'Amen'], ['🙌', 'Praise'], ['❤️', 'Love'], ['👏', 'Clap'], ['🔥', 'Fire'], ['🕊️', 'Peace']];

// ---------------------------------------------------------------- state
const S = {
  name: store.get('ur:name', ''),
  micOn: store.get('ur:mic', true),
  camOn: store.get('ur:cam', true),
  musicMode: store.get('ur:music', false),
  mirror: store.get('ur:mirror', true),
  devices: { audio: store.get('ur:audioDev', ''), video: store.get('ur:videoDev', ''), out: store.get('ur:outDev', '') },
  audioTrack: null, videoTrack: null, screenTrack: null, meterTrack: null,
  socket: null, selfId: null, roomId: null, room: null, ice: null,
  inMeeting: false, waiting: false,
  peers: new Map(),
  view: store.get('ur:view', 'gallery'), pinned: null,
  panel: null, unread: 0, prayerFilter: 'open',
  recorder: null, startedAt: 0,
  activeSpeaker: null, speakerAt: 0,
  prev: { hands: new Set(), waiting: new Set(), recording: '' },
  versePreview: null, ptt: false, mutedHintAt: 0, wakeLock: null,
};
const self = () => S.room?.participants.find(p => p.id === S.selfId);
const amHost = () => !!self()?.host;
const person = id => S.room?.participants.find(p => p.id === id);

// ---------------------------------------------------------------- toasts
function toast(text, opts = {}) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(text)}</span>`;
  if (opts.action) {
    const b = document.createElement('button');
    b.className = 'btn sm primary'; b.type = 'button'; b.textContent = opts.action.label;
    b.onclick = () => { opts.action.fn(); el.remove(); };
    el.appendChild(b);
  }
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, opts.timeout || 4200);
}

// ---------------------------------------------------------------- media
let actx = null;
function ensureAudioCtx() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { actx = null; }
  return actx;
}
document.addEventListener('pointerdown', () => ensureAudioCtx(), { once: true });

function audioConstraints() {
  const c = S.musicMode
    ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }
    : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (S.devices.audio) c.deviceId = { exact: S.devices.audio };
  return c;
}
function videoConstraints() {
  const c = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } };
  if (S.devices.video) c.deviceId = { exact: S.devices.video }; else c.facingMode = 'user';
  return c;
}
function mediaError(err, what) {
  const m = err?.name === 'NotAllowedError' ? `Your browser blocked the ${what}. Allow it from the icon in the address bar, then try again.`
    : err?.name === 'NotFoundError' ? `No ${what} was found on this device.`
    : err?.name === 'NotReadableError' ? `Your ${what} is in use by another app. Close that app and try again.`
    : `Could not start your ${what}.`;
  toast(m, { timeout: 6000 });
}
async function acquire(wantA, wantV) {
  if (!wantA && !wantV) return { a: null, v: null };
  if (!navigator.mediaDevices?.getUserMedia) { toast('This browser cannot use a camera or microphone. Open the link in Chrome, Safari, Edge or Firefox.'); return { a: null, v: null }; }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: wantA ? audioConstraints() : false, video: wantV ? videoConstraints() : false });
    return { a: s.getAudioTracks()[0] || null, v: s.getVideoTracks()[0] || null };
  } catch (err) {
    if ((err.name === 'OverconstrainedError' || err.name === 'NotFoundError') && (S.devices.audio || S.devices.video)) {
      S.devices.audio = ''; S.devices.video = '';
      return acquire(wantA, wantV);
    }
    if (wantA && wantV) {
      const a = await acquire(true, false);
      const v = await acquire(false, true);
      return { a: a.a, v: v.v };
    }
    mediaError(err, wantA ? 'microphone' : 'camera');
    return { a: null, v: null };
  }
}

const outVideo = () => S.screenTrack || (S.camOn ? S.videoTrack : null);
const tx = (peer, kind) => peer.pc.getTransceivers().find(t => t.receiver?.track?.kind === kind);
function replaceAudio() { for (const p of S.peers.values()) tx(p, 'audio')?.sender.replaceTrack(S.audioTrack).catch(() => {}); }
function replaceVideo() { const t = outVideo(); for (const p of S.peers.values()) tx(p, 'video')?.sender.replaceTrack(t).catch(() => {}); }

function setAudioTrack(t) {
  const old = S.audioTrack;
  S.audioTrack = t;
  if (t) t.enabled = S.micOn;
  replaceAudio();
  if (old && old !== t) old.stop();
  S.meterTrack?.stop();
  S.meterTrack = t ? t.clone() : null;
  if (S.meterTrack) S.meterTrack.enabled = true;
  meterFor(S.inMeeting ? S.selfId : 'preview', S.meterTrack);
}

async function toggleMic(force) {
  const on = typeof force === 'boolean' ? force : !S.micOn;
  if (on && (!S.audioTrack || S.audioTrack.readyState === 'ended')) {
    const { a } = await acquire(true, false);
    if (!a) return;
    S.micOn = true; setAudioTrack(a);
  }
  S.micOn = on;
  if (S.audioTrack) S.audioTrack.enabled = on;
  if (!S.ptt) store.set('ur:mic', on);
  emitMedia(); refreshControls(); renderPreview();
  if (S.inMeeting) renderTiles();
}
async function toggleCam(force) {
  const on = typeof force === 'boolean' ? force : !S.camOn;
  if (on) {
    if (!S.videoTrack || S.videoTrack.readyState === 'ended') {
      const { v } = await acquire(false, true);
      if (!v) return;
      S.videoTrack = v;
    }
  } else {
    S.videoTrack?.stop();
    S.videoTrack = null;
  }
  S.camOn = on;
  store.set('ur:cam', on);
  replaceVideo(); emitMedia(); refreshControls(); renderPreview();
  if (S.inMeeting) renderTiles();
}
function emitMedia() {
  if (!S.inMeeting) return;
  S.socket.emit('media', { mic: S.micOn && !!S.audioTrack, cam: S.camOn && !!S.videoTrack, sharing: !!S.screenTrack });
}

// ---------------------------------------------------------------- audio levels
const meters = new Map();
function meterFor(id, track) {
  const prev = meters.get(id);
  if (prev) { try { prev.src.disconnect(); } catch {} meters.delete(id); }
  if (!track || !ensureAudioCtx()) return;
  try {
    const src = actx.createMediaStreamSource(new MediaStream([track]));
    const an = actx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    meters.set(id, { src, an, trackId: track.id, data: new Uint8Array(an.fftSize), level: 0 });
  } catch { /* audio graph unavailable */ }
}
function levelOf(m) {
  m.an.getByteTimeDomainData(m.data);
  let sum = 0;
  for (const v of m.data) { const x = (v - 128) / 128; sum += x * x; }
  m.level = m.level * 0.55 + Math.sqrt(sum / m.data.length) * 0.45;
  return m.level;
}
setInterval(() => {
  if (!S.inMeeting) {
    const m = meters.get('preview');
    const bar = $('#pvLevel');
    if (bar) bar.style.height = m && S.micOn ? Math.min(100, levelOf(m) * 600) + '%' : '0%';
    return;
  }
  let loudest = null, max = 0.03;
  for (const [id, m] of meters) {
    const lvl = levelOf(m);
    const p = person(id);
    const isSelf = id === S.selfId;
    if (isSelf && !S.micOn && lvl > 0.06 && Date.now() - S.mutedHintAt > 20000) {
      S.mutedHintAt = Date.now();
      toast('You are muted. Unmute to be heard.', { action: { label: 'Unmute', fn: () => toggleMic(true) } });
    }
    const talking = !!p && p.mic && (!isSelf || S.micOn) && lvl > 0.025;
    document.getElementById('tile-' + id)?.classList.toggle('speaking', talking);
    if (talking && lvl > max && !isSelf) { max = lvl; loudest = id; }
  }
  const now = Date.now();
  if (loudest && loudest !== S.activeSpeaker && now - S.speakerAt > 1500) {
    S.activeSpeaker = loudest; S.speakerAt = now;
    if (S.view === 'speaker') layout();
  }
}, 150);

// ---------------------------------------------------------------- lobby
function showScreen(name) {
  for (const s of ['lobby', 'notice', 'meeting']) $('#' + s).hidden = s !== name;
}
function lobbyError(msg) { $('#lobbyError').textContent = msg || ''; }

function selectTab(tab) {
  $$('.seg [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('#startForm').hidden = tab !== 'start';
  $('#joinForm').hidden = tab !== 'join';
  lobbyError('');
}

const lookupCode = debounce(async () => {
  const code = formatCode($('#codeInput').value);
  const info = $('#joinInfo');
  if (code.replace(/\D/g, '').length !== 9) { info.textContent = ''; return; }
  try {
    const r = await fetch(serverBase() + '/api/rooms/' + code);
    const d = await r.json();
    info.textContent = r.ok ? `${d.title} · ${d.typeLabel} · ${d.count ? d.count + ' here now' : 'no one here yet'}` : d.error;
  } catch { info.textContent = ''; }
}, 300);

function renderRecent() {
  const list = store.get('ur:hosted', []);
  $('#recent').hidden = !list.length;
  $('#recentList').innerHTML = list.map(r => `
    <li><div class="r-info"><div class="r-title">${esc(r.title)}</div><div class="r-meta">${esc(TYPES[r.type]?.label || '')} · ${esc(r.id)}</div></div>
    <div class="r-actions"><button class="btn sm primary" type="button" data-start="${esc(r.id)}">Start</button>
    <button class="btn sm ghost" type="button" data-forget="${esc(r.id)}" aria-label="Remove ${esc(r.title)} from this list">Remove</button></div></li>`).join('');
}

function renderPreview() {
  const box = $('#preview');
  if (!box) return;
  const v = $('#previewVideo');
  const on = S.camOn && S.videoTrack;
  if (on) { if (v.srcObject?.getVideoTracks()[0] !== S.videoTrack) v.srcObject = new MediaStream([S.videoTrack]); }
  else v.srcObject = null;
  box.classList.toggle('no-video', !on);
  box.classList.toggle('no-mirror', !S.mirror);
  const name = $('#nameInput').value.trim();
  const av = $('#previewAvatar span');
  av.textContent = initials(name);
  av.style.setProperty('--h', hue(name));
  const mic = $('#pvMic'), cam = $('#pvCam');
  mic.innerHTML = icon(S.micOn ? 'mic' : 'micOff'); mic.classList.toggle('off', !S.micOn);
  mic.title = S.micOn ? 'Mute microphone' : 'Unmute microphone'; mic.setAttribute('aria-label', mic.title);
  cam.innerHTML = icon(S.camOn ? 'video' : 'videoOff'); cam.classList.toggle('off', !S.camOn);
  cam.title = S.camOn ? 'Turn camera off' : 'Turn camera on'; cam.setAttribute('aria-label', cam.title);
}

async function startPreview() {
  const needA = S.micOn && !S.audioTrack;
  const needV = S.camOn && !S.videoTrack;
  if (needA || needV) {
    const { a, v } = await acquire(needA, needV);
    if (needA) { if (a) setAudioTrack(a); else S.micOn = false; }
    if (needV) { if (v) S.videoTrack = v; else S.camOn = false; }
  } else if (S.meterTrack) meterFor('preview', S.meterTrack);
  renderPreview();
}

function initLobby() {
  $('#nameInput').value = S.name;
  $('#nameInput').addEventListener('input', renderPreview);
  $$('.seg [data-tab]').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  $('#codeInput').addEventListener('input', e => { e.target.value = formatCode(e.target.value); lookupCode(); });

  const params = new URLSearchParams(location.search);
  const code = params.get('room');
  if (code) { selectTab('join'); $('#codeInput').value = formatCode(code); lookupCode(); }

  $('#startForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!checkName()) return;
    const type = $('#startForm').querySelector('input[name=type]:checked').value;
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      const r = await fetch(serverBase() + '/api/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: $('#titleInput').value.trim(), type, waitingRoom: $('#waitingInput').checked }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      store.set('ur:host:' + d.id, d.hostKey);
      const list = store.get('ur:hosted', []).filter(x => x.id !== d.id);
      list.unshift({ id: d.id, title: d.title, type: d.type });
      store.set('ur:hosted', list.slice(0, 12));
      S.freshStart = true;
      await joinRoom(d.id, true);
    } catch { lobbyError('Could not start the gathering. Check your internet connection and try again.'); }
    finally { if (btn) btn.disabled = false; }
  });

  $('#joinForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = formatCode($('#codeInput').value);
    if (code.replace(/\D/g, '').length !== 9) { lobbyError('Enter the 9-digit meeting code, e.g. 123-456-789.'); return; }
    if (!checkName()) return;
    joinRoom(code);
  });

  $('#recentList').addEventListener('click', e => {
    const s = e.target.closest('[data-start]'), f = e.target.closest('[data-forget]');
    if (s && checkName()) { S.freshStart = true; joinRoom(s.dataset.start, true); }
    if (f) { store.set('ur:hosted', store.get('ur:hosted', []).filter(x => x.id !== f.dataset.forget)); renderRecent(); }
  });

  $('#pvMic').addEventListener('click', () => toggleMic());
  $('#pvCam').addEventListener('click', () => toggleCam());
  $('#pvSettings').addEventListener('click', openSettings);
  $('#noticeBtn').addEventListener('click', () => {
    if (S.waiting) { S.socket?.emit('leave'); S.waiting = false; }
    goLobby();
  });
  renderRecent();
  startPreview();
}
function checkName() {
  const n = $('#nameInput').value.trim();
  if (!n) { lobbyError('Please enter your name so others know who joined.'); $('#nameInput').focus(); return false; }
  S.name = n; store.set('ur:name', n); lobbyError('');
  return true;
}
function goLobby() {
  showScreen('lobby');
  history.replaceState(null, '', location.pathname);
  renderRecent();
  startPreview();
}

// ---------------------------------------------------------------- connection
// Small event socket over WebSocket: on/once/emit with acks, auto-reconnect.
function createConnection() {
  const listeners = new Map(), acks = new Map();
  let ws = null, seq = 0, retry = 0;
  const fire = (e, d) => (listeners.get(e) || []).slice().forEach(fn => { try { fn(d); } catch (err) { console.error(err); } });
  const api = {
    connected: false,
    on(e, fn) { if (!listeners.has(e)) listeners.set(e, []); listeners.get(e).push(fn); return api; },
    off(e, fn) { const l = listeners.get(e); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } return api; },
    once(e, fn) { const w = d => { api.off(e, w); fn(d); }; return api.on(e, w); },
    emit(e, d, cb) {
      if (!api.connected) return false;
      const m = { e, d };
      if (cb) { m.a = ++seq; acks.set(m.a, cb); }
      ws.send(JSON.stringify(m));
      return true;
    },
  };
  function open() {
    ws = new WebSocket(serverBase() ? serverBase().replace(/^http/, 'ws') + '/ws' : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { retry = 0; api.connected = true; fire('connect'); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.e === '__ack') { const cb = acks.get(m.a); acks.delete(m.a); if (cb) cb(m.d); return; }
      fire(m.e, m.d);
    };
    ws.onclose = () => {
      const was = api.connected;
      api.connected = false; acks.clear();
      if (was) fire('disconnect');
      setTimeout(open, Math.min(8000, 400 * 2 ** retry++));
    };
  }
  open();
  return api;
}

function connectSocket() {
  if (S.socket) return;
  const sock = S.socket = createConnection();
  
  sock.on('state', st => { if (S.inMeeting) { S.room = st; renderRoom(); } });
  sock.on('signal', onSignal);
  sock.on('peer-left', closePeer);
  sock.on('chat', m => addChat(m, true));
  sock.on('notice', n => { if (S.inMeeting) toast(n.text, { timeout: 2600 }); });
  sock.on('reaction', floatReaction);
  sock.on('force-mute', () => { toggleMic(false); toast('The host muted your microphone.'); });
  sock.on('ask-unmute', ({ by }) => toast(`${by} is asking you to unmute.`, { timeout: 9000, action: { label: 'Unmute', fn: () => toggleMic(true) } }));
  sock.on('force-video-off', () => { toggleCam(false); toast('The host turned off your video.'); });
  sock.on('removed', () => endMeeting('You were removed', 'The host removed you from this gathering.'));
  sock.on('ended', () => { if (S.inMeeting || S.waiting) endMeeting('The gathering has ended', 'The host ended this gathering for everyone. Thank you for joining.'); });
  sock.on('admitted', () => { if (S.waiting) emitJoin(); });
  sock.on('denied', () => { S.waiting = false; showNotice('You were not let in', 'The host did not admit you to this gathering.', 'Back to start'); });
  sock.on('disconnect', () => { if (S.inMeeting) toast('Connection lost. Reconnecting…', { timeout: 6000 }); });
  sock.on('connect', () => {
    if (S.inMeeting || S.waiting) { closeAllPeers(); emitJoin(); }
  });
}
function emitJoin() {
  S.socket.emit('join', {
    roomId: S.roomId, name: S.name, hostKey: S.asHost ? store.get('ur:host:' + S.roomId, null) : null,
    mic: S.micOn && !!S.audioTrack, cam: S.camOn && !!S.videoTrack,
  }, onJoined);
}
async function joinRoom(code, asHost = false) {
  ensureAudioCtx();
  lobbyError('');
  if (!S.ice) {
    try { S.ice = await (await fetch(serverBase() + '/api/ice')).json(); }
    catch { S.ice = [{ urls: 'stun:stun.l.google.com:19302' }]; }
  }
  S.roomId = code; 
  S.asHost = asHost;
  connectSocket();
  if (S.socket.connected) emitJoin();
  else S.socket.once('connect', () => { if (!S.inMeeting && !S.waiting) emitJoin(); });
}
function showNotice(title, text, btn) {
  $('#noticeTitle').textContent = title;
  $('#noticeText').textContent = text;
  $('#noticeBtn').textContent = btn || 'Back to start';
  $('.notice-card .brand-mark').classList.toggle('pulse', S.waiting);
  showScreen('notice');
}

function onJoined(res) {
  if (!res || res.error) {
    const msg = res?.error || 'Could not join. Try again.';
    if (S.inMeeting) { endMeeting('Could not reconnect', msg); return; }
    S.waiting = false;
    showScreen('lobby'); lobbyError(msg);
    return;
  }
  if (res.waiting) {
    S.waiting = true;
    showNotice('Waiting for the host', `You're in the waiting room for “${res.title}”. The host will let you in shortly.`, 'Leave');
    return;
  }
  const wasIn = S.inMeeting;
  S.waiting = false;
  S.selfId = res.self;
  S.room = res.state;
  S.inMeeting = true;
  if (!wasIn) {
    S.startedAt = Date.now();
    $('#tiles').innerHTML = '';
    $('#chatList').innerHTML = '<p class="empty">Messages you send here go to everyone unless you choose one person.</p>';
    S.unread = 0;
  } else {
    $$('#tiles .tile').forEach(t => t.remove());
  }
  res.chat.forEach(m => addChat(m, false));
  showScreen('meeting');
  history.replaceState(null, '', '?room=' + S.room.id);
  meters.clear();
  if (S.meterTrack) meterFor(S.selfId, S.meterTrack);
  renderRoom();
  res.peers.forEach(callPeer);
  emitMedia();
  requestWakeLock();
  if (!wasIn) {
    const t = TYPES[S.room.type];
    if (t?.panel && (window.innerWidth > 820 || S.room.type === 'worship' && amHost())) openPanel(t.panel);
    if (S.room.type === 'worship' && amHost() && !S.musicMode) {
      toast('Leading worship? Turn on Original sound for music so singing comes through clearly.', { timeout: 9000, action: { label: 'Turn on', fn: () => setMusicMode(true) } });
    }
    if (S.freshStart && amHost()) {
      toast('Your gathering is open. Copy the invite and send it to your church.', { timeout: 8000, action: { label: 'Copy invite', fn: copyInvite } });
    }
    S.freshStart = false;
  }
}

// ---------------------------------------------------------------- WebRTC
function createPeer(id) {
  const pc = new RTCPeerConnection({ iceServers: S.ice });
  const peer = { id, pc, stream: new MediaStream(), pending: [], initiator: false };
  S.peers.set(id, peer);
  pc.onicecandidate = e => { if (e.candidate) S.socket.emit('signal', { to: id, data: { candidate: e.candidate } }); };
  pc.ontrack = e => {
    peer.stream.getTracks().filter(t => t.kind === e.track.kind && t !== e.track).forEach(t => peer.stream.removeTrack(t));
    if (!peer.stream.getTracks().includes(e.track)) peer.stream.addTrack(e.track);
    attachRemote(id);
  };
  pc.onconnectionstatechange = async () => {
    setTileStatus(id);
    if (pc.connectionState === 'failed' && peer.initiator) {
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        S.socket.emit('signal', { to: id, data: { sdp: pc.localDescription } });
      } catch { /* will retry on next state change */ }
    }
  };
  return peer;
}
async function callPeer(id) {
  const peer = createPeer(id);
  peer.initiator = true;
  const pc = peer.pc;
  pc.addTransceiver(S.audioTrack || 'audio', { direction: 'sendrecv' });
  pc.addTransceiver(outVideo() || 'video', { direction: 'sendrecv' });
  try {
    await pc.setLocalDescription(await pc.createOffer());
    S.socket.emit('signal', { to: id, data: { sdp: pc.localDescription } });
  } catch (e) { console.warn('offer failed', e); }
}
async function onSignal({ from, data }) {
  if (!S.inMeeting) return;
  let peer = S.peers.get(from);
  try {
    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        if (!peer) peer = createPeer(from);
        await peer.pc.setRemoteDescription(data.sdp);
        for (const t of peer.pc.getTransceivers()) {
          const kind = t.receiver.track.kind;
          t.direction = 'sendrecv';
          await t.sender.replaceTrack(kind === 'audio' ? S.audioTrack : outVideo());
        }
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        S.socket.emit('signal', { to: from, data: { sdp: peer.pc.localDescription } });
      } else if (peer) {
        await peer.pc.setRemoteDescription(data.sdp);
      }
      if (peer) for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
    } else if (data.candidate) {
      if (!peer) peer = createPeer(from);
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
      else peer.pending.push(data.candidate);
    }
  } catch (e) { console.warn('signal error', e); }
}
function closePeer(id) {
  const p = S.peers.get(id);
  if (p) { try { p.pc.close(); } catch {} S.peers.delete(id); }
  const m = meters.get(id);
  if (m) { try { m.src.disconnect(); } catch {} meters.delete(id); }
}
function closeAllPeers() { [...S.peers.keys()].forEach(closePeer); }

// ---------------------------------------------------------------- tiles + layout
function ensureTile(id) {
  let el = document.getElementById('tile-' + id);
  if (el) return el;
  el = document.createElement('div');
  el.className = 'tile';
  el.id = 'tile-' + id;
  el.dataset.id = id;
  el.innerHTML = `<video autoplay playsinline${id === S.selfId ? ' muted' : ''}></video>
    <div class="avatar"><span></span></div>
    <div class="nameplate"><span class="mi"></span><span class="nm"></span><span class="host-tag"></span></div>
    <div class="hand-badge" hidden>✋ Hand</div>
    <div class="tile-status"></div>`;
  el.addEventListener('dblclick', () => { S.pinned = S.pinned === id ? null : id; layout(); toast(S.pinned ? 'Pinned to your screen. Double-click again to unpin.' : 'Unpinned.', { timeout: 2200 }); });
  $('#tiles').appendChild(el);
  if (id !== S.selfId) attachRemote(id);
  return el;
}
function attachRemote(id) {
  const peer = S.peers.get(id);
  const el = document.getElementById('tile-' + id);
  if (!peer || !el) return;
  const v = $('video', el);
  if (v.srcObject !== peer.stream) v.srcObject = peer.stream;
  if (S.devices.out && v.setSinkId) v.setSinkId(S.devices.out).catch(() => {});
  v.play().catch(() => {
    toast('Tap to hear the others in this gathering.', { timeout: 10000, action: { label: 'Turn on sound', fn: () => $$('#tiles video').forEach(x => x.play().catch(() => {})) } });
  });
  const a = peer.stream.getAudioTracks()[0];
  if (a && meters.get(id)?.trackId !== a.id) meterFor(id, a);
}
function updateSelfVideo() {
  const el = document.getElementById('tile-' + S.selfId);
  if (!el) return;
  const v = $('video', el);
  const t = outVideo();
  if (t) { if (v.srcObject?.getVideoTracks()[0] !== t) v.srcObject = new MediaStream([t]); }
  else if (v.srcObject) v.srcObject = null;
}
function setTileStatus(id) {
  const el = document.getElementById('tile-' + id);
  const pc = S.peers.get(id)?.pc;
  if (!el || id === S.selfId) return;
  const st = pc?.connectionState;
  $('.tile-status', el).textContent = !pc || st === 'new' || st === 'connecting' ? 'Connecting…' : st === 'disconnected' ? 'Reconnecting…' : st === 'failed' ? 'Connection problem' : '';
}
function renderTiles() {
  const box = $('#tiles');
  const parts = S.room.participants;
  const ids = new Set(parts.map(p => p.id));
  $$('.tile', box).forEach(t => { if (!ids.has(t.dataset.id)) t.remove(); });
  for (const p of parts) {
    const el = ensureTile(p.id);
    const isSelf = p.id === S.selfId;
    const hasVideo = isSelf ? !!outVideo() : (p.cam || p.sharing);
    el.classList.toggle('no-video', !hasVideo);
    el.classList.toggle('sharing', !!p.sharing);
    el.classList.toggle('mirror', isSelf && S.mirror && !S.screenTrack);
    const mic = isSelf ? S.micOn && !!S.audioTrack : p.mic;
    $('.mi', el).innerHTML = mic ? '' : icon('micOff');
    $('.mi', el).hidden = mic;
    $('.nm', el).textContent = p.name + (isSelf ? ' (You)' : '') + (p.sharing ? ' · sharing screen' : '');
    $('.host-tag', el).textContent = p.host ? 'Host' : '';
    const av = $('.avatar span', el);
    av.textContent = initials(p.name);
    av.style.setProperty('--h', hue(p.name));
    $('.hand-badge', el).hidden = !p.hand;
    if (isSelf) updateSelfVideo(); else setTileStatus(p.id);
  }
  layout();
}
function layout() {
  const box = $('#tiles');
  if (!S.room || box.offsetParent === null) return;
  const parts = S.room.participants;
  const n = parts.length;
  const sharer = parts.find(p => p.sharing);
  let focusId = sharer?.id || (person(S.room.spotlight) && S.room.spotlight) || (person(S.pinned) && S.pinned) || null;
  if (!focusId && S.view === 'speaker') {
    focusId = (person(S.activeSpeaker) && S.activeSpeaker) || parts.find(p => p.id !== S.selfId)?.id || null;
  }
  if (n < 2) focusId = null;
  box.classList.toggle('focus', !!focusId);
  $$('.tile', box).forEach(t => t.classList.toggle('main', t.dataset.id === focusId));
  if (!focusId) {
    const W = box.clientWidth, H = box.clientHeight, gap = 10;
    let best = { cols: 1, area: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = (W - gap * (cols - 1)) / cols;
      const h = (H - gap * (rows - 1)) / rows;
      const tw = Math.min(w, h * 16 / 9);
      const area = tw * tw * 9 / 16;
      if (area > best.area) best = { cols, area };
    }
    box.style.setProperty('--cols', best.cols);
    box.style.setProperty('--rows', Math.max(1, Math.ceil(n / best.cols)));
  }
  $('#viewBtn').innerHTML = S.view === 'gallery'
    ? `<span data-icon="speaker"></span><span class="lb">Speaker view</span>`
    : `<span data-icon="grid"></span><span class="lb">Gallery view</span>`;
  paintIcons($('#viewBtn'));
}
new ResizeObserver(() => layout()).observe(document.getElementById('tiles'));

// ---------------------------------------------------------------- room rendering
function renderRoom() {
  const r = S.room;
  if (!r) return;
  $('#roomTitle').textContent = r.title;
  $('#typePill').textContent = r.typeLabel;
  $('#codeText').textContent = r.id;
  document.title = `${r.title} · In the Midst`;
  $('#lockBadge').hidden = !r.locked;
  $('#recBadge').hidden = !r.recording.length;
  $('#recBadge').textContent = r.recording.length ? `Recording` : '';
  $('#recBadge').title = r.recording.length ? `Being recorded by ${r.recording.join(', ')}` : '';
  renderTiles();
  renderPeople();
  renderPrayers();
  renderOverlay();
  renderWorship();
  renderChatTo();
  refreshControls();
  watchChanges();
}
function watchChanges() {
  const r = S.room;
  const hands = new Set(r.participants.filter(p => p.hand).map(p => p.id));
  const waiting = new Set(r.waiting.map(w => w.id));
  if (amHost()) {
    for (const id of hands) if (!S.prev.hands.has(id) && id !== S.selfId) toast(`${person(id)?.name} raised their hand`, { timeout: 3500 });
    for (const w of r.waiting) if (!S.prev.waiting.has(w.id)) toast(`${w.name} is in the waiting room`, { timeout: 8000, action: { label: 'Admit', fn: () => hostAction('admit', w.id) } });
  }
  const rec = r.recording.join('|');
  if (rec && rec !== S.prev.recording) toast(`This gathering is being recorded by ${r.recording.join(', ')}.`, { timeout: 5000 });
  S.prev = { hands, waiting, recording: rec };
  const wa = $('#waitAlert');
  wa.hidden = !(amHost() && r.waiting.length);
  wa.textContent = `${r.waiting.length} waiting to join · Review`;
}

function refreshControls() {
  const mic = $('#tMic'), cam = $('#tCam');
  const micLive = S.micOn && !!S.audioTrack;
  $('.ic', mic).innerHTML = icon(micLive ? 'mic' : 'micOff');
  $('.lb', mic).textContent = micLive ? 'Mute' : 'Unmute';
  mic.classList.toggle('off', !micLive);
  const camLive = S.camOn && !!S.videoTrack;
  $('.ic', cam).innerHTML = icon(camLive ? 'video' : 'videoOff');
  $('.lb', cam).textContent = camLive ? 'Stop video' : 'Start video';
  cam.classList.toggle('off', !camLive);
  $('#tShare').classList.toggle('on', !!S.screenTrack);
  $('#tShare .lb').textContent = S.screenTrack ? 'Stop share' : 'Share';
  $('#tRec').classList.toggle('on', !!S.recorder);
  $('#tRec .lb').textContent = S.recorder ? 'Stop rec' : 'Record';
  const me = self();
  $('#tHand').classList.toggle('on', !!me?.hand);
  $('#tHand .lb').textContent = me?.hand ? 'Lower hand' : 'Raise hand';
  $$('.toolbar [data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === S.panel));
  $('#chatCount').hidden = !S.unread;
  $('#chatCount').textContent = S.unread > 99 ? '99+' : S.unread;
  if (S.room) {
    $('#peopleCount').textContent = S.room.participants.length;
    const open = S.room.prayers.filter(p => !p.answered).length;
    $('#prayerCount').hidden = !open;
    $('#prayerCount').textContent = open;
  }
}

// ---------------------------------------------------------------- panel
function openPanel(name) {
  if (S.panel === name) { closePanel(); return; }
  S.panel = name;
  $('#panel').hidden = false;
  $$('.panel-tabs [data-panel]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.panel === name)));
  document.querySelector('.panel-tabs [data-panel="' + name + '"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  $$('.pane').forEach(p => { p.hidden = p.dataset.pane !== name; });
  if (name === 'chat') {
    S.unread = 0;
    const list = $('#chatList'); list.scrollTop = list.scrollHeight;
    if (window.innerWidth > 820) $('#chatInput').focus();
  }
  refreshControls();
  requestAnimationFrame(layout);
}
function closePanel() {
  S.panel = null;
  $('#panel').hidden = true;
  refreshControls();
  requestAnimationFrame(layout);
}

// ---------------------------------------------------------------- chat
function addChat(m, live) {
  const list = $('#chatList');
  list.querySelector('.empty')?.remove();
  const mine = m.from === S.selfId;
  const el = document.createElement('div');
  el.className = 'msg' + (mine ? ' mine' : '') + (m.to ? ' private' : '');
  const toWho = m.to ? (m.to === S.selfId ? 'you' : esc(m.toName)) : '';
  el.innerHTML = `<div class="meta"><b>${esc(mine ? 'You' : m.name)}</b>${m.to ? `<span class="dm">to ${toWho} · private</span>` : ''}<time>${fmtTime(m.at)}</time></div>
    <div class="text">${linkify(esc(m.text))}</div>`;
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  list.appendChild(el);
  if (nearBottom || mine) list.scrollTop = list.scrollHeight;
  if (live && !mine && S.panel !== 'chat') {
    S.unread++;
    refreshControls();
    toast(`${m.name}${m.to ? ' (privately)' : ''}: ${m.text.slice(0, 90)}`, { timeout: 4000, action: { label: 'Open', fn: () => openPanel('chat') } });
  }
}
function renderChatTo() {
  const sel = $('#chatTo');
  const cur = sel.value;
  const others = S.room.participants.filter(p => p.id !== S.selfId);
  const key = others.map(p => p.id + ':' + p.name).join('|');
  if (sel.dataset.key === key) return;
  sel.dataset.key = key;
  sel.innerHTML = '<option value="">Everyone</option>' + others.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (privately)</option>`).join('');
  sel.value = others.some(p => p.id === cur) ? cur : '';
}

// ---------------------------------------------------------------- people + host controls
function hostAction(action, target, value) { S.socket.emit('host:action', { action, target, value }); }
function renderPeople() {
  const r = S.room, host = amHost();
  $('#hostTools').hidden = !host;
  $('#lockToggle').checked = r.locked;
  $('#waitToggle').checked = r.waitingRoom;

  const wb = $('#waitingBox');
  wb.hidden = !(host && r.waiting.length);
  if (host && r.waiting.length) {
    wb.innerHTML = `<h4>Waiting room (${r.waiting.length}) <button class="btn sm primary" type="button" data-act="admit-all">Admit all</button></h4>` +
      r.waiting.map(w => `<div class="p-row"><span class="p-av" style="--h:${hue(w.name)}">${esc(initials(w.name))}</span><span class="p-name">${esc(w.name)}</span>
        <button class="btn sm primary" type="button" data-act="admit" data-id="${esc(w.id)}">Admit</button>
        <button class="btn sm" type="button" data-act="deny" data-id="${esc(w.id)}">Remove</button></div>`).join('');
  }

  const sorted = [...r.participants].sort((a, b) =>
    (b.id === S.selfId) - (a.id === S.selfId) || b.hand - a.hand || b.host - a.host || a.name.localeCompare(b.name));
  $('#peopleList').innerHTML = sorted.map(p => {
    const isSelf = p.id === S.selfId;
    const mic = isSelf ? S.micOn && !!S.audioTrack : p.mic;
    const cam = isSelf ? !!(S.camOn && S.videoTrack) : p.cam;
    const tags = [isSelf && 'You', p.host && 'Host', r.spotlight === p.id && 'Spotlight'].filter(Boolean).join(', ');
    let actions = '';
    if (host && !isSelf) {
      actions = `<div class="p-actions">
        ${p.mic ? `<button class="btn sm" type="button" data-act="mute" data-id="${p.id}">Mute</button>` : `<button class="btn sm" type="button" data-act="ask-unmute" data-id="${p.id}">Ask to unmute</button>`}
        ${p.cam ? `<button class="btn sm" type="button" data-act="stop-video" data-id="${p.id}">Stop video</button>` : ''}
        ${p.hand ? `<button class="btn sm" type="button" data-act="lower-hand" data-id="${p.id}">Lower hand</button>` : ''}
        <button class="btn sm" type="button" data-act="spotlight" data-id="${p.id}">${r.spotlight === p.id ? 'Remove spotlight' : 'Spotlight'}</button>
        ${p.host ? '' : `<button class="btn sm" type="button" data-act="make-host" data-id="${p.id}">Make host</button>`}
        <button class="btn sm" type="button" data-act="remove" data-id="${p.id}">Remove</button>
      </div>`;
    } else if (host && isSelf) {
      actions = `<div class="p-actions"><button class="btn sm" type="button" data-act="spotlight" data-id="${p.id}">${r.spotlight === p.id ? 'Remove spotlight' : 'Spotlight me'}</button></div>`;
    }
    return `<li class="person"><div class="p-row">
      <span class="p-av" style="--h:${hue(p.name)}">${esc(initials(p.name))}</span>
      <span class="p-name">${esc(p.name)}${tags ? ` <small>(${tags})</small>` : ''}</span>
      <span class="p-icons">${p.hand ? '<span class="hand">✋</span>' : ''}
        <span class="${mic ? '' : 'off'}" title="${mic ? 'Microphone on' : 'Muted'}">${icon(mic ? 'mic' : 'micOff')}</span>
        <span class="${cam ? '' : 'off'}" title="${cam ? 'Video on' : 'Video off'}">${icon(cam ? 'video' : 'videoOff')}</span></span>
    </div>${actions}</li>`;
  }).join('');
}
function onPeopleClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, id } = b.dataset;
  if (act === 'remove' && !b.classList.contains('confirm')) {
    b.classList.add('confirm'); b.textContent = 'Confirm remove';
    setTimeout(() => { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = 'Remove'; } }, 4000);
    return;
  }
  hostAction(act, id);
}

// ---------------------------------------------------------------- prayer wall
function renderPrayers() {
  const host = amHost();
  const all = S.room.prayers;
  const openN = all.filter(p => !p.answered).length, ansN = all.length - openN;
  $('#prayerFilter [data-pf=open]').textContent = `Praying (${openN})`;
  $('#prayerFilter [data-pf=answered]').textContent = `Answered (${ansN})`;
  $$('#prayerFilter [data-pf]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pf === S.prayerFilter)));
  const list = all.filter(p => S.prayerFilter === 'answered' ? p.answered : !p.answered);
  if (!list.length) {
    $('#prayerList').innerHTML = `<li class="empty">${S.prayerFilter === 'answered' ? 'When a prayer is answered, mark it here and it moves to this list as a praise report.' : 'No requests yet. Add the first one above. Requests stay on this wall between meetings.'}</li>`;
    return;
  }
  $('#prayerList').innerHTML = list.map(p => {
    const mine = p.authorId === S.selfId;
    const prayed = p.prayed.includes(S.selfId);
    const n = p.prayed.length;
    return `<li class="prayer${p.answered ? ' answered' : ''}">
      <p class="pr-text">${esc(p.text)}</p>
      <div class="pr-meta">${p.answered ? '<span class="answered-tag">Answered · </span>' : ''}${esc(p.by || 'Anonymous')} · ${ago(p.at)}${n ? ` · ${n} praying` : ''}</div>
      <div class="pr-actions">
        <button class="btn sm${prayed ? ' prayed' : ''}" type="button" data-pr="pray" data-id="${p.id}">🙏 ${prayed ? 'Praying' : 'I prayed'}</button>
        ${host ? `<button class="btn sm" type="button" data-pr="show" data-id="${p.id}">Put on screen</button>` : ''}
        ${host || mine ? `<button class="btn sm" type="button" data-pr="answered" data-id="${p.id}">${p.answered ? 'Move back' : 'Mark answered'}</button>
        <button class="btn sm ghost" type="button" data-pr="remove" data-id="${p.id}">Delete</button>` : ''}
      </div></li>`;
  }).join('');
}
function onPrayerClick(e) {
  const b = e.target.closest('[data-pr]');
  if (!b) return;
  const { pr, id } = b.dataset;
  if (pr === 'show') {
    const p = S.room.prayers.find(x => x.id === id);
    if (p) S.socket.emit('overlay:show', { kind: 'prayer', title: p.by ? `For ${p.by}'s request` : 'A request from our church', text: p.text });
    return;
  }
  if (pr === 'remove' && !b.classList.contains('confirm')) {
    b.classList.add('confirm'); b.textContent = 'Confirm delete';
    setTimeout(() => { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = 'Delete'; } }, 4000);
    return;
  }
  S.socket.emit('prayer:' + pr, id);
}

// ---------------------------------------------------------------- scripture
async function lookupVerse(e) {
  e.preventDefault();
  const ref = $('#verseRef').value.trim();
  const tr = $('#verseTr').value;
  const box = $('#versePreview');
  if (!ref) { $('#verseRef').focus(); return; }
  box.innerHTML = '<p class="hint">Looking up…</p>';
  try {
    const url = `https://bible-api.com/${encodeURIComponent(ref).replace(/%20/g, '+').replace(/%3A/gi, ':')}?translation=${tr}`;
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok || d.error || !d.verses?.length) throw new Error();
    const multi = d.verses.length > 1;
    const text = d.verses.map(v => (multi ? v.verse + ' ' : '') + v.text.replace(/\s+/g, ' ').trim()).join(' ').slice(0, 2500);
    S.versePreview = { title: `${d.reference} (${tr.toUpperCase()})`, text };
    box.innerHTML = `<div class="verse-card"><h4>${esc(S.versePreview.title)}</h4><p>${esc(text)}</p>
      <div class="row"><button class="btn primary sm" type="button" id="showVerse">Show to everyone</button></div></div>`;
    $('#showVerse').onclick = () => { S.socket.emit('overlay:show', { kind: 'verse', ...S.versePreview }); toast('Passage is on everyone’s screen.', { timeout: 2500 }); };
  } catch {
    box.innerHTML = `<p class="hint">Couldn’t find “${esc(ref)}”. Check the book, chapter and verse (e.g. Romans 8:28), or type the passage yourself below.</p>`;
  }
}
function renderOverlay() {
  const o = S.room.overlay;
  const el = $('#overlay');
  el.hidden = !o;
  const scr = $('#onScreen');
  if (!o) { scr.innerHTML = ''; return; }
  el.classList.toggle('prayer', o.kind === 'prayer');
  $('.ov-kind', el).textContent = o.kind === 'prayer' ? 'Let us pray' : 'Scripture';
  $('.ov-title', el).textContent = o.title;
  $('.ov-text', el).textContent = o.text;
  $('.ov-by', el).textContent = `Shared by ${o.by}`;
  scr.innerHTML = `<span class="label">On everyone's screen now</span><b>${esc(o.title)}</b>
    <div><button class="btn sm" type="button" data-clear>Remove from screen</button></div>`;
}

// ---------------------------------------------------------------- worship
function renderWorship() {
  const w = S.room.worship, host = amHost();
  $('#worshipHost').hidden = !host;
  $('#worshipGuest').hidden = host;
  $('#worshipCtl').hidden = !host || !w.slides.length;
  $('#wStop').textContent = w.active ? 'Stop presenting' : 'Present again';
  $('#slideList').innerHTML = w.slides.length
    ? w.slides.map((s, i) => `<li class="${w.active && i === w.index ? 'current' : ''}"><button type="button" data-slide="${i}" ${host ? '' : 'disabled'}>${esc(s)}</button></li>`).join('')
    : (host ? '' : '<li class="empty">No song is being presented yet.</li>');
  const ly = $('#lyrics');
  ly.hidden = !w.active || !w.slides.length;
  if (!ly.hidden) {
    $('.ly-title', ly).textContent = w.title || 'Worship';
    const t = $('.ly-text', ly);
    const txt = w.slides[w.index];
    if (t.textContent !== txt) { t.textContent = txt; t.classList.remove('fade'); void t.offsetWidth; t.classList.add('fade'); }
    $('.ly-ctl', ly).hidden = !host;
    $('#lyCount').textContent = `${w.index + 1} / ${w.slides.length}`;
  }
  renderSongLib();
}
function worshipGo(delta) {
  const w = S.room?.worship;
  if (!w?.slides.length || !amHost()) return;
  S.socket.emit('worship:go', Math.max(0, Math.min(w.slides.length - 1, w.index + delta)));
}
function renderSongLib() {
  const box = $('#songLib');
  if (!amHost()) { box.innerHTML = ''; return; }
  const songs = store.get('ur:songs', []);
  box.innerHTML = songs.length ? `<h4>Saved songs on this device</h4>` + songs.map((s, i) => `<div class="song">
    <button class="load" type="button" data-song="${i}">${esc(s.title || 'Untitled song')}</button>
    <button class="btn sm ghost" type="button" data-delsong="${i}" aria-label="Delete ${esc(s.title)}">Delete</button></div>`).join('') : '';
}

// ---------------------------------------------------------------- reactions
function floatReaction({ from, emoji }) {
  const stage = $('#stage');
  const tile = document.getElementById('tile-' + from);
  const sr = stage.getBoundingClientRect();
  let x = sr.width * (0.2 + Math.random() * 0.6), y = sr.height - 60;
  if (tile && tile.offsetParent) {
    const tr = tile.getBoundingClientRect();
    x = tr.left - sr.left + 20 + Math.random() * Math.max(10, tr.width - 80);
    y = tr.bottom - sr.top - 70;
  }
  const el = document.createElement('div');
  el.className = 'float';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.innerHTML = `<span class="e">${esc(emoji)}</span><span class="n">${esc(from === S.selfId ? 'You' : person(from)?.name || '')}</span>`;
  $('#floaters').appendChild(el);
  setTimeout(() => el.remove(), 3100);
}
function toggleReactPop() {
  const pop = $('#reactPop');
  if (!pop.hidden) { pop.hidden = true; return; }
  pop.innerHTML = REACTIONS.map(([e, l]) => `<button type="button" role="menuitem" data-react="${e}"><span class="e">${e}</span><span class="l">${l}</span></button>`).join('');
  pop.hidden = false;
  const br = $('#tReact').getBoundingClientRect();
  const pw = pop.offsetWidth;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, br.left + br.width / 2 - pw / 2)) + 'px';
  pop.style.top = (br.top - pop.offsetHeight - 10) + 'px';
}

// ---------------------------------------------------------------- screen share
async function toggleShare() {
  if (S.screenTrack) { stopShare(); return; }
  const other = S.room.participants.find(p => p.sharing && p.id !== S.selfId);
  if (other) { toast(`${other.name} is sharing their screen. Ask them to stop first.`); return; }
  if (!navigator.mediaDevices?.getDisplayMedia) { toast('Screen sharing isn’t available on this device. Use a computer with Chrome, Edge or Firefox.'); return; }
  try {
    const ds = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
    S.screenTrack = ds.getVideoTracks()[0];
    try { S.screenTrack.contentHint = 'detail'; } catch {}
    S.screenTrack.onended = stopShare;
    replaceVideo(); emitMedia(); renderTiles(); refreshControls();
  } catch { /* user cancelled */ }
}
function stopShare() {
  if (!S.screenTrack) return;
  S.screenTrack.onended = null;
  S.screenTrack.stop();
  S.screenTrack = null;
  replaceVideo(); emitMedia();
  if (S.inMeeting) { renderTiles(); refreshControls(); }
}

// ---------------------------------------------------------------- recording
async function toggleRecord() {
  if (S.recorder) { S.recorder.stop(); return; }
  if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) { toast('Recording needs Chrome, Edge or Firefox on a computer.'); return; }
  let display;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include' });
  } catch { return; }
  ensureAudioCtx();
  const dest = actx.createMediaStreamDestination();
  const sources = [];
  const mix = t => { if (!t) return; try { const s = actx.createMediaStreamSource(new MediaStream([t])); s.connect(dest); sources.push(s); } catch {} };
  if (display.getAudioTracks().length) {
    display.getAudioTracks().forEach(mix);       // tab audio already includes everyone else
  } else {
    for (const p of S.peers.values()) p.stream.getAudioTracks().forEach(mix);
  }
  mix(S.audioTrack);
  const stream = new MediaStream([...display.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    display.getTracks().forEach(t => t.stop());
    sources.forEach(s => { try { s.disconnect(); } catch {} });
    const type = rec.mimeType || 'video/webm';
    const blob = new Blob(chunks, { type });
    const a = document.createElement('a');
    const slug = (S.room?.title || 'gathering').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    S.recorder = null;
    if (S.inMeeting) { S.socket.emit('recording', false); refreshControls(); }
    toast('Recording saved to your Downloads folder.', { timeout: 6000 });
  };
  display.getVideoTracks()[0].addEventListener('ended', () => { if (rec.state !== 'inactive') rec.stop(); });
  rec.start(1000);
  S.recorder = rec;
  S.socket.emit('recording', true);
  refreshControls();
  toast('Recording started. Everyone can see that you are recording.', { timeout: 4000 });
}

// ---------------------------------------------------------------- settings
async function openSettings() {
  const dlg = $('#settingsDlg');
  $('#musicMode').checked = S.musicMode;
  $('#mirrorMode').checked = S.mirror;
  $('#spkField').hidden = !('setSinkId' in HTMLMediaElement.prototype);
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const fill = (sel, kind, cur, fallback) => {
      const list = devs.filter(d => d.kind === kind);
      sel.innerHTML = `<option value="">System default</option>` + list.filter(d => d.deviceId && d.deviceId !== 'default')
        .map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `${fallback} ${i + 1}`)}</option>`).join('');
      sel.value = list.some(d => d.deviceId === cur) ? cur : '';
    };
    fill($('#selMic'), 'audioinput', S.devices.audio, 'Microphone');
    fill($('#selCam'), 'videoinput', S.devices.video, 'Camera');
    fill($('#selSpk'), 'audiooutput', S.devices.out, 'Speaker');
  } catch { /* device list unavailable */ }
  if (!dlg.open) dlg.showModal();
}
async function reacquireAudio() {
  if (!S.audioTrack) return;
  const { a } = await acquire(true, false);
  if (a) setAudioTrack(a);
}
async function setMusicMode(on) {
  S.musicMode = on;
  store.set('ur:music', on);
  $('#musicMode').checked = on;
  await reacquireAudio();
  toast(on ? 'Original sound is on. Use headphones to avoid echo.' : 'Original sound is off.', { timeout: 3000 });
}
function initSettings() {
  $('#selMic').addEventListener('change', async e => { S.devices.audio = e.target.value; store.set('ur:audioDev', e.target.value); await reacquireAudio(); });
  $('#selCam').addEventListener('change', async e => {
    S.devices.video = e.target.value; store.set('ur:videoDev', e.target.value);
    if (S.camOn) {
      S.videoTrack?.stop(); S.videoTrack = null;
      const { v } = await acquire(false, true);
      S.videoTrack = v; if (!v) S.camOn = false;
      replaceVideo(); emitMedia(); renderPreview(); refreshControls();
      if (S.inMeeting) renderTiles();
    }
  });
  $('#selSpk').addEventListener('change', e => {
    S.devices.out = e.target.value; store.set('ur:outDev', e.target.value);
    $$('#tiles video').forEach(v => v.setSinkId?.(S.devices.out).catch(() => {}));
  });
  $('#musicMode').addEventListener('change', e => setMusicMode(e.target.checked));
  $('#mirrorMode').addEventListener('change', e => {
    S.mirror = e.target.checked; store.set('ur:mirror', S.mirror);
    renderPreview(); if (S.inMeeting) renderTiles();
  });
}

// ---------------------------------------------------------------- invite, leave, end
async function copyInvite() {
  const r = S.room; if (!r) return;
  const link = `${(serverBase() || location.origin)}/?room=${r.id}`;
  const text = `You're invited to "${r.title}" (${r.typeLabel}) on In the Midst.\nJoin here: ${link}\nMeeting code: ${r.id}`;
  try { await navigator.clipboard.writeText(text); toast('Invite copied. Paste it into a text, email or group chat.'); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    toast(ok ? 'Invite copied.' : `Share this link: ${link}`, { timeout: ok ? 3000 : 10000 });
  }
}
function cleanupMeeting() {
  if (S.recorder && S.recorder.state !== 'inactive') S.recorder.stop();
  stopShare();
  closeAllPeers();
  meters.clear();
  S.inMeeting = false;
  S.room = null;
  S.pinned = null;
  S.activeSpeaker = null;
  S.prev = { hands: new Set(), waiting: new Set(), recording: '' };
  closePanel();
  $('#tiles').innerHTML = '';
  $('#reactPop').hidden = true;
  document.title = 'In the Midst';
  S.wakeLock?.release?.().catch(() => {});
  S.wakeLock = null;
}
function leaveMeeting(endAll) {
  if (endAll) hostAction('end'); else S.socket.emit('leave');
  cleanupMeeting();
  goLobby();
}
function endMeeting(title, text) {
  cleanupMeeting();
  S.waiting = false;
  showNotice(title, text, 'Back to start');
  history.replaceState(null, '', location.pathname);
}
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') S.wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => { if (S.inMeeting && document.visibilityState === 'visible') requestWakeLock(); });

// ---------------------------------------------------------------- clock
setInterval(() => {
  if (!S.inMeeting) return;
  const s = Math.floor((Date.now() - S.startedAt) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
  $('#clock').textContent = (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
}, 1000);

// ---------------------------------------------------------------- wiring
function initMeeting() {
  $('#tMic').addEventListener('click', () => toggleMic());
  $('#tCam').addEventListener('click', () => toggleCam());
  $('#tShare').addEventListener('click', toggleShare);
  $('#tRec').addEventListener('click', toggleRecord);
  $('#tReact').addEventListener('click', e => { e.stopPropagation(); toggleReactPop(); });
  $('#reactPop').addEventListener('click', e => {
    const b = e.target.closest('[data-react]');
    if (b) { S.socket.emit('reaction', b.dataset.react); $('#reactPop').hidden = true; }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#reactPop, #tReact')) $('#reactPop').hidden = true; });
  $('#tHand').addEventListener('click', () => S.socket.emit('hand', !self()?.hand));
  $('#tSettings').addEventListener('click', openSettings);
  $$('[data-panel]').forEach(b => b.addEventListener('click', () => {
    if (b.closest('.panel-tabs')) { if (S.panel !== b.dataset.panel) openPanel(b.dataset.panel); }
    else openPanel(b.dataset.panel);
  }));
  $('#panelClose').addEventListener('click', closePanel);
  $('#inviteBtn').addEventListener('click', copyInvite);
  $('#viewBtn').addEventListener('click', () => { S.view = S.view === 'gallery' ? 'speaker' : 'gallery'; store.set('ur:view', S.view); layout(); });
  $('#waitAlert').addEventListener('click', () => { if (S.panel !== 'people') openPanel('people'); });

  $('#tLeave').addEventListener('click', () => {
    const host = amHost();
    $('#endAllBtn').hidden = !host;
    $('#leaveText').textContent = host
      ? 'Ending the gathering disconnects everyone. If you just leave, another person becomes host and the gathering continues.'
      : 'You can rejoin any time with the same link.';
    $('#leaveDlg').returnValue = '';
    $('#leaveDlg').showModal();
  });
  $('#leaveDlg').addEventListener('close', () => {
    const v = $('#leaveDlg').returnValue;
    if (v === 'end') leaveMeeting(true);
    else if (v === 'leave') leaveMeeting(false);
  });

  // chat
  const input = $('#chatInput');
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
  $('#chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    S.socket.emit('chat', { text, to: $('#chatTo').value || null });
    input.value = ''; grow();
  });

  // people
  $('#peopleList').addEventListener('click', onPeopleClick);
  $('#waitingBox').addEventListener('click', onPeopleClick);
  $('#muteAllBtn').addEventListener('click', () => hostAction('mute-all'));
  $('#lowerHandsBtn').addEventListener('click', () => hostAction('lower-all-hands'));
  $('#lockToggle').addEventListener('change', e => hostAction('lock', null, e.target.checked));
  $('#waitToggle').addEventListener('change', e => hostAction('waiting-room', null, e.target.checked));

  // prayer
  $('#prayerForm').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('#prayerText').value.trim();
    if (!t) { $('#prayerText').focus(); return; }
    S.socket.emit('prayer:add', { text: t, anonymous: $('#prayerAnon').checked });
    $('#prayerText').value = '';
    S.prayerFilter = 'open';
    toast('Your request is on the prayer wall.', { timeout: 2500 });
  });
  $('#prayerFilter').addEventListener('click', e => { const b = e.target.closest('[data-pf]'); if (b) { S.prayerFilter = b.dataset.pf; renderPrayers(); } });
  $('#prayerList').addEventListener('click', onPrayerClick);

  // scripture
  $('#verseForm').addEventListener('submit', lookupVerse);
  $('#verseTr').value = store.get('ur:tr', 'kjv');
  $('#verseTr').addEventListener('change', e => store.set('ur:tr', e.target.value));
  $('#manualVerse').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#mvRef').value.trim(), text = $('#mvText').value.trim();
    if (!text) { $('#mvText').focus(); return; }
    S.socket.emit('overlay:show', { kind: 'verse', title: title || 'Scripture', text });
    toast('Passage is on everyone’s screen.', { timeout: 2500 });
  });
  $('#onScreen').addEventListener('click', e => { if (e.target.closest('[data-clear]')) S.socket.emit('overlay:clear'); });
  $('#ovClose').addEventListener('click', () => S.socket.emit('overlay:clear'));

  // worship
  $('#songForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#songTitle').value.trim(), lyrics = $('#songLyrics').value;
    if (!lyrics.trim()) { $('#songLyrics').focus(); return; }
    S.socket.emit('worship:set', { title, lyrics });
    const songs = store.get('ur:songs', []).filter(s => s.title !== title || !title);
    songs.unshift({ title, lyrics });
    store.set('ur:songs', songs.slice(0, 40));
  });
  $('#songLib').addEventListener('click', e => {
    const l = e.target.closest('[data-song]'), d = e.target.closest('[data-delsong]');
    const songs = store.get('ur:songs', []);
    if (l) { const s = songs[+l.dataset.song]; if (s) { $('#songTitle').value = s.title; $('#songLyrics').value = s.lyrics; } }
    if (d) { songs.splice(+d.dataset.delsong, 1); store.set('ur:songs', songs); renderSongLib(); }
  });
  $('#slideList').addEventListener('click', e => { const b = e.target.closest('[data-slide]'); if (b && amHost()) S.socket.emit('worship:go', +b.dataset.slide); });
  $('#wPrev').addEventListener('click', () => worshipGo(-1));
  $('#wNext').addEventListener('click', () => worshipGo(1));
  $('#lyPrev').addEventListener('click', () => worshipGo(-1));
  $('#lyNext').addEventListener('click', () => worshipGo(1));
  $('#wStop').addEventListener('click', () => { if (S.room.worship.active) S.socket.emit('worship:stop'); else S.socket.emit('worship:go', S.room.worship.index); });

  // keyboard
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  document.addEventListener('keydown', e => {
    if (!S.inMeeting || $('dialog[open]')) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const map = { KeyA: () => toggleMic(), KeyV: () => toggleCam(), KeyS: toggleShare, KeyY: () => S.socket.emit('hand', !self()?.hand), KeyH: () => openPanel('chat'), KeyU: () => openPanel('people'), KeyR: toggleRecord };
      if (map[e.code]) { e.preventDefault(); map[e.code](); }
      return;
    }
    if (typing()) return;
    if (e.code === 'Space' && !e.repeat && !S.micOn && S.audioTrack) { e.preventDefault(); S.ptt = true; toggleMic(true); return; }
    if (amHost() && S.room?.worship.active) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); worshipGo(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); worshipGo(-1); }
    }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' && S.ptt) { S.ptt = false; toggleMic(false); }
  });
}

// ---------------------------------------------------------------- boot
paintIcons();
initSettings();
initMeeting();
initLobby();
})();
