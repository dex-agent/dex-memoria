# Gatilhos Vivos

Hub de gatilhos quentes de reuso (promovidos do napkin quando um aviso ganha
alcance de projeto). Indice no topo (com campo 0 `Quem`, emenda GO 2026-11-15):
`| Gatilho | Quem | Quando lembrar | Fonte viva / acao |`; detalhe no molde 5W2H
(GO do dono 2026-10-28): Quem / Por que / Como / Quando / Onde / E-SE??
(pergunta adversarial com resposta curta, repetivel).

| Gatilho | Quem | Quando lembrar | Fonte viva / ação |
| --- | --- | --- | --- |
| `DEX-MEMORIA-PROVA-W6-ZERO-DEPS` | harness `.agents/SCRIPTS/comprovar-node-arqueologia.sh` (sessão do repo roda) | provar build/teste deste repo antes de declarar pronto | `.agents/SCRIPTS/comprovar-node-arqueologia.sh` + receipt `.agents/RECEIPTS/2026-11-05-arqueologia-w6-comprovar-node.json` |
| `TRACKER-LOCAL` | skill `dex-gerar-issues-git` (dona do formato) | no bootstrap: issues/PRs locais abertos moram em `.agents/TRACKER/INDEX.md` (plaquinha global `ISSUES-POR-REPO-DONO`) | `.agents/TRACKER/INDEX.md` — ler e ver coluna `aguardando` |
| `STALENESS-ARTEFATOS-DERIVADOS` | sessão do projeto (regen: owner por artefato no inventário abaixo) | ANTES de ler/citar CRG, graphify, PLAYBOOK, INDEX ou mapa derivado | seção abaixo — 3 números: fonte × artefato × regen |
| `MERGE-CHECK-HOOK-PRE-MERGE` | hook `tools/playbook/hooks/pre-merge-commit` (dispara em todo `git merge` local) | todo merge local de branches; antes do clique de merge em PR remoto | seção abaixo — laboratório três vias + escapes |

## `STALENESS-ARTEFATOS-DERIVADOS`

- **Quem**: sessão do projeto (checa antes de citar; regen tem owner por
  artefato no inventário abaixo; fiscal: `$guarda-plaquinhas`).
- **Por que**: artefato derivado nasce fotografando a fonte num instante; se a
  fonte mudou sem regen, a leitura é confiante num mapa antigo — foto velha
  vira ruído confiável (falso verde). Pago ao vivo em 2026-11-06 neste repo: o
  CRG foi citado 2 commits stale (`22d1da4` vs HEAD `2a72434`) até o `update`
  incremental corrigir (372→403 nós, Functions 326→352).
- **Como**: comparar SEMPRE 3 números — (a) quando a FONTE mudou
  (`git log -1 --format=%cI` ou `stat` dos arquivos-fonte), (b) quando o
  ARTEFATO foi gerado (campo de timestamp/commit dele), (c) fonte > artefato ⇒
  STALE ⇒ rodar o regen e só então citar. Staleness medido em segundos/SHAs,
  nunca "parece atual". Artefatos cobertos (inventário 2026-11-06, todos
  confirmados no disco):
  1. **CRG** — `.code-review-graph/graph.db`; quando (1 comando, compara
     sozinho): `code-review-graph doctor` no cwd do repo (linha "built at
     <sha> but HEAD is <sha>" = stale; ver detalhes com `status --repo`);
     regen: `code-review-graph update --repo .` (incremental). Trocado ao
     vivo em 2026-11-18: doctor reportou grafo stale (`1939a54` vs HEAD
     `ee3a207`) — a foto velha existia de verdade.
  2. **graphify estrutural** — `graphify-out/graph.json` (sem campo built_at:
     usar mtime do arquivo) × `git log -1 --format=%cI`; regen:
     `graphify update .` (exit 0).
  3. **PLAYBOOK** — `PLAYBOOK.md` + `PLAYBOOK.index.json`; check dedicado:
     `python -B tools/playbook/generate-playbook.py --repo . --check`
     (exit 0 = fresco, exit 2 = drift); regen: o mesmo com `--write`; hook
     pre-commit anti-drift ativo (`core.hooksPath=tools/playbook/hooks`).
  4. **INDEX.md** (raiz e subpastas) — derivado CURADO (sem gerador); drift =
     linha morta/pasta de conteúdo sem índice; fiscal: `scan-fechamento.py`
     superfície 4 (owner `dex-fechamento-projeto-atualizado`); "regen" =
     corrigir a linha na mesma sessão (doutrina `INDEXACAO-ARVORE`).
  5. **Mapa de dependências** — `.agents/DEPENDENCIES.md` (fonte = `bin/` e
     `scripts/`); stale quando o código muda; regen = re-rodar W3–W7 da
     arqueologia (owner: próxima arqueologia do repo).
  Ausências registradas: receipts em `.agents/RECEIPTS/` são evidência
  congelada datada — não consultáveis como "estado atual", ficam fora do
  check. DESDE 0.1.19 (2026-11-18) os mapas PÚBLICOS (`CAPACITY.md`/
  `DECISION-FLOW.md`) têm gate mecânico de blob no `npm run check`
  (`validate-public.js`, issue #20) — drift de blob citado reprova commit;
  o staleness-check acima continua valendo para os artefatos SEM gate
  (CRG, graphify, PLAYBOOK tem --check dedicado no pre-commit, INDEX, MAPAS).
  6. **Mapas de projeto** — `.agents/MAPAS/{missao,capacidades,decisoes}.md`
     (instalados 2026-11-06); fonte = ACTIVE/HANDOFF/Git/`DECISIONS.md`;
     quando: data do corte no cabeçalho de cada mapa; regen = re-rodar as
     skills `dex-mapa-missao`/`dex-mapa-capacidades`/`dex-mapa-das-decisoes`
     no corte novo (owner: sessão do fechamento de bloco material).
- **Quando**: ANTES de qualquer leitura/citação do artefato — janela fria,
  re-arqueologia, decisão que cita "o grafo diz X", métrica de pódio, contagem
  de nós, regra do playbook.
- **Onde**: este hub + os comandos por artefato acima (fonte viva reabrível);
  memória irmã `CRG-GATE-SKILLS-FALSO-POSITIVO` (gate do CRG).
- **E SE?? o repo não tiver git (sem git log)?** → `stat`/mtime dos
  arquivos-fonte contra o timestamp do artefato (mesmos 3 números).
  **E SE?? o check der STALE mas a ferramenta de regeneração não estiver
  instalada?** → declarar o artefato "não consultável" (nunca citar número
  dele) e estacionar a instalação com owner/quando (`estacionamento`).
  **E SE?? o check passar (verde) mas o conteúdo parecer errado?** → verde de
  staleness não é prova de semântica: abre a FONTE, não o artefato — "fonte
  viva sempre vence memória".

## `MERGE-CHECK-HOOK-PRE-MERGE`

- **Quem**: hooks `tools/playbook/hooks/pre-merge-commit` (dispara sozinho em
  todo `git merge` local com commit automático) e `pre-commit` (irmão do
  playbook, que roda a suíte quando detecta `MERGE_HEAD` no commit de
  resolução manual); mantém: sessão do repo; motor: fork casa
  `code-review-graph >= 2.4.0+dex.1`, instalado global no PATH — NÃO usar
  `code-review-graph install`, que registra MCP/skills de plataforma e não é
  gate). Instalado 2026-11-18; ciclos de vida reprovados com Git real no corte
  0.1.20 (issues #28/#29 — laboratório `.agents/EVIDENCIAS/2026-11-21-issue28-29/`).
- **Por que**: merge que quebra nasce verde na suíte das partes — cada lado
  passa sozinho, a combinação não; sem gate, o commit de merge nasce e o
  estrago aparece downstream. O laboratório três vias (base/ours/theirs)
  detecta conflito textual E semântico antes do commit existir.
- **Como**: automático, pelo ciclo de vida REAL do Git (medido no Git 2.45.1,
  corte 0.1.20). Suíte declarada em `tools/playbook/hooks/merge-check.conf`
  (`SUITE="npm test"`; vazia = avisa e NÃO bloqueia). Merge automático: o
  `pre-merge-commit` roda ANTES de `MERGE_HEAD` existir e o worktree já contém
  o resultado → suíte direto no worktree. Commit de resolução manual: o git
  dispara o `pre-commit` (não o pre-merge-commit) com `MERGE_HEAD` presente →
  o irmão roda a suíte no worktree resolvido. `MERGE_HEAD` presente no
  pre-merge-commit (ex.: merge --no-commit) → gate completo três vias:
  `code-review-graph merge-check --repo . --base $BASE --ours $OURS --theirs
  $THEIRS --test-failure-exit 1 -- $SUITE`. Bloqueio = mensagem com o comando
  para inspecionar fora do hook. Escapes declarados: `MERGE_CHECK_SKIP=1`,
  `git merge --no-verify` ou `git commit --no-verify` (o escape do merge-check
  não desliga o playbook check do pre-commit). `execution_error` (exit 2)
  reporta sem bloquear — suíte doente não é veredito de integração.
- **Quando**: todo merge local de branches (hook automático); e ANTES do clique
  de merge em PR remoto (o hook local não vê merge de plataforma — ver E-SE).
- **Onde**: `tools/playbook/hooks/pre-merge-commit` + `merge-check.conf`;
  `core.hooksPath=tools/playbook/hooks` (mesmo diretório do `pre-commit` do
  playbook — irmãos, não rivais; NÃO remover hooks irmãos ao mexer aqui).
- **E SE?? o merge for remoto (botão/CLI de PR no GitHub)?** → o hook local
  NÃO roda: a sessão roda o laboratório manual antes do clique —
  `code-review-graph merge-check --repo . --base $(git merge-base origin/main HEAD) --ours origin/main --theirs HEAD --test-failure-exit 1 -- npm test`.
  **E SE?? o índice do CRG (`.code-review-graph/`) estiver stale?** → não
  invalida o gate: o merge-check monta laboratório próprio três vias,
  independente do índice corrente (staleness do índice é ficha irmã acima).
  **E SE?? o gate devolver execution_error (exit 2)?** → hook reporta e segue
  (exit 0): o conserto é da suíte, não do merge — curar a suíte e re-rodar o
  merge-check manual antes de confiar.
  **E SE?? merge automático sem conflito e o gate reprovar (suíte vermelha)?**
  → o commit de merge NÃO nasce; o worktree fica com o resultado aplicado —
  rode `git merge --abort` para voltar ao estado pré-merge, cure a suíte e
  refaça o merge.
  **E SE?? quero provar hook de merge mudando o código dele?** → use Git REAL
  (napkin item 5: repo descartável + wrapper instrumentador); prova por stub de
  MERGE_HEAD falseia o ciclo de vida (pago na issue #28).

## `DEX-MEMORIA-PROVA-W6-ZERO-DEPS`

- **Por que**: o pacote é zero-deps e não versiona lockfile — `npm ci` é inaplicável
  e `npm install` é desnecessário; seguir a receita npm padrão gera falso vermelho ou
  instalação inútil, e o gate textual do `node --test` muda de formato entre versões
  do Node.
- **Como**: rodar o harness (node --check nos 24 fontes de produção + `npm test` +
  `npm run doctor` + `npm run pack:check`, exits SEM pipe, resumo casando
  `^(#|ℹ) fail`); exigir exit 0 do harness E fail=0 no resumo; baseline
  2026-11-05: 347 tests / 337 pass / 0 fail / 10 skip.
- **Quando**: antes de declarar qualquer mudança pronta neste repo; ao retomar e
  suspeitar de regressão da suíte.
- **Onde**: `.agents/SCRIPTS/comprovar-node-arqueologia.sh`; memória L2
  `prova-de-build-teste-do-dex-memoria-zero-deps...` (`.agents/memorias/`).
- **E SE?? o harness devolver VERMELHO com exits 0?** → gate textual casou formato
  errado do resumo: abra o output e confira o prefixo real antes de mexer em código.
  **E SE?? a contagem de tests mudar?** → suíte cresceu: atualize o baseline no
  receipt e na memória, skip opt-in pode variar, fail tem que ser 0.
GO-PADRAO linha canônica (renomeado de GO-PIPELINE-PADRAO em 2026-11-07): [$<oraculo>] GO PADRAO — contrato ~/.agents/CONTRACTS/GO-ACEITE-RECOMENDACAO.md (usado 1x: 0.1.13)
