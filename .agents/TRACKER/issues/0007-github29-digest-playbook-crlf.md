---
id: ISSUE-LOCAL-0007
titulo: "GitHub #29: digest do Napkin no PLAYBOOK divergia do blob versionado e do checkout Windows (gerador assinava working copy) — FECHADO 261121 PR #30 / release 0.1.20"
status: integrado
prioridade: P2
tipo: bug
tags: ["#tracker/issue", "#tracker/playbook", "#tracker/digest"]
aberto_por: "crsantosxx (GitHub #29, 2026-11-22 UTC)"
criado_em: 2026-11-21
atualizado_em: 2026-11-21
vinculos:
  - "GitHub issue #29 (remote_url: https://github.com/dex-agent/dex-memoria/issues/29 — espelho; a verdade mora aqui)"
  - "PR #30 (6627c66) / release v0.1.20"
  - "evidências: .agents/EVIDENCIAS/2026-11-21-issue28-29/digest-red.sh"
---

# GitHub #29 — digest do PLAYBOOK sobre bytes crus do working copy

## Problema

`generate-playbook.py` calculava o digest das fontes com `read_bytes()` cru —
no Windows com `core.autocrlf` o checkout é CRLF e o digest publicado
(`1f9e1e34…`) divergia tanto do blob LF versionado (`7c20528e…`) quanto do
checkout em clones LF: o `--check` era dependente de plataforma.

## Diálogo

### NASCIMENTO — issue de terceiro (crsantosxx, 2026-11-22 UTC)

Relato com os três hashes lado a lado (publicado × blob × checkout) —
diagnóstico imediato.

### CURA — 2026-11-21 (corte 0.1.20)

- RED (digest-red.sh exit 0): `publicado == workcopy CRLF ≠ canônico LF` —
  causa provada na fonte (`sources_table`, 1 linha).
- Cura: normalizar CRLF→LF antes de hashar (forma canônica do clean filter).
- Provas: `--check` exit 0 em working copy CRLF **e** LF; digest publicado
  confere com o canônico LF versionado; negativo (napkin alterado → DRIFT
  exit 2); idempotência de 2ª geração byte-a-byte (`write1==write2`).

## Desfecho

**integrado** — PR #30 (`6627c66`, CI 2/2, squash), release v0.1.20, GitHub
#29 CLOSED com comentário de desfecho.
