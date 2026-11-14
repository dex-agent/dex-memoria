# TOOLSBOOK — índice de consulta

Abra primeiro este índice; depois apenas as fichas pertinentes.
Fonte: TOOLSBOOK.json. Livro completo: TOOLSBOOK.md.
Resumo de descoberta, não prova de adequação nem cobertura total.

## cli-dex-memoria (reviewed)

CLI principal do pacote: dispatch de todos os subcomandos (help/version/doctor/memory-home/install/routes + famílias v2 e create) com contrato documental interrogável (COMMAND_DOC em bin/cli-doc.js).
Quando: Toda operação de memória do operador: gravar, validar, diagnosticar instalação, instalar redirector global, interrogar documentação de comando.

## v2-remember-writer (reviewed)

Porta canônica de escrita de memória: valida request (charset de title/trigger via helper SSOT), planeja rotas por scope e comita L1+L2/L3 com receipt idempotente.
Quando: Sessão com achado memorável (payload fechado scope/title/trigger/body/tags); espelho de memória de projeto/global/tema.

## v2-route-executor-transaction (reviewed)

Executor transacional das rotas V2: snapshot → journal → publish atômico → receipt, com failpoints, recovery e CHOKEPOINT de guards (charset via validateCandidate + guard de reparse escopado ao boundary do vault).
Quando: Execução de plan/apply/resume/recover (consumido pelo CLI e por importadores como a rota MM do dex-PPIRTV); base de todas as escritas.

## v2-runtime-core-planner (reviewed)

Núcleo de planejamento/validação de rotas: plan por scope (project/global/theme), resolved_root (path.resolve CRU — decisão de identidade), coordenção de operações e resume de irmãos pendentes.
Quando: Antes de toda execução (o CLI chama planMemoryOperation/coordinateMemoryOperation); resumePendingSibling para dual-scope interrompido.

## v2-capabilities-validator (reviewed)

Validador de capacidades V2: contrato de tags (aninhada, conjunto idêntico L1×L2, corpo varrado), backlinks L1↔L2/L3 (v2-obsidian), ORPHAN_L1_LINE, cross-vault (vault_root) e anti verde-vazio (EMPTY_ROOT).
Quando: Antes de fechar bloco (validar unidade escrita); fiscalização de vault inteiro (validate-root); conferência de par manual.

## create-fixtures-v0 (reviewed)

Bancadas descartáveis V0 (fixture-only): planejar/aplicar/recuperar/jornalar criação L1+L2 em laboratório marcado, com schemas Draft 2020-12 — nunca grava vault vivo.
Quando: Estudo do contrato transacional e reprodução controlada de cenários (trabalho experimental com o formato).

## create-theme-v2-tracer (reviewed)

Tracer transacional V2 fixture-only para tema (L1→L2/L3) + inspetor de rotas de tema (auditar destination/l1/caminhos declarados em corpus de tema, 1MB/1000 rotas de teto).
Quando: Experimentar transação de tema em bancada; inspecionar consistência de rotas de um corpus de tema antes de operar nele.

## validate-public-gate (reviewed)

Gate estrutural do pacote público: 6 superfícies de versão alinhadas (VERSION/package.json/README×3/CONTRIBUTING), texto obrigatório, CHANGELOG history list, forbidden-tracked (com exceção documentada .agents/TRACKER/), paths de usuário hardcode proibidos.
Quando: Todo commit/PR/release (npm run check é a 1ª etapa do npm test e job de CI próprio).

## graduated-memory-battery (reviewed)

Bateria de casos graduados de memória: valida classificações (simples/operacional/robusta/ledger-only/descarte), promoções e força de evidência contra os casos canônicos de examples/.
Quando: Rodando no npm test (última etapa); ao mudar regras de classificação/graduação de memória.

## validate-create-contracts (reviewed)

Valida os schemas/contratos Draft 2020-12 da família create (layout/routes.inspect/theme-v2 request+plan etc.) com expressões canônicas (hash64/transaction/base64).
Quando: Ao tocar schemas em contracts/ ou a família create.

## shadow-limits-battery (reviewed)

Bateria shadow de limites de recursos: gera bootstraps node/powershell a partir da policy dex.memory.resource-limits.v1.json, lê canonicamente (sem BOM/CRLF) nas duas linguagens e compara hashes — paridade determinística de limites entre consumidores.
Quando: Ao mudar limites de recursos (link-line/tag/limite genérico) ou os geradores; prova de paridade node×powershell.

## create-recall-fixture (candidate)

Fixture integrado create-recall V2: monta bancada completa (com guard de reparse legado documentado) e exercita o ciclo criar→record→recall de ponta a ponta; hoje também é a prova do comportamento de junction no caminho do laboratório.
Quando: Integração local explicitamente opt-in (DEX_MEMORY_V2_INTEGRATION=1) ou ao investigar o ciclo create/recall completo.

## precutover-toolkit (candidate)

Kit pré-cutover: clona vault vivo para laboratório (prepare/verify/restore-cleanup com sha256 esperado) e valida evidência de recall pós-cutover contra schema dex.memory.precutover.evidence.v0.
Quando: Preparando migração/upgrade de vault (cutover): ensaio em clone antes de tocar o vault real; validação de evidência do ensaio.

## playbook-projection (reviewed)

Projeção externa PLAYBOOK.md/index.json: destila regras de decisão das fontes declaradas (playbook-sources.txt) em projeção determinística, com hook pre-commit incondicional anti-drift (commit cai se a projeção estiver stale).
Quando: Após editar fontes do playbook (AGENTS.md, napkin, ACTIVE); antes de enviar o repo a terceiros; o hook roda em todo commit.

## playbook-blind-judge (candidate)

Juiz mecânico da prova cega V5 (design campeão da arena-zcode): julga se uma resposta anônima usou o PLAYBOOK de verdade — menciona PLAYBOOK.md, cita >=1 selo real (pb-<8hex>), >=1 localizador real e >=1 rota da regra citada.
Quando: Auditar/responder a pergunta 'o playbook externo está sendo consumido?' com prova cega em vez de auto-declaração.

## crash-probe-support (reviewed)

Sonda de crash para failpoints: injeta filesystem que falha em ponto exato (EIO no rename do publish) dentro do executor real — prova de rollback/journal sob falha de transporte.
Quando: Escrevendo/testes de cenário de crash do executor; investigar recovery de transação interrompida.

## vault-fingerprint-support (reviewed)

Fingerprint de vault (schema dex.memory.vault-fingerprint.v0, sha256): identidade estável de vault inteiro com perfis fixture-governado vs live — detecta drift de conteúdo entre cópias/estados.
Quando: Comparar clone de laboratório contra vault vivo (fluxo precutover); provar que uma cópia é idêntica.

## smoke-consciencia-templates (reviewed)

Smoke dos templates L1/L2/L3: instância templates em temp e roda os validadores do vault (consciencia) contra o resultado — prova de que os templates publicados são consumíveis pela ferramenta irmã.
Quando: Ao editar templates/; no npm run smoke:consciencia (fora do npm test padrão).

## ci-github-actions (reviewed)

CI do repo (GitHub Actions): 2 jobs — suíte de teste win32 (node --test) e validação do pacote público (validate-public) em todo PR/push.
Quando: Todo PR e push na main — é o gate de merge da casa para este repo.

## npm-task-surface (reviewed)

Superfície de acionamento npm do repo: check/doctor/pack:check/smoke:consciencia/test (check + node --test + graduated) e test:local (test + smoke) — o mapa oficial de como a casa roda as provas.
Quando: Antes de montar comando manual: se existe task npm, ela é a rota canônica.

## gh-release-pipeline (reviewed)

Esteira de release via GitHub CLI (gh): PR + review squash-merge + CI + tag + gh release — distribuição oficial do pacote (Git/GitHub; npm descontinuado, decisão D-11).
Quando: Todo corte de versão (0.1.x): branch → PR → CI 2/2 → merge squash → tag vX.Y.Z → gh release create → chore de mapas.

Revisão: warning — external_sources_not_checked; reopen the canonical owner