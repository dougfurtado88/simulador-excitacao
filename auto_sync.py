"""
auto_sync.py — Sincronização automática com GitHub
Monitora alterações na pasta do projeto e faz commit + push automaticamente.

Uso: python auto_sync.py
"""

import subprocess
import time
import os
import sys
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ── Configuração ──────────────────────────────────────────────
REPO_DIR   = os.path.dirname(os.path.abspath(__file__))
DEBOUNCE   = 8       # segundos de espera após última alteração antes de commitar
GIT        = r"C:\Program Files\Git\bin\git.exe"

# Pastas/arquivos ignorados pelo watcher (além do .gitignore)
IGNORE_PATTERNS = {
    '.git', '__pycache__', '.claude',
    'auto_sync.py',  # não commita o próprio script em loop
}

# ── Helpers ───────────────────────────────────────────────────
def run(cmd, cwd=REPO_DIR):
    result = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def log(msg, prefix=""):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {prefix}{msg}")

def git_has_changes():
    out, _, _ = run([GIT, "status", "--porcelain"])
    return bool(out.strip())

def git_commit_push(changed_files):
    # Resumo dos arquivos alterados (máx 3)
    names = [os.path.basename(f) for f in changed_files[:3]]
    suffix = f" +{len(changed_files)-3} mais" if len(changed_files) > 3 else ""
    msg = f"auto: {', '.join(names)}{suffix}"

    run([GIT, "add", "-A"])
    out, err, code = run([GIT, "commit", "-m", msg])
    if code != 0:
        log(f"Commit ignorado: {err or 'sem alterações'}", "  ")
        return False

    log(f"Commit: {msg}", "  ✔ ")

    out, err, code = run([GIT, "push"])
    if code == 0:
        log("Push para GitHub — OK", "  ✔ ")
        return True
    else:
        log(f"Falha no push: {err}", "  ✖ ")
        return False

# ── Watcher ───────────────────────────────────────────────────
class SyncHandler(FileSystemEventHandler):
    def __init__(self):
        self.pending  = set()
        self.last_evt = 0

    def _should_ignore(self, path):
        parts = path.replace("\\", "/").split("/")
        return any(p in IGNORE_PATTERNS for p in parts)

    def on_any_event(self, event):
        if event.is_directory:
            return
        if self._should_ignore(event.src_path):
            return
        rel = os.path.relpath(event.src_path, REPO_DIR)
        self.pending.add(rel)
        self.last_evt = time.time()

    def flush_if_ready(self):
        if not self.pending:
            return
        if time.time() - self.last_evt < DEBOUNCE:
            return
        if not git_has_changes():
            self.pending.clear()
            return

        changed = list(self.pending)
        self.pending.clear()
        log(f"Alterações detectadas: {len(changed)} arquivo(s)")
        git_commit_push(changed)

# ── Main ──────────────────────────────────────────────────────
if __name__ == "__main__":
    os.chdir(REPO_DIR)

    print("=" * 55)
    print("  SimExcitação — Auto-Sync GitHub")
    print("=" * 55)
    print(f"  Repositório: {REPO_DIR}")
    print(f"  Debounce:    {DEBOUNCE}s após última alteração")
    print(f"  Para parar:  Ctrl + C")
    print("=" * 55)

    # Verifica se git está configurado
    out, _, code = run([GIT, "remote", "get-url", "origin"])
    if code != 0:
        print("  ERRO: repositório git não configurado.")
        sys.exit(1)
    print(f"  Remote: {out}")
    print()

    handler  = SyncHandler()
    observer = Observer()
    observer.schedule(handler, REPO_DIR, recursive=True)
    observer.start()
    log("Monitorando alterações...")

    try:
        while True:
            handler.flush_if_ready()
            time.sleep(1)
    except KeyboardInterrupt:
        log("Encerrando...")
        observer.stop()
    observer.join()
    log("Auto-sync encerrado.")
