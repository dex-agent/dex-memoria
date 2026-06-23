# dex-memoria Project Index

Porta curta para uma nova janela localizar as fontes vivas do projeto sem
depender do historico da conversa.

## Load Order

1. `AGENTS.md` - bootstrap local, fronteiras e validacao.
2. `.agents/PROJECT.md` - identidade estavel e restricoes locais.
3. `.agents/STRUCTURE.md` - mapa de diretorios e arquivos.
4. `.agents/ACTIVE.md` - foco atual, bloqueios e proximo passo.
5. `.agents/HANDOFF.md` - retomada detalhada quando houver trabalho em curso.
6. `.agents/MEMORY.ndjson` - memoria compacta local, apenas por gatilho.
7. `.codex/napkin.md` - runbook tatico curto, se existir.
8. `.agents/PLAN-TASKS/ACTIVE.md` - Trilho ativo, se houver.

## Public Contract Sources

- `README.md` - visao geral, instalacao e fronteiras.
- `SKILL.md` - entrada operacional da skill `dex-memoria`.
- `SPEC.md` - contrato de ciclo de vida de memoria.
- `docs/usage.md` - guia de instalacao, uso e ativacao.
- `docs/runtime-boundary.md` - separacao entre contrato documental e runtime.
- `docs/memory-home.md` - raiz canonica `DEX_MEMORIA_HOME`.
- `docs/integration-dex-agent.md` - integracao com Dex Agent.
- `docs/layered-memory-simulations.md` - simulacoes L1/L2/L3.
- `registry/agents-skills/dex-memoria/SKILL.md` - fonte versionada do
  redirecionador global instalado em `.agents/skills`.
- `contracts/` - contratos operacionais complementares.
- `templates/` - modelos copiaveis e sanitizados.
- `examples/` - exemplos sanitizados; nunca estado real.

## Canonical Source And Sync

- Fonte canonica de desenvolvimento: `C:\CodexProjetos\dex-memoria`.
- Redirecionador no registry global:
  `$env:USERPROFILE\.agents\skills\dex-memoria\SKILL.md`.
  A fonte versionada dele fica em
  `registry/agents-skills/dex-memoria/SKILL.md`.
  Ele deve ceder para copia local do workspace, depois usar
  `C:\CodexProjetos\dex-memoria\SKILL.md` como fonte completa de
  desenvolvimento/publicacao, e usar
  `$env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md` como fallback
  operacional instalado somente se o repo de desenvolvimento nao existir.
- Copias em repos filhos exigem inventario, diff, backup e decisao explicita
  antes de sincronizar.
- Divergencia sem criterio claro deve ser marcada como `conflict-review`.
- O padrao atual inclui `Checklist De L3 Robusto`, `L3 robusto`,
  `Graphify API`, `rg de achabilidade` e `source: graphify`.

## Package And Validation

- `package.json` - metadados, binario e scripts npm.
- `bin/dex-memoria.js` - CLI documental da V1.
- `registry/agents-skills/dex-memoria/SKILL.md` - conteudo que o `install`
  copia para o registry global `.agents/skills`.
- `scripts/validate-public.js` - validacao da estrutura publica.

Checks preferidos:

```powershell
npm run check
npm run doctor
npm run pack:check
```

## Local Context Surface

`.agents/`, `.ppirtv/`, `graphify-out/`, `.env`, logs e configuracoes locais
sao estado de maquina ou runtime. Consulte quando necessario para retomada
local, mas nao promova esse conteudo para documentacao publica sem garimpo,
sanitizacao e motivo claro.

## Safety Reminders

- Este repo e publico e nao deve carregar secrets, runtime state ou dados reais.
- `dex-memoria` e contrato/documentacao; nao e runtime do Dex Agent.
- `L3 robusto` exige L1 curto, L2 com ancora operacional e L3 verificavel.
- Memoria global e de tema fica fora do workspace, em `DEX_MEMORIA_HOME`.
- Para proximo passo operacional, `HANDOFF.md` e `ACTIVE.md` vencem historico.
