# Structure - dex-memoria

## Raiz Publica

- `AGENTS.md`: regras locais para agentes e fronteiras do projeto.
- `INDEX.md`: porta curta de carregamento para nova janela.
- `README.md`: visao geral publica.
- `SKILL.md`: contrato operacional da skill.
- `SPEC.md`: especificacao principal do ciclo de vida de memoria.
- `SPEC-PLAN.md`, `SPRINTS.md`, `TASKS.md`: documentos historicos/produto do
  pacote; nao substituem Trilhos novos em `.agents/PLAN-TASKS/`.
- `CHANGELOG.md`, `DECISIONS.md`: historico publico de mudancas e decisoes.
- `SECURITY.md`: escopo de seguranca e conteudo proibido.
- `CONTRIBUTING.md`: regras de contribuicao.

## Codigo E Validacao

- `package.json`: metadados npm, scripts e arquivos publicados.
- `bin/dex-memoria.js`: CLI documental.
- `scripts/validate-public.js`: checagem da estrutura publica.

## Contratos, Docs E Modelos

- `contracts/`: contratos complementares.
- `docs/`: guias publicos e fronteiras.
- `templates/`: modelos copiaveis.
- `examples/`: exemplos sanitizados.

## Contexto Local Para IA

- `.agents/PROJECT.md`: identidade e restricoes estaveis.
- `.agents/STRUCTURE.md`: este mapa estrutural.
- `.agents/ACTIVE.md`: foco atual e proximo passo.
- `.agents/HANDOFF.md`: retomada detalhada.
- `.agents/MEMORY.ndjson`: memoria compacta local, append-only.
- `.agents/PLAN-TASKS/`: catalogo de Trilhos locais.
- `.codex/napkin.md`: runbook tatico curto, se existir.

## Gerado, Privado Ou Runtime

Nao tratar como fonte publica sem sanitizacao:

- `.env` e `.env.*`;
- `.codex/config.toml`;
- `.ppirtv/`;
- `.agents/MEMORY.ndjson`, inboxes, ledgers e handoffs privados;
- `graphify-out/`;
- `node_modules/`, caches, logs e imagens geradas.
