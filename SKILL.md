---
name: dex-memoria
description: Use quando for preciso criar, revisar, resolver, arquivar ou superseder memoria operacional de projetos Dex Agent com contrato de ciclo de vida, evitando que memoria resolvida continue viva como proximo passo. Esta e a versao operacional completa e publicavel; antes de aplica-la, verificar se o workspace atual possui `skills/dex-memoria/SKILL.md` ou skill local equivalente e preferir a versao local quando existir.
---

# Dex Memoria

`dex-memoria` e o ponto de entrada pratico para operar memoria com ciclo de vida.

Dentro deste pacote, `memorizador` e o nome operacional do contrato de
memorizacao: o metodo que define como, quando, quanto, por que, por quanto tempo
e quando nao lembrar. Memoria global nao e somente leitura: quando uma lembranca
tiver valor cross-project, o mecanismo de escrita disponivel deve gravar um
ponteiro curto, intuitivo e indexavel em `MEMORY.md`, apontando para a fonte viva
completa. O contrato `dex-memoria` nao pode ser usado para negar escrita global;
ele apenas orienta formato, criterios, fonte viva, conflito e revisao. O
registro global nao deve virar tutorial, copia de contrato, historico grande ou
dump de contexto.

Nao confunda esse `memorizador` contratual com a skill/pacote experimental antigo
que foi arquivado. O pacote antigo nao e rota viva; o contrato de memorizacao
continua vivo dentro de `dex-memoria`.

## Fonte Publicavel Completa

Este `SKILL.md` e a versao operacional completa do contrato `dex-memoria`.
Ele deve ser o arquivo publicado pelo repositorio de desenvolvimento
`C:\CodexProjetos\dex-memoria` e instalado em outras maquinas via GitHub/npm.

O redirecionador do registry global fica em:

```text
$env:USERPROFILE\.agents\skills\dex-memoria\SKILL.md
```

A fonte versionada desse redirecionador fica neste repositorio:

```text
registry\agents-skills\dex-memoria\SKILL.md
```

Esse redirecionador deve procurar, nesta ordem:

1. uma `dex-memoria` local no workspace atual;
2. esta fonte completa do repositorio de desenvolvimento;
3. a copia operacional instalada em
   `$env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md`.

A copia `.dex-agent` e fallback operacional instalado e deve ser sincronizada a
partir desta fonte completa. O redirecionador `.agents` nao deve substituir este
contrato nem esconder falha quando nenhum destino completo existir.

## Sincronizacao Canonica 2026-06-22

Esta fonte completa preserva o contrato operacional e deve expor os marcadores
canonicos publicados pelo pacote `dex-memoria`:

- `memory-write-route-v1`: escrita, movimento, consolidacao, arquivamento ou
  supersedencia de memoria exige preflight read-only, decisao de escopo/camada,
  validacao por `consciencia-memorias` e prova de recuperacao.
- `consciencia-memorias`: gate de qualidade para L1/L2/L3, tagnames, anchors,
  block ids, backlinks, indices L3, backups externos e achabilidade.
- `MEMORIA-GRADUADA-COM-ANTI-GATILHO`: classificar memoria como simples,
  operacional ou robusta; anti-gatilho entra apenas quando ha risco real de
  confusao.
- `DESBLOQUEIO-MANUAL-CONTROLADO`: permite continuar sob ressalva explicita,
  sem promover memoria ativa nem apagar evidencia bloqueante.
- Anti-gatilho nao e obrigatorio em toda memoria.
- Graphify e mapa, nao prova. Hits de Graphify so viram memoria quando a fonte
  citada e aberta ou confirmada por `rg`, codigo, docs, teste ou evidencia
  runtime.

Use esta skill quando uma captura, achado ou decisao precisar ser classificada antes de virar:

- memoria viva;
- ledger historico;
- arquivo resolvido;
- handoff entre projetos;
- skill-candidate;
- estacionamento;
- descarte.

## Regra Central

Memoria operacional nao e apenas anotacao. Ela precisa responder:

- como entra;
- quando deve ser lembrada;
- quanto deve ser lembrada;
- por que deve ser lembrada;
- por quanto tempo deve ser lembrada;
- como deve ser usada;
- quando nao deve ser lembrada;
- como sai do estado vivo.

Quando o problema for recuperacao recorrente de conhecimento, aplique tambem a
arquitetura:

```text
L1 lembranca -> L2 memoria -> L3 conhecimento
```

- `L1 lembranca`: gatilhos curtos, sem conteudo longo, apontando para L2.
- `L2 memoria`: detalhe operacional com ancoras estaveis.
- `L3 conhecimento`: documentacao, tutoriais, modelos e exemplos sob demanda.

`lembranca.md`, `memoria.md` e `conhecimento/` sao nomes canonicos para memoria
local de repositorio.

Convenção de caixa para arquivos de memoria:

- `lembranca.md` e `memoria.md` em minusculo indicam memoria local do repo,
  normalmente em `<WORKSPACE>/.agents/`.
- `LEMBRANCA.md` e `MEMORIA.md` em maiusculo indicam memoria ou acao global,
  cross-project ou governada fora do repo local.
- documentos com nome todo em maiusculo devem ser tratados como sinal de acao
  global/governada antes de escrever, mover, consolidar ou apagar.
- em Windows, trate diferenca de caixa como o mesmo destino fisico. Nao crie
  duplicatas como `.agents\lembranca.md` e `.agents\LEMBRANCA.md` no mesmo
  diretorio; respeite o arquivo existente e proponha migracao/renomeacao apenas
  com plano explicito, backup e validacao de links.
- ao criar memoria nova, escolha o casing pelo escopo: minusculo para repo
  local, maiusculo para global/governado.

Tags e links Obsidian sao infraestrutura auxiliar de consulta rapida, nao fonte
de verdade. Use tags curtas e governadas para recuperar memoria de forma
transversal por finder, bibliotecario, pesquisador, Obsidian, Graphify, MCP e
scripts de auditoria, mas mantenha a verdade operacional em L1 -> L2 -> L3.

Regra de tags:

- skills procuradoras consultam tags; elas nao inserem, espalham, renomeiam ou
  normalizam tags automaticamente;
- L1 pode receber poucas tags canonicas no fim da linha somente durante
  curadoria de memoria, quando isso aumentar recuperacao real, por exemplo
  dominio, tipo, risco ou acao;
- tags nao substituem gatilho L1, ancora L2, fonte viva, validacao por `rg` ou
  `validate-memory-links.ps1`;
- evite tag decorativa, sinonimos demais e vocabulario inventado para uma unica
  memoria;
- quando uma skill procurar memoria por tag, ela deve usar ou apontar para
  `obsidian-memory-finder` como contrato read-only canonico; os scripts vivem
  em `obsidian-memoria-cli` como implementacao/compatibilidade. Para saida de
  maquina, usar `DEX-MEMORY-RECALL-JSON` / `dex.memory.recall.v1`;
- qualquer funcao de escrever, editar, criar, apagar, renomear, normalizar tag
  ou gravar memoria deve viver em skill separada de writer/recorder, com pedido
  explicito, backup, L1/L2/L3 e validacao propria;
- se uma busca revelar tag ausente ou baguncada, registre proposta de curadoria
  com fonte e motivo; nao edite tags como efeito colateral da busca;
- para busca relacional, Graphify pode acelerar descoberta, mas todo hit segue
  `source: graphify` ate confirmacao em fonte viva.

O carregamento automatico e responsabilidade do ambiente consumidor.

Ao criar ou revisar memoria em camadas, valide por busca:

- L1: o gatilho curto aparece e aponta para a ancora L2;
- L2: a ancora existe e aponta para a fonte L3 quando houver;
- L3: a fonte longa existe apenas sob demanda, sem substituir L1/L2.

Gate anti L2 solta e backup vivo:

- conteudo vindo de `parking_lot`, flow PPIRTV, racional/veredito automatico,
  achado de reuniao ou classificador automatico nao entra direto em L2 vivo;
  ele precisa virar L1 + L2 completos ou ficar estacionado com `quando`;
- L2 completo exige heading com `{#ancora}`, linha `^block-id`,
  `Localizador`, `Tags`, `Aliases`, `Obsidian: L1`, fonte viva ou origem
  verificavel, quando usar e quando nao usar quando houver risco de falso
  gatilho;
- L1 vivo exige bullet recuperavel, tag especifica, link para a ancora L2 e
  block id estavel; linha solta sem `- ` nao conta como gatilho;
- tags devem estar normalizadas antes da escrita: lowercase, kebab-case,
  nested quando fizer sentido, sem acentos, underscore ou casing misto;
- `.backup-*`, `.bak`, `.truncated`, logs e saidas longas nao ficam em
  `global/` nem `temas/`; backup governado fica fora do vault vivo em
  `$env:USERPROFILE\.agents\memories-backups`;
- se qualquer item acima falhar, o estado correto e `nao pronto`, mesmo que o
  texto pareca util.

Regra de caminho:

- global roteia com gatilhos e ponteiros curtos;
- tema reutiliza conhecimento de dominio;
- projeto opera estado vivo e retomada.

Raiz canonica:

- `DEX_MEMORIA_HOME` e a raiz de memoria cross-project;
- se `$env:DEX_MEMORIA_HOME` existir, use esse caminho;
- se nao existir, use `$HOME/.agents/memories`;
- `global` grava em `<DEX_MEMORIA_HOME>/global`;
- `tema` grava em `<DEX_MEMORIA_HOME>/temas/<tema>`;
- `projeto` grava em `<WORKSPACE>/.agents`;
- nao crie `<WORKSPACE>/global` nem `<WORKSPACE>/temas` para memoria global ou
  de tema;
- nao use `$HOME/.codex/memories` ou `%CODEX_HOME%/memories` como destino
  padrao, salvo configuracao explicita em `DEX_MEMORIA_HOME`.

Taxonomia de temas:

- tema e dominio reutilizavel, nao apelido de projeto, conversa, sprint ou
  combinacao projeto-ferramenta;
- prefira tema raiz quando o dominio ja for claro, como `deepseek`, `delphi`,
  `php` ou `codex`;
- use `temas/<area>/<tema>` somente quando a area for uma familia real e
  repetida;
- se o conteudo mistura projeto e ferramenta, separe estado de projeto em
  `<WORKSPACE>/.agents` e aprendizado reutilizavel em
  `<DEX_MEMORIA_HOME>/temas/<dominio>`;
- revise nomes compostos como `pythia-deepseek` antes de gravar.

Nada entra em L2 sem gatilho L1 ou fonte viva equivalente. Nada entra em L3 sem
ancora L2. Nada entra no global se so serve para um projeto.

## Memoria Graduada Com Anti-Gatilho

Frase-guia:

```text
Memoria boa nao so lembra quando usar; ela impede usar no caso errado.
```

Use `MEMORIA-GRADUADA-COM-ANTI-GATILHO` como padrao oficial para escolher o
peso certo da memoria. A regra e graduar pelo risco, nao transformar toda nota
em burocracia.

### Nivel 1 - Memoria Simples

Use para notas pequenas, baixo risco e baixa chance de confusao.

Campos:

- L1 gatilho curto;
- L2 ancora operacional;
- fonte viva;
- quando lembrar;
- quando nao lembrar, se for obvio.

Nao exija exemplos longos, anti-exemplo ou anti-gatilho quando o risco de falso
encaixe for baixo.

### Nivel 2 - Memoria Operacional

Use para procedimento recorrente, skill, validacao, erro plausivel ou decisao
tecnica reutilizavel.

Campos:

- L1 gatilho curto;
- aliases;
- L2 ancora;
- problema, mecanismo, verificacao e prevencao;
- quando lembrar e quando nao lembrar;
- fonte viva;
- evidencia minima;
- comando `rg de achabilidade`.

Exija pelo menos 1 exemplo correto ou 1 anti-exemplo quando houver risco real
de confusao.

### Nivel 3 - Memoria Robusta

Use para erro recorrente, falso pronto, incidente caro, skill nova, contrato de
validacao, seguranca, automacao, MCP, Graphify, PPIRTV, Delphi/WebView2/build,
encoding ou qualquer coisa que ja gerou retrabalho.

Campos adicionais:

- aliases de busca;
- anti-aliases ou termos que confundem;
- L3 conhecimento sob demanda quando houver detalhe rico;
- exemplos corretos e anti-exemplos;
- gatilhos fortes e anti-gatilhos;
- força da evidência;
- rotas alternativas;
- obsolescencia ou risco de envelhecer;
- se Graphify participou, query, graph, hits confirmados e hits nao promovidos.

Anti-gatilho nao e obrigatorio em toda memoria. Ele se torna obrigatorio quando:

- existe memoria parecida;
- a regra pode ser aplicada cedo demais;
- ha erro recorrente ou falso pronto;
- o termo e ambiguo;
- ha clones ou projetos parecidos;
- a ferramenta pode provar a coisa errada;
- existe rota alternativa mais correta.

Anti-exemplo entra quando evita erro real. Nao escreva anti-exemplo decorativo.

Escala de força da evidência:

- `fraca`: arquivo existe, PNG existe, status textual, `rg` isolado ou Graphify
  sem fonte aberta;
- `boa`: fonte aberta, metadado confirmado, comando executado ou imagem
  inspecionada;
- `forte`: teste no processo real, DOM/console/handle corretos, build certo ou
  resultado repetivel;
- `bloqueante`: evidencia contraria, alvo errado, payload privado, processo
  errado, fonte nao aberta ou teste que nao reproduz o caminho real.

Graphify e mapa, nao prova. Use para localizar relacoes, comunidades, gatilhos
esquecidos e memorias proximas. Marque todo achado como `source: graphify` ate
abrir a fonte citada ou confirmar por `rg`, codigo, teste, doc viva ou
evidencia runtime. Nunca promova memoria diretamente a partir de no Graphify.

### Desbloqueio Manual Controlado

Bloqueios automaticos existem para impedir falso pronto, mas tambem podem gerar
falso impedimento. Quando o usuario pedir explicitamente para desbloquear uma
trava, aplique `DESBLOQUEIO-MANUAL-CONTROLADO`.

Desbloqueio manual permite continuar trabalhando com escopo limitado; ele nao
transforma evidencia `bloqueante` em prova, nao promove memoria ativa por si so
e nao apaga o motivo original do bloqueio.

Antes de desbloquear, registre:

- pedido explicito do usuario;
- bloqueio acionado e por que parece falso positivo ou aceitavel continuar;
- escopo exato do desbloqueio;
- quem aceitou o risco;
- validade ou `quando` o desbloqueio expira;
- proxima validacao minima;
- evidencia original preservada;
- confirmacao de que isso nao vira regra global.

Nao desbloqueie manualmente quando houver segredo, token, cookie, Authorization,
`.env`, `config.toml`, payload privado, acao destrutiva sem autorizacao,
permissao ausente, alvo errado com risco material, ou evidencia contraria que
torne o resultado declarado falso.

Pontes obrigatorias:

```text
L1 -> L2: [GATILHO-CURTO] frase curta -> [memoria.md#ancora-l2]
L2 -> L3: Conhecimento sob demanda: conhecimento/<slug>.md
L3 -> L2: L2 relacionada: memoria.md#ancora-l2
Graphify -> fonte: source: graphify -> confirmado em <arquivo>:<linha ou secao>
```

## Checklist De L3 Robusto

Use este gate quando o aprendizado tiver alta chance de reuso, resolver falha
recorrente, virar referencia de tema ou nascer de Graphify, Bibliotecario,
pesquisa, diagnostico, bug real ou decisao tecnica repetivel.

Um L3 robusto so deve ser considerado pronto quando tiver:

- gatilhos curtos no L1 apontando para uma ancora L2 estavel;
- L2 com contexto operacional, quando usar, quando nao usar, fonte viva e link
  direto para o L3;
- L3 com objetivo, escopo, exemplos, anti-exemplos, modelo operacional,
  comandos ou scripts de validacao, referencias e riscos de obsolescencia;
- fontes separadas entre `confirmado`, `inferido` e `lacuna`;
- comando `rg de achabilidade` cobrindo gatilho, alias humano e termo tecnico;
- indicacao clara de escopo: `projeto`, `tema`, `global dos agentes`,
  `Codex principal` ou `Codex notas citaveis`;
- regra de revisao: quando o conteudo deve ser revalidado, supersedido,
  movido, arquivado ou descartado.

Quando o achado vier do Graphify, use Graphify API como acelerador semantico,
nao como prova final:

```text
Graphify API -> abrir fonte citada ou cruzar com rg/codigo/docs -> promover
para L1/L2/L3 somente depois da confirmacao direta.
```

Enquanto a fonte citada nao for aberta ou cruzada, registre como
`source: graphify`, nao como confirmado.

Modelo minimo para L3 rico:

```text
# <titulo>

Localizador: <GATILHO-CURTO>
Escopo: <projeto|tema|global|codex-principal|codex-notas-citaveis>
Status: confirmado | parcial | candidato

## Quando Usar
## Quando Nao Usar
## Contrato Operacional
## Exemplos
## Anti-Exemplos
## Modelo De Validacao
## Fontes Confirmadas
## Inferencias E Lacunas
## Riscos De Obsolescencia
## Achabilidade
rg -n "<gatilho>|<alias>|<termo-tecnico>" <L1> <L2> <L3>
```

## Precedencia Local E Fallbacks

Antes de aplicar esta skill em um workspace, verifique se o repositorio da
janela de contexto atual possui uma versao local de `dex-memoria`, nesta ordem:

1. `skills/dex-memoria/SKILL.md`
2. `skills/dex-agent/skills/dex-memoria/SKILL.md`
3. `.codex/skills/dex-memoria/SKILL.md`
4. outro caminho local indicado por `AGENTS.md`, `INDEX.md`, `ACTIVE.md` ou `HANDOFF.md`

Se existir `dex-memoria` local, use a versao local e pare de aplicar esta copia
como contrato principal.

Se nao existir versao local, declare antes de continuar:

`Estou usando o dex-memoria completo do repositorio/fallback global pois nao existe dex-memoria local neste workspace.`

Regra de conflito:

- a `dex-memoria` local do projeto vence a global;
- `C:\CodexProjetos\dex-memoria\SKILL.md` e a fonte completa publicavel;
- `$env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md` e fallback
  operacional instalado quando o repo de desenvolvimento nao existir;
- `$env:USERPROFILE\.agents\skills\dex-memoria\SKILL.md` e apenas
  redirecionador do registry global;
- para proximo passo operacional, `HANDOFF.md` vence `.agents/MEMORY.ndjson`;
- `.agents/MEMORY.ndjson` e ledger, nao fila viva.

## Fronteira De Escrita

Esta skill nao deve gerar uma regra ampla de memoria somente leitura.

Quando esta skill disser que a V1 "nao grava memoria", leia isso como: `dex-memoria` nao possui runtime proprio, hook automatico, comando `add` ou escritor de ledger embutido.

Isso nao bloqueia memorizar por outro mecanismo autorizado do ambiente. Quando
houver valor de lembranca/indexacao, use `dex-memoria` para classificar, decidir
o destino e preparar ou executar o ponteiro global conciso conforme o contrato
daquela camada.

Se o ambiente atual bloquear escrita em uma pasta de memorias, declare o bloqueio
como permissao do ambiente/ferramenta ativa, nao veto de `dex-memoria`, e
entregue um candidato de memoria ou o patch operacional apropriado. Assim que
houver caminho autorizado de escrita, grave o ponteiro global conciso.

Antes de escrever qualquer L1/L2/L3, mostre o escopo, o `DEX_MEMORIA_HOME`
resolvido quando aplicavel, o caminho absoluto de destino e o motivo do escopo.
Bloqueie a escrita se `global` ou `tema` apontarem para dentro do workspace.

## Fonte Completa

Leia primeiro:

- `SPEC.md`
- `docs/usage.md`
- `docs/runtime-boundary.md`

Use os templates quando precisar criar ou fechar uma memoria:

- `templates/memory-contract.md`
- `templates/memory-resolution-checklist.md`
- `templates/child-usage-prompt.md`
- `templates/l1-lembranca.md`
- `templates/l2-memoria.md`
- `templates/l3-conhecimento-index.md`
- `templates/layered-memory-checklist.md`

Use os exemplos como referencia de formato:

- `examples/active-operational-memory.md`
- `examples/resolved-operational-finding.md`
- `examples/ledger-only-memory.md`
- `examples/child-to-child-handoff.md`
- `examples/layered-memory/`

## Prioridade Entre Fontes

Para proximo passo vivo, a prioridade recomendada e:

1. `INDEX.md`
2. `.agents/HANDOFF.md`
3. `.agents/ACTIVE.md`
4. sprint ou artefato ativo
5. `.agents/MEMORY.ndjson`
6. arquivo resolvido ou arquivado

Regra pratica:

- `HANDOFF.md` manda no proximo passo seguro;
- `ACTIVE.md` manda no objetivo vivo e loops abertos;
- `.agents/MEMORY.ndjson` e ledger duravel, nao fila viva;
- arquivo resolvido ou arquivado nao reabre trabalho sozinho.

## Limite Da V1

Esta V1 e contrato, template e exemplo.

### Excecao Executavel V0 Fixture-Only

A V1 documental preservada inclui uma excecao executavel V0 estritamente
fixture-only: `create plan|apply|recover` opera somente sobre a fixture
descartavel marcada e os dois destinos fixos descritos em
[docs/cli-create-fixture-v0.md](docs/cli-create-fixture-v0.md). Essa excecao
nao autoriza vault vivo, writer geral, segredos, hooks ou runtime Dex Agent.

Ela nao executa comandos `add`, `resolve`, `archive`, `status` ou `audit`.
Ela tambem nao e hook automatico e nao roda sozinha ao abrir ou fechar uma janela de contexto.

Scripts so entram numa V2 depois de uso real repetido com baixa ambiguidade.
