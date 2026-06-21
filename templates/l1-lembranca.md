# L1 - Lembranca

Use este template para criar a camada curta de gatilhos.

Regra: L1 deve ser sempre carregavel ou carregavel pelo dominio ativo. Ela nao
e tutorial, historico ou memoria detalhada. Cada linha deve ajudar uma janela
nova a chegar em L2 rapidamente por localizador, tag, link, anchor e block id.

## Propriedades Obsidian

Use quando o arquivo for memoria governada. Tags em YAML ajudam Obsidian e
Finder, mas nao substituem tags visiveis nas linhas L1.

```yaml
---
tags:
  - <dominio/tag-especifica>
aliases:
  - <alias-humano>
status: ativa
layer: l1
theme: <tema-ou-global>
---
```

## Limites

- Uma linha por gatilho.
- Sem teto artificial de quantidade: L1 pode crescer enquanto cada gatilho for
  curto, especifico, linkado e recuperavel.
- Cada gatilho vivo precisa ter tagname especifica visivel e nao generica.
- Cada gatilho deve apontar para L2 por Markdown e por Obsidian quando o vault
  usar Obsidian.
- Cada gatilho deve terminar com block id estavel `^ancora-estavel`.
- Nao incluir secrets, paths privados, logs, screenshots ou estado real.

## Escopo

- `global`: somente gatilhos universais e ponteiros curtos.
- `tema`: gatilhos de dominio reutilizavel.
- `projeto`: gatilhos do repo ou trabalho atual.

Nao coloque no global um gatilho que so serve para um projeto.

## Gatilhos

Padrao forte para memoria comum:

```markdown
- [<LOCALIZADOR-CURTO>] <sintoma ou frase curta> #<dominio/tag-especifica> -> <acao lembravel> -> [memoria.md#<ancora-estavel>](memoria.md#<ancora-estavel>) | [[memoria#^<ancora-estavel>|memoria]] ^<ancora-estavel>
```

Padrao com anti-gatilho quando houver risco real de confusao:

```markdown
- [<LOCALIZADOR-CURTO>] <gatilho correto> #<dominio/tag-especifica> -> <acao lembravel>; anti-gatilho: <sinal que manda outra rota> -> [memoria.md#<ancora-estavel>](memoria.md#<ancora-estavel>) | [[memoria#^<ancora-estavel>|memoria]] ^<ancora-estavel>
```

## Quando Nao Usar

- Nao usar L1 para explicar mecanismo completo.
- Nao usar L1 para copiar checklist longo.
- Nao usar L1 para armazenar historico resolvido.
- Nao usar tag generica como `#memoria`, `#erro`, `#teste`, `#l1`, `#l2` ou
  `#l3`.
- Nao usar link Obsidian sem block id quando a L2 tiver `^ancora`.

## Ligacoes

- L2: [memoria.md](memoria.md)
- L3: [conhecimento/](conhecimento/)
