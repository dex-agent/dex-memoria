import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { rememberMemory, FAILURE_CURES, CURE_PRECEDENCE, MODE_BY_BUCKET } = require("../bin/memory-v2-remember.js");
const repoRoot = join(process.cwd());
const schemaPath = join(repoRoot, "contracts", "schemas", "dex.memory.remember.receipt.v2.schema.json");

async function disposableRoots(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-schema-instance-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "consumer");
  const memoryHome = join(root, "memory-home");
  return { workspace, memoryHome };
}

function emitRecovery(t, roots, routeResult) {
  return rememberMemory({
    scope: "global",
    title: "Entrada de validacao de instancia",
    trigger: "Quando o receipt emitido precisa casar com o schema publicado",
    body: "O gate valida closed-set por nivel: campo emitido sem declaracao reprova.",
    tags: ["#dex-memoria/schema-instancia"]
  }, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() { return routeResult; }
  }).then((receipt) => receipt.recovery);
}

// Gate de instancia (alcance declarado): closed-set por nivel — toda chave emitida
// em recovery/actions/command_input deve estar declarada no properties do schema.
// Nao e um validador Draft 2020-12 completo; pega a classe paga pelo P1 do 0.1.9
// (campo emitido que o schema fechado rejeita).
function assertClosedSet(instance, schemaNode, label) {
  if (!schemaNode || schemaNode.additionalProperties !== false || !schemaNode.properties) return;
  const declared = new Set(Object.keys(schemaNode.properties));
  for (const key of Object.keys(instance)) {
    assert.ok(
      declared.has(key),
      `${label}: campo emitido "${key}" nao esta declarado no schema publicado (duas verdades codigo x schema)`
    );
  }
}

function recoverySchemaVariant(schema, mode) {
  const variant = schema.properties.recovery.oneOf.find(
    (node) => node.type === "object" && node.properties?.mode?.enum?.includes(mode)
  );
  assert.ok(variant, `schema deve declarar o mode ${mode}`);
  return variant;
}

test("schema instance gate: emitted recovery receipts match the published schema", async (t) => {
  const roots = await disposableRoots(t);
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));

  // Cases DERIVADOS da fonte unica FAILURE_CURES (issue #14 C-01): os MODOS saem
  // de MODE_BY_BUCKET — nenhuma lista literal; bucket sem mode (ou mode sem
  // case, ou mode fora do enum do schema) reprova com mensagem util.
  const byMode = new Map();
  for (const [code, cure] of Object.entries(FAILURE_CURES)) {
    const mode = MODE_BY_BUCKET[cure.bucket];
    assert.ok(mode, `FAILURE_CURES.${code}: bucket "${cure.bucket}" sem mode em MODE_BY_BUCKET — taxonomia incompleta`);
    if (!byMode.has(mode)) byMode.set(mode, code);
  }
  byMode.set("manual_resolution", "CASE_COLLISION");
  const expectedModes = [...new Set([...Object.values(MODE_BY_BUCKET), "manual_resolution"])];
  for (const mode of expectedModes) {
    assert.ok(byMode.has(mode), `mode "${mode}" sem code de exemplo derivado da tabela`);
  }
  const declaredModes = schema.properties.recovery.oneOf
    .flatMap((node) => node.properties?.mode?.enum ?? []);
  assert.deepEqual(
    [...declaredModes].sort(),
    [...expectedModes].sort(),
    "enum do schema deve casar exatamente com MODE_BY_BUCKET + manual (duas verdades codigo x schema)"
  );
  // Vacinas do 0.1.14 (issue #16): as TRES tabelas da fonte unica vacinadas —
  // bucket novo sem precedencia (ou duplicado) reprova aqui, nao em producao.
  const buckets = [...new Set(Object.values(FAILURE_CURES).map((cure) => cure.bucket))];
  for (const bucket of buckets) {
    assert.equal(
      CURE_PRECEDENCE.filter((candidate) => candidate === bucket).length,
      1,
      `bucket "${bucket}" deve aparecer em CURE_PRECEDENCE exatamente 1x (probe WAIT do issue #16)`
    );
  }
  const declaredCures = schema.properties.recovery.oneOf
    .find((node) => node.type === "object")
    ?.properties?.actions?.items?.properties?.cure?.enum ?? [];
  assert.deepEqual(
    [...declaredCures].sort(),
    [...new Set([...buckets, "UNCLASSIFIED"])].sort(),
    "enum cure do schema deve ser exatamente os buckets de FAILURE_CURES + UNCLASSIFIED"
  );
  const MESSAGES = {
    recover_then_retry_new_operation: "transaction is DESTINATION_PUBLISHED; recover before retry",
    retry_new_operation: "transaction was rolled back; use a new operation_id",
    retry_same_operation: "route mutex is held by another writer",
    manual_resolution: "multiple case-equivalent L1 files"
  };
  const cases = expectedModes.map((mode) => ({ mode, route: { status: "FAILED", code: byMode.get(mode), message: MESSAGES[mode] ?? "synthetic failure" } }));

  for (const testCase of cases) {
    const recovery = await emitRecovery(t, roots, testCase.route);
    assert.equal(recovery.mode, testCase.mode);
    const variant = recoverySchemaVariant(schema, testCase.mode);
    assertClosedSet(recovery, variant, `recovery[${testCase.mode}]`);
    const actionSchema = variant.properties.actions.items;
    const action = recovery.actions.find((entry) => entry.scope === "global");
    assertClosedSet(action, actionSchema, `action[${testCase.mode}]`);
    if (action.command_input) {
      assertClosedSet(action.command_input, actionSchema.properties.command_input, `command_input[${testCase.mode}]`);
    }
  }
});

test("schema instance gate: failed route receipts match the operation receipt schema", async (t) => {
  const roots = await disposableRoots(t);
  const operationSchema = JSON.parse(await readFile(join(repoRoot, "contracts", "schemas", "dex.memory.operation.receipt.v2.schema.json"), "utf8"));
  const routeReceiptItem = operationSchema.properties.route_receipts.additionalProperties;

  const receipt = await rememberMemory({
    scope: "global",
    title: "Entrada de validacao route receipts",
    trigger: "Quando a rota falha e o route receipt precisa casar com o schema",
    body: "O gate varre o nivel route_receipts.",
    tags: ["#dex-memoria/schema-instancia"]
  }, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() { return { status: "FAILED", code: "RECOVERY_REQUIRED", message: "transaction is PREPARED; recover before retry" }; }
  });

  for (const routeReceipt of Object.values(receipt.route_receipts)) {
    assertClosedSet(routeReceipt, routeReceiptItem, "route_receipt");
  }
});

test("schema instance gate: synthetic undeclared field is rejected (gate sensitivity)", async () => {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const variant = recoverySchemaVariant(schema, "manual_resolution");
  const actionSchema = variant.properties.actions.items;
  const rogueAction = { scope: "global", failure_code: "CASE_COLLISION", command: null, bogus_field: "x" };
  assert.throws(
    () => assertClosedSet(rogueAction, actionSchema, "rogue"),
    /bogus_field/,
    "o gate deve rejeitar campo emitido sem declaracao — sensibilidade provada"
  );
});

test("schema instance gate: retry_same allOf branch appears exactly once", async () => {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const variant = recoverySchemaVariant(schema, "retry_same_operation");
  const count = variant.allOf.filter(
    (node) => node.if?.properties?.mode?.const === "retry_same_operation"
  ).length;
  assert.equal(
    count,
    1,
    `allOf de retry_same_operation deve aparecer exatamente 1 vez (encontrado ${count} — duplicacao byte-a-byte do 0.1.12, issue #14)`
  );
});

test("contract_revision no receipt root discrimina a revisao do contrato (issue #16)", async (t) => {
  const roots = await disposableRoots(t);
  const receipt = await rememberMemory({
    scope: "global",
    title: "Entrada de revisao de contrato",
    trigger: "Quando o consumidor precisa discriminar receipt pre/pos-cure por maquina",
    body: "rev2 = cure nas actions; rev1 = implicito antes do 0.1.13.",
    tags: ["#dex-memoria/contract-revision"]
  }, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() { return { status: "FAILED", code: "CASE_COLLISION", message: "multiple case-equivalent L1 files" }; }
  });
  assert.equal(receipt.contract_revision, 2, "receipt root emite contract_revision (rev2 = cure)");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.ok(schema.properties.contract_revision, "schema deve declarar contract_revision no root");
  assert.ok(
    (schema.required ?? []).includes("contract_revision"),
    "contract_revision deve ser required no root do schema"
  );
});
