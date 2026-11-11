---
id: ISSUE-LOCAL-0001
titulo: "v2 remember falha MISSING_BACKLINK L1->L2 quando o TITLE contém `]` (metacaractere markdown) — 3 instâncias 2026-11-09"
status: integrado
prioridade: P1
tipo: bug
tags:
  - "#tracker/issue"
  - "#tracker/dex-memoria"
aberto_por: "sessao:zcode (achado original: sess_de6b2108-c6a2-4b9c-af30-f0c93702bfb6)"
criado_em: 2026-11-09
atualizado_em: 2026-11-10
responsavel: sessao:zcode (reaberto+curado: PR #21 porta CLI 0.1.16; PR #22 chokepoint 0.1.17 — e7a7bfb)
vinculos:
  - "GH dex-agent/dex-memoria#2"
  - "GH dex-agent/dex-memoria#3"
---

# ISSUE-LOCAL-0001 — MISSING_BACKLINK L1->L2 com `]` no title

## Problema/objetivo

- **Observado**: `v2 remember` falha `CAPABILITY_VALIDATION_FAILED (MISSING_BACKLINK: L1->L2)` quando o **title contém `]`**. 3 instâncias em 2026-11-09 (auto-write no tema/ppirtv; mesma janela conseguiu escrever payloads sem o metacaractere).
- **Causa provada (repro controlada 2026-11-09, CLI real em fixture TEMP)**: `renderL1Entry` (`bin/memory-v2-route-executor.js:325-328`) interpola o title cru em `[${title}](memorias/x.md)` e `[[memorias/x|${title}]]`; o detector (`bin/memory-v2-capabilities.js:296` regex `\[[^\]]*\]\(([^)]+)\)` e `:315` `\[\[([^\]|]+)(?:\|[^\]]*)?\]\]`) fecha o colchete no `]` do title nos DOIS parsers → a aresta `L1->L2` nunca é observada → rollback.
- **Hipótese original REFUTADA**: angle brackets `<trilho>` no corpo E no title **não** reproduzem (COMMITTED na repro) — o achado da sessão irmã apontava o caractere errado.
- **Esperado**: title/trigger passam por um contrato de charset na fronteira do payload (erro claro citando o caractere ofensivo) OU o formato tolera metacaracteres de markdown sem perder a aresta; nunca um rollback silencioso sobre o SINTOMA.

## Impacto e contexto

- Consumidor: **toda escrita de memória da casa** (`v2 remember` é a porta cotidiana) — 3 falhas em 1 dia com rollback completo + retrabalho manual; a sessão irmã queimou horas na hipótese errada porque o erro não carrega a causa.
- Validador do sintoma: `bin/memory-v2-capabilities.js:70`.
- Selos do oraculo-clean-code (corpus en-2008): **G3 "Incorrect Behavior at the Boundaries"** (l.363 — title/trigger é entrada não-confiável cruzando a fronteira payload→markdown sem contrato de charset) e **"Provide Context with Exceptions"** (l.230 — o erro reporta a aresta faltando, nunca o porquê).
- Irmão histórico: GH #2/#3 (receipt sem causa; curado 0.1.7). Este bug é a mesma família: a causa morre na validação de capability.

## Evidências

- Achado original: sess_de6b2108 (flow `flow_20261109171131257_5703_0001`, 3 rollbacks; contorno manual L1+L2 + `v2 validate` ok).
- **Repro RED/GREEN (2026-11-09, esta janela, fixture `%TEMP%/dmbug*`)**: title `Repro com ] colchete` → **FAILED / TRANSACTION_ROLLED_BACK / MISSING_BACKLINK: L1->L2** (erro idêntico ao da irmã); title `Repro com | pipe` → COMMITTED; title `Repro com <trilho>` → COMMITTED; body com `<trilho>` → COMMITTED. Discriminante executável existente.
- Fontes lidas: `route-executor.js:300-337` (writer), `capabilities.js:252-342` (detector de arestas/tags/block-ids).

## Critérios de aceite

1. **Teste RED na suíte**: o discriminante da repro vira teste parametrizado (title com `]` falha do mesmo jeito; controles `<x>`/`|` verde) — provar causa na suíte, não só em fixture manual.
2. **Guard de charset na fronteira** (cura da causa): `v2 remember` rejeita title/trigger com metacaracteres que o formato não representa (`]`, `)`, `|`, newline; lista fechada documentada) com erro citando o CARACTERE e sugerindo substituição — selo G3 (fronteira fecha o contrato).
3. **Erro com contexto acionável**: a mensagem de MISSING_BACKLINK inclui unitSlug/linha L1 esperada (piso `arquivo:linha`) — selo "Provide Context with Exceptions" (l.230); contexto no erro devolvido, nunca no payload persistido.
4. **GREEN + docs**: suíte verde com o guard + 1 parágrafo em `docs/usage.md` declarando o charset de title/trigger.
5. **Guard no CHOKEPOINT cobrindo AMBAS as portas** (reabertura 2026-11-10): charset check no `validateCandidate` do route-executor (writer compartilhado) + request-stage no CLI `v2 apply`/`v2 resume` + teste parametrizado com payload shape-MM (`trigger ^{slug}-[hash8]$`); SSOT helper `l1CharsetErrorMessage` consumido por remember e executor.

## Lacunas

- Variante `)` no title e `]` no TRIGGER não sondadas na repro (mecanismo análogo esperado — cobrir no teste parametrizado).
- Os payloads ORIGINAIS das 3 falhas não foram recuperados (transactions do tema limpos; evidência via flow + repro sintética idêntica).
- Não verificado se `v2 validate` aceita par manual por validação ou lacuna do validador.

## Diálogo

- **[2026-11-09 · de: sessao:zcode · para: owner]** A plaquinha `TRACKER-LOCAL` deveria ser instalada no `AGENTS.md` público do projeto (skill dex-gerar-issues-git), mas o repo está FECHADO no `bf6b5d5` e a edição exigiria commit/push. Pergunta: aprova incluir a plaquinha na próxima reabertura do repo, ou mantém o gatilho apenas no `.agents/GATILHOS-VIVOS.md` local (feito nesta sessão, bootstrap já lê)? *aguardando: owner*
- **[2026-11-09 · de: owner (GO-PADRAO) · respondido por: sessao:zcode]** O dono respondeu `GO-PADRAO` sobre o Trilho `2026-11-09-issues-por-repo-dono` (registry), cujo critério C-10 exige literalmente a plaquinha no AGENS deste repo — aprovação cobre a instalação. Plaquinha instalada no `AGENTS.md` (seção Local Load Order, item 10) nesta sessão; edição fica no working tree (commit do repo dono é da janela que trabalha o repo, declarado no Trilho). O `aguardando: owner` do ITEM permanece para a CURA do bug (critérios de aceite), não para a plaquinha.
- **[2026-11-09 · de: sessao:zcode · para: owner]** Causa provada por repro controlada (title com `]`; hipótese angle-brackets refutada — ver Evidências). Hotfix de caixa pequena: guard de charset + teste parametrizado + contexto no erro (critérios 1-4). **AGUARDA GO do dono para abrir o ciclo de fix** (repo fechado; régua consumidor-primeiro satisfeita — consumidor é toda escrita de memória).

- **[2026-11-09 · de: sessao:zcode · para: owner]** CURADO: PR #21 merge squash `249d76b`, release `v0.1.16` — critérios 1-4 satisfeitos (teste parametrizado RED→GREEN na suíte 370/360/0; guard `[ ] ^ CR LF` citando caractere em estágio de request; MISSING_BACKLINK com `unit:` + linha L1 esperada; seção Charset em docs/usage). Lista final REFINADA por prova: ` ( ) |` sobrevivem ao formato e seguem permitidos (E-SE do chato contra overreach). Blobs pós-edição nos mapas (remember 1b3821f6, capabilities 382d31c5, usage b3873ef5).
- **[2026-11-10 · de: sessao:zcode (registry, 24º Jumper) · para: owner]** **REABERTURA — regressão da CLASSE pela porta MM, não pelo title**: omm/writer `mm_memory_candidate_resolve` (tema graphify) rolou back 2× com `MISSING_BACKLINK` pós-0.1.16, item/trigger contendo `^{slug}-[hash8]$` (chars do guard: `^`, `[`, `]`) — **sem rejeição no estágio de request**. Causa lida na fonte: o PR #21 pôs o guard em `bin/memory-v2-remember.js` (porta CLI, +11 linhas) e NÃO tocou `bin/memory-v2-route-executor.js` (writer compartilhado, `renderL1Entry` l.322 interpola `${candidate.trigger}` cru) — **guard numa porta não cobre a outra** (mesma lição multi-porta do gate CLAUSULA-RELACIONAL-ORACULOS do registry: vacina em molde não fecha classe multi-porta; chokepoint fecha). O contexto do erro (critério 3) FUNCIONOU: hint "check title/trigger for markdown metacharacters" + unit + linha esperada. Contorno pago e validado: escrita manual no formato do contrato + `v2 validate ok:true` (sha LEMBRANCA 45cc17d3, L2 5eee9429) + pendência fechada com `accept_ledger_only` (resolution `mcr_20261110150458060_1bdfbcbf7017ffcd5cad22c4`, flow `flow_20261110124215111_5860_0001` do registry). **Critério 5 proposto**: mover/duplicar o guard de charset para o chokepoint `route-executor` (antes do `renderL1Entry`) cobrindo AMBAS as portas + teste parametrizado com payload shape-MM (trigger `^{slug}-[hash8]$`) — RED na MM route hoje. **Gotcha irmão**: o retry do resolve REUSA o operation_id preso em PENDING ("use a new operation_id") — a rota MCP não casa operation nova; ver se a MM consegue mintar id fresco no retry. *aguardando: owner*

- **[2026-11-10 · de: sessao:zcode (registry, 24º Jumper) · para: owner]** **CRITÉRIO 5 PAGO (GO do dono "Fix agora nesta janela") — RED/GREEN provados, cura no WORKING TREE aguardando commit da janela dona**:
  - **RED (pior que o esperado)**: `test/memory-v2-apply-charset.test.mjs` provou que a porta MM não rolava back apenas — **COMMITAVA SUJO** (exit 0, COMMITTED) com trigger `^{slug}-[hash8]$`: a linha L1 nasce corrompida em silêncio (o detector de aresta ainda casa o link do title limpo → nenhuma capability falha). O rollback MISSING_BACKLINK do caso ao vivo só ocorria porque o item MM carregava o breaker em posição que quebrava o detector.
  - **GREEN (3 camadas, mesma regra SSOT)**: (1) helper `l1CharsetErrorMessage` exportado do route-executor (dono do `renderL1Entry`); (2) guard no `validateCandidate` (chokepoint pré-IO/journal — cobre executeMemoryRoute direto); (3) request-stage `validateCandidate` no CLI `v2 apply` + `v2 resume` ANTES do `coordinateMemoryOperation` — necessário porque o coordenador captura o erro do execute e o converte em receipt FAILED (stderr vazio; foi exatamente o transporte do caso ao vivo). Charset violations lançam `MemoryRuntimeError("INVALID_CANDIDATE", msg)` para atravessar o catch do dispatch v2 e chegar ao stderr com a mensagem integral. Bloco inline do PR #21 no remember.js agora consome o mesmo helper (mensagem idêntica byte-a-byte; teste do remember segue verde).
  - **Prova**: teste novo 2/2 (rejeição cita char + docs, SEM journal; controles `$ { } ( )` commitam); suíte completa `npm test` 372 testes / 362 pass / 0 fail (10 skips pré-existentes) + bateria documental ok. `docs/usage.md` seção Charset atualizada (vale para TODAS as portas; `$ { }` declarados permitidos).
  - **Gotcha irmão do transporte confirmado**: erro de validação lançado DENTRO do execute vira receipt (stdout, exit 5) — quem precisa de rejeição de request com stderr tem que validar ANTES do coordenador.

- **[2026-11-10 · de: sessao:zcode (janela dona do repo) · para: owner]** REINTEGRADO pela janela dona: diff da cura revisado (selo oraculo-refatoracao: mau cheiro Codigo Duplicado l.1130 curado — helper SSOT `l1CharsetErrorMessage`, duas portas, uma verdade; E-SE do chato fechado com evidencia: rejeitar shape-MM e propositivo, o gerador dex-PPIRTV sanar o trigger). Pipeline GO-PADRAO: suíte 372/362/0, PR #22 CI 2/2, merge squash `e7a7bfb`, release `v0.1.17` + tag + gh release, mapas blobs pos-edicao (dex-memoria a50987a, remember 5aaaec3, usage b98fb56) + chore mapas. RESSALVA para o lado dex-PPIRTV: o gerador MM precisa sanar o trigger `^{slug}-[hash8]$` (o erro novo cita o caractere); retry da MM com operation_id fresco e pendencia deles.

- **[2026-11-10 · de: owner · para: sessao:zcode]** Confirmação: **"issue corrigido"**. Item fechado no estado INTEGRADO (critérios 1-5 satisfeitos). Ressalva dex-PPIRTV (gerador MM sanar trigger shape-MM) roteada como ISSUE-LOCAL no TRACKER do dex-PPIRTV pela janela do registry (plaquinha ISSUES-POR-REPO-DONO).
