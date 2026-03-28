# Diretiva: Criar Nova Versão do Simulador

## Objetivo
Incrementar a versão do simulador, registrar no changelog interno e fazer commit descritivo no GitHub.

## Entradas
- `nova_versao`: string no formato `V0.XX` (ex: `V0.13`)
- `descricao`: resumo curto da mudança (ex: `Diagrama P-Q: fix proporção dos eixos`)
- `data`: data no formato `YYYY-MM-DD`

## Ferramenta/Script
```bash
"C:\Users\dougl\AppData\Local\Programs\Python\Python312\python.exe" execution/bump_version.py --version V0.XX --desc "Descrição" --date YYYY-MM-DD
```

## Etapas (se executar manualmente)

### 1. Verificar versão atual
```bash
grep "APP_VERSION" Simulador/Simulador_Excitacao.html | head -1
```

### 2. Atualizar `APP_VERSION` no `<script>` do HTML
```javascript
// Antes:
const APP_VERSION = 'V0.11';
// Depois:
const APP_VERSION = 'V0.12';
```

### 3. Adicionar entrada no array `CHANGELOG`
```javascript
{ v:'V0.12', d:'2026-03-27', t:'Diagrama de Capabilidade P-Q: Xd/Xd\'/Xq, UEL, OEL, SSSL' },
```
A entrada deve ser inserida **no início** do array (versão mais recente primeiro).

### 4. Commit no GitHub
```bash
git add Simulador/Simulador_Excitacao.html
git commit -m "V0.12: Descrição da mudança"
git push
```

## Saída esperada
- `APP_VERSION` atualizado no HTML
- Entrada no `CHANGELOG` visível na aba **Sumário** do simulador
- Commit e push realizados com sucesso

## Edge Cases
- **Versão já existe no CHANGELOG:** não duplicar — verificar antes de inserir
- **Math.max/min com spread proibido:** nunca introduzir `Math.max(...array)` — usar `reduce()`
- **Versão no CLAUDE.md:** atualizar também o campo `Versão atual` se relevante

## Regras críticas
- Sempre usar `reduce()` para min/max em arrays grandes (>100 elementos)
- Não alterar cores dos cabeçalhos `.sh` sem autorização explícita do usuário
- Não criar novos arquivos sem necessidade — o simulador é um único HTML
