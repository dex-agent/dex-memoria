"use strict";

const os = require("os");
const path = require("path");
const { createHash } = require("crypto");
const {
  MemoryRuntimeError,
  coordinateMemoryOperation,
  planMemoryOperation
} = require("./memory-v2-runtime-core");
const { validateCandidate } = require("./memory-v2-route-executor");

const SCOPES = new Set(["project", "global", "theme", "dual"]);
const LAYERS = new Set(["L2", "L3"]);
const INPUT_KEYS = new Set([
  "body", "contract", "operation_id", "owner_skill", "scope", "slug",
  "tags", "target_layer", "theme", "title", "trigger"
]);

async function rememberMemory(input, options = {}) {
  const normalized = normalizeRememberRequest(input, options);
  const operationRequest = {
    contract: "dex.memory.operation.request.v2",
    implementation_version: "v2",
    scope: normalized.scope,
    workspace_root: normalized.workspace_root,
    memory_home: normalized.memory_home,
    operation_id: normalized.operation_id,
    ...(normalized.theme ? { theme: normalized.theme } : {})
  };
  const candidate = {
    contract: "dex.memory.write.candidate.v2",
    target_layer: normalized.target_layer,
    slug: normalized.slug,
    trigger: normalized.trigger,
    title: normalized.title,
    body: normalized.body,
    tags: normalized.tags,
    ...(normalized.owner_skill ? { owner_skill: normalized.owner_skill } : {})
  };
  validateCandidate(candidate);
  const plan = planMemoryOperation(operationRequest);
  const coordinator = await coordinateMemoryOperation(
    plan,
    (route) => options.execute_route(route, candidate, options.route_options || {})
  );
  const validations = Object.fromEntries(plan.routes.map((route) => {
    const receipt = coordinator.route_receipts[route.scope];
    return [route.scope, receipt.status === "COMMITTED" ? {
      contract: receipt.validation_contract,
      ok: receipt.validation_ok,
      receipt_path: receipt.validation_receipt_path,
      receipt_hash: receipt.validation_receipt_hash
    } : {
      contract: null,
      ok: false,
      failure_code: receipt.failure_code
    }];
  }));
  const committedReceipts = plan.routes.map((route) => coordinator.route_receipts[route.scope])
    .filter((receipt) => receipt.status === "COMMITTED");
  const pendingReceipts = plan.routes
    .map((route) => coordinator.route_receipts[route.scope])
    .filter((receipt) => receipt.status === "PENDING");
  const publicRequest = {
    contract: normalized.contract,
    scope: normalized.scope,
    target_layer: normalized.target_layer,
    slug: normalized.slug,
    operation_id: normalized.operation_id,
    workspace_root: normalized.workspace_root,
    memory_home: normalized.memory_home,
    ...(normalized.theme ? { theme: normalized.theme } : {}),
    ...(normalized.owner_skill ? { owner_skill: normalized.owner_skill } : {})
  };
  return {
    contract: "dex.memory.remember.receipt.v2",
    implementation_version: "v2",
    status: coordinator.status,
    operation_id: normalized.operation_id,
    request_fingerprint: digest(JSON.stringify(normalized)),
    candidate_id: committedReceipts[0]?.candidate_id || null,
    content_hash: committedReceipts[0]?.content_hash || null,
    normalized_request: publicRequest,
    routes: coordinator.routes,
    route_receipts: coordinator.route_receipts,
    validations,
    recovery: pendingReceipts.length > 0 ? recoveryGuidance(normalized, pendingReceipts) : null
  };
}

function recoveryGuidance(normalized, pendingReceipts) {
  const actions = pendingReceipts.map((receipt) => ({
    scope: receipt.scope,
    failure_code: receipt.failure_code,
    ...(receipt.failure_cause ? { failure_cause: receipt.failure_cause } : {}),
    command: ["RECOVERY_REQUIRED", "ROLLBACK_REQUIRED"].includes(receipt.failure_code)
      ? "dex-memoria v2 recover"
      : null
  }));
  const hasManual = actions.some((action) => ![
    "RECOVERY_REQUIRED", "ROLLBACK_REQUIRED", "TRANSACTION_ROLLED_BACK"
  ].includes(action.failure_code));
  const identity = actions.map((action) => `${action.scope}:${action.failure_code}`).join("|");
  const nextOperationId = `remember-retry-${digest(`${normalized.operation_id}:${identity}`).slice(0, 24)}`;
  const requiresNewOperation = actions.some((action) => [
    "RECOVERY_REQUIRED", "ROLLBACK_REQUIRED", "TRANSACTION_ROLLED_BACK"
  ].includes(action.failure_code));
  if (hasManual) return {
    mode: "manual_resolution",
    actions,
    ...(requiresNewOperation ? {
      then_command: "dex-memoria v2 remember",
      next_operation_id: nextOperationId
    } : {})
  };

  if (actions.some((action) => action.command === "dex-memoria v2 recover")) {
    return {
      mode: "recover_then_retry_new_operation",
      actions,
      then_command: "dex-memoria v2 remember",
      next_operation_id: nextOperationId
    };
  }
  return {
    mode: "retry_new_operation",
    actions,
    then_command: "dex-memoria v2 remember",
    next_operation_id: nextOperationId
  };
}

function normalizeRememberRequest(input, options = {}) {
  requireObject(input);
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.has(key));
  if (unknown.length > 0) invalid(`unknown fields: ${unknown.join(", ")}`);
  if (input.contract !== undefined && input.contract !== "dex.memory.remember.request.v2") {
    invalid("contract must be dex.memory.remember.request.v2");
  }
  if (!SCOPES.has(input.scope)) invalid("scope must be project, global, theme or dual");
  const targetLayer = input.target_layer === undefined ? "L2" : input.target_layer;
  if (!LAYERS.has(targetLayer)) invalid("target_layer must be L2 or L3");
  for (const field of ["title", "trigger", "body"]) requireText(input[field], field);
  if (!Array.isArray(input.tags) || input.tags.length === 0 || new Set(input.tags).size !== input.tags.length) {
    invalid("tags must be a non-empty unique array");
  }
  for (const tag of input.tags) {
    if (typeof tag !== "string" || !/^#[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(tag)) {
      invalid("tags must use nested lowercase form such as #dex-memoria/entrada");
    }
  }
  if (input.scope === "theme") {
    if (typeof input.theme !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.theme)) {
      invalid("theme is required for scope=theme and must use lowercase kebab-case");
    }
  } else if (input.theme !== undefined) invalid("theme is accepted only for scope=theme");
  if (targetLayer === "L3") requireText(input.owner_skill, "owner_skill");
  else if (input.owner_skill !== undefined) invalid("owner_skill is accepted only for target_layer=L3");

  const workspaceRoot = path.resolve(options.cwd || process.cwd());
  const memoryHome = path.resolve(options.memory_home || process.env.DEX_MEMORIA_HOME || path.join(os.homedir(), ".agents", "memories"));
  const semanticIdentity = {
    scope: input.scope,
    theme: input.theme || null,
    target_layer: targetLayer,
    title: input.title.trim(),
    trigger: input.trigger.trim(),
    body: input.body.trim(),
    tags: [...input.tags],
    owner_skill: input.owner_skill?.trim() || null,
    workspace_root: workspaceRoot,
    memory_home: memoryHome
  };
  const identityHash = digest(JSON.stringify(semanticIdentity));
  const slug = input.slug === undefined ? deriveSlug(input.title, identityHash) : validateSlug(input.slug);
  const operationId = input.operation_id === undefined ? `remember-${identityHash.slice(0, 24)}` : validateOperationId(input.operation_id);
  return {
    contract: "dex.memory.remember.request.v2",
    scope: input.scope,
    target_layer: targetLayer,
    title: semanticIdentity.title,
    trigger: semanticIdentity.trigger,
    body: semanticIdentity.body,
    tags: semanticIdentity.tags,
    slug,
    operation_id: operationId,
    workspace_root: workspaceRoot,
    memory_home: memoryHome,
    ...(input.theme ? { theme: input.theme } : {}),
    ...(input.owner_skill ? { owner_skill: input.owner_skill.trim() } : {})
  };
}

function deriveSlug(title, identityHash) {
  const base = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "memoria";
  return `${base.slice(0, 51).replace(/-+$/g, "") || "memoria"}-${identityHash.slice(0, 12)}`;
}

function validateSlug(value) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) invalid("slug must use lowercase kebab-case");
  return value;
}

function validateOperationId(value) {
  requireText(value, "operation_id");
  if ([...value].length > 256) invalid("operation_id exceeds 256 code points");
  return value;
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("request must be an object");
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) invalid(`${field} must be a non-empty string`);
}

function invalid(message) {
  throw new MemoryRuntimeError("INVALID_REMEMBER_REQUEST", message);
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

module.exports = { normalizeRememberRequest, rememberMemory };
