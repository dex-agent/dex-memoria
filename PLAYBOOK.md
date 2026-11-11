---
name: "dex-memoria playbook"
description: "Regras de decisao e procedimentos deste projeto - projecao gerada das fontes citadas. Nao editar a mao."
type: playbook
generated_by: "tools/playbook/generate-playbook.py"
authority: derived_projection
sources_revision: "sha256:16b793976f0013049e33845b865e16dd038eeea5520b320b5a456c1e5311e09e"
sent_revision: "sha256:b95e7915e63d33949762c561cea7b7b089e3b08deb3eca9c26995a99d6563065"
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
- Fonte: `AGENTS.md#L319-L351`
- Selo: `pb-9c53c953`

## Runbook <-> Playbook (procedimentos)

- [2026-11-05] Gate textual da suite: Node 24 emite resumo com prefixo INFO, nao '# pass' - Faca: case os dois formatos — `grep -E "^(#|ℹ) fail[[:space:]]"` — e -> `.agents/napkin.md#L16 (local)`

## Plano de execucao vigente

-> `.agents/PLAN-TASKS/ACTIVE.md (local)` - nao viaja no clone.

## Fontes e revisao

| caminho | sha256 | Enviado? |
| --- | --- | --- |
| `AGENTS.md` | `fcba7e322d344b43d0e63b479dfae942807850af345f711dd339ea76c5195505` | sim |
| `.agents/napkin.md` | `a2f18bbd63d7de057680779d03c3b3726300c1ed52ac5856a43a01c1f5a06524` | nao |
| `.agents/PLAN-TASKS/ACTIVE.md` | `6fb845bd947d99ad9527665da2d4ed8e904c5986f66081b77505815fd449984d` | nao |

## Superficie enviada vs local

- O clone entrega: raiz commitada (fontes enviadas, PLAYBOOK.md, PLAYBOOK.index.json, tools/).
- Nao viajam: `.agents/` inteiro (napkin, trilhos, auditorias) - itens marcados (local).
- Como reagir: regra completa esta na fonte enviada; procedimento (local) pede data e localizador ao dono.

## Secoes nao decodificadas

- Authority And Bootstrap -> `AGENTS.md#L10` (sem token de localizador)
- What This Repo Is -> `AGENTS.md#L37` (sem token de localizador)
- What This Repo Is Not -> `AGENTS.md#L112` (sem token de localizador)
- Local Context Surfaces -> `AGENTS.md#L154` (sem token de localizador)
- Memory And Continuity Model -> `AGENTS.md#L187` (sem token de localizador)
- Save Rules -> `AGENTS.md#L234` (sem token de localizador)
- Public Repository Safety -> `AGENTS.md#L260` (sem token de localizador)
- Editing Rules -> `AGENTS.md#L280` (sem token de localizador)
- Execution Trails -> `AGENTS.md#L352` (sem token de localizador)
- Known Current Local State -> `AGENTS.md#L374` (sem token de localizador)
- Bootstrap (toda janela nova, nesta ordem) -> `AGENTS.md#L388` (sem token de localizador)
- Indexação (doutrina da casa) -> `AGENTS.md#L406` (sem token de localizador)
- Envio a terceiros -> `AGENTS.md#L413` (sem token de localizador)
