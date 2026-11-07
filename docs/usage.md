# Usage

> Dex Memoria V2 e o writer/selector ativo. `legacy-v1` permanece somente para
> leitura/restauracao do corpus historico; as bancadas anteriores sao evidencia
> historica, nao default, fallback ou autoridade live. Consulte
> [Memory Architecture Profiles](memory-architecture-profiles.md).

Este guia explica como instalar e usar Dex Memoria V2, preservar o corpus V1 e
consultar as bancadas historicas fixture-only.

`dex-memoria` nao e runtime do Dex Agent nem writer automatico. Ele nao executa
hooks nem cria inbox/ledger. O binario possui writer transacional V2 explicito
para roots publicas e preserva `create plan|apply|recover` e `routes inspect`
como superficies historicas de fixture.

O tracer V2 separado também oferece `create plan|apply|recover`, mas somente
para a fixture transacional marcada e descartável. `routes inspect` le e valida
as rotas dessa mesma bancada sem escrever. Nenhum deles ativa o V2.

O [probe SHADOW de limites fixture-only](resource-limits-shadow-fixture-v1.md)
executa a operacao vigente primeiro e, somente com `--bundle` e `--receipt`
explicitos, compara tres limites Node em outro processo. O bundle continua
`effective=false`; a comparacao nunca decide o resultado operacional.

Essa fronteira nao significa "memorias sao somente leitura" e nunca pode virar
veto contra escrita global. Memoria global e indice gravavel: quando houver valor
de lembranca/indexacao, grave um ponteiro curto, intuitivo e apontado para a
fonte completa pelo mecanismo de escrita disponivel.

Se o ambiente atual tiver uma camada autorizada para escrita de memoria, use este
contrato para classificar a captura e executar ou encaminhar o ponteiro para essa
camada. Se o ambiente bloquear uma pasta por permissao, diga que o bloqueio e do
ambiente/ferramenta ativa, nao veto de `dex-memoria`, e entregue um candidato de
memoria ou instrucao operacional para a camada correta.

Quando este guia falar em `memorizador`, leia como o contrato de memorizacao
dentro do `dex-memoria`: decidir como lembrar, quando lembrar, quanto lembrar,
por que lembrar, por quanto tempo lembrar, quando nao lembrar e se cabe ponteiro
global curto. Nao e a skill/pacote antigo arquivado.

## Instalacao

### Usar Pela Fonte Canonica

Instale um redirecionador novo somente pelo clone canonico. `doctor` e
`install` recusam copias, caches npx e clones alternativos:

```powershell
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js doctor
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js memory-home
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js install
```

Para atualizar um redirecionador limpo existente, use:

```powershell
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js install --force --dry-run
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js install --force
```

O tarball npm e artefato de transporte e auditoria; nao e fonte operacional
para `doctor` ou `install`.

Por padrao, o comando instala somente o redirecionador global em:

```text
~/.agents/skills/dex-memoria/SKILL.md
```

O redirecionador aponta diretamente para
`C:\CodexProjetos\dex-memoria\SKILL.md`. Nao ha precedencia de skill local,
instalacao de copia completa ou rota alternativa. Se a fonte canonica estiver
indisponivel, a operacao deve parar com bloqueio explicito. `--target` nao e uma
opcao valida.

O unico `--registry-target` valido e o registry global do `USERPROFILE` ativo:

```powershell
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js install --registry-target "$env:USERPROFILE\.agents\skills\dex-memoria" --force --dry-run
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js install --registry-target "$env:USERPROFILE\.agents\skills\dex-memoria" --force
```

Para ver antes de copiar:

```powershell
node C:\CodexProjetos\dex-memoria\bin\dex-memoria.js install --force --dry-run
```

O CLI inclui o writer V2 explicito e o instalador recuperavel do redirecionador
global. Ele nao cria hooks, captura em background, inbox, ledger, tokens ou
automacao do Dex Agent. A excecao V0 fixture-only nao altera essa fronteira.

### Usar A CLI V0 Fixture-Only

Prepare uma copia temporaria da fixture publica e use um JSON UTF-8 por stdin:

```text
dex-memoria create plan    --fixture <fixture-root>
dex-memoria create apply   --fixture <fixture-root>
dex-memoria create recover --fixture <fixture-root>
```

`create plan` recebe a intencao sem paths e devolve um plan deterministico;
`create apply` recebe esse plan e publica L1+L2 com journal; `create recover`
recebe a idempotency key e restaura o baseline de uma transacao nao terminal.
O plan embute o request fechado; apply recompõe o resultado owner-side. A
identidade e key + fingerprint: commit repetido devolve o receipt original,
enquanto `ROLLED_BACK` exige uma nova key.
Nunca passe um vault ou workspace vivo em `--fixture`.

Comandos, streams, limites, JSON Schemas, marker/manifest, checkpoints,
failpoints, exit codes e riscos estao em
[`cli-create-fixture-v0.md`](cli-create-fixture-v0.md).

### Clonar O Repo

```bash
git clone https://github.com/dex-agent/dex-memoria.git
cd dex-memoria
```

Use este modo quando quiser consultar o contrato, copiar templates ou apontar outro projeto para esta documentacao.

### Usar Como Pacote Documental

Leia nesta ordem:

1. `README.md`
2. `SPEC.md`
3. `docs/runtime-boundary.md`
4. `templates/memory-contract.md`
5. `templates/memory-resolution-checklist.md`

Use `examples/` como referencia de formato, nao como estado real.

### Usar L1/L2/L3

Use este modo quando o problema principal for recuperacao de conhecimento, nao
apenas registro de uma memoria viva.

Estrutura recomendada:

```text
lembranca.md
memoria.md
conhecimento/
  INDEX.md
  documentacao/
    INDEX.md
  modelos/
    INDEX.md
  tutoriais/
    INDEX.md
```

Camadas:

- `L1 lembranca`: gatilhos curtos. No `legacy-v1`, aponta para L2; no V2,
  aponta para exatamente um destino L2 ou L3 e evita conteudo longo.
- `L2 memoria`: detalhe operacional com ancoras. Deve explicar mecanismo,
  verificacao, prevencao e links para L3 quando necessario.
- `L3 conhecimento`: documentacao, tutoriais, modelos e exemplos sob demanda.

Fluxo:

```text
gatilho -> ancora -> detalhe
legacy-v1: captura -> classificacao -> L1 gatilho -> L2 ancora -> L3 sob demanda
V2: captura -> classificacao -> L1 gatilho -> L2 OU L3
```

Regra pratica:

- L1 e sempre carregavel ou carregavel pelo dominio ativo.
- L2 e carregavel por dominio ativo.
- L3 nao deve ser carregada automaticamente por padrao.
- Nada entra em L2 sem gatilho L1 ou fonte viva equivalente.
- No `legacy-v1`, nada entra em L3 sem ancora L2.
- No V2, L3 direto exige `owner_skill`, backlinks L1 <-> L3 e nao cria L2
  artificial.

Use `L3 robusto` quando o aprendizado for reutilizavel, recorrente, tecnico ou
derivado de Graphify, Bibliotecario, pesquisa, diagnostico, bug real ou decisao
repetivel.

Checklist minimo:

- No `legacy-v1`, L1 aponta para L2 e L2 aponta para L3.
- No V2, L1 aponta para exatamente um destino; L3 direto exige `owner_skill`.
- L2, quando for a rota escolhida, tem contexto operacional, quando usar,
  quando nao usar e fonte viva.
- L3 tem objetivo, escopo, exemplos, anti-exemplos, modelo operacional,
  comandos ou scripts de validacao, referencias e riscos de obsolescencia.
- Fontes separam `confirmado`, `inferido` e `lacuna`.
- Existe `rg de achabilidade` cobrindo gatilho, alias humano e termo tecnico.
- Escopo esta explicito: `projeto`, `tema`, `global dos agentes`,
  `Codex principal` ou `Codex notas citaveis`.

Graphify API pode acelerar descoberta semantica, mas o resultado so vira
confirmado depois de abrir a fonte citada ou cruzar com `rg`, codigo, docs ou
testes. Antes disso, registre como `source: graphify`.

### Usar Memoria Graduada Com Anti-Gatilho

Nem toda memoria precisa virar L3 robusto. Use a escala
`MEMORIA-GRADUADA-COM-ANTI-GATILHO` para ajustar o peso ao risco.

Frase-guia:

```text
Memoria boa nao so lembra quando usar; ela impede usar no caso errado.
```

- `Nivel 1 - simples`: nota pequena, baixa confusao e baixo risco. Use L1,
  ancora L2, fonte viva e quando lembrar. Adicione quando nao lembrar so se for
  obvio.
- `Nivel 2 - operacional`: procedimento recorrente, skill, validacao, erro
  plausivel ou decisao reutilizavel. Adicione aliases, problema, mecanismo,
  verificacao, prevencao, evidencia minima e `rg de achabilidade`.
- `Nivel 3 - robusta`: erro recorrente, falso pronto, incidente caro, skill
  nova, contrato de validacao, seguranca, automacao, MCP, Graphify, PPIRTV,
  Delphi/WebView2/build/encoding ou retrabalho ja observado.

Anti-gatilho nao e obrigatorio em toda memoria. Ele e obrigatorio quando existe
memoria parecida, termo ambiguo, falso pronto, clones/projetos parecidos,
aplicacao cedo demais, ferramenta que prova a coisa errada ou rota alternativa
mais correta.

Anti-exemplo entra quando evita erro real. Nao escreva anti-exemplo decorativo.

Forca da evidencia:

- `fraca`: arquivo existe, PNG existe, status textual, `rg` isolado ou Graphify
  sem fonte aberta;
- `boa`: fonte aberta, metadado confirmado, comando executado ou imagem
  inspecionada;
- `forte`: teste no processo real, DOM/console/handle corretos, build certo ou
  resultado repetivel;
- `bloqueante`: evidencia contraria, alvo errado, payload privado, processo
  errado, fonte nao aberta ou teste que nao reproduz o caminho real.

Graphify e mapa, nao prova. Registre a query, o graph usado, arquivos
confirmados, hits descartados e motivo dos hits nao promovidos. Nao promova
memoria a partir de `source: graphify` sem abrir ou cruzar a fonte.

#### Desbloqueio manual

Se um gate travar indevidamente, o usuario pode pedir desbloqueio explicito.
Use `DESBLOQUEIO-MANUAL-CONTROLADO` para continuar sem falsificar a evidencia.

Registre:

- qual bloqueio disparou;
- por que ele parece falso positivo ou aceitavel para continuar;
- escopo limitado do desbloqueio;
- quem aceitou o risco;
- quando expira ou quando deve ser revalidado;
- proxima validacao minima;
- evidencia original preservada;
- confirmacao de que nao vira regra global.

Nao use desbloqueio manual para segredo, token, `.env`, `config.toml`, payload
privado, permissao ausente, acao destrutiva sem autorizacao, Graphify sem fonte
aberta como prova final ou evidencia contraria que torne o resultado falso.

Pontes esperadas:

```text
V2 L2: L1 <-> L2
V2 L3: L1 <-> L3, com owner_skill
legacy-v1 L3: L1 <-> L2 <-> L3
Graphify -> fonte: source: graphify -> confirmado em <arquivo>:<linha ou secao>
```

### Escolher O Caminho Correto

Escolha o caminho pelo escopo, nao pela vontade de lembrar mais.

Resolva primeiro a raiz cross-project:

```text
DEX_MEMORIA_HOME = $env:DEX_MEMORIA_HOME, se definido
fallback = $HOME/.agents/memories
```

`DEX_AGENT_HOME` localiza o runtime/skill do Dex Agent; ele nao e raiz de dados
de memoria por padrao. `$HOME/.codex/memories` pertence ao host Codex e tambem
nao e destino padrao do `dex-memoria`, salvo se o usuario configurar
`DEX_MEMORIA_HOME` explicitamente para esse caminho.

```text
<DEX_MEMORIA_HOME>/global/
  lembranca.md
  memoria.md
  conhecimento/

<DEX_MEMORIA_HOME>/temas/<tema>/
  lembranca.md
  memoria.md
  conhecimento/

<WORKSPACE>/.agents/
  lembranca.md
  memoria.md
  conhecimento/
```

Regras:

- `global`: use apenas como roteador minimo para gatilhos universais,
  ponteiros cross-project e criterios que mudam comportamento em qualquer
  contexto.
- `temas/<tema>`: use para dominio reutilizavel, como linguagem, plataforma,
  ferramenta ou familia tecnica.
- `<repo>/.agents`: use para estado vivo, decisoes, handoff e recuperacao
  operacional de um projeto especifico.

Taxonomia de temas:

- tema e dominio reutilizavel, nao apelido de projeto nem combinacao
  projeto-ferramenta;
- prefira temas raiz quando o dominio ja for claro, como `deepseek`,
  `delphi`, `php` ou `codex`;
- use `temas/<area>/<tema>` somente quando a area for uma familia real e
  repetida;
- na duvida, prefira `temas/delphi` antes de
  `temas/programacao/delphi`, e `temas/deepseek` antes de
  `temas/pythia-deepseek`;
- se o conteudo mistura projeto e ferramenta, divida: estado do projeto em
  `<WORKSPACE>/.agents`, aprendizado da ferramenta em
  `<DEX_MEMORIA_HOME>/temas/<ferramenta>`.

Bloqueios antes de gravar:

- se `escopo=global`, o destino deve estar em `<DEX_MEMORIA_HOME>/global`;
- se `escopo=tema`, o destino deve estar em
  `<DEX_MEMORIA_HOME>/temas/<tema>`;
- se `escopo=projeto`, o destino canonico e `<WORKSPACE>/.agents`;
- nunca crie `<WORKSPACE>/global` para memoria global;
- nunca crie `<WORKSPACE>/temas` para memoria de tema;
- nunca escreva memoria viva em `templates/`, `examples/`, logs,
  screenshots ou pastas de secrets.

Criterios de promocao:

- projeto -> tema: quando o aprendizado se repetir ou ficar claramente
  reutilizavel fora do repo;
- tema -> global: somente quando valer para varios temas;
- global -> projeto: nao copie o conteudo grande; aponte para a fonte viva.

Se uma memoria nao tem gatilho L1 claro, nao promova para L2. Se um documento
L3 nao tem ancora L2 que o acione, ele e arquivo ou documentacao solta, nao
recuperacao em camadas.

Exemplo de configuracao abstrata de um ambiente consumidor:

```toml
instructions = [
  "memory.md",
  "dominio/lembranca.md",
  "dominio/memoria.md"
]
```

Nao inclua `api_key`, tokens, secrets, logs, screenshots ou estado real em
exemplos de configuracao. Este pacote apenas documenta o contrato; o carregador
de `instructions` pertence ao ambiente consumidor.

Templates uteis:

- `templates/l1-lembranca.md`
- `templates/l2-memoria.md`
- `templates/l3-conhecimento-index.md`
- `templates/layered-memory-checklist.md`

Exemplo completo:

- `examples/layered-memory/`

Validacao por simulacao:

- `docs/layered-memory-simulations.md`

### Referenciar Em Outro Projeto

Quando um projeto precisar usar `dex-memoria`, referencie a fonte completa e
unica `C:\CodexProjetos\dex-memoria\SKILL.md`, diretamente ou pelo
redirecionador global. Nao copie nem adapte `SKILL.md` como skill local
autoritativa.

Templates e exemplos sanitizados podem ser copiados como artefatos de projeto,
sem se tornarem fonte do contrato. Nao copie `.agents/` reais, inbox, ledger,
logs, screenshots, secrets, caches ou runtime `src/`.

## Como Ativar

Use `dex-memoria` quando uma captura, achado, decisao ou residuo precisar ser classificado antes de virar memoria viva, ledger, arquivo, estacionamento, skill-candidate ou descarte.

Ativar significa pedir que o agente aplique este contrato documental. A V1 nao liga hook, nao registra automaticamente e nao cria comandos como `add`, `resolve`, `archive`, `status` ou `audit`.

Ativar tambem nao deve fazer o agente responder com uma proibicao generica como "Never update memories. You can only read them." Essa frase so pode vir de uma instrucao externa do ambiente; ela nao e regra de `dex-memoria`.

## Prompts Prontos

### Ativacao Geral

```text
Use dex-memoria nesta conversa.

Antes de salvar, lembrar, arquivar ou encaminhar qualquer captura operacional, aplique o contrato de ciclo de vida:
- classifique a captura;
- diga a fonte de verdade;
- diga quando lembrar;
- diga quanto lembrar;
- diga por que lembrar;
- diga por quanto tempo lembrar;
- diga quando nao lembrar;
- diga quem vence em conflito;
- diga o criterio de resolucao;
- diga se existe ponteiro global recomendado;
- diga o proximo destino.

Nao trate MEMORY.ndjson como fila viva.
Nao deixe memoria resolvida orientar o proximo passo.
Nao prometa scripts gerais, hooks ou automacao que nao existem no contrato
operacional V2. As bancadas V0 permanecem apenas como fixtures historicas
explicitamente delimitadas.
```

### Classificar Uma Captura

```text
Use dex-memoria para classificar esta captura antes de salvar, lembrar ou encaminhar.

Captura:
<cole aqui>

Responda com:
- veredito: memoria viva | ledger-only | estacionamento | skill-candidate | descarte;
- tipo;
- estado;
- fonte de verdade;
- quando lembrar;
- quando nao lembrar;
- quem vence em conflito;
- criterio de resolucao;
- proximo destino: local | pai | rede | nenhum.
```

### Criar Uma Memoria Operacional

```text
Use dex-memoria para transformar esta captura em memoria operacional somente se ela realmente precisar orientar retomadas futuras.

Captura:
<cole aqui>

Use o formato de templates/memory-contract.md e preencha:
- id;
- titulo;
- tipo;
- estado;
- escopo;
- projeto;
- origem;
- evidencia;
- o_que_lembrar;
- por_que_lembrar;
- quando_lembrar;
- quanto_lembrar;
- por_quanto_tempo_lembrar;
- quando_nao_lembrar;
- fonte_viva;
- quem_vence_em_conflito;
- criterio_de_resolucao;
- ponteiro_global_recomendado;
- proximo_dono.

Se nao for memoria viva, explique por que deve virar ledger-only, estacionamento, skill-candidate ou descarte.
```

### Veredito De Memorizacao

Use este formato quando Vera Veredito fechar um bloco, sprint, teste, replay,
contrato ou decisao e precisar decidir se algo deve orientar pedidos futuros:

```text
Memorizacao recomendada: sim | nao
Camada sugerida: memoria viva | ledger-only | estacionamento | skill-candidate
Ponteiro global recomendado: sim | nao
Modelo seguido:
Campos obrigatorios preenchidos:
Por que lembrar:
Quanto lembrar:
Quando lembrar:
Quando nao lembrar:
Fonte viva:
Quem vence em conflito:
Criterio de saida:
Deve usar dex-memoria: sim
Prompt formatado para dex-memoria:
```

Se `Ponteiro global recomendado: sim`, adicionar:

```text
Lembranca global curta:
- Gatilho:
- Abrir fonte viva:
- O que procurar la:
- Quem vence em conflito:
- Quando nao usar:
- Criterio para remover ou revisar o ponteiro:
```

Regra canonica: memoria global e indice curto gravavel, nao copia de contrato
grande, evidencia extensa, historico, tutorial ou narrativa. Quando houver valor
de lembranca/indexacao, grave ponteiro global conciso para a fonte viva. A fonte
viva fica no repo, skill, `HANDOFF`, `ACTIVE`, artefato ou ledger local.

### Resolver Ou Arquivar Uma Memoria

```text
Use dex-memoria para decidir se esta memoria ativa ja pode ser resolvida, arquivada ou supersedida.

Memoria:
<cole aqui>

Evidencia de fechamento:
<cole aqui>

Aplique templates/memory-resolution-checklist.md e responda:
- veredito: fechado | ainda vivo | supersedido | precisa revisao humana;
- prova encontrada;
- ponteiros vivos que devem sair;
- historico que deve permanecer;
- risco de regressao de retomada;
- proximo passo seguro.

Nao deixe uma memoria resolvida continuar como proximo passo.
```

### Decidir O Destino Correto

```text
Use dex-memoria para decidir o destino desta captura.

Captura:
<cole aqui>

Escolha exatamente um destino principal:
- memoria viva;
- ledger-only;
- estacionamento;
- skill-candidate;
- descarte.

Explique:
- por que este destino vence;
- o que nao deve ser lembrado;
- qual arquivo ou camada deve receber o registro;
- qual camada nao deve receber o registro;
- qual condicao futura mudaria o veredito.
```

### Usar Em Projeto Filho

```text
Use dex-memoria em modo projeto filho.

Contexto do projeto filho:
<nome e objetivo>

Captura:
<cole aqui>

Regras:
- HANDOFF.md manda no proximo passo seguro;
- ACTIVE.md manda no objetivo vivo e loops abertos;
- MEMORY.ndjson e ledger, nao fila viva;
- memoria resolvida nao orienta proximo passo;
- bug do Dex Agent pai usa rota pai;
- handoff entre filhos usa rota rede;
- nao misture este contrato com runtime do Dex Agent.

Responda com:
- veredito;
- fonte de verdade;
- destino local | pai | rede | nenhum;
- texto minimo a registrar;
- quando parar de lembrar.
```

## Exemplos De Uso Em Projeto Filho

Use `templates/child-usage-prompt.md` quando o projeto filho so precisa classificar uma captura.

Use `templates/memory-contract.md` quando a captura realmente precisa virar memoria operacional forte.

Use `templates/memory-resolution-checklist.md` quando uma memoria ativa foi corrigida, cumprida, substituida ou arquivada.

Para uma unidade nova V2, use `templates/l3-conhecimento-file.md` na rota direta
`L1 <-> L3`. Os demais templates em camadas ainda documentam compatibilidade
histórica V1 e não devem impor L2 artificial ao V2. O contrato ativo escolhe
exatamente `L1 <-> L2` OU `L1 <-> L3` conforme a densidade.

Use `examples/active-operational-memory.md`, `examples/ledger-only-memory.md`, `examples/resolved-operational-finding.md` e `examples/child-to-child-handoff.md` como exemplos sanitizados.

Use `examples/layered-memory/` como exemplo sanitizado de gatilho, ancora e
conhecimento sob demanda.

Use `examples/graduated-memory-test-cases.json` e
`scripts/validate-graduated-memory.js` como bateria curta e reprodutivel antes
de commit ou sync do padrao `MEMORIA-GRADUADA-COM-ANTI-GATILHO`.

Use `npm run smoke:consciencia` para gerar uma memoria temporaria no padrao
forte L1/L2/L3 e executar os validadores reais da `consciencia-memorias`:
`validate-memory-tags.ps1` e `validate-memory-links.ps1 -RequireObsidian`.
Esse smoke exige `DEX_MEMORIA_HOME` ou o padrao local
`%USERPROFILE%/.agents/memories` com os validadores instalados.

Esse comando e uma **integracao local**, nao um teste publico autocontido. Ele
exige a instalacao canonica de `memory-policy.ps1`, `memory-policy.json` e
`memory-policy.compat.json` na mesma raiz dos validadores e falha antes de
executa-los quando uma dessas dependencias estiver ausente. `npm test` continua
autocontido e nao executa esse smoke.

Use `npm run test:local` quando quiser rodar a bateria portavel e o smoke local
da consciencia no mesmo comando.

## Usar O Piloto V2 Fixture-Only

O mapa consolidado de writers, readers, validators, consumidores externos,
comandos, backup e rollback esta em
[`v2-fixture-consolidation-map.md`](v2-fixture-consolidation-map.md).

Para executar a prova manual preservavel:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  ".\skills\dex-memoria-v2-pilot\scripts\run-v2-memory-pilot.ps1" `
  -LinkValidator "<caminho-absoluto-validate-memory-links.ps1>" `
  -Finder "<caminho-absoluto-find-memory-atual.ps1>" `
  -BaselineFinder "<caminho-absoluto-find-memory-baseline.ps1>"
```

O piloto:

- cria somente fixtures novas sob o laboratorio governado;
- exige Finder e link validator por paths explicitos;
- exige tambem um Finder baseline explicito para a prova de no-shrink;
- prova create, retry, recovery e recall L2/L3;
- preserva `receipt.json` e `PILOT-MANIFEST.json`;
- nao instala a skill, nao toca o vault vivo e nao altera `legacy-v1`.

`skills/dex-memoria-v2-pilot/` permanece fonte de repositorio e nao faz parte
de `package.json#files`. Empacotamento, instalacao ou sync exigem decisao
separada.

## Usar Dex Memória V2

O pedido comum usa V2 por default. O consumidor resolve a intenção humana para
um escopo explícito `project`, `global`, `theme` ou `dual`; o writer não inventa
essa decisão:

```text
Use $dex-memoria: <conteúdo>
```

Escrever `V2` no pedido é opcional e pode servir apenas como ênfase; não é
necessário informar V2 para selecionar o writer. V1 explícito serve somente
para recall, leitura ou restauração do corpus histórico, nunca para escrita.
O atalho não ignora classificação, duplicata, validação ou recibo. As dimensões
implementation, scope e root são independentes. Selecionar o root não define
nem congela o layout interno.

```text
Product: Dex Memória V2
Implementation-Version: v2
Scope: project | global | theme
project/local -> <WORKSPACE>/.agents
global -> <DEX_MEMORIA_HOME>/global
theme -> <DEX_MEMORIA_HOME>/temas/<tema>
dual-scope -> dois destinos e dois recibos
```

Em dual-scope, são duas operações e dois recibos independentes. O V1 histórico
continua read-only, restaurável e recuperável junto do V2 novo.

Cada novo commit pela CLI emite `receipt_revision: 2` e
`producer_provenance.entrypoint_realpath` + `entrypoint_sha256`. Para validar a
origem, abra o entrypoint indicado e recalcule SHA-256 sobre seus bytes; não use
o próprio receipt como único oracle. Esses paths absolutos descrevem o ambiente
da execução e não são uma identidade portátil. Receipts históricos sem esses
campos permanecem legíveis, mas significam `legacy_provenance_unavailable`: não
atribua a escrita antiga ao binário atual. Retry preserva a provenance original
e resume pode revelar produtores diferentes entre siblings executados em
momentos distintos.

Superficies live, todas com JSON por stdin:

| Comando | Entrada | Saida principal |
| --- | --- | --- |
| `dex-memoria v2 remember` | payload cotidiano fechado; `scope`, conteúdo e tags | receipt de orquestração com rotas, hashes e validações; não ecoa payload |
| `dex-memoria v2 plan` | `dex.memory.operation.request.v2` | rotas e identidades deterministicas |
| `dex-memoria v2 apply` | request + candidate V2 | recibo por destino; dual exige dois |
| `dex-memoria v2 resume` | operacao parcial + candidate | executa somente o sibling pendente |
| `dex-memoria v2 recover` | operacao + scope | rollback ou `ALREADY_COMMITTED` |
| `dex-memoria v2 validate` | root + unidade tocada | recibo independente Markdown/Obsidian |
| `dex-memoria v2 validate-root` | root completo | colisões de block id e links entre unidades |
| `dex-memoria v2 capability` | matriz de capacidade | compatibilidade observavel |

No `validate-root`, links de superfícies V2 que apontam para o corpus V1
(`MEMORIA.md`, `LEMBRANCA.md` com prefixo de caminho ou arquivos planos de
`conhecimento/`) são ignorados como herança legada; a auditoria valida apenas
unidades V2 do root (`lembranca.md`, `memorias/*.md` e
`conhecimento/<slug>/README.md`). Root sem unidades V2 retorna
`MISSING_OBSIDIAN_EVIDENCE` (fora do gate V2, não erro de links).

Nos requests `dex.memory.operation.request.v2`, `profile` e opcional e aceita
`v2`, `legacy-v1` ou `governed-theme-v2`. Use `profile: "v2"` quando o caller precisar declarar o
perfil ativo explicitamente; omitir o campo preserva o mesmo fluxo V2.
`legacy-v1` continua disponivel como marcador de compatibilidade e
`governed-theme-v2` como alias historico tolerado, sem acionar automaticamente
a fixture de mesmo nome. O profile nao
substitui `implementation_version: "v2"` nem altera `scope` ou o root resolvido.

No caminho cotidiano, o caller informa escopo e conteúdo. `remember` usa o cwd
como workspace, `DEX_MEMORIA_HOME` ou o fallback portátil como memory home, L2
como camada default e deriva slug/operation id. `theme` exige tema e L3 exige
`owner_skill`. Não forneça paths internos do destino. Para dual, confira dois
route receipts e duas validações independentes.

Em qualquer resultado não `COMMITTED`, siga `recovery` sempre que não for
`null`. `recover_then_retry_new_operation`
primeiro recupera a rota e depois repete `remember`; `retry_new_operation`
repete diretamente com o `next_operation_id` determinístico. Um journal
`ROLLED_BACK` é terminal e nunca deve receber `resume`. Em falha total sem rota
comprometida, `candidate_id` e `content_hash` são `null`; o helper não fabrica
identidades que pertencem ao writer.

`recovery.actions` contém uma entrada fechada para cada rota pendente. Execute
todas antes do `then_command`; em dual, nunca conclua a recuperação olhando
somente o primeiro sibling. Se qualquer action exigir resolução manual, o mode
é `manual_resolution`, mas um `next_operation_id` ainda é fornecido quando
outro sibling já ficou terminal ou precisou de recovery.

Para retomar, use:

```text
Vamos retomar o contexto: recarregue as memórias V2 locais e as globais.
Inclua também o corpus V1 histórico pelos mesmos escopos.
```

`governed-theme-v2` permanece identificador histórico de fixture; não é
produto, umbrella ou perfil ativo. O selector live usa a interface V2 acima.

## O Que Depende Do Dex Agent

Continua no Dex Agent:

- comandos `/inbox` e `/memory`;
- captura de candidates;
- proposal-first writes;
- ledger `.agents/MEMORY.ndjson`;
- inbox `.agents/INBOX/`;
- recall automatico;
- manutencao de superficies vivas;
- integracao Telegram;
- codigo de runtime.

## O Que Nao Acontece Automaticamente

Este pacote nao:

- instala skill global;
- altera `dex-agent`;
- cria comandos no Dex Agent ou em consumidores;
- executa hooks, captura automatica ou scripts externos fora das CLIs
  explicitamente invocadas;
- grava ledger;
- move arquivos;
- publica releases;
- apaga memoria antiga;
- valida projetos filhos sozinho.

## Limites Das Superficies Historicas

A V1 permanece contrato e corpus historico de leitura/restauracao. A excecao V0
executa apenas `create plan|apply|recover` em fixture descartavel. Hooks,
captura automatica e integracoes de bot continuam fora; a escrita real explicita
pertence aos comandos `v2`.

## Contrato De Tags Do V2

O validador `v2 validate` aplica estas regras ao par L1 (indice) + destino
(L2/L3). Elas cobrem a unidade escrita (`v2 validate` com `touched_paths`) e o
root inteiro (`v2 validate-root`):

1. **Tag aninhada obrigatoria**: cada unidade expoe ao menos uma tag aninhada
   lowercase na forma `#tema/assunto` — sem tag o validador acusa
   `MISSING_NESTED_TAG`.
2. **Conjunto identico L1 x destino**: a linha do L1 e o arquivo de destino
   expoem exatamente o mesmo conjunto de tags; uma tag a mais em qualquer lado
   acusa `DIVERGENT_TAG_SET`.
3. **O corpo e varrido inteiro**: a extracao de tags varre o corpo do destino
   por completo. Citar uma hashtag de exemplo no corpo entra no conjunto real
   e reprova a unidade. Citar com seguranca exige que a hashtag nao seja
   capturada (por exemplo, espaco apos o `#`, como em `# tema/assunto`).
4. **Destino resolvivel**: `v2 validate-root` acusa `ORPHAN_L1_LINE` quando uma
   linha do L1 aponta (link ou wikilink) para `memorias/<slug>.md` que nao
   existe no root.

Exemplo valido (linha do L1 casando com o destino):

```markdown
- Titulo -> [md](memorias/slug.md) [[memorias/slug|Titulo]] #tema/assunto ^slug
```

```markdown
# Titulo
[Volar](../lembranca.md#^slug)
#tema/assunto
```

Anti-exemplo (reprovado): o mesmo par com uma hashtag solta extra no corpo do
destino (por exemplo `#tema/outro`) acusa `DIVERGENT_TAG_SET`; uma linha do L1
apontando `memorias/slug.md` inexistente acusa `ORPHAN_L1_LINE`.

Quando uma escrita e reprovada, o receipt `FAILED` de `v2 remember` ecoa a
causa real em `route_receipts.<scope>.failure.detail.validation_errors` (com os
codigos acima e os `touched_paths` validados), alem de `failure_code` e
`failure_cause`; a recuperacao e reenviar com `operation_id` novo apos corrigir
a entrada.

## Semântica de Root do validate-root

O `v2 validate-root` resolve links de forma **root-relative fail-closed**: um
link so e considerado resolvido se o destino esta dentro da raiz validada e faz
parte da superficie V2 dela (`lembranca.md`, `memorias/<slug>.md`,
`conhecimento/<slug>/README.md` no **topo** da raiz). Dois casos de vault real
precisam de contrato explicito:

1. **Root self-contained** (default): a raiz e um vault V2 completo por si
   (ex.: `<WORKSPACE>\.agents`). Todo link vivo resolve dentro dela; sem o
   campo `vault_root` o comportamento e exatamente este, fail-closed.
2. **Vault composto**: a raiz validada e sub-pasta de um vault Obsidian maior
   (ex.: `DEX_MEMORIA_HOME\global` dentro de `DEX_MEMORIA_HOME` com `temas\`).
   Links de navegacao que apontam irmaos do vault (estilo Obsidian
   `temas/<tema>/nota#^ancora`) sao vivos na perspectiva do vault, mas escapam
   da sub-raiz. Passe o campo opcional `vault_root` no request:

```json
{
  "capability": "v2-obsidian",
  "require_obsidian": true,
  "root": "<DEX_MEMORIA_HOME>\\global",
  "vault_root": "<DEX_MEMORIA_HOME>"
}
```

Com `vault_root`, um link que foge da raiz e conferido contra o vault inteiro
(varredura recursiva de Markdown do `vault_root`): se resolve la, entra em
`evidence.cross_vault_links` (auditavel, nao reprova, nao gera backlink); se
nao resolve em lugar nenhum, continua `UNRESOLVED_WIKILINK` /
`UNRESOLVED_MARKDOWN_LINK`. Sem o campo, nada muda (fail-closed preservado).

**`EMPTY_ROOT` (anti verde-vazio, 0.1.8):** uma raiz cuja varredura le **0
arquivos** (sem superficie V2 no topo — tipico de apontar `root` para um vault
composto cujas sub-raizes moram em sub-pastas) agora devolve `ok:false` com
`EMPTY_ROOT` citando a raiz, em vez de um `ok:true` vazio que nao provava nada.
Se a intencao era validar o vault composto, valide cada sub-raiz com
`vault_root`, ou crie a superficie V2 no topo da raiz.

### Skips declarados do validador (auditoria 2026-11-07)

Cada desvio silencioso da cadeia de coleta/resolucao de links
(`bin/memory-v2-capabilities.js`), classificado — nenhum outro skip existe na
cadeia:

| Local | Regra | Efeito |
| --- | --- | --- |
| l.298/l.317 | `isUnitRelation` no modo unidade (`v2 validate` com `touched_paths`) | So os links da unidade sob escrita sao avaliados; escopo do contrato de par, nao afeta `validate-root` |
| l.299/l.318 | `isLegacyV1LinkTarget` no modo root | Links shape-V1 (`<caminho>/memoria`, `<caminho>/lembranca`, `conhecimento/<slug>` de 2 segmentos) **nao sao coletados** — population invisivel ao validador, viva no Obsidian (o "segundo silencio" do issue #5) |
| l.309/l.328 | link resolvido via `vault_root` | Entra em `cross_vault_links`; nao e unresolved nem backlink (0.1.8) |
| l.450/l.473 | `!isContained(root/vault_root, candidate)` | Fail-closed do escopo: candidato fora da raiz (ou do vault) e rejeitado — o "primeiro silencio" do issue #5, agora com rota de fuga declarada (`vault_root`) |
| l.453/l.475 | candidato sem documento lido | Arquivo contido no escopo mas fora da superficie V2 (nao entra no indice de resolucao) |
| l.491/l.494/l.496/l.497 | coletor do `vault_root`: symlink / diretorio (desce na recursao do walk e segue) / nao-Markdown / fora do vault | Seguranca e alcance do indice de resolucao do vault |

Lembrete de fixture para testes: um alvo cross-vault de teste **nao** pode se
chamar `memoria`/`lembranca` (com caminho) — esses entram no skip legacy-V1 e o
teste passa vazio. Use nomes neutros (ex.: `temas/<tema>/nota.md`).

## Identidade Do `request_fingerprint`

O `request_fingerprint` do receipt identifica a **operação** (payload
normalizado, incluindo `operation_id`), não o conteúdo — ele muda a cada retry
com `next_operation_id` mesmo com body idêntico. NÃO use para dedup por
conteúdo (issue #10, item 4).

## Recuperacao De Rota Simples (v2 remember + v2 recover)

Fonte unica da taxonomia: `FAILURE_CURES` + `CURE_PRECEDENCE` em
`bin/memory-v2-remember.js` (o gate de instancia e esta tabela viajam juntos —
mudou a fonte, atualize aqui no mesmo PR):

| Modo do `recovery` | Códigos de falha | Cura |
| --- | --- | --- |
| `recover_then_retry_new_operation` | `RECOVERY_REQUIRED`, `ROLLBACK_REQUIRED`, `JOURNAL_CONFLICT` | `v2 recover` (com `command_input` da action) e retry com `next_operation_id` |
| `retry_new_operation` | `TRANSACTION_ROLLED_BACK`, `IDEMPOTENCY_CONFLICT` | reemitir com `next_operation_id` |
| `retry_same_operation` | `ROUTE_BUSY` | repetir a MESMA operação quando o mutex liberar (sem `next_operation_id`; sem pacing automático — aguarde entre tentativas) |
| `manual_resolution` | manuais DECLARADOS na tabela: `CASE_COLLISION`, `ROUTE_CONFLICT`, `SAFETY_BOUNDARY`, `RECEIPT_JOURNAL_DIVERGENCE`, `RECOVERY_CONFLICT`, `PRODUCER_PROVENANCE_REQUIRED` | decisão humana; `failure_message` da action carrega o motivo do executor |

Toda action carrega `cure` com a classificação da fonte única (`MANUAL`,
`RECOVER`, `RETRY_NEW`, `RETRY_SAME`) — o consumidor não reimplementa a
tabela. Código fora dela devolve `cure: "UNCLASSIFIED"`: o receipt denuncia a
própria lacuna em vez de degradar para manual mudo (hoje `JOURNAL_NOT_FOUND`
segue `UNCLASSIFIED` até classificação explícita).

Precedência declarada: `MANUAL > RECOVER > RETRY_NEW > RETRY_SAME` — em escopo
dual misto, a ação de maior precedência presente define o modo (a action de
cada rota continua carregando sua própria cura). Divergência de contrato
anunciada no 0.1.12 e documentada aqui (issue #14): o dual
`ROUTE_BUSY + TRANSACTION_ROLLED_BACK/IDEMPOTENCY_CONFLICT` resolve como
`retry_new_operation` **com** `next_operation_id` (a irmã com transação
rolada precisa de id novo; antes do 0.1.12 era `retry_same_operation` sem id).

Quando uma escrita de `v2 remember` falha no meio (validacao, transporte ou
journal anterior nao-terminal), o receipt devolve `recovery` **acionavel por
contrato** (issue #7): para `RECOVERY_REQUIRED`, `ROLLBACK_REQUIRED` e
`JOURNAL_CONFLICT`, cada `actions[]` carrega:

- `command`: `dex-memoria v2 recover`;
- `command_input`: objeto JSON **pronto para o stdin** do comando acima —
  nao precisa compor nada a mao;
- no nivel do `recovery`: `then_command` (`dex-memoria v2 remember`) e
  `next_operation_id` (id novo deterministico para o retry).

Fluxo canônico de fim de loop (rota simples ou dual):

```bash
# 1) o receipt falhou com recovery.mode = recover_then_retry_new_operation
echo '<payload original>' | dex-memoria v2 remember        # receipt com recovery.command_input

# 2) executar a cura com o command_input do receipt (copie o objeto inteiro)
echo '<recovery.actions[0].command_input>' | dex-memoria v2 recover
# => journal termina ROLLED_BACK (ou ALREADY_ROLLED_BACK)

# 3) reemitir o payload original com o operation_id novo do receipt
echo '<payload com operation_id = recovery.next_operation_id>' | dex-memoria v2 remember
# => COMMITTED
```

Notas de contrato:

- `JOURNAL_CONFLICT` significa que o journal armazenado nao pertence a rota
  recalculada (identidade, paths ou request divergiram). O `v2 recover` com o
  `command_input` ainda e a primeira acao: journals nao-terminais sao rolados
  back; journals adulterados/intrusos devolverao o diagnostico de seguranca —
  nesse caso a remocao manual do diretorio `.dex-memoria/transactions/<id>` e
  decisao humana, registrada com motivo.
- `TRANSACTION_ROLLED_BACK` (journal ja terminal e limpo) nao exige recover:
  o receipt devolve `mode: retry_new_operation` com `next_operation_id`.
- Estados intermediarios do journal (PREPARED/DESTINATION_PUBLISHED/
  L1_PUBLISHED) existem para retomada pos-crash; o recover restaura os
  backups `before` e marca `ROLLED_BACK` de forma deterministica.
