"""
execution/check_version.py
Lê e exibe a versão atual e o changelog do Simulador_Excitacao.html.

Uso:
    python execution/check_version.py
    python execution/check_version.py --changelog   # mostra entradas do changelog
"""

import re
import sys
import os
import argparse

SIMULATOR_FILE = "Simulador/Simulador_Excitacao.html"


def get_version(content):
    match = re.search(r"APP_VERSION\s*=\s*'([^']+)'", content)
    return match.group(1) if match else None


def get_changelog(content):
    # Extrai array CHANGELOG do JS
    match = re.search(r"const CHANGELOG\s*=\s*\[(.*?)\];", content, re.DOTALL)
    if not match:
        return []

    raw = match.group(1)
    entries = re.findall(r"\{\s*v:'([^']+)',\s*d:'([^']+)',\s*t:'([^']+)'\s*\}", raw)
    return entries  # lista de (version, date, description)


def main():
    parser = argparse.ArgumentParser(description="Verifica versão do simulador")
    parser.add_argument("--changelog", action="store_true", help="Exibe entradas do changelog")
    args = parser.parse_args()

    if not os.path.exists(SIMULATOR_FILE):
        print(f"ERRO: Arquivo não encontrado: {SIMULATOR_FILE}")
        sys.exit(1)

    with open(SIMULATOR_FILE, encoding="utf-8") as f:
        content = f.read()

    version = get_version(content)
    if not version:
        print("ERRO: APP_VERSION não encontrado no arquivo.")
        sys.exit(1)

    print(f"Versão atual: {version}")
    print(f"Arquivo: {SIMULATOR_FILE}")

    if args.changelog:
        entries = get_changelog(content)
        if entries:
            print(f"\nChangelog ({len(entries)} entradas):")
            print(f"{'Versão':<10} {'Data':<12} Descrição")
            print("-" * 70)
            for v, d, t in entries:
                print(f"{v:<10} {d:<12} {t}")
        else:
            print("\nChangelog não encontrado.")


if __name__ == "__main__":
    main()
