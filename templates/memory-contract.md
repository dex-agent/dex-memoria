# Memory Contract Template

Use este template antes de promover uma captura para memoria operacional.

Este e o contrato `memorizador` do `dex-memoria`: ele padroniza como, quando,
quanto, por que, por quanto tempo e quando nao lembrar. Memoria global nao e
somente leitura: quando uma lembranca tiver valor cross-project, grave um
ponteiro curto, intuitivo e indexavel em `MEMORY.md`, apontando para a fonte viva
completa. O registro global nao e tutorial, copia de contrato, historico grande
ou dump de contexto; em todos os casos, preserve criterio, fonte viva, conflito
e revisao.

## Identidade

- `id`:
- `titulo`:
- `tipo`: `regra | decisao | procedimento | achado | estado | residuo | aprendizado`
- `nivel`: `simples | operacional | robusta`
- `estado`: `ativa | resolvida | arquivada | superseded | descartada | estacionada`
- `escopo`: `repo | projeto-filho | subsistema | tarefa | cross-project`
- `projeto`:
- `origem`:
- `data`:

## Evidencia

- `forca_da_evidencia`: `fraca | boa | forte | bloqueante`
- `arquivo`:
- `comando`:
- `teste`:
- `telegram_message_id`:
- `screenshot`:
- `decisao registrada`:
- `source_graphify`: `nenhum | query + graph + fonte aberta obrigatoria`

## Clausulas De Lembranca

- `o_que_lembrar`:
- `por_que_lembrar`:
- `quando_lembrar`:
- `gatilhos_fortes`:
- `anti_gatilhos`:
- `quanto_lembrar`:
- `por_quanto_tempo_lembrar`:
- `como_usar_depois`:
- `quando_nao_lembrar`:
- `rotas_alternativas`:

Anti-gatilho nao e obrigatorio em toda memoria. Ele se torna obrigatorio quando
existe memoria parecida, termo ambiguo, falso pronto, erro recorrente,
clones/projetos parecidos, ferramenta que pode provar a coisa errada ou rota
alternativa mais correta.

Anti-exemplo entra quando evita erro real. Nao escrever anti-exemplo decorativo.

## Exemplos

- `exemplo_correto`:
- `anti_exemplo`:

## Pontes L1/L2/L3

- `tagname`: `#<dominio/tag-especifica>`
- `l1`: `[GATILHO] frase curta #<dominio/tag-especifica> -> [memoria.md#ancora] | [[memoria#^ancora|memoria]] ^ancora`
- `l2`: `memoria.md#ancora` com heading `{#ancora}` e block id `^ancora`
- `l2_tags`: `Tags: #<dominio/tag-especifica>`
- `l2_obsidian_l1`: `Obsidian: L1 [[lembranca#^ancora|GATILHO]]`
- `l3`: `conhecimento/<slug>.md`
- `l3_index`: `conhecimento/INDEX.md` lista o arquivo L3 e a L2 consumidora
- `l3_volta_para_l2`: `[../memoria.md#ancora](../memoria.md#ancora)`
- `l3_obsidian_l2`: `Obsidian: L2 [[../memoria#^ancora|ancora]]`

## Fonte De Verdade

- `fonte_viva`: `INDEX.md | .agents/HANDOFF.md | .agents/ACTIVE.md | sprint | artefato | MEMORY.ndjson | arquivo`
- `camada`: `viva | ledger | arquivo`
- `quem_vence_em_conflito`:

## Ponteiro Global

- `ponteiro_global_recomendado`: `sim | nao`
- `lembranca_global_curta`:
  - `gatilho`:
  - `abrir_fonte_viva`:
  - `o_que_procurar_la`:
  - `quem_vence_em_conflito`:
  - `quando_nao_usar`:
  - `criterio_para_remover_ou_revisar_o_ponteiro`:

## Ciclo De Vida

- `criterio_de_resolucao`:
- `arquivamento`:
- `supersedes`:
- `proximo_dono`:
- `data_de_revisao`:

## Saida Esperada

Quando lembrar: `<condicao objetiva>`

Quando nao lembrar: `<condicao objetiva>`

Ponteiro global: `<nenhum | indice curto para a fonte viva>`
