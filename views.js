/* Hazri · views.js — Screens: home, About, create, VC Desk, live board, directory, branch page, settings.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

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
    <div class="home-art"><svg viewBox="0 0 320 200" class="home-arc" id="home-arc"><circle cx="30.9" cy="144.3" r="9" class="ha-s ha-f" data-r="2" data-d="490"/><circle cx="38.4" cy="113.9" r="9" class="ha-s ha-o" data-r="2" data-d="470"/><circle cx="53.0" cy="86.2" r="9" class="ha-s ha-f" data-r="2" data-d="450"/><circle cx="73.8" cy="62.7" r="9" class="ha-s ha-f" data-r="2" data-d="430"/><circle cx="99.6" cy="44.9" r="9" class="ha-s ha-f" data-r="2" data-d="410"/><circle cx="128.9" cy="33.8" r="9" class="ha-s ha-f" data-r="2" data-d="390"/><circle cx="160.0" cy="30.0" r="9" class="ha-s ha-l" data-r="2" data-d="370"/><circle cx="191.1" cy="33.8" r="9" class="ha-s ha-f" data-r="2" data-d="390"/><circle cx="220.4" cy="44.9" r="9" class="ha-s ha-o" data-r="2" data-d="410"/><circle cx="246.2" cy="62.7" r="9" class="ha-s ha-f" data-r="2" data-d="430"/><circle cx="267.0" cy="86.2" r="9" class="ha-s ha-f" data-r="2" data-d="450"/><circle cx="281.6" cy="113.9" r="9" class="ha-s ha-f" data-r="2" data-d="470"/><circle cx="289.1" cy="144.3" r="9" class="ha-s ha-o" data-r="2" data-d="490"/><circle cx="61.2" cy="144.4" r="8.5" class="ha-s ha-f" data-r="1" data-d="337"/><circle cx="70.9" cy="114.6" r="8.5" class="ha-s ha-f" data-r="1" data-d="311"/><circle cx="89.3" cy="89.3" r="8.5" class="ha-s ha-f" data-r="1" data-d="285"/><circle cx="114.6" cy="70.9" r="8.5" class="ha-s ha-f" data-r="1" data-d="259"/><circle cx="144.4" cy="61.2" r="8.5" class="ha-s ha-l" data-r="1" data-d="233"/><circle cx="175.6" cy="61.2" r="8.5" class="ha-s ha-f" data-r="1" data-d="232"/><circle cx="205.4" cy="70.9" r="8.5" class="ha-s ha-o" data-r="1" data-d="259"/><circle cx="230.7" cy="89.3" r="8.5" class="ha-s ha-f" data-r="1" data-d="285"/><circle cx="249.1" cy="114.6" r="8.5" class="ha-s ha-f" data-r="1" data-d="311"/><circle cx="258.8" cy="144.4" r="8.5" class="ha-s ha-f" data-r="1" data-d="337"/><circle cx="91.8" cy="144.4" r="8" class="ha-s ha-o" data-r="0" data-d="181"/><circle cx="105.3" cy="116.4" r="8" class="ha-s ha-f" data-r="0" data-d="144"/><circle cx="129.6" cy="96.9" r="8" class="ha-s ha-f" data-r="0" data-d="107"/><circle cx="160.0" cy="90.0" r="8" class="ha-s ha-f" data-r="0" data-d="70"/><circle cx="190.4" cy="96.9" r="8" class="ha-s ha-f" data-r="0" data-d="107"/><circle cx="214.7" cy="116.4" r="8" class="ha-s ha-l" data-r="0" data-d="144"/><circle cx="228.2" cy="144.4" r="8" class="ha-s ha-f" data-r="0" data-d="181"/><g class="ha-pod-g" data-act="arc-tap" role="button" tabindex="0" aria-label="Tap the emblem"><circle cx="160" cy="160" r="48" fill="transparent"/><circle cx="160" cy="160" r="40" class="ha-pod"/><image href="cbi-emblem.png" x="137" y="137" width="46" height="46" draggable="false"/></g></svg><div class="ha-name">Hazri</div><div class="ha-sub">VC attendance · Regional Office Udaipur</div></div>
    ${ready ? '' : `<div class="banner info">${I.info}<div><b>Google is not connected yet.</b> Demo meetings work now. To create real meetings, add your Client ID in <button class="btn-link" data-act="tab" data-tab="settings" style="border:0;background:none;padding:0;color:var(--accent);font-weight:600">Settings</button>.</div></div>`}`;
}

/* Home art: tap the emblem for a roll-call ripple; five quick taps, or hold it for 2 sec and let go, for confetti. */
const ARC = { anims: [], taps: [], hold: null, skipClick: false };
function arcTap() {
  if (ARC.skipClick) { ARC.skipClick = false; return; }   // the click that ends a long press isn't a tap
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
/* Hold to charge: the seats light up row by row from the inside out and the emblem sinks a little.
   Let go early and it all eases back; hold the full 2 sec and it breathes,
   ready, and letting go (any time after) pops it with confetti. */
const HOLD_MS = 2000;
function arcHoldStart(e) {
  const svgEl = $('#home-arc'); if (!svgEl || ARC.hold) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#146CC0';
  const pod = $('.ha-pod-g', svgEl);
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (err) {} };
  const h = ARC.hold = { t0: performance.now(), anims: [], timers: [], ready: false, pod, reduce, buzz, id: e.pointerId };
  try { pod.setPointerCapture(e.pointerId); } catch (err) {}
  // Wait a beat before showing anything, so ordinary taps stay ordinary.
  h.timers.push(setTimeout(() => {
    if (ARC.hold !== h) return;
    ARC.anims.forEach(a => a.cancel()); ARC.anims = [];
    const T = HOLD_MS - 180, ease = 'cubic-bezier(.35,0,.25,1)';
    if (!reduce) h.anims.push(pod.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)' }], { duration: T, easing: ease, fill: 'forwards' }));
    $$('.ha-s', svgEl).forEach(c => {
      const cs = getComputedStyle(c), at = (+c.dataset.d - 70) / 420 * (T - 500) + 150;
      h.anims.push(c.animate([{ fill: cs.fill, fillOpacity: cs.fillOpacity, strokeOpacity: cs.strokeOpacity }, { fill: acc, fillOpacity: .9, strokeOpacity: 0 }], { duration: 320, delay: at, easing: 'ease-out', fill: 'forwards' }));
    });
    [.25, .5, .75].forEach(f => h.timers.push(setTimeout(() => buzz(6), 180 + T * f)));
    h.timers.push(setTimeout(() => {                    // fully charged: breathe and wait for the release
      if (ARC.hold !== h) return;
      h.ready = true; buzz([18, 40, 18]);
      if (!reduce) h.breath = pod.animate([{ transform: 'scale(.9)' }, { transform: 'scale(.95)' }, { transform: 'scale(.9)' }], { duration: 900, iterations: Infinity, easing: 'ease-in-out', composite: 'replace' });
    }, T));
  }, 180));
}
function arcHoldEnd(cancelled) {
  const h = ARC.hold; if (!h) return;
  ARC.hold = null; h.timers.forEach(clearTimeout);
  const held = performance.now() - h.t0;
  if (held > 260) { ARC.skipClick = true; setTimeout(() => { ARC.skipClick = false; }, 400); }
  if (h.ready && !cancelled) {                          // pop
    if (h.breath) h.breath.cancel();
    const from = h.pod.getBoundingClientRect();
    h.anims.forEach(a => a.cancel());
    if (!h.reduce) ARC.anims.push(h.pod.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1.16)', offset: .35 }, { transform: 'scale(.97)', offset: .7 }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' }));
    $$('.ha-s', $('#home-arc')).forEach(c => ARC.anims.push(c.animate([{ fill: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), fillOpacity: .9, strokeOpacity: 0 }, { fillOpacity: getComputedStyle(c).fillOpacity, strokeOpacity: getComputedStyle(c).strokeOpacity }], { duration: 900, delay: 100 + (+c.dataset.d) * .6, easing: 'ease-out', fill: 'backwards' })));
    confetti(from, h.reduce); h.buzz([25, 50, 35]);
    return;
  }
  // Let go early: everything eases back from wherever it got to, quickly.
  if (h.breath) h.breath.cancel();
  h.anims.forEach(a => { try { a.updatePlaybackRate(-3.5); a.play(); a.finished.then(() => a.cancel()).catch(() => {}); } catch (err) { a.cancel(); } });
}
document.addEventListener('pointerdown', e => { if (e.button === 0 && e.target.closest && e.target.closest('#home-arc .ha-pod-g')) arcHoldStart(e); });
document.addEventListener('pointerup', e => { if (ARC.hold && e.pointerId === ARC.hold.id) arcHoldEnd(false); });
document.addEventListener('pointercancel', e => { if (ARC.hold && e.pointerId === ARC.hold.id) arcHoldEnd(!ARC.hold.ready); });
document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('#home-arc')) e.preventDefault(); });
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

/* ───────────────────────── about: a short field guide ───────────────────────── */
function viewAbout() {
  renderTop('About', { back: true });
  const ecg = (path, col, extra = '') => `<svg viewBox="0 0 120 28" class="ab-ecg" aria-hidden="true"><line x1="0" y1="18" x2="120" y2="18" stroke="#D20838" stroke-opacity=".25"/>${extra}<path d="${path}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const beat = 'M0 18H34l3-2 3 2h4l2 3 4-17 4 19 3-5h6c4 0 6-3 9-3s5 3 9 3H120';
  const ch = (n, kicker, title, body) => `<section class="ab-ch"><div class="ab-num">${n}</div><div class="ab-body"><div class="ab-kicker">${kicker}</div><h3>${title}</h3>${body}</div></section>`;
  return `<article class="ab">
  <header class="ab-hero">
    <img src="icon-192.png" alt="" class="ab-icon">
    <h2>Hazri</h2>
    <p class="ab-dek">A short field guide to taking attendance at a VC, branch by branch.</p>
  </header>

  ${ch('I', 'The idea', 'Every branch, accounted for', `
    <p class="ab-lede">Hazri creates the Google Meet for your VC, shares it with the time and agenda, and then quietly watches the door. As people walk in, it tells you which branches are present, which came and went, and which you still need to call.</p>
    <blockquote>Tag a person once, and Hazri remembers them in every meeting after.</blockquote>`)}

  ${ch('II', 'A meeting, start to finish', 'Six steps', `
    <ol class="ab-steps">
      <li><b>Create</b><span>Time, agenda and who heads it. Hazri makes the Meet link.</span></li>
      <li><b>Share</b><span>One tap sends the invite on WhatsApp.</span></li>
      <li><b>Watch</b><span>Joiners appear within seconds of entering.</span></li>
      <li><b>Tag</b><span>Match a new face to a person or branch, once.</span></li>
      <li><b>Call</b><span>Branches not yet in are a tap away.</span></li>
      <li><b>Report</b><span>Share an attendance image when you are done.</span></li>
    </ol>`)}

  ${ch('III', 'Who is who', 'From a name on screen to a branch', `
    <div class="ab-chain"><span>Google account<br><small>or display name</small></span><i>→</i><span>Person<br><small>from your staff list</small></span><i>→</i><span>Branch<br><small>counted present</small></span></div>
    <p>Google tells Hazri only the name each joiner shows. The first time someone appears, you tag them. From then on the tag follows their Google account (or name), and through their employee ID it follows them to a new branch after a transfer.</p>`)}

  ${ch('IV', 'Reading the board', 'Three colours, one line', `
    <div class="ab-legend">
      <div><i class="ab-dot in"></i><b>In now</b><span>Someone from the branch is in the meeting.</span></div>
      <div><i class="ab-dot left"></i><b>Joined &amp; left</b><span>They came, so they know. No need to call.</span></div>
      <div><i class="ab-dot miss"></i><b>Not joined</b><span>Call them. The number is one tap away.</span></div>
    </div>
    <p>The line under the header is the meeting's pulse.</p>
    <div class="ab-pulse">
      <figure>${ecg(beat, 'var(--accent)')}<figcaption>A steady beat: the meeting is live. More people, a quicker rhythm.</figcaption></figure>
      <figure>${ecg('M0 18H50l3-1 4-14 4 17 3-3h56', '#D20838')}<figcaption>A red spike: someone just joined.</figcaption></figure>
      <figure>${ecg('M0 18H50l3 1 4 7 4-9 3 1h56', '#E8A317')}<figcaption>An amber dip: someone just left.</figcaption></figure>
      <figure>${ecg('M0 18H30c6 0 8-2 12-2s6 2 12 2H120', 'var(--accent)')}<figcaption>A faint ripple: the room is empty, or nobody has arrived yet.</figcaption></figure>
      <figure>${ecg('M0 18H120', '#8A97A8')}<figcaption>Grey and flat: Hazri has lost touch with Google. Pull down to retry.</figcaption></figure>
    </div>`)}

  ${ch('V', 'Before the VC', 'The calling round', `
    <p>Open any branch in the Directory and call the manager or anyone listed. When you come back, Hazri asks how it went and marks the branch <em>Informed</em>, <em>Recall later</em>, <em>No answer</em> or <em>Denied</em>, with the time. Start a new round before each VC.</p>`)}

  ${ch('VI', 'Where your data lives', 'On this phone, and nowhere else', `
    <p>Your staff list, tags and settings are stored only on this phone. The app's code is public; your data is not part of it. Google sees the meeting itself and nothing about your staff.</p>
    <p class="ab-note">Keep a backup from Settings now and then, especially before changing phones.</p>`)}

  ${ch('VII', 'Small things', 'Worth knowing', `
    <ul class="ab-tips">
      <li>Pull down on the live board to refresh at once.</li>
      <li>Swipe left or right to move between tabs.</li>
      <li>The clock on the meeting card counts from the VC time you set.</li>
      <li>Tap the emblem on the home screen. Then try it five times.</li>
    </ul>`)}

  <footer class="ab-foot"><img src="cbi-emblem.png" alt=""><div>Hazri · version ${APP_VERSION}<br>Built by Nitin Kotwar (139535), via PDUDAIRO</div></footer>
  </article>`;
}

/* ───────────────────────── views: create + share ───────────────────────── */
function draftDefault(demo) {
  return { demo: !!demo, when: toLocalInput(nextHalfHour()), agenda: AGENDA_DEFAULT, headedBy: defaultHead(), expected: expectedDefault(), controls: { ...S.settings.controls } };
}
const headLabel = p => `${pretty(p.name)}, ${p.designation.replace(' - HCM', '')}`;
function headPicks() {
  const ro = S.units.find(u => u.isRO); if (!ro) return [];
  return ro.staff.filter(p => /Regional Head|Chief Manager/i.test(p.designation)).map(headLabel);
}
/* Default "Headed by": whoever the staff list names as Regional Head, so it follows any region's file. */
function defaultHead() {
  const ro = S.units.find(u => u.isRO); if (!ro) return '';
  const rh = ro.staff.find(p => /Regional Head/i.test(p.designation));
  return rh ? headLabel(rh) : '';
}
/* Agenda quick picks: tap to add or remove; several can be combined. */
const AGENDA_PRESETS = ['Month Progress', 'SMA Review', 'CASA Review', 'Portfolio Review', 'Non-Core Parameters Review', 'Ongoing Campaign Review'];
const AGENDA_DEFAULT = 'Month Progress';
const agendaParts = t => (t || '').split(/\s*[,;\n]\s*/).map(x => x.trim()).filter(Boolean);
function toggleAgenda(text, item) {
  const parts = agendaParts(text), i = parts.findIndex(x => x.toLowerCase() === item.toLowerCase());
  if (i >= 0) parts.splice(i, 1); else parts.push(item);
  return parts.join(', ');
}
function agendaPicks(text, scope, recent = []) {
  const on = new Set(agendaParts(text).map(x => x.toLowerCase()));
  return `<div class="picks" data-agenda-picks="${scope}">${AGENDA_PRESETS.map(a => `<button type="button" class="pick" aria-pressed="${on.has(a.toLowerCase())}" data-act="agenda-toggle" data-scope="${scope}" data-v="${esc(a)}">${esc(a)}</button>`).join('')}${recent.map(a => `<button type="button" class="pick" data-act="draft-pick" data-k="agenda" data-v="${esc(a)}">${esc(a.length > 34 ? a.slice(0, 32) + '…' : a)}</button>`).join('')}</div>`;
}
function syncAgendaPicks(scope, text) {
  const on = new Set(agendaParts(text).map(x => x.toLowerCase()));
  $$(`[data-agenda-picks="${scope}"] [data-act="agenda-toggle"]`).forEach(b => b.setAttribute('aria-pressed', on.has(b.dataset.v.toLowerCase())));
}
function seg(name, value, opts) {
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" aria-pressed="${v === value}" data-act="draft-set" data-k="${name}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
}
/* The Create button: a heartbeat line runs across it while Google makes the room. */
function createBtn(d) {
  const n = d.expected.filter(code => !unitByCode.get(code)?.isRO).length;
  const sub = (d.demo ? 'Practice run' : 'Google Meet') + ` · ${n} branch${n === 1 ? '' : 'es'} to attend`;
  return `<button type="button" class="cbtn" data-act="create" id="create-btn">
    <span class="cbtn-ic">${d.demo ? I.play : I.video}</span>
    <span class="cbtn-txt"><b>${d.demo ? 'Start demo' : 'Create meeting'}</b><small>${esc(sub)}</small></span>
    <span class="cbtn-go">${I.chev}</span>
  </button>`;
}
function setCreateBusy(on) {
  const b = $('#create-btn'); if (!b) return;
  b.disabled = on; b.classList.toggle('busy', on);
  if (on) btnEcgStart(b); else btnEcgStop(b);
  const t = $('.cbtn-txt b', b), sm = $('.cbtn-txt small', b);
  if (on) { b.dataset.l = t.textContent; b.dataset.s = sm.textContent; t.textContent = 'Creating Meet link…'; }
  else if (b.dataset.l) { t.textContent = b.dataset.l; sm.textContent = b.dataset.s; }
}
function viewCreate() {
  const d = U.draft;
  renderTop(d.demo ? 'Demo meeting' : 'New meeting', { back: true });
  if (!d.demo) warmGoogle();
  const c = d.controls;
  const preset = new Set(AGENDA_PRESETS.map(a => a.toLowerCase()));
  const agendas = (S.recentAgendas || []).filter(a => !agendaParts(a).every(x => preset.has(x.toLowerCase()))).slice(0, 3);
  const exp = d.expected.length;
  const roIn = d.expected.some(code => unitByCode.get(code)?.isRO);
  return `
  <form id="create-form" class="card pad" style="display:flex;flex-direction:column;gap:16px" autocomplete="off">
    ${d.demo ? `<div class="banner info">${I.play}<div>A demo meeting simulates branches joining every few seconds, so you can practise tagging. Nothing is sent to Google.</div></div>` : ''}
    <div class="when-row"><span class="flabel">Time of VC</span><label class="when-pill">${I.clock}<span class="when-txt">${esc(whenPill(d.when))}</span><input type="datetime-local" id="f-when" value="${esc(d.when)}" data-draft="when" aria-label="Time of VC" required></label></div>
    <div class="field"><label for="f-agenda">Agenda</label><textarea class="input" id="f-agenda" data-draft="agenda" rows="2" placeholder="Tap below or type your own">${esc(d.agenda)}</textarea>
      ${agendaPicks(d.agenda, 'draft', agendas)}</div>
    <div class="field"><label for="f-head">Headed by</label><input class="input" id="f-head" data-draft="headedBy" value="${esc(d.headedBy)}" placeholder="Name and designation">
      <div class="picks">${headPicks().map(h => `<button type="button" class="pick" aria-pressed="${h === d.headedBy}" data-act="draft-pick" data-k="headedBy" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>
    <div class="field"><span class="flabel">Who should attend</span>
      ${attField(d.expected)}</div>
  </form>
  <div class="create-wrap">
    ${createBtn(d)}
    ${!d.demo && !S.settings.clientId ? `<p class="hint" style="text-align:center;margin:0">Google isn't connected yet. Add your Client ID in Settings, or start a demo.</p>` : ''}
  </div>
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
`;
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
  renderTop('VC Desk', { back: true });
  if (!s) return '';
  const d = s.details, msg = shareText(s), b = board();
  return `
  <section class="card pad m-card">
    <div class="m-head"><div class="grow"><div class="m-title">Invite</div><div class="sub mono">${esc(s.meetingCode)}</div></div>
      <div class="icon-row">
        <a class="mini-btn wa-solid" id="wa-link" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" aria-label="Send invite on WhatsApp">${I.chat}Send invite</a>
        <button class="round-btn" data-act="share-native" aria-label="Share invite">${I.share}</button>
        <button class="round-btn" data-act="copy-share" aria-label="Copy invite">${I.copy}</button>
      </div></div>
    ${s.controlsNote ? `<div class="banner warn">${I.alert}<div>${esc(s.controlsNote)}</div></div>` : ''}
    <div class="when-row"><span class="flabel">Time of VC</span><label class="when-pill">${I.clock}<span class="when-txt" id="m-when-txt">${esc(whenPill(d.when))}</span><input type="datetime-local" id="m-when" data-det="when" aria-label="Time of VC" value="${esc(d.when ? toLocalInput(new Date(d.when)) : '')}"></label></div>
    <div class="field"><label for="m-agenda">Agenda</label><textarea class="input" id="m-agenda" rows="2" data-det="agenda" placeholder="Tap below or type your own">${esc(d.agenda)}</textarea>
      ${agendaPicks(d.agenda, 'det')}</div>
    <div class="field"><label for="m-head">Headed by</label><input class="input" id="m-head" data-det="headedBy" value="${esc(d.headedBy)}" placeholder="Name and designation">
      <div class="picks" id="m-head-picks">${headPicks().map(h => `<button type="button" class="pick" aria-pressed="${h === d.headedBy}" data-act="det-pick" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>
  </section>

  <section class="card pad m-card">
    <div class="m-head"><div class="grow"><div class="m-title">Attendance</div><div class="sub">${b.joined} of ${b.total} joined · ${b.inCount} in now</div></div>
      <div class="icon-row">
        <button class="mini-btn primary" data-act="attendance-image">${I.share}Image</button>
        <button class="round-btn" data-act="copy-summary" aria-label="Copy attendance as text">${I.copy}</button>
      </div></div>
  </section>

  ${liveDeskCard()}

  <section class="m-card-plain">
    <div class="sec-label" style="margin:0 0 8px">Who should attend</div>
    ${attField(s.expected, 'edit-expected')}
  </section>

  <button class="link-btn" data-act="to-board">Go to live board ${I.chev}</button>`;
}
const whenPill = w => w ? new Date(w).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + fmtClock(w) : 'Set time';
function onDetail(t) {
  const s = S.session; if (!s) return;
  const k = t.dataset.det;
  s.details[k] = k === 'when' ? (t.value ? new Date(t.value).toISOString() : '') : t.value.trim();
  if (k === 'agenda' && s.details.agenda) S.recentAgendas = [s.details.agenda, ...(S.recentAgendas || []).filter(a => a !== s.details.agenda)].slice(0, 8);
  save();
  const wa = $('#wa-link'); if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(shareText(s));
  if (k === 'when') { const tx = $('#m-when-txt'); if (tx) tx.textContent = whenPill(s.details.when); }
  if (k === 'headedBy') $$('#m-head-picks .pick').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === s.details.headedBy));
}

/* ───────────────────────── views: live board ───────────────────────── */
function ring(joined, total) {
  const r = 40, c = 2 * Math.PI * r, f = total ? joined / total : 0;
  return `<div class="ring" role="img" aria-label="${joined} of ${total} branches joined"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="${r}" fill="none" stroke-width="8" style="stroke:var(--surface-2)"/><circle cx="46" cy="46" r="${r}" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${f ? c * (1 - f) : c}" style="stroke:var(--in);transition:stroke-dashoffset .6s"/></svg><div class="num"><b>${joined}/${total}</b><span>branches</span></div></div>`;
}
// Minutes since the scheduled Time of VC (not since the Meet link opened).
function vcRun(t) {
  const d = (Date.now() - t) / 60000;
  const fmt = a => a < 60 ? `${a} min` : `${Math.floor(a / 60)}h ${String(a % 60).padStart(2, '0')}m`;
  return d < 0 ? `${fmt(Math.max(1, Math.ceil(-d)))} to go` : d < 1 ? 'Started' : fmt(Math.floor(d));
}
// The status row is gone: the header heartbeat shows live / empty / ended. Only problems are shown here.
function basePollMs(s) { return s.source === 'demo' ? 4000 : s.state === 'empty' ? Math.max(EMPTY_POLL_MS, S.settings.poll * 1000) : Math.max(10, S.settings.poll) * 1000; }
/* Rush window: from 3 min before the VC time to 5 min after, branches pour in, so check every 5 sec
   whatever the setting says. About 4 Google calls per check = under 50 a minute, against Google's 600 a minute per user. */
const RUSH_BEFORE = 3 * 60e3, RUSH_AFTER = 5 * 60e3, RUSH_MS = 5000;
function rushStart(s) { return s && s.source !== 'demo' && s.details && s.details.when ? Date.parse(s.details.when) - RUSH_BEFORE : NaN; }
function inRush(s, t = now()) {
  const a = rushStart(s);
  return !!a && !s.ended && t >= a && t < a + RUSH_BEFORE + RUSH_AFTER && !(s.rushOffUntil > t);
}
function pollMs(s) { return inRush(s) ? RUSH_MS : basePollMs(s); }
function isStale(s) {
  if (!s || s.ended || document.hidden) return false;
  if (now() - (U.visibleAt || 0) < 12000) return false;          // just reopened: give the first check a moment
  const since = s.lastSync || s.createdAt;
  return now() - since > 3 * basePollMs(s) + 5000;    // judged on the normal pace, so a fast window doesn't cry wolf
}
function syncLine(s) {
  if (s.error && s.error.code !== 'net') {
    const re = s.error.code === 'reauth' || s.error.code === 'noclient';
    return `<div class="banner ${re ? 'warn' : 'err'}">${I.alert}<div class="grow">${esc(s.error.msg)}${re ? `<div style="margin-top:8px"><button class="btn btn-ghost" data-act="reconnect" style="min-height:38px;padding:8px 12px">${I.refresh}Reconnect</button></div>` : ''}</div></div>`;
  }
  if (isStale(s)) return `<div class="stale-line">${I.alert}<span>Last update <span data-ago="${s.lastSync || s.createdAt}">${ago(s.lastSync || s.createdAt)}</span> · pull down to retry</span></div>`;
  return '';
}
function personChips(list, onlyActive) {
  return list.filter(x => !onlyActive || x.p.active).map(x => {
    const lbl = x.t.p ? pretty(personById.get(x.t.p)?.name || x.p.name) : x.p.name;
    return `<button class="chip ${x.p.active ? 'in' : 'left'}" data-act="tag" data-key="${esc(x.p.key)}" style="border:0">${esc(lbl)}</button>`;
  }).join('');
}
function bmOf(u) { return u.staff.find(p => p.bm) || u.staff[0]; }
function callNumber(u) { return u.mobile || u.phone || (bmOf(u) && bmOf(u).phone) || ''; }
function ptrHint() {
  // Once at the start of every meeting session (demo, created or tracked).
  const s = S.session; if (!s || s.hintShown) return;
  s.hintShown = true; save();
  setTimeout(() => {
    if (U.tab !== 'meet' || U.route) return;
    const el = document.createElement('div'); el.className = 'ptr-hint'; el.setAttribute('aria-label', 'Pull down to refresh'); el.innerHTML = I.down;
    el.style.top = ($('#top').getBoundingClientRect().bottom + 3) + 'px';
    document.body.appendChild(el);
    const m = $('#main');
    requestAnimationFrame(() => { el.classList.add('show'); m.classList.add('nudge'); });
    setTimeout(() => { el.remove(); m.classList.remove('nudge'); }, 2700);
  }, 700);
}
function viewBoard() {
  const s = S.session, b = board();
  ptrHint();
  renderTop(s.source === 'demo' ? 'Demo meeting' : 'Live board', { actions: `${s.source === 'demo' ? '' : `<a class="join-btn" href="${esc(s.meetingUri)}" target="_blank" rel="noopener" aria-label="Join the meeting yourself">${I.video}Join</a>`}<button class="icon-btn" data-act="go-share" aria-label="VC Desk">${I.sliders}</button><button class="icon-btn end-btn" data-act="end-ask" aria-label="End session">${I.stop}</button>` });
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
      <div class="row meet-line"><span class="mono muted" style="font-size:12px;flex:none">${esc(s.meetingCode)}</span>${d.when ? `<span class="sub ellipsis">${esc(new Date(d.when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + fmtClock(d.when))}</span>` : ''}${s.ended ? `<span class="vc-run">${I.stop}<span>Ended</span></span>` : d.when ? `<span class="vc-run">${I.clock}<span data-since="${Date.parse(d.when)}">${vcRun(Date.parse(d.when))}</span></span>` : ''}</div>
      ${d.agenda ? `<div class="agenda">${esc(d.agenda)}</div>` : ''}
      ${d.headedBy ? `<div class="sub">Headed by ${esc(d.headedBy)}</div>` : ''}
      ${liveBadge()}
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
    return staff.map(p => staffRow(p, ro)).join('') || `<div class="empty">No RO staff match “${esc(U.dirQ)}”.</div>`;
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
/* Release number lives only in version.js (loaded before this file). */
const APP_VERSION = self.HAZRI_VERSION || 0;
async function checkUpdate(force) {
  if (U.update && U.update.busy) return;
  if (U.update && !force && Date.now() - U.update.at < 60e3) return;
  U.update = { busy: true, at: Date.now(), latest: (U.update || {}).latest };
  if (U.tab === 'settings' && !U.route) renderMain();
  try {
    const r = await fetch('version.js?check=' + Date.now(), { cache: 'no-store' });
    const m = /HAZRI_VERSION\s*=\s*(\d+)/.exec(await r.text());
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
  await Promise.all(['./', 'index.html', 'version.js', 'core.js', 'google.js', 'meeting.js', 'heartbeat.js', 'ui.js', 'sheets.js', 'views.js', 'live.js', 'actions.js', 'manifest.webmanifest', 'icon-192.png', 'cbi-emblem.png'].map(f => fetch(f, { cache: 'reload' }).catch(() => {})));
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
    <div class="setting"><div class="grow"><div class="title">Check for joiners every</div><div class="sub">Shorter is faster but uses more data. From 3 min before to 5 min after the VC time, Hazri checks every 5 sec anyway.</div></div>
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

