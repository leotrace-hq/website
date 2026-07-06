#!/usr/bin/env python3
"""Dev server: static files with caching disabled, so the browser always
sees the current code. (Production hosting sets its own cache policy.)

Usage: python3 serve.py [port]   — defaults to 4175
"""
import functools
import http.server
import os
import sys

SITE_DIR = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4175
    handler = functools.partial(NoCacheHandler, directory=SITE_DIR)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer(('', port), handler)
    print(f'serving {SITE_DIR} with no-store caching on :{port}')
    server.serve_forever()
