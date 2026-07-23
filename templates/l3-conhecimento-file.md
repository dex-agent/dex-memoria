# L3 - Conhecimento - Arquivo

Use este template para uma unidade L3 robusta V2 sob
`conhecimento/<slug>/README.md`.

L3 existe sob demanda. Na V2, L3 pode ser o destino direto de L1 e exige
`owner_skill`; não crie uma L2 artificial. Preserve backlink bidirecional
`L1 <-> L3` e entrada em `conhecimento/INDEX.md`. Para corpus V1 histórico,
uma L2 existente pode continuar sendo a origem e deve permanecer recuperável.

## Propriedades Obsidian

Use quando o arquivo for memoria governada.

```yaml
---
tags:
  - <dominio/tag-especifica>
aliases:
  - <alias-humano>
status: ativa
layer: l3
scope: <project-ou-global-ou-theme>
owner_skill: <skill-dona>
---
```

# <Titulo Do Conhecimento>

Localizador: `<GATILHO-CURTO>`
Tags: `#<dominio/tag-especifica>`
Aliases: `<alias humano; termo tecnico; erro comum>`
L1 origem: [../../lembranca.md#^<gatilho-estavel>](../../lembranca.md#^<gatilho-estavel>)
Obsidian: L1 [[../../lembranca#^<gatilho-estavel>|<gatilho-estavel>]]
L2 histórica opcional: <somente quando a unidade pertence ao corpus V1>

## Objetivo

<por que este detalhe existe e quando deve ser aberto>

## Escopo

<o que esta memoria cobre e o que fica fora>

## Modelo Operacional

<procedimento, mecanismo, exemplos e anti-exemplos>

## Validacao

<comandos, testes, criterios de pronto>

## Fontes

- confirmado:
- inferido:
- lacuna:

## Forca Da Evidencia

- fraca: `<arquivo existe, PNG existe, rg isolado, source: graphify sem fonte aberta>`
- boa: `<fonte aberta, comando executado, imagem inspecionada>`
- forte: `<teste no processo real, build certo, resultado repetivel>`
- bloqueante: `<evidencia contraria, alvo errado, fonte nao aberta, teste que nao cobre o caminho real>`

## Graphify

- query:
- graph:
- hits confirmados:
- hits nao promovidos:
- fonte confirmavel: `source: graphify -> confirmado em <arquivo>:<linha ou secao>`

Graphify e mapa, nao prova final.

## Obsolescencia

<quando revisar, superseder ou arquivar>
