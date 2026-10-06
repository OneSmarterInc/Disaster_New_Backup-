# Minimal Upstash-style REST shim over fakeredis (with Lua) for verifying lib/store.js.
import json, fakeredis
from http.server import BaseHTTPRequestHandler, HTTPServer
r = fakeredis.FakeRedis(decode_responses=True)
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_POST(self):
        args = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        try: res = {'result': r.execute_command(*args)}
        except Exception as e: res = {'error': str(e)}
        b = json.dumps(res).encode(); self.send_response(200); self.send_header('content-type','application/json'); self.end_headers(); self.wfile.write(b)
HTTPServer(('127.0.0.1', 8799), H).serve_forever()
