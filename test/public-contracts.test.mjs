import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import createContractValidator from "../scripts/validate-create-contracts.js";

const { SCHEMA_FILES, validateCreateContractSchemas } = createContractValidator;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const schemaRoot = join(repoRoot, "contracts", "schemas");

async function readSchema(file) {
  return JSON.parse(await readFile(join(schemaRoot, file), "utf8"));
}

async function readCreateContractSchemas() {
  return new Map(await Promise.all(SCHEMA_FILES.map(async (file) => [file, await readSchema(file)])));
}

function mutateSchemas(schemas, file, mutate) {
  const copy = new Map([...schemas].map(([name, schema]) => [name, structuredClone(schema)]));
  mutate(copy.get(file));
  return copy;
}

function assertClosedObject(schema, required) {
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), [...required].sort());
}

test("public create input schemas mirror the closed runtime limits", async () => {
  const request = await readSchema("dex.memory.create.request.v0.schema.json");
  const recover = await readSchema("dex.memory.create.recover.v0.schema.json");

  for (const schema of [request, recover]) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  }

  assertClosedObject(request, ["contract", "operation", "idempotency_key", "candidate"]);
  assert.equal(request.properties.contract.const, "dex.memory.create.request.v0");
  assert.equal(request.properties.operation.const, "create");
  assert.deepEqual(request.properties.idempotency_key, {
    type: "string",
    minLength: 1,
    maxLength: 256,
    pattern: "\\S"
  });
  assertClosedObject(request.properties.candidate, ["localizer", "trigger", "title", "anchor", "body"]);
  assert.deepEqual(request.properties.candidate.properties.localizer, {
    type: "string",
    minLength: 1,
    maxLength: 128,
    pattern: "^[A-Z0-9]+(?:-[A-Z0-9]+)*$"
  });
  assert.deepEqual(request.properties.candidate.properties.trigger, {
    type: "string",
    minLength: 1,
    maxLength: 512,
    pattern: "\\S"
  });
  assert.deepEqual(request.properties.candidate.properties.title, {
    type: "string",
    minLength: 1,
    maxLength: 256,
    pattern: "\\S"
  });
  assert.deepEqual(request.properties.candidate.properties.anchor, {
    type: "string",
    minLength: 1,
    maxLength: 128,
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
  });
  assert.deepEqual(request.properties.candidate.properties.body, {
    type: "string",
    minLength: 1,
    maxLength: 65536,
    pattern: "\\S"
  });

  assertClosedObject(recover, ["contract", "idempotency_key"]);
  assert.equal(recover.properties.contract.const, "dex.memory.create.recover.v0");
  assert.deepEqual(recover.properties.idempotency_key, request.properties.idempotency_key);
});

test("public create output schemas close every emitted plan, receipt and error field", async () => {
  const plan = await readSchema("dex.memory.create.plan.v0.schema.json");
  const receipt = await readSchema("dex.memory.create.receipt.v0.schema.json");
  const error = await readSchema("dex.memory.error.v0.schema.json");

  for (const schema of [plan, receipt, error]) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  }

  assertClosedObject(plan, [
    "contract",
    "operation",
    "idempotency_key",
    "request",
    "request_fingerprint",
    "transaction_id",
    "targets",
    "plan_hash"
  ]);
  assert.equal(plan.properties.contract.const, "dex.memory.create.plan.v0");
  assert.equal(plan.properties.operation.const, "create");
  assert.deepEqual(plan.properties.request, { $ref: "dex.memory.create.request.v0.schema.json" });
  assert.equal(plan.properties.request_fingerprint.pattern, "^[a-f0-9]{64}$");
  assert.equal(plan.properties.transaction_id.pattern, "^[a-f0-9]{24}$");
  assert.equal(plan.properties.plan_hash.pattern, "^[a-f0-9]{64}$");
  assert.equal(plan.properties.targets.minItems, 2);
  assert.equal(plan.properties.targets.maxItems, 2);
  assert.equal(plan.properties.targets.items, false);
  assert.deepEqual(plan.properties.targets.prefixItems.map((target) => target.properties.slot.const), ["l1", "l2"]);
  for (const target of plan.properties.targets.prefixItems) {
    assertClosedObject(target, [
      "slot",
      "relative_path",
      "before_exists",
      "before_sha256",
      "before_base64",
      "after_sha256",
      "after_base64",
      "changed"
    ]);
    assert.equal(target.properties.relative_path.maxLength, 256);
    assert.equal(target.properties.before_sha256.pattern, "^[a-f0-9]{64}$");
    assert.equal(target.properties.after_sha256.pattern, "^[a-f0-9]{64}$");
    assert.equal(target.properties.before_base64.pattern, target.properties.after_base64.pattern);
  }

  assertClosedObject(receipt, [
    "contract",
    "command",
    "status",
    "transaction_id",
    "idempotency_key",
    "request_fingerprint",
    "plan_hash",
    "writes",
    "journal_state",
    "recovery_required"
  ]);
  assert.equal(receipt.properties.contract.const, "dex.memory.create.receipt.v0");
  assert.equal(receipt.properties.recovery_required.const, false);
  assert.deepEqual(receipt.oneOf.map((variant) => [
    variant.properties.command.const,
    variant.properties.status.const,
    variant.properties.journal_state.const
  ]), [
    ["apply", "COMMITTED", "COMMITTED"],
    ["apply", "ALREADY_COMMITTED", "COMMITTED"],
    ["recover", "ROLLED_BACK", "ROLLED_BACK"],
    ["recover", "ALREADY_ROLLED_BACK", "ROLLED_BACK"],
    ["recover", "ALREADY_COMMITTED", "COMMITTED"]
  ]);

  assertClosedObject(error, ["contract", "code", "message"]);
  assert.equal(error.properties.contract.const, "dex.memory.error.v0");
  assert.deepEqual(error.properties.code.enum, [
    "INVALID_USAGE",
    "INVALID_JSON",
    "INVALID_SCHEMA",
    "SAFETY_BLOCKED",
    "PLAN_CONFLICT",
    "IDEMPOTENCY_CONFLICT",
    "JOURNAL_CONFLICT",
    "TRANSACTION_ROLLED_BACK",
    "RECOVERY_REQUIRED",
    "FAILPOINT_UNAVAILABLE",
    "RECOVERY_CONFLICT",
    "IO_FAILURE"
  ]);
  assert.deepEqual(error.properties.message, { type: "string", minLength: 1, pattern: "\\S" });
});

test("fixture control and internal checkpoint schemas match persisted objects", async () => {
  const marker = await readSchema("dex.memory.disposable-run.v1.schema.json");
  const manifest = await readSchema("dex.memory.fixture.legacy-create-l1-l2.v1.schema.json");
  const checkpoint = await readSchema("dex.memory.create.checkpoint.internal.v0.schema.json");

  for (const schema of [marker, manifest, checkpoint]) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  }

  assertClosedObject(marker, ["contract", "operation", "disposable", "targets"]);
  assert.equal(marker.properties.contract.const, "dex.memory.disposable-run.v1");
  assert.equal(marker.properties.operation.const, "create");
  assert.equal(marker.properties.disposable.const, true);

  assertClosedObject(manifest, ["contract", "operation", "disposable_runs_only", "targets"]);
  assert.equal(manifest.properties.contract.const, "dex.memory.fixture.legacy-create-l1-l2.v1");
  assert.equal(manifest.properties.operation.const, "create");
  assert.equal(manifest.properties.disposable_runs_only.const, true);

  for (const control of [marker, manifest]) {
    assert.equal(control.properties.targets.minItems, 2);
    assert.equal(control.properties.targets.maxItems, 2);
    assert.equal(control.properties.targets.items, false);
    assert.deepEqual(control.properties.targets.prefixItems.map((item) => item.const), [
      "work/LEMBRANCA.md",
      "work/MEMORIA.md"
    ]);
  }

  assert.equal(checkpoint.oneOf.length, 4);
  const byState = Object.fromEntries(checkpoint.oneOf.map((variant) => [variant.properties.state.const, variant]));
  assert.deepEqual(Object.keys(byState).sort(), ["COMMITTED", "L1_PUBLISHED", "PREPARED", "ROLLED_BACK"]);
  assertClosedObject(byState.PREPARED, [
    "state",
    "transaction_id",
    "idempotency_key",
    "request_fingerprint",
    "plan_hash",
    "plan"
  ]);
  assert.equal(byState.PREPARED.properties.plan.$ref, "dex.memory.create.plan.v0.schema.json");
  assertClosedObject(byState.L1_PUBLISHED, ["state", "transaction_id"]);
  assertClosedObject(byState.COMMITTED, ["state", "transaction_id", "plan_hash"]);
  assertClosedObject(byState.ROLLED_BACK, ["state", "transaction_id"]);
});

test("shared public validator rejects incompatible mutations inside every contract family", async () => {
  const schemas = await readCreateContractSchemas();
  assert.deepEqual(validateCreateContractSchemas(schemas), []);

  const cases = [
    {
      name: "request body limit",
      file: "dex.memory.create.request.v0.schema.json",
      mutate: (schema) => { schema.properties.candidate.properties.body.maxLength = 65537; }
    },
    {
      name: "recover idempotency limit",
      file: "dex.memory.create.recover.v0.schema.json",
      mutate: (schema) => { schema.properties.idempotency_key.maxLength = 257; }
    },
    {
      name: "plan embedded request reference",
      file: "dex.memory.create.plan.v0.schema.json",
      mutate: (schema) => { schema.properties.request.$ref = "other.schema.json"; }
    },
    {
      name: "plan target closed object",
      file: "dex.memory.create.plan.v0.schema.json",
      mutate: (schema) => { schema.properties.targets.prefixItems[0].additionalProperties = true; }
    },
    {
      name: "plan target slot",
      file: "dex.memory.create.plan.v0.schema.json",
      mutate: (schema) => { schema.properties.targets.prefixItems[1].properties.slot.const = "l3"; }
    },
    {
      name: "plan payload pattern",
      file: "dex.memory.create.plan.v0.schema.json",
      mutate: (schema) => { schema.properties.targets.prefixItems[0].properties.before_base64.pattern = ".*"; }
    },
    {
      name: "receipt writes cardinality",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.writes.maxItems = 3; }
    },
    {
      name: "receipt writes closed tail",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.writes.items = {}; }
    },
    {
      name: "receipt write slot",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.writes.prefixItems[1].properties.slot.const = "l3"; }
    },
    {
      name: "receipt write required fields",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.writes.prefixItems[0].required.pop(); }
    },
    {
      name: "receipt write closed object",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.writes.prefixItems[1].additionalProperties = true; }
    },
    {
      name: "receipt write path limit",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.writes.prefixItems[0].properties.relative_path.maxLength = 999; }
    },
    {
      name: "receipt write hash pattern",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.writes.prefixItems[1].properties.after_sha256.pattern = ".*"; }
    },
    {
      name: "receipt status variant",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.oneOf[3].properties.journal_state.const = "COMMITTED"; }
    },
    {
      name: "receipt status enum",
      file: "dex.memory.create.receipt.v0.schema.json",
      mutate: (schema) => { schema.properties.status.enum.push("UNKNOWN"); }
    },
    {
      name: "error code enum",
      file: "dex.memory.error.v0.schema.json",
      mutate: (schema) => { schema.properties.code.enum[0] = "UNKNOWN"; }
    },
    {
      name: "disposable marker target",
      file: "dex.memory.disposable-run.v1.schema.json",
      mutate: (schema) => { schema.properties.targets.prefixItems[0].const = "work/OTHER.md"; }
    },
    {
      name: "fixture manifest closed object",
      file: "dex.memory.fixture.legacy-create-l1-l2.v1.schema.json",
      mutate: (schema) => { schema.additionalProperties = true; }
    },
    {
      name: "checkpoint prepared required fields",
      file: "dex.memory.create.checkpoint.internal.v0.schema.json",
      mutate: (schema) => { schema.oneOf[0].required.pop(); }
    },
    {
      name: "checkpoint prepared plan reference",
      file: "dex.memory.create.checkpoint.internal.v0.schema.json",
      mutate: (schema) => { schema.oneOf[0].properties.plan.$ref = "other.schema.json"; }
    },
    {
      name: "checkpoint committed hash pattern",
      file: "dex.memory.create.checkpoint.internal.v0.schema.json",
      mutate: (schema) => { schema.oneOf[2].properties.plan_hash.pattern = ".*"; }
    },
    {
      name: "checkpoint published transaction pattern",
      file: "dex.memory.create.checkpoint.internal.v0.schema.json",
      mutate: (schema) => { schema.oneOf[1].properties.transaction_id.pattern = ".*"; }
    },
    {
      name: "checkpoint rolled back closed object",
      file: "dex.memory.create.checkpoint.internal.v0.schema.json",
      mutate: (schema) => { schema.oneOf[3].additionalProperties = true; }
    }
  ];

  for (const mutation of cases) {
    const errors = validateCreateContractSchemas(mutateSchemas(schemas, mutation.file, mutation.mutate));
    assert.ok(errors.length > 0, `${mutation.name} was accepted by the shared public validator`);
  }
});
