"""
execution/extract_pdf.py
Extrai texto de PDFs usando pdfplumber.
Salva resultado em .tmp/pdf_extract_<nome>.txt

Uso:
    python execution/extract_pdf.py --file "Normas/Estudo/arquivo.pdf"
    python execution/extract_pdf.py --file "Normas/Estudo/arquivo.pdf" --pages 1,2,3
"""

import argparse
import os
import sys

def extract_pdf(filepath, pages=None):
    try:
        import pdfplumber
    except ImportError:
        print("ERRO: pdfplumber não instalado. Execute: pip install pdfplumber")
        sys.exit(1)

    if not os.path.exists(filepath):
        print(f"ERRO: Arquivo não encontrado: {filepath}")
        sys.exit(1)

    results = []
    with pdfplumber.open(filepath) as pdf:
        total = len(pdf.pages)
        page_nums = pages if pages else list(range(1, total + 1))

        for num in page_nums:
            if num < 1 or num > total:
                print(f"AVISO: página {num} fora do intervalo (1–{total}), ignorada.")
                continue
            page = pdf.pages[num - 1]
            text = page.extract_text() or ""
            results.append(f"\n{'='*60}\n PÁGINA {num}/{total}\n{'='*60}\n{text}")

    return "\n".join(results)


def main():
    parser = argparse.ArgumentParser(description="Extrai texto de PDF")
    parser.add_argument("--file", required=True, help="Caminho para o PDF")
    parser.add_argument("--pages", default=None,
                        help="Páginas separadas por vírgula (ex: 1,2,3). Omitir = todas.")
    args = parser.parse_args()

    pages = None
    if args.pages:
        try:
            pages = [int(p.strip()) for p in args.pages.split(",")]
        except ValueError:
            print("ERRO: --pages deve ser números separados por vírgula (ex: 1,2,3)")
            sys.exit(1)

    text = extract_pdf(args.file, pages)

    # Salvar em .tmp/
    os.makedirs(".tmp", exist_ok=True)
    basename = os.path.splitext(os.path.basename(args.file))[0]
    # Remove caracteres inválidos para nome de arquivo
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in basename)
    outfile = f".tmp/pdf_extract_{safe_name}.txt"

    with open(outfile, "w", encoding="utf-8") as f:
        f.write(text)

    print(text[:1000])  # Preview no console
    print(f"\n{'='*60}")
    print(f"Texto completo salvo em: {outfile}")
    print(f"Total de caracteres: {len(text)}")


if __name__ == "__main__":
    main()
