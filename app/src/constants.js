// Server + room constants. Mirrors the web app (public/app.js) and server.js.
const SERVER_URL = 'https://in-the-midst.onrender.com';

const TYPES = {
  prayer: 'Prayer Meeting',
  bible: 'Bible Study',
  worship: 'Praise & Worship',
  fellowship: 'Fellowship',
};

// 9-digit code, formatted XXX-XXX-XXX. Mirrors web normalize()/formatCode().
function normalizeCode(code) {
  const d = String(code || '').replace(/\D/g, '').slice(0, 9);
  return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : '';
}

function formatCode(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 9);
  if (d.length > 6) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return d;
}

module.exports = { SERVER_URL, TYPES, normalizeCode, formatCode };
