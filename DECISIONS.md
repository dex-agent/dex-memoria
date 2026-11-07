# Decisions

## 2026-11-06 - Canal de distribuicao: Git/GitHub; registro npm descontinuado

- Decisao do dono: o pacote nao sera mais publicado no registro npm; o canal
  oficial de distribuicao e consumo e o Git/GitHub (main + tags + releases).
- O registro npm permanece com `0.1.5` como ultima versao publicada, por
  historico; `npm install dex-memoria` nao e mais rota suportada.
- Consumo pela frota: clone/pull do repo + `dex-memoria install` (redirector
  registry-only apontando a fonte canonica).
- A pendencia local NPM-PUBLISH-0.1.7 e consumida por esta decisao.

## 2026-08-08 - Formalizar schema do v2 validate-root

- Decisao: formalizar o contrato do `dex-memoria v2 validate-root` com dois
  schemas novos e separados: `dex.memory.validate-root.request.v2.schema.json`
  (request com `capability`, `require_obsidian` e `root`) e
  `dex.memory.capability.receipt.v2.schema.json` (receipt emitido pelo
  runtime, com campos opcionais `resolved_root`/`touched_files`/`evidence`
  para as variantes de root).
- `dex.memory.capability.v2.schema.json` e o CLI permanecem intocados.
- A auditoria `scripts/validate-create-contracts.js` passa a cobrir os dois
  schemas em `SCHEMA_FILES` e `EXPECTED`.
- Quando: revisao em 2026-08-15 (janela sugerida pela origem; owner pode
  ajustar) e antes de qualquer commit/push/release.

## 2026-07-16 - Fonte unica e instalador registry-only

- A fonte completa e unica da skill e
  `C:\CodexProjetos\dex-memoria\SKILL.md`.
- O registry global recebe apenas um redirecionador direto para essa fonte.
- `dex-memoria install` nao instala outra copia completa e rejeita `--target`;
  `--registry-target` permanece apenas para testar ou localizar o registry.
- Copias completas em workspaces e instalacoes antigas sao residuo
  nao-autoritativo, preservado ate decisao separada de limpeza.
- Ausencia da fonte canonica e bloqueio explicito, sem selecao silenciosa de
  outra copia.
- A decisao nao ativa V2 no vault vivo: `legacy-v1` continua ativo e V2 segue
  fixture/SHADOW ate recibos independentes e aceite humano.

## 2026-05-02 - Extracao Inicial

- O repo nasce como pacote documental, nao como runtime.
- A fonte local original em `dex-agent` permanece intacta.
- Exemplos devem ser sanitizados e nao carregar caminhos reais de clientes ou artefatos vivos.
- Skills globais serao atualizadas somente depois da publicacao e revisao da fronteira com `dex-agent`.
- Scripts V2 ficam fora do corte inicial.

## 2026-05-02 - Versao 0.1.0

- `0.1.0` e a primeira versao publica do contrato documental.
- A publicacao nao inclui runtime, secrets, logs, inbox, ledger real ou screenshots.
- Integracoes futuras devem apontar para este repo sem mover responsabilidades do Dex Agent automaticamente.

## 2026-07-12 - Fronteira executavel V2 fixture-only

- `C:\CodexProjetos\dex-memoria` e o owner fisico aprovado do futuro writer
  recuperavel de memoria; `dex-PPIRTV` sera o primeiro consumidor, nao o owner.
- A V1 publicada continua documental e seus comandos `doctor`, `memory-home` e
  `install` permanecem compativeis. Texto sobre gravacao automatica representa
  politica/direcao V2 e nao deve ser lido como prova de writer ja disponivel.
- A primeira fronteira executavel sera CLI JSON-in/JSON-out no pacote top-level,
  sem API publica de biblioteca, MCP proprio, daemon, banco ou subpacote no V0.
- O primeiro corte aceita uma unica operacao: `create` L1+L2 `legacy-v1`,
  somente em fixture descartavel com marcador explicito. L3, layout V2 e vault
  vivo permanecem fora do escopo.
- Comandos novos planejados: `dex-memoria create plan`, `dex-memoria create
  apply` e `dex-memoria create recover`. Entrada vem por `stdin`; sucesso usa
  um JSON em `stdout`; erro usa um JSON sanitizado em `stderr` e exit code nao
  zero.
- O request publico carrega intencao sem caminhos de `LEMBRANCA.md` ou
  `MEMORIA.md`. O root da fixture entra por `--fixture`; manifest e owner
  resolvem destinos internos e o owner renderiza o Markdown padronizado.
- A operacao e uma transacao recuperavel com journal, nunca chamada de
  atomicidade multi-arquivo. Estados minimos: `PREPARED`, `L1_PUBLISHED`,
  `COMMITTED` e `ROLLED_BACK`.
- Nenhum codigo esta autorizado por esta decisao isoladamente. O Trilho
  `.agents/PLAN-TASKS/2026-07-12-cli-json-create-l1-l2-fixture-only.md` precisa
  passar por revisao humana e nova liberacao antes de Implementacao.

## 2026-07-13 - Arquitetura alvo governed-theme-v2 aprovada, ainda inativa

- `legacy-v1` continua sendo o unico perfil operacional de escrita.
- `governed-theme-v2` foi aprovado como arquitetura alvo com status
  `approved_not_active` e suporte runtime `not_implemented`.
- No alvo, L1 roteia para exatamente um destino ativo: L2 para memoria
  leve/operacional ou L3 para conhecimento profundo.
- Conhecimento profundo nao cria L2 artificial apenas para servir de passagem.
- A classificacao depende de densidade; idade e quantidade de reusos nao
  promovem memoria automaticamente.
- A decisao nao autoriza paths, schema, writer, reader, validator, Finder,
  `lembranca.json`, migracao ou cutover V2.
- O mapa publico completo fica em
  [`docs/memory-architecture-profiles.md`](docs/memory-architecture-profiles.md).
- A ativacao exige Trilho separado, writer/readers/validators compativeis,
  shadow/no-shrink, recovery/rollback e recibo humano explicito de cutover.
