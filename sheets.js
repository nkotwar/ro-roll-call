/* Hazri · sheets.js — Bottom panels (tagging, attendees, calls, End, staff list import, backups) and the attendance image.
   Part of the app split into plain scripts that share one global scope; index.html loads them in order. */
'use strict';

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
      ${s && s.source === 'demo' && mode !== 'relink' ? `<div class="hint" style="margin:0">Demo meeting: tags here are for practice and are not saved.</div>` : ''}
      ${s && s.source !== 'demo' && mode !== 'relink' ? `<label class="setting" style="padding:4px 0"><div class="grow"><div class="title">Remember for future meetings</div><div class="sub">${kind === 'google' ? 'Recognise this Google account automatically next time' : 'Recognise this display name automatically next time'}</div></div><span class="switch"><input type="checkbox" id="tag-remember" ${rememberDefault ? 'checked' : ''}><span></span></span></label>` : ''}
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
  if (s && s.source === 'demo' && s.parts[key]) remember = false;   // demo tags stay in the demo, never saved
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
function attSummary(codes) {
  const br = S.units.filter(u => !u.isRO), sel = new Set(codes);
  const n = br.filter(u => sel.has(u.code)).length, ro = S.units.some(u => u.isRO && sel.has(u.code));
  let label;
  if (n === br.length) label = 'All branches';
  else if (!n) label = 'No branches';
  else {
    const out = br.filter(u => !sel.has(u.code));
    label = out.length <= 2 ? `All except ${out.map(u => u.name).join(' and ')}` : `${out.length} branches left out`;
  }
  return { n, total: br.length, ro, label };
}
function attField(codes, act = 'pick-expected') {
  const a = attSummary(codes);
  return `<button type="button" class="att-field" data-act="${act}">
    <span class="att-num"><b>${a.n}</b><span>of ${a.total}</span></span>
    <div class="grow"><div class="title">${esc(a.label)}</div><div class="sub">${a.ro ? 'RO staff counted too' : 'RO staff not counted'} · missing branches go to the call list</div></div>
    <span class="att-chev">${I.chev}</span></button>`;
}
function openExpected() {
  const d = U.draft; const sel = new Set(d.expected);
  const branches = S.units.filter(u => !u.isRO).sort((a, b) => a.name.localeCompare(b.name));
  const ro = S.units.find(u => u.isRO);
  const presets = [['all', 'All', u => true]];
  let q = '';
  const draw = () => {
    const n = branches.filter(u => sel.has(u.code)).length;
    $('#exp-count').textContent = `${n} of ${branches.length} branches`;
    $('#exp-done').textContent = n ? `Done · ${n} branch${n === 1 ? '' : 'es'}` : 'Done';
    $('#exp-presets').innerHTML = presets.map(([k, l, f]) => {
      const on = branches.every(u => f(u) === sel.has(u.code));
      return `<button class="pick" aria-pressed="${on}" data-expq="${k}">${l}<b>${branches.filter(f).length}</b></button>`;
    }).join('') + `<button class="pick" data-expq="none" aria-pressed="${!n}">None</button>`;
    const ql = q.trim().toLowerCase();
    const match = u => !ql || (u.name + ' ' + u.code + ' ' + (u.alpha || '')).toLowerCase().includes(ql);
    const html = branches.filter(match).map(u => `<button class="att-row" data-exp="${u.code}" aria-pressed="${sel.has(u.code)}"><span class="code">${u.code}</span><div class="grow"><div class="title">${esc(u.name)}</div>${u.category === 'METRO' ? '<div class="sub">Metro branch</div>' : ''}</div><span class="att-tick">${I.check}</span></button>`).join('');
    $('#exp-list').innerHTML = html || `<div class="empty">No branch matches “${esc(q)}”.</div>`;
  };
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Who should attend</h3><div class="sub" id="exp-count"></div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <div class="att-presets" id="exp-presets"></div>
      <div class="search-wrap">${I.search}<input class="input" id="exp-q" type="search" placeholder="Search branch or code" autocomplete="off"></div>
      ${ro ? `<label class="setting att-ro"><div class="grow"><div class="title">Count RO staff too</div><div class="sub">Treat the Regional Office like a branch</div></div><span class="switch"><input type="checkbox" id="exp-ro" ${sel.has(ro.code) ? 'checked' : ''}><span></span></span></label>` : ''}
      <div id="exp-list"></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-primary btn-block" id="exp-done">Done</button></div>`);
  draw();
  const sheet = $('.sheet');
  $('#exp-q').addEventListener('input', e => { q = e.target.value; draw(); });
  if (ro) $('#exp-ro').addEventListener('change', e => { e.target.checked ? sel.add(ro.code) : sel.delete(ro.code); });
  sheet.addEventListener('click', e => {
    const p = e.target.closest('[data-expq]');
    if (p) {
      const k = p.dataset.expq, f = (presets.find(x => x[0] === k) || [])[2];
      for (const u of branches) { sel.delete(u.code); if (f && f(u)) sel.add(u.code); }
      draw(); return;
    }
    const r = e.target.closest('[data-exp]');
    if (r) { const c = +r.dataset.exp; sel.has(c) ? sel.delete(c) : sel.add(c); draw(); }
  });
  $('#exp-done').onclick = () => {
    d.expected = S.units.map(u => u.code).filter(c => sel.has(c));
    S.units.forEach(u => { u.expect = sel.has(u.code); }); save();   // remembered for the next meeting
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

/* End session: confirm, with a last chance to share the attendance image */
function openEndSheet() {
  openSheet(`
    <div class="sheet-head"><h3 class="grow">End this session?</h3></div>
    <div class="sheet-body">
      <p class="muted" style="margin:0">The board for <b>${esc(S.session.meetingCode)}</b> will be cleared. Tags you saved stay on this phone.</p>
      <button class="btn btn-soft btn-block" id="end-img">${I.share}Share attendance image first</button>
    </div>
    <div class="sheet-foot"><button class="btn btn-ghost" style="flex:1" id="end-no">Cancel</button><button class="btn btn-danger" style="flex:1" id="end-yes">End session</button></div>`);
  $('#end-no').onclick = () => closeSheet();
  $('#end-img').onclick = () => { closeSheet(true); openAttendanceImage(); };
  $('#end-yes').onclick = () => { closeSheet(true); clearTimeout(syncTimer); S.session = null; save(); render(); toast('Session ended'); };
}
function openAttach() {
  openSheet(`
    <div class="sheet-head"><div class="grow"><h3>Track an existing meeting</h3><div class="sub">For a Meet link you created in Calendar or the Meet app</div></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.x}</button></div>
    <form class="sheet-body" id="att-form">
      <div class="field"><label for="a-link">Meet link or code</label>
        <div class="paste-wrap"><input class="input mono" id="a-link" placeholder="meet.google.com/abc-mnop-xyz" required autocapitalize="off" spellcheck="false" value="${esc(S.lastMeet ? S.lastMeet.code : '')}"><button type="button" class="paste-btn" id="a-paste">${I.copy}<span>Paste</span></button></div>
        <button type="button" class="paste-found" id="a-found" hidden></button>
        <span class="hint" id="a-hint">${S.lastMeet ? `${S.lastMeet.how === 'created' ? 'Created' : S.lastMeet.how === 'pasted' ? 'Pasted' : 'Used'} ${ago(S.lastMeet.at)}` : 'Paste a link from WhatsApp or Calendar. Hazri picks out the code.'}</span></div>
      <div class="field"><label for="a-agenda">Agenda <span class="faint">(optional)</span></label><input class="input" id="a-agenda"></div>
      <div class="banner info">${I.info}<div>You need to be the meeting's owner, or have created it from the same Google account, for Google to share who joined.</div></div>
      <button class="btn btn-primary btn-block" type="submit" id="att-go">${I.link}Start tracking</button>
    </form>`);
  const inp = $('#a-link'), pbtn = $('#a-paste'), hint = $('#a-hint');
  let selectedOnce = false;
  inp.addEventListener('focus', () => { if (!selectedOnce && inp.value) { selectedOnce = true; setTimeout(() => inp.select(), 0); } });
  const takeCode = (text, how) => {
    const code = parseCode(text); if (!code) return false;
    inp.value = code; S.lastMeet = { code, at: now(), how }; save();
    hint.textContent = (how === 'pasted' ? 'Pasted ' : 'Used ') + ago(S.lastMeet.at);
    $('#a-found').hidden = true;
    return true;
  };
  // Typing or long-press pasting a whole invite still works: the code is picked out of it.
  inp.addEventListener('paste', e => { const t = (e.clipboardData || window.clipboardData)?.getData('text'); if (t && takeCode(t, 'pasted')) e.preventDefault(); });
  pbtn.onclick = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!takeCode(t, 'pasted')) toast('No Meet link in what you copied.');
    } catch (err) { toast('Paste was not allowed. Long-press the box and choose Paste instead.'); }
  };
  // If clipboard access was allowed before, check quietly for a Meet link and offer it.
  (async () => {
    try {
      if (!navigator.permissions || !navigator.clipboard || !navigator.clipboard.readText) return;
      const st = await navigator.permissions.query({ name: 'clipboard-read' });
      if (st.state !== 'granted') return;
      const code = parseCode(await navigator.clipboard.readText());
      if (code && code !== parseCode(inp.value)) {
        const f = $('#a-found'); if (!f) return;
        f.innerHTML = `${I.copy}<span>Use the link you copied</span><b class="mono">${esc(code)}</b>`; f.hidden = false;
        f.onclick = () => takeCode(code, 'pasted');
      }
    } catch (err) {}
  })();
  $('#att-form').addEventListener('submit', async e => {
    e.preventDefault();
    const code = parseCode($('#a-link').value);
    if (!code) { toast('That doesn\'t look like a Meet link. It should contain a code like abc-mnop-xyz.'); return; }
    const btn = $('#att-go'); btn.disabled = true; btn.textContent = 'Connecting…';
    try {
      const space = await G.call('spaces/' + code, { interactive: true });
      if (!S.lastMeet || S.lastMeet.code !== (space.meetingCode || code)) S.lastMeet = { code: space.meetingCode || code, at: now(), how: 'entered' };
      S.session = newSession({ source: 'google', attached: true, spaceName: space.name, meetingUri: space.meetingUri, meetingCode: space.meetingCode || code, details: { when: '', agenda: $('#a-agenda').value.trim(), headedBy: defaultHead() } });
      save(); closeSheet(); U.boardTab = 'miss'; setTab('meet'); syncNow();
    } catch (err) {
      btn.disabled = false; btn.innerHTML = I.link + 'Start tracking';
      toast(err.code === 404 || err.code === 403 ? 'Google could not find that meeting under your account.' : err.message);
    }
  });
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
  'share-native': () => { const t = shareText(S.session); if (navigator.share) navigator.share({ text: t }).catch(() => {}); else copyText(t, 'Message copied. Paste it in any app.'); },
  'copy-share': () => copyText(shareText(S.session), 'Message copied'),
  'agenda-toggle': el => {
    const det = el.dataset.scope === 'det', inp = $(det ? '#m-agenda' : '#f-agenda'); if (!inp) return;
    inp.value = toggleAgenda(inp.value, el.dataset.v);
    if (det) onDetail(inp); else U.draft.agenda = inp.value;
    syncAgendaPicks(el.dataset.scope, inp.value);
  },
  'det-pick': el => { const inp = $('#m-head'); if (!inp) return; inp.value = el.dataset.v; onDetail(inp); },
  'to-board': () => { leaveRoute(); U.tab = 'meet'; render(); window.scrollTo(0, 0); },
  'go-share': () => go({ name: 'share' }),
  'board-tab': el => { U.boardTab = el.dataset.k; renderMain(); },
  reconnect: async () => { try { await G.getToken(true); S.session && (S.session.error = null); syncNow(); } catch (e) { toast(e.message); } },
  tag: el => openTag(el.dataset.key, el.dataset.mode),
  assign: el => {
    const sh = $('.sheet'); const key = sh.dataset.key;
    const t = el.dataset.u != null ? { u: +el.dataset.u } : { p: el.dataset.p };
    const rem = $('#tag-remember'); assign(key, t, sh.dataset.mode === 'relink' || !S.session ? true : rem ? rem.checked : true);
  },
  untag: () => {
    const key = $('.sheet').dataset.key; const prev = S.idents[key]; const prevT = S.session && S.session.temp[key];
    if (S.session && S.session.source === 'demo' && S.session.parts[key]) { S.session.temp[key] = { none: true }; save(); closeSheet(); render(); toast('Tag removed', () => { if (prevT) S.session.temp[key] = prevT; else delete S.session.temp[key]; save(); render(); }); return; }
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
  'end-ask': () => openEndSheet(),
  'edit-expected': () => { closeSheet(true); U.draft = { expected: S.session.expected.slice() }; U.sessionDraft = U.draft; openExpected(); },
  'import-staff': () => pickImport('staff'),
  'arc-tap': () => arcTap(),
  about: () => go({ name: 'about' }),
  'check-update': () => checkUpdate(true),
  'apply-update': () => applyUpdate(),
  'attendance-image': () => { closeSheet(true); openAttendanceImage(); },
  'copy-summary': () => { copyText(summaryText(), 'Attendance summary copied'); closeSheet(); },
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
  if (t.dataset.draft === 'agenda') syncAgendaPicks('draft', t.value);
  if (t.dataset.det === 'agenda') syncAgendaPicks('det', t.value);
  if (t.dataset.det && t.dataset.det !== 'when') onDetail(t);
  if (t.id === 'dir-q') { U.dirQ = t.value; $('#dir-list').innerHTML = dirList(); }
  if (t.dataset.setting === 'clientId') { S.settings.clientId = cleanClientId(t.value) || t.value.trim(); save(); const b = $('[data-act="signin"]'); if (b) b.disabled = !S.settings.clientId; }
});
document.addEventListener('click', e => { const p = e.target.closest('.when-pill'); if (!p) return; const i = $('input', p); try { i.showPicker && i.showPicker(); } catch (err) {} });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.det === 'when') onDetail(t);
  if (t.dataset.draft === 'when' && U.draft) { U.draft.when = t.value; const tx = t.parentNode.querySelector('.when-txt'); if (tx) tx.textContent = whenPill(t.value); }
  if (t.dataset.ctrl && U.draft) { U.draft.controls[t.dataset.ctrl] = t.checked; renderMain(); }
  if (t.dataset.setting === 'poll') { S.settings.poll = +t.value; save(); scheduleSync(); }
  if (t.dataset.setting === 'keepAwake') { S.settings.keepAwake = t.checked; save(); manageWake(); }
});
document.addEventListener('submit', e => { if (e.target.id === 'create-form') { e.preventDefault(); doCreate(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

