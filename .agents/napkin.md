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
