# Tasks - Implementacao L1/L2/L3

Data: `2026-05-15`
Status: `implementado localmente`
Projeto: `dex-memoria`

## Legenda

- `P0`: bloqueia seguranca ou contrato central.
- `P1`: necessario para a implementacao ficar coerente.
- `P2`: melhora validacao, manutencao ou exemplo.
- `P3`: evolucao futura.

## Tarefas Comprometidas

### T01 - Canonizar L1/L2/L3 no contrato

- Prioridade: `P1`
- Status: `feito`
- Arquivos provaveis: `SPEC.md`, `README.md`, `docs/usage.md`
- Objetivo: explicar `lembranca`, `memoria` e `conhecimento` como arquitetura de recuperacao governada.
- Criterio de aceite:
  - docs dizem que L1 e gatilho curto;
  - docs dizem que L2 e detalhe com ancoras;
  - docs dizem que L3 e conhecimento sob demanda;
  - fronteira com runtime continua explicita.

### T02 - Criar templates de camada

- Prioridade: `P1`
- Status: `feito`
- Arquivos provaveis:
  - `templates/l1-lembranca.md`
  - `templates/l2-memoria.md`
  - `templates/l3-conhecimento-index.md`
- Objetivo: dar forma copiavel para projetos consumidores.
- Criterio de aceite:
  - L1 tem limite e exemplos de gatilho;
  - L2 tem modelo com ancoras;
  - L3 tem `INDEX.md` com documentacao, tutoriais e modelos;
  - templates nao carregam estado real.

### T03 - Criar exemplo sanitizado completo

- Prioridade: `P1`
- Status: `feito`
- Arquivos provaveis:
  - `examples/layered-memory/lembranca.md`
  - `examples/layered-memory/memoria.md`
  - `examples/layered-memory/conhecimento/INDEX.md`
- Objetivo: demonstrar gatilho -> ancora -> detalhe sob demanda.
- Criterio de aceite:
  - exemplo mostra L1 acionando L2;
  - L2 aponta para L3;
  - nenhum segredo, path privado ou estado real aparece.

### T04 - Adicionar checklist de validacao L1/L2/L3

- Prioridade: `P1`
- Status: `feito`
- Arquivos provaveis:
  - `templates/layered-memory-checklist.md`
  - `docs/usage.md`
- Objetivo: permitir revisao manual antes de promover uma memoria.
- Criterio de aceite:
  - checklist verifica tamanho de L1;
  - checklist verifica links L1 -> L2;
  - checklist verifica `INDEX.md` em L3;
  - checklist verifica ausencia de secrets.

### T05 - Atualizar validacao publica

- Prioridade: `P2`
- Status: `feito`
- Arquivos provaveis: `scripts/validate-public.js`, `package.json`
- Objetivo: garantir que novos arquivos documentais entrem no pacote e nao quebrem distribuicao.
- Criterio de aceite:
  - `npm run check` passa;
  - `npm run doctor` passa;
  - `npm run pack:check` mostra os novos arquivos esperados, se eles forem parte do pacote publico.

### T06 - Validar integridade de ancoras

- Prioridade: `P2`
- Status: `feito`
- Arquivos provaveis: `scripts/validate-public.js` ou script dedicado futuro.
- Objetivo: detectar link L1 -> L2 quebrado antes de release.
- Criterio de aceite:
  - links `memoria.md#ancora` dos exemplos sao verificados;
  - erro claro se L1 apontar para ancora inexistente;
  - validacao nao depende de estado privado do usuario.

### T07 - Documentar exemplo de configuracao sem secrets

- Prioridade: `P1`
- Status: `feito`
- Arquivos provaveis: `docs/usage.md`, `docs/runtime-boundary.md`
- Objetivo: mostrar como um ambiente consumidor pode carregar L1/L2 sem copiar config real.
- Criterio de aceite:
  - exemplo usa paths ficticios ou relativos;
  - exemplo nao tem `api_key`, token ou segredo;
  - texto diz que carregamento automatico pertence ao ambiente consumidor.

### T08 - Atualizar changelog apenas quando o comportamento publico mudar

- Prioridade: `P2`
- Status: `feito`
- Arquivos provaveis: `CHANGELOG.md`, `VERSION`
- Objetivo: evitar registrar release antes da implementacao real.
- Criterio de aceite:
  - changelog so muda quando templates/docs forem implementados;
  - versao so muda em sprint de release.

## Fora Do Corte Atual

- criar runtime de memoria;
- migrar memorias DeepSeek;
- ler ou publicar configs privadas;
- gravar em memoria global automaticamente;
- publicar npm nesta rodada de planejamento.

## Resultado Local

- Contrato L1/L2/L3 implementado nos docs.
- Templates e exemplo sanitizado criados.
- Validacao publica atualizada.
- `CHANGELOG.md` recebeu secao `Unreleased`.
- Versao permaneceu `0.1.2` porque nao houve release neste turno.

## Perguntas Em Aberto

- O nome canonico dos arquivos deve ser obrigatoriamente `lembranca.md`,
  `memoria.md` e `conhecimento/`, ou o contrato deve permitir nomes locais?
- L2 deve ser sempre carregada com L1 ou pode ser carregada por dominio?
- O validador de ancoras entra ja no primeiro sprint de implementacao ou fica
  no segundo sprint?

## Recomendacao Atual

Assumir como padrao:

```text
L1 = sempre carregavel
L2 = carregavel por dominio ativo
L3 = sob demanda
```

e permitir que projetos consumidores ajustem carregamento conforme custo de
contexto e runtime disponivel.
