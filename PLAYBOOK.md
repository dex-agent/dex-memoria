---
name: "dex-memoria playbook"
description: "Regras de decisao e procedimentos deste projeto - projecao gerada das fontes citadas. Nao editar a mao."
type: playbook
generated_by: "tools/playbook/generate-playbook.py"
authority: derived_projection
sources_revision: "sha256:36654635c20b9c598afcf720501d1ab343f81cd6ca4f86e155c710a2ade20e2e"
sent_revision: "sha256:b37a1e4e575984fc210f39495acc28ece1d6a5a2e266201808685c94f2175936"
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

### Local Load Order

- Localizador: `TRACKER-LOCAL`
- Gatilho: ndeclarado
- Extrato: For a new AI window working in this repository, load in this order:
- Rotas (nomes, na ordem):
  - `AGENTS.md` - this local contract.
  - `INDEX.md` - short locator for live sources.
  - `.agents/PROJECT.md` - stable local identity and constraint...
  - `.agents/STRUCTURE.md` - local project map, if present.
- Fonte: `AGENTS.md#L132-L153`
- Selo: `pb-d1ab29bf`

### Validation

- Localizador: `DEX-MEMORIA-PROVA-W6-ZERO-DEPS`
- Gatilho: ndeclarado
- Extrato: Use Node.js 18 or newer.
- Fonte: `AGENTS.md#L323-L355`
- Selo: `pb-5948ef07`

## Runbook <-> Playbook (procedimentos)

- [2026-11-05] Gate textual da suite: Node 24 emite resumo com prefixo INFO, nao '# pass' - Faca: case os dois formatos — `grep -E "^(#|ℹ) fail[[:space:]]"` — e -> `.agents/napkin.md#L16 (local)`

## Plano de execucao vigente

-> `.agents/PLAN-TASKS/ACTIVE.md (local)` - nao viaja no clone.

## Fontes e revisao

| caminho | sha256 | Enviado? |
| --- | --- | --- |
| `AGENTS.md` | `1267c6a9bafabb63a70a93b266237635fd002a8b3f081991f4c23d2bccd0dc19` | sim |
| `.agents/napkin.md` | `82b1a5c626c64da878a92706a078d443e89252e42ad592c2d125bbbc5c637573` | sim |
| `.agents/PLAN-TASKS/ACTIVE.md` | `6954fbf7443697274bf24b98e3d9df6c20509d1a765613fdd97404a49ba2d832` | nao |

## Superficie enviada vs local

- O clone entrega: raiz commitada (fontes enviadas, PLAYBOOK.md, PLAYBOOK.index.json, tools/).
- Nao viajam: `.agents/` inteiro (napkin, trilhos, auditorias) - itens marcados (local).
- Como reagir: regra completa esta na fonte enviada; procedimento (local) pede data e localizador ao dono.

## Secoes nao decodificadas

- Authority And Bootstrap -> `AGENTS.md#L10` (sem token de localizador)
- What This Repo Is -> `AGENTS.md#L37` (sem token de localizador)
- What This Repo Is Not -> `AGENTS.md#L112` (sem token de localizador)
- Local Context Surfaces -> `AGENTS.md#L154` (sem token de localizador)
- Memory And Continuity Model -> `AGENTS.md#L191` (sem token de localizador)
- Save Rules -> `AGENTS.md#L238` (sem token de localizador)
- Public Repository Safety -> `AGENTS.md#L264` (sem token de localizador)
- Editing Rules -> `AGENTS.md#L284` (sem token de localizador)
- Execution Trails -> `AGENTS.md#L356` (sem token de localizador)
- Known Current Local State -> `AGENTS.md#L378` (sem token de localizador)
- Bootstrap (toda janela nova, nesta ordem) -> `AGENTS.md#L392` (sem token de localizador)
- Indexação (doutrina da casa) -> `AGENTS.md#L410` (sem token de localizador)
- Toolsbook (consulta antes de usar ou criar ferramentas) -> `AGENTS.md#L417` (sem token de localizador)
- Envio a terceiros -> `AGENTS.md#L440` (sem token de localizador)
- Gates de git (hooks da casa) -> `AGENTS.md#L460` (sem token de localizador)
