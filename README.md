# Dex Memoria

Versao atual: `0.1.6`

> Arquitetura alvo: `governed-theme-v2`, status `approved_not_active`.
> O unico perfil de escrita ativo continua sendo `legacy-v1`. O suporte V2 e
> `fixture_only_experimental`: existe apenas uma bancada transacional descartavel,
> sem runtime vivo, migracao ou cutover. Veja
> [Memory Architecture Profiles](docs/memory-architecture-profiles.md) e a
> [CLI create V2 transacional em fixture](docs/cli-create-theme-v2-transaction-v0.md),
> acompanhada pelo [leitor-validador V2 fixture-only](docs/cli-routes-inspect-v2-v0.md)
> e pelo [mapa consolidado V2 fixture-only](docs/v2-fixture-consolidation-map.md).

`dex-memoria` preserva a V1 documental do ciclo de vida de memoria operacional
e oferece CLIs fixture-only para caracterizar `legacy-v1` e experimentar o
roteamento V2 `L1 -> L2 OU L1 -> L3`, sempre em fixtures descartaveis marcadas.

Ele nasceu a partir da skill `skills/dex-memoria` do repo `dex-agent`, mas nao
carrega o runtime do bot, nao executa hooks e nao e um writer geral. As excecoes
executaveis deste corte sao as bancadas fixture-only V0 e V2 experimental,
descritas em [`docs/cli-create-fixture-v0.md`](docs/cli-create-fixture-v0.md) e
[`docs/cli-create-theme-v2-transaction-v0.md`](docs/cli-create-theme-v2-transaction-v0.md);
o leitor-validador read-only fica em
[`docs/cli-routes-inspect-v2-v0.md`](docs/cli-routes-inspect-v2-v0.md). Todas
essas superficies bloqueiam o vault vivo. Esse limite nao transforma memorias em somente
leitura; ele apenas separa contrato documental, bancada fixture-only e mecanismo
autorizado de escrita real.

Dentro deste pacote, `memorizador` e o contrato de memorizacao: o formato que
define como, quando, quanto, por que, por quanto tempo e quando nao lembrar.
Memoria global nao e somente leitura. Quando uma lembranca tiver valor
cross-project, o mecanismo de escrita disponivel deve gravar um ponteiro curto,
intuitivo e indexavel em `MEMORY.md`, apontando para a fonte viva completa. O
registro global nao deve virar tutorial, copia de contrato, historico grande ou
dump de contexto.

O pacote tambem preserva a arquitetura operacional `legacy-v1` em tres camadas:

```text
L1 lembranca -> L2 memoria -> L3 conhecimento
```

- `L1 lembranca`: gatilhos curtos, sempre carregaveis ou carregaveis pelo
  dominio ativo, apontando para L2.
- `L2 memoria`: conhecimento operacional detalhado, com ancoras estaveis.
- `L3 conhecimento`: documentacao, tutoriais, modelos e exemplos sob demanda.

Essa arquitetura nao cria runtime. Ela documenta como um ambiente consumidor
pode recuperar conhecimento sem transformar memoria global em dump.

Escopo recomendado:

- `global`: L1 minimo como roteador de gatilhos universais;
- `projeto`: memoria viva e retomada operacional do repo atual;
- `area` ou `tema`: conhecimento reutilizavel por dominio.

Raiz canonica para memoria cross-project:

```text
DEX_MEMORIA_HOME = $env:DEX_MEMORIA_HOME, se definido
fallback = $HOME/.agents/memories
```

Assim:

- `global` grava em `<DEX_MEMORIA_HOME>/global`;
- `tema` grava em `<DEX_MEMORIA_HOME>/temas/<tema>`;
- `projeto` grava no proprio repo, em `<WORKSPACE>/.agents`.

Nunca crie `global/` ou `temas/` dentro do workspace para memoria global ou de
tema. `%CODEX_HOME%/.codex/memories` e memoria do host Codex; nao e raiz
padrao do `dex-memoria`, salvo configuracao explicita em `DEX_MEMORIA_HOME`.

Taxonomia de temas:

- tema e dominio reutilizavel, nao apelido de projeto nem combinacao
  projeto-ferramenta;
- prefira dominios raiz como `deepseek`, `delphi`, `php` ou `codex`;
- use `temas/<area>/<tema>` somente quando a area ja for uma familia real e
  repetida;
- se o conteudo mistura projeto e ferramenta, separe: estado do projeto em
  `<WORKSPACE>/.agents`, aprendizado da ferramenta em
  `<DEX_MEMORIA_HOME>/temas/<ferramenta>`.

Regra pratica: nada entra em L2 sem gatilho L1, nada entra em L3 sem ancora L2,
e nada entra no global se so serve para um projeto.

## O Que E

- Um contrato pratico para decidir quando uma memoria deve entrar, ficar viva, virar ledger, ser arquivada, ser supersedida ou ser descartada.
- Um conjunto de templates e exemplos sanitizados para criar e resolver memoria operacional.
- Uma fronteira documentada entre o pacote `dex-memoria` e o runtime atual do Dex Agent.

## O Que Nao E

- Nao e o runtime de memoria do Dex Agent.
- Nao substitui `/inbox`, `/memory`, recall, ledger ou proposals do bot.
- Nao contem `.agents/` reais, inbox, ledger, screenshots, logs, tokens ou secrets.
- Nao promete runtime V2 vivo, Finder instalado ou validacao do vault real;
  as capacidades V2 existentes permanecem fixture-only.
- Nao e writer automatico geral e nao aceita vault ou workspace vivo como
  destino dos comandos `create`.
- Instala o redirecionador global `dex-memoria` em `.agents/skills` quando o
  comando `install` for executado.

## CLI V0 fixture-only

O binario top-level preserva `doctor`, `memory-home`, `install` e `version` e
adiciona as seguintes superficies fixture-only:

```text
dex-memoria create plan    --fixture <fixture-root>
dex-memoria create apply   --fixture <fixture-root>
dex-memoria create recover --fixture <fixture-root>
dex-memoria routes inspect --fixture <fixture-root>
```

Os comandos novos usam um JSON UTF-8 por stream, marker/manifest fechados,
targets allowlisted e journal recuperavel. Consulte a
[referencia canonica da CLI V0](docs/cli-create-fixture-v0.md) e os JSON Schemas
Draft 2020-12 em `contracts/schemas/`. Esta fronteira nao anuncia release nova,
nao integra consumidor em producao e nao remove writers existentes.

Para diagnosticar os limites Node sem ativa-los, use o
[probe SHADOW fixture-only](docs/resource-limits-shadow-fixture-v1.md). Ele
mantem o processo operacional como autoridade e grava a comparacao em recibo
separado somente quando `--bundle` e `--receipt` forem informados juntos.

O mapa unico de writers, readers, validators, consumidores externos, comandos,
backup e rollback esta em
[`docs/v2-fixture-consolidation-map.md`](docs/v2-fixture-consolidation-map.md).
O SHADOW com corpus sintetico e consumidores externos terminou `PASS`, portanto
o veredito local atual e `shadow-ready`. Isso nao autoriza cutover, instalacao
global, migracao, remocao de fallbacks nem escrita V2 no vault vivo.
O marco anterior da consolidacao isolada permanece registrado como
`fixture-ready`.

## Estrutura

- `SKILL.md`: entrada operacional da skill.
- `SPEC.md`: contrato atual do ciclo de vida.
- `docs/usage.md`: instalacao, ativacao e prompts prontos.
- `docs/runtime-boundary.md`: o que ainda pertence ao Dex Agent.
- `docs/cli-create-fixture-v0.md`: comandos, streams, schemas, fixture, journal,
  failpoints, exit codes e riscos da excecao executavel V0.
- `docs/cli-routes-inspect-v2-v0.md`: leitura e triangulacao V2 fixture-only,
  shadow independente e prova no-shrink.
- `docs/resource-limits-shadow-fixture-v1.md`: comparacao fora de banda dos
  limites Node atuais contra o bundle SHADOW, com help e recuperacao.
- `docs/v2-fixture-consolidation-map.md`: mapa portavel de produto,
  consumidores, comandos, SHADOW, backup, rollback e gates para cutover.
- `docs/memory-home.md`: raiz canonica `DEX_MEMORIA_HOME` e bloqueios de
  caminho.
- `docs/integration-dex-agent.md`: como integrar este pacote ao Dex Agent.
- `registry/agents-skills/dex-memoria/SKILL.md`: fonte versionada do
  redirecionador global instalado em `.agents/skills`.
- `templates/`: modelos copiaveis para contrato, resolucao e uso por projeto filho.
- `examples/`: exemplos sanitizados.
- `templates/l1-lembranca.md`, `templates/l2-memoria.md` e
  `templates/l3-conhecimento-index.md`: modelos de recuperacao em camadas.
- `examples/layered-memory/`: exemplo sanitizado de L1 acionando L2 e L3.
- `docs/layered-memory-simulations.md`: simulacoes sanitizadas para validar se
  a arquitetura recupera aprendizado de fato.
- `skills/dex-memoria-v2-pilot/`: piloto manual fixture-only mantido somente
  no repositorio; nao e instalado e nao entra no pacote npm atual.

## Instalacao Rapida

Via npm/npx a partir do GitHub:

```bash
npx github:dex-agent/dex-memoria doctor
npx github:dex-agent/dex-memoria memory-home
npx github:dex-agent/dex-memoria install
```

`install` copia somente o redirecionador global para
`~/.agents/skills/dex-memoria/SKILL.md`. Esse arquivo aponta diretamente para a
fonte completa e unica em `C:\CodexProjetos\dex-memoria\SKILL.md`. O comando nao
instala uma segunda skill completa e nao aceita `--target`.

Para instalar o redirecionador em outro registry de skills:

```powershell
npx github:dex-agent/dex-memoria install --registry-target "$env:USERPROFILE\.agents\skills\dex-memoria" --force
```

Depois de publicar no npm registry, use `npx dex-memoria@latest ...`.

Em outra maquina, clone este repo:

```bash
git clone https://github.com/dex-agent/dex-memoria.git
cd dex-memoria
```

No Windows PowerShell:

```powershell
git clone https://github.com/dex-agent/dex-memoria.git
Set-Location dex-memoria
```

O pacote npm e um distribuidor dos arquivos documentais. Ele nao instala runtime
do bot, nao executa hooks, nao grava ledger e nao cria automacao do Dex Agent.
Instalar significa deixar o contrato disponivel para consulta, referencia ou
copia controlada em outro projeto.

## Usar Em Outro Projeto

Outro projeto consumidor deve referenciar a fonte completa e unica
`C:\CodexProjetos\dex-memoria\SKILL.md`, diretamente ou pelo redirecionador
global. Nao copie nem adapte `SKILL.md` como skill local autoritativa.

Templates e exemplos sanitizados podem ser copiados como artefatos de projeto,
sem transformar a copia em fonte do contrato. Nao copie `.agents/` reais,
inbox, ledger, logs, screenshots, secrets, caches ou runtime `src/`.

Para usar o modelo em camadas em outro projeto, crie ou adapte:

- `lembranca.md`: L1, gatilhos curtos;
- `memoria.md`: L2, ancoras e detalhe operacional;
- `conhecimento/INDEX.md`: L3, indice para docs, tutoriais e modelos.

Esses nomes sao canonicos recomendados. O carregamento automatico desses
arquivos pertence ao ambiente consumidor, nao a este pacote.

O caminho fisico deve ser escolhido pelo escopo do conhecimento:

- global: apenas ponteiros curtos e gatilhos cross-project;
- projeto: arquivos dentro do repo ou da superficie viva do projeto;
- area/tema: arquivos de dominio reutilizavel, separados do estado do projeto.

Prompt minimo para ativar em outro projeto:

```text
Use dex-memoria neste projeto.

Antes de salvar, lembrar, arquivar ou encaminhar qualquer captura operacional,
aplique o contrato de ciclo de vida de memoria de:
<caminho-ou-url-do-dex-memoria>

Nao trate este pacote como runtime.
Nao prometa hooks, comandos gerais ou automacao que nao existem nesta V1
documental e na excecao V0 fixture-only.
Quando houver memoria reutilizavel, grave apenas ponteiro curto para a fonte viva.
```

Prompt pronto para pedir instalacao por IA:

```text
Instale dex-memoria neste projeto.

Contexto:
- dex-memoria e um pacote documental/skill de contrato de memoria.
- Ele nao e runtime do Dex Agent, nao executa hooks e nao grava vault ou ledger
  vivo. As excecoes executaveis sao as CLIs fixture-only V0 e V2 experimental.
- Repo oficial: https://github.com/dex-agent/dex-memoria

Tarefa:
1. Confirme que a fonte canonica existe em C:\CodexProjetos\dex-memoria\SKILL.md.
2. Execute `dex-memoria install` para atualizar somente o redirecionador em
   ~/.agents/skills/dex-memoria/SKILL.md.
3. Configure este projeto consumidor para referenciar a fonte canonica; nao
   copie a skill completa para o workspace.
4. Nao selecione copias antigas de workspace ou .dex-agent como autoridade.
5. Nao copie .agents reais, inbox, ledger, logs, screenshots, secrets, caches, .env ou runtime src/.
6. Ao final, mostre:
   - caminho do redirecionador instalado;
   - caminho da fonte canonica referenciada;
   - como ativar dex-memoria em uma proxima conversa;
   - limites que continuam fora do pacote.

Criterio de pronto:
- O projeto aponta para a fonte canonica unica do contrato de memoria.
- Nenhum segredo ou estado real foi copiado.
- A IA nao prometeu automacoes que a V1 nao entrega.
```

## Guia Completo

Leia [docs/usage.md](docs/usage.md) para:

- clonar o repo;
- usar `dex-memoria` como pacote documental;
- referenciar a fonte canonica sem criar skill local autoritativa;
- ativar a skill com prompts prontos;
- entender o que ainda depende do Dex Agent.

## Origem

Fonte de extracao:

- skill local `skills/dex-memoria` do repo `dex-agent`;
- documentacao tecnica `docs/memory-system/README.md` do repo `dex-agent`, usada como referencia, nao como copia integral.

## Estado Atual

Este repo preserva a linha documental `0.1.6`, a arquitetura L1/L2/L3, a raiz
canonica `DEX_MEMORIA_HOME` e a taxonomia de temas reutilizaveis. O V0
executavel fica restrito a fixture descartavel; versionamento/release,
integracao de producao e remocao de fallback ou writer existente continuam
fora deste corte.

## Camada Publica

Este repositorio tambem inclui a camada publica minima para contribuicao e
distribuicao segura:

- `LICENSE`: licenca MIT.
- `SECURITY.md`: politica para vulnerabilidades e exposicao acidental.
- `CONTRIBUTING.md`: regras de contribuicao e validacao local.
- `CODE_OF_CONDUCT.md`: expectativas de convivencia.
- `.github/`: templates de issue, template de PR e CI.

Validacao local:

```bash
npm run check
npm run doctor
npm run pack:check
```

O CI executa as mesmas validacoes principais para garantir que a versao `0.1.6`,
os metadados do pacote e a relacao documental com `dex-agent` continuem
alinhados sem incluir segredos ou runtime.
