/* Hazri · ui.js — Screen state (U), navigation and Back, rendering helpers, swipes, pull to refresh, toasts, keep-awake, timers.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

/* ───────────────────────── UI state ───────────────────────── */
const U = { visibleAt: Date.now(), tab: (() => { try { const t = sessionStorage.getItem('rc.tab'); sessionStorage.removeItem('rc.tab'); return t === 'settings' ? t : 'meet'; } catch (e) { return 'meet'; } })(), route: null, boardTab: 'miss', dirQ: '', dirFilter: 'branches', flash: new Set(), draft: null, wake: null };

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
  $$('.ptr-hint').forEach(e => e.remove());
  $$('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === U.tab ? 'page' : 'false'));
  renderMain();
  manageWake();
}
function renderTop(title, { back = false, actions = '' } = {}) {
  $('#top').innerHTML = `${back ? `<button class="back" data-act="back" aria-label="Back">${I.back}</button>` : '<button class="brand-btn" data-act="about" aria-label="About Hazri"><img class="brand-mark" src="icon-192.png" alt=""></button>'}<h1>${esc(title)}</h1>${actions}`;
  ecgSync();
}
function renderMain() {
  const m = $('#main');
  if (VIEWER) { m.innerHTML = viewLive(); afterRender(); return; }
  const r = U.route;
  let html = '';
  if (r && r.name === 'create') html = viewCreate();
  else if (r && r.name === 'share') html = viewShare();
  else if (r && r.name === 'unit') html = viewUnit(r.code);
  else if (r && r.name === 'about') html = viewAbout();
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

/* ───────────────────────── swipe between tabs ───────────────────────── */
function swipeTabs(dir) {
  if (VIEWER) { const order = ['miss', 'left', 'in'], i = order.indexOf(LV.tab) + dir; if (i < 0 || i >= order.length) return; LV.tab = order[i]; U.slide = dir; renderMain(); return; }
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
    ok = e.touches.length === 1 && !U.route && (VIEWER ? !!LV.snap : (U.tab === 'dir' || (U.tab === 'meet' && !!S.session))) && !e.target.closest('.picks,.untagged-list,input,textarea,select');
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
  const can = () => U.tab === 'meet' && !U.route && (VIEWER ? !!LV.snap : !!S.session) && !busy && !$('#layer .sheet') && (window.scrollY || document.documentElement.scrollTop) <= 0;
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
    try { if (VIEWER) { if (LV.listener) await LV.listener.refresh(); } else await syncNow(); } catch (err) {}
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
  const want = !VIEWER && S.settings.keepAwake && S.session && !S.session.ended && U.tab === 'meet' && !U.route && !document.hidden;
  try {
    if (want && !U.wake && navigator.wakeLock) { U.wake = await navigator.wakeLock.request('screen'); U.wake.addEventListener('release', () => { U.wake = null; }); }
    else if (!want && U.wake) { await U.wake.release(); U.wake = null; }
  } catch (e) { U.wake = null; }
}
function startCall(el) {
  if (unitByCode.get(+el.dataset.code)?.isRO) return;   // calls to RO colleagues aren't part of the calling round
  if (S.session && S.session.live && !S.session.ended) setCallStatus(+el.dataset.code, 'calling', { who: el.dataset.who || '', num: el.dataset.num || '' });   // helpers on the live link see you're on it
  S.pendingCall = { code: +el.dataset.code, who: el.dataset.who || '', num: el.dataset.num || '', at: now() };
  save(); U.leftForCall = false;
  if ($('#layer .sheet')) closeSheet(true);
  // Phones hide the page when the dialer opens. If that never happens (desktop), ask anyway.
  setTimeout(() => { if (S.pendingCall && !U.leftForCall && !document.hidden) openCallFeedback(); }, 4000);
}
document.addEventListener('visibilitychange', () => {
  if (VIEWER) { liveVisible(); ecgSync(); return; }
  if (!document.hidden) U.visibleAt = Date.now();
  manageWake(); ecgSync();
  if (document.hidden) { if (S.pendingCall) U.leftForCall = true; return; }
  if (S.pendingCall && U.leftForCall) { U.leftForCall = false; setTimeout(openCallFeedback, 350); }
  if (S.session && !S.session.ended) syncNow();
});
let lastStale = false;
setInterval(() => {
  const st = isStale(S.session);
  if (st !== lastStale) { lastStale = st; ecgSync(); if (U.tab === 'meet' && !U.route && S.session) renderMain(); }
}, 3000);
setInterval(() => { $$('[data-ago]').forEach(el => { el.textContent = ago(+el.dataset.ago || 0); }); $$('[data-since]').forEach(el => { el.textContent = vcRun(+el.dataset.since); }); }, 5000);

