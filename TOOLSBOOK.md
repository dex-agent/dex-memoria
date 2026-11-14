# TOOLSBOOK

Ferramentas executáveis do repo dex-memoria (CLI de memória operacional, validadores, baterias de fixture, projeção de playbook, suporte de teste e acionamentos CI/npm) + externais efetivamente usadas pela esteira de release.

Fonte autorada: TOOLSBOOK.json. Projecao de leitura; nao editar esta copia.
Checagem mecanica: structural_fresh.
Adequacao semantica e prontidao de commit: nao avaliadas pelo motor.

## Cobertura declarada

Inspecionado:
- bin/dex-memoria.js
- bin/cli-doc.js
- bin/memory-v2-runtime-core.js
- bin/memory-v2-route-executor.js
- bin/memory-v2-remember.js
- bin/memory-v2-capabilities.js
- bin/create-plan.js
- bin/create-apply.js
- bin/create-recover.js
- bin/create-journal.js
- bin/create-theme-v2-transaction.js
- bin/inspect-theme-v2-routes.js
- scripts/validate-public.js
- scripts/validate-graduated-memory.js
- scripts/validate-create-contracts.js
- scripts/smoke-consciencia-templates.js
- scripts/compare-memory-resource-limits-shadow.js
- scripts/generate-memory-resource-limit-artifacts.js
- scripts/read-memory-resource-limits-shadow.js
- scripts/read-memory-resource-limits-shadow.ps1
- scripts/run-memory-link-line-limit-shadow-fixture.js
- scripts/run-memory-resource-limits-shadow-fixture.js
- scripts/run-memory-tag-limit-shadow-fixture.js
- scripts/run-memory-v2-create-recall-fixture.js
- scripts/run-memory-v2-precutover-clone.ps1
- scripts/validate-memory-v2-precutover-evidence.js
- tools/playbook/generate-playbook.py
- tools/playbook/judge-playbook.py
- tools/playbook/hooks/pre-commit
- test/support/run-memory-v2-crash-probe.mjs
- test/support/vault-fingerprint.js
- .github/workflows/ci.yml
- package.json

Nao inspecionado:
- archive/ — planejamento histórico, não ferramental
- templates/ e examples/ — materiais consumidos pelos fixtures/smoke; artefatos GERADOS pela bateria shadow (bootstraps node/powershell) não examinados em detalhe
- contracts/ — schemas/fx consumidos pelos validadores; inspeção superficial (consumo via scripts catalogados)
- registry/agents-skills/dex-memoria/SKILL.md — fonte do redirector global; superfície de publicação, não execução
- docs/ — documentação do contrato; não é código executável
- test/*.test.mjs — suíte de prova (evidência das fichas); apenas os suportes reutilizáveis de test/support/ foram catalogados como ferramenta
- tools/playbook/judge-playbook.py — inspecionado (docstring + fluxo), NÃO executado nesta auditoria: exige artefato de resposta de prova cega

## cli-dex-memoria

**Estado autorado:** reviewed

**purpose:**
CLI principal do pacote: dispatch de todos os subcomandos (help/version/doctor/memory-home/install/routes + famílias v2 e create) com contrato documental interrogável (COMMAND_DOC em bin/cli-doc.js).

**when:**
Toda operação de memória do operador: gravar, validar, diagnosticar instalação, instalar redirector global, interrogar documentação de comando.

**how:**
node bin/dex-memoria.js <comando>; help/documentação por comando sai da tabela COMMAND_DOC (cli-doc.js) — nenhum help hardcode no dispatch.

**inputs:**
argv + stdin JSON (famílias v2/create); DEX_MEMORIA_HOME (opcional).

**outputs:**
JSON de receipt/relatório em stdout; exit 0 ok / !=0 falha com contrato de erro.

**risks:**
doctor/install tocam o perfil do usuário (redirector global ~/.agents/skills) — fora disso é read-only ou escreve só no vault alvo.

**owner:**
mantenedor do contrato (sessão do repo via dex-toolsbook)

**next_review:**
2027-01-14 ou quando dispatch ganhar comando novo

**capabilities:**
- dispatch CLI
- doctor de instalação
- install redirector
- contrato documental por comando

**not_for:**
- escrita automática em background (live writes são explícitas)
- executar runtime Dex Agent (fora do escopo do pacote)

**evidence:**
- npm run doctor na esteira local (0 fail, cortes 0.1.x)
- suíte npm test 373/363/0 no corte 0.1.18 cobre o dispatch via testes de CLI

**Fontes examinadas:**
- `bin/dex-memoria.js` — SHA256 `bb53fb76bd55872e83dbac3118a014630462f49dc542d410f6ce4a4160adb842`
- `bin/cli-doc.js` — SHA256 `161b9a70a34282bf785a3c66cfbd273c4fc88c5a9bad3eb2cbe6def733aad7d2`

## v2-remember-writer

**Estado autorado:** reviewed

**purpose:**
Porta canônica de escrita de memória: valida request (charset de title/trigger via helper SSOT), planeja rotas por scope e comita L1+L2/L3 com receipt idempotente.

**when:**
Sessão com achado memorável (payload fechado scope/title/trigger/body/tags); espelho de memória de projeto/global/tema.

**how:**
node bin/dex-memoria.js v2 remember < payload.json (stdin; heredoc do Git Bash já falhou INVALID_JSON — usar arquivo). Re-execução com mesmo operation_id é idempotente.

**inputs:**
JSON dex.memory.remember.request.v2 via stdin; cwd define workspace_root do scope=project.

**outputs:**
receipt dex.memory.remember.receipt.v2 (status COMMITTED, validation_ok, route_receipts por rota).

**risks:**
title/trigger com [ ] ^ CR/LF são rejeitados em estágio de request (guard de charset, ISSUE-LOCAL-0001); divergência scope×cwd gera destino inesperado — conferir workspace_root no receipt.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou próxima mudança em bin/memory-v2-remember.js

**capabilities:**
- escrita canônica L1+L2/L3
- validação de request na fronteira
- idempotência por operation_id

**not_for:**
- escrita silenciosa/automática (é operação explícita)
- payload com metacaractere de linha L1 (rejeitado de propósito — sanear antes)

**evidence:**
- test/memory-v2-remember.test.mjs na suíte 373/363/0 (corte 0.1.18)
- test/memory-v2-title-charset.test.mjs RED→GREEN (0.1.16)
- uso real: 30/30 memórias válidas no batch do projeto (2026-11-11)

**Fontes examinadas:**
- `bin/memory-v2-remember.js` — SHA256 `a36283313e01ea3a3ca6e41a1ff666c8acba3360c4558f41413056fc06ca79b8`

## v2-route-executor-transaction

**Estado autorado:** reviewed

**purpose:**
Executor transacional das rotas V2: snapshot → journal → publish atômico → receipt, com failpoints, recovery e CHOKEPOINT de guards (charset via validateCandidate + guard de reparse escopado ao boundary do vault).

**when:**
Execução de plan/apply/resume/recover (consumido pelo CLI e por importadores como a rota MM do dex-PPIRTV); base de todas as escritas.

**how:**
import { executeMemoryRoute, recoverMemoryRoute } de bin/memory-v2-route-executor.js; o CLI orquestra via runtime-core. Guard audita ancestrais de resolved_root até o alvo (boundary obrigatório nos 22 call sites).

**inputs:**
route planejada (runtime-core) + candidate v2 + producer_provenance.

**outputs:**
receipt de rota (COMMITTED/FAILED com code+message), journal em .agents/.dex-memoria/transactions/.

**risks:**
guard de reparse propositalmente NÃO faz realpath do resolved_root (identidade canônica do vault) — junction DENTRO do vault bloqueia, acima não; importador direto (MM) precisa sanitizar candidate (charset) do lado de lá.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou próxima mudança de guard/transação

**capabilities:**
- transação com journal e rollback
- failpoints de crash (IPC)
- recovery de rota
- chokepoint charset (l1CharsetErrorMessage)
- guard de boundary (assertSafeAncestors)

**not_for:**
- execução sem provenance de produtor (falha PRODUCER_PROVENANCE_REQUIRED em commit novo)

**evidence:**
- test/memory-v2-route-executor.test.mjs 31/31 no corte 0.1.18 (inclui RED→GREEN junction-acima 2.2ms e TOCTOU l.372 FAILED)
- regressão MM paga 2× e curada no chokepoint (0.1.17, PR #22)
- suíte 373/363/0

**Fontes examinadas:**
- `bin/memory-v2-route-executor.js` — SHA256 `946972eb7d8cddf855406158a5e8fd016c84cf426a376317c39e53d1a588dac9`

## v2-runtime-core-planner

**Estado autorado:** reviewed

**purpose:**
Núcleo de planejamento/validação de rotas: plan por scope (project/global/theme), resolved_root (path.resolve CRU — decisão de identidade), coordenção de operações e resume de irmãos pendentes.

**when:**
Antes de toda execução (o CLI chama planMemoryOperation/coordinateMemoryOperation); resumePendingSibling para dual-scope interrompido.

**how:**
import de bin/memory-v2-runtime-core.js; resolved_root = resolve(workspace_root|.agents | memory_home|global | memory_home|temas|<tema>).

**inputs:**
request dex.memory.operation.request.v2 (contract/implementation_version/scope/workspace_root/memory_home/operation_id).

**outputs:**
routes planejadas com idempotency_key/transaction_id/receipt_id.

**risks:**
resolved_root é cru (sem realpath) por desenho — mudar isso quebra identidade de vault e receipts históricos (decisão medida em ISSUE-LOCAL-0002); scopes duplicados no mesmo request são rejeitados.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou mudança de roteamento de scope

**capabilities:**
- plano por scope
- coordenação de operação
- resume de irmão pendente

**not_for:**
- canonicalização de caminho (propositalmente ausente)

**evidence:**
- suíte 373/363/0 (testes de plan/coordenação/dual)
- decoded na ISSUE-LOCAL-0002: resolved_root cru + guard desde a raiz era o falso SAFETY_BOUNDARY

**Fontes examinadas:**
- `bin/memory-v2-runtime-core.js` — SHA256 `3e08d632d0b362d769c7d329090deb07a3abf7c9f973324b44f1a62088c5113e`

## v2-capabilities-validator

**Estado autorado:** reviewed

**purpose:**
Validador de capacidades V2: contrato de tags (aninhada, conjunto idêntico L1×L2, corpo varrado), backlinks L1↔L2/L3 (v2-obsidian), ORPHAN_L1_LINE, cross-vault (vault_root) e anti verde-vazio (EMPTY_ROOT).

**when:**
Antes de fechar bloco (validar unidade escrita); fiscalização de vault inteiro (validate-root); conferência de par manual.

**how:**
node bin/dex-memoria.js v2 validate (unidade: capability/require_obsidian/root/touched_paths) ou v2 validate-root (root inteiro); capability aceita v2-markdown (sem backlinks) e v2-obsidian (exige L1↔destino).

**inputs:**
JSON de request via stdin.

**outputs:**
receipt ok/errors com codes nomeados (MISSING_BACKLINK cita unit e linha L1 esperada desde 0.1.16).

**risks:**
tags do L1 são extraídas só de linhas terminadas em ^<nome-do-arquivo>; citar hashtag de exemplo no corpo do L2 diverge o conjunto (DIVERGENT_TAG_SET) — vacina da plaquinha DEX-MEMORIA-L1-BLOCKID.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou mudança de contrato de tags

**capabilities:**
- validação de unidade
- validação de raiz
- cross-vault links
- anti verde-vazio

**not_for:**
- validar conteúdo SEMÂNTICO (valida forma/estrutura do contrato, não qualidade da memória)

**evidence:**
- issues #2/#3/#5 pagos sobre este validador (PRs #4/#6)
- suíte 373/363/0
- validate-root executado no vault real (378 arquivos, 2026-11-07)

**Fontes examinadas:**
- `bin/memory-v2-capabilities.js` — SHA256 `cc6338ed1c543d00ad6c514cb0133f6a210866614183082a55dc73dcc73520ef`

## create-fixtures-v0

**Estado autorado:** reviewed

**purpose:**
Bancadas descartáveis V0 (fixture-only): planejar/aplicar/recuperar/jornalar criação L1+L2 em laboratório marcado, com schemas Draft 2020-12 — nunca grava vault vivo.

**when:**
Estudo do contrato transacional e reprodução controlada de cenários (trabalho experimental com o formato).

**how:**
node bin/dex-memoria.js create plan|apply|recover|journal (JSON stdin); alvos fixos work/LEMBRANCA.md e work/MEMORIA.md.

**inputs:**
request dex.memory.create.* com fingerprints e snapshot.

**outputs:**
plan/apply/recover receipts + journal na bancada.

**risks:**
FIXTURE-ONLY por SPEC — usar para vault vivo é violação de contrato, não limitação técnica.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14

**capabilities:**
- bancada de criação descartável
- journal de transação fixture
- recovery de fixture

**not_for:**
- escrita em vault vivo (usar v2 remember)
- produção de qualquer espécie

**evidence:**
- suíte create-* na 373/363/0
- docs/cli-create-fixture-v0.md documenta streams/schemas/failpoints

**Fontes examinadas:**
- `bin/create-plan.js` — SHA256 `b654135a023f90df58cb833872ec34194ae96b914bf2177893a3db14ad883138`
- `bin/create-apply.js` — SHA256 `2578b44cebb53524683f75ab275e037c0d24055f3058d4b03aa9da5b9f171628`
- `bin/create-recover.js` — SHA256 `839f1fd856a78a17ae97982cc80d92bdd4b8a8857e44e63e23af4f58058d2636`
- `bin/create-journal.js` — SHA256 `ec6e1808055a6fc3b17be30be31c8ece33535bdca7be2ec5c73769348a344f8e`

## create-theme-v2-tracer

**Estado autorado:** reviewed

**purpose:**
Tracer transacional V2 fixture-only para tema (L1→L2/L3) + inspetor de rotas de tema (auditar destination/l1/caminhos declarados em corpus de tema, 1MB/1000 rotas de teto).

**when:**
Experimentar transação de tema em bancada; inspecionar consistência de rotas de um corpus de tema antes de operar nele.

**how:**
node bin/dex-memoria.js create theme-v2-transaction (tracer experimental); node bin/inspect-theme-v2-routes.js <doc> (inspetor standalone).

**inputs:**
request de transação de tema / documento de rotas JSON.

**outputs:**
trace transacional / relatório de inspeção com erros nomeados.

**risks:**
tracer é experimental V0 (sem ativação live); inspetor rejeita docs >1MB ou >1000 rotas.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14

**capabilities:**
- tracer de transação de tema
- inspeção de rotas de tema

**not_for:**
- ativação live de tema (contrato V0)

**evidence:**
- docs/cli-create-theme-v2-transaction-v0.md
- suíte create-apply-v2/create-plan-v2 na 373/363/0

**Fontes examinadas:**
- `bin/create-theme-v2-transaction.js` — SHA256 `d14878a46cb8b8a6731b2fb340756ec3a036f752096e195649657dfd8bb955db`
- `bin/inspect-theme-v2-routes.js` — SHA256 `ec3267d809fc00c60b91ca351faa15495d0495f53f1dcc939b5fe61ef148a676`

## validate-public-gate

**Estado autorado:** reviewed

**purpose:**
Gate estrutural do pacote público: 6 superfícies de versão alinhadas (VERSION/package.json/README×3/CONTRIBUTING), texto obrigatório, CHANGELOG history list, forbidden-tracked (com exceção documentada .agents/TRACKER/), paths de usuário hardcode proibidos.

**when:**
Todo commit/PR/release (npm run check é a 1ª etapa do npm test e job de CI próprio).

**how:**
npm run check (ou node scripts/validate-public.js); exit !=0 lista erros nomeados por superfície.

**inputs:**
working tree do repo.

**outputs:**
diagnóstico por superfície; exit 0 = estrutura ok.

**risks:**
bump de versão pela metade reprova (esperado — é o gate); lista de forbidden é design de segurança pública: mexer exige atualizar a exceção documentada (precedente TRACKER, 0.1.18).

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou ao adicionar superfície de versão

**capabilities:**
- alinhamento de versão
- segurança pública de repo
- histórico de changelog

**not_for:**
- aprovação semântica de conteúdo (estrutura, não sentido)

**evidence:**
- exit 0 nos cortes 0.1.16-0.1.18
- CI job 'Validate public package' 12s verde (PR #23)
- pagou 2× na história (0.1.7/0.1.12) e travou os bumps desde então

**Fontes examinadas:**
- `scripts/validate-public.js` — SHA256 `979fbf5a84beb57b9ecbf355862024fe3159fa51222f18c08d1edd76eb25d2c1`

## graduated-memory-battery

**Estado autorado:** reviewed

**purpose:**
Bateria de casos graduados de memória: valida classificações (simples/operacional/robusta/ledger-only/descarte), promoções e força de evidência contra os casos canônicos de examples/.

**when:**
Rodando no npm test (última etapa); ao mudar regras de classificação/graduação de memória.

**how:**
node scripts/validate-graduated-memory.js (via npm test); casos em examples/graduated-memory-test-cases.json.

**inputs:**
casos canônicos do repo.

**outputs:**
verde/vermelho por caso; exit !=0 descreve o caso violado.

**risks:**
casos são corpus fechado — nova regra de graduação exige caso novo aqui.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14

**capabilities:**
- graduação de memória
- força de evidência

**not_for:**
- valídação de vault real (é bateria de casos canônicos)

**evidence:**
- executa em todo npm test — 373/363/0 no corte 0.1.18

**Fontes examinadas:**
- `scripts/validate-graduated-memory.js` — SHA256 `28f233aadf54c7a06cd2b830e4c4380412f5b45fc570415d96dfc3d8bd62ea1a`

## validate-create-contracts

**Estado autorado:** reviewed

**purpose:**
Valida os schemas/contratos Draft 2020-12 da família create (layout/routes.inspect/theme-v2 request+plan etc.) com expressões canônicas (hash64/transaction/base64).

**when:**
Ao tocar schemas em contracts/ ou a família create.

**how:**
node scripts/validate-create-contracts.js (deepStrictEqual contra contratos esperados).

**inputs:**
contracts/schemas/*.

**outputs:**
conformidade por arquivo de schema.

**risks:**
lista de schemas é fechada — schema novo precisa entrar na lista.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14

**capabilities:**
- validação de schemas create

**not_for:**
- schemas da família v2 (validados pela suíte própria)

**evidence:**
- suíte 373/363/0 inclui este validador

**Fontes examinadas:**
- `scripts/validate-create-contracts.js` — SHA256 `3bd77d02c084f72fb71a532f625008a3de3b603f0238e11ecf4ef41e555d5c6e`

## shadow-limits-battery

**Estado autorado:** reviewed

**purpose:**
Bateria shadow de limites de recursos: gera bootstraps node/powershell a partir da policy dex.memory.resource-limits.v1.json, lê canonicamente (sem BOM/CRLF) nas duas linguagens e compara hashes — paridade determinística de limites entre consumidores.

**when:**
Ao mudar limites de recursos (link-line/tag/limite genérico) ou os geradores; prova de paridade node×powershell.

**how:**
node scripts/generate-memory-resource-limit-artifacts.js (gera); node scripts/run-memory-*-shadow-fixture.js (fixtures que orquestram comparação via compare-memory-resource-limits-shadow.js); read-memory-resource-limits-shadow.{js,ps1} são os leitores comparados.

**inputs:**
dex.memory.resource-limits.v1.json + schema + fixtures.

**outputs:**
receipts dex.memory.resource-limits.shadow-comparison.v1 (ou comparison-not-run declarado).

**risks:**
comparison-not-run é resultado VÁLIDO (ambiente sem condição) — não confundir com verde de paridade; bootstraps gerados não devem ser editados à mão.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou mudança de limites

**capabilities:**
- geração de bootstraps de limites
- leitura canônica node
- leitura canônica powershell
- comparação shadow

**not_for:**
- execução de limites em produção (é prova de paridade dos geradores)

**evidence:**
- test/memory-resource-limits-shadow-wave1/wave2-tags na suíte 373/363/0

**Fontes examinadas:**
- `scripts/compare-memory-resource-limits-shadow.js` — SHA256 `9a0ae59cf326de771fa541d8128aac2a5c19c3a467d670de6f329783611f0095`
- `scripts/generate-memory-resource-limit-artifacts.js` — SHA256 `6ca33d2eec3bc312b4beed27ea6477d38ae1df8f326da1def055b60b50a9ad49`
- `scripts/read-memory-resource-limits-shadow.js` — SHA256 `30b173bcb61e1d62f5f57e3cdc89dcef8a85ba0dc83e0d692ec3d02c86b2afd1`
- `scripts/read-memory-resource-limits-shadow.ps1` — SHA256 `9eced48385e13942626fb1145d69ac063b844fbfae4af4a9f922f3fed985b309`
- `scripts/run-memory-link-line-limit-shadow-fixture.js` — SHA256 `99a525439ffbfdc1d0ac6a1faa8592519380d6dbda4be461b422f77d7b18f8eb`
- `scripts/run-memory-resource-limits-shadow-fixture.js` — SHA256 `9d024debd096d170de9b4cbb2630477ab15db43e132704147d4828ebb268313a`
- `scripts/run-memory-tag-limit-shadow-fixture.js` — SHA256 `e07aa23c7268adac7e7e154df55727ddf42d442504e9ffecad5de7a66430b3a9`

## create-recall-fixture

**Estado autorado:** candidate

**purpose:**
Fixture integrado create-recall V2: monta bancada completa (com guard de reparse legado documentado) e exercita o ciclo criar→record→recall de ponta a ponta; hoje também é a prova do comportamento de junction no caminho do laboratório.

**when:**
Integração local explicitamente opt-in (DEX_MEMORY_V2_INTEGRATION=1) ou ao investigar o ciclo create/recall completo.

**how:**
DEX_MEMORY_V2_INTEGRATION=1 node scripts/run-memory-v2-create-recall-fixture.js.

**inputs:**
laboratório temporário próprio.

**outputs:**
relatório de ciclo + receipts.

**risks:**
sem a env var o teste da suíte SKIPA (falso verde de cobertura se alguém ler só o contador); guard interno de realpath-igualdade é comportamento legado desta bancada — o guard de PRODUÇÃO é o boundary-scoped do route-executor (distinguir os dois).

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou ao revisar a bancada integrada

**capabilities:**
- ciclo create-recall integrado
- bancada com guard próprio de laboratório

**not_for:**
- prova de comportamento de produção (é fixture opt-in)

**evidence:**
- documentado como revisita pendente na ISSUE-LOCAL-0002 (testes que codificam realpath-igualdade)
- suíte marca skip sem a env var

**Fontes examinadas:**
- `scripts/run-memory-v2-create-recall-fixture.js` — SHA256 `e7e3d80dc65a6fa5ed7f2589f5d3dca2c6a439eb7b34e098e28c086730d936a8`

## precutover-toolkit

**Estado autorado:** candidate

**purpose:**
Kit pré-cutover: clona vault vivo para laboratório (prepare/verify/restore-cleanup com sha256 esperado) e valida evidência de recall pós-cutover contra schema dex.memory.precutover.evidence.v0.

**when:**
Preparando migração/upgrade de vault (cutover): ensaio em clone antes de tocar o vault real; validação de evidência do ensaio.

**how:**
powershell scripts/run-memory-v2-precutover-clone.ps1 -Command prepare|verify|restore-cleanup -LaboratoryRoot <dir> -SourceZip <zip> -ExpectedSourceSha256 <sha> -LiveVaultPath <vault>; node scripts/validate-memory-v2-precutover-evidence.js < evidence.json (stdin, máx 32KB).

**inputs:**
zip do vault com sha esperado; laboratório; evidência JSON.

**outputs:**
clone verificado / veredito de evidência contra schema.

**risks:**
opera filesystem do usuário (clone/restore) — exige paths explícitos; validador rejeita >32KB de entrada.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou próximo cutover real

**capabilities:**
- clone de laboratório verificado
- validação de evidência de cutover

**not_for:**
- execução automática (cutover é decisão do dono)

**evidence:**
- INSPETOR: cabeçalhos/fluxo lidos nesta auditoria; corpus/fx em contracts/ declarado; NÃO executado nesta sessão (exige laboratório + zip alvo)

**Fontes examinadas:**
- `scripts/run-memory-v2-precutover-clone.ps1` — SHA256 `eb2383244146f3544a934545e66031beb99351fc0f769d5c95ea17c5f4f8baa1`
- `scripts/validate-memory-v2-precutover-evidence.js` — SHA256 `97936098195229f09165239998300b05911583501ebb3f7f33059d1181f32a09`

## playbook-projection

**Estado autorado:** reviewed

**purpose:**
Projeção externa PLAYBOOK.md/index.json: destila regras de decisão das fontes declaradas (playbook-sources.txt) em projeção determinística, com hook pre-commit incondicional anti-drift (commit cai se a projeção estiver stale).

**when:**
Após editar fontes do playbook (AGENTS.md, napkin, ACTIVE); antes de enviar o repo a terceiros; o hook roda em todo commit.

**how:**
python -B tools/playbook/generate-playbook.py --repo . --write (regen) | --check (exit 0 fresco / 2 drift); ativar hook: git config core.hooksPath tools/playbook/hooks.

**inputs:**
fontes declaradas em playbook-sources.txt.

**outputs:**
PLAYBOOK.md + PLAYBOOK.index.json na raiz (authority: derived_projection — nunca editar à mão).

**risks:**
commit com fonte editada e projeção não regenerada é BARADO pelo hook (pagou no 0.1.16); editar a projeção à mão gera drift silencioso no próximo --check.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou mudança de fontes

**capabilities:**
- projeção determinística
- trava de commit anti-drift

**not_for:**
- superfície de decisão (a verdade mora nas fontes; a projeção é para o destinatário externo)

**evidence:**
- --check exit 0 nos cortes 0.1.17/0.1.18
- hook barrou chore até o regen (pago 0.1.16)
- PLAYBOOK.md publicado na raiz

**Fontes examinadas:**
- `tools/playbook/generate-playbook.py` — SHA256 `1e7a49a0c0a1329ad0a377090b748833e83c75e9c8325e6b7a5e240bb4cfe764`
- `tools/playbook/hooks/pre-commit` — SHA256 `dfb080d077ad7edf6bf18dea159ad1b481cae43e8894ab0005ce0fe88c8157f1`

## playbook-blind-judge

**Estado autorado:** candidate

**purpose:**
Juiz mecânico da prova cega V5 (design campeão da arena-zcode): julga se uma resposta anônima usou o PLAYBOOK de verdade — menciona PLAYBOOK.md, cita >=1 selo real (pb-<8hex>), >=1 localizador real e >=1 rota da regra citada.

**when:**
Auditar/responder a pergunta 'o playbook externo está sendo consumido?' com prova cega em vez de auto-declaração.

**how:**
python -B tools/playbook/judge-playbook.py <resposta> <index> (leia argparse do arquivo para os args exatos); exit 0 = passou, exit 2 = critérios não cumpridos.

**inputs:**
arquivo de resposta anônima + PLAYBOOK.index.json.

**outputs:**
exit code + critérios cumpridos.

**risks:**
interseção de conjuntos — eco literal do AGENTS não casa (é o design: prova de USO, não de memorização).

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou próxima rodada de prova cega

**capabilities:**
- prova cega de consumo do playbook

**not_for:**
- medir qualidade da resposta (mede uso documental, não correção)

**evidence:**
- INSPETOR: docstring + fluxo lidos (critérios V5 declarados no cabeçalho); NÃO executado nesta auditoria — exige artefato de resposta de prova cega

**Fontes examinadas:**
- `tools/playbook/judge-playbook.py` — SHA256 `2070988155c5d024b3b3105481908e5d443015f2c3b2602460d73bd0dbad4f85`

## crash-probe-support

**Estado autorado:** reviewed

**purpose:**
Sonda de crash para failpoints: injeta filesystem que falha em ponto exato (EIO no rename do publish) dentro do executor real — prova de rollback/journal sob falha de transporte.

**when:**
Escrevendo/testes de cenário de crash do executor; investigar recovery de transação interrompida.

**how:**
spawn de node test/support/run-memory-v2-crash-probe.mjs <probe.json> (o probe declara o ponto de falha).

**inputs:**
probe JSON com o failpoint.

**outputs:**
execução que morre no ponto injetado (stderr) — a suíte confere o estado deixado.

**risks:**
é suporte DE TESTE com contrato de crash deliberado — nunca usar como ferramenta de operação.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14

**capabilities:**
- injeção de falha de transporte no executor

**not_for:**
- operação de produção

**evidence:**
- usado pelos testes de failpoint/rollback da suíte 373/363/0 (memory-v2-route-executor.test.mjs runCrashProbe)

**Fontes examinadas:**
- `test/support/run-memory-v2-crash-probe.mjs` — SHA256 `3ef80284569848ad103f22fdecc4d791994a295e499f5e88661994f495c2e341`

## vault-fingerprint-support

**Estado autorado:** reviewed

**purpose:**
Fingerprint de vault (schema dex.memory.vault-fingerprint.v0, sha256): identidade estável de vault inteiro com perfis fixture-governado vs live — detecta drift de conteúdo entre cópias/estados.

**when:**
Comparar clone de laboratório contra vault vivo (fluxo precutover); provar que uma cópia é idêntica.

**how:**
require('../../test/support/vault-fingerprint.js') (módulo com marcadores .dex-memory-fingerprint-{fixture,lab}.json).

**inputs:**
raiz do vault a fingerprintar.

**outputs:**
fingerprint sha256 com perfil.

**risks:**
perfis são distintos por design (fixture vs live) — comparar fingerprints de perfis diferentes não é paridade.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14

**capabilities:**
- fingerprint de vault
- perfis fixture/live

**not_for:**
- fingerprint de arquivo único (é do vault/dir)

**evidence:**
- test/vault-fingerprint.test.mjs na suíte 373/363/0

**Fontes examinadas:**
- `test/support/vault-fingerprint.js` — SHA256 `6ab9ce66c4a8003a7c6f2f6df37f550f9f72f759d78518ff5e74df105df4305c`

## smoke-consciencia-templates

**Estado autorado:** reviewed

**purpose:**
Smoke dos templates L1/L2/L3: instância templates em temp e roda os validadores do vault (consciencia) contra o resultado — prova de que os templates publicados são consumíveis pela ferramenta irmã.

**when:**
Ao editar templates/; no npm run smoke:consciencia (fora do npm test padrão).

**how:**
npm run smoke:consciencia (ou node scripts/smoke-consciencia-templates.js [--keep-temp]); resolve DEX_MEMORIA_HOME/perfil para achar os validadores.

**inputs:**
templates/ do repo + validadores do memory home.

**outputs:**
'consciencia template smoke ok' ou falha nomeada.

**risks:**
depende do ecossistema local (DEX_MEMORIA_HOME/perfil com consciencia) — máquina sem o vault da casa pode não resolver as tools.

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14

**capabilities:**
- smoke de templates contra validadores do vault

**not_for:**
- parte do gate padrão (é opt-in via test:local)

**evidence:**
- npm run test:local documentado; script lido nesta auditoria

**Fontes examinadas:**
- `scripts/smoke-consciencia-templates.js` — SHA256 `0f0e05fd84148b48a5274e04a6d50011cc5556f36c6068d4c5d8e0a500ff201a`

## ci-github-actions

**Estado autorado:** reviewed

**purpose:**
CI do repo (GitHub Actions): 2 jobs — suíte de teste win32 (node --test) e validação do pacote público (validate-public) em todo PR/push.

**when:**
Todo PR e push na main — é o gate de merge da casa para este repo.

**how:**
automático via .github/workflows/ci.yml; conferir com gh pr checks <N>.

**inputs:**
PR/push.

**outputs:**
checks pass/fail por job (duração típica: suite ~1m19s + validate ~12s).

**risks:**
runner é linux/windows conforme job — testes de junction podem skipar em ambiente sem reparse point (ressalva do corte 0.1.18); CI verde não substitui adversarial (decisão standing).

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou mudança de job

**capabilities:**
- gate de PR
- suíte remota
- validação pública remota

**not_for:**
- deploy (não há deploy — distribuição é Git/tag/release)

**evidence:**
- PR #23 checks 2/2 (1m19s/12s) no corte 0.1.18; histórico PRs #4-#23

**Fontes examinadas:**
- `.github/workflows/ci.yml` — SHA256 `ec8dae2b40b621182b44e333721d80dec8e2110204497b0927956ef5463b5d62`

## npm-task-surface

**Estado autorado:** reviewed

**purpose:**
Superfície de acionamento npm do repo: check/doctor/pack:check/smoke:consciencia/test (check + node --test + graduated) e test:local (test + smoke) — o mapa oficial de como a casa roda as provas.

**when:**
Antes de montar comando manual: se existe task npm, ela é a rota canônica.

**how:**
npm run <task> (lista completa em package.json scripts).

**inputs:**
—

**outputs:**
exits das provas encadeadas.

**risks:**
npm test encadeia check — exit de npm test esconde qual etapa falhou sem ler o log; npm ci não se aplica (zero-dependencies, sem lockfile, por policy documentada 2026-11-06).

**owner:**
mantenedor do contrato

**next_review:**
2027-01-14 ou task nova

**capabilities:**
- acionamento canônico de provas
- política zero-deps visível

**not_for:**
- instalação de dependências (não há; npm install é desnecessário)

**evidence:**
- npm test 373/363/0 e npm run check/pack:check exit 0 no corte 0.1.18

**Fontes examinadas:**
- `package.json` — SHA256 `89361f4a4c3a7a68bbfe0bf6effb9738e445fd52ce17f5a565251883771cd94a`

## gh-release-pipeline

**Estado autorado:** reviewed
**Revisao da fonte:** warning — external_sources_not_checked; reopen the canonical owner

**purpose:**
Esteira de release via GitHub CLI (gh): PR + review squash-merge + CI + tag + gh release — distribuição oficial do pacote (Git/GitHub; npm descontinuado, decisão D-11).

**when:**
Todo corte de versão (0.1.x): branch → PR → CI 2/2 → merge squash → tag vX.Y.Z → gh release create → chore de mapas.

**how:**
gh pr create/merge --squash --delete-branch; git tag + push; gh release create vX.Y.Z --notes; conferir gh release view.

**inputs:**
branch com o corte; notes do CHANGELOG.

**outputs:**
PR mergeado, tag publicada, release com notes.

**risks:**
gh close --comment já foi MUDO na história (0.1.8) — comentário em issue exige rota separada; a esteira NÃO publica npm (E401 histórico; distribuição é Git).

**owner:**
dono + sessão do repo

**next_review:**
2027-01-14 ou mudança de distribuição

**capabilities:**
- PR/merge com CI
- tag + release publicada
- distribuição Git-only

**not_for:**
- publish npm (descontinuado)

**evidence:**
- releases v0.1.7..v0.1.18 e PRs #4..#23 (histórico Git/GitHub)
- PR #23 + release v0.1.18 no corte 0.1.18 (18:01:33Z)

**Fontes externas (fora do check local):**
- GitHub CLI (gh) — locator: https://cli.github.com/ (binário gh do sistema, não pinado no repo); revision: CLI do sistema, fluxo versionado em CHANGELOG.md e nos Trilhos .agents/PLAN-TASKS/ dos cortes 0.1.7-0.1.18; evidence: uso real contínuo — PRs #4-#23 mergeados, tags/releases v0.1.7-v0.1.18 publicadas; caller local: esteira de release descrita nesta ficha e nos mapas CAPACITY/DECISION-FLOW (D-11/D-12)

**Fontes examinadas:**
- `CHANGELOG.md` — SHA256 `c04337a0d8722401841ab43dfa0e9fac104d4448f746fc27b78f1dd4897fac38`
