# Contributing

Thanks for helping improve `dex-memoria`.

This repository is intentionally small and public. It carries the documentation,
templates, examples, and skill contract for Dex Agent operational memory. It is
not the Dex Agent runtime.

## Campo novo em contrato publico

Checklist obrigatorio: campo novo em receipt/schema viaja com (1) o schema
publicado atualizado no MESMO PR, (2) teste de instancia-vs-schema
(test/memory-v2-receipt-schema-instance.test.mjs) cobrindo o campo, (3) entrada
no CHANGELOG. O gate da suite rejeita campo emitido sem declaracao.

## Mapas derivados sao projecao (nunca bump-por-rotulo)

`CAPACITY.md`, `DECISION-FLOW.md` e o `INDEX.md` da raiz sao projecoes do
estado real do repositorio. Ao tocar um corte/release, REGENERE os campos a
partir das fontes: versao por feature = CHANGELOG da versao que introduziu
(nao a corrente), contadores = saida da suite (`node --test`), SHAs =
`git rev-parse`/hash do arquivo vigente. Bump-por-rotulo (trocar "0.1.8" por
"0.1.12" em bloco) certificou dados falsos em release publicada (issue #14,
P1) — e proibido.

## Before You Change Files

- Check `git status --short` and preserve work you did not make.
- Do not edit secrets, local state, `.env`, runtime ledgers, private `.agents/`
  data, logs, screenshots, or session artifacts.
- Keep examples sanitized and free of real personal data.
- Keep behavior claims aligned with version `0.1.13`: no hooks or general
  automatic memory writes; the only executable create boundary is the marked,
  disposable fixture-only V0 documented in `docs/cli-create-fixture-v0.md`.

## Development

Run the available local checks:

```bash
npm run check
npm run doctor
npm run pack:check
```

`npm run check` validates the public repository structure and package metadata.
`npm run doctor` validates the installed package contract from the CLI entry
point. `npm run pack:check` verifies the package contents that would be packed.

## Pull Requests

- Keep changes focused.
- Update `CHANGELOG.md` when the public contract or package surface changes.
- Update `README.md` or `docs/` when usage changes.
- Explain whether the change affects Dex Agent runtime integration or only this
  documentation package.
