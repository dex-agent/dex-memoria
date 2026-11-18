---
id: ISSUE-LOCAL-0003
titulo: "docs: ligar remember aos schemas de entrada e recibo"
status: integrado
prioridade: P2
tipo: melhoria
tags: ["#tracker/issue", "#tracker/schemas"]
aberto_por: sessao:codex
criado_em: 2026-11-18
atualizado_em: 2026-11-18
integrado_em: 2026-11-18
remote_url: https://github.com/dex-agent/dex-memoria/issues/26
receipt: .agents/receipts/issues/20261118-autoria-schemas/manifesto.json
---

# docs: ligar remember aos schemas de entrada e recibo

O checkout local recebeu a correção. O mantenedor acompanha sua integração pela [issue 26](https://github.com/dex-agent/dex-memoria/issues/26). O [texto publicado](../../receipts/issues/20261118-autoria-schemas/corpo-issue.md) registra fontes, mudança e critérios de aceite.

## Diálogo

A sessão confirmou a publicação pelo conector GitHub.

### CURA PAGA E CONFERIDA — 2026-11-18 (janela dona zcode)

- Cura commitada direto no main pela janela irmã (codex): `4f5a58f` — SKILL.md liga `v2 remember` aos schemas de entrada/recibo (links relativos) + porta estável `check-schemas/SKILL.md` citada + workflow SCHEMA.md ajustado + playbook regen.
- Conferência do aceite pela janela dona (3/3): links resolvem no clone; ambos os schemas declaram os identificadores `dex.memory.remember.{request,receipt}.v2`; `node --test test/memory-v2-receipt-schema-instance.test.mjs` = **5/5, 0 fail**.
- Issue [#26](https://github.com/dex-agent/dex-memoria/issues/26) **CLOSED** com comentário citando commit + prova. Item integrado.
