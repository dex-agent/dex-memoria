# CLI Create Fixture V0

Esta e a referencia canonica da fronteira executavel V0 de `dex-memoria`.
Ela preserva a V1 documental e adiciona somente `create` L1+L2 no layout
`legacy-v1`, sobre uma fixture temporaria marcada como descartavel. Nao e um
writer geral, nao aceita o vault vivo e nao integra consumidores em producao.

## Comandos E Streams

```text
dex-memoria create plan    --fixture <fixture-root>
dex-memoria create apply   --fixture <fixture-root>
dex-memoria create recover --fixture <fixture-root>
```

- `stdin`: exatamente um documento JSON UTF-8, com no maximo 1 MiB;
- sucesso: um JSON em `stdout`, newline final e `stderr` vazio;
- falha: `stdout` vazio, um `dex.memory.error.v0` em `stderr`, newline final e
  exit code nao zero;
- logs e texto humano nunca entram em `stdout` desses comandos;
- `--fixture` e argumento operacional; requests nao aceitam paths internos;
- `plan` le `dex.memory.create.request.v0` e nao altera a fixture;
- `apply` le o `dex.memory.create.plan.v0` completo;
- `recover` le `dex.memory.create.recover.v0`.

Exemplo sanitizado de request:

```json
{
  "contract": "dex.memory.create.request.v0",
  "operation": "create",
  "idempotency_key": "fixture:example:001",
  "candidate": {
    "localizer": "EXAMPLE-CREATE-L1-L2",
    "trigger": "open the example memory",
    "title": "Example create L1 and L2",
    "anchor": "example-create-l1-l2",
    "body": "Sanitized fixture-only example."
  }
}
```

Exemplo sanitizado de recovery:

```json
{
  "contract": "dex.memory.create.recover.v0",
  "idempotency_key": "fixture:example:001"
}
```

## Limites Do Request

| Campo | Limite e sintaxe |
| --- | --- |
| `idempotency_key` | 1..256 code points, com ao menos um caractere nao branco |
| `candidate.localizer` | 1..128, uppercase ASCII, numeros e hifens |
| `candidate.trigger` | 1..512, com ao menos um caractere nao branco |
| `candidate.title` | 1..256, com ao menos um caractere nao branco |
| `candidate.anchor` | 1..128, lowercase kebab-case ASCII |
| `candidate.body` | 1..65536, com ao menos um caractere nao branco |

Campos desconhecidos sao recusados. O owner renderiza os blocos Markdown; o
request nao recebe `path`, `target`, `workspace`, `memory_home`, nomes de
arquivo nem bytes.

## Schemas

Todos usam JSON Schema Draft 2020-12 e ficam em `contracts/schemas/`:

- [`dex.memory.create.request.v0`](../contracts/schemas/dex.memory.create.request.v0.schema.json)
- [`dex.memory.create.recover.v0`](../contracts/schemas/dex.memory.create.recover.v0.schema.json)
- [`dex.memory.create.plan.v0`](../contracts/schemas/dex.memory.create.plan.v0.schema.json)
- [`dex.memory.create.receipt.v0`](../contracts/schemas/dex.memory.create.receipt.v0.schema.json)
- [`dex.memory.error.v0`](../contracts/schemas/dex.memory.error.v0.schema.json)
- marker [`dex.memory.disposable-run.v1`](../contracts/schemas/dex.memory.disposable-run.v1.schema.json)
- manifest [`dex.memory.fixture.legacy-create-l1-l2.v1`](../contracts/schemas/dex.memory.fixture.legacy-create-l1-l2.v1.schema.json)
- checkpoint interno
  [`dex.memory.create.checkpoint.internal.v0`](../contracts/schemas/dex.memory.create.checkpoint.internal.v0.schema.json)

`plan` e `receipt` mantem a ordem `l1`, depois `l2`. O plan contem bytes base64,
hashes SHA-256, fingerprints e `plan_hash`; nao contem timestamp nem path
absoluto. O receipt usa `command=apply|recover`, estados terminais e
`recovery_required=false`.

## Marker, Manifest E Destinos

O root precisa conter dois documentos fechados, sem campos extras:

```json
{
  "contract": "dex.memory.disposable-run.v1",
  "operation": "create",
  "disposable": true,
  "targets": ["work/LEMBRANCA.md", "work/MEMORIA.md"]
}
```

```json
{
  "contract": "dex.memory.fixture.legacy-create-l1-l2.v1",
  "operation": "create",
  "disposable_runs_only": true,
  "targets": ["work/LEMBRANCA.md", "work/MEMORIA.md"]
}
```

O marker vive em `.dex-memory-fixture.json`; o manifest, em `manifest.json`.
Os dois targets sao literais, ordenados, allowlisted e resolvidos dentro do
root real. Root, controles, targets e journal nao podem escapar por symlink ou
reparse point. Use uma copia temporaria da fixture publica; nunca use um vault,
workspace vivo ou diretorio de consumidor como `--fixture`.

## Journal E Recovery

`apply` grava checkpoints JSON imutaveis sob
`journal/<transaction_id>/`, em sequencia contigua:

```text
PREPARED -> L1_PUBLISHED -> COMMITTED
    |              |
    +--------------+-> ROLLED_BACK
```

- `PREPARED` guarda identificadores, `plan_hash` e o plan completo;
- `L1_PUBLISHED` prova que L1 foi publicada e L2 ainda nao;
- `COMMITTED` encerra apply com o par publicado;
- `ROLLED_BACK` encerra recovery no baseline B0;
- uma segunda recovery terminal nao cria novo checkpoint;
- `recover` nunca desfaz `COMMITTED`.

## Failpoints De Teste

```text
FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT
FP_AFTER_L1_CHECKPOINT_BEFORE_L2
```

Os failpoints sao internos, somente para fixture e processo filho controlado
por IPC. O controlador espera o sinal de readiness e aplica hard kill. Um
processo morto nao promete JSON final, `stderr` ou exit code portatil. Fora
desse harness, pedir failpoint falha antes do journal e das escritas.

## Exit Codes

| Code | Significado |
| ---: | --- |
| `0` | sucesso, noop idempotente ou recovery terminal conhecida |
| `2` | uso, UTF-8, JSON ou schema invalido |
| `3` | marker, manifest, allowlist, symlink ou path bloqueado |
| `4` | plan, drift, idempotencia ou recovery em conflito |
| `5` | journal nao terminal exige `recover` antes de novo `apply` |
| `6` | I/O, erro interno sanitizado ou failpoint sem controlador |

## Riscos nao cobertos

- perda fisica de energia, fsync de diretorio e cache de disco;
- disco cheio, antivirus, ACL/permissao e encodings fora de UTF-8;
- crash durante o proprio recovery;
- concorrencia multi-processo ou multi-host, volume e performance;
- L3, layout V2, vault vivo e demais operacoes de memoria;
- API de biblioteca, MCP, daemon, banco, release e integracao de producao.
