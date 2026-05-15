# Sprints - L1/L2/L3 No Dex Memoria

Data: `2026-05-15`
Status: `implementado localmente`
Owner de planejamento: `sprinter`
Cooperacao: `akita-dev-raiz`, `plano-avancado`, `documentacao-tecnica`, `entrevista-com-docs`

> Este plano ja passou pela lente adversarial do Chato: o risco principal e
> confundir documentacao com runtime e declarar aprendizado automatico sem
> mecanismo real. O sprint evita isso mantendo o pacote como contrato documental.

## Sprint 0 - Fechar Contrato De Implementacao

### Sprint Goal

Transformar o veredito tecnico em plano rastreavel antes de alterar o contrato
publico do pacote.

### Backlog

- [x] Registrar `SPEC-PLAN.md` com tese, escopo, riscos e gates.
- [x] Registrar `TASKS.md` com backlog priorizado.
- [x] Registrar `SPRINTS.md` com ordem de execucao.
- [x] Revisar com o usuario as perguntas em aberto de `TASKS.md`.

### Definicao De Pronto

- Existe um plano documental claro.
- O plano separa contrato, runtime e validacao.
- O usuario consegue aprovar ou corrigir o recorte antes da implementacao.

### Gate PPIRTV

- Pensamento: veredito tecnico registrado.
- Planejamento: SPEC-PLAN, TASKS e SPRINTS criados.
- Proxima fase: Implementacao somente apos aprovacao ou ajuste do recorte.

## Sprint 1 - Canonizar A Arquitetura L1/L2/L3

### Sprint Goal

Fazer o `dex-memoria` reconhecer oficialmente `lembranca`, `memoria` e
`conhecimento` como arquitetura de recuperacao governada.

### Backlog

- [x] Atualizar `SPEC.md` com conceitos L1, L2 e L3.
- [x] Atualizar `README.md` com a nova visao resumida.
- [x] Atualizar `docs/usage.md` com fluxo gatilho -> ancora -> detalhe.
- [x] Atualizar `docs/runtime-boundary.md` deixando claro que carregamento
      automatico pertence ao ambiente consumidor.
- [x] Rodar `npm run check` e `npm run doctor`.

### Prioridades

- Primeiro contrato (`SPEC.md`).
- Depois uso (`docs/usage.md`).
- Depois fronteira (`docs/runtime-boundary.md`).

### Riscos

- Prometer runtime sem existir.
- Inflar o README com detalhe que deveria ficar em docs.
- Descrever memoria global como dump em vez de indice curto.

### Definicao De Pronto

- Os docs explicam L1/L2/L3 sem contradizer a V1.
- O pacote continua afirmando que nao grava memoria sozinho.
- Validacoes existentes continuam passando.

## Sprint 2 - Templates E Exemplo Sanitizado

### Sprint Goal

Dar aos projetos consumidores uma forma copiavel de implementar L1/L2/L3.

### Backlog

- [x] Criar `templates/l1-lembranca.md`.
- [x] Criar `templates/l2-memoria.md`.
- [x] Criar `templates/l3-conhecimento-index.md`.
- [x] Criar `templates/layered-memory-checklist.md`.
- [x] Criar exemplo sanitizado em `examples/layered-memory/`.
- [x] Atualizar `README.md` e `docs/usage.md` apontando para os novos templates.

### Prioridades

- Templates antes de exemplo.
- Checklist antes de declarar pronto.
- Exemplo sem path privado, token, log ou estado real.

### Riscos

- L1 virar tutorial.
- L2 duplicar L3.
- Exemplo parecer config real.

### Definicao De Pronto

- Um projeto novo consegue copiar os templates e criar uma memoria em camadas.
- O exemplo mostra gatilho -> ancora -> L3.
- Checklist cobre tamanho, link, `INDEX.md` e secrets.

## Sprint 3 - Validacao Documental

### Sprint Goal

Garantir que a arquitetura em camadas nao quebre por link morto, arquivo ausente
ou pacote publico incompleto.

### Backlog

- [x] Decidir se os novos templates entram no pacote npm.
- [x] Atualizar `package.json` se os arquivos forem empacotados.
- [x] Atualizar `scripts/validate-public.js` com novos arquivos obrigatorios.
- [x] Adicionar validacao simples de ancoras nos exemplos.
- [x] Rodar `npm run check`, `npm run doctor` e `npm run pack:check`.

### Prioridades

- Primeiro decidir superficie publica.
- Depois validar estrutura.
- Depois validar ancoras.

### Riscos

- Criar validador complexo demais para V1.
- Bloquear docs por regra rigida antes de haver uso real.

### Definicao De Pronto

- Validacao falha se arquivo obrigatorio sumir.
- Validacao detecta link de exemplo quebrado, se implementada neste sprint.
- Tarball nao inclui secrets nem estado privado.

## Sprint 4 - Integracao E Release

### Sprint Goal

Preparar a entrega publica depois que docs, templates, exemplos e validacao
estiverem consistentes.

### Backlog

- [x] Atualizar `CHANGELOG.md`.
- [x] Decidir versao (`0.1.3` ou outro corte).
- [x] Atualizar `VERSION` e `package.json`, se houver release.
- [x] Rodar validacoes completas.
- [x] Gerar resumo de release com fronteira de runtime explicita.

### Prioridades

- Release so depois de validacao.
- Nao publicar sem revisar tarball.

### Riscos

- Versao mudar antes do contrato estabilizar.
- Publicacao carregar arquivo local indevido.

### Definicao De Pronto

- `npm run check` passa.
- `npm run doctor` passa.
- `npm run pack:check` mostra apenas arquivos publicos esperados.
- Changelog descreve L1/L2/L3 sem prometer runtime.

## Estacionamento

- Migracao automatica de memorias existentes.
- Runtime de carregamento de L1/L2.
- Comando CLI `validate-layers`.
- Integracao direta com Dex Agent.
- Conversor de memoria plana para L1/L2/L3.

## Resultado Local

- Sprint 1 concluido: contrato e docs canonizam L1/L2/L3.
- Sprint 2 concluido: templates e exemplo sanitizado criados.
- Sprint 3 concluido: validacao publica cobre novos arquivos e ancoras do exemplo.
- Sprint 4 concluido localmente: changelog atualizado como `Unreleased`; versao
  mantida em `0.1.2` porque nao houve publicacao.

## Proximo Passo Recomendado

Preparar um corte de release separado, se o usuario quiser publicar. Antes
disso, revisar se a secao `Unreleased` deve virar `0.1.3`.

Decisoes aplicadas:

1. `lembranca.md`, `memoria.md` e `conhecimento/` sao nomes canonicos
   recomendados.
2. L2 e descrita como carregavel por dominio ativo.
