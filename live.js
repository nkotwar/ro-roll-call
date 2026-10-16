/* Hazri · live.js — Share the live board with anyone through a link.
   The host phone stays the only one that talks to Google Meet. After every change it posts a small
   snapshot of the board to a free Firebase Realtime Database; anyone holding the link watches it live
   and can join the calling round. Everything is encrypted on the host phone with AES-GCM; the key
   travels only in the link's #fragment, which browsers never send to any server, so Firebase stores
   nothing readable. The board is deleted from Firebase when the meeting ends.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

/* ───────────────────────── relay: Firebase REST + encryption ───────────────────────── */
const LIVE_HOME = 'https://hazri-live-default-rtdb.asia-southeast1.firebasedatabase.app';
// Tests on this computer point at a local stand-in; on any real site the address is fixed.
const LIVE_DB = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('livedb')) || LIVE_HOME;
const LIVE_HB_MS = 20e3;          // host "I'm alive" beat while sharing
const LIVE_STALE_MS = 50e3;       // viewers warn after this long without a beat
const LIVE_CLAIM_MS = 15 * 60e3;  // "X is calling…" turns into "Called" after this
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const liveRand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
async function liveKey(k) { return crypto.subtle.importKey('raw', unb64u(k), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function liveSeal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return 'v1.' + b64u(iv) + '.' + b64u(ct);
}
async function liveOpen(key, str) {
  try {
    const [v, iv, ct] = String(str).split('.'); if (v !== 'v1') return null;
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, key, unb64u(ct))));
  } catch (e) { return null; }   // wrong key or tampered: ignore
}
const livePath = (id, sub = '') => `${LIVE_DB}/live/${id}${sub ? '/' + sub : ''}.json`;
async function liveReq(method, id, sub, body) {
  const r = await fetch(livePath(id, sub), { method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('Live link: ' + r.status);
  return r.status === 204 ? null : r.json().catch(() => null);
}
/* A Firebase streaming listener with a tree kept in sync. Reconnects on its own; if the stream
   can't be held (some networks), falls back to fetching every 6 s. */
function liveListen(id, sub, onTree) {
  let tree, es = null, closed = false, pollT = 0, retryT = 0, fails = 0;
  const setAt = (path, data) => {
    const keys = path.split('/').filter(Boolean);
    if (!keys.length) { tree = data; return; }
    if (tree == null || typeof tree !== 'object') tree = {};
    let o = tree;
    for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {}; o = o[keys[i]]; }
    if (data === null) delete o[keys[keys.length - 1]]; else o[keys[keys.length - 1]] = data;
  };
  const poll = async () => {
    if (closed) return;
    try { tree = await liveReq('GET', id, sub); onTree(tree, true); } catch (e) { onTree(tree, false); }
    pollT = setTimeout(poll, 6000);
  };
  const open = () => {
    if (closed) return;
    try { es = new EventSource(livePath(id, sub)); } catch (e) { poll(); return; }
    const handle = kind => ev => {
      fails = 0;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m) return;
      if (kind === 'put') setAt(m.path, m.data);
      else if (m.data) for (const k in m.data) setAt((m.path === '/' ? '' : m.path) + '/' + k, m.data[k]);
      onTree(tree, true);
    };
    es.addEventListener('put', handle('put'));
    es.addEventListener('patch', handle('patch'));
    es.addEventListener('cancel', () => { es.close(); onTree(null, true); });
    es.onerror = () => {
      if (closed) return;
      onTree(tree, false);
      if (es.readyState === 2) { es.close(); if (++fails >= 3) poll(); else retryT = setTimeout(open, 3000 * fails); }
    };
  };
  open();
  return { close() { closed = true; if (es) es.close(); clearTimeout(pollT); clearTimeout(retryT); }, refresh: async () => { try { tree = await liveReq('GET', id, sub); onTree(tree, true); } catch (e) {} } };
}
const liveName = () => { try { return localStorage.getItem('hazri.name') || ''; } catch (e) { return ''; } };
const liveSetName = n => { try { localStorage.setItem('hazri.name', n); } catch (e) {} };
function askLiveName(why) {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    openSheet(`<div class="sheet-head"><div class="grow"><h3>Your name</h3><div class="sub">${esc(why)}</div></div></div>
      <form class="sheet-body" id="ln-form"><input class="input" id="ln-name" value="${esc(liveName())}" placeholder="e.g. Ramesh, RO" autocomplete="name" maxlength="40" required></form>
      <div class="sheet-foot"><button class="btn btn-ghost" style="flex:1" id="ln-no">Cancel</button><button class="btn btn-primary" style="flex:1" id="ln-ok">Save</button></div>`, { onClose: () => fin('') });
    const ok = () => { const v = $('#ln-name').value.trim().slice(0, 40); if (!v) { $('#ln-name').focus(); return; } liveSetName(v); fin(v); closeSheet(); };
    $('#ln-ok').onclick = ok; $('#ln-form').onsubmit = e => { e.preventDefault(); ok(); }; $('#ln-no').onclick = () => closeSheet();
    setTimeout(() => $('#ln-name')?.focus(), 250);
  });
}
const claimLabel = c => c && c.status === 'calling' && now() - c.at > LIVE_CLAIM_MS ? 'called' : c && c.status;

/* ───────────────────────── host side ───────────────────────── */
const LH = { cur: null, key: null, listener: null, lastJson: '', lastSnap: null, hbT: 0, pubT: 0, remote: {}, watchers: 0, busy: false };
function liveLink(l) {
  const local = LIVE_DB !== LIVE_HOME ? '?livedb=' + encodeURIComponent(LIVE_DB) : '';
  return location.origin + location.pathname.replace(/index\.html$/, '') + local + '#w=' + l.id + '.' + l.key;
}
function liveSnap() {
  const s = S.session, b = board(); if (!s || !b) return null;
  const nums = u => {
    if (u.isRO) return [];
    const out = [];
    if (u.mobile) out.push(['Branch mobile', u.mobile, '']);
    if (u.phone) out.push(['Landline', u.phone, '']);
    for (const p of u.staff.slice().sort((a, c) => (c.bm - a.bm) || (c.second - a.second))) if (p.phone) out.push([pretty(p.name), p.phone, p.bm ? 'Branch Manager' : p.second ? 'Second in command' : p.designation]);
    return out;
  };
  const ppl = list => list.map(x => ({ n: x.t && x.t.p ? pretty(personById.get(x.t.p)?.name || x.p.name) : x.p.name, a: !!x.p.active }));
  const ro = S.units.find(u => u.isRO);
  return {
    v: 1, code: s.meetingCode, demo: s.source === 'demo', when: s.details.when || '', agenda: s.details.agenda || '', head: s.details.headedBy || '',
    region: ro ? ro.name : '', ended: !!s.ended, state: s.state || '',
    total: b.total, joined: b.joined, inCount: b.inCount, leftCount: b.leftCount, missCount: b.missCount,
    miss: b.rows.miss.map(r => ({ c: r.u.code, n: unitLabel(r.u), bm: bmOf(r.u) ? pretty(bmOf(r.u).name) : '', nums: nums(r.u) })),
    left: b.rows.left.map(r => ({ c: r.u.code, n: unitLabel(r.u), t: r.lastLeft, ppl: ppl(r.list), nums: nums(r.u) })),
    in: b.rows.in.map(r => ({ c: r.u.code, n: unitLabel(r.u), x: !r.expected, ppl: ppl(r.list) }))
  };
}
let livePubQ = 0;
function livePublishSoon() { if (VIEWER) return; clearTimeout(livePubQ); livePubQ = setTimeout(liveReconcile, 600); }
async function liveReconcile() {
  if (VIEWER || LH.busy) { if (LH.busy) livePublishSoon(); return; }
  LH.busy = true;
  try {
    const s = S.session, want = s && s.live && !s.ended ? s.live : null;
    if (LH.cur && (!want || want.id !== LH.cur.id)) await liveFinish();
    if (want && !LH.cur) await liveBegin(want);
    if (LH.cur) await livePush();
  } catch (e) { /* offline: the next save or beat tries again */ }
  finally { LH.busy = false; }
}
async function liveBegin(l) {
  LH.cur = l; LH.key = await liveKey(l.key); LH.lastJson = ''; LH.remote = {};
  LH.listener = liveListen(l.id, 'calls', tree => { LH.tree = tree; liveHostCalls(tree); });
  clearInterval(LH.hbT);
  LH.hbT = setInterval(() => {
    if (!LH.cur || document.hidden) return;
    const id = LH.cur.id;
    liveSeal(LH.key, { at: now() }).then(v => liveReq('PUT', id, 'calls/_hb', v)).catch(() => {});
    liveHostCalls(LH.tree);   // recount watchers as old ones go quiet
  }, LIVE_HB_MS);
  // Calls already made in this round go up too, so helpers see them.
  for (const code in S.calls) livePushCall(+code);
}
async function livePush(force) {
  const snap = liveSnap(); if (!snap) return;
  const json = JSON.stringify(snap);
  if (!force && json === LH.lastJson) return;
  LH.lastJson = json; LH.lastSnap = snap;
  await liveReq('PUT', LH.cur.id, 'board', await liveSeal(LH.key, { ...snap, at: now() }));
}
async function liveFinish() {
  const cur = LH.cur, key = LH.key, snap = LH.lastSnap;
  LH.cur = null; LH.key = null; clearInterval(LH.hbT);
  if (LH.listener) { LH.listener.close(); LH.listener = null; }
  if (!cur) return;
  S.liveTrash = [...new Set([...(S.liveTrash || []), cur.id])]; save();
  // Watchers get the final board marked as ended, then the data is removed from Firebase.
  try { if (snap && key) await liveReq('PUT', cur.id, 'board', await liveSeal(key, { ...snap, ended: true, at: now() })); } catch (e) {}
  setTimeout(liveEmptyTrash, 4000);
}
async function liveEmptyTrash() {
  for (const id of (S.liveTrash || []).slice()) {
    if (LH.cur && LH.cur.id === id) continue;
    try { await liveReq('DELETE', id); S.liveTrash = S.liveTrash.filter(x => x !== id); save(); } catch (e) { return; }
  }
}
async function liveHostCalls(tree) {
  if (!LH.key || !tree || typeof tree !== 'object') return;
  let changed = false, watchers = 0;
  for (const k in tree) {
    if (LH.remote[k] === tree[k]) { if (k.startsWith('p_') && LH.remote['@' + k] && now() - LH.remote['@' + k] < 75e3) watchers++; continue; }
    LH.remote[k] = tree[k];
    const v = await liveOpen(LH.key, tree[k]); if (!v) continue;
    if (k.startsWith('p_')) { LH.remote['@' + k] = v.at; if (now() - v.at < 75e3) watchers++; continue; }
    if (k === '_hb') continue;
    const code = +k, mine = S.calls[code];
    if (!code || (mine && mine.at >= v.at)) continue;
    S.calls[code] = { status: v.status, at: v.at, who: v.who || '', num: v.num || '', by: v.by || '' };
    changed = true;
  }
  if (watchers !== LH.watchers) { LH.watchers = watchers; changed = true; }
  if (changed) { save(); if (!$('#layer .sheet')) renderMain(); }
}
async function livePushCall(code) {
  if (!LH.cur || !LH.key) return;
  const c = S.calls[code];
  try {
    if (!c) await liveReq('DELETE', LH.cur.id, 'calls/' + code);
    else await liveReq('PUT', LH.cur.id, 'calls/' + code, await liveSeal(LH.key, { status: c.status, at: c.at, who: c.who || '', num: c.num || '', by: c.by || liveName() || 'Host' }));
  } catch (e) {}
}
async function liveStartShare() {
  const s = S.session; if (!s) return;
  if (!s.live) {
    if (!liveName()) { const n = await askLiveName('Shown to others when you call a branch'); if (!n) return; }
    s.live = { id: liveRand(16), key: liveRand(32), at: now() }; save();
  }
  try { await liveReconcile(); if (!LH.cur) throw new Error(); await livePush(true); }
  catch (e) { toast('Could not reach the live link service. Check the internet and try again.'); return; }
  renderMain(); liveSendLink();
}
function liveShareText() {
  const s = S.session, d = s.details;
  return [`*Live VC attendance – ${S.units.find(u => u.isRO)?.name ? 'RO ' + S.units.find(u => u.isRO).name.replace(/^Regional Office,?\s*/i, '') : 'RO'}*`, d.when ? '🕚 ' + fmtWhen(d.when) : '', 'See who has joined and help call the rest:', liveLink(s.live)].filter(Boolean).join('\n');
}
function liveSendLink() {
  const t = liveShareText();
  if (navigator.share) navigator.share({ text: t }).catch(() => {}); else copyText(t, 'Live link copied. Paste it in WhatsApp.');
}
async function liveStopShare() {
  const s = S.session; if (!s || !s.live) return;
  if (!(await confirmSheet('Stop sharing the live board?', 'The link stops working for everyone who has it. You can share a new link any time.', 'Stop sharing', true))) return;
  delete s.live; save(); await liveReconcile(); renderMain(); toast('Live link stopped');
}
function liveDeskCard() {
  const s = S.session, l = s.live;
  if (!l) return `<section class="card pad m-card">
    <div class="m-head"><div class="grow"><div class="m-title">Live link</div><div class="sub">Anyone you send it to sees this board live and can help call. No sign-in needed.</div></div>
      <button class="mini-btn primary" data-act="live-share">${I.share}Share live</button></div></section>`;
  const w = LH.watchers;
  return `<section class="card pad m-card">
    <div class="m-head"><div class="grow"><div class="m-title"><span class="live-dot"></span>Live link on</div><div class="sub">${w ? `${w} watching now` : 'Nobody watching yet'}</div></div>
      <div class="icon-row">
        <button class="mini-btn wa-solid" data-act="live-send">${I.share}Send</button>
        <button class="round-btn" data-act="live-copy" aria-label="Copy live link">${I.copy}</button>
        <button class="round-btn" data-act="live-stop" aria-label="Stop sharing">${I.stop}</button>
      </div></div></section>`;
}
const liveBadge = () => S.session && S.session.live && !S.session.ended ? `<button class="live-line" data-act="go-share"><span class="live-dot"></span>Live link on · ${LH.watchers ? LH.watchers + ' watching' : 'nobody watching yet'}</button>` : '';

/* ───────────────────────── viewer side ───────────────────────── */
const LV = { id: '', k: '', key: null, snap: null, at: 0, hb: 0, calls: {}, rawCalls: {}, gone: false, bad: false, online: true, tab: 'miss', pending: null, vid: '', presT: 0, listener: null, loaded: false };
function liveBoot() {
  document.documentElement.classList.add('viewer');
  const m = location.hash.match(/^#w=([\w-]{22})\.([\w-]{43})$/);
  LV.id = m[1]; LV.k = m[2];
  try { LV.vid = sessionStorage.getItem('hazri.vid') || liveRand(9); sessionStorage.setItem('hazri.vid', LV.vid); } catch (e) { LV.vid = liveRand(9); }
  render();
  liveKey(LV.k).then(key => {
    LV.key = key;
    LV.listener = liveListen(LV.id, '', (tree, ok) => liveViewerTree(tree, ok));
    livePresence(); LV.presT = setInterval(livePresence, 30e3);
  }).catch(() => { LV.bad = true; render(); });
  setInterval(() => { if (LV.snap) { const tx = $('#lv-fresh'); if (tx) tx.outerHTML = liveFreshLine(); } }, 5000);
}
async function livePresence() {
  if (!LV.key || document.hidden || LV.gone) return;
  try { await liveReq('PUT', LV.id, 'calls/p_' + LV.vid, await liveSeal(LV.key, { at: now(), n: liveName() })); } catch (e) {}
}
async function liveViewerTree(tree, ok) {
  LV.online = ok;
  if (!ok && LV.loaded) { renderMain(); return; }
  if (tree === undefined) return;
  LV.loaded = true;
  if (tree == null) { LV.gone = true; if (LV.snap) LV.snap.ended = true; renderMain(); ecgSync(); return; }
  LV.gone = false;
  if (tree.board) {
    const snap = await liveOpen(LV.key, tree.board);
    if (!snap) { LV.bad = true; renderMain(); return; }
    const before = LV.snap ? new Set(LV.snap.in.map(r => r.c)) : null;
    const firstLoad = !LV.snap;
    LV.snap = snap; LV.at = Math.max(LV.at, snap.at || 0);
    if (!firstLoad && before) { const fresh = snap.in.filter(r => !before.has(r.c)).length; if (fresh) ecgEvents(fresh, 0); }
  }
  const calls = tree.calls || {};
  for (const k in calls) {
    if (LV.rawCalls[k] === calls[k]) continue;
    LV.rawCalls[k] = calls[k];
    const v = await liveOpen(LV.key, calls[k]); if (!v) continue;
    if (k === '_hb') { LV.at = Math.max(LV.at, v.at); continue; }
    if (k.startsWith('p_')) continue;
    LV.calls[+k] = v;
  }
  for (const k in LV.calls) if (!(k in calls)) delete LV.calls[k];
  for (const k in LV.rawCalls) if (!(k in calls)) delete LV.rawCalls[k];
  if (!$('#layer .sheet')) renderMain();
  ecgSync();
}
function liveEcgState() {
  const sn = LV.snap;
  if (!sn || sn.ended || LV.gone) return { mode: 'off', n: 0 };
  if (now() - LV.at > LIVE_STALE_MS || !LV.online) return { mode: 'stale', n: 0 };
  const n = sn.in.reduce((a, r) => a + r.ppl.filter(p => p.a).length, 0);
  return { mode: n ? 'live' : 'faint', n };
}
function liveFreshLine() {
  const sn = LV.snap; if (!sn || sn.ended) return '<span id="lv-fresh"></span>';
  const age = now() - LV.at;
  if (age > LIVE_STALE_MS) return `<div class="stale-line" id="lv-fresh">${I.alert}<span>The host's phone last updated ${esc(ago(LV.at))}. The board may be behind.</span></div>`;
  if (!LV.online) return `<div class="stale-line" id="lv-fresh">${I.alert}<span>Reconnecting… check your internet.</span></div>`;
  return '<span id="lv-fresh"></span>';
}
function liveChip(code) {
  const c = LV.calls[code]; if (!c) return '';
  const st = claimLabel(c), meta = CALL_STATUS[st] || CALL_STATUS.called;
  const txt = st === 'calling' ? `${esc(c.by || 'Someone')} is calling…` : `${meta.label}${c.by ? ' · ' + esc(c.by) : ''} · ${ago(c.at)}`;
  return `<div style="margin-top:4px"><span class="chip ${meta.cls}">${txt}</span></div>`;
}
function liveDial(code, who, num) { return `href="tel:${tel(num)}" data-act="dial" data-code="${code}" data-who="${esc(who)}" data-num="${esc(num)}"`; }
function viewLive() {
  $('#top').innerHTML = `<span class="brand-btn" aria-hidden="true"><img class="brand-mark" src="icon-192.png" alt=""></span><h1>Live board</h1>${LV.snap && !LV.snap.ended && !LV.gone ? '<span class="live-pill"><span class="live-dot"></span>Live</span>' : ''}`;
  ecgSync();
  if (LV.bad) return `<section class="card pad"><div class="empty"><b>This link is incomplete</b>Part of it may have been cut off while copying. Ask the host to send it again.</div></section>`;
  if (!LV.loaded) return `<section class="card pad"><div class="empty"><b>Opening the live board…</b>Connecting to the host's board.</div></section>`;
  const sn = LV.snap;
  if (!sn) return `<section class="card pad"><div class="empty"><b>This VC has ended</b>The live link stops working when the host ends the meeting.</div></section>`;
  const tabs = [['miss', 'Not joined', sn.missCount], ['left', 'Joined & left', sn.left.length], ['in', 'In meeting', sn.in.length]];
  let list = '';
  const canCall = !sn.ended;
  if (LV.tab === 'miss') {
    list = sn.miss.length ? sn.miss.map(r => {
      const first = r.nums[0];
      return `<div class="item"><span class="stripe miss"></span><div class="grow"><div class="row" style="gap:8px"><span class="code">${r.c}</span><span class="title ellipsis">${esc(r.n)}</span></div>
        <div class="sub ellipsis">${r.bm ? esc(r.bm) : 'No staff listed'}</div>${liveChip(r.c)}</div>
        ${r.nums.length ? `<button class="icon-btn" data-act="live-nums" data-code="${r.c}" aria-label="More numbers for ${esc(r.n)}">${I.more}</button>` : ''}
        ${canCall && first ? `<a class="call-btn" ${liveDial(r.c, first[0], first[1])}>${I.phone}Call</a>` : ''}</div>`;
    }).join('') : `<div class="empty"><b>Everyone expected has joined</b>All ${sn.total} branches have been in the meeting.</div>`;
  } else if (LV.tab === 'left') {
    list = sn.left.length ? sn.left.map(r => `<div class="item"><span class="stripe left"></span><div class="grow"><div class="row" style="gap:8px"><span class="code">${r.c}</span><span class="title ellipsis">${esc(r.n)}</span></div>
        <div class="sub">Left at ${fmtTime(r.t)} · knows about the meeting</div><div class="people-inline">${r.ppl.map(p => `<span class="chip ${p.a ? 'in' : 'left'}">${esc(p.n)}</span>`).join('')}</div>${liveChip(r.c)}</div>
        ${r.nums.length ? `<button class="icon-btn" data-act="live-nums" data-code="${r.c}" aria-label="Numbers for ${esc(r.n)}">${I.phone}</button>` : ''}</div>`).join('')
      : `<div class="empty"><b>No one has left yet</b>Branches whose people join and then drop off will appear here.</div>`;
  } else {
    list = sn.in.length ? sn.in.map(r => `<div class="item"><span class="stripe in"></span><div class="grow"><div class="row" style="gap:8px"><span class="code">${r.c}</span><span class="title ellipsis">${esc(r.n)}</span>${r.x ? '<span class="chip">not expected</span>' : ''}</div>
        <div class="people-inline">${r.ppl.map(p => `<span class="chip ${p.a ? 'in' : 'left'}">${esc(p.n)}</span>`).join('')}</div></div></div>`).join('')
      : `<div class="empty"><b>No branch has joined yet</b>The board fills in as soon as people enter the meeting.</div>`;
  }
  const when = sn.when ? new Date(sn.when) : null;
  return `
  ${sn.ended ? `<div class="banner info">${I.stop}<div><b>This VC has ended.</b> This is the final attendance.</div></div>` : ''}
  <section class="card meet-head">
    <div class="meet-meta">
      <div class="row meet-line">${sn.demo ? '<span class="chip acc">Demo</span>' : `<span class="mono muted" style="font-size:12px;flex:none">${esc(sn.code)}</span>`}${when ? `<span class="sub ellipsis">${esc(when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + fmtClock(sn.when))}</span>` : ''}${sn.ended ? `<span class="vc-run">${I.stop}<span>Ended</span></span>` : when ? `<span class="vc-run">${I.clock}<span data-since="${when.getTime()}">${vcRun(when.getTime())}</span></span>` : ''}</div>
      ${sn.agenda ? `<div class="agenda">${esc(sn.agenda)}</div>` : ''}
      ${sn.head ? `<div class="sub">Headed by ${esc(sn.head)}</div>` : ''}
    </div>
    <div class="score">${ring(sn.joined, sn.total)}
      <div class="tallies"><div class="tally in"><b>${sn.inCount}</b><span>In now</span></div><div class="tally left"><b>${sn.leftCount}</b><span>Left</span></div><div class="tally miss"><b>${sn.missCount}</b><span>Not joined</span></div></div>
    </div>
    ${liveFreshLine()}
  </section>
  <div class="board-tabs"><div class="seg" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" aria-pressed="${LV.tab === k}" data-act="live-tab" data-k="${k}">${l} <span class="mono" style="opacity:.7">${n}</span></button>`).join('')}</div></div>
  <section class="card list" id="board-list">${list}</section>
  <p class="hint" style="text-align:center;margin:6px 0 0">Shared from Hazri${liveName() ? ` · you are <button class="btn-link" data-act="live-rename">${esc(liveName())}</button>` : ''}. Numbers are for this VC only.</p>`;
}
function liveFind(code) { const sn = LV.snap; return sn && (sn.miss.find(r => r.c === code) || sn.left.find(r => r.c === code)); }
function liveNumsSheet(code) {
  const r = liveFind(code); if (!r) return;
  openSheet(`
    <div class="sheet-head"><span class="code" style="margin-top:3px">${r.c}</span><div class="grow"><h3>${esc(r.n)}</h3><div class="sub">${LV.calls[code] ? liveChip(code).replace(/<\/?div[^>]*>/g, '') : 'Not called yet'}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <div class="list card" style="box-shadow:none;border:1px solid var(--line)">${r.nums.map(([l, n, sub]) => `<div class="item"><div class="grow"><div class="title ellipsis">${esc(l)}</div><div class="sub"><span class="mono">${esc(n)}</span>${sub ? ' · ' + esc(sub) : ''}</div></div><button class="icon-btn" data-act="copy" data-v="${esc(n)}" aria-label="Copy number">${I.copy}</button>${LV.snap.ended ? '' : `<a class="call-btn" ${liveDial(r.c, l, n)}>${I.phone}Call</a>`}</div>`).join('')}</div>
      ${LV.snap.ended ? '' : `<div class="flabel">Call status</div>${statusPicker(r.c)}`}
    </div>`);
}
async function liveSetCall(code, status, extra = {}) {
  const prev = LV.calls[code];
  const v = { status, at: now(), who: extra.who || (prev && prev.who) || '', num: extra.num || (prev && prev.num) || '', by: liveName() };
  LV.calls[code] = v;
  if (LV.pending && LV.pending.code === code && status !== 'calling') LV.pending = null;
  renderMain();
  try { await liveReq('PUT', LV.id, 'calls/' + code, await liveSeal(LV.key, v)); }
  catch (e) { toast('Could not share that. Check the internet.'); }
}
async function liveStartCall(el, e) {
  const code = +el.dataset.code, who = el.dataset.who || '', num = el.dataset.num || '';
  if (!liveName()) {
    e.preventDefault();
    const n = await askLiveName('So others see who is calling which branch');
    if (!n) return;
    location.href = el.getAttribute('href');
  }
  if ($('#layer .sheet')) closeSheet(true);
  LV.pending = { code, who, num, at: now(), away: false };
  liveSetCall(code, 'calling', { who, num });
  setTimeout(() => { if (LV.pending && LV.pending.code === code && !LV.pending.away && !document.hidden) liveFeedback(); }, 4000);
}
function liveFeedback() {
  const pc = LV.pending, r = pc && liveFind(pc.code);
  if (!pc) return;
  const name = r ? r.n : 'Branch ' + pc.code;
  openSheet(`
    <div class="sheet-head"><span class="code" style="margin-top:3px">${pc.code}</span><div class="grow"><h3>How did the call go?</h3><div class="sub">${esc(name)}${pc.who ? ' · ' + esc(pc.who) : ''}</div></div></div>
    <div class="sheet-body">
      ${statusPicker(pc.code)}
      <button class="btn btn-ghost btn-block" data-act="call-status" data-code="${pc.code}" data-status="called">Skip, just mark as called</button>
    </div>`, { onClose: () => { if (LV.pending && LV.pending.code === pc.code) liveSetCall(pc.code, 'called', pc); } });
}
function liveVisible() {
  if (document.hidden) { if (LV.pending) LV.pending.away = true; return; }
  if (LV.pending && LV.pending.away) { LV.pending.away = false; setTimeout(liveFeedback, 350); }
  livePresence();
  if (LV.listener) LV.listener.refresh();
}

Object.assign(ACT, {
  'live-share': () => liveStartShare(),
  'live-send': () => liveSendLink(),
  'live-copy': () => copyText(liveLink(S.session.live), 'Live link copied'),
  'live-stop': () => liveStopShare(),
  'live-tab': el => { LV.tab = el.dataset.k; renderMain(); },
  'live-nums': el => liveNumsSheet(+el.dataset.code),
  'live-rename': () => askLiveName('Shown to others when you call a branch').then(() => renderMain())
});
if (!VIEWER) setTimeout(() => { liveEmptyTrash(); livePublishSoon(); }, 1500);
