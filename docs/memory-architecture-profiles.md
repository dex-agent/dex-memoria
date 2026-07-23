# Memory Architecture Profiles

Status: `active_v2`
Date: `2026-07-19`

```text
Product: Dex Memoria V2
Implementation-Version: v2
Scope: project | global | theme
Active-Write-Profile: v2
```

Este documento explica a transicao para Dex Memoria V2. Implementation, scope e
root sao independentes:

```text
project/local -> <WORKSPACE>/.agents
global -> <DEX_MEMORIA_HOME>/global
theme -> <DEX_MEMORIA_HOME>/temas/<tema>
dual-scope -> dois destinos e dois recibos
```

Selecionar o root nao define nem congela o layout interno. O V1 historico
continua read-only, restauravel e recuperavel junto do V2 novo, sem o usuario
precisar informar profile. Existe um tracer transacional historico, documentado em
[`cli-create-theme-v2-transaction-v0.md`](cli-create-theme-v2-transaction-v0.md),
mas `governed-theme-v2` e somente identificador historico de fixture: nao e o
produto, umbrella ou perfil ativo. O SPT 04 trocou o selector live para V2;
`legacy-v1` permanece somente reader/restore. O
`routes inspect` fixture-only e somente um consumidor experimental da bancada,
nao uma mudanca nessas superficies vivas.

## Estados de implementacao

| Identidade | Estado | Rota | Uso atual |
| --- | --- | --- | --- |
| `legacy-v1` | `read_restore_only` | `L1 -> L2 -> L3` | corpus historico recuperavel, nunca fallback writer |
| Dex Memoria V2 | `active_write_profile` | `L1 -> L2` OU `L1 -> L3` | writer/selector unico para todos os escopos |
| `governed-theme-v2` | `historical_only` | prova do roteamento V2 | fixture historica; nunca identidade do produto |

## Topologia alvo

```text
<resolved_root>/
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

- A selecao de escopo/root cobre `project`, `global` e `theme`; o layout
  estrutural live foi congelado nos SPTs 02/03.
- Dentro de cada `<resolved_root>`, paths V2 usam `memorias/`, `conhecimento/`,
  `referencias/` e `artefatos/` em lowercase. Para L1, o arquivo historico
  case-insensitive existente vence; em root novo, projeto usa `lembranca.md` e
  global/tema usam `LEMBRANCA.md`.
  No escopo `theme`, o root resolvido ja inclui `temas/<tema>`; `project` e
  `global` nao inventam uma camada de tema.
- O mesmo contrato V2 deve operar em todos os escopos sem criar perfis por
  escopo.
- `lembrancas/`, `memoria.md`, `conhecimentos/` e variantes de casing nao sao
  novos destinos V2. `memoria.md` permanece nome de compatibilidade V1.
- No Windows, comparacao de slug considera casefold. O mesmo slug nao pode
  ficar ativo simultaneamente em `memorias/` e `conhecimento/` no mesmo
  `resolved_root`.
- Slug nao e identidade. A identidade V2 e estavel e sobrevive a
  rename, movimento e reclassificacao.
- A gramatica executavel de slug e nomes reservados pertence aos schemas e ao
  core V2; este documento apenas a referencia.

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
| gates operacionais vigentes | `operational-contract.json` global | derivado dos principios; selector V2 ativo |
| decisao e contrato publico do dominio | `DECISIONS.md` e `SPEC.md` deste repo | explicam sem ativar |
| conteudo humano futuro | Markdown L1/L2/L3 | fonte do conteudo |
| `INDEX.md` futuro | projecao regeneravel | derivado do conteudo ativo |

## Tres papeis JSON diferentes

| Artefato | Finalidade | Fonte/owner | Derivacao e divergencia | Estado |
| --- | --- | --- | --- | --- |
| `operational-contract.json` global | operacionalizar principios vigentes | derivado de `PRINCIPLES.md`; owner da governanca PPIRTV | bloco `memory_architecture_profiles` declara V2 ativo e V1 reader/restore; nao executa escrita por si so | existente |
| contratos `governed-theme-v2` existentes | prova versionada de paths, slugs, links e invariantes | prototipo historico theme-fixture; owner `dex-memoria` | nao e contrato live multi-scope | existente, `historical_only` |
| contrato estrutural live multi-scope | paths internos e receipts da implementacao V2 | SPT 02/03; owner `dex-memoria` | preserva roots e recall V1 | ativo |
| `lembranca.json` | recuperacao deterministica das rotas vivas | `lembranca.md`, fontes de conteudo e eventos de reuso aceitos; owner do gerador futuro `dex-memoria` | Markdown/eventos -> JSON; regeneracao deve ser byte a byte e edicao manual gera divergencia explicita | nao criado |

O contrato global de principios nao substitui o contrato estrutural V2.
`lembranca.json` nao e fonte humana e, se criado futuramente, deve ser
descartavel, regeneravel e comparavel de forma deterministica.

## Owners

| Superficie | Owner |
| --- | --- |
| protocolo e core de mutacao | `dex-memoria` |
| intencao/consumo PPIRTV | `dex-PPIRTV` |
| qualidade e governanca da memoria | `consciencia-memorias` |
| `<resolved_root>/lembranca.md` ou casing historico preservado | owner do escopo; mutacao pelo core `dex-memoria` |
| `<resolved_root>/memorias/<slug>.md` | owner do escopo; mutacao pelo core `dex-memoria` |
| `<resolved_root>/conhecimento/<slug>/README.md` | `owner_skill` do dominio; sem skill permanece candidato |
| `referencias/` e `artefatos/` | mesmo `owner_skill` do conhecimento; integridade por validator futuro |
| `INDEX.md` | projecao do gerador futuro `dex-memoria`, nunca segunda fonte manual |
| identidade e eventos de reuso | core `dex-memoria`; projecao JSON futura continua opcional |
| Trilho e ordem de execucao | `sprinter` |

## Consumidores reconciliados

Os seguintes grupos leem V1 historico e V2 novo; somente V2 escreve:

| Grupo | Compatibilidade V1 | Estado V2 |
| --- | --- | --- |
| writer/mineracao PPIRTV | recall V1 preservado | destino tipado L2 OU L3 e recibo por root |
| Finder/CLI | reconhece `memoria.md` | reconhece `memorias/` e pacote L3 automaticamente |
| validadores | validam corpus V1 | validam unidade V2 Markdown/Obsidian |
| skills instaladas | explicam recall V1 | redirecionam para a skill canonica V2 |
| tools e policies do vault | paths V1 continuam legiveis | compatibilidade e no-shrink comprovados |
| templates e exemplos deste pacote | representam V1 | manter rotulo V1 ate templates V2 aprovados |

Esta cobertura e limitada as raizes declaradas no Trilho documental; nao afirma
conhecer consumidores externos ou paths dinamicos fora delas.

## Gate de ativacao concluido

Dex Memoria V2 foi ativado pelo SPT 04 depois de os SPTs 02/03 provarem:

1. writer, readers e validators compativeis;
2. contrato estrutural e paths congelados;
3. no-shrink e recall misto V1 historico + V2 novo;
4. idempotencia, conflito e recovery/rollback;
5. plano de migracao e bridges V1;
6. transacao de selector com journal e rollback em falha real.

## Estacionamento com quando

- Rótulo dentro de cada template/exemplo: reconsiderar no Trilho de templates
  V2, antes de qualquer template V2 ser publicado. Até lá, corpos antigos
  continuam rotulados `legacy-v1` apenas como exemplos históricos; a SKILL V2
  ativa aponta para eles somente quando compatibilidade V1 for necessária.
- Tornar os três novos documentos obrigatórios no `validate-public.js`: tratar
  no próximo corte de empacotamento público, antes de release, pois exige
  alteração de validator/código proibida neste GOAL documental.
