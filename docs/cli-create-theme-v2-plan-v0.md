# CLI `create plan` para `governed-theme-v2`

Este contrato é uma bancada `fixture-only` de planejamento. Ele prova bytes e
rotas `L1 -> L2 OU L1 -> L3`, mas mantém o perfil
`governed-theme-v2` como `approved_not_active`.

O corte não implementa apply, journal ou recover V2, não migra memória, não
altera consumidores e não aceita o vault vivo. `legacy-v1` continua sendo o
único `active_write_profile`.

## Comando

```powershell
$request | ConvertTo-Json -Depth 8 -Compress |
  node bin/dex-memoria.js create plan --fixture <fixture-descartavel>
```

Sucesso escreve exatamente um documento JSON em `stdout`. Falha mantém
`stdout` vazio e escreve um `dex.memory.error.v0` sanitizado em `stderr`.

## Fixture descartável

A raiz precisa conter:

```text
.dex-memory-fixture.json
manifest.json
work/<tema>/
├── lembranca.md
├── memorias/
│   └── INDEX.md
└── conhecimento/
    └── INDEX.md
```

O marcador usa `dex.memory.disposable-run.v1` e aponta somente para
`work/<tema>`. O manifest usa
`dex.memory.fixture.governed-theme-v2-plan.v0`, declara um único tema e fixa
`target_layer` como `L2` ou `L3`. Raízes, controles, destinos ou componentes
alcançados por symlink/reparse point são bloqueados.

## Request

Contrato: `dex.memory.create.theme-v2.request.v0`.

Campos comuns:

- `profile: governed-theme-v2` e `operation: create`;
- `idempotency_key` com até 256 caracteres;
- `identity` UUID v4 canônico lowercase fornecido pelo caller;
- `target_layer: L2 | L3`;
- `route_decision: explicit-l2-memory | explicit-l3-knowledge`, coerente com
  `target_layer`;
- `slug` ASCII lowercase kebab-case, até 80 caracteres;
- `trigger` até 512, `title` até 256 e `body` até 65.536 caracteres;
- `created_at` RFC 3339 UTC canônico com milissegundos.

L3 exige `owner_skill` sintaticamente válido com até 128 caracteres. Este corte
não consulta o catálogo de skills e não cria waiver.

O request não aceita paths, filename, root, campos desconhecidos, classificação
automática de densidade nem inferência por idade ou reuso.

## Plan

Contrato: `dex.memory.create.theme-v2.plan.v0`.

O plan contém bytes e SHA-256 `before`/`after` de exatamente três targets:

- L2: `lembranca.md`, `memorias/INDEX.md`, `memorias/<slug>.md`;
- L3: `lembranca.md`, `conhecimento/INDEX.md`,
  `conhecimento/<slug>/README.md`.

`serialization_order_only: true` significa apenas ordem canônica do array. Não
é ordem futura de publicação e o payload não possui `publish_order`.

L1 recebe um link Markdown relativo e metadata estrutural canônica
`dex.memory.route.v1`. O INDEX é uma projeção derivada. O destino usa front
matter fechado, UTF-8/LF, `updated_at = created_at`,
`last_reused_at = null`, `reuse_count = 0` e backlink direto para L1.

O plan é determinístico e não cria arquivo, diretório, temporário ou journal.
Duas execuções sobre o mesmo request e os mesmos bytes devem produzir `stdout`
e `plan_hash` idênticos.

## Recusas fechadas

- slug/identity já existente, inclusive colisão casefold cruzada L2/L3:
  `PLAN_CONFLICT`, exit `4`;
- schema, limite, rota ou nome reservado inválido: `INVALID_SCHEMA`, exit `2`;
- fixture ou path inseguro: `SAFETY_BLOCKED`, exit `3`;
- erro inesperado de I/O: `IO_FAILURE`, exit `6`.

Enviar um plan V2 para `create apply` ou `create recover` falha com
`INVALID_SCHEMA` antes de qualquer journal ou mutação.
