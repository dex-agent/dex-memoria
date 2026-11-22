---
name: "dex-memoria playbook"
description: "Regras de decisao e procedimentos deste projeto - projecao gerada das fontes citadas. Nao editar a mao."
type: playbook
generated_by: "tools/playbook/generate-playbook.py"
authority: derived_projection
sources_revision: "sha256:e981ea62ed97de252b8a1f8109c8feab82984c604fd2041eb80aa3b86859c9a2"
sent_revision: "sha256:cf4d80c6cf5f230e7827eac63289d47823272f39ece872679141c34f2366f1b8"
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
- [2026-11-18] Provar hook de git SEM merge real: fake GIT_DIR + stubs de git/CRG - Faca: mktemp dir com `MERGE_HEAD`/`MERGE_MSG` fake (o `# Conflicts:` -> `.agents/napkin.md#L24 (local)`
- [2026-11-21] Provar hook de merge com Git REAL: repo descartável + wrapper instrumentador - Faca: repo descartável com `core.hooksPath` apontando para os -> `.agents/napkin.md#L41 (local)`

## Plano de execucao vigente

-> `.agents/PLAN-TASKS/ACTIVE.md (local)` - nao viaja no clone.

## Fontes e revisao

| caminho | sha256 | Enviado? |
| --- | --- | --- |
| `AGENTS.md` | `39b3802fbb1e50d22b3325ada24fe78b0bb426c55d812b6ff41f15d831c7fc35` | sim |
| `.agents/napkin.md` | `1a643584dd0cfd1910661de4a1c6d701fcca0f370c2e360ee1a2ab877988a4a7` | sim |
| `.agents/PLAN-TASKS/ACTIVE.md` | `483f3d97d9b1488dcd16b432b763796cb3135d909d9152073533d9354d05a031` | nao |

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
