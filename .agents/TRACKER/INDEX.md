# INDEX — TRACKER local (issues offline, schema dex.issue-local.v1)

↩ [nível acima: raiz do repo](../../INDEX.md)

Issues locais do projeto dex-memoria (destino offline da plaquinha global `ISSUES-POR-REPO-DONO`). Quem cria o item atualiza este índice na mesma sessão; mudança de status atualiza item + índice. Item fechado nunca se apaga.

| ID | Título | Status | Prioridade | Aguardando |
| --- | --- | --- | --- | --- |
| [ISSUE-LOCAL-0001](issues/0001-missing-backlink-l1-l2.md) | MISSING_BACKLINK L1->L2 por metacaractere: `]` no title (3× 261109, curado CLI PR #21) + REABERTO 261110 porta MM (RED provava COMMIT sujo) — FECHADO 261110 chokepoint PR #22 / release 0.1.17 (`e7a7bfb`), confirmação owner; ressalva gerador MM roteada ao TRACKER dex-PPIRTV | integrado | P1 | — |
| [ISSUE-LOCAL-0002](issues/0002-assertsafeancestors-audita-acima-do-boundary.md) | `assertSafeAncestors` audita territorio ACIMA do boundary: workspace sob junction (`C:\DeepProjetos` -> `Z:`) bloqueia `v2 remember scope=project`; FECHADO 261111 guard escopado ao boundary PR #23 / release 0.1.18 (`d6c1449`), TOCTOU preservado; TRACKER versionado no mesmo corte | integrado | P1 | — |
| [ISSUE-LOCAL-0003](issues/0003-autoria-schemas.md) | docs: ligar remember aos schemas de entrada e recibo — FECHADO 261118: cura `4f5a58f` (janela codex), aceite conferido 3/3 pela janela dona (links no clone + ids nos schemas + teste 5/5); GitHub #26 CLOSED | integrado | P2 | — |
| [ISSUE-LOCAL-0004](issues/0004-gate-projecoes-blobs.md) | gate de projeções: blobs dos mapas recalculados em todo commit — FECHADO 261118 PR #27 `896fc7b` / release v0.1.19 (RED→GREEN e2e + drift real do SKILL.md pego na 1ª execução); GitHub #20 CLOSED | integrado | P1 | — |
| [ISSUE-LOCAL-0005](issues/0005-npm-publish-e401.md) | npm publish: registry travado em 0.1.5 — DESCONTINUADO por decisão do dono 261119 (canal npm encerrado; distribuição = releases GitHub) | rejeitado | P2 | — |
| [ISSUE-LOCAL-0006](issues/0006-github28-merge-check-ciclo-de-vida.md) | GitHub #28: pre-merge-commit com premissa MERGE_HEAD falsa (merge automático sem gate; resolução manual sem suíte; hooks sem +x) — FECHADO 261121 PR #30 `6627c66` / release v0.1.20 com Git real; irmão CRG WinError2 → code-review-graph 0006 | integrado | P1 | — |
| [ISSUE-LOCAL-0007](issues/0007-github29-digest-playbook-crlf.md) | GitHub #29: digest do PLAYBOOK assinava working copy CRLF em vez da forma canônica LF — FECHADO 261121 PR #30 `6627c66` / release v0.1.20 (--check verde em CRLF e LF) | integrado | P2 | — |
| [ISSUE-LOCAL-0008](issues/0008-github10-reconciliacao-recovery.md) | GitHub #10: reconciliação dos 8 findings da adversarial do PR #8 (F1/F2/F3/F5/F8 pagos 0.1.11-0.1.15; F4 doc tríade + F6 teste dual E2E + F7 guidance recover 2º nível) — FECHADO 261122 PR #31 / release v0.1.21 | integrado | P2 | — |

Registros: criado em 2026-11-09 no bootstrap do TRACKER (1º item — piloto da plaquinha `ISSUES-POR-REPO-DONO`; skill dona do formato: `dex-gerar-issues-git` modo offline).
