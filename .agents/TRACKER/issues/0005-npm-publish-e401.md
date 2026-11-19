---
id: ISSUE-LOCAL-0005
titulo: "npm publish: registry travado em 0.1.5 — DESCONTINUADO por decisão do dono 2026-11-19 (canal npm encerrado)"
status: rejeitado
prioridade: P2
tipo: tarefa
tags: ["#tracker/issue", "#tracker/distribuicao"]
aberto_por: "sessao:zcode (GO do dono no quiz — Publicar 0.1.19 agora)"
criado_em: 2026-11-19
atualizado_em: 2026-11-19
vinculos:
  - "memória fix-issues-2-3-receipt-causa-2026-11-06 (E401 original)"
  - "análise oraculo-solid 2026-11-19 (viscosidade de distribuição)"
---

# npm publish E401 — ISSUE-LOCAL-0005 (DESCONTINUADO)

O canal npm é o de instalação real de terceiros, mas o registry travou em
`0.1.5` (última publicação 2026-05-17): **14 releases (0.1.6→0.1.19) nunca
chegaram ao npm** — todo o produto V2 (CLI `v2 remember/plan/apply/validate`,
guards, receipts) não existe no pacote público. O E401 foi pago em 2026-11-06
(v0.1.7) e o atalho confortável do release GitHub foi acumulando o gap
(viscosidade do ambiente, whitepaper solid l.11446).

## Diálogo

### NASCIMENTO — 2026-11-19 (janela dona, GO do dono no quiz)

- Medição: `npm view dex-memoria version` = `0.1.5` (registry) × `v0.1.19`
  (repo `3296187`) — gap de 14.
- `npm whoami` = E401; `~/.npmrc` tem `_authToken` presente porém
  **expirado/inválido** (credencial é posse do dono; a sessão não a renova).
- Dry-run verde: tarball `dex-memoria-0.1.19.tgz`, 185.5 kB, 115 arquivos,
  shasum `a5936cea…` — pacote pronto, só falta credencial válida.

### DESFECHO — 2026-11-19: DESCONTINUADO por decisão do dono

- Dono: "npm foi descontinuado nao vamos mais atualizar o NPM pode remover
  esse monitoramento."
- Canal npm ENCERRADO como meta de distribuição: nenhuma janela futura deve
  propor publicar/renovar credencial npm deste pacote. A distribuição pública
  vive nos releases GitHub (tag + gh release); o pacote 0.1.5 antigo permanece
  no registry como está (sem unpublish — decisão não pedida e irreversível).
- Item fechado como `rejeitado` (enum do schema); sem monitoramento ativo.

