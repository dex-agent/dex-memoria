---
name: dex-memoria
description: Redirecionador global para dex-memoria. Use a skill local do workspace primeiro; se nao existir, carregue a versao completa do repositorio de desenvolvimento C:\CodexProjetos\dex-memoria\SKILL.md; se o repo nao existir, carregue $env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md.
---

# Dex Memoria - Redirecionador Global

Esta skill global e uma ponte curta. Ela nao e a fonte completa do contrato.

## Ordem De Resolucao

Antes de aplicar esta ponte global como contrato principal, procure nesta ordem:

1. `<WORKSPACE>\skills\dex-memoria\SKILL.md`
2. `<WORKSPACE>\skills\dex-agent\skills\dex-memoria\SKILL.md`
3. `<WORKSPACE>\.codex\skills\dex-memoria\SKILL.md`
4. outro caminho local indicado por `AGENTS.md`, `INDEX.md`,
   `.agents\ACTIVE.md` ou `.agents\HANDOFF.md`
5. `C:\CodexProjetos\dex-memoria\SKILL.md`
6. `$env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md`

Se existir uma versao local no workspace, use a versao local e pare de aplicar
esta ponte global como contrato principal.

Se nenhuma versao local existir, use primeiro a fonte completa do repositorio de
desenvolvimento/publicacao:

```text
C:\CodexProjetos\dex-memoria\SKILL.md
```

Declare:

```text
Estou usando o redirecionador global dex-memoria para carregar C:\CodexProjetos\dex-memoria\SKILL.md.
```

Use `$env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md` somente se
a copia local e o repositorio de desenvolvimento nao existirem ou nao puderem
ser lidos. Nesse caso, declare a degradacao:

```text
Repositorio de desenvolvimento dex-memoria indisponivel; usando $env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md como fallback instalado.
```

Se nenhum destino completo existir, declare bloqueio explicito. Nao trate este
redirecionador curto como contrato completo.

## Papel Dos Caminhos

- `C:\CodexProjetos\dex-memoria\SKILL.md`: fonte completa de
  desenvolvimento/publicacao do pacote e primeiro fallback apos a copia local
  do workspace.
- `$env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md`: fallback
  operacional instalado quando o workspace nao tem `dex-memoria` local e o repo
  de desenvolvimento nao esta disponivel.
- `$env:USERPROFILE\.agents\skills\dex-memoria\SKILL.md`: este
  redirecionador curto do registry global.

## Quando Usar

Leia e aplique o contrato resolvido pela ordem acima quando:

- nao existir `dex-memoria` local no repositorio atual;
- o usuario pedir memoria operacional, L1/L2/L3, `L3 robusto`,
  `DEX_MEMORIA_HOME`, arquivar, superseder ou resolver memoria;
- for necessario revisar destino de memoria global, tema ou projeto.

## Marcadores Do Contrato Publicado

Este redirecionador expoe os marcadores publicos minimos do contrato atual para
validadores, consumidores e auditorias de registry:

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

## Regra Curta De Casing

O contrato resolvido de `dex-memoria` define:

- `lembranca.md` e `memoria.md` em minusculo = memoria local do repo;
- `LEMBRANCA.md` e `MEMORIA.md` em maiusculo = memoria ou acao global/governada;
- em Windows, nao criar duplicata no mesmo diretorio apenas mudando maiusculas.
  Se precisar migrar casing, fazer com plano, backup e validacao de links.

## Excecao Executavel V0 Fixture-Only

A V1 documental preservada no contrato completo inclui `create
plan|apply|recover` como excecao V0 limitada a fixture descartavel marcada. O
contrato e os limites vivem em
[docs/cli-create-fixture-v0.md](../../../docs/cli-create-fixture-v0.md); este
redirecionador apenas aponta para essa fonte e nao implementa a CLI.

## Regra Curta De Tags

O contrato resolvido de `dex-memoria` define que tags e links Obsidian sao
infraestrutura auxiliar de consulta rapida, nao fonte de verdade. Tags ajudam
finder, bibliotecario, pesquisador, Graphify, MCP e auditoria a recuperar
memoria de forma transversal, mas nao substituem gatilho L1, ancora L2, fonte
viva, `rg`, validadores ou L3 sob demanda.

Skills que procurarem memoria por tag, block id, ancora ou L1/L2/L3 devem usar
ou apontar para `obsidian-memory-finder` como contrato read-only canonico. Os
scripts ficam em `obsidian-memoria-cli` como implementacao/compatibilidade.
Saida de maquina deve preferir `DEX-MEMORY-RECALL-JSON` /
`dex.memory.recall.v1` quando aplicavel.

Qualquer funcao de escrever, editar, criar, apagar, renomear, normalizar tag ou
gravar memoria deve viver em skill separada de writer/recorder, com pedido
explicito, backup, L1/L2/L3 e validacao propria.

Skills procuradoras nao devem inserir, espalhar, renomear ou normalizar tags
automaticamente. Se a busca revelar tag ausente ou baguncada, registrar proposta
de curadoria com fonte e motivo; a edicao real fica no fluxo de memoria.

## Rota Canonica De Escrita De Memoria

Use `memory-write-route-v1` quando o usuario pedir para criar, gravar,
atualizar, consolidar, mover, arquivar ou superseder memoria.

Rota obrigatoria:

1. **Preflight read-only**: usar `obsidian-memory-finder` e, quando necessario,
   `rg`, para procurar duplicata, memoria antiga, conflito, ponte movida,
   tag/localizador existente e fonte viva antes de escrever.
2. **Decisao e escrita**: `dex-memoria` decide se deve lembrar, qual escopo,
   camada, casing, tema, L1/L2/L3, sensibilidade, quando nao lembrar e qual
   writer/recorder autorizado executa a escrita. Finder nunca escreve.
3. **Validacao de consciencia**: antes de fechar, acionar
   `consciencia-memorias` para validar links, anchors, block ids, tagnames,
   backlinks, indice L3, backups externos, pontes de memoria movida e
   achabilidade.
4. **Prova de recuperacao**: fechar apenas com evidencia de L1 -> L2, L2 -> L3
   quando houver, Finder/`rg` recuperando o gatilho e validadores executados ou
   justificativa explicita de nao aplicabilidade.
5. **Governanca de skills**: se a regra afetar skill, registry, pacote de
   exportacao ou contrato compartilhado, acionar `governancia-skills` e
   registrar a mudanca no indice/governanca correspondente.

Nao declarar memoria pronta quando a escrita so ficou bonita no Obsidian. A
memoria esta pronta quando uma nova janela consegue encontra-la sem contexto
extra pela escala de recall documentada.

## Regra De Atualizacao

Nao copie o contrato completo para este arquivo.

Atualize primeiro a fonte versionada deste redirecionador:

```text
C:\CodexProjetos\dex-memoria\registry\agents-skills\dex-memoria\SKILL.md
```

Depois sincronize a copia instalada do registry global, sempre com backup, diff
e validacao:

```text
$env:USERPROFILE\.agents\skills\dex-memoria\SKILL.md
```

Atualize o contrato completo separadamente em:

```text
C:\CodexProjetos\dex-memoria\SKILL.md
$env:USERPROFILE\.dex-agent\skills\dex-memoria\SKILL.md
```

Ignore arquivos relativos ao lado deste redirecionador, exceto quando a tarefa
for auditar restos do registry global. O contrato executavel deve vir da copia
local do workspace, da fonte completa `C:\CodexProjetos\dex-memoria\SKILL.md`,
ou do fallback operacional `.dex-agent`. Este redirecionador curto nao e
contrato completo.
