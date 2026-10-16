"""
Hazri smoke tests. Run from the repository root before every push:

    python3 tests/smoke.py

Needs Python 3 with Playwright (Chromium). Serves this folder on a local port,
opens the app in a phone-sized headless browser and walks through the core flows
using the FAKE staff list in tests/fake-udairo.js. Google sign-in and Meet are not
exercised (demo meetings stand in for them); check real meetings on the phone.
Exit code 0 = all passed.
"""
import functools, http.server, json, os, socketserver, sys, tempfile, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fake_firebase
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAKE = os.path.join(ROOT, 'tests', 'fake-udairo.js')
results = []
import time
_t = [time.time()]


def check(name, cond, detail=''):
    results.append((name, bool(cond)))
    t = time.time(); dt = t - _t[0]; _t[0] = t
    print(('  PASS  ' if cond else '  FAIL  ') + f'{dt:5.1f}s  ' + name + (f'  ({detail})' if detail and not cond else ''))


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=ROOT)
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'


def modified_staff_file():
    """A copy of the fake list with one transfer, one leaver and one new joiner."""
    src = open(FAKE, encoding='utf-8').read()
    import json, re
    data = json.loads(re.search(r'const UDAIRO_DATA = (\{.*\});', src, re.S).group(1))
    b = data['branches']
    moved = b[1]['staff'].pop()            # transfer: last person of Alpha Nagar -> Bravo Road
    b[2]['staff'].append(moved)
    b[3]['staff'].pop()                    # leaver
    b[4]['staff'].append({'name': 'Zara Newjoin', 'empId': '999999', 'designation': 'Manager', 'phone': '9000099999'})
    f = tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8')
    f.write('const UDAIRO_DATA = ' + json.dumps(data) + ';')
    f.close()
    return f.name


def main():
    httpd, base = serve()
    fb, store, db = fake_firebase.start()          # local stand-in for the live-link database
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 360, 'height': 800}, has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        S = lambda expr: pg.evaluate('(() => { const S = window.__rc.S; return ' + expr + '; })()')

        print('First run')
        pg.goto(base + '/index.html?livedb=' + db); pg.wait_for_timeout(800)
        check('asks for the staff list', pg.locator('[data-act="import-staff"]').count() > 0)
        with pg.expect_file_chooser() as fc:
            pg.click('[data-act="import-staff"]')
        fc.value.set_files(FAKE); pg.wait_for_timeout(1200)
        check('imports 10 offices', S('S.units.length') == 10)
        check('Metro branch not expected by default', S("S.units.find(u => u.category === 'METRO').expect") is False)
        check('home shows the arc art', pg.locator('#home-arc').count() == 1)
        pg.click('.ha-pod-g'); pg.wait_for_timeout(150)
        check('emblem tap starts the ripple', pg.evaluate('document.getAnimations().length') > 0)

        print('Settings and About')
        pg.click('[data-tab="settings"]')
        try: pg.wait_for_function("document.querySelector('#main').innerText.includes('latest version')", timeout=4000)
        except Exception: pass
        txt = pg.inner_text('#main')
        check('update check reaches version.js', 'latest version' in txt, txt[-200:])
        pg.click('.brand-btn'); pg.wait_for_timeout(300)
        check('app icon opens About', pg.inner_text('#top h1') == 'About')
        pg.click('[data-act="back"]'); pg.wait_for_timeout(200)
        check('back returns to Settings', pg.inner_text('#top h1') == 'Settings')

        print('Staff list update')
        with pg.expect_file_chooser() as fc:
            pg.click('#main [data-act="import-staff"]')
        fc.value.set_files(modified_staff_file()); pg.wait_for_timeout(500)
        sheet = pg.inner_text('.sheet') if pg.locator('.sheet').count() else ''
        check('update shows what changed', 'new' in sheet and 'moved' in sheet and 'no longer listed' in sheet, sheet[:200])
        pg.click('.sheet #cf-ok'); pg.wait_for_timeout(400)
        check('transfer applied', S("S.units.find(u => u.code === 9102).staff.length") == 4)

        print('Directory')
        pg.click('[data-tab="dir"]'); pg.wait_for_timeout(300)
        check('branch list shows 9 branches', pg.locator('#dir-list [data-act="open-unit"]').count() == 9)
        pg.click('[data-act="dir-filter"][data-k="ro"]'); pg.wait_for_timeout(300)
        names = pg.eval_on_selector_all('#dir-list .item .title', 'els => els.map(e => e.textContent.trim())')
        check('RO staff sorted A to Z', names == sorted(names, key=str.lower) and len(names) == 5)
        check('RO staff have call buttons', pg.locator('#dir-list .icon-btn.call').count() == 5)
        pg.click('[data-act="dir-filter"][data-k="branches"]'); pg.wait_for_timeout(200)
        pg.click('#dir-list [data-act="open-unit"] >> nth=0'); pg.wait_for_timeout(300)
        check('branch page opens with call buttons', pg.locator('.icon-btn.call').count() > 0)
        pg.click('[data-act="back"]'); pg.wait_for_timeout(200)

        print('Fast checks around VC time')
        R = lambda mins, extra='': pg.evaluate("(() => { const s = { source: 'google', ended: false, state: 'waiting', details: { when: new Date(Date.now() + (%s) * 60e3).toISOString() } %s }; return pollMs(s); })()" % (mins, extra))
        normal = R(60)
        check('normal pace an hour before', normal == S('S.settings.poll') * 1000, normal)
        check('every 5 sec from 3 min before', R(2.9) == 5000 and R(0) == 5000)
        check('every 5 sec until 5 min after', R(-4.9) == 5000 and R(-5.1) == normal)
        check('empty room still checked fast in the window', R(-1, ", state: 'empty'") == 5000)
        check('backs off if Google says slow down', R(0, ', rushOffUntil: Date.now() + 60e3') == normal)
        check('no fast pace without a VC time or in demo', pg.evaluate("pollMs({ source: 'google', state: 'live', details: { when: '' } })") == normal
              and pg.evaluate("pollMs({ source: 'demo', details: { when: new Date().toISOString() } })") == 4000)

        print('Track an existing meeting')
        pg.click('[data-tab="meet"]'); pg.wait_for_timeout(200)
        pg.click('[data-act="open-attach"]'); pg.wait_for_timeout(400)
        pg.fill('#a-link', 'Join: https://meet.google.com/abc-defg-hij please'); pg.dispatch_event('#a-link', 'input')
        check('track sheet opens with a paste button', pg.locator('#a-paste').count() == 1)
        pg.click('.sheet [data-act="sheet-close"]'); pg.wait_for_timeout(400)

        print('Demo meeting')
        pg.click('[data-act="open-create"][data-demo="1"]'); pg.wait_for_timeout(300)
        check('create screen has the time pill', pg.locator('.when-pill').count() == 1)
        check('create button sits right below the form', pg.evaluate("document.querySelector('#create-form').nextElementSibling.querySelector('#create-btn') !== null"))
        check('create button shows how many branches', '8 branches to attend' in pg.inner_text('#create-btn'), pg.inner_text('#create-btn'))
        check('agenda pills on one swipeable row', pg.evaluate("getComputedStyle(document.querySelector('[data-agenda-picks]')).flexWrap") == 'nowrap')
        pg.click('[data-act="pick-expected"]'); pg.wait_for_timeout(300)
        check('attendee picker lists branches', pg.locator('.att-row').count() == 9)
        pg.click('.att-row >> nth=0'); pg.click('#exp-done'); pg.wait_for_timeout(300)
        check('attendee choice remembered as default', S("S.units.filter(u => !u.isRO && u.expect).length") == 7)
        check('agenda defaults to Month Progress', pg.input_value('#f-agenda') == 'Month Progress'
              and pg.get_attribute('[data-act="agenda-toggle"][data-v="Month Progress"]', 'aria-pressed') == 'true')
        check('six agenda quick picks', pg.locator('[data-agenda-picks="draft"] .pick').count() == 6)
        pg.click('[data-agenda-picks="draft"] [data-v="SMA Review"]'); pg.wait_for_timeout(100)
        check('tapping a pick adds it', pg.input_value('#f-agenda') == 'Month Progress, SMA Review')
        pg.click('[data-agenda-picks="draft"] [data-v="Month Progress"]'); pg.wait_for_timeout(100)
        check('tapping again removes it', pg.input_value('#f-agenda') == 'SMA Review'
              and pg.get_attribute('[data-act="agenda-toggle"][data-v="Month Progress"]', 'aria-pressed') == 'false')
        check('headed by defaults to the Regional Head', pg.input_value('#f-head').endswith('Regional Head'), pg.input_value('#f-head'))
        pg.fill('[data-draft="agenda"]', 'Smoke test agenda')
        idents_before = S('Object.keys(S.idents).length')
        pg.click('[data-act="create"]')
        for _ in range(30):                 # demo joiners arrive every few seconds
            pg.wait_for_timeout(1000)
            if S('Object.keys(S.session.parts).length') >= 1: break
        check('people join the demo', S('Object.keys(S.session.parts).length') > 0)
        check('heartbeat line is live', pg.locator('#top canvas.ecg').count() == 1)
        check('meeting card shows date and timer', pg.locator('.meet-line .vc-run').count() == 1)
        pg.click('[data-act="board-tab"][data-k="people"]'); pg.wait_for_timeout(200)
        pg.click('#board-list [data-act="tag"] >> nth=0'); pg.wait_for_timeout(400)
        check('demo tag sheet says tags are not saved', 'not saved' in pg.inner_text('.sheet'))
        if pg.locator('.sheet .results > *').count() == 0:     # e.g. a phone caller: no suggestions, so search
            pg.fill('#tag-q', 'a'); pg.wait_for_timeout(300)
        pg.locator('.sheet .results > *').first.click(); pg.wait_for_timeout(300)
        check('demo tagging does not touch saved tags', S('Object.keys(S.idents).length') == idents_before)

        print('Pull to refresh')
        before = S('S.session.demo.tick')
        cdp = ctx.new_cdp_session(pg)
        pg.evaluate('window.scrollTo(0, 0)')
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 180, 'y': 250}]})
        for i in range(1, 17):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 180, 'y': 250 + i * 12}]}); pg.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); pg.wait_for_timeout(1200)
        check('pull down refreshes without reloading', S('S.session.demo.tick') > before)

        print('VC Desk')
        pg.click('[data-act="go-share"]'); pg.wait_for_timeout(400)
        check('VC Desk opens', pg.inner_text('#top h1') == 'VC Desk')
        check('Send invite button present', 'Send invite' in pg.inner_text('#wa-link'))
        check('agenda prefilled', pg.input_value('#m-agenda') == 'Smoke test agenda')
        pg.click('[data-agenda-picks="det"] [data-v="CASA Review"]'); pg.wait_for_timeout(100)
        check('VC Desk agenda pick updates the meeting', S('S.session.details.agenda') == 'Smoke test agenda, CASA Review')
        pg.click('#m-head-picks .pick >> nth=0'); pg.wait_for_timeout(100)
        check('headed-by suggestion fills the field', S('S.session.details.headedBy') == pg.input_value('#m-head') != '')

        print('Live link')
        pg.click('[data-act="live-share"]'); pg.wait_for_timeout(400)
        pg.fill('#ln-name', 'Host Tester'); pg.click('#ln-ok'); pg.wait_for_timeout(1500)
        link = pg.evaluate('window.__rc.liveLink(window.__rc.S.session.live)')
        check('share gives a link with the key after #', '#w=' in link and S('!!S.session.live'))
        raw = json.dumps(store.tree)
        check('board reaches the relay encrypted (no names readable)', 'board' in raw and 'Alpha' not in raw and 'Purohit' not in raw)
        vctx = browser.new_context(viewport={'width': 360, 'height': 800}, has_touch=True, is_mobile=True)
        vw = vctx.new_page(); vw.on('pageerror', lambda e: errors.append('viewer: ' + str(e)))
        vw.goto(link); vw.wait_for_timeout(1500)
        check('viewer is not asked for a name on opening', vw.locator('#ln-name').count() == 0)
        V = lambda expr: vw.evaluate('(() => { const LV = window.__rc.LV; return ' + expr + '; })()')
        check('viewer sees the same board', V('LV.snap && LV.snap.total') == S('window.__rc.board().total') and vw.locator('[data-act="live-tab"]').count() == 3)
        check('viewer shows no app tabs or staff import', not vw.locator('.tabs').is_visible() and vw.locator('[data-act="import-staff"]').count() == 0)
        check('viewer has Join, via pdudairo and the credit', vw.locator('#top .join-btn').count() == 1 and 'via pdudairo' in vw.inner_text('#top') and 'Built by Nitin Kotwar (139535)' in vw.inner_text('#main'))
        check('host lists the viewer as a guest', 'Guest' in pg.inner_text('#live-viewers') and S('window.__rc.LH.watchers') == 1)
        pg.click('#live-viewers .pick >> nth=0'); pg.wait_for_timeout(300); pg.fill('#lv-name', 'Ramesh'); pg.click('#lv-name-ok'); pg.wait_for_timeout(2000)
        check('host names a guest and it reaches their phone', 'Ramesh' in pg.inner_text('#live-viewers') and vw.evaluate("localStorage.getItem('hazri.name')") == 'Ramesh')
        code = vw.get_attribute('#board-list .call-btn >> nth=0', 'data-code')
        vw.click('#board-list .call-btn >> nth=0'); vw.wait_for_timeout(1500)
        check('host sees who is calling', S(f"S.calls[{code}] && S.calls[{code}].status + '/' + S.calls[{code}].by") == 'calling/Ramesh')
        vw.wait_for_timeout(3500)
        vw.click('.sheet [data-status="informed"]'); vw.wait_for_timeout(1500)
        check('call outcome from viewer reaches host', S(f"S.calls[{code}].status") == 'informed')
        pg.click('label:has(#live-lock) .switch'); pg.wait_for_timeout(1500)
        check('locking keeps current viewers watching', V('!LV.noKey && LV.e') == 1)
        v2 = browser.new_context(viewport={'width': 360, 'height': 800}).new_page(); v2.on('pageerror', lambda e: errors.append('viewer2: ' + str(e)))
        v2.goto(link); v2.wait_for_timeout(1500)
        check('a new viewer waits while locked, with the emblem to play with', v2.evaluate('window.__rc.LV.noKey') is True and v2.locator('#home-arc').count() == 1)
        v2.click('[data-act="live-rename"]'); v2.wait_for_timeout(300); v2.fill('#ln-name', 'Suresh'); v2.click('#ln-ok'); v2.wait_for_timeout(1500)
        check('waiting viewer adds a name from the footer and host sees it', 'Suresh · waiting' in pg.inner_text('#live-viewers'))
        pg.click('#live-viewers .pick.waiting'); pg.wait_for_timeout(300); pg.click('#lv-in'); pg.wait_for_timeout(2000)
        check('host lets the waiting viewer in', v2.evaluate('!!window.__rc.LV.snap && !window.__rc.LV.noKey'))
        pg.click('#live-viewers .pick:has-text("Suresh")'); pg.wait_for_timeout(300); pg.click('#lv-out'); pg.wait_for_timeout(2500)
        check('removed viewer is shut out, others keep watching', v2.evaluate('window.__rc.LV.noKey') is True and V('!LV.noKey && LV.e') == 2)
        pg.click('label:has(#live-lock) .switch'); pg.wait_for_timeout(2500)
        check('unlocking lets removed people back in', v2.evaluate('!window.__rc.LV.noKey && !!window.__rc.LV.snap'))
        vw.click('#top .brand-btn'); vw.wait_for_timeout(300)
        check('viewer logo opens About', vw.inner_text('#top h1') == 'About')
        vw.click('[data-act="back"]'); vw.wait_for_timeout(300)
        v2.click('[data-act="live-exit"]'); v2.wait_for_timeout(300); v2.click('#cf-ok'); v2.wait_for_timeout(800)
        check('viewer can stop watching', 'You stopped watching' in v2.inner_text('#main'))
        pg.click('[data-act="to-board"]'); pg.wait_for_timeout(300)
        check('board shows the live link is on', pg.locator('.live-line').count() == 1)

        print('Tabs')
        pg.click('[data-tab="dir"]'); pg.wait_for_timeout(300)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 300, 'y': 500}]})
        for i in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 300 - i * 25, 'y': 500}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); pg.wait_for_timeout(60)
        width = pg.evaluate('document.documentElement.scrollWidth')
        check('swipe moves to RO staff', pg.get_attribute('[data-act="dir-filter"][data-k="ro"]', 'aria-pressed') == 'true')
        check('page never wider than the screen while sliding', width <= 360, f'width {width}')
        pg.click('[data-tab="meet"]'); pg.wait_for_timeout(300)

        print('End')
        pg.click('[data-act="end-ask"]'); pg.wait_for_timeout(300)
        check('End asks first, offering the image', pg.locator('#end-img').count() == 1)
        pg.click('#end-yes'); pg.wait_for_timeout(400)
        check('session ends', S('S.session') is None)
        vw.wait_for_timeout(5500)
        check('viewer sees the VC has ended', 'This VC has ended' in vw.inner_text('#main'))
        check('relay data deleted after End', store.tree in ({}, {'live': {}}), json.dumps(store.tree)[:120])
        check('no script errors anywhere', not errors, '; '.join(errors)[:300])
        browser.close()
    httpd.shutdown()
    failed = [n for n, ok in results if not ok]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
