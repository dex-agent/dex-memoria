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
   tools/playbook/hooks/pre-merge-commit`. Provou: args literais do laboratório,
   bloqueio 3 linhas exit 1, execution_error nao bloqueia, escape, e ramo f com
   suite real (fail 0) com stub CRG exit 99 provando que ele nao e chamado
   (prova viva: sessao 2026-11-18, commits fa99e4d/9d14d4f).
   REBAIXADO 2026-11-21 (issue #28): esta receita valida ramos INTERNOS mas
   falseia a premissa do ciclo de vida — no merge automático REAL o git 2.45.1
   invoca o hook ANTES de `MERGE_HEAD` existir (o stub criava MERGE_HEAD na mão).
   Para prova de hook de merge use o item 5 (Git real); esta fica só para ramos
   internos de parsing.

5. **[2026-11-21] Provar hook de merge com Git REAL: repo descartável + wrapper instrumentador**
   Sintoma: prova de hook por stub falseou o disparo real (issue #28 — o gate
   silenciava no merge automático e ninguém percebeu).
   Faça em vez disso: repo descartável com `core.hooksPath` apontando para os
   hooks ATUAIS byte-a-byte renomeados `.real` + wrapper de mesmo nome que LOGA
   `MERGE_HEAD`/`GIT_DIR`/cwd e `exec` o `.real`; executar `git merge` de verdade
   (automático e com conflito+resolução) e assertar no hooklog/saída. Medido no
   Git 2.45.1: `pre-merge-commit` roda com `MERGE_HEAD` AUSENTE e `argv=[]`;
   commit de resolução dispara `pre-commit` COM `MERGE_HEAD` presente; no merge
   automático o `pre-commit` não roda. Stubs de AMBIENTE (CRG/gerador) são
   legítimos; stub do DISPARO não é (prova viva: `.agents/EVIDENCIAS/
   2026-11-21-issue28-29/lab-red.sh` + `lab-green-auto.sh` + `lab-green-manual.sh`,
   issues #28/#29, corte 0.1.20).

6. **[2026-11-21] Escrever hook bash no Windows: editor pode gravar CRLF e o bash quebra em silencio**
   Sintoma: Write/Edit gravou CRLF no `pre-commit` (git avisou "CRLF will be
   replaced by LF"; `file` confirmou) — bash com CRLF falha com CR literal:
   `command not found` so quando o git dispara o hook.
   Faca em vez disso: apos escrever/editar hook, conferir bytes e normalizar —
   `python -c "b=open('f','rb').read(); print('\r\n in b')"` (True = CRLF presente);
   normalizar para LF antes de provar; `.gitattributes` (`tools/playbook/hooks/* text eol=lf`)
   protege o COMMIT, nao o working copy local que roda. Pago no corte 0.1.20.

## 2026-11-22 — áudio: SUPERSEDEDIDO — a rota "cópia do repo dex-agent" é a ponte morta do incidente 261121 (bot errado)

**⚠️ Este item nasceu errado e foi corrigido no mesmo dia (correção do dono).** A edição
anterior ensinava "usar a cópia do repo `C:\CodexProjetos\dex-agent\skills\dex-agent-audio-summary`"
porque a cópia do registry morria com `ERR_MODULE_NOT_FOUND .agents/src/config.js`. O envio por
essa rota saiu pelo **bot de dev** (uso `dev-dex-agent`, messageId 195) — é
exatamente a classe do incidente 261121 (áudio pelo bot errado), cuja vacina estrutural
(dex-audio-motor + dex-contatos) foi instalada em 2026-11-21.

Faça em vez disso: **rota viva = `$dex-audio` (alias) → `dex-audio-motor`**:
```powershell
python -B <REGISTRY>/dex-audio-motor/scripts/motor.py enviar --uso audio-resumo --texto-arquivo <resumo.txt> --idempotency-key <chave>
```
Destino/segredo vêm SÓ de `dex-contatos` (uso `audio-resumo`/`dex-pai` é a rota do pai;
`dev-dex-agent` é DEV e não é a rota do pai — números de chat e bots ficam na loja
`dex-contatos`, nunca neste arquivo). Prova da rota
viva: message_id 1298 (2026-11-22). Regra de comportamento: **ler `$dex-audio`/SKILL da rota
antes de TODO envio** — memória de sessão anterior pode estar supersededida (a preferência
`send-dex-agent-audio-summary.ps1` da sessão de 21/11 estava). Detalhe Git Bash que segue
válido: caminho Windows no `-texto-arquivo` via `cygpath -w`.
