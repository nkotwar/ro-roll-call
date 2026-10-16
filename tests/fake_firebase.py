"""
A tiny local stand-in for the Firebase Realtime Database REST API, used only by tests/smoke.py.
Speaks the same requests Hazri uses (GET, PUT, DELETE, streaming GET) and enforces the same rules
as the real database (/live/<id>/pub/board, /live/<id>/pub/calls/<key>, /live/<id>/seen/<viewer>; strings with size caps).
"""
import json, re, threading, http.server, socketserver

class Store:
    def __init__(self):
        self.tree, self.lock, self.subs = {}, threading.Lock(), []   # subs: (path_parts, queue)
    def get(self, parts):
        o = self.tree
        for k in parts:
            if not isinstance(o, dict) or k not in o: return None
            o = o[k]
        return o
    def put(self, parts, val):
        with self.lock:
            if val is None:
                o = self.tree
                for k in parts[:-1]:
                    o = o.get(k) if isinstance(o, dict) else None
                    if o is None: break
                if isinstance(o, dict): o.pop(parts[-1], None)
                self._prune()
            else:
                o = self.tree
                for k in parts[:-1]: o = o.setdefault(k, {})
                o[parts[-1]] = val
            for sp, q in list(self.subs):
                n = min(len(sp), len(parts))
                if sp[:n] == parts[:n]: q.append(json.dumps({'path': '/', 'data': self.get(sp)}))
    def _prune(self):
        def p(o):
            if not isinstance(o, dict): return o
            for k in list(o):
                o[k] = p(o[k])
                if o[k] in (None, {}): del o[k]
            return o
        p(self.tree)

def allowed(parts, method, val):
    if len(parts) < 2 or parts[0] != 'live' or len(parts[1]) < 22: return False
    rest = parts[2:]
    if method == 'DELETE': return True
    if method == 'GET': return len(rest) >= 1 and rest[0] in ('pub', 'seen')
    ok_str = lambda n: isinstance(val, str) and len(val) < n
    if rest == ['pub', 'board']: return ok_str(150000)
    if len(rest) == 3 and rest[:2] == ['pub', 'calls']: return ok_str(3000)
    if len(rest) == 2 and rest[0] == 'seen': return ok_str(3000)
    return False

def make(store):
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'
        def log_message(self, *a): pass
        def cors(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET,PUT,DELETE,PATCH,OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        def parts(self):
            path = self.path.split('?')[0]
            m = re.match(r'^/(.*)\.json$', path)
            return [p for p in m.group(1).split('/') if p] if m else None
        def reply(self, code, obj):
            b = json.dumps(obj).encode()
            self.send_response(code); self.cors()
            self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b)))
            self.end_headers(); self.wfile.write(b)
        def do_OPTIONS(self):
            self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()
        def do_GET(self):
            parts = self.parts()
            if parts is None: return self.reply(404, {'error': 'not found'})
            if not allowed(parts, 'GET', None): return self.reply(401, {'error': 'Permission denied'})
            if 'text/event-stream' in self.headers.get('Accept', ''):
                self.send_response(200); self.cors()
                self.send_header('Content-Type', 'text/event-stream'); self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                q = [json.dumps({'path': '/', 'data': store.get(parts)})]
                store.subs.append((parts, q))
                try:
                    import time
                    while True:
                        while q: self.wfile.write(f'event: put\ndata: {q.pop(0)}\n\n'.encode()); self.wfile.flush()
                        time.sleep(0.05)
                except Exception: pass
                finally: store.subs[:] = [s for s in store.subs if s[1] is not q]
                return
            self.reply(200, store.get(parts))
        def do_PUT(self):
            parts = self.parts(); n = int(self.headers.get('Content-Length') or 0)
            try: val = json.loads(self.rfile.read(n) or b'null')
            except Exception: return self.reply(400, {'error': 'bad json'})
            if parts is None or not allowed(parts, 'PUT', val): return self.reply(401, {'error': 'Permission denied'})
            store.put(parts, val); self.reply(200, val)
        def do_DELETE(self):
            parts = self.parts()
            if parts is None or not allowed(parts, 'DELETE', None): return self.reply(401, {'error': 'Permission denied'})
            store.put(parts, None); self.reply(200, None)
    return H

def start():
    store = Store()
    class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True
    srv = TS(('127.0.0.1', 0), make(store))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, store, f'http://127.0.0.1:{srv.server_address[1]}'
