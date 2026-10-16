# Tests

`python3 tests/smoke.py` runs the app in a headless, phone-sized Chromium and walks through
the core flows: staff list import and update, Settings and the update check, About, Directory,
tracking a meeting, a demo meeting (heartbeat, tagging, pull to refresh), the VC Desk and the
attendance image, tab swipes, and ending a session. It prints PASS/FAIL per check and exits 1
if anything fails.

- Run it from the repository root before every push.
- It uses `fake-udairo.js`: same format as the real staff list, made-up people. The real
  `udairo.js` must never be committed.
- Google sign-in, the Meet API and the phone dialer are not exercised. Check those on a phone.
- Needs Python 3 and Playwright with Chromium.
