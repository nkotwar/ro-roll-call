/* Hazri · meeting.js — The meeting session, the attendance board, call tracking, demo meetings and the sync loop.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

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
    }
    if (Math.random() < 0.5) at++;
  }
  const branchAcct = unitByCode.get(expected[Math.floor(Math.random() * expected.length)]);
  if (branchAcct && !branchAcct.isRO) plan.push({ at: 3, key: 'n:' + normKey('CBI ' + branchAcct.name), name: 'CBI ' + branchAcct.name, kind: 'guest' });
  // A few people drop off part-way (3 to 5), and one of them rejoins later.
  const joins = plan.filter(e => !e.leave && e.key !== 'g:demo-self').sort(() => Math.random() - .5);
  const k = Math.min(joins.length, 3 + Math.floor(Math.random() * 3));
  joins.slice(0, k).forEach((e, i) => {
    const out = e.at + 3 + Math.floor(Math.random() * 6);
    plan.push({ at: out, key: e.key, leave: true });
    if (i === 0) plan.push({ at: out + 4 + Math.floor(Math.random() * 4), key: e.key, name: e.name, kind: e.kind });
  });
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
  const d = delay != null ? delay : pollMs(s);
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

