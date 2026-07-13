# Decisions

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
