/* Hazri — tracks which branches have joined a Google Meet VC.
   Built by Nitin Kotwar (139535), via PDUDAIRO. Everything is stored on this phone. */
(() => {
'use strict';

/* ───────────────────────── constants & helpers ───────────────────────── */
const KEY = 'rollcall.v1';
const SCOPES = 'https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/meetings.space.readonly';
const API = 'https://meet.googleapis.com/v2/';
// Your OAuth Client ID. It is public by design (Google shows it in every sign-in URL), so it is safe to keep in the code.
const DEFAULT_CLIENT_ID = '754163086387-47868o8lni1hfipha1tnm1r7bh94bgnv.apps.googleusercontent.com';
// Pull the bare ID out of whatever was typed or pasted (strips https://, spaces, quotes, line breaks).
const cleanClientId = v => { const m = String(v || '').match(/\d+-[a-z0-9]+\.apps\.googleusercontent\.com/i); return m ? m[0].toLowerCase() : ''; };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  play: svg('<path d="M7 5v14l11-7z"/>'),
  video: svg('<rect x="3" y="6" width="12" height="12" rx="2.5"/><path d="m15 10.5 5.5-3v9l-5.5-3"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  more: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
  share: svg('<path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  chat: svg('<path d="M4 20l1.5-4A8 8 0 1 1 9 19.3z"/><path d="M9 10.5c.5 2 2 3.5 4 4l1.2-1.2 2 .8-.4 1.6c-3.6.2-7.6-3.8-7.4-7.4L10 7.9l.8 2z"/>'),
  ext: svg('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>'),
  tag: svg('<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  chev: svg('<path d="m9 6 6 6-6 6"/>'),
  refresh: svg('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  alert: svg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  shield: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  down: svg('<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>'),
  up: svg('<path d="M12 20V8"/><path d="m7 13 5-5 5 5"/><path d="M5 4h14"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  google: svg('<circle cx="12" cy="12" r="9"/><path d="M12 12h8"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  sliders: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')
};

const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
const fmtWhen = t => {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + fmtTime(d);
};
const ago = t => {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((now() - t) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' min ago';
  return Math.round(m / 60) + ' h ago';
};
const toLocalInput = d => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const nextHalfHour = () => { const d = new Date(); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() < 30 ? 30 : 60); return d; };

const TITLES = new Set(['mr', 'ms', 'mrs', 'miss', 'dr', 'shri', 'smt', 'sh', 'shree']);
const pretty = n => String(n || '').replace(/\s+\.\s*$/, '').replace(/\./g, ' ').split(/\s+/).filter(w => w && !TITLES.has(w.toLowerCase()))
  .map(w => w.length <= 2 && w === w.toUpperCase() && w.length > 1 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim() || String(n || '').trim();
const initials = n => pretty(n).split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const normKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tel = n => String(n || '').replace(/[^\d+]/g, '');

/* ───────────────────────── store ───────────────────────── */
const DEFAULT_CONTROLS = { access: 'OPEN', moderation: true, chat: 'NO_RESTRICTION', present: 'HOSTS_ONLY', reactions: 'NO_RESTRICTION' };

function unitsFromSource(src) {
  return (src.units || []).map(u => ({
    code: u.code, name: u.name, alpha: u.alpha || '', isRO: !!u.isRO, isNew: !!u.isNew, category: u.category || '', size: u.size || '',
    mobile: u.mobile || '', phone: u.phone || '', expect: u.isRO ? false : true,
    staff: (u.staff || []).map(s => ({ id: 'E' + s.empId, empId: s.empId, name: s.name, designation: s.designation || '', phone: s.phone || '', bm: !!s.bm, second: !!s.second, dept: s.dept || '' }))
  }));
}
function unitsFromUdairo(D) {
  return unitsFromSource({
    units: D.branches.map(b => ({
      code: b.branchCode, name: b.branchName, alpha: b.alphaCode, isRO: b.size === 'REGIONAL OFFICE', isNew: !!b.isNew, category: b.category, size: b.size,
      mobile: b.mobile, phone: b.phone && b.phone !== b.mobile ? b.phone : '',
      staff: b.staff.map(s => ({ empId: s.empId, name: s.name, designation: s.designation, phone: s.phone, bm: s.designation === 'Branch Manager', second: !!s.secondInCommand, dept: (s.departments || []).join(' / ') }))
    }))
  });
}
function fresh() {
  return {
    v: 1,
    units: window.SEED_DATA ? unitsFromSource(window.SEED_DATA) : [],
    idents: {},
    session: null,
    settings: { clientId: DEFAULT_CLIENT_ID, controls: { ...DEFAULT_CONTROLS }, poll: 15, keepAwake: true, signedIn: false },
    recentAgendas: [],
    backup: { at: null, dirty: 0 }
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S || S.v !== 1) S = fresh();
S.settings = { ...fresh().settings, ...S.settings, controls: { ...DEFAULT_CONTROLS, ...(S.settings || {}).controls } };
S.settings.clientId = cleanClientId(S.settings.clientId) || DEFAULT_CLIENT_ID;
delete S.settings.controls.viewer; delete S.settings.unsupported;
delete S.settings.theme; // the Central Bank look is the only theme now
let saveFailed = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); saveFailed = false; }
  catch (e) { if (!saveFailed) toast('Could not save on this phone. Export a backup now.'); saveFailed = true; }
}

let personById = new Map(), unitByCode = new Map();
function reindex() {
  personById = new Map(); unitByCode = new Map();
  for (const u of S.units) { unitByCode.set(u.code, u); for (const p of u.staff) personById.set(p.id, { ...p, unit: u.code, ref: p }); }
}
reindex();

const unitLabel = u => u ? (u.isRO ? 'Regional Office' : u.name) : '';
const unitOf = target => {
  if (!target) return null;
  if (target.u != null) return unitByCode.get(target.u) || null;
  const p = personById.get(target.p);
  return p ? unitByCode.get(p.unit) : null;
};
const targetFor = key => (S.session && S.session.temp && S.session.temp[key]) || (S.idents[key] && S.idents[key].to) || null;
const targetLabel = t => {
  if (!t) return '';
  if (t.u != null) { const u = unitByCode.get(t.u); return u ? (u.isRO ? 'Regional Office' : u.name + ' branch') : 'Unknown'; }
  const p = personById.get(t.p); return p ? pretty(p.name) : 'Unknown person';
};
function markDirty() { S.backup.dirty = (S.backup.dirty || 0) + 1; }

/* ───────────────────────── name matching ───────────────────────── */
const NOISE = new Set(['cbi', 'central', 'bank', 'of', 'india', 'branch', 'br', 'phone', 'iphone', 'android', 'galaxy', 'redmi', 'samsung', 'vivo', 'oppo', 'realme', 'poco', 'mi', 'the', 's', 'sir', 'ji', 'mobile', 'laptop', 'pc']);
const toks = s => String(s || '').toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t && !TITLES.has(t));
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function scorePerson(dt, p) {
  const pt = toks(p.name).filter(t => t.length);
  if (!pt.length || !dt.length) return 0;
  let score = 0; const used = new Set();
  for (const d of dt) {
    if (/^\d+$/.test(d)) { if (+d === p.empId) score += 4; continue; }
    let best = 0, bi = -1;
    pt.forEach((t, i) => {
      if (used.has(i)) return;
      let s = 0;
      if (d === t) s = 3;
      else if (d.length === 1 && t[0] === d) s = 1.2;
      else if (d.length >= 3 && (t.startsWith(d) || d.startsWith(t))) s = 2;
      else if (d.length >= 4 && lev(d, t) <= 1) s = 2.2;
      if (s > best) { best = s; bi = i; }
    });
    if (bi >= 0) { used.add(bi); score += best; }
    else if (d.length > 1) score -= 0.7;
  }
  if (dt.includes(pt[pt.length - 1])) score += 0.5;
  return score / (3 * Math.max(pt.length, Math.min(dt.length, 4)));
}
function suggest(displayName) {
  const dt = toks(displayName).filter(t => !NOISE.has(t));
  const all = toks(displayName);
  const out = [];
  for (const p of personById.values()) {
    const s = scorePerson(dt, p);
    if (s > 0.22) out.push({ t: { p: p.id }, score: s });
  }
  for (const u of S.units) {
    const ut = toks(u.name);
    const hit = ut.length && ut.every(t => all.includes(t)) || (u.alpha && all.includes(u.alpha.toLowerCase())) || all.includes(String(u.code));
    if (hit) out.push({ t: { u: u.code }, score: 0.6 + (all.includes('cbi') || all.includes('branch') ? 0.2 : 0) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

/* ───────────────────────── session model ───────────────────────── */
function expectedDefault() { return S.units.filter(u => u.expect).map(u => u.code); }
function newSession(fields) {
  return {
    id: uid(), source: 'google', spaceName: '', meetingUri: '', meetingCode: '',
    details: { when: '', agenda: '', headedBy: '' }, expected: expectedDefault(),
    records: [], parts: {}, temp: {}, ignored: {}, state: 'waiting', ended: false,
    lastSync: null, error: null, createdAt: now(), controlsNote: '', ...fields
  };
}
function board() {
  const s = S.session; if (!s) return null;
  const parts = Object.values(s.parts);
  const byUnit = new Map(); const untagged = []; const people = [];
  for (const p of parts) {
    const t = targetFor(p.key);
    if (!t) { if (!s.ignored[p.key]) untagged.push(p); people.push({ p, t: null, u: null }); continue; }
    const u = unitOf(t);
    people.push({ p, t, u });
    if (!u) continue;
    if (!byUnit.has(u.code)) byUnit.set(u.code, []);
    byUnit.get(u.code).push({ p, t });
  }
  const rows = { in: [], left: [], miss: [] };
  const exp = new Set(s.expected);
  const consider = new Set([...exp, ...byUnit.keys()]);
  for (const code of consider) {
    const u = unitByCode.get(code); if (!u) continue;
    const list = byUnit.get(code) || [];
    const active = list.filter(x => x.p.active);
    const status = active.length ? 'in' : list.length ? 'left' : 'miss';
    const lastLeft = list.reduce((m, x) => Math.max(m, x.p.lastEnd ? Date.parse(x.p.lastEnd) : 0), 0);
    rows[status].push({ u, list, active, expected: exp.has(code), lastLeft });
  }
  const e = rows.in.filter(r => r.expected).length, l = rows.left.filter(r => r.expected).length;
  rows.in.sort((a, b) => (b.expected - a.expected) || (a.u.isRO - b.u.isRO) || a.u.name.localeCompare(b.u.name));
  rows.left.sort((a, b) => b.lastLeft - a.lastLeft);
  rows.miss.sort((a, b) => (callRank(a.u.code) - callRank(b.u.code)) || a.u.name.localeCompare(b.u.name));
  people.sort((a, b) => (b.p.active - a.p.active) || String(a.p.name).localeCompare(String(b.p.name)));
  return { rows, untagged, people, total: exp.size, joined: e + l, inCount: e, leftCount: l, missCount: rows.miss.length };
}

/* ───────────────────────── call tracking ───────────────────────── */
// One status per branch, independent of meetings, so a pre-meeting calling round can be tracked.
const CALL_STATUS = {
  informed: { label: 'Informed', cls: 'in', rank: 5 },
  recall: { label: 'Recall later', cls: 'left', rank: 1 },
  noanswer: { label: 'No answer', cls: '', rank: 2 },
  denied: { label: 'Denied', cls: 'miss', rank: 4 },
  called: { label: 'Called', cls: 'acc', rank: 3 }
};
if (!S.calls) S.calls = {};
const callOf = code => S.calls[code] || null;
const callRank = code => { const c = callOf(code); return c ? (CALL_STATUS[c.status] || CALL_STATUS.called).rank : 0; };
function callChip(code) {
  const c = callOf(code); if (!c) return '';
  const st = CALL_STATUS[c.status] || CALL_STATUS.called;
  return `<span class="chip ${st.cls}">${st.label} · ${ago(c.at)}</span>`;
}
function dial(code, who, number) {
  return `href="tel:${tel(number)}" data-act="dial" data-code="${code}" data-who="${esc(who)}" data-num="${esc(number)}"`;
}
function statusPicker(code) {
  const cur = callOf(code);
  return `<div class="status-grid">${['informed', 'recall', 'noanswer', 'denied'].map(k => `<button class="status-btn s-${k}" aria-pressed="${cur && cur.status === k}" data-act="call-status" data-code="${code}" data-status="${k}">${esc(CALL_STATUS[k].label)}</button>`).join('')}</div>`;
}
function setCallStatus(code, status, extra = {}) {
  const prev = S.calls[code] ? { ...S.calls[code] } : null;
  if (status === 'clear') delete S.calls[code];
  else S.calls[code] = { status, at: (prev && extra.keepTime) ? prev.at : now(), who: extra.who || (prev && prev.who) || '', num: extra.num || (prev && prev.num) || '' };
  if (S.pendingCall && S.pendingCall.code === code) S.pendingCall = null;
  save();
  const u = unitByCode.get(code);
  return { prev, label: u ? unitLabel(u) : 'Branch' };
}
function openCallFeedback() {
  const pc = S.pendingCall; if (!pc) return;
  if (now() - pc.at > 3 * 3600e3) { S.pendingCall = null; save(); return; }
  const u = unitByCode.get(pc.code); if (!u) { S.pendingCall = null; save(); return; }
  const mins = Math.max(1, Math.round((now() - pc.at) / 60000));
  openSheet(`
    <div class="sheet-head"><span class="code" style="margin-top:3px">${u.code}</span><div class="grow"><h3>How did the call go?</h3><div class="sub">${esc(unitLabel(u))}${pc.who ? ' · ' + esc(pc.who) : ''} · ${mins} min ago</div></div></div>
    <div class="sheet-body">
      ${statusPicker(u.code)}
      <button class="btn btn-ghost btn-block" data-act="call-status" data-code="${u.code}" data-status="called">Skip, just mark as called</button>
    </div>`, { onClose: () => { if (S.pendingCall && S.pendingCall.code === u.code) { setCallStatus(u.code, 'called', pc); renderMain(); } } });
}

/* ───────────────────────── Google: auth + Meet API ───────────────────────── */
class AppError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
const G = {
  token: null, exp: 0,
  restore() { try { const t = JSON.parse(sessionStorage.getItem('rc.tok')); if (t && t.exp > now() + 60000) { this.token = t.token; this.exp = t.exp; } } catch (e) {} },
  loadLib() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new AppError('Could not reach Google sign-in. Check your internet connection.'));
      document.head.appendChild(s);
    });
  },
  valid() { return this.token && now() < this.exp - 60000; },
  async getToken(interactive) {
    if (this.valid()) return this.token;
    if (!S.settings.clientId) throw new AppError('Add your Google Client ID in Settings first.', 'noclient');
    if (!interactive) throw new AppError('Google sign-in has expired. Tap Reconnect.', 'reauth');
    await this.loadLib();
    return new Promise((res, rej) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cleanClientId(S.settings.clientId) || DEFAULT_CLIENT_ID, scope: SCOPES,
        callback: r => {
          if (r.error) return rej(new AppError('Google sign-in did not finish: ' + (r.error_description || r.error)));
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...SCOPES.split(' '))) return rej(new AppError('Please allow both Google Meet permissions so the app can create meetings and see who joined.'));
          this.token = r.access_token; this.exp = now() + (r.expires_in || 3600) * 1000;
          try { sessionStorage.setItem('rc.tok', JSON.stringify({ token: this.token, exp: this.exp })); } catch (e) {}
          S.settings.signedIn = true; save();
          res(this.token);
        },
        error_callback: e => rej(new AppError(e && e.type === 'popup_closed' ? 'The Google sign-in window was closed.' : 'Google sign-in was blocked. Allow pop-ups for this app and try again.'))
      });
      client.requestAccessToken({ prompt: S.settings.signedIn ? '' : 'consent' });
    });
  },
  signOut() {
    if (this.token && window.google && google.accounts) try { google.accounts.oauth2.revoke(this.token, () => {}); } catch (e) {}
    this.token = null; this.exp = 0; S.settings.signedIn = false; save();
    try { sessionStorage.removeItem('rc.tok'); } catch (e) {}
  },
  async call(path, { method = 'GET', body, interactive = false } = {}) {
    const tok = await this.getToken(interactive);
    let r;
    try {
      r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { throw new AppError('No connection to Google. Retrying shortly.', 'net'); }
    if (r.status === 401) { this.token = null; throw new AppError('Google sign-in has expired. Tap Reconnect.', 'reauth'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new AppError((j.error && j.error.message) || ('Google returned an error (' + r.status + ').'), r.status);
    return j;
  }
};
G.restore();

const parseCode = s => { const m = String(s || '').match(/([a-z]{3}-?[a-z]{4}-?[a-z]{3})(?![a-z])/i); if (!m) return ''; const c = m[1].toLowerCase().replace(/-/g, ''); return `${c.slice(0, 3)}-${c.slice(3, 7)}-${c.slice(7)}`; };

// If Google refuses one setting for this account, it names it in the error;
// drop just that one and retry so the meeting still gets created.
const CTRL_FIELDS = {
  chatRestriction: { key: 'chat', label: 'chat limits' },
  presentRestriction: { key: 'present', label: 'screen-share limits' },
  reactionRestriction: { key: 'reactions', label: 'reaction limits' },
  moderation: { key: 'moderation', label: 'host management' },
  entryPointAccess: { key: 'entry', label: 'entry points' }
};
function buildConfig(ctrl, skip) {
  const config = { accessType: ctrl.access };
  if (!skip.has('entryPointAccess')) config.entryPointAccess = 'ALL';
  if (ctrl.moderation && !skip.has('moderation')) {
    config.moderation = 'ON';
    const r = {};
    if (!skip.has('chatRestriction')) r.chatRestriction = ctrl.chat;
    if (!skip.has('presentRestriction')) r.presentRestriction = ctrl.present;
    if (!skip.has('reactionRestriction')) r.reactionRestriction = ctrl.reactions;
    if (Object.keys(r).length) config.moderationRestrictions = r;
  }
  return config;
}
function blockedField(msg, skip) {
  const m = String(msg || '').toLowerCase();
  return Object.keys(CTRL_FIELDS).find(f => !skip.has(f) && m.includes(f.toLowerCase()));
}
async function googleCreate(ctrl) {
  const skip = new Set();
  const dropped = [];
  for (let i = 0; i < 8; i++) {
    try {
      const space = await G.call('spaces', { method: 'POST', body: { config: buildConfig(ctrl, skip) }, interactive: true });
      const note = dropped.length ? `Your Google account can't set ${dropped.map(f => CTRL_FIELDS[f].label).join(', ')} from outside Meet, so the meeting was created without ${dropped.length > 1 ? 'them' : 'it'}. Everything else was applied. You can still change ${dropped.length > 1 ? 'these' : 'this'} from Host controls inside Meet.` : '';
      return { space, note };
    } catch (e) {
      if (e.code === 'reauth' || e.code === 'net' || e.code === 'noclient' || e.code === 401) throw e;
      const f = blockedField(e.message, skip);
      if (f) { skip.add(f); dropped.push(f); continue; }
      if (skip.has('__basic')) throw e;
      // Unknown refusal: fall back to an Open meeting with no extra controls.
      Object.keys(CTRL_FIELDS).forEach(k => skip.add(k)); skip.add('__basic');
      dropped.push(...Object.keys(CTRL_FIELDS).filter(k => k !== 'entryPointAccess' && !dropped.includes(k)));
    }
  }
  throw new AppError('Google would not create the meeting. Try again in a minute.');
}
const accessLabel = a => ({ OPEN: 'Open', TRUSTED: 'Trusted', RESTRICTED: 'Restricted' }[a] || a);

function participantFromApi(p) {
  let key, name, kind;
  if (p.signedinUser) { name = p.signedinUser.displayName || 'Google user'; key = 'g:' + p.signedinUser.user; kind = 'google'; }
  else if (p.anonymousUser) { name = p.anonymousUser.displayName || 'Guest'; key = 'n:' + normKey(name); kind = 'guest'; }
  else { name = (p.phoneUser && p.phoneUser.displayName) || 'Phone caller'; key = 't:' + normKey(name); kind = 'phone'; }
  return { key, name, kind, first: p.earliestStartTime || null, lastEnd: p.latestEndTime || null, pid: p.name };
}
async function listAll(path) {
  const out = []; let tok = '';
  for (let i = 0; i < 20; i++) {
    const j = await G.call(path + (path.includes('?') ? '&' : '?') + 'pageSize=250' + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''));
    out.push(...(j.participants || []));
    if (!j.nextPageToken) break; tok = j.nextPageToken;
  }
  return out;
}
const IDLE_END_MS = 90 * 60e3;   // stop watching after the room has been empty this long
const EMPTY_POLL_MS = 45e3;      // slow polling while the room is empty
async function syncGoogle(s) {
  const space = await G.call(s.spaceName);
  let rec = space.activeConference && space.activeConference.conferenceRecord;
  let ended = false;
  if (!rec) {
    const filter = encodeURIComponent(`space.name="${space.name}"`);
    const j = await G.call(`conferenceRecords?filter=${filter}&pageSize=10`);
    const recs = (j.conferenceRecords || []).filter(r => Date.parse(r.startTime) >= s.createdAt - 12 * 3600e3 || s.attached)
      .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
    if (recs[0]) { rec = recs[0].name; ended = !!recs[0].endTime; }
  }
  if (!rec) { s.state = 'waiting'; return; }
  if (!s.records.includes(rec)) s.records.push(rec);
  const all = await listAll(rec + '/participants');
  let activeIds = null;
  if (!ended) {
    try { activeIds = new Set((await listAll(rec + '/participants?filter=' + encodeURIComponent('latest_end_time IS NULL'))).map(p => p.name)); }
    catch (e) { if (e.code === 'reauth') throw e; activeIds = null; }
  }
  const seen = {};
  for (const raw of all) {
    const p = participantFromApi(raw);
    p.active = !ended && (activeIds ? activeIds.has(raw.name) : !raw.latestEndTime);
    const prev = seen[p.key];
    if (prev) { prev.active = prev.active || p.active; if (p.first && (!prev.first || p.first < prev.first)) prev.first = p.first; if (p.lastEnd && (!prev.lastEnd || p.lastEnd > prev.lastEnd)) prev.lastEnd = p.lastEnd; }
    else seen[p.key] = p;
  }
  mergeParts(s, seen, rec);
  // A Meet link outlives its conferences: when the room empties Meet closes the conference and
  // opens a new one when someone returns. So "ended" only means 1.5 h of nobody being present.
  const anyActive = Object.values(s.parts).some(p => p.active);
  if (anyActive) { s.emptySince = null; s.ended = false; s.state = 'live'; }
  else {
    if (!s.emptySince) s.emptySince = now();
    if (now() - s.emptySince >= IDLE_END_MS) { s.ended = true; s.state = 'ended'; }
    else { s.ended = false; s.state = 'empty'; }
  }
}
function mergeParts(s, seen, rec) {
  // Participants from an earlier conference in the same meeting space stay (they joined, then left).
  for (const k in s.parts) if (!seen[k] && s.parts[k].rec !== rec) s.parts[k].active = false;
  for (const k in seen) {
    const old = s.parts[k];
    const p = { ...seen[k], rec };
    if (!old) { p.isNew = true; s.parts[k] = p; continue; }
    p.first = old.first && old.first < p.first ? old.first : p.first;
    p.isNew = !old.active && p.active;
    s.parts[k] = p;
  }
}

/* ───────────────────────── demo meeting ───────────────────────── */
function demoName(p, variant) {
  const t = pretty(p.name).split(' ');
  const first = t[0], last = t[t.length - 1];
  switch (variant) {
    case 0: return pretty(p.name);
    case 1: return t.length > 1 ? t.slice(0, -1).map(w => w[0]).join(' ') + ' ' + last : first;
    case 2: return first + ' ' + (t.length > 1 ? last : '') + ' CBI';
    case 3: return first.toUpperCase();
    default: return first + "'s Galaxy";
  }
}
function startDemo(details, expected) {
  const s = newSession({ source: 'demo', meetingCode: 'dmo-demo-vcx', meetingUri: 'https://meet.google.com/dmo-demo-vcx', details, expected, state: 'live', demo: { tick: 0, plan: [] } });
  const plan = [];
  const self = personById.get('E139535');
  if (self) plan.push({ at: 0, key: 'g:demo-self', name: pretty(self.name), kind: 'google' });
  let at = 1;
  for (const code of expected) {
    const u = unitByCode.get(code); if (!u || Math.random() < 0.3) continue;
    const staff = u.staff.slice().sort((a, b) => (b.bm - a.bm) || (b.second - a.second));
    const who = [staff[0]]; if (staff[1] && Math.random() < 0.3) who.push(staff[1]);
    for (const p of who) {
      const v = Math.floor(Math.random() * 5);
      const kindR = Math.random();
      const kind = kindR < 0.75 ? 'google' : kindR < 0.9 ? 'guest' : 'phone';
      const name = kind === 'phone' ? '+91 ' + String(p.phone || '9800000000').slice(0, 5) + ' ••' + String(p.phone || '00').slice(-3) : demoName(p, v);
      const key = kind === 'google' ? 'g:demo-' + p.empId + '-' + v : (kind === 'guest' ? 'n:' : 't:') + normKey(name);
      const join = at + Math.floor(Math.random() * 6);
      plan.push({ at: join, key, name, kind });
      if (Math.random() < 0.18) plan.push({ at: join + 3 + Math.floor(Math.random() * 6), key, leave: true });
    }
    if (Math.random() < 0.5) at++;
  }
  const branchAcct = unitByCode.get(expected[Math.floor(Math.random() * expected.length)]);
  if (branchAcct && !branchAcct.isRO) plan.push({ at: 3, key: 'n:' + normKey('CBI ' + branchAcct.name), name: 'CBI ' + branchAcct.name, kind: 'guest' });
  s.demo.plan = plan;
  return s;
}
function syncDemo(s) {
  const t = s.demo.tick++;
  const seen = {};
  for (const k in s.parts) seen[k] = { ...s.parts[k] };
  for (const ev of s.demo.plan.filter(e => e.at === t)) {
    if (ev.leave) { if (seen[ev.key]) { seen[ev.key].active = false; seen[ev.key].lastEnd = new Date().toISOString(); } continue; }
    seen[ev.key] = { key: ev.key, name: ev.name, kind: ev.kind, first: new Date().toISOString(), lastEnd: null, active: true };
  }
  mergeParts(s, seen, 'demo');
  s.state = 'live';
}

/* ───────────────────────── sync loop ───────────────────────── */
let syncTimer = null, syncing = false;
function scheduleSync(delay) {
  clearTimeout(syncTimer);
  const s = S.session;
  if (!s || s.ended) return;
  const d = delay != null ? delay : (s.source === 'demo' ? 4000 : s.state === 'empty' ? Math.max(EMPTY_POLL_MS, S.settings.poll * 1000) : Math.max(10, S.settings.poll) * 1000);
  syncTimer = setTimeout(syncNow, d);
}
async function syncNow() {
  const s = S.session; if (!s || syncing) return;
  if (document.hidden && s.source !== 'demo') { scheduleSync(); return; }
  syncing = true;
  const before = new Set(Object.values(s.parts).filter(p => p.active).map(p => p.key));
  try {
    if (s.source === 'demo') syncDemo(s); else await syncGoogle(s);
    s.error = null; s.lastSync = now();
  } catch (e) {
    s.error = { msg: e.message, code: e.code };
  }
  syncing = false;
  if (S.session !== s) return;
  const fresh = Object.values(s.parts).filter(p => p.active && !before.has(p.key));
  const gone = [...before].filter(k => !(s.parts[k] && s.parts[k].active)).length;
  ecgSync();
  if (ECG.sid === s.id) ecgEvents(fresh.length, gone); // the first sync after opening only primes, so people already in don't spike
  if (!s.error) ECG.sid = s.id;
  if (fresh.length) {
    try { navigator.vibrate && navigator.vibrate(fresh.some(p => targetFor(p.key)) ? 25 : [20, 60, 20]); } catch (e) {}
    U.flash = new Set(fresh.map(p => p.key));
  }
  save();
  if (U.tab === 'meet' && !U.route) renderMain();
  if (!(s.error && s.error.code === 'reauth')) scheduleSync(s.error && s.error.code === 'net' ? 20000 : null);
}

/* ───────────────────────── UI state ───────────────────────── */
const U = { tab: (() => { try { const t = sessionStorage.getItem('rc.tab'); sessionStorage.removeItem('rc.tab'); return t === 'settings' ? t : 'meet'; } catch (e) { return 'meet'; } })(), route: null, boardTab: 'miss', dirQ: '', dirFilter: 'branches', flash: new Set(), draft: null, wake: null };

let navDepth = 0, ignorePop = 0, exiting = false, sheetNav = false, pendingSheetPop = false;
function navPush() { try { history.pushState({ rc: 'nav' }, ''); navDepth++; } catch (e) {} }
function navPopSilently() { if (navDepth > 0) { navDepth--; ignorePop++; history.back(); } }
function leaveRoute() { U.route = null; if (U.routeNav) { U.routeNav = false; navPopSilently(); } }
function restoreScroll() { const y = U.scrollBefore || 0; requestAnimationFrame(() => window.scrollTo(0, y)); }
function setTab(t) { leaveRoute(); U.tab = t; render(); window.scrollTo(0, 0); }
function go(route) { if (!U.routeNav) { U.scrollBefore = window.scrollY; navPush(); U.routeNav = true; } U.route = route; render(); window.scrollTo(0, 0); }
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop--; return; }
  if (exiting) return;
  if (navDepth > 0) navDepth--; else { try { history.pushState({ rc: 'guard' }, ''); } catch (e) {} }
  handleBack();
});
function handleBack() {
  if ($('#layer .sheet')) { sheetNav = false; closeSheet(false, true); return; }
  if (U.route) { U.routeNav = false; U.route = null; U.draft = null; render(); restoreScroll(); return; }
  if (U.tab !== 'meet') { U.tab = 'meet'; render(); window.scrollTo(0, 0); return; }
  askExit();
}
async function askExit() {
  const live = S.session && !S.session.ended;
  if (await confirmSheet('Close Hazri?', live ? 'The live board stops checking for joiners while the app is closed.' : 'You can open it again from your home screen.', 'Close app', true)) {
    pendingSheetPop = false; exiting = true;
    history.go(-(navDepth + 2));
    setTimeout(() => { exiting = false; }, 1500); // still here (plain browser tab): stay usable
  }
}

function render() {
  $$('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === U.tab ? 'page' : 'false'));
  renderMain();
  manageWake();
}
function renderTop(title, { back = false, actions = '' } = {}) {
  $('#top').innerHTML = `${back ? `<button class="back" data-act="back" aria-label="Back">${I.back}</button>` : '<img class="brand-mark" src="icon-192.png" alt="">'}<h1>${esc(title)}</h1>${actions}`;
  ecgSync();
}
function renderMain() {
  const m = $('#main');
  const r = U.route;
  let html = '';
  if (r && r.name === 'create') html = viewCreate();
  else if (r && r.name === 'share') html = viewShare();
  else if (r && r.name === 'unit') html = viewUnit(r.code);
  else if (U.tab === 'meet') html = S.session ? viewBoard() : viewHome();
  else if (U.tab === 'dir') html = viewDirectory();
  else html = viewSettings();
  m.innerHTML = html;
  if (U.flash.size) setTimeout(() => U.flash.clear(), 1300);
  if (U.slide) { const el = $('#dir-list') || $('#board-list'); if (el) el.classList.add(U.slide > 0 ? 'slide-l' : 'slide-r'); U.slide = 0; }
  afterRender();
}
function afterRender() {
  const q = $('#dir-q'); if (q && U.focusSearch) { q.focus(); U.focusSearch = false; }
}

/* ───────────────────────── views: home ───────────────────────── */
function viewHome() {
  renderTop('Hazri');
  const ready = !!S.settings.clientId;
  const nUnits = S.units.filter(u => u.expect).length;
  if (!S.units.length) return `
    <section class="card hero">
      <h2>Load your staff list</h2>
      <p>Pick the staff list file (<span class="mono">udairo.js</span>) to add the branches and staff of Udaipur RO. It stays on this phone.</p>
      <button class="btn btn-primary btn-block" data-act="import-staff">${I.up}Load staff list</button>
    </section>`;
  return `
    <section class="card hero">
      <div class="row"><span class="chip acc">${esc(S.units.filter(u => !u.isRO).length)} branches · ${esc(personById.size)} staff</span></div>
      <h2>Start a VC and see which branches are in</h2>
      <p>Create the Meet link here, share it on WhatsApp with the time and agenda, then watch ${nUnits} branches check in.</p>
      <div class="actions">
        <button class="btn btn-primary btn-block" data-act="open-create">${I.plus}Create meeting</button>
        <button class="btn btn-soft btn-block" data-act="open-attach">${I.link}Track an existing meeting</button>
        <button class="btn btn-ghost btn-block" data-act="open-create" data-demo="1">${I.play}Try a demo meeting</button>
      </div>
    </section>
    <div class="home-art"><svg viewBox="0 0 320 200" class="home-arc" id="home-arc"><circle cx="30.9" cy="144.3" r="9" class="ha-s ha-f" data-r="2" data-d="490"/><circle cx="38.4" cy="113.9" r="9" class="ha-s ha-o" data-r="2" data-d="470"/><circle cx="53.0" cy="86.2" r="9" class="ha-s ha-f" data-r="2" data-d="450"/><circle cx="73.8" cy="62.7" r="9" class="ha-s ha-f" data-r="2" data-d="430"/><circle cx="99.6" cy="44.9" r="9" class="ha-s ha-f" data-r="2" data-d="410"/><circle cx="128.9" cy="33.8" r="9" class="ha-s ha-f" data-r="2" data-d="390"/><circle cx="160.0" cy="30.0" r="9" class="ha-s ha-l" data-r="2" data-d="370"/><circle cx="191.1" cy="33.8" r="9" class="ha-s ha-f" data-r="2" data-d="390"/><circle cx="220.4" cy="44.9" r="9" class="ha-s ha-o" data-r="2" data-d="410"/><circle cx="246.2" cy="62.7" r="9" class="ha-s ha-f" data-r="2" data-d="430"/><circle cx="267.0" cy="86.2" r="9" class="ha-s ha-f" data-r="2" data-d="450"/><circle cx="281.6" cy="113.9" r="9" class="ha-s ha-f" data-r="2" data-d="470"/><circle cx="289.1" cy="144.3" r="9" class="ha-s ha-o" data-r="2" data-d="490"/><circle cx="61.2" cy="144.4" r="8.5" class="ha-s ha-f" data-r="1" data-d="337"/><circle cx="70.9" cy="114.6" r="8.5" class="ha-s ha-f" data-r="1" data-d="311"/><circle cx="89.3" cy="89.3" r="8.5" class="ha-s ha-f" data-r="1" data-d="285"/><circle cx="114.6" cy="70.9" r="8.5" class="ha-s ha-f" data-r="1" data-d="259"/><circle cx="144.4" cy="61.2" r="8.5" class="ha-s ha-l" data-r="1" data-d="233"/><circle cx="175.6" cy="61.2" r="8.5" class="ha-s ha-f" data-r="1" data-d="232"/><circle cx="205.4" cy="70.9" r="8.5" class="ha-s ha-o" data-r="1" data-d="259"/><circle cx="230.7" cy="89.3" r="8.5" class="ha-s ha-f" data-r="1" data-d="285"/><circle cx="249.1" cy="114.6" r="8.5" class="ha-s ha-f" data-r="1" data-d="311"/><circle cx="258.8" cy="144.4" r="8.5" class="ha-s ha-f" data-r="1" data-d="337"/><circle cx="91.8" cy="144.4" r="8" class="ha-s ha-o" data-r="0" data-d="181"/><circle cx="105.3" cy="116.4" r="8" class="ha-s ha-f" data-r="0" data-d="144"/><circle cx="129.6" cy="96.9" r="8" class="ha-s ha-f" data-r="0" data-d="107"/><circle cx="160.0" cy="90.0" r="8" class="ha-s ha-f" data-r="0" data-d="70"/><circle cx="190.4" cy="96.9" r="8" class="ha-s ha-f" data-r="0" data-d="107"/><circle cx="214.7" cy="116.4" r="8" class="ha-s ha-l" data-r="0" data-d="144"/><circle cx="228.2" cy="144.4" r="8" class="ha-s ha-f" data-r="0" data-d="181"/><g class="ha-pod-g" data-act="arc-tap" role="button" tabindex="0" aria-label="Tap the emblem"><circle cx="160" cy="160" r="48" fill="transparent"/><circle cx="160" cy="160" r="40" class="ha-pod"/><image href="cbi-emblem.png" x="137" y="137" width="46" height="46"/></g></svg><div class="ha-name">Hazri</div><div class="ha-sub">VC attendance · Regional Office Udaipur</div></div>
    ${ready ? '' : `<div class="banner info">${I.info}<div><b>Google is not connected yet.</b> Demo meetings work now. To create real meetings, add your Client ID in <button class="btn-link" data-act="tab" data-tab="settings" style="border:0;background:none;padding:0;color:var(--accent);font-weight:600">Settings</button>.</div></div>`}`;
}

/* Home art: tap the emblem for a roll-call ripple; five quick taps for confetti. */
const ARC = { anims: [], taps: [] };
function arcTap() {
  const svgEl = $('#home-arc'); if (!svgEl) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#146CC0';
  ARC.anims.forEach(a => a.cancel()); ARC.anims = [];
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  buzz(12);
  const pod = $('.ha-pod-g', svgEl);
  if (!reduce) ARC.anims.push(pod.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: .3 }, { transform: 'scale(1.05)', offset: .7 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }));
  $$('.ha-s', svgEl).forEach(c => {
    const cs = getComputedStyle(c);
    const base = { fill: cs.fill, fillOpacity: cs.fillOpacity, strokeOpacity: cs.strokeOpacity };
    const lit = { fill: acc, fillOpacity: 1, strokeOpacity: 0 };
    const frames = reduce
      ? [base, { ...lit, offset: .25 }, { ...lit, offset: .7 }, base]
      : [{ ...base, transform: 'scale(1)' }, { ...lit, transform: 'scale(1.38)', offset: .14 }, { ...lit, transform: 'scale(.94)', offset: .28 }, { ...lit, transform: 'scale(1)', offset: .4 }, { ...lit, transform: 'scale(1)', offset: .72 }, { ...base, transform: 'scale(1)' }];
    ARC.anims.push(c.animate(frames, { duration: 1150, delay: +c.dataset.d, easing: 'cubic-bezier(.3,.7,.4,1)' }));
  });
  [70, 220, 370].forEach(t => setTimeout(() => buzz(8), t + 40));
  const t = Date.now(); ARC.taps = ARC.taps.filter(x => t - x < 1600); ARC.taps.push(t);
  if (ARC.taps.length >= 5) { ARC.taps = []; confetti(pod.getBoundingClientRect(), reduce); setTimeout(() => buzz([20, 40, 30]), 120); }
}
function confetti(from, reduce) {
  const cv = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60';
  document.body.appendChild(cv);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
  const cols = ['#146CC0', '#D20838', '#5AA6EB', '#0B4A8F', '#F15A7A'];
  const N = reduce ? 40 : 120;
  const ps = Array.from({ length: N }, () => { const a = -Math.PI / 2 + (Math.random() - .5) * 1.9, v = 6 + Math.random() * 9; return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4, col: cols[Math.random() * cols.length | 0] }; });
  const t0 = performance.now();
  const step = now => {
    const t = (now - t0) / 1000; c.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save(); c.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1.3) / .7); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); c.restore(); }
    if (t < 2.0) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}

/* ───────────────────────── header ECG ─────────────────────────
   While a meeting is live, the header's red line becomes a monitor-style heartbeat.
   Beats come at a random rhythm that quickens with the number of people in; new joiners
   add a tall red spike (max 3 per refresh), leavers a small dip (max 2). Faint ripple when empty. */
const ECG = { cv: null, ctx: null, mode: 'off', n: 0, queue: [], sid: null, raf: 0, last: 0, buf: null, red: null, head: 0, cur: null, dist: 0, gap: 0, W: 0, H: 0, dpr: 1, col: '#146CC0', reduce: false };
const ECG_SPEED = 110, ECG_QRS = 64, ECG_SCALE = 11;
const gauss = (t, c, w) => Math.exp(-((t - c) ** 2) / (2 * w * w));
const ecgShape = t => .16 * gauss(t, .12, .045) - .14 * gauss(t, .40, .018) + gauss(t, .46, .022) - .32 * gauss(t, .53, .02) + .26 * gauss(t, .80, .07);
function ecgNormal() {
  const live = ECG.mode === 'live', r = (a, b) => a + Math.random() * (b - a);
  const avg = live ? Math.max(.6, 1.7 - ECG.n * .042) : 2.6;
  const period = avg * (live ? r(.65, 1.35) : r(.6, 1.4));
  const skip = live && Math.random() < .08;
  const amp = skip ? 0 : live ? r(.85, 1.15) : r(.08, .18);
  ECG.gap = Math.max(12, period * ECG_SPEED - ECG_QRS);
  return { len: ECG_QRS, fn: t => amp * ecgShape(t), red: 0 };
}
function ecgSample() {
  for (;;) {
    const c = ECG.cur;
    if (c && ECG.dist < c.len) { const y = c.fn(ECG.dist / c.len); ECG.dist++; return [y, c.red]; }
    ECG.cur = null;
    if (ECG.queue.length) { ECG.cur = ECG.queue.shift(); ECG.dist = 0; continue; }
    if (ECG.gap > 0) { ECG.gap--; return [0, 0]; }
    ECG.cur = ecgNormal(); ECG.dist = 0;
  }
}
function ecgResize() {
  const cv = ECG.cv; if (!cv || !cv.isConnected) return;
  ECG.dpr = Math.min(2, devicePixelRatio || 1); ECG.W = cv.clientWidth; ECG.H = cv.clientHeight;
  if (!ECG.W) return;
  cv.width = ECG.W * ECG.dpr; cv.height = ECG.H * ECG.dpr;
  const L = Math.ceil(ECG.W) + 2;
  if (!ECG.buf || ECG.buf.length !== L) { ECG.buf = new Float32Array(L).fill(NaN); ECG.red = new Uint8Array(L); ECG.head = 0; }
}
function ecgStep(dt) {
  if (!ECG.buf) ecgResize(); if (!ECG.buf) return;
  const L = ECG.buf.length;
  let n = Math.round(ECG_SPEED * dt);
  while (n-- > 0) {
    ECG.head = (ECG.head + 1) % L;
    const [y, red] = ecgSample(); ECG.buf[ECG.head] = y; ECG.red[ECG.head] = red;
    for (let k = 1; k <= 14; k++) ECG.buf[(ECG.head + k) % L] = NaN;
  }
}
function ecgDraw() {
  const { ctx: c, W, H, dpr, buf, red } = ECG; if (!c || !buf) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const base = H - 6, L = buf.length;
  c.fillStyle = 'rgba(210,8,56,.25)'; c.fillRect(0, base - .5, W, 1);
  c.lineWidth = 1.6; c.lineJoin = c.lineCap = 'round';
  for (let k = 1; k < L; k++) {
    const i = (ECG.head - k + L) % L, j = (i + 1) % L;
    if (isNaN(buf[i]) || isNaN(buf[j])) continue;
    c.globalAlpha = Math.max(0, 1 - k / L * .9);
    c.strokeStyle = red[i] || red[j] ? '#D20838' : ECG.col;
    c.beginPath(); c.moveTo(i, base - buf[i] * ECG_SCALE); c.lineTo(i + 1, base - buf[j] * ECG_SCALE); c.stroke();
  }
  c.globalAlpha = 1;
  if (!ECG.reduce) {
    const hy = base - (buf[ECG.head] || 0) * ECG_SCALE;
    c.shadowColor = '#D20838'; c.shadowBlur = 8; c.fillStyle = '#D20838';
    c.beginPath(); c.arc(ECG.head, hy, 2.4, 0, 7); c.fill(); c.shadowBlur = 0;
  }
}
function ecgLoop(ts) {
  ECG.raf = 0;
  if (ECG.mode === 'off' || document.hidden || ECG.reduce) return;
  const dt = ECG.last ? Math.min(.1, (ts - ECG.last) / 1000) : 1 / 60; ECG.last = ts;
  ecgStep(dt); ecgDraw();
  ECG.raf = requestAnimationFrame(ecgLoop);
}
function ecgSync() {
  const s = S.session;
  const n = s ? Object.values(s.parts).filter(p => p.active).length : 0;
  const mode = !s || s.ended ? 'off' : n > 0 ? 'live' : 'faint';
  ECG.mode = mode; ECG.n = n;
  document.documentElement.classList.toggle('ecg-on', mode !== 'off');
  if (mode === 'off') { if (ECG.cv) ECG.cv.remove(); cancelAnimationFrame(ECG.raf); ECG.raf = 0; ECG.queue = []; return; }
  if (!ECG.cv) { ECG.cv = document.createElement('canvas'); ECG.cv.className = 'ecg'; ECG.cv.setAttribute('aria-hidden', 'true'); ECG.ctx = ECG.cv.getContext('2d'); }
  const top = $('#top'); if (ECG.cv.parentNode !== top) top.appendChild(ECG.cv);
  ECG.col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#146CC0';
  ECG.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  ecgResize();
  if (ECG.reduce) {   // a still heartbeat shape, no sweep
    const L = ECG.buf ? ECG.buf.length : 0;
    for (let x = 0; x < L; x++) { const ph = x % 150; ECG.buf[x] = ph < ECG_QRS ? (mode === 'live' ? 1 : .15) * ecgShape(ph / ECG_QRS) : 0; ECG.red[x] = 0; }
    ECG.head = L - 1; ecgDraw(); return;
  }
  if (!ECG.raf && !document.hidden) { ECG.last = 0; ECG.raf = requestAnimationFrame(ecgLoop); }
}
function ecgEvents(joined, left) {
  if (ECG.mode === 'off' || ECG.reduce) return;
  const j = Math.min(joined, 3);
  for (let i = 0; i < j; i++) {
    const A = i === 2 && joined > 3 ? 1.75 : 1.4 * (.95 + Math.random() * .1);
    ECG.queue.push({ len: 30, red: 1, fn: t => A * gauss(t, .45, .085) - .28 * A * gauss(t, .62, .06) });
  }
  for (let i = 0; i < Math.min(left, 2); i++) ECG.queue.push({ len: 34, red: 0, fn: t => -.42 * gauss(t, .5, .16) });
}
addEventListener('resize', () => { if (ECG.mode !== 'off') { ecgResize(); ecgDraw(); } });

/* ───────────────────────── views: create + share ───────────────────────── */
function draftDefault(demo) {
  return { demo: !!demo, when: toLocalInput(nextHalfHour()), agenda: '', headedBy: '', expected: expectedDefault(), controls: { ...S.settings.controls } };
}
function headPicks() {
  const ro = S.units.find(u => u.isRO); if (!ro) return [];
  return ro.staff.filter(p => /Regional Head|Chief Manager/i.test(p.designation)).map(p => `${pretty(p.name)}, ${p.designation.replace(' - HCM', '')}`);
}
function seg(name, value, opts) {
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" aria-pressed="${v === value}" data-act="draft-set" data-k="${name}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
}
function viewCreate() {
  const d = U.draft;
  renderTop(d.demo ? 'Demo meeting' : 'New meeting', { back: true });
  const c = d.controls;
  const agendas = (S.recentAgendas || []).slice(0, 6);
  const exp = d.expected.length;
  const roIn = d.expected.some(code => unitByCode.get(code)?.isRO);
  return `
  <form id="create-form" class="card pad" style="display:flex;flex-direction:column;gap:16px" autocomplete="off">
    ${d.demo ? `<div class="banner info">${I.play}<div>A demo meeting simulates branches joining every few seconds, so you can practise tagging. Nothing is sent to Google.</div></div>` : ''}
    <div class="field"><label for="f-when">Time of VC</label><input class="input" type="datetime-local" id="f-when" value="${esc(d.when)}" data-draft="when" required></div>
    <div class="field"><label for="f-agenda">Agenda</label><textarea class="input" id="f-agenda" data-draft="agenda" rows="2" placeholder="e.g. Q2 RAC review and NPA recovery targets">${esc(d.agenda)}</textarea>
      ${agendas.length ? `<div class="picks">${agendas.map(a => `<button type="button" class="pick" data-act="draft-pick" data-k="agenda" data-v="${esc(a)}">${esc(a.length > 34 ? a.slice(0, 32) + '…' : a)}</button>`).join('')}</div>` : ''}</div>
    <div class="field"><label for="f-head">Headed by</label><input class="input" id="f-head" data-draft="headedBy" value="${esc(d.headedBy)}" placeholder="Name and designation">
      <div class="picks">${headPicks().map(h => `<button type="button" class="pick" aria-pressed="${h === d.headedBy}" data-act="draft-pick" data-k="headedBy" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>
    <div class="field"><span class="flabel">Who should attend</span>
      <button type="button" class="sug" data-act="pick-expected"><div class="grow"><div class="title">${exp - (roIn ? 1 : 0)} branches${roIn ? ' + RO staff' : ''}</div><div class="sub">Missing branches will show in the call list</div></div>${I.chev}</button></div>
  </form>
  ${d.demo ? '' : `
  <div class="sec-label">Host controls</div>
  <section class="card">
    <div class="pad" style="display:flex;flex-direction:column;gap:14px">
      <div class="field"><span class="flabel">Meeting access</span>${seg('access', c.access, [['OPEN', 'Open'], ['TRUSTED', 'Trusted'], ['RESTRICTED', 'Restricted']])}
        <span class="hint">${{ OPEN: 'Anyone with the link joins without asking to be let in.', TRUSTED: 'Your organisation joins directly; others ask to join.', RESTRICTED: 'Only invited people join directly; others ask.' }[c.access]}</span></div>
    </div>
    <div class="list">
      <label class="setting"><div class="grow"><div class="title">Host management</div><div class="sub">Lets you limit chat, presenting and reactions</div></div><span class="switch"><input type="checkbox" id="c-mod" data-ctrl="moderation" ${c.moderation ? 'checked' : ''}><span></span></span></label>
      ${c.moderation ? `
      <div class="pad" style="display:flex;flex-direction:column;gap:14px">
        <div class="field"><span class="flabel">Who can send chat</span>${seg('chat', c.chat, [['NO_RESTRICTION', 'Everyone'], ['HOSTS_ONLY', 'Hosts only']])}</div>
        <div class="field"><span class="flabel">Who can share screen</span>${seg('present', c.present, [['NO_RESTRICTION', 'Everyone'], ['HOSTS_ONLY', 'Hosts only']])}</div>
        <div class="field"><span class="flabel">Who can send reactions</span>${seg('reactions', c.reactions, [['NO_RESTRICTION', 'Everyone'], ['HOSTS_ONLY', 'Hosts only']])}</div>
      </div>
` : ''}
    </div>
  </section>
  <p class="hint" style="margin:-4px 2px 0">These become your defaults for the next meeting.</p>`}
  <div style="display:flex;flex-direction:column;gap:10px">
    <button class="btn btn-primary btn-block" data-act="create" id="create-btn">${d.demo ? I.play + 'Start demo' : I.plus + 'Create meeting'}</button>
    ${!d.demo && !S.settings.clientId ? `<p class="hint" style="text-align:center;margin:0">Google isn't connected yet. Add your Client ID in Settings, or start a demo.</p>` : ''}
  </div>`;
}
function shareText(s) {
  const d = s.details; const lines = ['*Video Conference – RO Udaipur*'];
  if (d.when) lines.push('🕚 ' + fmtWhen(d.when));
  if (d.headedBy) lines.push('👤 Headed by: ' + d.headedBy);
  if (d.agenda) lines.push('📋 Agenda: ' + d.agenda);
  lines.push('🔗 Join: ' + s.meetingUri);
  return lines.join('\n');
}
function viewShare() {
  const s = S.session;
  renderTop('Share meeting', { back: true });
  if (!s) return '';
  if (U.shareText == null) U.shareText = shareText(s);
  return `
  <section class="card pad" style="display:flex;flex-direction:column;gap:12px">
    <div class="row"><span class="chip in"><span class="dot"></span>Meeting ready</span><span class="mono muted">${esc(s.meetingCode)}</span></div>
    ${s.controlsNote ? `<div class="banner warn">${I.alert}<div>${esc(s.controlsNote)}</div></div>` : ''}
    <div class="field"><label for="share-text">Message</label><textarea class="input" id="share-text" rows="6" data-share>${esc(U.shareText)}</textarea><span class="hint">Edit anything before sending.</span></div>
    <div class="share-grid">
      <button class="btn btn-primary" data-act="share-native">${I.share}Share…</button>
      <a class="btn btn-soft" id="wa-link" href="https://wa.me/?text=${encodeURIComponent(U.shareText)}" target="_blank" rel="noopener">${I.chat}WhatsApp</a>
      <button class="btn btn-ghost" data-act="copy-share">${I.copy}Copy</button>
      <a class="btn btn-ghost" href="${esc(s.meetingUri)}" target="_blank" rel="noopener">${I.video}Join</a>
    </div>
  </section>
  <button class="btn btn-primary btn-block" data-act="to-board">Go to live board</button>`;
}

/* ───────────────────────── views: live board ───────────────────────── */
function ring(joined, total) {
  const r = 40, c = 2 * Math.PI * r, f = total ? joined / total : 0;
  return `<div class="ring" role="img" aria-label="${joined} of ${total} branches joined"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="${r}" fill="none" stroke-width="8" style="stroke:var(--surface-2)"/><circle cx="46" cy="46" r="${r}" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${f ? c * (1 - f) : c}" style="stroke:var(--in);transition:stroke-dashoffset .6s"/></svg><div class="num"><b>${joined}/${total}</b><span>branches</span></div></div>`;
}
function syncLine(s) {
  if (s.error) {
    const re = s.error.code === 'reauth' || s.error.code === 'noclient';
    return `<div class="banner ${re ? 'warn' : 'err'}">${I.alert}<div class="grow">${esc(s.error.msg)}${re ? `<div style="margin-top:8px"><button class="btn btn-ghost" data-act="reconnect" style="min-height:38px;padding:8px 12px">${I.refresh}Reconnect</button></div>` : ''}</div></div>`;
  }
  const label = s.ended ? `<span class="chip">Meeting ended</span>` : s.state === 'empty' ? `<span class="chip"><span class="dot"></span>Empty</span>` : s.state === 'waiting' ? `<span class="chip acc"><span class="dot pulse"></span>Waiting for the first person</span>` : `<span class="chip in"><span class="dot pulse"></span>Live</span>`;
  return `<div class="syncbar">${label}<span>Updated <span data-ago="${s.lastSync || ''}">${ago(s.lastSync)}</span></span><span class="grow"></span><button class="icon-btn" data-act="sync" aria-label="Refresh now" style="width:34px;height:34px">${I.refresh}</button></div>`;
}
function personChips(list, onlyActive) {
  return list.filter(x => !onlyActive || x.p.active).map(x => {
    const lbl = x.t.p ? pretty(personById.get(x.t.p)?.name || x.p.name) : x.p.name;
    return `<button class="chip ${x.p.active ? 'in' : 'left'}" data-act="tag" data-key="${esc(x.p.key)}" style="border:0">${esc(lbl)}</button>`;
  }).join('');
}
function bmOf(u) { return u.staff.find(p => p.bm) || u.staff[0]; }
function callNumber(u) { return u.mobile || u.phone || (bmOf(u) && bmOf(u).phone) || ''; }
function viewBoard() {
  const s = S.session, b = board();
  renderTop(s.source === 'demo' ? 'Demo meeting' : 'Live board', { actions: `${s.source === 'demo' ? '' : `<a class="join-btn" href="${esc(s.meetingUri)}" target="_blank" rel="noopener" aria-label="Join the meeting yourself">${I.video}Join</a>`}<button class="icon-btn" data-act="go-share" aria-label="Share meeting">${I.share}</button><button class="icon-btn" data-act="session-menu" aria-label="Meeting options">${I.more}</button>` });
  const d = s.details;
  const tabs = [['miss', 'Not joined', b.missCount], ['left', 'Joined & left', b.rows.left.length], ['in', 'In meeting', b.rows.in.length], ['people', 'People', b.people.length]];
  let list = '';
  if (U.boardTab === 'miss') {
    list = b.rows.miss.length ? b.rows.miss.map(r => {
      const u = r.u, bm = bmOf(u), num = callNumber(u);
      return `<div class="item"><span class="stripe miss"></span><div class="grow"><div class="row" style="gap:8px"><span class="code">${u.code}</span><span class="title ellipsis">${esc(unitLabel(u))}</span></div>
        <div class="sub ellipsis">${bm ? esc(pretty(bm.name)) : 'No staff listed'}</div>${callOf(u.code) ? `<div style="margin-top:4px">${callChip(u.code)}</div>` : ''}</div>
        <button class="icon-btn" data-act="call-sheet" data-code="${u.code}" aria-label="More numbers for ${esc(u.name)}">${I.more}</button>
        ${num ? `<a class="call-btn" ${dial(u.code, u.mobile && num === u.mobile ? 'Branch mobile' : u.phone && num === u.phone ? 'Landline' : pretty(bmOf(u)?.name || ''), num)}>${I.phone}Call</a>` : ''}</div>`;
    }).join('') : `<div class="empty"><b>Everyone expected has joined</b>All ${b.total} branches have been in the meeting.</div>`;
  } else if (U.boardTab === 'left') {
    list = b.rows.left.length ? b.rows.left.map(r => {
      const u = r.u;
      return `<div class="item"><span class="stripe left"></span><div class="grow"><div class="row" style="gap:8px"><span class="code">${u.code}</span><span class="title ellipsis">${esc(unitLabel(u))}</span></div>
        <div class="sub">Left at ${fmtTime(r.lastLeft)} · knows about the meeting</div><div class="people-inline">${personChips(r.list)}</div></div>
        <button class="icon-btn" data-act="call-sheet" data-code="${u.code}" aria-label="Numbers for ${esc(u.name)}">${I.phone}</button></div>`;
    }).join('') : `<div class="empty"><b>No one has left yet</b>Branches whose people join and then drop off will appear here.</div>`;
  } else if (U.boardTab === 'in') {
    list = b.rows.in.length ? b.rows.in.map(r => {
      const u = r.u, fl = r.list.some(x => U.flash.has(x.p.key));
      return `<div class="item ${fl ? 'flash' : ''}"><span class="stripe in"></span><div class="grow"><div class="row" style="gap:8px"><span class="code">${u.code}</span><span class="title ellipsis">${esc(unitLabel(u))}</span>${r.expected ? '' : '<span class="chip">not expected</span>'}</div>
        <div class="people-inline">${personChips(r.list)}</div></div></div>`;
    }).join('') : `<div class="empty"><b>No branch has joined yet</b>${s.state === 'waiting' ? 'The board fills in as soon as people enter the meeting.' : 'Tag the people who joined to see their branches here.'}</div>`;
  } else {
    list = b.people.length ? b.people.map(({ p, t, u }) => {
      const fl = U.flash.has(p.key);
      return `<button class="item tap ${fl ? 'flash' : ''}" data-act="tag" data-key="${esc(p.key)}"><span class="avatar ${p.kind === 'google' ? 'g' : ''}">${esc(initials(p.name) || '?')}</span><div class="grow"><div class="title ellipsis">${esc(p.name)}</div>
        <div class="sub ellipsis">${t ? esc(targetLabel(t)) + (u && t.p ? ' · ' + esc(unitLabel(u)) : '') : s.ignored[p.key] ? 'Ignored' : '<span style="color:var(--accent);font-weight:600">Tap to tag</span>'}</div></div>
        <span class="chip ${p.active ? 'in' : 'left'}">${p.active ? 'In' : 'Left ' + fmtTime(p.lastEnd)}</span></button>`;
    }).join('') : `<div class="empty"><b>Nobody has joined yet</b>People appear here the moment they enter the meeting.</div>`;
  }
  return `
  <section class="card meet-head">
    <div class="meet-meta">
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="mono muted" style="font-size:13px">${esc(s.meetingCode)}</span>${d.when ? `<span class="faint">·</span><span class="sub">${esc(fmtWhen(d.when))}</span>` : ''}</div>
      ${d.agenda ? `<div class="agenda">${esc(d.agenda)}</div>` : ''}
      ${d.headedBy ? `<div class="sub">Headed by ${esc(d.headedBy)}</div>` : ''}
    </div>
    <div class="score">${ring(b.joined, b.total)}
      <div class="tallies"><div class="tally in"><b>${b.inCount}</b><span>In now</span></div><div class="tally left"><b>${b.leftCount}</b><span>Left</span></div><div class="tally miss"><b>${b.missCount}</b><span>Not joined</span></div></div>
    </div>
    ${syncLine(s)}
  </section>
  ${b.untagged.length ? `<section class="card untagged"><div class="row"><span class="title grow">${b.untagged.length} ${b.untagged.length === 1 ? 'person needs' : 'people need'} a tag</span><span class="sub">tap to match</span></div>
    <div class="untagged-list">${b.untagged.map(p => `<button class="u-pill" data-act="tag" data-key="${esc(p.key)}">${I.tag}${esc(p.name)}</button>`).join('')}</div></section>` : ''}
  <div class="board-tabs"><div class="seg" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" aria-pressed="${U.boardTab === k}" data-act="board-tab" data-k="${k}">${l} <span class="mono" style="opacity:.7">${n}</span></button>`).join('')}</div></div>
  <section class="card list" id="board-list">${list}</section>`;
}

/* ───────────────────────── views: directory ───────────────────────── */
function viewDirectory() {
  renderTop('Directory', { actions: `<button class="icon-btn" data-act="add-person" aria-label="Add person">${I.plus}</button>` });
  return `
  <div class="search-wrap">${I.search}<input class="input" id="dir-q" type="search" placeholder="Search branch, name, code or emp ID" value="${esc(U.dirQ)}" autocomplete="off"></div>
  <div class="seg" role="group">${[['branches', 'Branches'], ['ro', 'RO staff'], ['linked', 'Linked accounts']].map(([k, l]) => `<button aria-pressed="${U.dirFilter === k}" data-act="dir-filter" data-k="${k}">${l}</button>`).join('')}</div>
  <section class="card list" id="dir-list">${dirList()}</section>
  <p class="hint" style="text-align:center;margin:4px 0 0">Staff transferred? <button data-act="import-staff" style="border:0;background:none;padding:0;color:var(--accent);font:inherit;font-weight:600">Update staff list</button></p>`;
}
function linkedCount(personIdOrUnit) {
  let n = 0; for (const k in S.idents) { const t = S.idents[k].to; if (t.p === personIdOrUnit || t.u === personIdOrUnit) n++; } return n;
}
function dirList() {
  const q = U.dirQ.trim().toLowerCase();
  if (U.dirFilter === 'linked') {
    const rows = Object.entries(S.idents).filter(([k, v]) => !q || (v.name + ' ' + targetLabel(v.to)).toLowerCase().includes(q)).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    if (!rows.length) return `<div class="empty"><b>No linked accounts yet</b>When you tag someone in a meeting, their Google account is remembered here.</div>`;
    return rows.map(([k, v]) => { const u = unitOf(v.to); return `<button class="item tap" data-act="tag" data-key="${esc(k)}" data-mode="relink"><span class="avatar ${k.startsWith('g:') ? 'g' : ''}">${esc(initials(v.name) || '?')}</span><div class="grow"><div class="title ellipsis">${esc(v.name)}</div><div class="sub ellipsis">${esc(targetLabel(v.to))}${u && v.to.p ? ' · ' + esc(unitLabel(u)) : ''}</div></div><span class="chip">${k.startsWith('g:') ? 'Google' : k.startsWith('t:') ? 'Phone' : 'Name'}</span></button>`; }).join('');
  }
  if (U.dirFilter === 'ro') {
    const ro = S.units.find(u => u.isRO); if (!ro) return `<div class="empty">No Regional Office in the directory.</div>`;
    const staff = ro.staff.filter(p => !q || (p.name + ' ' + p.designation + ' ' + p.dept + ' ' + p.empId).toLowerCase().includes(q));
    staff.sort((x, y) => pretty(x.name).localeCompare(pretty(y.name), 'en', { sensitivity: 'base' }));
    return staff.map(p => personRow(p)).join('') || `<div class="empty">No RO staff match “${esc(U.dirQ)}”.</div>`;
  }
  const units = S.units.filter(u => !u.isRO);
  if (q) {
    const hitsU = units.filter(u => (u.name + ' ' + u.code + ' ' + u.alpha).toLowerCase().includes(q));
    const hitsP = [...personById.values()].filter(p => !unitByCode.get(p.unit)?.isRO && (p.name + ' ' + p.empId + ' ' + p.designation).toLowerCase().includes(q)).slice(0, 30);
    return (hitsU.map(unitRow).join('') + hitsP.map(p => personRow(p.ref, unitByCode.get(p.unit))).join('')) || `<div class="empty">Nothing matches “${esc(U.dirQ)}”.</div>`;
  }
  return callSummary(units) + units.slice().sort((a, b) => a.name.localeCompare(b.name)).map(unitRow).join('');
}
function callSummary(units) {
  const n = { informed: 0, recall: 0, noanswer: 0, denied: 0, called: 0, none: 0 };
  for (const u of units) { const c = callOf(u.code); n[c ? c.status : 'none']++; }
  if (n.none === units.length) return '';
  const parts = [['informed', 'informed'], ['recall', 'recall later'], ['noanswer', 'no answer'], ['denied', 'denied'], ['called', 'called']].filter(([k]) => n[k]).map(([k, l]) => `<span class="chip ${CALL_STATUS[k].cls}">${n[k]} ${l}</span>`).join('');
  return `<div class="item" style="flex-wrap:wrap;gap:8px"><div class="grow" style="min-width:100%"><div class="title">Calling round</div><div class="sub">${n.none} of ${units.length} branches not called yet</div></div><div class="row" style="flex-wrap:wrap;gap:6px;flex:1">${parts}</div><button class="btn btn-ghost" style="min-height:36px;padding:6px 12px" data-act="reset-calls">New round</button></div>`;
}
function unitRow(u) {
  const n = u.staff.reduce((a, p) => a + linkedCount(p.id), 0) + linkedCount(u.code);
  return `<button class="item tap" data-act="open-unit" data-code="${u.code}"><span class="code">${u.code}</span><div class="grow"><div class="title ellipsis">${esc(u.name)}${u.isNew ? ' <span class="chip acc" style="margin-left:4px">New</span>' : ''}</div><div class="sub">${u.staff.length} staff · ${n} linked${u.expect ? '' : ' · not expected'}</div>${callOf(u.code) ? `<div style="margin-top:4px">${callChip(u.code)}</div>` : ''}</div>${I.chev.replace('<svg', '<svg style="width:18px;height:18px;color:var(--faint)"')}</button>`;
}
function personRow(p, u) {
  const n = linkedCount(p.id);
  return `<button class="item tap" data-act="edit-person" data-id="${esc(p.id)}"><span class="avatar">${esc(initials(p.name))}</span><div class="grow"><div class="title ellipsis">${esc(pretty(p.name))}</div><div class="sub ellipsis">${esc(p.designation)}${p.dept ? ' · ' + esc(p.dept) : ''}${u ? ' · ' + esc(u.name) : ''}</div></div>${n ? `<span class="chip acc">${n} linked</span>` : ''}${p.bm ? '<span class="chip">BM</span>' : p.second ? '<span class="chip">2nd</span>' : ''}</button>`;
}
function staffRow(p, u) {
  const n = linkedCount(p.id);
  return `<div class="item"><button class="plain grow" data-act="edit-person" data-id="${esc(p.id)}"><span class="avatar">${esc(initials(p.name))}</span><div class="grow"><div class="title ellipsis">${esc(pretty(p.name))}</div><div class="sub ellipsis">${p.bm ? 'Branch Manager' : p.second ? 'Second in command · ' + esc(p.designation) : esc(p.designation)}${p.dept ? ' · ' + esc(p.dept) : ''}${n ? ' · ' + n + ' linked' : ''}</div></div></button>${p.phone ? `<a class="icon-btn call" aria-label="Call ${esc(pretty(p.name))}" ${dial(u.code, pretty(p.name), p.phone)}>${I.phone}</a>` : ''}</div>`;
}
function viewUnit(code) {
  const u = unitByCode.get(code);
  if (!u) { U.route = null; return viewDirectory(); }
  renderTop(unitLabel(u), { back: true, actions: `<button class="icon-btn" data-act="edit-unit" data-code="${u.code}" aria-label="Edit branch">${I.edit}</button>` });
  const linkedUnit = Object.entries(S.idents).filter(([, v]) => v.to.u === u.code);
  return `
  <section class="card pad" style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="gap:8px;flex-wrap:wrap"><span class="code">${u.code}</span><span class="mono muted">${esc(u.alpha)}</span>${u.category ? `<span class="chip">${esc(u.category.toLowerCase())}</span>` : ''}${u.isNew ? '<span class="chip acc">New branch</span>' : ''}</div>
    <dl class="kv"><dt>In meetings</dt><dd>${u.expect ? 'Expected by default' : 'Not expected by default'}</dd></dl>
  </section>
  <section class="card pad" style="display:flex;flex-direction:column;gap:12px">
    <div class="row"><div class="grow"><div class="title">Call status</div><div class="sub">${callOf(u.code) ? `${esc(CALL_STATUS[callOf(u.code).status]?.label || 'Called')} ${ago(callOf(u.code).at)}${callOf(u.code).who ? ' · ' + esc(callOf(u.code).who) : ''}` : 'Not called yet. Call anyone below and you\'ll be asked how it went.'}</div></div>${callOf(u.code) ? `<button class="btn btn-ghost" style="min-height:36px;padding:6px 12px" data-act="call-status" data-code="${u.code}" data-status="clear">Clear</button>` : ''}</div>
    ${statusPicker(u.code)}
  </section>
  ${u.mobile || u.phone ? `<section class="card list">${[['Branch mobile', u.mobile], ['Landline', u.phone]].filter(x => x[1]).map(([l, n]) => `<div class="item"><div class="grow"><div class="title">${l}</div><div class="sub mono">${esc(n)}</div></div><a class="call-btn" ${dial(u.code, l, n)}>${I.phone}Call</a></div>`).join('')}</section>` : ''}
  <div class="row" style="margin:6px 2px -4px"><span class="sec-label grow" style="margin:0">Staff · ${u.staff.length}</span><button class="btn btn-soft" style="min-height:36px;padding:6px 12px" data-act="add-person" data-code="${u.code}">${I.plus}Add</button></div>
  <section class="card list">${u.staff.slice().sort((a, b) => (b.bm - a.bm) || (b.second - a.second)).map(p => staffRow(p, u)).join('') || '<div class="empty">No staff listed.</div>'}</section>
  ${linkedUnit.length ? `<div class="sec-label">Accounts linked to the whole ${u.isRO ? 'office' : 'branch'}</div><section class="card list">${linkedUnit.map(([k, v]) => `<button class="item tap" data-act="tag" data-key="${esc(k)}" data-mode="relink"><span class="avatar">${esc(initials(v.name))}</span><div class="grow"><div class="title">${esc(v.name)}</div><div class="sub">Tap to change or unlink</div></div></button>`).join('')}</section>` : ''}`;
}

/* ───────────────────────── views: settings ───────────────────────── */
let persisted = null;
async function checkPersist() { try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { persisted = null; } }
async function requestPersist(silent) {
  try {
    if (navigator.storage && navigator.storage.persist) { persisted = await navigator.storage.persist(); if (!silent) toast(persisted ? 'Storage protected on this phone' : 'Your browser declined. Install the app to the home screen, then try again.'); }
    else if (!silent) toast('This browser does not support protected storage.');
  } catch (e) { if (!silent) toast('Could not protect storage.'); }
  if (U.tab === 'settings') renderMain();
}
/* App version: keep APP_VERSION equal to the number in sw.js VERSION ('rollcall-vN') on every release. */
const APP_VERSION = 24;
async function checkUpdate(force) {
  if (U.update && U.update.busy) return;
  if (U.update && !force && Date.now() - U.update.at < 60e3) return;
  U.update = { busy: true, at: Date.now(), latest: (U.update || {}).latest };
  if (U.tab === 'settings' && !U.route) renderMain();
  try {
    const r = await fetch('sw.js?cb=' + Date.now(), { cache: 'no-store' });
    const m = /rollcall-v(\d+)/.exec(await r.text());
    if (!m) throw new Error('no version');
    U.update = { at: Date.now(), latest: +m[1] };
  } catch (e) { U.update = { at: Date.now(), error: true }; }
  if (U.tab === 'settings' && !U.route) renderMain();
}
async function applyUpdate() {
  U.update = { ...(U.update || {}), busy: true }; renderMain();
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } catch (e) {}
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) {}
  // GitHub Pages lets the browser keep files for ~10 minutes. Force fresh copies into the browser cache before reloading.
  await Promise.all(['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'cbi-emblem.png'].map(f => fetch(f, { cache: 'reload' }).catch(() => {})));
  try { sessionStorage.setItem('rc.tab', 'settings'); } catch (e) {}
  location.reload();
}
function versionCard() {
  const u = U.update || {};
  const newer = u.latest && u.latest > APP_VERSION;
  const sub = u.busy ? 'Checking for updates…' : u.error ? 'Could not check. Are you online?' : newer ? `Version ${u.latest} is available` : u.latest ? 'You have the latest version' : 'Not checked yet';
  const btn = newer ? `<button class="btn btn-primary" data-act="apply-update">${I.refresh}Update now</button>` : `<button class="btn btn-ghost" data-act="check-update" ${u.busy ? 'disabled' : ''}>${I.refresh}Check</button>`;
  return `<div class="sec-label">App</div>
  <section class="card list"><div class="setting"><div class="grow"><div class="title">Version ${APP_VERSION}</div><div class="sub">${sub}</div></div>${btn}</div></section>`;
}
function viewSettings() {
  renderTop('Settings');
  setTimeout(checkUpdate, 0);
  const st = S.settings, c = st.controls;
  const signed = G.valid() || st.signedIn;
  return `
  <div class="sec-label">Google account</div>
  <section class="card pad" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label for="s-client">OAuth Client ID</label><input class="input mono" id="s-client" style="font-size:13px" value="${esc(st.clientId)}" placeholder="1234-abc.apps.googleusercontent.com" data-setting="clientId" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"><span class="hint">Already filled in. Change it only if you make a new Google Cloud project.</span></div>
    <div class="row">
      <div class="grow"><div class="title">${signed ? 'Connected' : 'Not connected'}</div><div class="sub">${signed ? 'Meet access granted on this phone' : 'Sign in once to create and track meetings'}</div></div>
      ${signed ? `<button class="btn btn-ghost" data-act="signout">Disconnect</button>` : `<button class="btn btn-primary" data-act="signin" ${st.clientId ? '' : 'disabled'}>${I.google}Connect</button>`}
    </div>
  </section>

  <div class="sec-label">During meetings</div>
  <section class="card list">
    <div class="setting"><div class="grow"><div class="title">Check for joiners every</div><div class="sub">Shorter is faster but uses more data</div></div>
      <select class="input" style="width:auto;min-height:40px;padding:6px 10px" data-setting="poll">${[10, 15, 30, 60].map(n => `<option value="${n}" ${+st.poll === n ? 'selected' : ''}>${n} sec</option>`).join('')}</select></div>
    <label class="setting"><div class="grow"><div class="title">Keep screen on</div><div class="sub">While the live board is open</div></div><span class="switch"><input type="checkbox" data-setting="keepAwake" ${st.keepAwake ? 'checked' : ''}><span></span></span></label>
    <div class="setting"><div class="grow"><div class="title">Default host controls</div><div class="sub">${accessLabel(c.access)} access${c.moderation ? ` · chat ${c.chat === 'HOSTS_ONLY' ? 'hosts only' : 'everyone'} · screen share ${c.present === 'HOSTS_ONLY' ? 'hosts only' : 'everyone'}` : ' · host management off'}</div></div></div>
  </section>

  <div class="sec-label">Staff list</div>
  <section class="card pad" style="display:flex;flex-direction:column;gap:10px">
    <div class="row"><div class="grow"><div class="title">${S.units.filter(u => !u.isRO).length} branches · ${personById.size} staff</div><div class="sub">${S.staffAt ? 'Updated ' + ago(S.staffAt) : 'Loaded from your staff list file'}</div></div>
      <button class="btn btn-primary" data-act="import-staff">${I.up}Update</button></div>
    <span class="hint">After transfers or postings, pick the new <span class="mono">udairo.js</span> here. Tags stay with each person, and you see what changed before anything is replaced.</span>
  </section>

  <div class="sec-label">Data on this phone</div>
  <section class="card list">
    <div class="setting">${I.shield.replace('<svg', '<svg style="width:22px;height:22px;color:' + (persisted ? 'var(--in)' : 'var(--faint)') + '"')}<div class="grow"><div class="title">${persisted ? 'Storage protected' : 'Storage not protected'}</div><div class="sub">${persisted ? 'The browser won\'t clear your tags to free space.' : 'Allow it so the browser never clears your tags to free space.'}</div></div>${persisted ? '' : `<button class="btn btn-soft" data-act="persist">Allow</button>`}</div>
    <div class="setting"><div class="grow"><div class="title">Backup</div><div class="sub">${S.backup.at ? 'Last saved ' + ago(S.backup.at) : 'Never saved'}${S.backup.dirty ? ' · ' + S.backup.dirty + ' changes since' : ''}</div></div></div>
    <div class="pad" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:0">
      <button class="btn btn-soft" data-act="export" data-kind="full">${I.down}Full backup</button>
      <button class="btn btn-soft" data-act="export" data-kind="map">${I.down}Mappings only</button>
      <button class="btn btn-ghost" data-act="import" style="grid-column:1/-1">${I.up}Restore a backup or mappings file</button>
    </div>
    <div class="setting"><div class="grow"><div class="title">${Object.keys(S.idents).length} linked accounts</div><div class="sub">${S.units.length} offices · ${personById.size} staff</div></div><button class="btn btn-danger" data-act="clear-maps" ${Object.keys(S.idents).length ? '' : 'disabled'}>Clear</button></div>
    ${window.SEED_DATA ? `<div class="setting"><div class="grow"><div class="title">Reset directory</div><div class="sub">Restore the built-in branch and staff list. Your tags stay.</div></div><button class="btn btn-ghost" data-act="reset-dir">Reset</button></div>` : ''}
  </section>
  ${versionCard()}
  <p class="hint" style="text-align:center;margin:8px 0 0">Hazri · built by Nitin Kotwar (139535), via PDUDAIRO</p>`;
}

/* ───────────────────────── sheets ───────────────────────── */
let sheetClose = null;
function openSheet(html, { onClose } = {}) {
  closeSheet(true);
  if (pendingSheetPop) { pendingSheetPop = false; sheetNav = true; }
  else if (!sheetNav) { navPush(); sheetNav = true; }
  const layer = $('#layer');
  layer.innerHTML = `<div class="scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  requestAnimationFrame(() => { $('.scrim', layer).classList.add('show'); $('.sheet', layer).classList.add('show'); });
  sheetClose = onClose || null;
  document.body.style.overflow = 'hidden';
}
function closeSheet(instant, fromPop) {
  const layer = $('#layer'); if (!layer.firstChild) return;
  if (sheetNav && !fromPop) {
    sheetNav = false; pendingSheetPop = true;
    setTimeout(() => { if (pendingSheetPop) { pendingSheetPop = false; navPopSilently(); } }, 0);
  }
  const cb = sheetClose; sheetClose = null;
  document.body.style.overflow = '';
  if (instant) { layer.innerHTML = ''; return; }
  $('.scrim', layer)?.classList.remove('show'); $('.sheet', layer)?.classList.remove('show');
  setTimeout(() => { if (!$('.sheet.show', layer)) layer.innerHTML = ''; }, 260);
  cb && cb();
}
function confirmSheet(title, body, ok = 'Confirm', danger = false) {
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); };
    openSheet(`<div class="sheet-head"><h3 class="grow">${esc(title)}</h3></div><div class="sheet-body"><p style="margin:0" class="muted">${body}</p></div>
      <div class="sheet-foot"><button class="btn btn-ghost" style="flex:1" id="cf-no">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" style="flex:1" id="cf-ok">${esc(ok)}</button></div>`, { onClose: () => fin(false) });
    $('#cf-no').onclick = () => closeSheet();
    $('#cf-ok').onclick = () => { fin(true); closeSheet(); };
  });
}

/* Tag sheet */
function openTag(key, mode) {
  const s = S.session;
  const part = s && s.parts[key];
  const ident = S.idents[key];
  const name = part ? part.name : ident ? ident.name : key;
  const kind = part ? part.kind : key.startsWith('g:') ? 'google' : key.startsWith('t:') ? 'phone' : 'guest';
  const cur = targetFor(key);
  const sugg = suggest(name);
  const kindLabel = { google: 'Signed-in Google account', guest: 'Guest — matched by display name', phone: 'Phone dial-in — matched by number shown' }[kind];
  const rememberDefault = mode === 'relink' ? true : !(s && s.temp[key]);
  openSheet(`
    <div class="sheet-head"><span class="avatar ${kind === 'google' ? 'g' : ''}">${esc(initials(name) || '?')}</span><div class="grow"><h3>${esc(name)}</h3><div class="sub">${esc(kindLabel)}${part ? ' · ' + (part.active ? 'in the meeting' : 'left ' + fmtTime(part.lastEnd)) : ''}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      ${cur ? `<div class="banner info">${I.tag}<div class="grow">Tagged as <b>${esc(targetLabel(cur))}</b>${cur.p ? ' · ' + esc(unitLabel(unitOf(cur))) : ''}</div></div>` : ''}
      ${sugg.length ? `<div class="flabel">Suggested</div><div class="results">${sugg.map((x, i) => pickRow(x.t, i === 0 && x.score >= 0.4)).join('')}</div>` : ''}
      <div class="search-wrap">${I.search}<input class="input" id="tag-q" type="search" placeholder="Search staff, branch or emp ID" autocomplete="off"></div>
      <div class="results" id="tag-results"></div>
      ${s && mode !== 'relink' ? `<label class="setting" style="padding:4px 0"><div class="grow"><div class="title">Remember for future meetings</div><div class="sub">${kind === 'google' ? 'Recognise this Google account automatically next time' : 'Recognise this display name automatically next time'}</div></div><span class="switch"><input type="checkbox" id="tag-remember" ${rememberDefault ? 'checked' : ''}><span></span></span></label>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${cur ? `<button class="btn btn-danger" style="flex:1" data-act="untag">${I.x}Remove tag</button>` : ''}
        ${s && part && !cur ? `<button class="btn btn-ghost" style="flex:1" data-act="ignore">${s.ignored[key] ? 'Stop ignoring' : 'Not from a branch'}</button>` : ''}
      </div>
    </div>`);
  const sheet = $('.sheet');
  sheet.dataset.key = key; sheet.dataset.mode = mode || '';
  const q = $('#tag-q');
  const run = () => { $('#tag-results').innerHTML = searchTargets(q.value).map(t => pickRow(t)).join(''); };
  q.addEventListener('input', run);
}
function pickRow(t, best) {
  if (t.u != null) {
    const u = unitByCode.get(t.u);
    return `<button class="sug ${best ? 'best' : ''}" data-act="assign" data-u="${t.u}"><span class="code">${t.u}</span><div class="grow"><div class="title">${esc(unitLabel(u))}</div><div class="sub">Whole ${u.isRO ? 'office' : 'branch'} account</div></div>${best ? '<span class="chip acc">Best match</span>' : ''}</button>`;
  }
  const p = personById.get(t.p); const u = unitByCode.get(p.unit);
  return `<button class="sug ${best ? 'best' : ''}" data-act="assign" data-p="${esc(p.id)}"><span class="avatar">${esc(initials(p.name))}</span><div class="grow"><div class="title ellipsis">${esc(pretty(p.name))}</div><div class="sub ellipsis">${esc(unitLabel(u))} · ${esc(p.designation)}${p.dept ? ' · ' + esc(p.dept) : ''}</div></div>${best ? '<span class="chip acc">Best match</span>' : ''}</button>`;
}
function searchTargets(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const out = [];
  for (const u of S.units) if ((u.name + ' ' + u.code + ' ' + u.alpha + (u.isRO ? ' regional office ro' : '')).toLowerCase().includes(q)) out.push({ u: u.code });
  for (const p of personById.values()) if ((p.name + ' ' + p.empId + ' ' + p.designation + ' ' + p.dept + ' ' + (unitByCode.get(p.unit)?.name || '')).toLowerCase().includes(q)) out.push({ p: p.id });
  return out.slice(0, 25);
}
function assign(key, target, remember) {
  const s = S.session;
  const prevIdent = S.idents[key] ? JSON.parse(JSON.stringify(S.idents[key])) : null;
  const prevTemp = s && s.temp[key] ? { ...s.temp[key] } : null;
  const name = (s && s.parts[key] && s.parts[key].name) || (S.idents[key] && S.idents[key].name) || key;
  if (remember) { S.idents[key] = { to: target, name, at: now() }; if (s) delete s.temp[key]; markDirty(); }
  else if (s) { s.temp[key] = target; }
  if (s) delete s.ignored[key];
  save(); closeSheet(); render();
  if (persisted === false) requestPersist(true);
  const u = unitOf(target);
  toast(`Tagged as ${targetLabel(target)}${target.p && u ? ' · ' + unitLabel(u) : ''}`, () => {
    if (prevIdent) S.idents[key] = prevIdent; else delete S.idents[key];
    if (s) { if (prevTemp) s.temp[key] = prevTemp; else delete s.temp[key]; }
    save(); render();
  });
}

/* Expected branches sheet */
function openExpected() {
  const d = U.draft; const sel = new Set(d.expected);
  const branches = S.units.filter(u => !u.isRO).sort((a, b) => a.name.localeCompare(b.name));
  const ro = S.units.find(u => u.isRO);
  const draw = () => {
    $('#exp-list').innerHTML = branches.map(u => `<label class="setting" style="padding:10px 0"><span class="code">${u.code}</span><div class="grow"><div class="title">${esc(u.name)}</div><div class="sub">${esc((u.category || '').toLowerCase())}${u.isNew ? ' · new' : ''}</div></div><span class="switch"><input type="checkbox" data-exp="${u.code}" ${sel.has(u.code) ? 'checked' : ''}><span></span></span></label>`).join('');
    $('#exp-count').textContent = branches.filter(u => sel.has(u.code)).length + ' selected';
  };
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Who should attend</h3><div class="sub" id="exp-count"></div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <div class="picks">${[['all', 'All branches'], ['URBAN', 'Urban'], ['SEMI-URBAN', 'Semi-urban'], ['RURAL', 'Rural'], ['new', 'New branches'], ['none', 'Clear']].map(([k, l]) => `<button class="pick" data-expq="${k}">${l}</button>`).join('')}</div>
      ${ro ? `<label class="setting" style="padding:4px 0;border-bottom:1px solid var(--line)"><div class="grow"><div class="title">Count RO staff too</div><div class="sub">Treat the Regional Office like a branch</div></div><span class="switch"><input type="checkbox" data-exp="${ro.code}" ${sel.has(ro.code) ? 'checked' : ''}><span></span></span></label>` : ''}
      <div id="exp-list" class="list"></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-primary btn-block" id="exp-done">Done</button></div>`);
  draw();
  const sheet = $('.sheet');
  sheet.addEventListener('change', e => { const c = e.target.dataset.exp; if (!c) return; e.target.checked ? sel.add(+c) : sel.delete(+c); draw(); });
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-expq]'); if (!b) return;
    const k = b.dataset.expq;
    for (const u of branches) sel.delete(u.code);
    if (k !== 'none') for (const u of branches) if (k === 'all' || (k === 'new' ? u.isNew : u.category === k)) sel.add(u.code);
    draw();
  });
  $('#exp-done').onclick = () => {
    d.expected = S.units.map(u => u.code).filter(c => sel.has(c));
    if (S.session && U.sessionDraft && d === U.sessionDraft) { S.session.expected = d.expected; U.draft = null; U.sessionDraft = null; save(); }
    closeSheet(); renderMain();
  };
}

/* Call sheet */
function openCall(code) {
  const u = unitByCode.get(code); const s = S.session;
  const nums = [];
  if (u.mobile) nums.push(['Branch mobile', u.mobile]);
  if (u.phone) nums.push(['Landline', u.phone]);
  const staff = u.staff.slice().sort((a, b) => (b.bm - a.bm) || (b.second - a.second));
  for (const p of staff) if (p.phone) nums.push([pretty(p.name), p.phone, p.bm ? 'Branch Manager' : p.second ? 'Second in command' : p.designation]);
  openSheet(`
    <div class="sheet-head"><span class="code" style="margin-top:3px">${u.code}</span><div class="grow"><h3>${esc(unitLabel(u))}</h3><div class="sub">${callOf(code) ? callChip(code) : 'Not called yet'}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <div class="list card" style="box-shadow:none;border:1px solid var(--line)">${nums.map(([l, n, sub]) => `<div class="item"><div class="grow"><div class="title ellipsis">${esc(l)}</div><div class="sub"><span class="mono">${esc(n)}</span>${sub ? ' · ' + esc(sub) : ''}</div></div><button class="icon-btn" data-act="copy" data-v="${esc(n)}" aria-label="Copy number">${I.copy}</button><a class="call-btn" ${dial(u.code, l, n)}>${I.phone}Call</a></div>`).join('') || '<div class="empty">No numbers saved for this branch. Add them in the Directory.</div>'}</div>
      <div class="flabel">Call status</div>${statusPicker(u.code)}
    </div>`);
}

/* Person editor */
function openPerson(id, unitCode) {
  const isNew = !id;
  const p = isNew ? { id: 'P' + uid(), empId: '', name: '', designation: '', phone: '', bm: false, second: false, dept: '' } : personById.get(id).ref;
  const curUnit = isNew ? (unitCode || S.units[0]?.code) : personById.get(id).unit;
  const links = Object.entries(S.idents).filter(([, v]) => v.to.p === p.id);
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>${isNew ? 'Add person' : esc(pretty(p.name))}</h3>${isNew ? '' : `<div class="sub">Emp ID <span class="mono">${esc(p.empId)}</span></div>`}</div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <form class="sheet-body" id="person-form">
      <div class="field"><label for="p-name">Name</label><input class="input" id="p-name" value="${esc(p.name)}" required></div>
      <div class="field"><label for="p-unit">Branch / office</label><select class="input" id="p-unit">${S.units.slice().sort((a, b) => a.isRO - b.isRO || a.name.localeCompare(b.name)).map(u => `<option value="${u.code}" ${u.code === curUnit ? 'selected' : ''}>${esc(unitLabel(u))} (${u.code})</option>`).join('')}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label for="p-emp">Emp ID</label><input class="input mono" id="p-emp" inputmode="numeric" value="${esc(p.empId)}"></div>
        <div class="field"><label for="p-phone">Mobile</label><input class="input mono" id="p-phone" inputmode="tel" value="${esc(p.phone)}"></div>
      </div>
      <div class="field"><label for="p-desig">Designation</label><input class="input" id="p-desig" value="${esc(p.designation)}"></div>
      <div class="field"><label for="p-dept">Department (RO staff)</label><input class="input" id="p-dept" value="${esc(p.dept)}" placeholder="e.g. RAC / RAVC"></div>
      <label class="setting" style="padding:0"><div class="grow"><div class="title">Branch Manager</div></div><span class="switch"><input type="checkbox" id="p-bm" ${p.bm ? 'checked' : ''}><span></span></span></label>
      <label class="setting" style="padding:0"><div class="grow"><div class="title">Second in command</div></div><span class="switch"><input type="checkbox" id="p-2" ${p.second ? 'checked' : ''}><span></span></span></label>
      ${links.length ? `<div class="flabel">Linked accounts</div><div class="list card" style="box-shadow:none;border:1px solid var(--line)">${links.map(([k, v]) => `<div class="item"><span class="avatar ${k.startsWith('g:') ? 'g' : ''}">${esc(initials(v.name))}</span><div class="grow"><div class="title ellipsis">${esc(v.name)}</div><div class="sub">${k.startsWith('g:') ? 'Google account' : k.startsWith('t:') ? 'Phone' : 'Display name'}</div></div><button type="button" class="icon-btn" data-act="unlink" data-key="${esc(k)}" aria-label="Unlink">${I.x}</button></div>`).join('')}</div>` : ''}
      <div style="display:flex;gap:10px">${isNew ? '' : `<button type="button" class="btn btn-danger" data-act="delete-person" data-id="${esc(p.id)}">${I.trash}Delete</button>`}<button class="btn btn-primary" style="flex:1" type="submit">${isNew ? 'Add person' : 'Save'}</button></div>
    </form>`);
  $('#person-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#p-name').value.trim(); if (!name) return;
    const unit = +$('#p-unit').value;
    const upd = { ...p, name, designation: $('#p-desig').value.trim(), phone: $('#p-phone').value.trim(), dept: $('#p-dept').value.trim(), bm: $('#p-bm').checked, second: $('#p-2').checked, empId: +$('#p-emp').value || '' };
    for (const u of S.units) u.staff = u.staff.filter(x => x.id !== p.id);
    const target = S.units.find(u => u.code === unit);
    if (upd.bm) target.staff.forEach(x => { x.bm = false; });
    if (upd.second) target.staff.forEach(x => { x.second = false; });
    target.staff.push(upd);
    reindex(); markDirty(); save(); closeSheet(); render();
    toast(isNew ? 'Person added' : 'Saved');
  });
}
function openUnitEdit(code) {
  const u = unitByCode.get(code);
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Edit ${esc(unitLabel(u))}</h3><div class="sub mono">${u.code}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <form class="sheet-body" id="unit-form">
      <div class="field"><label for="u-name">Name</label><input class="input" id="u-name" value="${esc(u.name)}" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label for="u-mob">Branch mobile</label><input class="input mono" id="u-mob" inputmode="tel" value="${esc(u.mobile)}"></div>
        <div class="field"><label for="u-ph">Landline</label><input class="input mono" id="u-ph" inputmode="tel" value="${esc(u.phone)}"></div>
      </div>
      <label class="setting" style="padding:0"><div class="grow"><div class="title">Expected in meetings</div><div class="sub">Included when you create a new meeting</div></div><span class="switch"><input type="checkbox" id="u-exp" ${u.expect ? 'checked' : ''}><span></span></span></label>
      <button class="btn btn-primary btn-block" type="submit">Save</button>
    </form>`);
  $('#unit-form').addEventListener('submit', e => {
    e.preventDefault();
    u.name = $('#u-name').value.trim() || u.name; u.mobile = $('#u-mob').value.trim(); u.phone = $('#u-ph').value.trim(); u.expect = $('#u-exp').checked;
    reindex(); markDirty(); save(); closeSheet(); render(); toast('Saved');
  });
}

/* Session menu */
function openSessionMenu() {
  const s = S.session;
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Meeting options</h3><div class="sub mono">${esc(s.meetingCode)}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <div class="list card" style="box-shadow:none;border:1px solid var(--line)">
        ${s.source === 'demo' ? '' : `<a class="item tap" href="${esc(s.meetingUri)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">${I.ext.replace('<svg', '<svg style="width:20px;height:20px"')}<div class="grow title">Open in Google Meet</div></a>`}
        <button class="item tap" data-act="edit-expected">${I.sliders.replace('<svg', '<svg style="width:20px;height:20px"')}<div class="grow"><div class="title">Change who should attend</div><div class="sub">${s.expected.length} offices expected</div></div></button>
        <button class="item tap" data-act="edit-details">${I.edit.replace('<svg', '<svg style="width:20px;height:20px"')}<div class="grow"><div class="title">Edit time, agenda, headed by</div></div></button>
        <button class="item tap" data-act="attendance-image">${I.share.replace('<svg', '<svg style="width:20px;height:20px"')}<div class="grow"><div class="title">Share attendance image</div><div class="sub">Who joined, who left, who is missing, and for how long</div></div></button>
      </div>
      <button class="btn btn-danger btn-block" data-act="end-session">${I.stop}Close this session</button>
      <p class="hint" style="margin:0;text-align:center">Closing clears this board. Your tags stay saved.</p>
    </div>`);
}
function openDetailsEdit() {
  const d = S.session.details;
  openSheet(`
    <div class="sheet-head"><h3 class="grow">Meeting details</h3><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <form class="sheet-body" id="det-form">
      <div class="field"><label for="d-when">Time of VC</label><input class="input" type="datetime-local" id="d-when" value="${esc(d.when ? toLocalInput(new Date(d.when)) : '')}"></div>
      <div class="field"><label for="d-agenda">Agenda</label><textarea class="input" id="d-agenda" rows="2">${esc(d.agenda)}</textarea></div>
      <div class="field"><label for="d-head">Headed by</label><input class="input" id="d-head" value="${esc(d.headedBy)}"></div>
      <button class="btn btn-primary btn-block" type="submit">Save</button>
    </form>`);
  $('#det-form').addEventListener('submit', e => {
    e.preventDefault();
    const w = $('#d-when').value;
    S.session.details = { when: w ? new Date(w).toISOString() : '', agenda: $('#d-agenda').value.trim(), headedBy: $('#d-head').value.trim() };
    U.shareText = null; save(); closeSheet(); render(); toast('Details updated');
  });
}
function openAttach() {
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Track an existing meeting</h3><div class="sub">For a Meet link you created in Calendar or the Meet app</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <form class="sheet-body" id="att-form">
      <div class="field"><label for="a-link">Meet link or code</label><input class="input mono" id="a-link" placeholder="meet.google.com/abc-mnop-xyz" required autocapitalize="off" spellcheck="false"></div>
      <div class="field"><label for="a-agenda">Agenda <span class="faint">(optional)</span></label><input class="input" id="a-agenda"></div>
      <div class="banner info">${I.info}<div>You need to be the meeting's owner, or have created it from the same Google account, for Google to share who joined.</div></div>
      <button class="btn btn-primary btn-block" type="submit" id="att-go">${I.link}Start tracking</button>
    </form>`);
  $('#att-form').addEventListener('submit', async e => {
    e.preventDefault();
    const code = parseCode($('#a-link').value);
    if (!code) { toast('That doesn\'t look like a Meet link. It should contain a code like abc-mnop-xyz.'); return; }
    const btn = $('#att-go'); btn.disabled = true; btn.textContent = 'Connecting…';
    try {
      const space = await G.call('spaces/' + code, { interactive: true });
      S.session = newSession({ source: 'google', attached: true, spaceName: space.name, meetingUri: space.meetingUri, meetingCode: space.meetingCode || code, details: { when: '', agenda: $('#a-agenda').value.trim(), headedBy: '' } });
      save(); closeSheet(); U.boardTab = 'miss'; setTab('meet'); syncNow();
    } catch (err) {
      btn.disabled = false; btn.innerHTML = I.link + 'Start tracking';
      toast(err.code === 404 || err.code === 403 ? 'Google could not find that meeting under your account.' : err.message);
    }
  });
}

/* ───────────────────────── actions ───────────────────────── */
async function doCreate() {
  const d = U.draft;
  const when = d.when ? new Date(d.when).toISOString() : '';
  const details = { when, agenda: d.agenda.trim(), headedBy: d.headedBy.trim() };
  if (details.agenda) S.recentAgendas = [details.agenda, ...(S.recentAgendas || []).filter(a => a !== details.agenda)].slice(0, 8);
  if (S.session && !(await confirmSheet('Replace the current board?', 'Starting a new meeting closes the board for <b>' + esc(S.session.meetingCode) + '</b>. Your tags stay saved.', 'Start new meeting'))) return;
  if (d.demo) {
    S.session = startDemo(details, d.expected);
    save(); U.draft = null; leaveRoute(); U.boardTab = 'miss'; U.shareText = null; render(); syncNow(); return;
  }
  if (!S.settings.clientId) { toast('Add your Google Client ID in Settings first.'); return; }
  const btn = $('#create-btn'); btn.disabled = true; btn.textContent = 'Creating…';
  try {
    S.settings.controls = { ...d.controls };
    const { space, note } = await googleCreate(d.controls);
    S.session = newSession({ source: 'google', spaceName: space.name, meetingUri: space.meetingUri, meetingCode: space.meetingCode, details, expected: d.expected, controlsNote: note });
    save(); U.draft = null; U.shareText = null; U.boardTab = 'miss';
    go({ name: 'share' });
    scheduleSync(8000);
  } catch (e) {
    btn.disabled = false; btn.innerHTML = I.plus + 'Create meeting';
    toast(e.message);
  }
}
function copyText(t, msg = 'Copied') {
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(msg); } catch (e) { toast('Copy failed. Select the text and copy it.'); } ta.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast(msg), fallback); else fallback();
}
function summaryText() {
  const s = S.session, b = board();
  const L = ['*VC attendance – RO Udaipur*'];
  if (s.details.agenda) L.push(s.details.agenda);
  if (s.details.when) L.push(fmtWhen(s.details.when));
  L.push(`${b.joined}/${b.total} branches joined`, '');
  const nm = r => `${unitLabel(r.u)} (${r.u.code})`;
  if (b.rows.in.length) L.push('✅ In meeting: ' + b.rows.in.filter(r => !r.u.isRO).map(nm).join(', '));
  if (b.rows.left.length) L.push('🟡 Joined & left: ' + b.rows.left.filter(r => !r.u.isRO).map(nm).join(', '));
  if (b.rows.miss.length) L.push('❌ Not joined: ' + b.rows.miss.map(nm).join(', '));
  return L.join('\n');
}
/* ───────────────────────── attendance image ───────────────────────── */
const fmtDur = ms => { const m = Math.round(Math.max(0, ms) / 60000); if (!ms) return '–'; if (m < 1) return '<1m'; const h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
const fmtClock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?(AM|PM)/i, m => m.toLowerCase());
const EMB = { img: null };
function loadEmblem() { return new Promise(res => { if (EMB.img) return res(EMB.img); const i = new Image(); i.onload = () => { EMB.img = i; res(i); }; i.onerror = () => res(null); i.src = 'cbi-emblem.png'; }); }
function drawAttendance() {
  const s = S.session, b = board(), T = now();
  const stay = p => { const a = p.first ? Date.parse(p.first) : 0; if (!a) return 0; const z = p.active ? T : (p.lastEnd ? Date.parse(p.lastEnd) : T); return Math.max(0, z - a); };
  const who = x => x.t && x.t.p ? pretty((personById.get(x.t.p) || {}).name || x.p.name) : x.p.name;
  const rowOf = r => ({ name: unitLabel(r.u), code: r.u.code, people: [...new Set(r.list.map(who))].join(', '), dur: Math.max(0, ...r.list.map(x => stay(x.p))), lastLeft: r.active.length ? 0 : r.lastLeft, now: r.active.length > 0 });
  const inRows = b.rows.in.map(rowOf), leftRows = b.rows.left.map(rowOf);
  const others = b.untagged.map(p => ({ name: p.name, code: '', people: 'Not linked to a branch', dur: stay(p), lastLeft: p.active ? 0 : (p.lastEnd ? Date.parse(p.lastEnd) : 0), now: p.active }));
  const miss = b.rows.miss.map(r => ({ name: unitLabel(r.u), code: r.u.code }));
  const all = Object.values(s.parts);
  const starts = all.map(p => p.first && Date.parse(p.first)).filter(Boolean);
  const ends = all.map(p => p.active ? T : (p.lastEnd && Date.parse(p.lastEnd))).filter(Boolean);
  const t0 = starts.length ? Math.min(...starts) : 0, t1 = ends.length ? Math.max(...ends) : 0;
  const live = all.some(p => p.active);
  const BR = { g: ['#0B4A8F', '#146CC0'], acc: '#146CC0', soft: '#E1EEFA' };
  const showEmblem = !!EMB.img;
  const P = { bg: '#F3F5F8', ink: '#142033', muted: '#5B6B80', faint: '#8A97A8', line: '#DCE2EA', card: '#FFFFFF', acc: BR.acc, in: '#12805C', inS: '#DDF3EA', left: '#A86A0F', leftS: '#FBEFD9', miss: '#C2412D', missS: '#FBE4DF' };
  const W = 1080, pad = 44, FONT = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  const paint = c => {
    const font = (w, sz) => { c.font = `${w} ${sz}px ${FONT}`; };
    const txt = (t, x, y, o = {}) => {
      const { w = 400, sz = 28, col = P.ink, al = 'left', max } = o;
      font(w, sz); c.fillStyle = col; c.textAlign = al; c.textBaseline = 'alphabetic';
      let out = String(t);
      if (max) { while (out.length > 1 && c.measureText(out).width > max) out = out.slice(0, -1); if (out !== String(t)) out = out.trimEnd() + '…'; }
      c.fillText(out, x, y);
    };
    const path = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    const fillRR = (x, y, w, h, r, fill) => { path(x, y, w, h, r); c.fillStyle = fill; c.fill(); };
    const card = (x, y, w, h, bar) => {
      fillRR(x, y, w, h, 18, P.card); path(x, y, w, h, 18); c.strokeStyle = P.line; c.lineWidth = 1.5; c.stroke();
      if (bar) { c.save(); path(x, y, w, h, 18); c.clip(); c.fillStyle = bar; c.fillRect(x, y, 10, h); c.restore(); }
    };
    const wrap = (t, max, w, sz, lines) => {
      font(w, sz); const out = []; let cur = '';
      for (const wd of String(t).split(/\s+/)) { const tr = cur ? cur + ' ' + wd : wd; if (c.measureText(tr).width > max && cur) { out.push(cur); cur = wd; } else cur = tr; }
      if (cur) out.push(cur);
      if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
      return out;
    };
    c.fillStyle = P.bg; c.fillRect(0, 0, W, c.canvas.height);

    /* header */
    const ag = s.details.agenda ? wrap(s.details.agenda, W - 2 * pad, 500, 30, 2) : [];
    const meta = [];
    const l1 = [s.details.when ? fmtWhen(s.details.when) : '', s.details.headedBy ? 'Headed by ' + s.details.headedBy : ''].filter(Boolean).join('  ·  ');
    if (l1) meta.push(l1);
    if (t0) meta.push(`In meeting ${fmtClock(t0)} – ${live ? 'now' : fmtClock(t1)}  ·  ${fmtDur(t1 - t0)}${live ? ' so far' : ''}`);
    const headH = 36 + 20 + 14 + 52 + (ag.length ? 8 + ag.length * 38 : 0) + 10 + meta.length * 36 + 26;
    const g = c.createLinearGradient(0, 0, W, headH); g.addColorStop(0, BR.g[0]); g.addColorStop(1, BR.g[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, headH);
    if (showEmblem) { fillRR(W - pad - 96, 30, 96, 96, 22, '#FFFFFF'); const ih = 70 * EMB.img.height / EMB.img.width; c.drawImage(EMB.img, W - pad - 96 + 13, 30 + 48 - ih / 2, 70, ih); }
    let y = 36 + 20;
    c.letterSpacing = '3px'; txt('RO UDAIPUR  ·  CENTRAL BANK OF INDIA', pad, y, { w: 600, sz: 19, col: 'rgba(255,255,255,.72)' }); c.letterSpacing = '0px';
    y += 14 + 52; txt('VC Attendance', pad, y, { w: 700, sz: 52, col: '#FFFFFF' });
    if (ag.length) { y += 8; for (const l of ag) { y += 38; txt(l, pad, y - 8, { w: 500, sz: 30, col: 'rgba(255,255,255,.92)' }); } }
    y += 10;
    for (const m of meta) { y += 36; txt(m, pad, y - 9, { w: 500, sz: 25, col: 'rgba(255,255,255,.8)', max: W - 2 * pad }); }
    y = headH + 22;

    /* totals */
    const pct = b.total ? Math.round(100 * b.joined / b.total) : 0;
    const cardH = 176;
    card(pad, y, W - 2 * pad, cardH);
    txt(`${b.joined}/${b.total}`, pad + 28, y + 62, { w: 700, sz: 54 });
    txt('branches joined', pad + 28 + 8 + (c.measureText(`${b.joined}/${b.total}`).width), y + 60, { w: 500, sz: 25, col: P.muted });
    txt(pct + '%', W - pad - 28, y + 62, { w: 700, sz: 54, col: P.acc, al: 'right' });
    fillRR(pad + 28, y + 82, W - 2 * pad - 56, 14, 7, P.line);
    if (pct) fillRR(pad + 28, y + 82, Math.max(14, (W - 2 * pad - 56) * pct / 100), 14, 7, P.in);
    const tl = [['In meeting', b.inCount, P.in], ['Joined & left', b.leftCount, P.left], ['Not joined', b.missCount, P.miss]];
    const colW = (W - 2 * pad - 56) / 3;
    tl.forEach(([lab, n, col], i) => { const x = pad + 28 + i * colW; txt(n, x, y + 146, { w: 700, sz: 38, col }); const nw = c.measureText(String(n)).width; txt(lab, x + nw + 10, y + 145, { w: 500, sz: 22, col: P.muted }); });
    y += cardH + 26;

    /* sections */
    const head = (title, n, col, soft) => {
      fillRR(pad, y + 6, 14, 14, 7, col);
      txt(title, pad + 28, y + 24, { w: 700, sz: 28, col: P.ink });
      fillRR(W - pad - 64, y - 2, 64, 36, 18, soft); txt(n, W - pad - 32, y + 25, { w: 700, sz: 22, col, al: 'center' });
      y += 52;
    };
    const GAP = 12, cw = (W - 2 * pad - GAP) / 2, RH = 80;
    const rows = (list, col) => {
      list.forEach((r, i) => {
        const x = pad + (i % 2) * (cw + GAP), yy = y + Math.floor(i / 2) * (RH + GAP);
        card(x, yy, cw, RH, col);
        const rightW = 112;
        txt(r.name, x + 26, yy + 34, { w: 600, sz: 27, max: cw - 26 - rightW });
        txt((r.code ? r.code + ' · ' : '') + (r.people || ''), x + 26, yy + 63, { w: 400, sz: 20, col: P.muted, max: cw - 26 - rightW });
        txt(fmtDur(r.dur), x + cw - 18, yy + 34, { w: 700, sz: 28, col, al: 'right' });
        txt(r.now ? 'in meeting' : r.lastLeft ? 'left ' + fmtClock(r.lastLeft) : '', x + cw - 18, yy + 63, { w: 500, sz: 19, col: P.muted, al: 'right' });
      });
      y += Math.ceil(list.length / 2) * (RH + GAP) + 8;
    };
    if (inRows.length) { head('In meeting', inRows.length, P.in, P.inS); rows(inRows, P.in); }
    if (leftRows.length) { head('Joined & left', leftRows.length, P.left, P.leftS); rows(leftRows, P.left); }
    if (others.length) { head('Not linked to a branch', others.length, P.acc, BR.soft); rows(others, P.acc); }
    if (miss.length) {
      head('Not joined', miss.length, P.miss, P.missS);
      const cw3 = (W - 2 * pad - 2 * 10) / 3;
      miss.forEach((m, i) => {
        const x = pad + (i % 3) * (cw3 + 10), yy = y + Math.floor(i / 3) * 56;
        fillRR(x, yy, cw3, 46, 12, P.missS);
        txt(m.name, x + 16, yy + 30, { w: 600, sz: 23, col: P.ink, max: cw3 - 32 - 56 });
        txt(m.code, x + cw3 - 14, yy + 30, { w: 500, sz: 19, col: P.miss, al: 'right' });
      });
      y += Math.ceil(miss.length / 3) * 56 + 8;
    }
    if (!inRows.length && !leftRows.length && !others.length && !miss.length) { txt('Nobody has joined yet.', pad, y + 40, { sz: 30, col: P.muted }); y += 80; }

    /* footer */
    y += 4; c.fillStyle = P.line; c.fillRect(pad, y, W - 2 * pad, 2); y += 34;
    txt(`Generated ${new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}  ·  Hazri  ·  via PDUDAIRO`, W / 2, y, { sz: 22, col: P.faint, al: 'center' });
    y += 30; txt('Time = first join to last leave', W / 2, y, { sz: 20, col: P.faint, al: 'center' });
    return y + 32;
  };
  const cv = document.createElement('canvas'); cv.width = W; cv.height = 300;
  const H = paint(cv.getContext('2d'));
  cv.height = H;
  paint(cv.getContext('2d'));
  return cv;
}
async function openAttendanceImage() {
  if (!S.session) return;
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Attendance image</h3><div class="sub">Share it on WhatsApp or save it</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body" id="ai-body"><p class="muted" style="margin:0">Preparing…</p></div>`);
  try { await Promise.race([document.fonts.load('600 30px "IBM Plex Sans"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  let blob;
  await loadEmblem();
  try { blob = await new Promise((res, rej) => drawAttendance().toBlob(b => b ? res(b) : rej(new Error('no image')), 'image/png')); }
  catch (e) { const bd = $('#ai-body'); if (bd) bd.innerHTML = `<div class="banner err">${I.alert}<div>Could not make the image on this phone. Use Copy as text instead.</div></div><button class="btn btn-soft btn-block" data-act="copy-summary">${I.copy}Copy as text</button>`; return; }
  const bd = $('#ai-body'); if (!bd) return;
  const name = `vc-attendance-${new Date().toISOString().slice(0, 10)}.png`;
  let file = null; try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
  const url = URL.createObjectURL(blob);
  const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  bd.innerHTML = `
    <div class="share-grid">
      <button class="btn btn-primary" id="ai-share" ${canShare ? '' : 'disabled'}>${I.share}Share…</button>
      <button class="btn btn-soft" id="ai-dl">${I.down}Save image</button>
    </div>
    <button class="btn btn-ghost btn-block" data-act="copy-summary">${I.copy}Copy as text instead</button>
    <img src="${url}" alt="Attendance summary" style="width:100%;border-radius:14px;border:1px solid var(--line);display:block">`;
  $('#ai-share').onclick = () => navigator.share({ files: [file], title: 'VC attendance' }).catch(() => {});
  $('#ai-dl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Image saved'); };
}
function exportData(kind) {
  const date = new Date().toISOString().slice(0, 10);
  const data = kind === 'map'
    ? { kind: 'rollcall-mappings', v: 1, exported: new Date().toISOString(), idents: S.idents }
    : { kind: 'rollcall-backup', v: 1, exported: new Date().toISOString(), units: S.units, idents: S.idents, settings: { ...S.settings, signedIn: false }, recentAgendas: S.recentAgendas };
  const name = `roll-call-${kind === 'map' ? 'mappings' : 'backup'}-${date}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const finish = () => { S.backup = { at: now(), dirty: 0 }; save(); render(); };
  let file = null; try { file = new File([blob], name, { type: 'application/json' }); } catch (e) {}
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Save ${kind === 'map' ? 'mappings' : 'backup'}</h3><div class="sub mono">${esc(name)}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <p class="muted" style="margin:0">${kind === 'map' ? Object.keys(S.idents).length + ' linked accounts.' : 'Branches, staff, ' + Object.keys(S.idents).length + ' linked accounts and settings.'} Keep it somewhere safe, like your Drive or a WhatsApp chat with yourself.</p>
      <div class="share-grid">
        <button class="btn btn-primary" id="ex-dl">${I.down}Download</button>
        <button class="btn btn-soft" id="ex-share" ${file && navigator.canShare && navigator.canShare({ files: [file] }) ? '' : 'disabled'}>${I.share}Send to…</button>
      </div>
    </div>`);
  $('#ex-dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); closeSheet(); finish(); toast('Backup downloaded'); };
  $('#ex-share').onclick = () => navigator.share({ files: [file], title: name }).then(() => { closeSheet(); finish(); toast('Backup sent'); }).catch(() => {});
}
function staffDiff(oldUnits, newUnits) {
  const where = us => { const m = new Map(); us.forEach(u => u.staff.forEach(p => m.set(String(p.empId), { name: p.name, unit: u.name }))); return m; };
  const a = where(oldUnits), b = where(newUnits);
  let added = 0, left = 0, moved = 0;
  b.forEach((v, k) => { if (!a.has(k)) added++; else if (a.get(k).unit !== v.unit) moved++; });
  a.forEach((v, k) => { if (!b.has(k)) left++; });
  return { added, left, moved };
}
function pickImport(kind) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,.js,application/json,text/javascript';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const text = await f.text();
    try {
      if (kind === 'staff' && !/UDAIRO_DATA/.test(text)) { toast('That is not the staff list file. Please pick udairo.js.'); return; }
      if (/UDAIRO_DATA/.test(text)) {
        const D = new Function(text + ';return UDAIRO_DATA;')();
        const units = unitsFromUdairo(D);
        const nStaff = units.reduce((a, u) => a + u.staff.length, 0);
        if (!units.length) throw new Error();
        let chg = '';
        if (S.units.length) {
          const d = staffDiff(S.units, units);
          const bits = [d.added && `<b>${d.added}</b> new`, d.moved && `<b>${d.moved}</b> moved to another office`, d.left && `<b>${d.left}</b> no longer listed`].filter(Boolean);
          chg = bits.length ? ` Changes: ${bits.join(', ')}.` : ' No staff changes found.';
        }
        if (S.units.length && !(await confirmSheet('Update the staff list?', `Load <b>${units.length}</b> offices and <b>${nStaff}</b> staff from ${esc(f.name)}.${chg} Tags stay with each person because they follow the emp ID. Edits you made in the app's directory are replaced.`, 'Update staff list'))) return;
        const keep = new Map(S.units.map(u => [u.code, u.expect]));
        units.forEach(u => { if (keep.has(u.code)) u.expect = keep.get(u.code); });
        S.units = units; S.staffAt = now(); reindex(); markDirty(); save(); render(); toast(`Staff list updated: ${units.length} offices, ${nStaff} staff`);
        return;
      }
      const j = JSON.parse(text);
      if (j.kind === 'rollcall-mappings') {
        const n = Object.keys(j.idents || {}).length;
        if (!(await confirmSheet('Import mappings?', `Add <b>${n}</b> linked accounts. Accounts you already have are updated.`, 'Import'))) return;
        Object.assign(S.idents, j.idents); save(); render(); toast(n + ' mappings imported');
      } else if (j.kind === 'rollcall-backup') {
        if (!(await confirmSheet('Restore this backup?', `This replaces the directory, linked accounts and settings on this phone with the backup from ${esc(new Date(j.exported).toLocaleString('en-IN'))}.`, 'Restore', true))) return;
        S.units = j.units || S.units; S.idents = j.idents || {}; S.settings = { ...S.settings, ...j.settings, signedIn: S.settings.signedIn }; S.recentAgendas = j.recentAgendas || [];
        delete S.settings.theme;
        S.backup = { at: now(), dirty: 0 }; reindex(); save(); render(); toast('Backup restored');
      } else throw new Error();
    } catch (e) { toast(kind === 'staff' ? 'Could not read that staff list file.' : 'That file isn\'t a Hazri backup or mappings file.'); }
  };
  inp.click();
}

const ACT = {
  tab: el => setTab(el.dataset.tab),
  back: () => { const wasShare = U.route && U.route.name === 'share'; leaveRoute(); if (!wasShare) U.draft = null; render(); restoreScroll(); },
  'sheet-close': () => closeSheet(),
  'open-create': el => { U.draft = draftDefault(el.dataset.demo === '1'); go({ name: 'create' }); },
  'open-attach': () => { if (!S.settings.clientId) { toast('Add your Google Client ID in Settings first.'); return; } openAttach(); },
  'draft-set': el => { U.draft.controls[el.dataset.k] = el.dataset.v; renderMain(); },
  'draft-pick': el => { U.draft[el.dataset.k] = el.dataset.v; renderMain(); },
  'pick-expected': () => openExpected(),
  create: () => doCreate(),
  'share-native': () => { const t = U.shareText; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else copyText(t, 'Message copied. Paste it in any app.'); },
  'copy-share': () => copyText(U.shareText, 'Message copied'),
  'to-board': () => { leaveRoute(); U.tab = 'meet'; render(); window.scrollTo(0, 0); },
  'go-share': () => { U.shareText = null; go({ name: 'share' }); },
  'board-tab': el => { U.boardTab = el.dataset.k; renderMain(); },
  sync: () => { if (!S.session) return; S.session.error = null; syncNow(); },
  reconnect: async () => { try { await G.getToken(true); S.session && (S.session.error = null); syncNow(); } catch (e) { toast(e.message); } },
  tag: el => openTag(el.dataset.key, el.dataset.mode),
  assign: el => {
    const sh = $('.sheet'); const key = sh.dataset.key;
    const t = el.dataset.u != null ? { u: +el.dataset.u } : { p: el.dataset.p };
    const rem = $('#tag-remember'); assign(key, t, sh.dataset.mode === 'relink' || !S.session ? true : rem ? rem.checked : true);
  },
  untag: () => {
    const key = $('.sheet').dataset.key; const prev = S.idents[key]; const prevT = S.session && S.session.temp[key];
    delete S.idents[key]; if (S.session) delete S.session.temp[key]; markDirty(); save(); closeSheet(); render();
    toast('Tag removed', () => { if (prev) S.idents[key] = prev; if (prevT) S.session.temp[key] = prevT; save(); render(); });
  },
  ignore: () => { const key = $('.sheet').dataset.key; const s = S.session; if (s.ignored[key]) delete s.ignored[key]; else s.ignored[key] = true; save(); closeSheet(); render(); },
  'call-sheet': el => openCall(+el.dataset.code),
  'call-status': el => {
    const code = +el.dataset.code, status = el.dataset.status;
    const pc = S.pendingCall && S.pendingCall.code === code ? S.pendingCall : {};
    const inFeedback = !!(S.pendingCall && S.pendingCall.code === code);
    const { prev, label } = setCallStatus(code, status, { who: pc.who, num: pc.num, keepTime: !inFeedback && !!callOf(code) });
    if ($('#layer .sheet') && (inFeedback || !U.route)) closeSheet(); 
    renderMain();
    if (status === 'clear') toast(label + ': call status cleared', () => { if (prev) S.calls[code] = prev; save(); renderMain(); });
    else toast(`${label}: ${CALL_STATUS[status].label}`, () => { if (prev) S.calls[code] = prev; else delete S.calls[code]; save(); renderMain(); });
  },
  'reset-calls': async () => { if (await confirmSheet('Start a new calling round?', 'All call statuses (informed, recall later, no answer, denied) are cleared so you can start fresh before the next VC.', 'Clear statuses', true)) { S.calls = {}; S.pendingCall = null; save(); renderMain(); toast('Call statuses cleared'); } },
  copy: el => copyText(el.dataset.v, 'Number copied'),
  'session-menu': () => openSessionMenu(),
  'edit-expected': () => { closeSheet(true); U.draft = { expected: S.session.expected.slice() }; U.sessionDraft = U.draft; openExpected(); },
  'edit-details': () => { closeSheet(true); openDetailsEdit(); },
  'import-staff': () => pickImport('staff'),
  'arc-tap': () => arcTap(),
  'check-update': () => checkUpdate(true),
  'apply-update': () => applyUpdate(),
  'attendance-image': () => { closeSheet(true); openAttendanceImage(); },
  'copy-summary': () => { copyText(summaryText(), 'Attendance summary copied'); closeSheet(); },
  'end-session': async () => { closeSheet(true); if (await confirmSheet('Close this session?', 'The board for <b>' + esc(S.session.meetingCode) + '</b> will be cleared. Tags you saved stay on this phone.', 'Close session', true)) { clearTimeout(syncTimer); S.session = null; save(); render(); } },
  'dir-filter': el => { U.dirFilter = el.dataset.k; renderMain(); },
  'open-unit': el => go({ name: 'unit', code: +el.dataset.code }),
  'edit-unit': el => openUnitEdit(+el.dataset.code),
  'edit-person': el => openPerson(el.dataset.id),
  'add-person': el => openPerson(null, el.dataset.code ? +el.dataset.code : (U.dirFilter === 'ro' ? S.units.find(u => u.isRO)?.code : undefined)),
  'delete-person': async el => {
    const id = el.dataset.id; const p = personById.get(id); closeSheet(true);
    if (!(await confirmSheet('Delete ' + pretty(p.name) + '?', 'They will be removed from the directory and any linked accounts will be untagged.', 'Delete', true))) return;
    for (const u of S.units) u.staff = u.staff.filter(x => x.id !== id);
    for (const k in S.idents) if (S.idents[k].to.p === id) delete S.idents[k];
    reindex(); markDirty(); save(); render(); toast('Deleted');
  },
  unlink: el => { const k = el.dataset.key; delete S.idents[k]; markDirty(); save(); el.closest('.item').remove(); render(); toast('Account unlinked'); },
  signin: async () => { try { await G.getToken(true); toast('Google connected'); render(); } catch (e) { toast(e.message); } },
  signout: () => { G.signOut(); render(); toast('Disconnected from Google'); },
  persist: () => requestPersist(false),
  export: el => exportData(el.dataset.kind),
  import: () => pickImport(),
  'clear-maps': async () => { if (await confirmSheet('Clear all linked accounts?', 'Every saved tag will be removed. Export your mappings first if you may need them.', 'Clear all', true)) { S.idents = {}; markDirty(); save(); render(); toast('All tags cleared'); } },
  'reset-dir': async () => { if (await confirmSheet('Reset the directory?', 'Branches and staff go back to the built-in list. Edits and added people are lost; tags on existing staff stay.', 'Reset', true)) { S.units = unitsFromSource(window.SEED_DATA); reindex(); save(); render(); toast('Directory reset'); } }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (a === 'dial') { startCall(el); return; } // let the phone dialer open
  if (el.tagName === 'A' && !el.getAttribute('href')?.startsWith('#')) return;
  e.preventDefault();
  ACT[a] && ACT[a](el, e);
});
$$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.draft && U.draft) U.draft[t.dataset.draft] = t.value;
  if (t.id === 'share-text') { U.shareText = t.value; const wa = $('#wa-link'); if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(t.value); }
  if (t.id === 'dir-q') { U.dirQ = t.value; $('#dir-list').innerHTML = dirList(); }
  if (t.dataset.setting === 'clientId') { S.settings.clientId = cleanClientId(t.value) || t.value.trim(); save(); const b = $('[data-act="signin"]'); if (b) b.disabled = !S.settings.clientId; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ctrl && U.draft) { U.draft.controls[t.dataset.ctrl] = t.checked; renderMain(); }
  if (t.dataset.setting === 'poll') { S.settings.poll = +t.value; save(); scheduleSync(); }
  if (t.dataset.setting === 'keepAwake') { S.settings.keepAwake = t.checked; save(); manageWake(); }
});
document.addEventListener('submit', e => { if (e.target.id === 'create-form') { e.preventDefault(); doCreate(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ───────────────────────── swipe between tabs ───────────────────────── */
function swipeTabs(dir) {
  if (U.tab === 'dir') {
    const order = ['branches', 'ro', 'linked']; const i = order.indexOf(U.dirFilter) + dir;
    if (i < 0 || i >= order.length) return;
    U.dirFilter = order[i];
  } else {
    const order = ['miss', 'left', 'in', 'people']; const i = order.indexOf(U.boardTab) + dir;
    if (i < 0 || i >= order.length) return;
    U.boardTab = order[i];
  }
  U.slide = dir; renderMain();
}
(() => {
  let x0 = 0, y0 = 0, t0 = 0, ok = false;
  const main = $('#main');
  main.addEventListener('touchstart', e => {
    const t = e.touches[0];
    ok = e.touches.length === 1 && !U.route && (U.tab === 'dir' || (U.tab === 'meet' && !!S.session)) && !e.target.closest('.picks,.untagged-list,input,textarea,select');
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  }, { passive: true });
  main.addEventListener('touchend', e => {
    if (!ok) return; ok = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t0 > 700) return;
    swipeTabs(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

/* Pull to refresh on the Meeting tab: runs the board's own refresh (no page reload),
   so the heartbeat line and scroll position carry on. The browser's own pull-to-refresh is off. */
(() => {
  const el = document.createElement('div'); el.id = 'ptr'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<img src="cbi-emblem.png" alt="">'; document.body.appendChild(el);
  const MAX = 110, ARM = 64;
  let y0 = 0, x0 = 0, pulling = false, armed = false, busy = false, d = 0;
  const can = () => U.tab === 'meet' && !U.route && !!S.session && !busy && !$('#layer .sheet') && (window.scrollY || document.documentElement.scrollTop) <= 0;
  const place = (shown, spin) => {
    const top = $('#top').getBoundingClientRect().bottom;
    el.style.top = (top - 44) + 'px';
    el.style.transform = `translateY(${shown}px) rotate(${spin}deg) scale(${armed ? 1.08 : 1})`;
    el.style.opacity = Math.min(1, shown / 40);
  };
  const reset = () => { el.classList.remove('spin'); el.style.transition = 'transform .25s ease, opacity .25s ease'; place(0, 0); el.style.opacity = 0; setTimeout(() => { el.style.transition = ''; }, 260); };
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !can()) { pulling = false; return; }
    const t = e.touches[0]; y0 = t.clientY; x0 = t.clientX; pulling = true; armed = false; d = 0;
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!pulling) return;
    const t = e.touches[0], dy = t.clientY - y0, dx = t.clientX - x0;
    if (d === 0 && (dy <= 0 || Math.abs(dx) > dy)) { pulling = false; return; }  // not a downward pull
    d = Math.max(0, dy);
    const shown = Math.min(MAX, d * .5);
    const was = armed; armed = shown >= ARM;
    if (armed && !was) { try { navigator.vibrate && navigator.vibrate(10); } catch (err) {} }
    place(shown, shown * 3);
  }, { passive: true });
  addEventListener('touchend', async () => {
    if (!pulling) return; pulling = false;
    if (!armed) { reset(); return; }
    busy = true; armed = false;
    el.style.transition = 'transform .2s ease'; place(ARM, 0); el.classList.add('spin');
    const t0 = Date.now();
    try { await syncNow(); } catch (err) {}
    while (syncing) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, Math.max(0, 650 - (Date.now() - t0))));
    busy = false; reset();
  }, { passive: true });
})();

/* ───────────────────────── toast, wake lock, timers ───────────────────────── */
let toastTimer = null;
function toast(msg, undo) {
  const t = $('#toast'); $('#toast-msg').textContent = msg;
  const b = $('#toast-act'); b.hidden = !undo;
  b.onclick = () => { undo && undo(); t.classList.remove('show'); };
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), undo ? 5000 : 3000);
}
async function manageWake() {
  const want = S.settings.keepAwake && S.session && !S.session.ended && U.tab === 'meet' && !U.route && !document.hidden;
  try {
    if (want && !U.wake && navigator.wakeLock) { U.wake = await navigator.wakeLock.request('screen'); U.wake.addEventListener('release', () => { U.wake = null; }); }
    else if (!want && U.wake) { await U.wake.release(); U.wake = null; }
  } catch (e) { U.wake = null; }
}
function startCall(el) {
  S.pendingCall = { code: +el.dataset.code, who: el.dataset.who || '', num: el.dataset.num || '', at: now() };
  save(); U.leftForCall = false;
  if ($('#layer .sheet')) closeSheet(true);
  // Phones hide the page when the dialer opens. If that never happens (desktop), ask anyway.
  setTimeout(() => { if (S.pendingCall && !U.leftForCall && !document.hidden) openCallFeedback(); }, 4000);
}
document.addEventListener('visibilitychange', () => {
  manageWake(); ecgSync();
  if (document.hidden) { if (S.pendingCall) U.leftForCall = true; return; }
  if (S.pendingCall && U.leftForCall) { U.leftForCall = false; setTimeout(openCallFeedback, 350); }
  if (S.session && !S.session.ended) syncNow();
});
setInterval(() => { $$('[data-ago]').forEach(el => { el.textContent = ago(+el.dataset.ago || 0); }); }, 5000);

/* ───────────────────────── boot ───────────────────────── */
if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href)) navigator.serviceWorker.register('sw.js').catch(() => {});
checkPersist().then(() => { if (U.tab === 'settings') renderMain(); });
try { history.replaceState({ rc: 'root' }, ''); history.pushState({ rc: 'guard' }, ''); } catch (e) {}
render();
if (S.session && !S.session.ended) syncNow();
if (S.pendingCall) setTimeout(openCallFeedback, 600); // app was reloaded while the call was on
window.__rc = { S, board, suggest };
})();
