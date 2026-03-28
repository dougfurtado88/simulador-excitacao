"""
execution/bump_version.py
Incrementa a versão e adiciona entrada no changelog do Simulador_Excitacao.html.

Uso:
    python execution/bump_version.py --version V0.13 --desc "Descrição da mudança"
    python execution/bump_version.py --version V0.13 --desc "Descrição" --date 2026-04-01
"""

import re
import sys
import os
import argparse
from datetime import date

SIMULATOR_FILE = "Simulador/Simulador_Excitacao.html"
INDEX_FILE     = "Simulador/index.html"


def get_current_version(content):
    match = re.search(r"APP_VERSION\s*=\s*'([^']+)'", content)
    return match.group(1) if match else None


def bump(content, new_version, description, new_date):
    # 1. Atualizar APP_VERSION
    old_ver = get_current_version(content)
    if not old_ver:
        print("ERRO: APP_VERSION não encontrado.")
        sys.exit(1)

    content = re.sub(
        r"(APP_VERSION\s*=\s*)'[^']+'",
        f"\\1'{new_version}'",
        content
    )

    # 2. Inserir no início do CHANGELOG (após o '[')
    # Escapar aspas simples na descrição
    safe_desc = description.replace("'", "\\'")
    new_entry = f"  {{ v:'{new_version}', d:'{new_date}', t:'{safe_desc}' }},\n"

    content = re.sub(
        r"(const CHANGELOG\s*=\s*\[)\s*\n",
        f"\\1\n{new_entry}",
        content
    )

    return content, old_ver


def main():
    parser = argparse.ArgumentParser(description="Incrementa versão do simulador")
    parser.add_argument("--version", required=True, help="Nova versão (ex: V0.13)")
    parser.add_argument("--desc", required=True, help="Descrição da mudança")
    parser.add_argument("--date", default=str(date.today()), help="Data (YYYY-MM-DD)")
    args = parser.parse_args()

    if not re.match(r'^V\d+\.\d+$', args.version):
        print(f"ERRO: formato de versão inválido '{args.version}'. Use V0.XX")
        sys.exit(1)

    if not os.path.exists(SIMULATOR_FILE):
        print(f"ERRO: Arquivo não encontrado: {SIMULATOR_FILE}")
        sys.exit(1)

    with open(SIMULATOR_FILE, encoding="utf-8") as f:
        content = f.read()

    current = get_current_version(content)
    print(f"Versão atual:  {current}")
    print(f"Nova versão:   {args.version}")
    print(f"Data:          {args.date}")
    print(f"Descrição:     {args.desc}")
    print()

    confirm = input("Confirmar? (s/N): ").strip().lower()
    if confirm != "s":
        print("Operação cancelada.")
        sys.exit(0)

    new_content, old_ver = bump(content, args.version, args.desc, args.date)

    # Backup em .tmp/
    os.makedirs(".tmp", exist_ok=True)
    backup_file = f".tmp/Simulador_Excitacao_{old_ver}_backup.html"
    with open(backup_file, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Backup salvo em: {backup_file}")

    with open(SIMULATOR_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Versão atualizada para {args.version} em {SIMULATOR_FILE}")

    # Atualizar fallback estático no index.html (badge, spec-card, footer)
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, encoding="utf-8") as f:
            idx = f.read()
        idx = re.sub(r'(id="app-ver-badge">)[^<]+', f'\\g<1>{args.version}', idx)
        idx = re.sub(r'(id="app-ver-spec">)[^<]+',  f'\\g<1>{args.version}', idx)
        idx = re.sub(r'(id="app-ver-footer">)[^<]+', f'\\g<1>{args.version}', idx)
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            f.write(idx)
        print(f"Versão atualizada em {INDEX_FILE} (fallback estático)")

    print()
    print("Próximo passo — commit:")
    print(f'  git add {SIMULATOR_FILE} {INDEX_FILE}')
    print(f'  git commit -m "{args.version}: {args.desc}"')
    print(f'  git push')


if __name__ == "__main__":
    main()
