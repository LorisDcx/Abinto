#!/usr/bin/env python3
"""Lance un serveur local pour prévisualiser le site avec une vraie origine HTTP."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

if __name__ == "__main__":
    os.chdir(ROOT)
    url = f"http://{HOST}:{PORT}"
    print(f"ABINTO est disponible sur {url}")
    print("Appuyez sur Ctrl+C pour arrêter le serveur.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
