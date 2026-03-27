# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

> **Projeto:** Simulador de Ensaios Dinâmicos — Sistema de Excitação
> **Desenvolvedor:** Eng° Douglas Furtado
> **Versão atual:** V0.09
> **Normas:** IEEE 421.5 · IEEE 421.2 · IEC 60034-16 · ONS Submódulo 2.10

---

## Comandos essenciais

```bash
# Rodar o servidor local (Python 3.12)
"C:\Users\dougl\AppData\Local\Programs\Python\Python312\python.exe" "Simulador/server.py"
# → Abre http://localhost:8080 automaticamente

# Rodar auto-sync com GitHub (em segundo plano, manter aberto)
"C:\Users\dougl\AppData\Local\Programs\Python\Python312\python.exe" auto_sync.py

# Verificar versão atual do simulador
grep "APP_VERSION" Simulador/Simulador_Excitacao.html | head -1

# Verificar uso proibido de Math.spread (deve retornar 0)
grep -c "Math\.\(max\|min\)(\.\.\.)" Simulador/Simulador_Excitacao.html

# Push manual para GitHub
git add -A && git commit -m "mensagem" && git push
```

---

## GitHub — Repositório e Auto-Sync

**Repositório:** https://github.com/dougfurtado88/simulador-excitacao
**Usuário:** dougfurtado88
**Branch principal:** `main`

### Auto-sync (`auto_sync.py`)

Script Python que monitora alterações nos arquivos e faz commit + push automaticamente para o GitHub.

**Como funciona:**
1. Detecta qualquer arquivo modificado/criado/deletado na pasta do projeto
2. Aguarda **8 segundos** sem novas alterações (debounce) antes de commitar
3. Executa `git add -A → git commit → git push` automaticamente
4. Mensagem de commit automática: `auto: arquivo1.html, arquivo2.js +N mais`

**Para rodar o auto-sync:**
```bash
"C:\Users\dougl\AppData\Local\Programs\Python\Python312\python.exe" auto_sync.py
```
Deixar a janela aberta enquanto trabalha. Encerrar com `Ctrl + C`.

**Dependência:** biblioteca `watchdog` (já instalada via pip).

### Commits manuais (após cada sessão Claude Code)

Após modificar o simulador, além do versionamento interno (`APP_VERSION`), fazer commit descritivo:
```bash
git add -A
git commit -m "V0.10: descrição da mudança"
git push
```

### Arquivos ignorados pelo git (`.gitignore`)
- `.claude/` — configurações internas do Claude Code
- `__pycache__/`, `*.pyc` — cache Python
- Arquivos temporários do sistema (`~$*`, `*.tmp`, `Thumbs.db`)

---

## Estrutura do projeto

```
Desenvolvimento/
├── Simulador/
│   ├── Simulador_Excitacao.html   ← aplicação principal (único arquivo de simulação)
│   ├── index.html                 ← landing page PWA
│   ├── manifest.json              ← manifesto para instalação como app
│   ├── sw.js                      ← service worker (cache offline)
│   ├── server.py                  ← servidor Python para rodar localmente
│   ├── icon.svg                   ← ícone do app
│   ├── Assinatura.svg             ← logo do desenvolvedor (cópia local para o servidor)
│   └── Backups/                   ← versões anteriores do simulador
├── Normas/
│   ├── ABNT/                      ← NBR 421.x, 45-1998
│   ├── IEEE/                      ← IEEE 115, 421.x, etc.
│   └── ONS/                       ← Submódulos 2.3, 2.10
├── Planilhas/                     ← .xlsx de controle de tensão, rejeição, normas
├── Documentos/                    ← .docx e .pdf de referência técnica
└── Assinatura.svg                 ← logo original (fonte)
```

**Regra:** O servidor Python serve a partir de `Simulador/`. Qualquer asset referenciado no HTML (logo, ícones) deve estar dentro desta pasta.

---

## Arquitetura do simulador (`Simulador_Excitacao.html`)

Arquivo HTML único com CSS + HTML + JS embutidos. Dependência externa apenas via CDN:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
```

### Layout
```
┌──────────────────────── HEADER ─────────────────────────────┐
│  Logo  Título  [AVR|FCR]  [Degrau+|Degrau-|Rejeição]  [▶][↺]│
├───────────────┬─────────────────────────────────────────────┤
│  PARÂMETROS   │  TABS: [Sumário][Normas/Legendas][Simulação][Avaliação] │
│  (#prm)       ├─────────────────────────────────────────────┤
│               │  Grid 2×2 de gráficos (Chart.js)            │
└───────────────┴─────────────────────────────────────────────┘
```

### Modos e ensaios

| Variável | Valores | Descrição |
|---|---|---|
| `MODE` | `'AVR'` / `'FCR'` | Modo de controle ativo |
| `EVAL_TYPE` | `'DPOS'` / `'DNEG'` / `'REJE'` | Tipo de ensaio |

### Modelo de simulação (RK4 @ 200 Hz, Δt = 5 ms)

**AVR:** `[xI, xD, xLL, xA, xIf]` — PID + Lead-Lag + Amplificador + Gerador
```
Vref →[+]→ PID → Lead-Lag → KA/(1+sTA) → Efd → Kag/(1+sTdo') → Vt
      [-]←─────────────────────────────────────────────────────
```

**FCR:** `[xI, xA, xIf]` — PI + Amplificador + Gerador
```
Iref →[+]→ PI → KA/(1+sTA) → Efd → Kag/(1+sTdo') → If
      [-]←──────────────────────────────────────────
```

**Rejeição de carga:** mesmo modelo AVR com distúrbio `dVrej` injetado em `Vt` em `t = TSTEP`.

### Parâmetros de máquina por tipo

| Tipo | `Tdo'` (s) | `Kag` |
|---|---|---|
| Hidráulico | 8.0 | 1.05 |
| Turbo-Vapor | 5.0 | 1.00 |
| Turbo-Gás | 6.0 | 1.02 |
| Comp. Síncrono | 7.5 | 1.00 |
| Gerador Diesel | 4.5 | 0.98 |

### Funções JS críticas

| Função | Responsabilidade |
|---|---|
| `runSim()` | Ponto de entrada — lê parâmetros, chama integrador, popula gráficos |
| `rk4(f, t, x, dt)` | Integrador Runge-Kutta 4ª ordem |
| `simAVR(p)` | Simulação AVR degrau +/- |
| `simAVR_rej(p)` | Simulação AVR rejeição de carga |
| `simFCR(p)` | Simulação FCR degrau |
| `calcM_degrau(data, key, y0, delta, TSTEP)` | Métricas: OS, Ts, Te, Ess, pk |
| `calcM_rej(data, Vt0, TSTEP)` | Métricas: OS, trees, Efd_floor/peak |
| `calcM_std(data, key, r0, delta, TSTEP)` | Métricas FCR: OS, ERF, ts |
| `showTab(name)` | Alterna tabs (`'sim'`, `'ava'`, `'leg'`, `'sum'`) |
| `setMode(m)` | Alterna `'AVR'` / `'FCR'` |
| `resetSim()` | Limpa gráficos e destrói instâncias Chart.js |

### Helpers globais
```javascript
const $  = id => document.getElementById(id);
const gv = id => parseFloat($(id).value) || 0;
const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));  // clamp
const sf = (v, e=1e-6) => Math.abs(v) < e ? e : v;        // safe divisor
```

---

## Critérios de avaliação normativa

| Ensaio | Métrica | Limite | Norma |
|---|---|---|---|
| Degrau ± | OS | ≤ 10% | ONS Sub. 2.10 / IEC 60034-16 |
| Degrau ± | Te (±5%\|Δ\|) | ≤ 2 s | ONS Sub. 2.10 |
| Degrau ± | Ess | ≤ 1% | IEEE 421.2 |
| Rejeição | OS | ≤ 10% | ONS Sub. 2.10 |
| Rejeição | trees (±5%) | ≤ 2 s | ONS Sub. 2.10 |
| FCR | OS | ≤ 15% | IEEE 421.2 |
| FCR | ts (±2%\|ΔIf\|) | ≤ 10 s | IEEE 421.2 |
| FCR | ERF | ≥ 2 pu/s | IEEE 421.2 Annex E |
| Todos | \|Efd\|_max | ≤ VRmax | IEEE 421.5 |

---

## Regras críticas de performance

**NUNCA** usar spread em arrays com Math.max/min — causa stack overflow para simulações longas (6000+ pontos):
```javascript
// ❌ PROIBIDO
const Mp = Math.max(...data.map(d => d.Vt));

// ✅ CORRETO
const Mp = data.reduce((m, d) => d.Vt > m ? d.Vt : m, data[0].Vt);
```

---

## Protocolo de versionamento

A cada sessão que modifica `Simulador_Excitacao.html`:

1. Incrementar `APP_VERSION` no topo do `<script>`: `'V0.09'` → `'V0.10'`
2. Adicionar entrada no array `CHANGELOG` interno:
   ```javascript
   { v:'V0.10', d:'2026-MM-DD', t:'Descrição da mudança' },
   ```

---

## Paleta de cores corporativa

| HEX | Pantone | Uso |
|---|---|---|
| `#003a5e` | 540C | Header, fundos escuros, seções |
| `#005b92` | 2945C | Gradiente header, hover |
| `#0b9bd3` | — | Destaques, botões eval ativos |
| `#f3cb06` | 7406C | Botão SIMULAR, tabs ativas, borda header |
| `#f0f7fb` | — | Background geral |
| `#cde3f0` | — | Bordas de cards e inputs |
| `#7a9ab8` | — | Texto secundário |

**Texto sobre fundo escuro:** usar `#a8d4ee` (labels), `#e0f2fb` (texto), `#f3cb06` (destaque).

**Não alterar** as cores dos cabeçalhos de seção (`.sh`) — escolha explícita do desenvolvedor.

---

## Tipografia

| Família | Pesos | Uso |
|---|---|---|
| Poppins | 300, 400, 600, 700 | Headings, labels, botões, badges |
| Lora | 400, 600, italic | Body text, notas, parágrafos |
| monospace (sistema) | — | Inputs numéricos, valores |

Fontes carregadas via Google Fonts (requer internet na primeira carga; cacheadas pelo SW após).

---

## PWA — Landing page e Service Worker

`index.html` é a entrada do app (PWA). Não contém lógica de simulação — apenas apresentação e link para `Simulador_Excitacao.html`.

`sw.js` cacheia localmente: `index.html`, `Simulador_Excitacao.html`, `manifest.json`, `icon.svg` e Chart.js (CDN). Após primeira carga com internet, o app funciona offline.

Para atualizar o cache do SW após mudanças no simulador, incrementar `CACHE_NAME` em `sw.js`:
```javascript
const CACHE_NAME = 'simexcitacao-v2';  // ← incrementar
```
