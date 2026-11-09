# dex-memoria Project Index

Porta curta para uma nova janela localizar as fontes vivas do projeto sem
depender do historico da conversa.

## Load Order

1. `AGENTS.md` - bootstrap local, fronteiras e validacao.
2. `.agents/PROJECT.md` - identidade estavel e restricoes locais.
3. `.agents/STRUCTURE.md` - mapa de diretorios e arquivos.
4. `.agents/ACTIVE.md` - foco atual, bloqueios e proximo passo.
5. `.agents/HANDOFF.md` - retomada detalhada quando houver trabalho em curso.
6. `.agents/MEMORY.ndjson` - memoria compacta local, apenas por gatilho.
7. `.codex/napkin.md` - runbook tatico curto, se existir.
8. `.agents/PLAN-TASKS/ACTIVE.md` - Trilho ativo, se houver.

## Public Contract Sources

- `README.md` - visao geral, instalacao e fronteiras.
- `SKILL.md` - entrada operacional da skill `dex-memoria`.
- `SPEC.md` - contrato de ciclo de vida de memoria.
- `docs/usage.md` - guia de instalacao, uso e ativacao.
- `docs/runtime-boundary.md` - separacao entre contrato documental e runtime.
- `docs/memory-home.md` - raiz canonica `DEX_MEMORIA_HOME`.
- `docs/integration-dex-agent.md` - integracao com Dex Agent.
- `docs/layered-memory-simulations.md` - simulacoes L1/L2/L3.
- `docs/v2-fixture-consolidation-map.md` - mapa unico de produto V2,
  consumidores, comandos, SHADOW, backup, rollback e gates de cutover.
- `registry/agents-skills/dex-memoria/SKILL.md` - fonte versionada do
  redirecionador global instalado em `.agents/skills`.
- `CAPACITY.md` - projecao de capacidades observaveis (corte 0.1.16; derivada —
  regenere ao tocar release/fontes).
- `DECISION-FLOW.md` - fluxo operacional de decisoes do validador/CLI (corte
  0.1.16; derivada — regenere ao mudar condicao/ramo/owner).
- `contracts/` - contratos operacionais complementares.
- `workflow/` - receitas locais (dex.workflow.v1); INDEX em `workflow/INDEX.md`.
- `templates/` - modelos copiaveis e sanitizados.
- `examples/` - exemplos sanitizados; nunca estado real.

## Estado atual

- Trilho ativo:
  `.agents/PLAN-TASKS/2026-07-22-entrada-cotidiana-v2-para-modelos-menores.md`.
- Gate de retomada: `.agents/REPORTS/2026-07-22-mapa-missao-v2-modelos-menores.md`.
- Dependência imediata: Trilho RED-first no dex-PPIRTV para autoclassificação,
  workspace, capability real e compatibilidade `written[]`.
- Estado operacional: selector/writer V2 ativo; ausência de configuração no
  `dex-PPIRTV` é `unconfigured`, nunca fallback writer V1.
- `legacy-v1` permanece somente reader/restore quando explícito; rotas novas
  aceitam `L1↔L2` ou `L1↔L3`.
- Recall, rotas estruturais e a entrada cotidiana `v2 remember` passaram pela
  prova independente em contexto limpo. A consolidação Git local preserva o
  estado anterior e não autoriza push, release ou SemVer.

Os Trilhos, flows, recibos e snapshots anteriores permanecem preservados na
superficie local `.agents/`. Eles são arqueologia de execução, não contrato
público, selector, default ou instrução de retomada.

## Canonical Source And Sync

- Fonte canonica de desenvolvimento: `C:\CodexProjetos\dex-memoria`.
- Fonte operacional completa e unica:
  `C:\CodexProjetos\dex-memoria\SKILL.md`.
- Redirecionador no registry global:
  `$env:USERPROFILE\.agents\skills\dex-memoria\SKILL.md`.
  A fonte versionada dele fica em
  `registry/agents-skills/dex-memoria/SKILL.md`.
  Ele aponta diretamente para a fonte operacional unica, sem precedencia local
  ou rota alternativa.
- `dex-memoria install` atualiza somente o redirecionador do registry global.
- Copias completas em repos filhos ou instalacoes antigas sao residuo
  nao-autoritativo: inventarie e preserve, mas nao selecione nem sincronize.
- Se a fonte canonica estiver indisponivel, declare bloqueio explicito.
- O padrao atual inclui `Checklist De L3 Robusto`, `L3 robusto`,
  `Graphify API`, `rg de achabilidade` e `source: graphify`.

## Package And Validation

- `package.json` - metadados, binario e scripts npm.
- `bin/dex-memoria.js` - CLI canônica do Dex Memoria V2; também preserva os
  comandos históricos de fixture e compatibilidade explicitamente rotulados.
- `registry/agents-skills/dex-memoria/SKILL.md` - conteudo que o `install`
  copia para o registry global `.agents/skills`.
- `scripts/validate-public.js` - validacao da estrutura publica.
- `skills/dex-memoria-v2-pilot/` - piloto manual fixture-only de repositorio;
  nao instalado e fora do pacote npm atual.

Recibos locais exatos da consolidacao e do SHADOW:

- Estado consolidado: `shadow-ready`; ainda nao `live-ready`.
- `.agents/V2-CONSOLIDATION-RECEIPT-2026-07-16.md` - fontes, hashes, backups,
  prova preservada, consumidores externos e rollback.
- `.agents/PLAN-TASKS/2026-07-16-consolidar-dex-memoria-v2-fixture-only.md` -
  Trilho executor da consolidacao.
- `.agents/PLAN-TASKS/2026-07-16-shadow-consumidores-vivos-dex-memoria-v2.md` -
  Trilho executor do SHADOW, com current `legacy-v1` preservado e cutover
  bloqueado.

Checks preferidos:

```powershell
npm run check
npm run doctor
npm run pack:check
```

## Playbook (Envio a Terceiros)

- `PLAYBOOK.md` + `PLAYBOOK.index.json` - projecao GERADA das regras de
  decisao; nunca editar a mao. Regen apos editar fontes:
  `python -B tools/playbook/generate-playbook.py --repo . --write`;
  frescor: `--check` (exit 0). Hook anti-drift ativo via
  `git config core.hooksPath tools/playbook/hooks`.
- `tools/playbook/` - ferramentas da projecao (gerador, juiz, hook):
  veja [tools/playbook/INDEX.md](tools/playbook/INDEX.md).

## Local Context Surface

`.agents/`, `.ppirtv/`, `graphify-out/`, `.env`, logs e configuracoes locais
sao estado de maquina ou runtime. Consulte quando necessario para retomada
local, mas nao promova esse conteudo para documentacao publica sem garimpo,
sanitizacao e motivo claro.

## Safety Reminders

- Este repo e publico e nao deve carregar secrets, runtime state ou dados reais.
- `dex-memoria` e contrato/documentacao; nao e runtime do Dex Agent.
- `L3 robusto` exige L1 curto, L2 com ancora operacional e L3 verificavel.
- Memoria global e de tema fica fora do workspace, em `DEX_MEMORIA_HOME`.
- Para proximo passo operacional, `HANDOFF.md` e `ACTIVE.md` vencem historico.
