# Spec - Dex Memoria

## 1. Objetivo

Definir um contrato operacional para memoria com ciclo de vida em projetos Dex Agent e fluxos relacionados.

O objetivo nao e "lembrar tudo". O objetivo e preservar memoria util, auditavel e recuperavel sem deixar achados resolvidos continuarem vivos como proximo passo.

`memorizador`, neste pacote, e o contrato de memorizacao do `dex-memoria`. Ele
define como lembrar, quando lembrar, quanto lembrar, por que lembrar, por quanto
tempo lembrar, quando nao lembrar, qual fonte viva vence e se existe ponteiro
global minimo a registrar.

O pacote/skill experimental antigo com esse nome foi arquivado e nao e rota
viva. O termo continua valido quando apontar para este contrato dentro do
`dex-memoria`.

## 2. Escopo

Dentro do escopo:

- classificar capturas;
- definir fonte de verdade;
- organizar recuperacao em camadas `L1 lembranca`, `L2 memoria` e
  `L3 conhecimento`;
- criar contratos de memoria;
- resolver, arquivar ou superseder memoria;
- separar memoria viva, ledger historico e arquivo;
- orientar integracao com Dex Agent.

Fora do escopo da V1:

- runtime do bot;
- comandos `/inbox` e `/memory`;
- escrita automatica em ledger;
- scripts `add`, `resolve`, `archive`, `status` ou `audit`;
- alteracao automatica de skills globais;
- push para repos remotos.

### Fronteira Executavel V0 Fixture-Only

A V1 documental permanece vigente. Como excecao estreita e executavel, o
binario top-level oferece `create plan|apply|recover` somente para L1+L2
`legacy-v1` em fixture descartavel marcada. O contrato completo fica em
[`docs/cli-create-fixture-v0.md`](docs/cli-create-fixture-v0.md).

### Contrato ativo do Dex Memoria V2

```text
Product: Dex Memoria V2
Implementation-Version: v2
Scope: project | global | theme
Active-Write-Profile: v2
```

`Dex Memoria V2` e a implementacao do produto, nao um perfil de tema. As
dimensoes implementation, scope e root sao independentes:

```text
project/local -> <WORKSPACE>/.agents
global -> <DEX_MEMORIA_HOME>/global
theme -> <DEX_MEMORIA_HOME>/temas/<tema>
dual-scope -> dois destinos e dois recibos
```

A selecao do root nao define nem congela o layout interno. Ela preserva o
destino publico, enquanto o contrato estrutural V2 decide a topologia dentro do
root. O V1 historico continua read-only, restauravel e recuperavel; Finder,
readers e validators devem recuperar V1 antigo e V2 novo sem profile informado
pelo usuario.

O V2 troca a passagem obrigatoria `L1 -> L2 -> L3` pelo roteamento
`L1 -> L2` OU `L1 -> L3`. L2 representa memoria leve/operacional; L3,
conhecimento profundo. `governed-theme-v2` e somente o identificador historico
da fixture que provou essa semantica; nao e o produto, umbrella ou perfil ativo.
O writer/selector ativo e `v2`; `legacy-v1` permanece somente como
reader/restore do corpus historico. O
contrato historico da bancada esta em
[`docs/cli-create-theme-v2-transaction-v0.md`](docs/cli-create-theme-v2-transaction-v0.md).
Um leitor-validador independente reconstrói as rotas nessa bancada e
esta documentado em
[`docs/cli-routes-inspect-v2-v0.md`](docs/cli-routes-inspect-v2-v0.md); ele nao
e Finder, validator live nem permissao de cutover.
O congelamento live de paths internos, owners, metadados, JSONs e consumidores
foi concluido nos SPTs 02 e 03. O mapa historico esta em
[`docs/memory-architecture-profiles.md`](docs/memory-architecture-profiles.md).

- `plan` recebe `dex.memory.create.request.v0` e emite
  `dex.memory.create.plan.v0` deterministico sem mutacao;
- `apply` recebe o plan completo e emite `dex.memory.create.receipt.v0`;
- `recover` recebe `dex.memory.create.recover.v0` e emite o mesmo receipt;
- falhas dos comandos `create` emitem `dex.memory.error.v0` no `stderr`;
- marker, manifest, targets e checkpoints possuem schemas Draft 2020-12 em
  `contracts/schemas/`;
- nenhum request historico `create` recebe paths internos ou aceita o vault vivo;
- Esses limites pertencem aos comandos historicos `create`. A superficie live
  V2 usa `v2 remember` como entrada cotidiana e preserva
  `v2 plan|apply|resume|recover|validate|capability` como primitivas avançadas.
  `remember` resolve defaults portáveis, compõe os owners existentes e emite
  recibo independente por destino sem ecoar o payload. `ROLLED_BACK` é terminal:
  o receipt fornece um novo `operation_id` determinístico para retry; recovery
  pendente executa `recover` antes desse novo retry. Falha sem commit não recebe
  `candidate_id` nem `content_hash` fabricados. Release e SemVer ficam fora.

Novos commits feitos pela CLI live registram `receipt_revision: 2` e
`producer_provenance` tanto no `receipt.json` fisico quanto na projecao do
recibo coordenador. A provenance contem o `entrypoint_realpath` realmente
invocado e o SHA-256 dos bytes desse entrypoint. Ela nao vem do request, do
workspace, do `cwd` nem de variavel de ambiente. Um oracle deve reabrir o path
indicado e recalcular o hash; o receipt nao prova a si proprio. Receipts
historicos sem revision/provenance continuam legiveis, mas nao podem ser usados
como prova positiva do produtor nem receber autoria retroativa. No retry, uma
provenance existente permanece a do commit original.

## 3. Conceitos

### L1 - Lembranca

Camada curta de gatilhos. Deve ser sempre carregavel, ou carregavel pelo dominio
ativo, sem virar tutorial ou historico longo.

Cada lembranca V2 deve apontar para exatamente um destino ativo: L2 em
`memorias/<slug>.md` ou L3 em `conhecimento/<slug>/README.md`. L3 direto exige
`owner_skill` e backlink para L1. No corpus V1 historico, a cadeia L1 -> L2 ->
L3 permanece legivel, mas nao governa novas escritas.

### L2 - Memoria

Camada de conhecimento operacional detalhado, organizada por ancoras estaveis.
Ela explica mecanismo, verificacao, prevencao, fonte viva, conflito e criterio
de saida quando o item for memoria operacional viva.

L2 e carregavel por dominio ativo. Ela nao precisa ser globalmente injetada em
todo contexto quando isso aumentar custo sem melhorar recuperacao.

### L3 - Conhecimento

Camada sob demanda para documentacao, tutoriais, modelos e exemplos longos.
Deve ter `INDEX.md` e ser acessada a partir de L2 quando o detalhe ultrapassar o
uso recorrente.

### L3 Robusto E Memoria Graduada

`MEMORIA-GRADUADA-COM-ANTI-GATILHO` classifica uma captura como memoria simples,
operacional ou robusta. A memoria simples nao deve virar L3 robusto por reflexo:
ela so sobe de nivel quando ha reuso recorrente, falso pronto, ambiguidade real,
erro repetido, Graphify confirmado, diagnostico tecnico ou decisao governada.

Anti-gatilho nao e obrigatorio em toda memoria. Ele se torna obrigatorio quando
existe memoria parecida, termo ambiguo, falso pronto, clones/projetos parecidos,
ferramenta que prova a coisa errada ou rota alternativa mais correta.

`DESBLOQUEIO-MANUAL-CONTROLADO` permite continuar trabalho sob ressalva quando o
usuario pedir explicitamente, com escopo, motivo, validade e proxima validacao.
Ele nao promove memoria ativa, nao apaga evidencia bloqueante e nao vira regra
global sem nova validacao.

Forca da evidencia:

- `fraca`: arquivo existe, imagem existe, `rg` isolado ou `source: graphify`
  sem fonte aberta;
- `boa`: fonte aberta, comando executado ou imagem inspecionada;
- `forte`: teste no processo real, build correto ou resultado repetivel;
- `bloqueante`: evidencia contraria, alvo errado, fonte nao aberta ou teste que
  nao cobre o caminho real.

Graphify e mapa, nao prova. Ate a fonte citada ser aberta ou cruzada com `rg`,
codigo, docs ou testes, o achado deve permanecer marcado como `source: graphify`.

### Escopos De Caminho

A arquitetura L1/L2/L3 pode existir em tres escopos. A regra e evitar que o
global vire deposito e que conhecimento de projeto seja promovido sem
necessidade.

- `global`: apenas roteador de gatilhos universais e ponteiros curtos;
- `projeto`: estado vivo, decisoes e recuperacao operacional do repo atual;
- `area` ou `tema`: conhecimento reutilizavel por dominio, como linguagem,
  plataforma, ferramenta ou familia de projetos.

### Raiz Canonica

`DEX_MEMORIA_HOME` e a raiz canonica para memorias cross-project, ou seja,
memorias `global` e `tema`.

Resolucao:

1. se `$env:DEX_MEMORIA_HOME` estiver definido, use esse caminho;
2. se nao estiver definido, use `$HOME/.agents/memories`;
3. nao derive memoria cross-project de `DEX_AGENT_HOME` automaticamente;
4. nao use `%CODEX_HOME%/memories` ou `$HOME/.codex/memories` como destino
   padrao, porque esse espaco pertence ao host Codex.

Mapeamento fisico:

- `global`: `<DEX_MEMORIA_HOME>/global/lembranca.md`,
  `<DEX_MEMORIA_HOME>/global/memoria.md` e
  `<DEX_MEMORIA_HOME>/global/conhecimento/`;
- `tema`: `<DEX_MEMORIA_HOME>/temas/<tema>/lembranca.md`,
  `<DEX_MEMORIA_HOME>/temas/<tema>/memoria.md` e
  `<DEX_MEMORIA_HOME>/temas/<tema>/conhecimento/`;
- `projeto`: `<WORKSPACE>/.agents/lembranca.md`,
  `<WORKSPACE>/.agents/memoria.md` e
  `<WORKSPACE>/.agents/conhecimento/`.

Bloqueios:

- se `escopo=global`, o destino nao pode estar dentro do workspace;
- se `escopo=tema`, o destino nao pode estar dentro do workspace;
- se `escopo=projeto`, o destino canonico e `<WORKSPACE>/.agents`;
- `templates/`, `examples/`, logs, screenshots e pastas de secrets nunca sao
  destino de memoria viva.

### Taxonomia De Temas

Tema e dominio reutilizavel. Ele nao deve representar projeto especifico,
conversa, sprint, bug isolado, apelido de repo ou combinacao acidental
projeto-ferramenta.

Regra pratica:

- prefira tema raiz quando o dominio ja for claro: `deepseek`, `delphi`,
  `php`, `codex`;
- use `temas/<area>/<tema>` somente quando a area for uma familia real e
  repetida, nao por vontade de organizar demais;
- se o conteudo mistura projeto e ferramenta, separe: estado do projeto em
  `<WORKSPACE>/.agents`, aprendizado da ferramenta em
  `<DEX_MEMORIA_HOME>/temas/<ferramenta>` e aprendizado de linguagem em
  `<DEX_MEMORIA_HOME>/temas/<linguagem>`;
- nomes compostos como `pythia-deepseek` devem ser revisados antes de gravar;
- na duvida, prefira o nome mais simples que sobreviva fora do projeto atual.

Regra dura:

- nada entra em L2 sem gatilho L1 ou fonte viva equivalente;
- nada entra em L3 sem ancora L2;
- nada entra no global se so serve para um projeto.

### Memoria Viva

Memoria que orienta o trabalho atual ou uma retomada operacional.

Ela deve apontar para fonte viva, criterio de resolucao e condicao de parada.

### Ledger

Historico duravel. Pode ser consultado, mas nao deve competir com `HANDOFF.md` ou `ACTIVE.md` por proximo passo.

### Arquivo

Memoria resolvida, arquivada, supersedida ou descartada. Arquivo preserva historico, mas nao reabre trabalho sozinho.

## 4. Estados Oficiais

- `ativa`
- `resolvida`
- `arquivada`
- `superseded`
- `descartada`
- `estacionada`

## 5. Campos Obrigatorios

Toda memoria operacional forte deve ter:

- `id`
- `titulo`
- `tipo`
- `estado`
- `escopo`
- `projeto`
- `origem`
- `evidencia`
- `o_que_lembrar`
- `por_que_lembrar`
- `quando_lembrar`
- `quanto_lembrar`
- `por_quanto_tempo_lembrar`
- `quando_nao_lembrar`
- `ponteiro_global_recomendado`
- `fonte_viva`
- `quem_vence_em_conflito`
- `criterio_de_resolucao`
- `proximo_dono`

## 6. Fluxo De Criacao

1. Classificar a captura.
2. Decidir se e memoria viva, ledger, arquivo, estacionamento, skill-candidate ou descarte.
3. Preencher `templates/memory-contract.md`.
4. Se a captura exigir recuperacao recorrente, decidir se tambem precisa de
   `L1 lembranca`, `L2 memoria` e/ou `L3 conhecimento`.
5. Atualizar superficies vivas somente se a memoria realmente orientar retomada.
6. Registrar evidencia minima.
7. Declarar quando nao lembrar.
8. Se houver valor cross-project, criar apenas ponteiro global curto; o conteudo
   grande fica na fonte viva local.

## 7. Fluxo De Resolucao

1. Provar que a correcao, decisao ou fechamento aconteceu.
2. Remover ponteiros vivos.
3. Marcar historico sem virar fila viva.
4. Avisar o dono afetado quando houver.
5. Testar regressao de retomada.
6. Fechar somente quando `templates/memory-resolution-checklist.md` passar.

## 8. Criterio De Pronto Da V1

A V1 esta pronta quando:

- `SKILL.md` direciona para este contrato;
- templates permitem criar e resolver memoria sem campos ocultos;
- templates de L1/L2/L3 permitem criar recuperacao em camadas sem copiar
  runtime;
- exemplos mostram memoria ativa, resolvida, ledger-only e handoff;
- a fronteira com Dex Agent esta documentada;
- a V1 nao promete scripts inexistentes.

## 9. Criterio De Regressao

Ha regressao se:

- ledger vencer `HANDOFF.md` em conflito operacional;
- memoria resolvida orientar proximo passo;
- L1 virar tutorial longo em vez de gatilho;
- L2 apontar para ancoras inexistentes;
- L3 ser tratada como contexto sempre carregado por padrao;
- a skill sugerir scripts V1 inexistentes;
- exemplos contiverem estado real sensivel;
- o pacote for confundido com o runtime do Dex Agent.

## 10. Proximo Passo

Os SPTs 01–04 reconciliaram o contrato, congelaram a unidade reproduzivel,
reconciliaram consumidores e ativaram o selector V2 com journal e rollback.
O proximo Trilho e SPT 05, para migracao/consolidacao gradual do corpus
historico sem remover recall V1. SemVer e release continuam fora ate
autorizacao propria.
