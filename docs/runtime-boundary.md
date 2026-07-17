# Runtime Boundary

> `legacy-v1` continua sendo o unico perfil de escrita ativo.
> `governed-theme-v2` esta `approved_not_active` e possui suporte runtime
> `fixture_only_experimental`: existe apenas uma bancada descartavel, sem
> runtime V2 vivo. A decisao alvo nao amplia esta fronteira. Veja
> [Memory Architecture Profiles](memory-architecture-profiles.md) e
> [CLI create V2 transacional em fixture](cli-create-theme-v2-transaction-v0.md),
> com o [leitor-validador V2 fixture-only](cli-routes-inspect-v2-v0.md).

`dex-memoria` preserva o contrato documental V1. O runtime de memoria real
continua no Dex Agent ate decisao posterior; as excecoes locais sao as bancadas
fixture-only V0 e V2 experimental descritas abaixo.

## Fica No Dex Agent

- comandos `/inbox` e `/memory`;
- captura de candidates;
- proposal-first writes;
- ledger `.agents/MEMORY.ndjson`;
- inbox `.agents/INBOX/`;
- recall automatico;
- manutencao de superficies;
- integracao Telegram;
- codigo em `src/orchestrator/*`, `src/bot/*` e `src/index.ts`.

## Fica Neste Repo

- contrato de ciclo de vida;
- contrato de recuperacao em camadas `L1 lembranca`, `L2 memoria` e
  `L3 conhecimento`;
- templates;
- exemplos sanitizados;
- criterios de criacao, resolucao, arquivamento e supersedencia;
- documentacao de fronteira.

## Excecao V0 Fixture-Only

Este repo tambem possui `create plan|apply|recover` para caracterizacao e
equivalencia L1+L2 `legacy-v1` em fixture temporaria. Essa fronteira:

- exige marker `dex.memory.disposable-run.v1` e manifest
  `dex.memory.fixture.legacy-create-l1-l2.v1` fechados;
- deriva os dois targets allowlisted do controle da fixture;
- usa JSON por stream, plan deterministico e journal recuperavel;
- nao aceita o vault vivo, workspace de consumidor, L3 ou layout V2;
- nao substitui writer, ledger, recall, bot, hook ou integracao de producao.

O contrato canônico de comandos, schemas e riscos fica em
[`cli-create-fixture-v0.md`](cli-create-fixture-v0.md).

## Excecao V2 Fixture-Only Experimental

O tracer descrito em
[`cli-create-theme-v2-transaction-v0.md`](cli-create-theme-v2-transaction-v0.md)
prova `create` com `L1 -> L2 OU L1 -> L3` somente em fixture transacional
marcada. Ele não aceita o vault vivo, não ativa o V2 e não autoriza cutover,
migração, readers ou validators de produção.

O comando `routes inspect`, documentado em
[`cli-routes-inspect-v2-v0.md`](cli-routes-inspect-v2-v0.md), reconstrói e
triangula L1, INDEX e destino somente nessa fixture. Shadow e no-shrink dessa
bancada não provam Finder instalado, validator live ou consumidores externos.

## Regra De Uso

Quando a pergunta for sobre como operar uma memoria, use este repo.

Quando a pergunta for sobre como o bot grava, recupera, mostra ou injeta memoria em prompts, consulte o runtime do Dex Agent.

## Carregamento De L1/L2/L3

`dex-memoria` recomenda os nomes canonicos `lembranca.md`, `memoria.md` e
`conhecimento/`, mas nao carrega esses arquivos do vault vivo. A unica leitura
V2 executavel deste repo e `routes inspect` sobre fixture marcada.

Responsabilidade deste repo:

- definir o formato das camadas;
- explicar quando usar cada camada;
- fornecer templates e exemplos sanitizados;
- validar a documentacao publica quando houver script para isso.

Responsabilidade do ambiente consumidor:

- decidir quais arquivos entram em `instructions`, system prompt, recall ou
  contexto;
- carregar L1 sempre ou por dominio ativo;
- carregar L2 por dominio ativo;
- abrir L3 apenas sob demanda;
- escolher caminhos globais, por tema ou por projeto sem transformar o global em
  dump;
- impedir que configs reais, tokens, logs ou estado privado virem exemplo
  publico.

Regra de escopo:

- global roteia;
- tema reutiliza;
- projeto opera.

Se o conhecimento so vale para um repo, fica no repo. Se vale para uma familia
tecnica, fica em tema. Se vale para qualquer contexto, pode virar ponteiro
global curto.

## Raiz De Memoria

`DEX_MEMORIA_HOME` e a raiz canonica para memoria cross-project:

```text
<DEX_MEMORIA_HOME>/global
<DEX_MEMORIA_HOME>/temas/<tema>
```

Resolucao padrao:

1. usar `$env:DEX_MEMORIA_HOME`, quando existir;
2. caso contrario, usar `$HOME/.agents/memories`.

Memoria de projeto nao usa `DEX_MEMORIA_HOME`. Ela fica no workspace:

```text
<WORKSPACE>/.agents
```

`DEX_AGENT_HOME` localiza runtime e estado operacional do Dex Agent; ele nao
localiza nem substitui a fonte canonica da skill `dex-memoria`. Ele nao deve
virar raiz de memoria cross-project automaticamente. Se um
ambiente quiser guardar memoria dentro de `DEX_AGENT_HOME`, deve configurar
`DEX_MEMORIA_HOME` explicitamente.

`%CODEX_HOME%/memories` ou `$HOME/.codex/memories` pertencem ao host Codex.
Eles podem existir, mas nao sao destino padrao do `dex-memoria`.

O ambiente consumidor deve bloquear:

- escrita de memoria global em `<WORKSPACE>/global`;
- escrita de memoria de tema em `<WORKSPACE>/temas`;
- escrita de memoria viva em `templates/`, `examples/`, logs, screenshots ou
  pastas de secrets.

## Memorias Do Host Codex

Este pacote nao deve incentivar escrita direta de conteudo grande em memorias
globais do host, como `%CODEX_HOME%\memories` ou `${CODEX_HOME}/memories`.

Quando houver memoria reutilizavel entre conversas, repos ou contextos, o
contrato `memorizador` do `dex-memoria` deve usar memoria global como indice
gravavel de ponteiros curtos:
gatilho, fonte viva a abrir, o que procurar la, quem vence em conflito, quando
nao usar e criterio para remover ou revisar o ponteiro.

Memoria global nao e somente leitura. A sessao deve gravar diretamente o
ponteiro global conciso quando houver valor de lembranca/indexacao e houver
mecanismo autorizado de escrita. `dex-memoria` apenas organiza o registro para
que fique curto, intuitivo, rastreavel e reversivel.

O conteudo grande fica no repo, skill, `HANDOFF`, `ACTIVE`, artefato ou ledger
local. Se houver conflito, vence a fonte viva do projeto; para proximo passo
operacional, `HANDOFF.md` vence `MEMORY.ndjson`.

Se o host Codex bloquear escrita por permissao, declare o bloqueio como restricao
do ambiente ou da ferramenta ativa, nao como veto de `dex-memoria`, e produza um
candidato de memoria, contrato ou patch para a camada correta. Se o host ou outro
runtime autorizado permitir escrita, grave o ponteiro global conciso.
