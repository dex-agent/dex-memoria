# Example - Memoria Simples

> Exemplo sanitizado. Use quando o risco de falso encaixe e baixo.

Nivel: `1 - memoria simples`
Escopo: `projeto`
Forca da evidencia: `boa`

## L1

```md
- [DOC-HUB] atualizar indice quando criar doc publica -> [memoria.md#doc-hub]
```

## L2

```md
## Doc Hub {#doc-hub}

Localizador: `DOC-HUB`

Problema:
Docs novas ficam invisiveis quando o indice publico nao aponta para elas.

Verificacao:
Abrir o indice publico e confirmar se o novo arquivo esta listado.

Quando lembrar:
- criar ou mover doc publica;
- adicionar template ou exemplo novo.

Quando nao lembrar:
- nota local em `.agents/`;
- rascunho nao publicado.

Fonte viva:
- `INDEX.md`
- `README.md`
```

## Decisao

Anti-gatilho e anti-exemplo nao sao obrigatorios aqui porque a regra e pequena,
o risco de confusao e baixo e a rota alternativa e obvia: se for estado local,
nao atualizar indice publico.
