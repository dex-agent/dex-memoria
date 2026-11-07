---
name: "dex-memoria playbook"
description: "Regras de decisao e procedimentos deste projeto - projecao gerada das fontes citadas. Nao editar a mao."
type: playbook
generated_by: "tools/playbook/generate-playbook.py"
authority: derived_projection
sources_revision: "sha256:37f31e8e175b704f1e660a94e9cac95d53162195982c424bdcd68404aa2d80fc"
sent_revision: "sha256:09fd3de07b6a5dee26a6cc07111a438ed2e7aed40c3c3e25b9927363ca80040b"
do_not_edit: true
---
# Playbook - dex-memoria

## Como usar este playbook

Projecao GERADA das regras de decisao deste repo; a decisao completa mora na fonte citada.
Executar uma regra exige ler a fonte; extratos terminam em '...' quando truncados.
Regenerar apos editar fonte: `python -B tools/playbook/generate-playbook.py --repo . --write`.
Verificar frescor: `python -B tools/playbook/generate-playbook.py --repo . --check` (exit 0 limpo, exit 2 drift).
Ativar trava de commit: `git config core.hooksPath tools/playbook/hooks`.
Destinatario do projeto: `--check-sent` valida as fontes enviadas neste clone.

## Regras de decisao (plaquinhas)

### Validation

- Localizador: `DEX-MEMORIA-PROVA-W6-ZERO-DEPS`
- Gatilho: ndeclarado
- Extrato: Use Node.js 18 or newer.
- Fonte: `AGENTS.md#L312-L344`
- Selo: `pb-7112c46e`

## Runbook <-> Playbook (procedimentos)

- [2026-11-05] Gate textual da suite: Node 24 emite resumo com prefixo INFO, nao '# pass' - Faca: case os dois formatos — `grep -E "^(#|ℹ) fail[[:space:]]"` — e -> `.agents/napkin.md#L16 (local)`

## Plano de execucao vigente

-> `.agents/PLAN-TASKS/ACTIVE.md (local)` - nao viaja no clone.

## Fontes e revisao

| caminho | sha256 | Enviado? |
| --- | --- | --- |
| `AGENTS.md` | `d6f5f09814255ff412f81889a3a0e5feb7a319df2406f242069b3f03cef74ebf` | sim |
| `.agents/napkin.md` | `a2f18bbd63d7de057680779d03c3b3726300c1ed52ac5856a43a01c1f5a06524` | nao |
| `.agents/PLAN-TASKS/ACTIVE.md` | `6371a9797da5247576dc731ae7ec6b2c6cce5d981c296fd2b48fdf5eff9473c4` | nao |

## Superficie enviada vs local

- O clone entrega: raiz commitada (fontes enviadas, PLAYBOOK.md, PLAYBOOK.index.json, tools/).
- Nao viajam: `.agents/` inteiro (napkin, trilhos, auditorias) - itens marcados (local).
- Como reagir: regra completa esta na fonte enviada; procedimento (local) pede data e localizador ao dono.

## Secoes nao decodificadas

- Authority And Bootstrap -> `AGENTS.md#L10` (sem token de localizador)
- What This Repo Is -> `AGENTS.md#L37` (sem token de localizador)
- What This Repo Is Not -> `AGENTS.md#L112` (sem token de localizador)
- Local Load Order -> `AGENTS.md#L132` (sem token de localizador)
- Local Context Surfaces -> `AGENTS.md#L150` (sem token de localizador)
- Memory And Continuity Model -> `AGENTS.md#L180` (sem token de localizador)
- Save Rules -> `AGENTS.md#L227` (sem token de localizador)
- Public Repository Safety -> `AGENTS.md#L253` (sem token de localizador)
- Editing Rules -> `AGENTS.md#L273` (sem token de localizador)
- Execution Trails -> `AGENTS.md#L345` (sem token de localizador)
- Known Current Local State -> `AGENTS.md#L367` (sem token de localizador)
- Bootstrap (toda janela nova, nesta ordem) -> `AGENTS.md#L381` (sem token de localizador)
- Indexação (doutrina da casa) -> `AGENTS.md#L399` (sem token de localizador)
- Envio a terceiros -> `AGENTS.md#L406` (sem token de localizador)
