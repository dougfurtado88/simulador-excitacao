"""
server.py — Servidor local para o SimExcitação PWA
Uso: python server.py
Acesse: http://localhost:8080
"""

import http.server
import socketserver
import webbrowser
import threading
import os

# ── Configuração ─────────────────────────────────────────────
PORT = 8080
HOST = "localhost"

# Muda para a pasta onde este script está (pasta Simulador/)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# ── Handler com MIME types corretos para PWA ─────────────────
class PWAHandler(http.server.SimpleHTTPRequestHandler):

    MIME_TYPES = {
        ".html": "text/html; charset=utf-8",
        ".js":   "application/javascript",
        ".json": "application/json",
        ".svg":  "image/svg+xml",
        ".css":  "text/css",
        ".ico":  "image/x-icon",
        ".png":  "image/png",
        ".woff2":"font/woff2",
    }

    def end_headers(self):
        # Headers necessários para Service Worker funcionar
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return self.MIME_TYPES.get(ext, "application/octet-stream")

    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {format % args}")


# ── Abrir navegador após 1 s ──────────────────────────────────
def open_browser():
    import time
    time.sleep(1)
    url = f"http://{HOST}:{PORT}"
    print(f"\n  Abrindo {url} no navegador...\n")
    webbrowser.open(url)


# ── Main ──────────────────────────────────────────────────────
if __name__ == "__main__":
    threading.Thread(target=open_browser, daemon=True).start()

    with socketserver.TCPServer((HOST, PORT), PWAHandler) as httpd:
        httpd.allow_reuse_address = True
        print("=" * 52)
        print("  SimExcitação — Servidor Local")
        print("=" * 52)
        print(f"  URL:    http://{HOST}:{PORT}")
        print(f"  Pasta:  {os.getcwd()}")
        print(f"  Para encerrar: Ctrl + C")
        print("=" * 52)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Servidor encerrado.")
