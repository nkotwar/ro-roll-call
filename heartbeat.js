/* Hazri · heartbeat.js — The ECG line under the header while a meeting is live.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

/* ───────────────────────── header ECG ─────────────────────────
   While a meeting is live, the header's red line becomes a monitor-style heartbeat.
   Beats come at a random rhythm that quickens with the number of people in; new joiners
   add a tall red spike (max 3 per refresh), leavers a small dip (max 2). Faint ripple when empty. */
const ECG = { cv: null, ctx: null, mode: 'off', n: 0, queue: [], sid: null, raf: 0, last: 0, buf: null, red: null, head: 0, cur: null, dist: 0, gap: 0, W: 0, H: 0, dpr: 1, col: '#146CC0', reduce: false };
const ECG_SPEED = 110, ECG_QRS = 64, ECG_SCALE = 11;
const gauss = (t, c, w) => Math.exp(-((t - c) ** 2) / (2 * w * w));
const ecgShape = t => .16 * gauss(t, .12, .045) - .14 * gauss(t, .40, .018) + gauss(t, .46, .022) - .32 * gauss(t, .53, .02) + .26 * gauss(t, .80, .07);
function ecgNormal() {
  if (ECG.mode === 'stale') { ECG.gap = 200; return { len: ECG_QRS, fn: () => 0, red: 0 }; }   // lost signal: flat
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
  const base = H - 20, L = buf.length;
  c.fillStyle = 'rgba(210,8,56,.25)'; c.fillRect(0, base - .5, W, 1);
  c.lineWidth = 1.6; c.lineJoin = c.lineCap = 'round';
  for (let k = 1; k < L; k++) {
    const i = (ECG.head - k + L) % L, j = (i + 1) % L;
    if (isNaN(buf[i]) || isNaN(buf[j])) continue;
    c.globalAlpha = Math.max(0, 1 - k / L * .9);
    const f = red[i] || red[j];
    c.strokeStyle = f === 1 ? '#D20838' : f === 2 ? '#E8A317' : ECG.col;
    c.beginPath(); c.moveTo(i, base - buf[i] * ECG_SCALE); c.lineTo(i + 1, base - buf[j] * ECG_SCALE); c.stroke();
  }
  c.globalAlpha = 1;
  if (!ECG.reduce) {
    const hy = base - (buf[ECG.head] || 0) * ECG_SCALE;
    const hc = ECG.mode === 'stale' ? '#8A97A8' : '#D20838';
    c.shadowColor = hc; c.shadowBlur = 8; c.fillStyle = hc;
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
  const s = S.session, ov = VIEWER ? liveEcgState() : null;
  const n = ov ? ov.n : s ? Object.values(s.parts).filter(p => p.active).length : 0;
  const mode = ov ? ov.mode : !s || s.ended ? 'off' : isStale(s) ? 'stale' : n > 0 ? 'live' : 'faint';
  ECG.mode = mode; ECG.n = n;
  document.documentElement.classList.toggle('ecg-on', mode !== 'off');
  if (mode === 'off') { if (ECG.cv) ECG.cv.remove(); cancelAnimationFrame(ECG.raf); ECG.raf = 0; ECG.queue = []; return; }
  if (!ECG.cv) { ECG.cv = document.createElement('canvas'); ECG.cv.className = 'ecg'; ECG.cv.setAttribute('aria-hidden', 'true'); ECG.ctx = ECG.cv.getContext('2d'); }
  const top = $('#top'); if (ECG.cv.parentNode !== top) top.appendChild(ECG.cv);
  ECG.col = mode === 'stale' ? '#8A97A8' : getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#146CC0';
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
  if (ECG.mode === 'off' || ECG.mode === 'stale' || ECG.reduce) return;
  const j = Math.min(joined, 3);
  for (let i = 0; i < j; i++) {
    const A = i === 2 && joined > 3 ? 1.75 : 1.4 * (.95 + Math.random() * .1);
    ECG.queue.push({ len: 30, red: 1, fn: t => A * gauss(t, .45, .085) - .28 * A * gauss(t, .62, .06) });
  }
  for (let i = 0; i < Math.min(left, 2); i++) { const A = 1.35 * (.95 + Math.random() * .1); ECG.queue.push({ len: 30, red: 2, fn: t => -A * gauss(t, .45, .085) + .28 * A * gauss(t, .62, .06) }); }
}
addEventListener('resize', () => { if (ECG.mode !== 'off') { ecgResize(); ecgDraw(); } });


/* ───────────────────────── Create button monitor ─────────────────────────
   While Google makes the room, the Create button shows the same heartbeat as the header:
   same beat shape and sweep speed, fading trail and a glowing tip, drawn in the button's text colour. */
function btnEcgStart(btn) {
  if (!btn || btn.querySelector('canvas.cbtn-mon')) return;
  const cv = document.createElement('canvas'); cv.className = 'cbtn-mon'; cv.setAttribute('aria-hidden', 'true');
  btn.prepend(cv);
  const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr;
  const col = getComputedStyle(btn).color, L = Math.ceil(W) + 2, buf = new Float32Array(L).fill(NaN);
  const base = H - 9, scale = 17, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ic = btn.querySelector('.cbtn-ic');
  let head = 0, cur = null, dist = 0, gap = 20, last = 0;
  const sample = () => {
    for (;;) {
      if (cur && dist < ECG_QRS) return cur * ecgShape(dist++ / ECG_QRS);
      cur = null;
      if (gap > 0) { gap--; return 0; }
      cur = .9 + Math.random() * .2; dist = 0;
      if (ic && ic.animate) ic.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: .35 }, { transform: 'scale(1)' }], { duration: 380, delay: 220, easing: 'ease-out' });   // icon beats with the trace
      gap = Math.max(12, (.75 + Math.random() * .35) * ECG_SPEED - ECG_QRS);   // a calm, steady ~70 bpm
    }
  };
  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.6; ctx.lineJoin = ctx.lineCap = 'round'; ctx.strokeStyle = col;
    for (let k = 1; k < L; k++) {
      const i = (head - k + L) % L, j = (i + 1) % L;
      if (isNaN(buf[i]) || isNaN(buf[j])) continue;
      ctx.globalAlpha = Math.max(0, .7 * (1 - k / L * .9));
      ctx.beginPath(); ctx.moveTo(i, base - buf[i] * scale); ctx.lineTo(i + 1, base - buf[j] * scale); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const hy = base - (buf[head] || 0) * scale;
    ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(head, hy, 2.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  };
  if (reduce) {   // still trace, no sweep
    for (let x = 0; x < L; x++) { const ph = x % 110; buf[x] = ph < ECG_QRS ? ecgShape(ph / ECG_QRS) : 0; }
    head = L - 1; draw(); return;
  }
  const loop = ts => {
    if (!cv.isConnected) return;
    const dt = last ? Math.min(.1, (ts - last) / 1000) : 1 / 60; last = ts;
    let n = Math.round(ECG_SPEED * dt);
    while (n-- > 0) { head = (head + 1) % L; buf[head] = sample(); for (let k = 1; k <= 14; k++) buf[(head + k) % L] = NaN; }
    draw(); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function btnEcgStop(btn) { const cv = btn && btn.querySelector('canvas.cbtn-mon'); if (cv) cv.remove(); }
