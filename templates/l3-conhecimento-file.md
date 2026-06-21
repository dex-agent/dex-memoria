# L3 - Conhecimento - Arquivo

Use este template para um arquivo L3 robusto sob `conhecimento/<slug>.md`.

L3 existe sob demanda: nao crie arquivo L3 sem L2 que explique quando abrir
este detalhe e sem entrada em `conhecimento/INDEX.md`.

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
theme: <tema-ou-global>
---
```

# <Titulo Do Conhecimento>

Localizador: `<GATILHO-CURTO>`
Tags: `#<dominio/tag-especifica>`
Aliases: `<alias humano; termo tecnico; erro comum>`
L2 relacionada: [../memoria.md#<ancora-estavel>](../memoria.md#<ancora-estavel>)
Obsidian: L2 [[../memoria#^<ancora-estavel>|<ancora-estavel>]]

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
