# Diretiva: Extrair e Analisar Conteúdo de PDFs de Normas

## Objetivo
Extrair texto de PDFs técnicos (normas, artigos) em `Normas/` para subsidiar melhorias no simulador,
sem precisar abrir os arquivos manualmente.

## Entradas
- `caminho_pdf`: caminho relativo ao PDF (ex: `Normas/Estudo/Curva de Capabilidade_Artigo SEPOPE.pdf`)
- `paginas`: lista de páginas de interesse (opcional — se omitido, extrai tudo)

## Ferramenta/Script
```bash
"C:\Users\dougl\AppData\Local\Programs\Python\Python312\python.exe" execution/extract_pdf.py --file "caminho/para/arquivo.pdf" --pages 1,2,3
```

A saída é salva em `.tmp/pdf_extract_<nome>.txt` e também impressa no console.

## Saída esperada
- Arquivo `.tmp/pdf_extract_<nome>.txt` com o texto extraído
- Seções identificadas com número de página
- Console exibe primeiros 500 caracteres como preview

## Normas disponíveis no projeto

### `Normas/Estudo/`
| Arquivo | Conteúdo | Páginas relevantes |
|---------|----------|--------------------|
| `6878_ProtecaoGeradores_MA_20190307_Web_pt-BR.pdf` | SEL 2019 — Proteção LOF, UEL/OEL, curva de capabilidade | §III (p.4-8) |
| `Curva de Capabilidade_Artigo SEPOPE.pdf` | SEPOPE 2006 — Diagramas P-Q, limites operativos | §3 (p.3-6) |

### `Normas/IEEE/`
| Arquivo | Conteúdo |
|---------|----------|
| IEEE 421.5 | Modelos de AVR (AC8B, etc.) |
| IEEE 421.2 | Critérios de avaliação FCR |

## Edge Cases
- **PDF protegido/escaneado:** pdfplumber pode retornar texto vazio — neste caso o PDF é imagem e requer OCR
- **Caracteres especiais:** acentos e símbolos matemáticos podem sair distorcidos — revisar manualmente
- **Arquivo não encontrado:** verificar se o caminho usa barras corretas (`/` ou `\\`)

## Dependências
```bash
pip install pdfplumber
```
Já instalado no ambiente Python do projeto.

## Aprendizados
- `pdfplumber` funciona bem nos PDFs técnicos deste projeto (texto selecionável)
- Extrair página a página é mais confiável que extrair tudo de uma vez para PDFs grandes
