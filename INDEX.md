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
- `contracts/` - contratos operacionais complementares.
- `templates/` - modelos copiaveis e sanitizados.
- `examples/` - exemplos sanitizados; nunca estado real.

## Estado atual

- Trilho ativo:
  `.agents/PLAN-TASKS/2026-07-17-proveniencia-versionamento-unidade-candidata-v2.md`.
- Estado: `VALIDADO_AGUARDA_ACEITE_GOAL_START`; fingerprint
  `42d22f21fbf5f8f0e22dc6d1ba07bf8c809624f4c45ca67ce61353a49a72b2cc`.
- Objetivo: provar proveniência e reprodução da unidade candidata por manifest,
  pathspec e duas reconstruções independentes.
- Teto: `candidate_provenance_prepared_not_versioned` ou `NO-GO`; nenhum
  `goal_start`, stage, commit, branch, push ou cutover foi autorizado.
- Próximo gate: aceite humano explícito ligado ao fingerprint para executar
  somente a auditoria; preservação Git exige Trilho e aceite separados.

Último planejamento encerrado:

- Trilho: `.agents/PLAN-TASKS/2026-07-17-planejar-preparar-cutover-real-memoria-v2.md`.
- Estado: `ENCERRADO_PLANEJAMENTO_NO_GO_SEM_CUTOVER`; o objetivo planning-only
  foi concluído, mas não autorizou qualquer parte live ou do cutover.
- SPT v2 válido, fingerprint
  `d312652d3d0fda7deedb7f95a555ca76f2553859f7a16219bb425214ad5bc14c`.
- Flow `flow_20260717100107508_0177_0125` completo; veredito
  `vrd_20260717101543581_0211_0170`: planning-only pronto com ressalvas e
  cutover `NO-GO` por sete dependências P1.
- Recibo: `.agents/RECEIPTS/2026-07-17-planejamento-cutover-real-v2-no-go.md`,
  SHA-256 `B4F335B3247A7910574BF4F788AF1C9F86B3B1EF243D24D968C586EDA1C8E243`.
- `execution_authorized=false` mantém futuro executor, mutação live e cutover
  bloqueados.
- Autoridade: `legacy-v1` continua ativo; `governed-theme-v2` permanece
  `approved_not_active`; nenhum backup live ou cutover ocorreu.
- Próximo gate: abrir primeiro o Trilho de proveniência/versionamento da unidade
  candidata; reavaliar GO-candidate somente após sete provas independentes.

Último Trilho encerrado:

- Trilho: `.agents/PLAN-TASKS/2026-07-16-ensaio-pre-cutover-v2-em-clone-isolado.md`.
- Flow oficial final: `flow_20260716230036632_0123_0049`, completo; veredito
  `vrd_20260717001034285_0176_0123`; o flow inicial
  `flow_20260716225532482_0121_0046` permanece supersedido.
- SPT final: `valid=true`, fingerprint
  `22a7cc8a555be5eb12a1db7f8bd7d1262596e50173b340d90002b801e9c19af1`;
  execução concluída, Mesa P0=0/P1=0, regressão 258/0/1.
- Recibo final:
  `.agents/RECEIPTS/2026-07-16-ensaio-precutover-v2-clone-isolado-final.md`.
- Veredito: `shadow-ready com ensaio pré-cutover aprovado`, não live-ready.
- Próximo gate: aceite humano explícito para abrir Trilho separado de cutover.
- Limites: vault vivo e backup original read-only; nenhuma ativação V2,
  alteração de `legacy-v1`, skill/config global, cutover ou ação Git externa.

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
- `bin/dex-memoria.js` - CLI documental da V1.
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
