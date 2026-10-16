/* Hazri · actions.js — Button actions (ACT), click and input wiring, and app start-up. Loads last.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

/* ───────────────────────── actions ───────────────────────── */
async function doCreate() {
  const d = U.draft;
  const when = d.when ? new Date(d.when).toISOString() : '';
  const details = { when, agenda: d.agenda.trim(), headedBy: d.headedBy.trim() };
  if (details.agenda) S.recentAgendas = [details.agenda, ...(S.recentAgendas || []).filter(a => a !== details.agenda)].slice(0, 8);
  if (S.session && !(await confirmSheet('Replace the current board?', 'Starting a new meeting closes the board for <b>' + esc(S.session.meetingCode) + '</b>. Your tags stay saved.', 'Start new meeting'))) return;
  if (d.demo) {
    S.session = startDemo(details, d.expected);
    save(); U.draft = null; leaveRoute(); U.boardTab = 'miss'; render(); syncNow(); return;
  }
  if (!S.settings.clientId) { toast('Add your Google Client ID in Settings first.'); return; }
  setCreateBusy(true);
  try {
    S.settings.controls = { ...d.controls };
    const { space, note } = await googleCreate(d.controls);
    S.session = newSession({ source: 'google', spaceName: space.name, meetingUri: space.meetingUri, meetingCode: space.meetingCode, details, expected: d.expected, controlsNote: note });
    S.lastMeet = { code: space.meetingCode, at: now(), how: 'created' };
    save(); U.draft = null; U.boardTab = 'miss';
    go({ name: 'share' });
    scheduleSync(8000);
  } catch (e) {
    setCreateBusy(false);
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
/* ───────────────────────── boot ───────────────────────── */
if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href)) navigator.serviceWorker.register('sw.js').catch(() => {});
if (!VIEWER) checkPersist().then(() => { if (U.tab === 'settings') renderMain(); });
try { history.replaceState({ rc: 'root' }, ''); history.pushState({ rc: 'guard' }, ''); } catch (e) {}
// A live link pasted into a tab that already shows Hazri only changes the #part, which doesn't reload
// the page; reload so it opens in the right mode (and the other way round).
addEventListener('hashchange', () => { if (VIEWER !== /^#[\w-]{22}$/.test(location.hash)) location.reload(); });
if (VIEWER) liveBoot();
else {
  render();
  if (S.session && !S.session.ended) syncNow();
  if (S.pendingCall) setTimeout(openCallFeedback, 600); // app was reloaded while the call was on
}
window.__rc = { S, board, suggest, LH, LV, liveLink };
