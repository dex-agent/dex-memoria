# CLI `create` V2 transacional em fixture

Este corte implementa uma transacao recuperavel com journal para o perfil
`governed-theme-v2`, que permanece `approved_not_active`. O suporte e
`fixture_only_experimental`: ele não ativa o V2, não migra memória e não aceita o vault vivo.

## Fronteira

- Operacao unica: `create`.
- Ambiente unico: `fixture-only`, marcado pelo manifest
  `dex.memory.fixture.governed-theme-v2-transaction.v0`.
- Roteamento: `L1 -> L2 OU L1 -> L3`.
- Ordem material de publicacao: `destination -> index -> l1`.
- Ordem canonica do array `writes` no recibo: `l1`, `index`, `destination`.
- A fixture `dex.memory.fixture.governed-theme-v2-plan.v0` continua plan-only e
  sem permissao de escrita.
- O perfil de escrita vivo continua sendo `legacy-v1`.

## Comandos e streams

Os tres comandos recebem um documento JSON completo pelo `stdin`. `plan`
produz exatamente um plano `dex.memory.create.theme-v2.plan.v0`; `apply` e
`recover` produzem exatamente um recibo
`dex.memory.create.theme-v2.receipt.v0`. A saida de sucesso vai para `stdout`.
Falha produz um erro JSON no `stderr`; diagnosticos nunca contaminam o
`stdout`.

```text
dex-memoria create plan --fixture <fixture-root> < request.json
dex-memoria create apply --fixture <fixture-root> < plan.json
dex-memoria create recover --fixture <fixture-root> < recover.json
```

`plan` recebe `dex.memory.create.theme-v2.request.v0`, valida o manifest da
fixture, congela o baseline e emite um plano deterministico sem I/O de
publicacao. `apply` recebe esse plano completo, revalida identidade, baseline e
precondicoes antes de criar o journal. `recover` recebe
`dex.memory.create.theme-v2.recover.v0`, localiza a transacao pela identidade
intrinseca e executa a recuperacao em outro processo.

O recibo fechado `dex.memory.create.theme-v2.receipt.v0` informa `command`,
`status`, `transaction_id`, `journal_state`, `publish_order` e os writes
esperados. A mesma `idempotency_key`, com a mesma identidade completa, nao
duplica conteudo. Uma identidade diferente que reutilize a chave resulta em
`IDEMPOTENCY_CONFLICT`.

## Journal e recuperacao

A maquina minima registra:

```text
PREPARED
  -> DESTINATION_PUBLISHED
  -> INDEX_PUBLISHED
  -> L1_PUBLISHED
  -> COMMITTED

PREPARED | *_PUBLISHED -> ROLLED_BACK
```

Uma transacao nao terminal encontrada por `apply` retorna
`RECOVERY_REQUIRED`; ela nunca e sobrescrita ou retomada silenciosamente.
`recover` faz preflight global antes da primeira restauracao e só restaura o
baseline quando arquivos, diretorios e temporarios correspondem ao checkpoint
mais recente. Recuperacao bem-sucedida retorna o status `ROLLED_BACK`.

Repetir `apply` depois de `COMMITTED` retorna `ALREADY_COMMITTED` sem publicar
novamente. Repetir `recover` depois de `ROLLED_BACK` retorna
`ALREADY_ROLLED_BACK` sem mutacao. Esses estados terminais sao no-op
idempotentes.

Checkpoints e targets usam temporario, sincronizacao e rename no mesmo
diretorio. O preflight rejeita drift manual, vetor impossivel, arquivo estranho
na pasta L3 e temporario com conteudo ou papel incompatível. O recovery deve
rodar em um processo novo; o hard kill experimental exige canal IPC para provar
que o failpoint foi alcancado.

## Failpoints

- `FP_AFTER_DESTINATION_DIRECTORY_CREATE_BEFORE_PUBLISH` — somente L3, depois
  de criar o diretorio do slug e antes de publicar `README.md`.
- `FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT`.
- `FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX`.
- `FP_AFTER_INDEX_PUBLISH_BEFORE_CHECKPOINT`.
- `FP_AFTER_INDEX_CHECKPOINT_BEFORE_L1`.
- `FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT`.
- `FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT`.

## Exit codes

| Codigo | Significado |
| --- | --- |
| `0` | plano ou recibo valido, incluindo no-op terminal |
| `2` | `INVALID_USAGE`, `INVALID_JSON` ou `INVALID_SCHEMA` |
| `3` | `SAFETY_BLOCKED` antes de mutacao autorizada |
| `4` | `PLAN_CONFLICT`, `JOURNAL_CONFLICT`, `RECOVERY_CONFLICT`, `IDEMPOTENCY_CONFLICT` ou `TRANSACTION_ROLLED_BACK` |
| `5` | `RECOVERY_REQUIRED` antes de novo apply |
| `6` | `FAILPOINT_UNAVAILABLE` ou falha de I/O sanitizada como `IO_FAILURE` |

O hard kill do failpoint termina de modo abrupto e, portanto, nao promete um
codigo portavel. A prova observa o sinal IPC e valida o recovery subsequente.

## Limites e riscos nao cobertos

O hash do plano detecta alteracao; nao e assinatura nem prova de autoria. Crash
durante a inicializacao do diretorio da transacao, falha de energia no meio do
recovery, durabilidade especifica do filesystem e concorrencia distribuida
permanecem riscos residuais. Esta bancada de create, isoladamente, nao prova
readers, Finder instalado, validators de producao,
shadow/no-shrink, migracao, cutover ou rollback do vault vivo. Ativacao,
consumidores e remocao de fallbacks exigem Trilhos e recibos humanos proprios.
