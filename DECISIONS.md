# Decisions

## 2026-06-09 - Fonte Canonica De Desenvolvimento

- `C:\CodexProjetos\dex-memoria` e a fonte canonica de desenvolvimento do
  pacote documental e contrato publico `dex-memoria`.
- `C:\Users\Administrator\.agents\skills\dex-memoria\SKILL.md` e
  redirecionador/ponte curta no registry global de skills, nao uma copia
  completa do contrato nem o repositorio de desenvolvimento.
- Quando nao houver `dex-memoria` local no workspace, o fallback operacional e
  `C:\Users\Administrator\.dex-agent\skills\dex-memoria\SKILL.md`; o caminho
  `C:\CodexProjetos\dex-memoria\SKILL.md` fica como fallback final se local e
  `.dex-agent` falharem.
- Copias locais em repos filhos continuam locais ate haver inventario, diff,
  backup e decisao explicita de sincronizacao por repo.
- Divergencias sem criterio de escolha devem ser marcadas como `conflict-review`
  em vez de sobrescritas.

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
