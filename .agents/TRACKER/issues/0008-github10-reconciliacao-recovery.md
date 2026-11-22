---
id: ISSUE-LOCAL-0008
titulo: "GitHub #10: reconciliação dos 8 findings da revisão adversarial do PR #8 (5 já pagos 0.1.11-0.1.15; 3 curados no 0.1.21) — FECHADO 261122 PR #31 / release 0.1.21"
status: integrado
prioridade: P2
tipo: debt
tags: ["#tracker/issue", "#tracker/recovery", "#tracker/receipt"]
aberto_por: "revisão adversarial da própria casa (PR #8, 2026-11-07)"
criado_em: 2026-11-22
atualizado_em: 2026-11-22
vinculos:
  - "GitHub issue #10 (remote_url: https://github.com/dex-agent/dex-memoria/issues/10 — espelho; a verdade mora aqui)"
  - "PR #31 / release v0.1.21"
  - "evidências: .agents/EVIDENCIAS/2026-11-22-issue10/ (probe-formas.js, RED-F7-guidance-ausente.txt, GREEN-F7-guidance-presente.txt)"
  - "Trilho: .agents/PLAN-TASKS/2026-11-22-issue10-reconciliacao-recovery-0121.md"
---

# GitHub #10 — reconciliação dos 8 findings da adversarial do PR #8

## Problema

A issue #10 (dívida técnica: 8 findings da revisão adversarial do PR #8)
hibernou desde 2026-11-07 por decisão do dono. Os cortes 0.1.11-0.1.15
pagaram parte dos findings, mas a issue nunca foi reconciliada finding-a-
finding contra o HEAD — sem mapa, "quanto falta" era invisível.

## Diálogo

### NASCIMENTO — revisão adversarial do PR #8 (2026-11-07)

8 findings (F1-F8) sobre receitas de falha do v2 remember/recover:
classificação muda, message descartada, fingerprint content-bound,
dual sem teste, recover de 2º nível sem guidance, command null.

### RECONCILIAÇÃO — 2026-11-22 (GO-CONTINUO do dono reativa a #10)

Mapa contra HEAD (probe executável + CRG + leitura de fonte):

- **F1/F2/F3/F5/F8 = PAGOS** por 0.1.11-0.1.15 (bucket RETRY_SAME;
  MANUAL+then_command; failure_message ponta a ponta; gate
  instância-vs-schema; next_operation_id no guidance).
- **F4 real** = ambiguidade documentável: `request_fingerprint` digere o
  pedido normalizado INTEIRO (incl. operation_id) — nome honesto, sem bug;
  falta a DOC da tríade (fingerprint=pedido · candidate_id=conteúdo ·
  idempotency_key=operação).
- **F6 real** = fluxo dual command_input→recover→retry sem teste travado.
- **F7 real** = receipt FAILED do `v2 recover` de 2º nível (JOURNAL_CONFLICT
  com journal mutado no disco) sem nenhuma rota de resolução.

### CURA — 2026-11-22 (corte 0.1.21)

- RED F7 provado executável (probe-formas.js: journal route.operation_id
  mutado → exit 5 JOURNAL_CONFLICT recoverable=true SEM guidance).
- Cura F7 pela CLASSE: `recoverFailureGuidance` no route-executor — todo
  receipt FAILED do recover (catch + JOURNAL_NOT_FOUND) nasce com
  `guidance {mode: manual_resolution, message, journal_path}`. Taxonomia de
  buckets do remember NÃO se projeta: quem falhou foi o próprio recover.
- Cura F6: `test/memory-v2-dual-recover-retry.test.mjs` (E2E dual com
  rollback NÃO-terminal → PARTIAL_PENDING → recover ROLLED_BACK → retry
  COMMITTED nas duas rotas; formato real descoberto por probe, não assumido).
- Cura F4: docs/usage — tabela tríade com derivação por arquivo-fonte
  (candidate_id = hashJson sem operation_id; idempotency_key =
  dex-memoria:<op>:<scope>) + exemplo + seção guidance 2º nível.

## Desfecho

**integrado** — PR #31 (CI 2/2, squash), release v0.1.21, GitHub #10 CLOSED
com comentário do mapa finding-a-finding. Suíte 379/378/0 (+1 skip).
