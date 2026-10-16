/* Hazri · google.js — Google sign-in (with renewal before expiry) and the Meet API.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

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
    return this.request(S.settings.signedIn ? '' : 'consent');
  },
  // Ask Google for a fresh 1-hour token. Must run inside a tap: Google opens a small window.
  request(prompt) {
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
      client.requestAccessToken({ prompt });
    });
  },
  // Tokens last an hour and a static app can't renew them in the background. So when a live
  // Google meeting is running and less than 15 minutes remain, the next tap renews it quietly.
  refreshing: false,
  needsRefresh() {
    const s = S.session;
    return !!(this.token && S.settings.signedIn && s && s.source !== 'demo' && !s.ended && !this.refreshing &&
      this.exp - now() < 15 * 60e3 && window.google && google.accounts && google.accounts.oauth2);
  },
  async refreshOnTap() {
    if (!this.needsRefresh()) return;
    this.refreshing = true;
    try { await this.request(''); } catch (e) { /* next tap tries again; on expiry the board shows Reconnect */ }
    finally { setTimeout(() => { this.refreshing = false; }, 30000); }
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
if (G.token) G.loadLib().catch(() => {});
addEventListener('pointerup', () => G.refreshOnTap(), true);

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

