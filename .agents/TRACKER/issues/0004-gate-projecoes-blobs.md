---
id: ISSUE-LOCAL-0004
titulo: "gate de projeções: blobs citados nos mapas recalculados em todo commit (issue #20)"
status: integrado
prioridade: P1
tipo: bug
tags: ["#tracker/issue", "#tracker/gate"]
aberto_por: "sessao:zcode (quiz sem resposta a tempo — seguiu pelo recomendado, emenda GO 2026-11-16 item 4)"
criado_em: 2026-11-18
atualizado_em: 2026-11-18
integrado_em: 2026-11-18
remote_url: https://github.com/dex-agent/dex-memoria/issues/20
vinculos:
  - "PR #27 / release v0.1.19"
---

# gate de projeções (blobs dos mapas) — ISSUE-LOCAL-0004

Espelho local da issue GitHub #20 (classe de blob stale paga 3×: 0.1.13
sha pré-edição · 0.1.14 convenção velha · 0.1.15 blob do usage). A issue
nomeava a cura: "a regra CONTRIBUTING existe, falta o GATE executável".

## Diálogo

### NASCIMENTO — 2026-11-18 (janela dona, análise oraculo-solid)

- Análise: grafo rico memories-current (9.473 nós) conectou a #20 à família
  blob/projeções (EXCEPTION_RED_BASE_BLOB_MISMATCH ppirtv + regra do gerador
  de projeções); FTS5 + fulltext do corpus solid selaram Fragilidade
  (whitepaper l.11446-11453) + CCP (livro l.641); régua: classe 3× = gate 1×.
- Quiz sem resposta a tempo → seguiu pelo recomendado (emenda GO 2026-11-16).

### CURA PAGA — 2026-11-18 (PR #27 merge `896fc7b`, release `v0.1.19`)

- Gate em `validate-public.js` (chokepoint `npm run check`): recalcula
  git-blob id com clean filter CRLF→LF (os mapas citam git-blob, não sha256 —
  discriminador: `git hash-object` 87b157cd vs bruto 2173db48 vs normalizado
  87b157cd) e reprova drift citando par citado×atual com a cura na mensagem.
- RED e2e: `deadbeef` plantado passava no check antigo. GREEN: reprova.
- **Pegou drift REAL na 1ª execução** (SKILL.md editado 11-18 sem regen do
  mapa — 4ª ocorrência genuína, agora interceptada); curado no mesmo commit.
- Teste `validate-public-projection-blobs` 4/4 (blob vazio e69de29…, CRLF,
  drift/fresh/missing, par multilinha); suíte 377/367/0; D-14 + linha de
  capacidade nos mapas; issue #20 CLOSED com prova.
- Ressalvas: "11 codes" permanece só no CHANGELOG histórico do 0.1.14
  (passado não se reescreve); molde do gate documentável para os irmãos da
  família (ppirtv) fica como referência, escopo deste repo.
