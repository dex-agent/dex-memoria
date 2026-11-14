# Dependências — dex-memoria (arqueologia 2026-11-05)

## 3rd-party (2 colunas)

| Declarado no package.json | Efetivamente importado (fechamento W3) |
| --- | --- |
| (vazio — zero dependencies/devDependencies) | zero deps npm — apenas builtins: path, fs, crypto, fs/promises, child_process, os, util |

Licença do pacote: MIT. Lockfile: ausente (pendência P3 `LOCKFILE-AUSENTE-ZERO-DEPS`).

## Grafo interno (ASCII, arestas require relativo)

```text
                        ┌──────────────────────────────┐
                        │ bin/dex-memoria.js (CLI)     │  fan-out 8
                        └──┬────┬────┬────┬────┬───┬───┘
        ┌──────────────────┘    │    │    │    │   └──────────────┐
        ▼                       ▼    │    ▼    ▼                  ▼
 create-plan ◄─┐           create-apply │ memory-v2-      memory-v2-     cli-doc
   stableJson  │             ▲     │    │ runtime-core    route-executor
        │      │             │     │    │      ▲              │    ▲
        │   create-theme-v2-transaction    │      │              ▼    │
        │      (requer create-plan)        │      │         memory-v2-capabilities
        │                                    │      │
        │   create-recover ──► create-apply,│◄─────┘
        │        create-journal ◄─┘         │
        │                                    │
        └── memory-v2-remember ─────────────┘ (requer runtime-core + route-executor)

 scripts/validate-public ──► validate-create-contracts
 scripts/validate-public ──► generate-memory-resource-limit-artifacts
 scripts/compare-memory-resource-limits-shadow ──► generate-memory-resource-limit-artifacts
 scripts/run-*-fixture (3) ──► compare-memory-resource-limits-shadow

 test/*.mjs (ESM, createRequire) ──► bin/* e scripts/* (vide grafo W3 do laudo)
```

- Fronteira de módulos: `bin|scripts` = CJS (`type: commonjs`); `test/*.mjs` = ESM
  com ponte `createRequire(import.meta.url)`; imports dinâmicos: 4, lazy, só testes.
- Hubs fan-in: create-plan(4), runtime-core(4), route-executor(5),
  capabilities(4). DAG sem ciclos.
- Grafos canônicos: CRG `.code-review-graph/graph.db` (326 Function/40 File/6 Class;
  8.127 arestas) + `graphify-out/graph.json` (1.666 nós estruturais).
