---
id: ISSUE-LOCAL-0006
titulo: "GitHub #28: gate merge-check não executava suíte no merge automático nem na resolução manual (premissa MERGE_HEAD falsa) — FECHADO 261121 PR #30 / release 0.1.20"
status: integrado
prioridade: P1
tipo: bug
tags: ["#tracker/issue", "#tracker/hooks", "#tracker/git"]
aberto_por: "crsantosxx (GitHub #28, 2026-11-22 UTC)"
criado_em: 2026-11-21
atualizado_em: 2026-11-21
vinculos:
  - "GitHub issue #28 (remote_url: https://github.com/dex-agent/dex-memoria/issues/28 — espelho; a verdade mora aqui)"
  - "PR #30 (6627c66) / release v0.1.20"
  - "evidências: .agents/EVIDENCIAS/2026-11-21-issue28-29/"
  - "irmão de laboratório: ISSUE-LOCAL-0006 do repo code-review-graph (WinError 2 npm.cmd) — FECHADO 261121 no corte 2.4.0+dex.2 (resolve_suite_command; GREEN-REAL-CRG_OK no dex-memoria)"
---

# GitHub #28 — pre-merge-commit com premissa MERGE_HEAD falsa

## Problema

O hook `tools/playbook/hooks/pre-merge-commit` (instalado fa99e4d, provado por
stub) guardava `[ ! -f "$GIT_DIR/MERGE_HEAD" ] && exit 0` — mas o **Git real
2.45.1 invoca o hook ANTES de MERGE_HEAD existir** no merge automático: o gate
silenciava exatamente quando deveria rodar. E a resolução manual de conflito
dispara o `pre-commit` (não o pre-merge-commit), que não rodava suíte. Hooks
versionados com `100644` (sem `+x` POSIX).

## Diálogo

### NASCIMENTO — issue de terceiro (crsantosxx, 2026-11-22 UTC)

Relato com evidências apontando as três falhas; revisão da janela dona
confirmou os três com diagnóstico preliminar.

### CURA — 2026-11-21 (corte 0.1.20, Trilho 2026-11-21-issue28-29-hooks-playbook-0120)

- RED com **Git real** (lab-red.sh exit 0): RED28A (merge automático completou
  2 parents sem gate; hooklog `MERGE_HEAD=MISSING` na invocação) +
  RED28B (commit de resolução sem suíte; `pre-commit` com `MERGE_HEAD=EXISTS`).
- Curas: merge automático → suíte direto no worktree do resultado;
  `pre-commit` detecta `MERGE_HEAD` → suíte no commit de resolução;
  `git update-index --chmod=+x` (`100755`).
- GREEN com Git real (lab-green-auto/manual exit 0): quebrados reprovados,
  verdes commitam com gate executado.
- Defeito irmão do laboratório (CRG `WinError 2` spawn npm no Windows):
  ISSUE-LOCAL-0006 no TRACKER do repo dono `code-review-graph`.

## Desfecho

**integrado** — PR #30 (`6627c66`, CI 2/2, squash), release v0.1.20, GitHub
#28 CLOSED com comentário de desfecho. Suíte 377/376/0.
