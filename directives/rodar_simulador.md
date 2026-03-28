# Diretiva: Rodar o Simulador Localmente

## Objetivo
Iniciar o servidor local e abrir o simulador no navegador para testes e validação visual.

## Entradas
- Nenhuma entrada obrigatória
- Opcional: porta diferente (padrão: 8080)

## Ferramenta/Script
```bash
"C:\Users\dougl\AppData\Local\Programs\Python\Python312\python.exe" Simulador/server.py
```
O `server.py` já abre o navegador automaticamente em `http://localhost:8080/Simulador_Excitacao.html`.

## Saída esperada
- Servidor HTTP rodando na porta 8080
- Navegador abre automaticamente com o simulador
- Console exibe: `Serving on http://localhost:8080`

## Verificações pós-inicialização
1. Header exibe a versão correta (ex: `V0.12`)
2. Aba **Simulação** acessível
3. Botão **SIMULAR** funciona — gera os 5 gráficos (4 + diagrama P-Q)
4. Diagrama P-Q aparece proporcional (não achatado), com semicírculo visível no limite do estator

## Como encerrar
- `Ctrl + C` no terminal onde o servidor está rodando
- Ou: `taskkill //F //FI "IMAGENAME eq python.exe"` (encerra TODOS os processos Python)

## Edge Cases
- **Porta em uso:** verificar com `netstat -ano | findstr ":8080"` — se ocupada, encerrar o processo ou alterar a porta em `server.py`
- **Navegador não abre:** abrir manualmente `http://localhost:8080`
- **Erro de importação:** verificar que `Chart.js` CDN está acessível (requer internet na primeira carga)

## Aprendizados
- No shell bash do Windows, usar `//F` em vez de `/F` no `taskkill`
- O servidor serve a partir de `Simulador/` — assets devem estar nessa pasta
