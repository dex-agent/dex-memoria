# Gatilhos Vivos

Hub de gatilhos quentes de reuso (promovidos do napkin quando um aviso ganha
alcance de projeto). Indice no topo: `| Gatilho | Quando lembrar | Fonte viva / acao |`;
detalhe no molde de 5 campos (GO do dono 2026-10-28): Por que / Como / Quando /
Onde / E-SE?? (pergunta adversarial com resposta curta, repetivel).

| Gatilho | Quando lembrar | Fonte viva / ação |
| --- | --- | --- |
| `DEX-MEMORIA-PROVA-W6-ZERO-DEPS` | provar build/teste deste repo antes de declarar pronto | `.agents/SCRIPTS/comprovar-node-arqueologia.sh` + receipt `.agents/RECEIPTS/2026-11-05-arqueologia-w6-comprovar-node.json` |
| `TRACKER-LOCAL` | no bootstrap: issues/PRs locais abertos moram em `.agents/TRACKER/INDEX.md` (plaquinha global `ISSUES-POR-REPO-DONO`; item 0001 MISSING_BACKLINK P1 aguardando owner) | `.agents/TRACKER/INDEX.md` — ler e ver coluna `aguardando` |
| `STALENESS-ARTEFATOS-DERIVADOS` | ANTES de ler/citar CRG, graphify, PLAYBOOK, INDEX ou mapa derivado | seção abaixo — 3 números: fonte × artefato × regen |

## `STALENESS-ARTEFATOS-DERIVADOS`

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
  1. **CRG** — `.code-review-graph/graph.db`; quando: `cd
     C:/CodexProjetos/code-review-graph && uv run code-review-graph status
     --repo C:/CodexProjetos/dex-memoria` (campos `Built at commit` — comparar
     com `git rev-parse HEAD` — e `Last updated`); regen: `uv run
     code-review-graph update --repo C:/CodexProjetos/dex-memoria`
     (incremental).
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
  check.
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
