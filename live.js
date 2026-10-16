/* Hazri · live.js — Share the live board with anyone through a link.
   The host phone stays the only one that talks to Google Meet. After every change it posts a small
   snapshot of the board to a free Firebase Realtime Database; anyone holding the link watches it live
   and can join the calling round. Everything is encrypted on the host phone with AES-GCM; the key
   travels only in the link's #fragment, which browsers never send to any server, so Firebase stores
   nothing readable. The link carries just that key; the board's address in Firebase is worked out
   from it one way (SHA-256), so Firebase never learns the key. The board is deleted from Firebase when the meeting ends.
   Locking or removing a viewer moves the board to a fresh key. Every viewer's phone makes its own key
   pair when it opens the link; the host hands the fresh key only to the viewers it keeps, sealed for
   each of them, so the link alone no longer opens the board.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

/* ───────────────────────── relay: Firebase REST + encryption ───────────────────────── */
const LIVE_HOME = 'https://hazri-live-default-rtdb.asia-southeast1.firebasedatabase.app';
// Tests on this computer point at a local stand-in; on any real site the address is fixed.
const LIVE_DB = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('livedb')) || LIVE_HOME;
const LIVE_HB_MS = 20e3;          // host "I'm alive" beat while sharing
const LIVE_STALE_MS = 50e3;       // viewers warn after this long without a beat
const LIVE_CLAIM_MS = 15 * 60e3;  // "X is calling…" turns into "Called" after this
const LIVE_SEEN_MS = 75e3;        // a viewer counts as watching if heard from this recently
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const liveRand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
const liveIdOf = async k => b64u((await crypto.subtle.digest('SHA-256', unb64u(k))).slice(0, 16));
async function liveKey(k) { return crypto.subtle.importKey('raw', unb64u(k), 'AES-GCM', false, ['encrypt', 'decrypt']); }
// Sealed values look like "v1.<iv>.<data>" for the link's own key, or "e3.<iv>.<data>" for the 3rd fresh key.
const sealEpoch = str => { const p = String(str).split('.')[0]; return p === 'v1' ? 0 : /^e\d+$/.test(p) ? +p.slice(1) : -1; };
async function liveSeal(key, obj, e = 0) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return (e ? 'e' + e : 'v1') + '.' + b64u(iv) + '.' + b64u(ct);
}
async function liveOpen(key, str) {
  try {
    const [, iv, ct] = String(str).split('.'); if (!key || sealEpoch(str) < 0) return null;
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, key, unb64u(ct))));
  } catch (e) { return null; }   // wrong key or tampered: ignore
}
const EC = { name: 'ECDH', namedCurve: 'P-256' };
async function livePair() {
  const kp = await crypto.subtle.generateKey(EC, true, ['deriveKey']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey), priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, priv: { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y, d: priv.d } };
}
async function liveShared(priv, pub) {
  const a = await crypto.subtle.importKey('jwk', priv, EC, false, ['deriveKey']);
  const b = await crypto.subtle.importKey('jwk', pub, EC, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: b }, a, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
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
    const handle = ev => {
      fails = 0;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m) return;
      setAt(m.path, m.data);
      onTree(tree, true);
    };
    es.addEventListener('put', handle);
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
function liveDevice() {
  const ua = navigator.userAgent || '';
  return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') : /Windows/.test(ua) ? 'Windows PC' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux PC' : 'Browser';
}

/* ───────────────────────── host side ───────────────────────── */
const LH = { cur: null, k0: null, kc: null, e: 0, keys: {}, names: {}, listener: null, tree: null, lastJson: '', lastSnap: null, hbT: 0, remote: {}, viewers: {}, granted: {}, watchers: 0, busy: false };
function liveLink(l) {
  const local = LIVE_DB !== LIVE_HOME ? '?livedb=' + encodeURIComponent(LIVE_DB) : '';
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'live/' + local + '#' + l.key;
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
  return {
    code: s.meetingCode, uri: s.meetingUri || '', demo: s.source === 'demo', when: s.details.when || '', agenda: s.details.agenda || '', head: s.details.headedBy || '',
    ended: !!s.ended,
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
  LH.cur = l; LH.k0 = await liveKey(l.key); LH.e = l.e || 0; LH.kc = LH.e ? await liveKey(l.kc) : LH.k0;
  LH.keys = { 0: LH.k0 }; for (const e in l.old || {}) LH.keys[e] = await liveKey(l.old[e]); LH.keys[LH.e] = LH.kc;
  LH.lastJson = ''; LH.remote = {}; LH.viewers = {}; LH.granted = {};
  // Two streams, both only on this phone: call statuses (shared with viewers) and viewers' "still here"
  // signals (seen only by the host, so viewers never receive each other's).
  LH.listener = liveListen(l.id, 'pub/calls', tree => liveHostCalls(tree));
  LH.seenL = liveListen(l.id, 'seen', tree => { LH.seen = tree; liveHostSeen(tree); });
  clearInterval(LH.hbT);
  LH.hbT = setInterval(() => {
    if (!LH.cur || document.hidden) return;
    const id = LH.cur.id;
    liveSeal(LH.kc, { at: now() }, LH.e).then(v => liveReq('PUT', id, 'pub/calls/_hb', v)).catch(() => {});
    liveHostSeen(LH.seen);   // recount watchers as old ones go quiet
  }, LIVE_HB_MS);
  // Calls already made in this round go up too, so helpers see them.
  for (const code in S.calls) livePushCall(+code);
}
async function livePush(force) {
  const snap = liveSnap(); if (!snap) return;
  const json = JSON.stringify(snap);
  if (!force && json === LH.lastJson) return;
  LH.lastJson = json; LH.lastSnap = snap;
  await liveReq('PUT', LH.cur.id, 'pub/board', await liveSeal(LH.kc, { ...snap, at: now() }, LH.e));
}
async function liveFinish() {
  const cur = LH.cur, key = LH.kc, e = LH.e, snap = LH.lastSnap;
  LH.cur = null; LH.k0 = LH.kc = null; LH.viewers = {}; LH.watchers = 0; clearInterval(LH.hbT);
  if (LH.listener) { LH.listener.close(); LH.listener = null; }
  if (LH.seenL) { LH.seenL.close(); LH.seenL = null; }
  if (!cur) return;
  S.liveTrash = [...new Set([...(S.liveTrash || []), cur.id])]; save();
  // Watchers get the final board marked as ended, then the data is removed from Firebase.
  try { if (snap && key) await liveReq('PUT', cur.id, 'pub/board', await liveSeal(key, { ...snap, ended: true, at: now() }, e)); } catch (e2) {}
  setTimeout(liveEmptyTrash, 4000);
}
async function liveEmptyTrash() {
  for (const id of (S.liveTrash || []).slice()) {
    if (LH.cur && LH.cur.id === id) continue;
    try { await liveReq('DELETE', id); S.liveTrash = S.liveTrash.filter(x => x !== id); save(); } catch (e) { return; }
  }
}
async function liveHostCalls(tree) {
  if (!LH.cur || !tree || typeof tree !== 'object') return;
  let changed = false;
  for (const k in tree) {
    if (LH.remote[k] === tree[k]) continue;
    LH.remote[k] = tree[k];
    if (k.startsWith('g_') || k.startsWith('n_') || k === '_hb') continue;
    const v = await liveOpen(LH.keys[sealEpoch(tree[k])], tree[k]); if (!v) continue;   // older keys too: a call finished after its caller was removed still counts
    const code = +k, mine = S.calls[code];
    if (!code || (mine && mine.at >= v.at)) continue;
    S.calls[code] = { status: v.status, at: v.at, who: v.who || '', num: v.num || '', by: v.by || '' };
    changed = true;
  }
  if (changed) { save(); if (!$('#layer .sheet')) renderMain(); }
}
// Viewers' "still here" signals (sealed with the link's own key). Redraw only when the list itself changes.
async function liveHostSeen(tree) {
  if (!LH.cur) return;
  tree = tree && typeof tree === 'object' ? tree : {};
  const before = JSON.stringify(liveViewerList().map(v => [v.vid, v.n, v.dev, v.waiting]));
  for (const vid in tree) {
    if (LH.remote['s_' + vid] === tree[vid]) continue;
    LH.remote['s_' + vid] = tree[vid];
    const v = await liveOpen(LH.k0, tree[vid]); if (!v) continue;
    const old = LH.viewers[vid];
    if (v.n && LH.names[vid] === v.n) delete LH.names[vid];   // the name we gave them has reached their phone
    LH.viewers[vid] = { n: LH.names[vid] || v.n || '', dev: v.dev || '', at: v.at, pub: v.pub, first: old ? old.first : v.at };
  }
  for (const vid in LH.viewers) if (!(vid in tree)) delete LH.viewers[vid];
  await liveAdmit();
  const after = JSON.stringify(liveViewerList().map(v => [v.vid, v.n, v.dev, v.waiting]));
  if (liveCount() || before !== after) { save(); if (!$('#layer .sheet')) renderMain(); }
}
const liveActive = v => v && now() - v.at < LIVE_SEEN_MS;
function liveViewerList() {
  const l = LH.cur; if (!l) return [];
  return Object.entries(LH.viewers).filter(([vid, v]) => !(l.dropped || []).includes(vid) && liveActive(v))
    .map(([vid, v]) => ({ vid, ...v, waiting: !!l.lock && !(l.admitted || {})[vid] }))
    .sort((a, b) => a.waiting - b.waiting || a.first - b.first);
}
function liveCount() { const n = liveViewerList().filter(v => !v.waiting).length; if (n === LH.watchers) return false; LH.watchers = n; return true; }
// With a fresh key in use, hand it to every viewer who is allowed in and doesn't have it yet.
async function liveAdmit() {
  const l = LH.cur; if (!l || !LH.e) return;
  l.admitted = l.admitted || {};
  for (const v of liveViewerList()) {
    if (v.waiting || !v.pub || LH.granted[v.vid] === LH.e) continue;
    if (!l.lock) l.admitted[v.vid] = true;
    try {
      const k = await liveSeal(await liveShared(l.hp, v.pub), { k: l.kc }, 0);
      await liveReq('PUT', l.id, 'pub/calls/g_' + v.vid, JSON.stringify({ p: l.hpub, e: LH.e, k }));
      LH.granted[v.vid] = LH.e;
    } catch (e) {}
  }
}
// Move the board to a fresh key; everyone still allowed gets it, anyone else is shut out.
async function liveRotate() {
  const l = LH.cur; if (!l) return;
  if (!l.hp) { const p = await livePair(); l.hp = p.priv; l.hpub = p.pub; }
  if (l.e) l.old = { ...(l.old || {}), [l.e]: l.kc };
  l.e = (l.e || 0) + 1; l.kc = liveRand(16);
  LH.e = l.e; LH.kc = await liveKey(l.kc); LH.keys[l.e] = LH.kc; LH.granted = {}; LH.lastJson = '';
  save();
  await liveAdmit();
  await livePush(true);
  liveSeal(LH.kc, { at: now() }, LH.e).then(v => liveReq('PUT', l.id, 'pub/calls/_hb', v)).catch(() => {});
  for (const code in S.calls) livePushCall(+code);
  for (const vid of l.dropped || []) liveReq('DELETE', l.id, 'pub/calls/g_' + vid).catch(() => {});
}
async function liveSetLock(on) {
  const l = LH.cur; if (!l) return;
  if (on) {
    l.admitted = l.admitted || {};
    for (const v of liveViewerList()) l.admitted[v.vid] = true;   // everyone watching now stays in
    l.lock = true;
    if (!LH.e) await liveRotate(); else save();
    toast('Locked. New people need your OK to watch.');
  } else {
    l.lock = false; l.dropped = []; save(); await liveAdmit();   // unlocked means everyone with the link is welcome, removed people too
    toast('Unlocked. Anyone with the link can watch.');
  }
  liveCount(); renderMain();
}
async function liveLetIn(vid) { const l = LH.cur; if (!l) return; (l.admitted = l.admitted || {})[vid] = true; save(); await liveAdmit(); liveCount(); renderMain(); }
async function liveDrop(vid) {
  const l = LH.cur; if (!l) return;
  const hadKey = !LH.e || (l.admitted || {})[vid] || LH.granted[vid];
  l.dropped = [...new Set([...(l.dropped || []), vid])];
  if (l.admitted) delete l.admitted[vid];   // still known (hidden from the list), so unlocking can let them straight back in
  if (hadKey) await liveRotate(); else save();   // someone still waiting never had the key: nothing to change
  liveCount(); renderMain();
}
async function liveRenameViewer(vid, n) {
  const l = LH.cur, v = LH.viewers[vid]; if (!l || !v) return;
  LH.names[vid] = n; v.n = n; renderMain();
  try { await liveReq('PUT', l.id, 'pub/calls/n_' + vid, await liveSeal(LH.k0, { n })); } catch (e) { toast('Could not send the name. Check the internet.'); }
}
async function livePushCall(code) {
  if (!LH.cur || !LH.kc) return;
  const c = S.calls[code];
  try {
    if (!c) await liveReq('DELETE', LH.cur.id, 'pub/calls/' + code);
    else await liveReq('PUT', LH.cur.id, 'pub/calls/' + code, await liveSeal(LH.kc, { status: c.status, at: c.at, who: c.who || '', num: c.num || '', by: c.by || liveName() || 'Host' }, LH.e));
  } catch (e) {}
}
async function liveStartShare() {
  const s = S.session; if (!s) return;
  if (!s.live) {
    if (!liveName()) { const n = await askLiveName('Shown to others when you call a branch'); if (!n) return; }
    const key = liveRand(16);   // 128-bit key = 22 characters in the link
    s.live = { id: await liveIdOf(key), key, at: now(), e: 0, lock: false, admitted: {}, dropped: [] }; save();
  }
  try { await liveReconcile(); if (!LH.cur) throw new Error(); await livePush(true); }
  catch (e) { toast('Could not reach the live link service. Check the internet and try again.'); return; }
  renderMain(); liveSendLink();
}
function liveShareText() {
  const s = S.session, d = s.details;
  const vc = ['*Video Conference – RO Udaipur*', d.when ? '🕚 ' + fmtWhen(d.when) : '', d.headedBy ? '👤 Headed by: ' + d.headedBy : '', d.agenda ? '📋 Agenda: ' + d.agenda : ''].filter(Boolean);
  return [...vc, '', '📊 *Live attendance*: see who has joined and help call the rest', liveLink(s.live)].join('\n');
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
const viewerLabel = v => v.n || 'Guest · ' + (v.dev || 'Browser');
function liveDeskCard() {
  const s = S.session, l = s.live;
  if (!l) return `<section class="card pad m-card">
    <div class="m-head"><div class="grow"><div class="m-title">Live link</div><div class="sub">Anyone you send it to sees this board live and can help call. No sign-in needed.</div></div>
      <button class="mini-btn primary" data-act="live-share">${I.share}Share live</button></div></section>`;
  const list = liveViewerList(), waiting = list.filter(v => v.waiting).length;
  return `<section class="card pad m-card">
    <div class="m-head"><div class="grow"><div class="m-title"><span class="live-dot"></span>Live link on</div><div class="sub">${LH.watchers ? `${LH.watchers} watching` : 'Nobody watching yet'}${waiting ? ` · ${waiting} waiting` : ''}</div></div>
      <div class="icon-row">
        <button class="mini-btn wa-solid" data-act="live-send">${I.share}Send</button>
        <button class="round-btn" data-act="live-copy" aria-label="Copy live link">${I.copy}</button>
        <button class="round-btn" data-act="live-stop" aria-label="Stop sharing">${I.stop}</button>
      </div></div>
    ${list.length ? `<div class="picks" id="live-viewers">${list.map(v => `<button type="button" class="pick viewer-pill ${v.waiting ? 'waiting' : ''}" data-act="live-viewer" data-vid="${esc(v.vid)}">${v.waiting ? I.clock : '<span class="vp-dot"></span>'}${esc(viewerLabel(v))}${v.waiting ? ' · waiting' : ''}</button>`).join('')}</div>` : ''}
    <label class="setting" style="padding:0"><div class="grow"><div class="title">Lock the link</div><div class="sub">${l.lock ? 'New people wait until you let them in' : 'Anyone with the link can watch'}</div></div><span class="switch"><input type="checkbox" id="live-lock" ${l.lock ? 'checked' : ''}><span></span></span></label>
  </section>`;
}
function liveViewerSheet(vid) {
  const v = liveViewerList().find(x => x.vid === vid); if (!v) return;
  openSheet(`<div class="sheet-head"><div class="grow"><h3>${esc(viewerLabel(v))}</h3><div class="sub">${v.n ? esc(v.dev) + ' · ' : ''}${v.waiting ? 'Waiting to watch' : 'Watching'} · opened ${esc(fmtTime(v.first))}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <form class="field" id="lv-name-form"><label for="lv-name">Name</label><div class="row" style="gap:8px"><input class="input grow" id="lv-name" value="${esc(v.n)}" placeholder="Type who this is" maxlength="40"><button class="btn btn-soft" id="lv-name-ok" type="submit">Save</button></div>
        <span class="hint">Shows here and on their screen.</span></form>
      ${v.waiting ? `<button class="btn btn-primary btn-block" id="lv-in">${I.check}Let in</button>` : ''}
      <button class="btn btn-danger btn-block" id="lv-out">${I.x}${v.waiting ? 'Keep out' : 'Remove from live board'}</button>
      <p class="hint" style="margin:0">${v.waiting ? 'They can see nothing until you let them in.' : 'Their screen stops updating straight away. Unlocking the link later lets everyone back in, them too.'}</p>
    </div>`);
  $('#lv-name-form').onsubmit = e => { e.preventDefault(); const n = $('#lv-name').value.trim().slice(0, 40); if (!n) return; closeSheet(); liveRenameViewer(vid, n); toast('Name saved'); };
  if ($('#lv-in')) $('#lv-in').onclick = () => { closeSheet(); liveLetIn(vid); toast(viewerLabel(v) + ' can watch now'); };
  $('#lv-out').onclick = () => { closeSheet(); liveDrop(vid); toast(viewerLabel(v) + ' removed'); };
}
const liveBadge = () => S.session && S.session.live && !S.session.ended ? `<button class="live-line" data-act="go-share"><span class="live-dot"></span>Live link on · ${LH.watchers ? LH.watchers + ' watching' : 'nobody watching yet'}${liveViewerList().some(v => v.waiting) ? ' · someone waiting' : ''}</button>` : '';

/* ───────────────────────── viewer side ───────────────────────── */
const LV = { id: '', k0: null, keys: {}, me: null, e: 0, snap: null, at: 0, calls: {}, rawCalls: {}, gone: false, bad: false, online: true, tab: 'miss', pending: null, presT: 0, listener: null, loaded: false, noKey: false, hadAccess: false, left: false };
const lvStoreKey = () => 'hazri.lv.' + LV.id;
function lvSave() { try { localStorage.setItem(lvStoreKey(), JSON.stringify({ vid: LV.me.vid, pub: LV.me.pub, priv: LV.me.priv, raw: LV.me.raw })); } catch (e) {} }
async function liveBoot() {
  const k = location.hash.slice(1);
  render();
  if (!/^[\w-]{22}$/.test(k)) { LV.bad = true; render(); return; }
  try {
    LV.id = await liveIdOf(k); LV.k0 = await liveKey(k); LV.keys[0] = LV.k0;
    let me = null; try { me = JSON.parse(localStorage.getItem(lvStoreKey())); } catch (e) {}
    if (!me || !me.priv) me = { vid: liveRand(9), ...(await livePair()), raw: {} };
    LV.me = me; lvSave();
    for (const e in me.raw || {}) LV.keys[e] = await liveKey(me.raw[e]);
  } catch (e) { LV.bad = true; render(); return; }
  LV.listener = liveListen(LV.id, 'pub', (tree, ok) => liveViewerTree(tree, ok));
  livePresence(); LV.presT = setInterval(livePresence, 30e3);
  setInterval(() => { if (LV.snap) { const tx = $('#lv-fresh'); if (tx) tx.outerHTML = liveFreshLine(); } }, 5000);
}
async function livePresence() {
  if (!LV.k0 || !LV.me || document.hidden || LV.gone || LV.left) return;
  try { await liveReq('PUT', LV.id, 'seen/' + LV.me.vid, await liveSeal(LV.k0, { at: now(), n: liveName(), dev: liveDevice(), pub: LV.me.pub })); } catch (e) {}
}
// The key for a given round: the link's own, one we already hold, or one the host sealed for this phone.
async function liveKeyFor(e, calls) {
  if (LV.keys[e]) return LV.keys[e];
  const g = calls && calls['g_' + LV.me.vid]; if (!g) return null;
  try {
    const grant = JSON.parse(g); if (grant.e !== e) return null;
    const v = await liveOpen(await liveShared(LV.me.priv, grant.p), grant.k); if (!v || !v.k) return null;
    LV.keys[e] = await liveKey(v.k); LV.me.raw = { ...(LV.me.raw || {}), [e]: v.k }; lvSave();
    return LV.keys[e];
  } catch (err) { return null; }
}
async function liveViewerTree(tree, ok) {
  if (LV.left) return;
  LV.online = ok;
  if (!ok && LV.loaded) { renderMain(); return; }
  if (tree === undefined) return;
  LV.loaded = true;
  if (tree == null) { LV.gone = true; if (LV.snap) LV.snap.ended = true; renderMain(); ecgSync(); return; }
  const wasGone = LV.gone; LV.gone = false;
  let dirty = wasGone || !LV.drawn;
  const calls = tree.calls || {};
  const nk = 'n_' + LV.me.vid;
  if (calls[nk] && LV.rawCalls[nk] !== calls[nk]) {
    LV.rawCalls[nk] = calls[nk];
    const v = await liveOpen(LV.k0, calls[nk]);
    if (v && v.n) { liveSetName(v.n); livePresence().then(() => liveReq('DELETE', LV.id, 'pub/calls/' + nk).catch(() => {})); toast('The host saved your name as ' + v.n); }
  }
  if (tree.board) {
    const e = sealEpoch(tree.board), key = await liveKeyFor(e, calls);
    if (!key) { const was = LV.noKey; LV.noKey = true; if (!was) { renderMain(); ecgSync(); } return; }   // no redraw while waiting, so the emblem can be played with
    if (tree.board !== LV.rawBoard || LV.noKey) {
    const snap = await liveOpen(key, tree.board);
    if (!snap) { if (!e) LV.bad = true; else LV.noKey = true; renderMain(); return; }
    LV.rawBoard = tree.board; dirty = true;
    LV.noKey = false; LV.hadAccess = true; LV.e = e;
    const before = LV.snap ? new Set(LV.snap.in.map(r => r.c)) : null;
    LV.snap = snap; LV.at = Math.max(LV.at, snap.at || 0);
    if (before) { const fresh = snap.in.filter(r => !before.has(r.c)).length; if (fresh) ecgEvents(fresh, 0); }
    }
  }
  for (const k in calls) {
    if (LV.rawCalls[k] === calls[k] || k.startsWith('g_') || k.startsWith('n_')) continue;
    const key = LV.keys[sealEpoch(calls[k])]; if (!key) continue;
    const v = await liveOpen(key, calls[k]); if (!v) continue;
    LV.rawCalls[k] = calls[k];
    if (k === '_hb') { LV.at = Math.max(LV.at, v.at); continue; }   // just a beat: the freshness line updates on its own
    LV.calls[+k] = v; dirty = true;
  }
  for (const k in LV.calls) if (!(k in calls)) { delete LV.calls[k]; dirty = true; }
  for (const k in LV.rawCalls) if (!(k in calls)) delete LV.rawCalls[k];
  if (dirty && !$('#layer .sheet')) { renderMain(); LV.drawn = true; }
  ecgSync();
}
function liveEcgState() {
  const sn = LV.snap;
  if (!sn || sn.ended || LV.gone || LV.noKey || LV.left) return { mode: 'off', n: 0 };
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
function liveTop() {
  const sn = LV.snap, on = sn && !sn.ended && !LV.gone && !LV.noKey && !LV.left;
  $('#top').innerHTML = `<button class="brand-btn" data-act="about" aria-label="About Hazri"><img class="brand-mark" src="icon-192.png" alt=""></button><h1 class="lv-title">Live board<span class="lv-via">via pdudairo</span></h1>`
    + (on && sn.uri ? `<a class="join-btn" href="${esc(sn.uri)}" target="_blank" rel="noopener" aria-label="Join the meeting">${I.video}Join</a>` : '')
    + (LV.left ? '' : `<button class="icon-btn" data-act="live-exit" aria-label="Stop watching">${I.x}</button>`);
  ecgSync();
}
const liveFoot = () => `<p class="hint lv-foot">Shared from Hazri${liveName() ? ` · you are <button class="btn-link" data-act="live-rename">${esc(liveName())}</button>` : ` · <button class="btn-link" data-act="live-rename">add your name</button>`}. Numbers are for this VC only.<span class="lv-credit">Built by Nitin Kotwar (139535)</span></p>`;
function viewLive() {
  liveTop();
  const msg = (t, b, extra = '') => `<section class="card pad"><div class="empty"><b>${t}</b>${b}${extra}</div></section>${liveFoot()}`;
  if (LV.left) return msg('You stopped watching', 'Nothing more is sent to or from this phone.', `<div style="margin-top:14px"><button class="btn btn-soft" data-act="live-rejoin">Watch again</button></div>`);
  if (LV.bad) return msg('This link is incomplete', 'Part of it may have been cut off while copying. Ask the host to send it again.');
  if (!LV.loaded) return msg('Opening the live board…', 'Connecting to the host\'s board.');
  if (LV.noKey) return LV.hadAccess
    ? msg('You no longer have access', 'The host has locked or changed who can watch this board. Ask them to let you in again.')
    : `<section class="card pad lv-wait"><div class="home-art">${arcArt()}</div>
        <div class="empty" style="padding-top:4px"><b>Waiting for the host to let you in</b>This live board is locked. ${liveName() ? `The host sees <b>${esc(liveName())}</b> waiting` : 'Add your name below so the host knows it\'s you'}; the board opens here as soon as they let you in.<div class="lv-play">Meanwhile, tap the emblem. Or hold it.</div></div></section>${liveFoot()}`;
  const sn = LV.snap;
  if (!sn) return msg('This VC has ended', 'The live link stops working when the host ends the meeting.');
  const tabs = [['miss', 'Not joined', sn.missCount], ['left', 'Joined & left', sn.left.length], ['in', 'In meeting', sn.in.length]];
  let list = '';
  const canCall = !sn.ended;
  if (LV.tab === 'miss') {
    list = sn.miss.length ? sn.miss.map(r => {
      const first = r.nums[0];
      return `<div class="item"><span class="stripe miss"></span><div class="grow"><div class="row" style="gap:8px"><span class="code">${r.c}</span><span class="title ellipsis">${esc(r.n)}</span></div>
        <div class="sub ellipsis">${r.bm ? esc(r.bm) : 'No staff listed'}</div>${liveChip(r.c)}</div>
        ${r.nums.length ? `<button class="icon-btn" data-act="live-nums" data-code="${r.c}" aria-label="More numbers for ${esc(r.n)}">${I.more}</button>` : ''}
        ${canCall && first ? `<a class="call-btn" ${dial(r.c, first[0], first[1])}>${I.phone}Call</a>` : ''}</div>`;
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
  ${liveFoot()}`;
}
function liveFind(code) { const sn = LV.snap; return sn && (sn.miss.find(r => r.c === code) || sn.left.find(r => r.c === code)); }
function liveNumsSheet(code) {
  const r = liveFind(code); if (!r) return;
  openSheet(`
    <div class="sheet-head"><span class="code" style="margin-top:3px">${r.c}</span><div class="grow"><h3>${esc(r.n)}</h3><div class="sub">${LV.calls[code] ? liveChip(code).replace(/<\/?div[^>]*>/g, '') : 'Not called yet'}</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <div class="list card" style="box-shadow:none;border:1px solid var(--line)">${r.nums.map(([l, n, sub]) => `<div class="item"><div class="grow"><div class="title ellipsis">${esc(l)}</div><div class="sub"><span class="mono">${esc(n)}</span>${sub ? ' · ' + esc(sub) : ''}</div></div><button class="icon-btn" data-act="copy" data-v="${esc(n)}" aria-label="Copy number">${I.copy}</button>${LV.snap.ended ? '' : `<a class="call-btn" ${dial(r.c, l, n)}>${I.phone}Call</a>`}</div>`).join('')}</div>
      ${LV.snap.ended ? '' : `<div class="flabel">Call status</div>${statusPicker(r.c)}`}
    </div>`);
}
async function liveSetCall(code, status, extra = {}) {
  const prev = LV.calls[code], key = LV.keys[LV.e];
  const v = { status, at: now(), who: extra.who || (prev && prev.who) || '', num: extra.num || (prev && prev.num) || '', by: liveName() };
  LV.calls[code] = v;
  if (LV.pending && LV.pending.code === code && status !== 'calling') LV.pending = null;
  renderMain();
  try { await liveReq('PUT', LV.id, 'pub/calls/' + code, await liveSeal(key, v, LV.e)); }
  catch (e) { toast('Could not share that. Check the internet.'); }
}
async function liveStartCall(el, e) {
  const code = +el.dataset.code, who = el.dataset.who || '', num = el.dataset.num || '';
  if (!liveName()) {
    e.preventDefault();
    const n = await askLiveName('So others see who is calling which branch');
    if (!n) return;
    livePresence();
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
  if (LV.left) return;
  if (document.hidden) { if (LV.pending) LV.pending.away = true; return; }
  if (LV.pending && LV.pending.away) { LV.pending.away = false; setTimeout(liveFeedback, 350); }
  livePresence();
  if (LV.listener) LV.listener.refresh();
}
async function liveExit() {
  if (!(await confirmSheet('Stop watching?', 'The board stops updating on this phone and the host sees you have left. You can open the link again any time.', 'Stop watching'))) return;
  LV.left = true; clearInterval(LV.presT);
  if (LV.listener) { LV.listener.close(); LV.listener = null; }
  try { await liveReq('DELETE', LV.id, 'seen/' + LV.me.vid); } catch (e) {}
  renderMain();
}

Object.assign(ACT, {
  'live-share': () => liveStartShare(),
  'live-send': () => liveSendLink(),
  'live-copy': () => copyText(liveLink(S.session.live), 'Live link copied'),
  'live-stop': () => liveStopShare(),
  'live-viewer': el => liveViewerSheet(el.dataset.vid),
  'live-tab': el => { LV.tab = el.dataset.k; renderMain(); },
  'live-nums': el => liveNumsSheet(+el.dataset.code),
  'live-rename': () => askLiveName('Shown to the host and to others when you call a branch').then(() => { livePresence(); renderMain(); }),
  'live-exit': () => liveExit(),
  'live-rejoin': () => location.reload()
});
document.addEventListener('change', e => { if (e.target.id === 'live-lock') liveSetLock(e.target.checked); });
if (!VIEWER) setTimeout(() => { liveEmptyTrash(); livePublishSoon(); }, 1500);
