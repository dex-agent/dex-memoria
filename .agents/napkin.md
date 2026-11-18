# Napkin do Projeto

## Regras de Curadoria

- Repriorizar a cada leitura; manter itens datados com `Faça em vez disso:`.
- So mudanca operacional material; nao e diario nem changelog.

## Roteamento (aonde vai cada coisa)

- Gotcha tatico do repo -> aqui (napkin-projeto).
- Aviso quente de reuso -> GATILHOS-VIVOS por promocao.
- Regra compartilhada do registry -> governancia-skills.
- Aviso global -> $env:USERPROFILE\.agents\AGENTS.md.
- Projecao externa (envio a terceiros) -> dex-playbook-entrada (aqui e fonte).

1. **[2026-11-05] Gate textual da suite: Node 24 emite resumo com prefixo INFO, nao '# pass'**
   Sintoma: harness mede todos os exits 0 mas o grep textual devolve VERMELHO com a
   suite verde (pago ao vivo no W6 da arqueologia: 347 tests, 0 fail, gate vermelho).
   Faça em vez disso: case os dois formatos — `grep -E "^(#|ℹ) fail[[:space:]]"` — e
   confira o formato real do resumo no output antes de declarar vermelho por gate
   textual (vacina viva: `.agents/SCRIPTS/comprovar-node-arqueologia.sh`, função
   `sum_grep`; memória `GATE-TEXTO-NODE24-RESUMO-INFO`).

2. **[2026-11-18] Provar hook de git SEM merge real: fake GIT_DIR + stubs de git/CRG**
   Sintoma: hook pre-merge-commit so dispara dentro de `git merge` — testar os
   ramos esperando um merge real e caro/arriscado.
   Faça em vez disso: mktemp dir com `MERGE_HEAD`/`MERGE_MSG` fake (o `# Conflicts:`
   liga o ramo resolved-merge), stub `git` que casa `rev-parse HEAD|MERGE_HEAD|
   merge-base HEAD` devolvendo shas fake, stub `code-review-graph` que LOGA os args
   e sai com o exit do ramo em prova; rodar `PATH=stub:$PATH GIT_DIR=fake bash
   tools/playbook/hooks/pre-merge-commit`. Provou: args literais do laboratorio,
   bloqueio 3 linhas exit 1, execution_error nao bloqueia, escape, e ramo f com
   suite real (fail 0) com stub CRG exit 99 provando que ele nao e chamado
   (prova viva: sessao 2026-11-18, commits fa99e4d/9d14d4f).
