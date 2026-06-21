# L2 - Memoria

Use este template para criar a camada de conhecimento operacional detalhado.

L2 deve ser organizada por ancoras estaveis, porque L1 aponta para essas
ancoras. Ela deve ser carregavel por dominio ativo e apontar para L3 quando o
detalhe ficar longo demais para memoria recorrente.

Regra: nao crie L2 sem gatilho L1 ou fonte viva equivalente.

## Propriedades Obsidian

Use quando o arquivo for memoria governada. Tags em YAML ajudam Obsidian e
Finder, mas nao substituem `Tags:` visivel nas secoes L2.

```yaml
---
tags:
  - <dominio/tag-especifica>
aliases:
  - <alias-humano>
status: ativa
layer: l2
theme: <tema-ou-global>
---
```

## `<Titulo Da Secao>` {#<ancora-estavel>}
^<ancora-estavel>

Localizador: `<GATILHO-CURTO>`
Tags: `#<dominio/tag-especifica>`
Aliases: `<alias humano; termo tecnico; erro comum>`
Anti-aliases/confusoes: `<termos parecidos que nao devem acionar esta memoria>`
Obsidian: L1 [[lembranca#^<ancora-estavel>|<GATILHO-CURTO>]]
Obsidian: L3 [[conhecimento/<arquivo>|<arquivo>]] quando houver L3.

### Problema

Descreva o sintoma ou situacao que dispara esta memoria.

### Mecanismo

Explique por que o problema acontece.

### Verificacao

Liste a verificacao minima para confirmar a suspeita.

```text
<comando, checklist ou observacao verificavel>
```

### Gatilhos Fortes

- `<sinal que torna esta memoria adequada>`

### Anti-Gatilhos

- `<sinal que manda usar outra rota>`

Anti-gatilho e obrigatorio quando existe memoria parecida, falso pronto,
ambiguidade, erro recorrente, clones/projetos parecidos, ferramenta que prova a
coisa errada ou rota alternativa mais correta.

### Forca Da Evidencia

- fraca: `<arquivo existe, PNG existe, rg isolado, source: graphify sem fonte aberta>`
- boa: `<fonte aberta, comando executado, imagem inspecionada>`
- forte: `<teste no processo real, build certo, resultado repetivel>`
- bloqueante: `<evidencia contraria, alvo errado, fonte nao aberta, teste que nao cobre o caminho real>`

### Desbloqueio Manual Controlado

- pedido explicito:
- bloqueio acionado:
- razao do desbloqueio:
- escopo limitado:
- risco aceito por:
- expira quando:
- proxima validacao:
- evidencia original preservada:
- nao vira regra global:

Use apenas para continuar trabalho com ressalvas. Nao use para promover memoria
ativa, declarar pronto ou apagar evidencia bloqueante sem nova validacao.

### Prevencao

Explique como evitar repetir o problema.

### Exemplos Corretos

- `<cenario em que esta memoria deve ser usada>`

### Anti-Exemplos

- `<cenario em que esta memoria parecia adequada, mas a rota correta e outra>`

Anti-exemplo entra quando evita erro real. Nao escreva anti-exemplo decorativo.

### Quando Lembrar

- `<condicao objetiva>`

### Quando Nao Lembrar

- `<condicao objetiva>`

### Fonte Viva

- `<arquivo, contrato, handoff, active, doc ou artefato>`

### Graphify

- query:
- graph:
- hits confirmados:
- hits nao promovidos:

Graphify e mapa, nao prova. Mantenha `source: graphify` ate abrir a fonte ou
confirmar por `rg`, codigo, teste, doc viva ou evidencia runtime.

### Escopo

- `global | tema | projeto`

### Conhecimento Sob Demanda

Use apenas quando existir L3 consumido por esta L2.

- L3: [conhecimento/<arquivo>.md](conhecimento/<arquivo>.md)
- Indice L3: [conhecimento/INDEX.md](conhecimento/INDEX.md)

### Ligacoes

- L1: [lembranca.md](lembranca.md)
- Obsidian: L1 [[lembranca#^<ancora-estavel>|<GATILHO-CURTO>]]
- L3 via esta L2 quando existir.
