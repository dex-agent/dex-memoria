---
name: "dex-memoria playbook"
description: "Regras de decisao e procedimentos deste projeto - projecao gerada das fontes citadas. Nao editar a mao."
type: playbook
generated_by: "tools/playbook/generate-playbook.py"
authority: derived_projection
sources_revision: "sha256:9046758d39e08b9dca171227c9e22b8485c63effe374f093f380d6fe770ab722"
sent_revision: "sha256:c1a3991b31442b5660b43b71e565326abc191976529eb353636e0d6d786b737d"
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
- Fonte: `AGENTS.md#L316-L348`
- Selo: `pb-0e712e17`

## Runbook <-> Playbook (procedimentos)

- [2026-11-05] Gate textual da suite: Node 24 emite resumo com prefixo INFO, nao '# pass' - Faca: case os dois formatos — `grep -E "^(#|ℹ) fail[[:space:]]"` — e -> `.agents/napkin.md#L16 (local)`

## Plano de execucao vigente

-> `.agents/PLAN-TASKS/ACTIVE.md (local)` - nao viaja no clone.

## Fontes e revisao

| caminho | sha256 | Enviado? |
| --- | --- | --- |
| `AGENTS.md` | `c6310bf40b6ae3ad01e903f794728512e35ac7074c6b1fe5fad75ed8325d1d86` | sim |
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
- Memory And Continuity Model -> `AGENTS.md#L184` (sem token de localizador)
- Save Rules -> `AGENTS.md#L231` (sem token de localizador)
- Public Repository Safety -> `AGENTS.md#L257` (sem token de localizador)
- Editing Rules -> `AGENTS.md#L277` (sem token de localizador)
- Execution Trails -> `AGENTS.md#L349` (sem token de localizador)
- Known Current Local State -> `AGENTS.md#L371` (sem token de localizador)
- Bootstrap (toda janela nova, nesta ordem) -> `AGENTS.md#L385` (sem token de localizador)
- Indexação (doutrina da casa) -> `AGENTS.md#L403` (sem token de localizador)
- Envio a terceiros -> `AGENTS.md#L410` (sem token de localizador)
