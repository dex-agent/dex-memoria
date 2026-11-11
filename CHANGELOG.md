# Changelog

## 0.1.18 - 2026-11-11

Status do contrato: **V2 writer/selector ativo** (`legacy-v1` apenas
leitor/restore).

Fix do ISSUE-LOCAL-0002: `assertSafeAncestors` agora é escopado ao boundary
do vault — audita apenas os ancestrais DENTRO do vault (`resolved_root` ->
alvo), não mais desde a raiz do drive. Workspaces alcançados por
junction/symlink ACIMA do `.agents` (ex.: `C:\DeepProjetos` -> `Z:`) voltam
a gravar memória de projeto; reparse points DENTRO do vault continuam
bloqueados (`SAFETY_BOUNDARY`) com erro nomeando o caminho ofensor. Targets
fora do boundary são recusados com mensagem que cita boundary e target.

Também neste corte: `.agents/TRACKER/` (fila de issues locais, schema
`dex.issue-local.v1`) passa a ser versionado no git — proteção contra o sync
do ecossistema que apagou a fila uma vez (`robocopy /MIR`); o restante de
`.agents/` segue local. Testes: novo caso junction-acima-do-vault ->
`COMMITTED` com prova de escrita pelo caminho real (suíte 373/363/0).

## 0.1.17 - 2026-11-10

Status do contrato: **V2 writer/selector ativo** (`legacy-v1` apenas
leitor/restore).

Hotfix do ISSUE-LOCAL-0001 (REABERTO — regressão pela porta MM): guard de
charset no CHOKEPOINT cobrindo TODAS as portas:

- **Regressão**: o guard do 0.1.16 morava só na porta CLI (`remember`); a rota
  MM do dex-PPIRTV (`mm_memory_candidate_resolve`) escreve pelo
  `route-executor` (writer compartilhado) e rolou back 2× com
  `MISSING_BACKLINK` — trigger no shape nativo `^{slug}-[hash8]$` contendo os
  chars do guard, sem rejeição em request-stage.
- **Cura no chokepoint**: `validateCandidate` (route-executor) valida charset
  de title/trigger via helper SSOT `l1CharsetErrorMessage` — consumido pelo
  remember E pelo executor (uma verdade, duas portas); `v2 apply` e
  `v2 resume` ganham `validateCandidate` em request-stage (fail-fast antes de
  qualquer rota). Rejeitar o shape MM nativo é propositivo: o gerador (lado
  dex-PPIRTV) sanar o trigger; o erro cita o caractere e o contrato.
- **Docs**: seção Charset vale para TODAS as portas; `$ { }` declarados
  permitidos.
- Suite: 372 testes / 362 pass / 0 fail (10 skipped).

## 0.1.16 - 2026-11-09

Status do contrato: **V2 writer/selector ativo** (`legacy-v1` apenas
leitor/restore).

Hotfix do ISSUE-LOCAL-0001 (TRACKER local) — guard de charset na fronteira do
`v2 remember` e erro com contexto:

- **Causa provada por repro**: `]` no `title` fecha cedo os DOIS parsers da
  linha L1 (link markdown e wikilink de `renderL1Entry`), a aresta `L1->L2`
  nunca e observada e o write morre em `CAPABILITY_VALIDATION_FAILED
  (MISSING_BACKLINK)` com rollback. Hipotese anterior (angle brackets) foi
  refutada por repro controlada — `<...>` e `|` commitam normal.
- **Guard na fronteira**: title/trigger com `[`, `]`, `^` ou quebra de linha
  sao rejeitados em estagio de request (`INVALID_REMEMBER_REQUEST`) citando o
  caractere ofensivo, ANTES de qualquer escrita (nenhum journal criado).
  Parenteses, pipe e angle brackets seguem permitidos (o formato representa).
  Contrato documentado em `docs/usage.md` ("Charset De Title E Trigger").
- **Erro com contexto**: `MISSING_BACKLINK` em unit-receipt agora cita
  `unit: <slug>` e o sufixo esperado da linha L1 — o caller diagnostica a
  causa em vez de cacar o sintoma (heuristica "Provide Context with
  Exceptions", Clean Code en-2008 l.230; fronteira: G3 l.363).
- Suite: 370 testes / 360 pass / 0 fail (10 skipped).

## 0.1.15 - 2026-11-07

Status do contrato: **V2 writer/selector ativo** (`legacy-v1` apenas
leitor/restore).

Hotfix do issue #18 (consolidado adversarial 0.1.14) — vacinas bidirecionais,
pinos de contrato e projeções coerentes:

- **Bijeção BIDIRECIONAL no gate**: `CURE_PRECEDENCE` e as chaves de
  `MODE_BY_BUCKET` devem ser o MESMO conjunto — entrada órfã de qualquer lado
  (probes GHOST_BUCKET/WAIT/ARCHIVE) reprova no CI.
- **Pino bin↔schema**: o `const` de `contract_revision` no schema é conferido
  contra o receipt emitido (bump unilateral passa a reprovar).
- **Pino da ordem**: dual `JOURNAL_CONFLICT` + `TRANSACTION_ROLLED_BACK` =
  `recover_then_retry_new_operation` — swap silencioso em `CURE_PRECEDENCE`
  reprova no teste.
- **Instância de TODOS os 11 codes** no gate com `cure` pinado por code (fim
  da cobertura 4/11); teste cwd-independente (`import.meta.url`); asserts
  reordenados (enum `cure` antes de modos — mensagem certa pro erro certo).
- **Resolvedor único de verdade**: o guidance delega a `bucketOf` (tradução
  `UNCLASSIFIED→MANUAL` num lugar só).
- **Semântica rev corrigida**: rev2 = `cure` + `contract_revision` (0.1.14+);
  receipts 0.1.13 carregam `cure` SEM o campo (não validam contra o schema
  0.1.14+); rev1 = pré-`cure`. `RECOVERY_FAILED` documentado como
  `UNCLASSIFIED` (o que o emissor devolve).
- **Projeções coerentes**: DECISION-FLOW migrado a blobs `git hash-object`
  (mesma convenção do CAPACITY; DECISIONS.md blob real) e mermaid do CAPACITY
  SEM rótulo de versão (mata a classe do atraso recorrente em 3 cortes).
- Fallback mudo de mode: permanece coberto pela vacina bidirecional no CI +
  `$comment` do schema (runtime inalterado — erro nunca bloqueante).
- Suite: 367 testes / 357 pass / 0 fail (10 skipped). Adversarial deste corte
  adiada por decisão do dono (workflow em atualização de viabilidade).

## 0.1.14 - 2026-11-07

Status do contrato: **V2 writer/selector ativo** (`legacy-v1` apenas
leitor/restore).

Corte curativo do issue #16 (consolidado adversarial 0.1.13) — vacinas nas 3
tabelas da fonte única, discriminador de contrato e projeções honestas:

- **Gate vacina as 3 tabelas**: bijeção `MODE_BY_BUCKET` × `CURE_PRECEDENCE`
  (todo bucket exatamente 1× na precedência) + enum `cure` do schema ==
  buckets de `FAILURE_CURES` ∪ `UNCLASSIFIED`. O probe do issue #16 (bucket
  novo fora da precedência → receipt sem `mode` com suíte verde) morre no CI
  agora; fallback defensivo de `mode` no runtime.
- **`contract_revision: 2`** no receipt root (required no schema, mesmo PR):
  discriminador de máquina para mutações do contrato — rev2 = receipts com
  `cure` (0.1.13+); rev1 = implícito antes.
- **Resolvedor único** `cureOf`/`bucketOf` (UNCLASSIFIED é tratado como MANUAL
  na precedência — default explícito; fim dos dois resolvedores divergindo).
- **Projeções honestas**: mapas citam blobs `git hash-object` calculados
  pós-edição (imunes a CRLF/LF do working tree); CONTRIBUTING ensina a rota;
  mermaid do CAPACITY agora diz 0.1.13+.
- **docs/usage**: exemplo UNCLASSIFIED alcançável (`ROUTE_EXECUTION_FAILED`,
  errnos de fs) + inventário + ressalva `RECOVERY_FAILED` (fila issue #10).
- Suite: 366 testes / 356 pass / 0 fail (10 skipped).

## 0.1.13 - 2026-11-07

Status do contrato: **V2 writer/selector ativo** (`legacy-v1` apenas
leitor/restore).

Corte curativo da revisão adversarial do 0.1.12 (issue #14) — troca cópia
por consulta nos resíduos da fonte única:

- **`cure` por action**: toda action de `recovery` carrega a classificação da
  fonte única (`MANUAL`/`RECOVER`/`RETRY_NEW`/`RETRY_SAME`); código de falha
  fora de `FAILURE_CURES` devolve `cure: "UNCLASSIFIED"` — o receipt denuncia
  a própria lacuna em vez de degradar para manual mudo. A tabela passa a
  declarar os manuais do executor (`CASE_COLLISION`, `ROUTE_CONFLICT`,
  `SAFETY_BOUNDARY`, `RECEIPT_JOURNAL_DIVERGENCE`, `RECOVERY_CONFLICT`,
  `PRODUCER_PROVENANCE_REQUIRED`).
- **Schema no mesmo PR do emissor** (checklist CONTRIBUTING):
  `actions.items.cure` (enum fechado, agora `required`) e allOf de
  `retry_same_operation` deduplicado (estava 2x byte-a-byte no 0.1.12).
  ATENÇÃO a consumidores estritos: receipts emitidos antes do 0.1.13 não
  validam contra o schema novo (ação sem `cure`).
- **Gate de instância deriva os MODOS** de `MODE_BY_BUCKET` — nenhuma lista
  literal; bucket sem mode reprova com mensagem útil; enum do schema ==
  tabela (mata a meia-derivação apontada pela adversarial).
- **Divergência de contrato anunciada**: o dual `ROUTE_BUSY +
  TRANSACTION_ROLLED_BACK/IDEMPOTENCY_CONFLICT` resolve
  `retry_new_operation` COM `next_operation_id` (comportamento introduzido
  no 0.1.12 sem anúncio; agora caracterizado em teste e documentado).
- **Mapas derivados regenerados com dados reais** (versão por feature,
  contadores da suíte, SHAs reproduzíveis) e CONTRIBUTING ganha a regra:
  bump-por-rótulo de projeção derivada é proibido (P1 do issue #14).
- Suite: 365 testes / 355 pass / 0 fail (10 skipped).

## 0.1.12 - 2026-11-07

- Tabela de cura unica `FAILURE_CURES` + `CURE_PRECEDENCE` declarada
  (`MANUAL > RECOVER > RETRY_NEW > RETRY_SAME`) em um unico simbolo: o
  guidance de recovery passa a LER a tabela — dual misto ROUTE_BUSY +
  JOURNAL_CONFLICT agora sai `recover_then_retry_new_operation` (fecha o P1
  de precedencia do issue #12; caracterizacao RED derivada do probe da
  revisao adversarial).
- Declara `failure_message` e `failure` no schema do operation receipt e
  estende o gate de instancia ao nivel `route_receipts` (fecha o P1 do
  schema-invalid; o gate tambem passa a DERIVAR os casos de teste da propia
  tabela).
- Adiciona `allOf` de `retry_same_operation` ao schema do remember receipt
  (command null, sem next_operation_id) — a forma contraditoria deixa de ser
  schema-legal.
- Docs: tabela de modos com precedencia, declarando a fonte unica.
- Instancia local `workflow/manutencao-iterativa-com-evidencia@1.3.0`
  (receita de manutencao iterativa com evidencia; check-workflow
  `--delivery repo` verde).
- Contrato vigente inalterado: Dex Memoria V2 permanece o writer/selector
  ativo; `legacy-v1` somente leitura/restauracao.

## 0.1.11 - 2026-11-07

- Adiciona gate de instancia-vs-schema na suite: receipts reais dos modos de
  recovery validados contra o schema publicado (closed-set por nivel) com caso
  negativo sintetico — campo emitido sem declaracao nunca mais passa verde
  (impossibilita a classe do P1 da revisao adversarial; issue #10 item 5).
- Taxonomia de cura declarada (CURE_BY_RECOVER / CURE_BY_RETRY_NEW_OPERATION /
  CURE_BY_RETRY_SAME_OPERATION): ROUTE_BUSY deixa de ser mudo e vira
  `retry_same_operation` (mesma operacao, sem next_operation_id);
  `failure_message` do executor passa a chegar na action, declarada no schema
  (issues #10 itens 1, 2 e 8-parte).
- Documenta `request_fingerprint` como identidade de OPERACAO (nao dedup por
  conteudo) e adiciona ao CONTRIBUTING o checklist campo-novo-em-contrato
  (schema + teste de instancia no mesmo PR).
- Contrato vigente inalterado: Dex Memoria V2 permanece o writer/selector
  ativo; `legacy-v1` somente leitura/restauracao.

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
