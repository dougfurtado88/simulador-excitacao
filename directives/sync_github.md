# Diretiva: Sincronizar com GitHub

## Objetivo
Commitar e fazer push das alterações para o repositório remoto no GitHub.
Pode ser feito manualmente ou de forma automática via `auto_sync.py`.

## Repositório
- **URL:** https://github.com/dougfurtado88/simulador-excitacao
- **Branch principal:** `main`
- **Usuário:** dougfurtado88

## Opção 1 — Auto-sync (recomendado durante desenvolvimento)
```bash
"C:\Users\dougl\AppData\Local\Programs\Python\Python312\python.exe" auto_sync.py
```
- Monitora alterações com `watchdog`
- Debounce de **8 segundos** — aguarda estabilização antes de commitar
- Mensagem automática: `auto: arquivo1.html, arquivo2.js +N mais`
- Deixar o terminal aberto enquanto trabalha

## Opção 2 — Commit manual (após sessão)
```bash
git add Simulador/Simulador_Excitacao.html
git commit -m "V0.XX: Descrição clara da mudança"
git push
```

## Convenção de mensagens de commit
| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Nova versão do simulador | `V0.XX:` | `V0.12: Diagrama P-Q com UEL/OEL` |
| Correção de bug | `fix:` | `fix: proporção eixos diagrama P-Q` |
| Documentação | `docs:` | `docs: adiciona diretiva nova_versao.md` |
| Configuração | `chore:` | `chore: atualiza .gitignore` |
| Auto-sync | `auto:` | `auto: Simulador_Excitacao.html` |

## Arquivos que NUNCA devem ser commitados
- `.env` (credenciais)
- `credentials.json`, `token.json`
- `.tmp/` (arquivos intermediários)
- `.claude/` (configurações internas do Claude Code)

## Saída esperada
- Push aceito pelo GitHub sem erros
- Commit visível em `https://github.com/dougfurtado88/simulador-excitacao/commits/main`

## Edge Cases
- **Conflito de merge:** nunca usar `--force` sem autorização explícita do usuário
- **Token expirado:** reautenticar via `gh auth login` ou regenerar token no GitHub
- **Auto-sync e commit manual simultâneos:** encerrar o auto_sync antes de fazer commit manual para evitar conflito

## Verificação rápida
```bash
git status
git log --oneline -5
```
