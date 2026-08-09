"use strict";

const { isDeepStrictEqual } = require("node:util");

const DRAFT = "https://json-schema.org/draft/2020-12/schema";
const HASH_64 = "^[a-f0-9]{64}$";
const TRANSACTION_ID = "^[a-f0-9]{24}$";
const BASE64 = "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$";
const TARGET_PATHS = ["work/LEMBRANCA.md", "work/MEMORIA.md"];

const SCHEMA_FILES = [
  "dex.memory.layout.v1.schema.json",
  "dex.memory.routes.inspect.v0.schema.json",
  "dex.memory.create.theme-v2.request.v0.schema.json",
  "dex.memory.create.theme-v2.plan.v0.schema.json",
  "dex.memory.fixture.governed-theme-v2-plan.v0.schema.json",
  "dex.memory.fixture.governed-theme-v2-transaction.v0.schema.json",
  "dex.memory.create.theme-v2.recover.v0.schema.json",
  "dex.memory.create.theme-v2.receipt.v0.schema.json",
  "dex.memory.create.theme-v2.checkpoint.internal.v0.schema.json",
  "dex.memory.create.request.v0.schema.json",
  "dex.memory.create.recover.v0.schema.json",
  "dex.memory.create.plan.v0.schema.json",
  "dex.memory.create.receipt.v0.schema.json",
  "dex.memory.error.v0.schema.json",
  "dex.memory.disposable-run.v1.schema.json",
  "dex.memory.fixture.legacy-create-l1-l2.v1.schema.json",
  "dex.memory.create.checkpoint.internal.v0.schema.json",
  "dex.memory.validate-root.request.v2.schema.json",
  "dex.memory.capability.receipt.v2.schema.json"
];

const idempotencyKey = stringSchema({ minLength: 1, maxLength: 256, pattern: "\\S" });
const relativePath = stringSchema({ minLength: 1, maxLength: 256, pattern: "\\S" });
const hash64 = stringSchema({ pattern: HASH_64 });
const transactionId = stringSchema({ pattern: TRANSACTION_ID });
const base64 = stringSchema({ pattern: BASE64 });
const stringListSchema = { type: "array", items: { type: "string", minLength: 1 } };
const capabilityErrorItem = closedObject({
  code: stringSchema({ minLength: 1 }),
  message: stringSchema({ minLength: 1 })
});
const capabilityFileItem = closedObject({
  path: stringSchema({ minLength: 1 }),
  sha256: hash64,
  tags: { type: "array", items: { type: "string", minLength: 1 } }
});
const capabilityEvidence = closedObject({
  root: stringSchema({ minLength: 1 }),
  files: { type: "array", items: capabilityFileItem },
  block_ids: stringListSchema,
  markdown_links: stringListSchema,
  wikilinks: stringListSchema,
  backlinks: stringListSchema,
  required_backlinks: stringListSchema,
  unresolved_markdown_links: stringListSchema,
  unresolved_wikilinks: stringListSchema
});

const planTargetFields = {
  slot: null,
  relative_path: relativePath,
  before_exists: { type: "boolean" },
  before_sha256: hash64,
  before_base64: base64,
  after_sha256: hash64,
  after_base64: base64,
  changed: { type: "boolean" }
};

const receiptWriteFields = {
  slot: null,
  relative_path: relativePath,
  before_sha256: hash64,
  after_sha256: hash64,
  changed: { type: "boolean" }
};

const EXPECTED = {
  "dex.memory.routes.inspect.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "$defs"],
    structure: {
      title: "dex.memory.routes.inspect.v0",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.layout.v1.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"],
    structure: {
      title: "dex.memory.layout.v1",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.create.theme-v2.request.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "oneOf"],
    structure: {
      title: "dex.memory.create.theme-v2.request.v0",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.create.theme-v2.plan.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "$defs"],
    structure: {
      title: "dex.memory.create.theme-v2.plan.v0",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.fixture.governed-theme-v2-plan.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"],
    structure: {
      title: "dex.memory.fixture.governed-theme-v2-plan.v0",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.fixture.governed-theme-v2-transaction.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"],
    structure: {
      title: "dex.memory.fixture.governed-theme-v2-transaction.v0",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.create.theme-v2.recover.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"],
    structure: {
      title: "dex.memory.create.theme-v2.recover.v0",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.create.theme-v2.receipt.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "$defs", "oneOf"],
    structure: {
      title: "dex.memory.create.theme-v2.receipt.v0",
      type: "object",
      additionalProperties: false
    }
  },
  "dex.memory.create.theme-v2.checkpoint.internal.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "unevaluatedProperties", "oneOf", "$defs"],
    structure: {
      title: "dex.memory.create.theme-v2.checkpoint.internal.v0",
      type: "object",
      unevaluatedProperties: false
    }
  },
  "dex.memory.create.request.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "examples"],
    structure: closedObject({
      contract: { const: "dex.memory.create.request.v0" },
      operation: { const: "create" },
      idempotency_key: idempotencyKey,
      candidate: closedObject({
        localizer: stringSchema({ minLength: 1, maxLength: 128, pattern: "^[A-Z0-9]+(?:-[A-Z0-9]+)*$" }),
        trigger: stringSchema({ minLength: 1, maxLength: 512, pattern: "\\S" }),
        title: stringSchema({ minLength: 1, maxLength: 256, pattern: "\\S" }),
        anchor: stringSchema({ minLength: 1, maxLength: 128, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
        body: stringSchema({ minLength: 1, maxLength: 65536, pattern: "\\S" })
      })
    })
  },
  "dex.memory.create.recover.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "examples"],
    structure: closedObject({
      contract: { const: "dex.memory.create.recover.v0" },
      idempotency_key: idempotencyKey
    })
  },
  "dex.memory.create.plan.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"],
    structure: closedObject({
      contract: { const: "dex.memory.create.plan.v0" },
      operation: { const: "create" },
      idempotency_key: idempotencyKey,
      request: { $ref: "dex.memory.create.request.v0.schema.json" },
      request_fingerprint: hash64,
      transaction_id: transactionId,
      targets: fixedTuple([
        closedObject({ ...planTargetFields, slot: { const: "l1" } }),
        closedObject({ ...planTargetFields, slot: { const: "l2" } })
      ]),
      plan_hash: hash64
    })
  },
  "dex.memory.create.receipt.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "oneOf"],
    structure: {
      ...closedObject({
        contract: { const: "dex.memory.create.receipt.v0" },
        command: { enum: ["apply", "recover"] },
        status: { enum: ["COMMITTED", "ALREADY_COMMITTED", "ROLLED_BACK", "ALREADY_ROLLED_BACK"] },
        transaction_id: transactionId,
        idempotency_key: idempotencyKey,
        request_fingerprint: hash64,
        plan_hash: hash64,
        writes: fixedTuple([
          closedObject({ ...receiptWriteFields, slot: { const: "l1" } }),
          closedObject({ ...receiptWriteFields, slot: { const: "l2" } })
        ]),
        journal_state: { enum: ["COMMITTED", "ROLLED_BACK"] },
        recovery_required: { const: false }
      }),
      oneOf: [
        receiptVariant("apply", "COMMITTED", "COMMITTED"),
        receiptVariant("apply", "ALREADY_COMMITTED", "COMMITTED"),
        receiptVariant("recover", "ROLLED_BACK", "ROLLED_BACK"),
        receiptVariant("recover", "ALREADY_ROLLED_BACK", "ROLLED_BACK"),
        receiptVariant("recover", "ALREADY_COMMITTED", "COMMITTED")
      ]
    }
  },
  "dex.memory.error.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "examples"],
    structure: closedObject({
      contract: { const: "dex.memory.error.v0" },
      code: { enum: [
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
      ] },
      message: stringSchema({ minLength: 1, pattern: "\\S" })
    })
  },
  "dex.memory.disposable-run.v1.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "examples"],
    structure: disposableControlSchema()
  },
  "dex.memory.fixture.legacy-create-l1-l2.v1.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "examples"],
    structure: controlSchema("dex.memory.fixture.legacy-create-l1-l2.v1", "disposable_runs_only")
  },
  "dex.memory.create.checkpoint.internal.v0.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "oneOf"],
    structure: {
      oneOf: [
        checkpointVariant("PREPARED", {
          transaction_id: transactionId,
          idempotency_key: idempotencyKey,
          request_fingerprint: hash64,
          plan_hash: hash64,
          plan: { $ref: "dex.memory.create.plan.v0.schema.json" }
        }),
        checkpointVariant("L1_PUBLISHED", { transaction_id: transactionId }),
        checkpointVariant("COMMITTED", { transaction_id: transactionId, plan_hash: hash64 }),
        checkpointVariant("ROLLED_BACK", { transaction_id: transactionId })
      ]
    }
  },
  "dex.memory.validate-root.request.v2.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"],
    structure: closedObject({
      capability: { enum: ["legacy-obsidian", "v2-markdown", "v2-obsidian"] },
      require_obsidian: { type: "boolean" },
      root: stringSchema({ minLength: 1 })
    })
  },
  "dex.memory.capability.receipt.v2.schema.json": {
    allowedKeys: ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"],
    structure: {
      type: "object",
      additionalProperties: false,
      required: ["contract", "capability", "require_obsidian", "ok", "errors"],
      properties: {
        contract: { const: "dex.memory.capability.receipt.v2" },
        capability: { enum: ["legacy-obsidian", "v2-markdown", "v2-obsidian"] },
        require_obsidian: { type: "boolean" },
        expected_require_obsidian: { type: "boolean" },
        ok: { type: "boolean" },
        errors: { type: "array", items: capabilityErrorItem },
        resolved_root: stringSchema({ minLength: 1 }),
        touched_files: { type: "array", items: capabilityFileItem },
        evidence: capabilityEvidence
      }
    }
  }
};

function stringSchema(limits) {
  return { type: "string", ...limits };
}

function closedObject(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}

function fixedTuple(prefixItems) {
  return {
    type: "array",
    minItems: prefixItems.length,
    maxItems: prefixItems.length,
    prefixItems,
    items: false
  };
}

function receiptVariant(command, status, journalState) {
  return {
    properties: {
      command: { const: command },
      status: { const: status },
      journal_state: { const: journalState }
    }
  };
}

function controlSchema(contract, disposableField) {
  return closedObject({
    contract: { const: contract },
    operation: { const: "create" },
    [disposableField]: { const: true },
    targets: fixedTuple(TARGET_PATHS.map((target) => ({ const: target })))
  });
}

function disposableControlSchema() {
  return closedObject({
    contract: { const: "dex.memory.disposable-run.v1" },
    operation: { const: "create" },
    disposable: { const: true },
    targets: {
      oneOf: [
        fixedTuple(TARGET_PATHS.map((target) => ({ const: target }))),
        {
          type: "array",
          minItems: 1,
          maxItems: 1,
          items: {
            type: "string",
            pattern: "^work/[a-z0-9]+(?:-[a-z0-9]+)*$"
          }
        }
      ]
    }
  });
}

function checkpointVariant(state, fields) {
  return closedObject({ state: { const: state }, ...fields });
}

function validateCreateContractSchemas(schemas) {
  const errors = [];

  for (const file of SCHEMA_FILES) {
    const schema = schemas.get(file);
    if (!schema) {
      errors.push(`${file}: schema is missing`);
      continue;
    }

    assertDeepEqual(errors, `${file} top-level keys`, Object.keys(schema).sort(), EXPECTED[file].allowedKeys.slice().sort());
    assertDeepEqual(errors, `${file} draft`, schema.$schema, DRAFT);

    for (const [keyword, expected] of Object.entries(EXPECTED[file].structure)) {
      assertDeepEqual(errors, `${file} ${keyword}`, schema[keyword], expected);
    }
  }

  return errors;
}

function assertDeepEqual(errors, label, actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) {
    errors.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

module.exports = {
  SCHEMA_FILES,
  validateCreateContractSchemas
};
