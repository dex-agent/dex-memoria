import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { rememberMemory } = require("../bin/memory-v2-remember.js");
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
  const variant = schema.properties.recovery.oneOf.find((node) => node.type === "object");
  assert.ok(variant.properties.mode.enum.includes(mode), `schema deve declarar o mode ${mode}`);
  return variant;
}

test("schema instance gate: emitted recovery receipts match the published schema", async (t) => {
  const roots = await disposableRoots(t);
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));

  const cases = [
    { mode: "recover_then_retry_new_operation", route: { status: "FAILED", code: "RECOVERY_REQUIRED", message: "transaction is DESTINATION_PUBLISHED; recover before retry" } },
    { mode: "retry_new_operation", route: { status: "FAILED", code: "TRANSACTION_ROLLED_BACK", message: "transaction was rolled back; use a new operation_id" } },
    { mode: "retry_same_operation", route: { status: "FAILED", code: "ROUTE_BUSY", message: "route mutex is held by another writer" } },
    { mode: "manual_resolution", route: { status: "FAILED", code: "CASE_COLLISION", message: "multiple case-equivalent L1 files" } }
  ];

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
