# L3 - Conhecimento - INDEX

Use este template como `conhecimento/INDEX.md`.

L3 guarda documentacao, tutoriais, modelos e exemplos longos. Ela nao deve ser
carregada automaticamente por padrao. L2 aponta para L3 quando o detalhe for
necessario.

Regra: nao crie L3 sem ancora L2 que explique quando abrir este detalhe.

## Propriedades Obsidian

Use quando o indice for memoria governada.

```yaml
---
tags:
  - <dominio/tag-especifica>
aliases:
  - <alias-humano>
status: ativa
layer: l3-index
theme: <tema-ou-global>
---
```

## Indice

Cada L3 vivo precisa estar listado aqui e voltar para a L2 que o consome.

- [<arquivo>.md](<arquivo>.md) -> [../memoria.md#<ancora-estavel>](../memoria.md#<ancora-estavel>) | [[../memoria#^<ancora-estavel>|<ancora-estavel>]]
- [documentacao/INDEX.md](documentacao/INDEX.md)
- [modelos/INDEX.md](modelos/INDEX.md)
- [tutoriais/INDEX.md](tutoriais/INDEX.md)

## Achabilidade

```text
rg -n "<gatilho>|<alias-humano>|<termo-tecnico>|<ancora-estavel>|#<dominio/tag-especifica>" ../lembranca.md ../memoria.md .
```
