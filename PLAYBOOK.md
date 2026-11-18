---
name: "dex-memoria playbook"
description: "Regras de decisao e procedimentos deste projeto - projecao gerada das fontes citadas. Nao editar a mao."
type: playbook
generated_by: "tools/playbook/generate-playbook.py"
authority: derived_projection
sources_revision: "sha256:f9591d206785551e49ee7e2e61d4c104df1ff352659912e8b2175fcdfab92412"
sent_revision: "sha256:0296fe8585dfc3f98c384b88877d3e3af18b0dedfd1f89c080a88196cc9c51f2"
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

## Plano de execucao vigente

-> `.agents/PLAN-TASKS/ACTIVE.md (local)` - nao viaja no clone.

## Fontes e revisao

| caminho | sha256 | Enviado? |
| --- | --- | --- |
| `AGENTS.md` | `1267c6a9bafabb63a70a93b266237635fd002a8b3f081991f4c23d2bccd0dc19` | sim |
| `.agents/napkin.md` | `1f9e1e342b010fb4f8353f237d0e451b91b43fea5638d9124a7e11b526ff00c0` | sim |
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
