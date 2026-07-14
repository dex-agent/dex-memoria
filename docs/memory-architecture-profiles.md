# Memory Architecture Profiles

Status: `approved_not_active`
Date: `2026-07-13`

```text
Active-Write-Profile: legacy-v1
Target-Architecture: governed-theme-v2
Target-Status: approved_not_active
Runtime-Support: fixture_only_experimental
```

Este documento explica a decisao V2 aprovada. Existe um tracer transacional
fixture-only experimental, documentado em
[`cli-create-theme-v2-transaction-v0.md`](cli-create-theme-v2-transaction-v0.md),
mas ele nao implementa runtime vivo nem ativa a V2. Enquanto o recibo de
cutover nao trocar o perfil ativo, writers, readers instalados, Finder,
validators, templates e exemplos vivos continuam em `legacy-v1`. O
`routes inspect` fixture-only e somente um consumidor experimental da bancada,
nao uma mudanca nessas superficies vivas.

## Perfis

| Perfil | Estado | Rota | Uso atual |
| --- | --- | --- | --- |
| `legacy-v1` | `active_write_profile` | `L1 -> L2 -> L3` | unico perfil que pode operar hoje |
| `governed-theme-v2` | `approved_not_active` | `L1 -> L2` OU `L1 -> L3` | tracer fixture-only; sem suporte live |

## Topologia alvo

```text
<tema>/
├── lembranca.md
├── memorias/
│   ├── INDEX.md
│   └── <slug>.md
└── conhecimento/
    ├── INDEX.md
    └── <slug>/
        ├── README.md
        ├── referencias/
        └── artefatos/
```

Rotas alvo:

```text
lembranca.md -> memorias/<slug>.md
lembranca.md -> conhecimento/<slug>/README.md
```

L1 e a camada quente de lembranca e roteamento. Cada gatilho aponta para
exatamente um destino ativo. L2 guarda memoria leve, descritiva ou operacional.
L3 guarda conhecimento profundo que exige referencias, modelos, exemplos
extensos, documentos ou artefatos. Conhecimento L3 nao cria L2 artificial para
servir de passagem.

## Classificacao L2 versus L3

| Sinal | L2 | L3 | Observacao |
| --- | --- | --- | --- |
| descricao curta ou instrucao operacional autocontida | recomendado | insuficiente | exemplos pequenos podem permanecer L2 |
| referencia, modelo ou exemplo pequeno isolado | possivel | insuficiente sozinho | revisar densidade total |
| varias referencias verificaveis | insuficiente | recomendado | conhecimento precisa preservar fontes |
| modelos, documentos ou artefatos proprios | insuficiente | necessario | exige pacote L3 |
| idade alta ou muitos reusos | nao decide | nao decide | densidade, nao amadurecimento |
| empate ou conteudo misto | revisao humana | revisao humana | nao duplicar em L2 e L3 |

No alvo V2, um L3 ativo exige `owner_skill`. Se o owner ainda nao existir, o
conteudo fica como candidato ou recebe waiver humano rastreavel; nao ganha rota
ativa por omissao.

## Nomes, escopo e identidade

- O layout V2 aprovado nesta rodada cobre somente `<tema>`.
- Dentro de `<tema>`, paths V2 sao literais e em lowercase: `lembranca.md`, `memorias/`,
  `conhecimento/`, `referencias/` e `artefatos/`.
- Escopos global/governado e seu casing permanecem em `legacy-v1` ate decisao
  e cutover proprios. A V2 de tema nao supersede silenciosamente essa regra.
- `lembrancas/`, `memoria.md`, `conhecimentos/` e variantes de casing nao sao
  novos destinos V2. `memoria.md` permanece nome de compatibilidade V1.
- No Windows, comparacao de slug considera casefold. O mesmo slug nao pode
  ficar ativo simultaneamente em `memorias/` e `conhecimento/` no mesmo tema.
- Slug nao e identidade. A identidade futura deve ser estavel e sobreviver a
  rename, movimento e reclassificacao.
- A gramatica executavel de slug e nomes reservados pertence ao futuro Trilho
  de schema/fixture; este documento nao a implementa.

## Metadados propostos

| Campo | Semantica |
| --- | --- |
| identidade estavel | nao muda com slug, rename, movimento ou L2 -> L3 |
| `created_at` | criacao do conteudo identificado |
| `updated_at` | ultima alteracao semantica do conteudo |
| `last_reused_at` | ultimo reuso comprovado e aceito |
| `reuse_count` | quantidade de eventos de reuso comprovados e idempotentes |

Leitura automatica, Finder, `rg`, Graphify, indexacao, validacao, prefetch e
retry da mesma chave nao contam como reuso por padrao. Reuso exige evidencia de
que o conteudo influenciou uma decisao, execucao ou saida, com chave idempotente.
`updated_at` nao prova que o conteudo continua correto; politica futura de
obsolescencia deve separar revisao/validade de alteracao de conteudo.

A fonte canônica futura de `reuse_count` e `last_reused_at` sera um registro
append-only de eventos de reuso aceitos, sob owner `dex-memoria`. O path, o
formato e a politica de retencao ainda nao foram decididos e pertencem ao
Trilho fixture/schema. Nenhum ledger foi criado neste corte.

## Fontes canonicas

| Responsabilidade | Fonte canonica | Derivacao |
| --- | --- | --- |
| principios humanos | `PRINCIPLES.md` global | fonte normativa humana |
| gates operacionais vigentes | `operational-contract.json` global | derivado dos principios; V1 continua ativo |
| decisao e contrato publico do dominio | `DECISIONS.md` e `SPEC.md` deste repo | explicam sem ativar |
| conteudo humano futuro | Markdown L1/L2/L3 | fonte do conteudo |
| `INDEX.md` futuro | projecao regeneravel | derivado do conteudo ativo |

## Tres papeis JSON diferentes

| Artefato | Finalidade | Fonte/owner | Derivacao e divergencia | Estado |
| --- | --- | --- | --- | --- |
| `operational-contract.json` global | operacionalizar principios vigentes | derivado de `PRINCIPLES.md`; owner da governanca PPIRTV | bloco `memory_architecture_profiles` e somente `metadata_documental`; revisao/data sao observaveis, mas o efeito comportamental e `none` e os campos operacionais continuam V1 | existente |
| futuro contrato estrutural `governed-theme-v2` | regras versionadas de paths, slugs, links e invariantes | futura especificacao aprovada; owner `dex-memoria` | ID e path ainda nao decididos; mudanca exigira revisao e compatibilidade | nao criado |
| `lembranca.json` | recuperacao deterministica das rotas vivas | `lembranca.md`, fontes de conteudo e eventos de reuso aceitos; owner do gerador futuro `dex-memoria` | Markdown/eventos -> JSON; regeneracao deve ser byte a byte e edicao manual gera divergencia explicita | nao criado |

O contrato global atual nao e o contrato estrutural V2. O futuro contrato
estrutural nao e copia do conteudo. `lembranca.json` nao e fonte humana e deve
ser descartavel, regeneravel e comparavel de forma deterministica. Os dois
artefatos V2 futuros nao foram criados neste corte.

## Owners

| Superficie | Owner |
| --- | --- |
| protocolo e futuro core de mutacao | `dex-memoria` |
| intencao/consumo PPIRTV | `dex-PPIRTV` |
| qualidade e governanca da memoria | `consciencia-memorias` |
| `<tema>/lembranca.md` | owner de conteudo do tema; mutacao pelo futuro core `dex-memoria` |
| `<tema>/memorias/<slug>.md` | owner de conteudo do tema; mutacao pelo futuro core `dex-memoria` |
| `<tema>/conhecimento/<slug>/README.md` | `owner_skill` do dominio; sem skill permanece candidato |
| `referencias/` e `artefatos/` | mesmo `owner_skill` do conhecimento; integridade por validator futuro |
| `INDEX.md` | projecao do gerador futuro `dex-memoria`, nunca segunda fonte manual |
| identidade e eventos de reuso | futuro core `dex-memoria` |
| Trilho e ordem de execucao | `sprinter` |

## Consumidores ainda V1

Os seguintes grupos permanecem deliberadamente V1 e exigem Trilho futuro antes
do cutover:

| Grupo | Dependencia V1 atual | Acao futura |
| --- | --- | --- |
| writer/mineracao PPIRTV | destinos L1+L2 e L3 encadeado | destino tipado L2 OU L3 |
| Finder/CLI | Finder instalado reconhece `memoria.md`; CLI possui somente `routes inspect` em fixture V2 | reconhecer arquivos em `memorias/` e pacote L3 no consumidor real |
| validadores | exigem L2 antes de L3 | validar exclusividade e backlinks por perfil |
| skills instaladas | instruem cadeia V1 | atualizar somente apos suporte fixture comprovado |
| tools e policies do vault | paths V1 literais | compatibilidade e no-shrink |
| templates e exemplos deste pacote | representam V1 | manter rotulo V1 ate templates V2 aprovados |

Esta cobertura e limitada as raizes declaradas no Trilho documental; nao afirma
conhecer consumidores externos ou paths dinamicos fora delas.

## Gate de ativacao

`governed-theme-v2` so pode se tornar perfil ativo depois de um Trilho separado
provar, em fixture e sem tocar o vault vivo:

1. writer, readers e validators compativeis;
2. contrato estrutural e paths congelados;
3. shadow/no-shrink e comparacao de cobertura;
4. idempotencia, conflito e recovery/rollback;
5. plano de migracao e bridges V1;
6. recibo humano explicito de cutover.

Sem esse recibo, `approved_not_active` significa somente desenho aprovado.

## Estacionamento com quando

- Rótulo dentro de cada template/exemplo: reconsiderar no Trilho de templates
  V2, antes de qualquer template V2 ser publicado. Até lá, READMEs de diretório
  e docs públicas classificam os corpos atuais como `legacy-v1`, e o SKILL V1
  continua apontando para eles como superfícies vigentes.
- Tornar os três novos documentos obrigatórios no `validate-public.js`: tratar
  no próximo corte de empacotamento público, antes de release, pois exige
  alteração de validator/código proibida neste GOAL documental.
