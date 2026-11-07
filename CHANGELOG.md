# Changelog

## 0.1.10 - 2026-11-07

- Declara `command_input` no schema público do receipt
  (`dex.memory.remember.receipt.v2.schema.json`): o 0.1.9 emitia o campo que o
  próprio schema fechado rejeitava — receipts "acionáveis" eram
  schema-invalid (P1 unânime da revisão adversarial pós-merge).
- `IDEMPOTENCY_CONFLICT` deixa de ser dead-end mudo: entra em
  `retry_new_operation` com `then_command` + `next_operation_id` (mesma classe
  do issue #7; achado convergente de 4/5 revisores).
- Corrige assert tautológico do teste fim-a-fim do recover (agora confere
  `status: ROLLED_BACK` direto) e typo `oferer`.
- `SKILL.md` documenta o `command_input` executável e o retry de
  `IDEMPOTENCY_CONFLICT`.
- Contrato vigente inalterado: Dex Memoria V2 permanece o writer/selector
  ativo; `legacy-v1` somente leitura/restauração.

## 0.1.9 - 2026-11-07

- Torna o recovery do `v2 remember` acionável por contrato (issue #7):
  `JOURNAL_CONFLICT` entra nas rotas de cura (`command` + `then_command` +
  `next_operation_id`, mode `recover_then_retry_new_operation`) e sai do
  `manual_resolution` mudo com `command: null` que travou a frota em loop de
  re-emissão idempotente.
- Adiciona `actions[].command_input` ao receipt de recovery: objeto JSON
  pronto para o stdin do `dex-memoria v2 recover` — executável as-is, sem
  composição manual (testado fim-a-fim com o CLI real).
- Documenta a seção `Recuperacao De Rota Simples` em `docs/usage.md`
  (fluxo de fim de loop, journal intruso, estados pós-crash).
- Contrato vigente inalterado: Dex Memoria V2 permanece o writer/selector
  ativo; `legacy-v1` somente leitura/restauração do corpus histórico.

## 0.1.8 - 2026-11-07

- Adiciona o campo opcional `vault_root` ao `v2 validate-root`: link fora-da-raiz
  que resolve no vault composto e auditado em `evidence.cross_vault_links`
  (nao reprova, nao gera backlink); link morto continua `UNRESOLVED_*`; sem o
  campo, o comportamento fail-closed root-relative e preservado (issue #5).
- Adiciona `EMPTY_ROOT` ao `v2 validate-root`: raiz com 0 arquivos lidos
  (vault composto sem superficie V2 no topo) devolve `ok:false` citando a raiz,
  em vez do `ok:true` vazio — mudanca intencional de contrato: consumers que
  validavam raiz vazia esperando verde devem validar a sub-raiz com
  `vault_root` ou criar a superficie no topo.
- Documenta a secao `Semantica de Root do validate-root` em `docs/usage.md`
  (root self-contained vs vault composto, contrato do `vault_root`,
  `cross_vault_links`, `EMPTY_ROOT` e a tabela dos 14 skips declarados da
  cadeia de coleta/resolucao), apontada pelo `SKILL.md`.
- Testes RED-first do vault composto (alvo cross-vault NAO-legacy — a armadilha
  `MEMORIA.md` do skip legacy-V1 esta documentada na issue #5).
- Contrato vigente inalterado: Dex Memoria V2 permanece o writer/selector
  ativo; `legacy-v1` somente leitura/restauracao do corpus historico.

## 0.1.7 - 2026-11-06

- Adiciona `dex-memoria v2 remember` como entrada cotidiana única: payload
  fechado, L2 default, slug/operação determinísticos, composição dos owners V2
  existentes, recibo sem payload privado e validação independente por rota.
- Encurta a skill canônica para uso cotidiano e remove do redirecionador global
  a exigência de leitura integral de SPEC/usage/runtime antes de gravar.
- Fecha schemas e limites do payload cotidiano, não fabrica hashes em falha sem
  commit e orienta `ROLLED_BACK` para retry com novo `operation_id`
  determinístico em vez de `resume` impossível.

- Torna `C:\CodexProjetos\dex-memoria\SKILL.md` a fonte completa e unica da
  skill; `install` passa a atualizar apenas o redirecionador do registry global,
  rejeita `--target` e nao seleciona copias locais ou instalacoes antigas.
- Dex Memória V2 passa a ser o writer/selector ativo; `legacy-v1` permanece somente para
  leitura e restauração do corpus histórico. Fixtures antigas continuam
  preservadas como evidência histórica, não como perfil ativo.

- Hardened the fixture-only create plan provenance, shared journal validation,
  replay identity, and terminal `ROLLED_BACK` handling.

- Publica JSON Schemas Draft 2020-12 para request, recover, plan, receipt,
  error, marker, manifest e checkpoints do create L1+L2.
- Documenta a CLI JSON fixture-only `create plan|apply|recover`, seus streams,
  limites, journal, failpoints, exit codes e riscos nao cobertos.
- Preserva a V1 documental e restringe a capacidade executavel V0 a fixtures
  descartaveis, sem anunciar release, vault real ou writer geral.
- Faz o receipt `FAILED` do `v2 remember` ecoar a causa real de validação:
  `route_receipts.<scope>.failure.detail.validation_errors` (códigos reais como
  `DIVERGENT_TAG_SET` e os `touched_paths` validados), além de `failure_code` e
  `failure_cause` — fecha o diagnóstico mudo de `CAPABILITY_VALIDATION_FAILED`
  (issue #3).
- Adiciona `ORPHAN_L1_LINE` ao `v2 validate-root`: linha do L1 apontando para
  `memorias/<slug>.md` inexistente agora é acusada com o destino citado
  (issue #2).
- Documenta o contrato de tags do V2 em `docs/usage.md` (seção `Contrato De
  Tags Do V2`: tags aninhadas, conjunto idêntico L1×L2, corpo varrido inteiro,
  destino resolvível) com exemplo e anti-exemplo, apontada pelo `SKILL.md`.

## 0.1.6 - 2026-06-19

- Publica `SKILL.md` como contrato operacional completo, nao como
  redirecionador curto.
- Adiciona `registry/agents-skills/dex-memoria/SKILL.md` como fonte versionada
  do redirecionador global `.agents/skills`.
- Atualiza `dex-memoria install` para copiar o contrato completo para
  `.dex-agent/skills/dex-memoria` e o redirecionador para
  `.agents/skills/dex-memoria/SKILL.md`.
- Documenta a participacao do `dex-memoria` na rota canonica
  `memory-write-route-v1`.
- Define que Finder/`rg` fazem preflight read-only, `dex-memoria`
  decide/escreve/classifica e `consciencia-memorias` valida antes do
  fechamento.
- Reforca que busca e escrita continuam separadas: `obsidian-memory-finder`
  nunca escreve memoria.

## 0.1.5 - 2026-05-17

- Documenta a taxonomia canonica de temas reutilizaveis.
- Reforca que tema nao deve ser apelido de projeto nem combinacao
  projeto-ferramenta.
- Atualiza validacao publica para cobrir a regra de tema como dominio
  reutilizavel.

## 0.1.4 - 2026-05-16

- Define `DEX_MEMORIA_HOME` como raiz canonica de memoria cross-project.
- Define o padrao `$HOME/.agents/memories` para memoria global e por tema.
- Reforca que memoria global/tema nunca deve ser criada dentro do workspace.
- Adiciona `dex-memoria memory-home` e diagnostico no `doctor`.

## 0.1.3 - 2026-05-15

- Documenta a arquitetura `L1 lembranca -> L2 memoria -> L3 conhecimento`.
- Adiciona templates e exemplo sanitizado para recuperacao em camadas.
- Adiciona simulacoes sanitizadas para validar aprendizado real e detectar
  gatilhos sem ancora L2.
- Reforca que o carregamento automatico das camadas pertence ao ambiente
  consumidor; `dex-memoria` continua sem runtime proprio.

## 0.1.2 - 2026-05-09

- Adiciona empacotamento npm com `package.json`.
- Inclui CLI `dex-memoria` com comandos `doctor`, `install` e `version`.
- Mantem a fronteira da V1: o pacote distribui contrato documental, nao runtime do Dex Agent.

## 0.1.1 - 2026-05-02

- Adiciona guia de instalacao, uso e ativacao em `docs/usage.md`.
- Inclui prompts prontos para ativacao geral, classificacao, criacao, resolucao e uso por projeto filho.
- Atualiza o README para apontar o caminho de uso sem prometer runtime, hooks ou scripts V2.

## 0.1.0 - 2026-05-02

- Publicacao inicial do pacote documental `dex-memoria`.
- Define contrato de ciclo de vida para memoria operacional.
- Inclui templates, exemplos sanitizados e fronteira com o runtime do Dex Agent.
- Nao inclui runtime, hooks, inbox, ledger real, logs, screenshots ou secrets.
