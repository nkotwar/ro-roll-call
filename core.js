/* Hazri · core.js — Constants, small helpers and icons, the saved data (S) and the name matcher.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

/* ───────────────────────── constants & helpers ───────────────────────── */
const KEY = 'rollcall.v1';
// The live-board page (…/live/#<key>): this device only watches, it never touches saved data.
const VIEWER = /\/live\/(index\.html)?$/.test(location.pathname);
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
    mobile: u.mobile || '', phone: u.phone || '', expect: !(u.isRO || u.category === 'METRO'),
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
Object.keys(S.idents || {}).forEach(k => { if (k.startsWith('g:demo-')) delete S.idents[k]; });
if (!S.metroDefaultFixed) { (S.units || []).forEach(u => { if (u.category === 'METRO') u.expect = false; }); S.metroDefaultFixed = true; }
let saveFailed = false;
function save() {
  if (VIEWER) return;
  try { localStorage.setItem(KEY, JSON.stringify(S)); saveFailed = false; if (typeof livePublishSoon === 'function') livePublishSoon(); }
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
const targetFor = key => { const t = S.session && S.session.temp && S.session.temp[key]; if (t) return t.none ? null : t; return (S.idents[key] && S.idents[key].to) || null; };
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

