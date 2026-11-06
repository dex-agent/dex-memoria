---
name: "dex-memoria playbook"
description: "Regras de decisao e procedimentos deste projeto - projecao gerada das fontes citadas. Nao editar a mao."
type: playbook
generated_by: "tools/playbook/generate-playbook.py"
authority: derived_projection
sources_revision: "sha256:4e552cec5efc7a7365b13637984d4219b94f1436657d8ecf3f386f7023712a3b"
sent_revision: "sha256:4f810f10fc0b6d233fa993f6b721c56f13c6108dd55c86312bc173a0243b8a68"
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
| `AGENTS.md` | `06afb15f2be8e611f100757b46fd2d35e15de6e50cbf7512210faa8f3a63e47b` | sim |
| `.agents/napkin.md` | `a2f18bbd63d7de057680779d03c3b3726300c1ed52ac5856a43a01c1f5a06524` | nao |
| `.agents/PLAN-TASKS/ACTIVE.md` | `e179d3098f9b3d4245766c48876c20de224c91efed5d96504f0eabbf5de1bbfd` | nao |

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
