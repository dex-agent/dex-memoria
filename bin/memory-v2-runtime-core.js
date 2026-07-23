"use strict";

const path = require("path");
const { createHash } = require("crypto");

const SCOPES = Object.freeze(["project", "global", "theme", "dual"]);
const ROUTE_SCOPES = Object.freeze(["project", "global", "theme"]);
const PROFILES = Object.freeze(["legacy-v1"]);

class MemoryRuntimeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.exitCode = 2;
  }
}

function resolveMemoryRoutes(request) {
  validateOperationRequest(request);
  const projectRoute = () => ({
    scope: "project",
    resolved_root: path.resolve(request.workspace_root, ".agents")
  });
  const globalRoute = () => ({
    scope: "global",
    resolved_root: path.resolve(request.memory_home, "global")
  });

  if (request.scope === "project") return [projectRoute()];
  if (request.scope === "global") return [globalRoute()];
  if (request.scope === "dual") return [projectRoute(), globalRoute()];
  return [{
    scope: "theme",
    theme: request.theme,
    resolved_root: path.resolve(request.memory_home, "temas", request.theme)
  }];
}

function planMemoryOperation(request) {
  const routes = resolveMemoryRoutes(request).map((route) => {
    const routeIdentity = `${request.operation_id}:${route.scope}`;
    return {
      ...route,
      operation_id: request.operation_id,
      idempotency_key: `dex-memoria:${routeIdentity}`,
      transaction_id: digest(`transaction:${routeIdentity}`, 24),
      receipt_id: digest(`receipt:${routeIdentity}`, 24)
    };
  });

  const plan = {
    contract: "dex.memory.operation.plan.v2",
    implementation_version: request.implementation_version,
    requested_scope: request.scope,
    operation_id: request.operation_id,
    routes
  };
  if (request.profile !== undefined) plan.compatibility_profile = request.profile;
  return plan;
}

async function coordinateMemoryOperation(plan, executeRoute) {
  validatePlan(plan);
  requireExecutor(executeRoute);
  const routeReceipts = {};

  for (const route of plan.routes) {
    const result = await executeRoute(Object.freeze({ ...route }));
    routeReceipts[route.scope] = normalizeExecutionResult(route, result);
  }

  return createCoordinatorReceipt(plan, routeReceipts);
}

async function resumePendingSibling(receipt, executeRoute) {
  validateCoordinatorReceipt(receipt);
  requireExecutor(executeRoute);
  if (receipt.status !== "PARTIAL_PENDING") {
    throw new MemoryRuntimeError("INVALID_RESUME_STATE", "resume_pending_sibling requires PARTIAL_PENDING");
  }

  const pendingRoutes = receipt.routes.filter((route) => receipt.route_receipts[route.scope].status === "PENDING");
  if (pendingRoutes.length !== 1) {
    throw new MemoryRuntimeError("INVALID_RESUME_STATE", "PARTIAL_PENDING must identify exactly one pending sibling");
  }

  const routeReceipts = structuredClone(receipt.route_receipts);
  const pendingRoute = pendingRoutes[0];
  const result = await executeRoute(Object.freeze({ ...pendingRoute }));
  routeReceipts[pendingRoute.scope] = normalizeExecutionResult(pendingRoute, result);

  return createCoordinatorReceipt(receipt, routeReceipts);
}

function assertCoordinatorReceiptMatchesPlan(receipt, plan) {
  validateCoordinatorReceipt(receipt);
  validatePlan(plan);

  const receiptProfile = receipt.compatibility_profile ?? null;
  const planProfile = plan.compatibility_profile ?? null;
  if (
    receipt.implementation_version !== plan.implementation_version ||
    receiptProfile !== planProfile ||
    receipt.requested_scope !== plan.requested_scope ||
    receipt.operation_id !== plan.operation_id ||
    receipt.routes.length !== plan.routes.length
  ) {
    throw new MemoryRuntimeError("RECEIPT_PLAN_MISMATCH", "coordinator receipt does not belong to the canonical operation plan");
  }

  const identityFields = [
    "scope",
    "theme",
    "resolved_root",
    "operation_id",
    "idempotency_key",
    "transaction_id",
    "receipt_id"
  ];
  for (let index = 0; index < plan.routes.length; index += 1) {
    const receiptRoute = receipt.routes[index];
    const planRoute = plan.routes[index];
    if (identityFields.some((field) => (receiptRoute[field] ?? null) !== (planRoute[field] ?? null))) {
      throw new MemoryRuntimeError("RECEIPT_PLAN_MISMATCH", "coordinator receipt route does not match the canonical operation plan");
    }
  }
}

function normalizeExecutionResult(route, result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new MemoryRuntimeError("INVALID_ROUTE_RECEIPT", "route executor must return a receipt object");
  }
  if (result.status === "FAILED") {
    return {
      scope: route.scope,
      resolved_root: route.resolved_root,
      operation_id: route.operation_id,
      idempotency_key: route.idempotency_key,
      transaction_id: route.transaction_id,
      receipt_id: route.receipt_id,
      status: "PENDING",
      failure_code: typeof result.code === "string" ? result.code : "ROUTE_EXECUTION_FAILED",
      ...(typeof result.cause_code === "string" ? { failure_cause: result.cause_code } : {})
    };
  }
  if (result.status !== "COMMITTED") {
    throw new MemoryRuntimeError("INVALID_ROUTE_RECEIPT", "route receipt status must be COMMITTED or FAILED");
  }
  for (const field of ["transaction_id", "idempotency_key", "receipt_id"]) {
    if (result[field] !== route[field]) {
      throw new MemoryRuntimeError("CROSS_SCOPE_CREDIT", `route receipt ${field} does not belong to ${route.scope}`);
    }
  }
  requireNonEmptyString(result.receipt_path, "receipt_path", "INVALID_ROUTE_RECEIPT");
  requireNonEmptyString(result.write_set_hash, "write_set_hash", "INVALID_ROUTE_RECEIPT");
  requireNonEmptyString(result.validation_receipt_path, "validation_receipt_path", "INVALID_ROUTE_RECEIPT");
  requireNonEmptyString(result.validation_receipt_hash, "validation_receipt_hash", "INVALID_ROUTE_RECEIPT");
  requireSha256(result.candidate_id, "candidate_id", "INVALID_ROUTE_RECEIPT");
  requireSha256(result.content_hash, "content_hash", "INVALID_ROUTE_RECEIPT");
  requireSha256(result.route_identity, "route_identity", "INVALID_ROUTE_RECEIPT");
  if (result.validation_contract !== "dex.memory.capability.unit-receipt.v2" || result.validation_ok !== true) {
    throw new MemoryRuntimeError("INVALID_ROUTE_RECEIPT", "committed route requires a successful unit validation receipt");
  }
  const producerProvenance = validateOptionalProducerProvenance(result, "INVALID_ROUTE_RECEIPT");
  const normalized = {
    scope: route.scope,
    resolved_root: route.resolved_root,
    operation_id: route.operation_id,
    idempotency_key: route.idempotency_key,
    transaction_id: route.transaction_id,
    receipt_id: route.receipt_id,
    status: "COMMITTED",
    receipt_path: result.receipt_path,
    validation_receipt_path: result.validation_receipt_path,
    validation_receipt_hash: result.validation_receipt_hash,
    validation_contract: result.validation_contract,
    validation_ok: result.validation_ok,
    candidate_id: result.candidate_id,
    content_hash: result.content_hash,
    route_identity: result.route_identity,
    deduplicated: result.deduplicated === true,
    write_set_hash: result.write_set_hash
  };
  if (producerProvenance) {
    normalized.receipt_revision = 2;
    normalized.producer_provenance = producerProvenance;
  }
  return normalized;
}

function createCoordinatorReceipt(planLike, routeReceipts) {
  const routes = planLike.routes.map((route) => ({ ...route }));
  const statuses = routes.map((route) => routeReceipts[route.scope]?.status);
  const committedCount = statuses.filter((status) => status === "COMMITTED").length;
  const pendingCount = statuses.filter((status) => status === "PENDING").length;
  let status = "FAILED";
  if (committedCount === routes.length) status = "COMMITTED";
  else if (committedCount > 0 && pendingCount > 0) status = "PARTIAL_PENDING";

  const receipt = {
    contract: "dex.memory.operation.receipt.v2",
    implementation_version: planLike.implementation_version,
    requested_scope: planLike.requested_scope,
    operation_id: planLike.operation_id,
    status,
    recovery_mode: status === "PARTIAL_PENDING" ? "resume_pending_sibling" : null,
    routes,
    route_receipts: routeReceipts
  };
  if (planLike.compatibility_profile !== undefined) {
    receipt.compatibility_profile = planLike.compatibility_profile;
  }
  validateCoordinatorReceipt(receipt);
  return receipt;
}

function validateOperationRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new MemoryRuntimeError("INVALID_OPERATION_REQUEST", "operation request must be an object");
  }
  if (request.contract !== "dex.memory.operation.request.v2") {
    throw new MemoryRuntimeError("INVALID_OPERATION_REQUEST", "unsupported operation request contract");
  }
  if (request.implementation_version !== "v2") {
    throw new MemoryRuntimeError("INVALID_IMPLEMENTATION_VERSION", "implementation_version must be v2");
  }
  if (!SCOPES.includes(request.scope)) {
    throw new MemoryRuntimeError("INVALID_SCOPE", "scope must be project, global, theme or dual");
  }
  if (request.profile === "governed-theme-v2") {
    throw new MemoryRuntimeError("HISTORICAL_WRAPPER_ONLY", "governed-theme-v2 is owned by the preserved historical fixture wrappers");
  }
  if (request.profile !== undefined && !PROFILES.includes(request.profile)) {
    throw new MemoryRuntimeError("INVALID_PROFILE", "profile is not recognized");
  }
  const allowedKeys = ["contract", "implementation_version", "memory_home", "operation_id", "profile", "scope", "theme", "workspace_root"];
  const unknownKeys = Object.keys(request).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new MemoryRuntimeError("INVALID_OPERATION_REQUEST", `operation request contains unknown fields: ${unknownKeys.join(", ")}`);
  }
  requireAbsolutePath(request.workspace_root, "workspace_root");
  requireAbsolutePath(request.memory_home, "memory_home");
  requireNonEmptyString(request.operation_id, "operation_id", "INVALID_OPERATION_REQUEST");
  if ([...request.operation_id].length > 256) {
    throw new MemoryRuntimeError("INVALID_OPERATION_REQUEST", "operation_id exceeds 256 code points");
  }
  if (request.scope === "theme") {
    requireNonEmptyString(request.theme, "theme", "INVALID_OPERATION_REQUEST");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.theme)) {
      throw new MemoryRuntimeError("INVALID_THEME", "theme must use lowercase kebab-case");
    }
  } else if (request.theme !== undefined) {
    throw new MemoryRuntimeError("INVALID_THEME", "theme is accepted only when scope=theme");
  }
}

function validatePlan(plan) {
  if (!plan || plan.contract !== "dex.memory.operation.plan.v2" || !Array.isArray(plan.routes)) {
    throw new MemoryRuntimeError("INVALID_OPERATION_PLAN", "operation plan contract is invalid");
  }
  if (
    plan.implementation_version !== "v2" ||
    (plan.compatibility_profile !== undefined && !PROFILES.includes(plan.compatibility_profile)) ||
    !SCOPES.includes(plan.requested_scope)
  ) {
    throw new MemoryRuntimeError("INVALID_OPERATION_PLAN", "operation plan metadata is invalid");
  }
  const expectedScopes = plan.requested_scope === "dual" ? ["project", "global"] : [plan.requested_scope];
  if (plan.routes.length !== expectedScopes.length || plan.routes.some((route, index) => route.scope !== expectedScopes[index])) {
    throw new MemoryRuntimeError("INVALID_OPERATION_PLAN", "operation plan routes do not match requested scope");
  }
  validateRouteIdentities(plan.operation_id, plan.routes);
}

function validateCoordinatorReceipt(receipt) {
  if (!receipt || receipt.contract !== "dex.memory.operation.receipt.v2" || !Array.isArray(receipt.routes)) {
    throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "coordinator receipt contract is invalid");
  }
  if (
    receipt.implementation_version !== "v2" ||
    (receipt.compatibility_profile !== undefined && !PROFILES.includes(receipt.compatibility_profile)) ||
    !SCOPES.includes(receipt.requested_scope)
  ) {
    throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "coordinator receipt metadata is invalid");
  }
  validateRouteIdentities(receipt.operation_id, receipt.routes);
  const expectedScopes = receipt.requested_scope === "dual" ? ["project", "global"] : [receipt.requested_scope];
  if (receipt.routes.length !== expectedScopes.length || !receipt.route_receipts || typeof receipt.route_receipts !== "object") {
    throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "coordinator receipt routes are invalid");
  }
  for (const route of receipt.routes) {
    const routeReceipt = receipt.route_receipts[route.scope];
    if (!routeReceipt) {
      throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", `missing ${route.scope} route receipt`);
    }
    for (const field of ["scope", "resolved_root", "operation_id", "idempotency_key", "transaction_id", "receipt_id"]) {
      if (routeReceipt[field] !== route[field]) {
        throw new MemoryRuntimeError("CROSS_SCOPE_CREDIT", `${route.scope} receipt ${field} belongs to another route`);
      }
    }
    if (routeReceipt.status === "COMMITTED") {
      requireNonEmptyString(routeReceipt.receipt_path, "receipt_path", "INVALID_COORDINATOR_RECEIPT");
      requireNonEmptyString(routeReceipt.write_set_hash, "write_set_hash", "INVALID_COORDINATOR_RECEIPT");
      requireNonEmptyString(routeReceipt.validation_receipt_path, "validation_receipt_path", "INVALID_COORDINATOR_RECEIPT");
      requireNonEmptyString(routeReceipt.validation_receipt_hash, "validation_receipt_hash", "INVALID_COORDINATOR_RECEIPT");
      requireSha256(routeReceipt.candidate_id, "candidate_id", "INVALID_COORDINATOR_RECEIPT");
      requireSha256(routeReceipt.content_hash, "content_hash", "INVALID_COORDINATOR_RECEIPT");
      requireSha256(routeReceipt.route_identity, "route_identity", "INVALID_COORDINATOR_RECEIPT");
      if (routeReceipt.validation_contract !== "dex.memory.capability.unit-receipt.v2" || routeReceipt.validation_ok !== true) {
        throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "route validation receipt is missing or unsuccessful");
      }
      validateOptionalProducerProvenance(routeReceipt, "INVALID_COORDINATOR_RECEIPT");
    } else if (routeReceipt.status === "PENDING") {
      if (Object.hasOwn(routeReceipt, "receipt_revision") || Object.hasOwn(routeReceipt, "producer_provenance")) {
        throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "pending route cannot claim producer provenance");
      }
    } else {
      throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "route receipt status is invalid");
    }
  }
  const routeStatuses = receipt.routes.map((route) => receipt.route_receipts[route.scope].status);
  const committedCount = routeStatuses.filter((status) => status === "COMMITTED").length;
  const pendingCount = routeStatuses.filter((status) => status === "PENDING").length;
  const expectedStatus = committedCount === receipt.routes.length
    ? "COMMITTED"
    : committedCount > 0 && pendingCount > 0
      ? "PARTIAL_PENDING"
      : "FAILED";
  if (receipt.status !== expectedStatus) {
    throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "coordinator status does not match route receipts");
  }
  const expectedRecoveryMode = expectedStatus === "PARTIAL_PENDING" ? "resume_pending_sibling" : null;
  if (receipt.recovery_mode !== expectedRecoveryMode) {
    throw new MemoryRuntimeError("INVALID_COORDINATOR_RECEIPT", "coordinator recovery_mode does not match status");
  }
  const committedPaths = receipt.routes
    .map((route) => receipt.route_receipts[route.scope])
    .filter((routeReceipt) => routeReceipt.status === "COMMITTED")
    .map((routeReceipt) => path.resolve(routeReceipt.receipt_path).toLowerCase());
  if (new Set(committedPaths).size !== committedPaths.length) {
    throw new MemoryRuntimeError("CROSS_SCOPE_CREDIT", "committed routes must not share one receipt path");
  }
}

function validateOptionalProducerProvenance(receipt, code) {
  const hasRevision = Object.hasOwn(receipt, "receipt_revision");
  const hasProvenance = Object.hasOwn(receipt, "producer_provenance");
  if (!hasRevision && !hasProvenance) return null;
  if (!hasRevision || !hasProvenance || receipt.receipt_revision !== 2) {
    throw new MemoryRuntimeError(code, "receipt revision 2 and producer provenance must appear together");
  }
  const provenance = receipt.producer_provenance;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    throw new MemoryRuntimeError(code, "producer provenance must be an object");
  }
  const keys = Object.keys(provenance).sort();
  if (keys.join("\0") !== ["entrypoint_realpath", "entrypoint_sha256"].join("\0")) {
    throw new MemoryRuntimeError(code, "producer provenance fields are invalid");
  }
  requireAbsolutePath(provenance.entrypoint_realpath, "entrypoint_realpath", code);
  requireSha256(provenance.entrypoint_sha256, "entrypoint_sha256", code);
  return {
    entrypoint_realpath: path.resolve(provenance.entrypoint_realpath),
    entrypoint_sha256: provenance.entrypoint_sha256
  };
}

function validateRouteIdentities(operationId, routes) {
  const identityFields = ["idempotency_key", "transaction_id", "receipt_id"];
  for (const route of routes) {
    if (!ROUTE_SCOPES.includes(route.scope) || route.operation_id !== operationId || !path.isAbsolute(route.resolved_root)) {
      throw new MemoryRuntimeError("INVALID_OPERATION_PLAN", "route metadata is invalid");
    }
    for (const field of identityFields) requireNonEmptyString(route[field], field, "INVALID_OPERATION_PLAN");
  }
  for (const field of identityFields) {
    if (new Set(routes.map((route) => route[field])).size !== routes.length) {
      throw new MemoryRuntimeError("CROSS_SCOPE_CREDIT", `${field} must be independent per route`);
    }
  }
  if (new Set(routes.map((route) => route.resolved_root.toLowerCase())).size !== routes.length) {
    throw new MemoryRuntimeError("CROSS_SCOPE_CREDIT", "resolved roots must be independent per route");
  }
}

function requireAbsolutePath(value, label, code = "INVALID_OPERATION_REQUEST") {
  requireNonEmptyString(value, label, code);
  if (!path.isAbsolute(value)) {
    throw new MemoryRuntimeError(code, `${label} must be absolute`);
  }
}

function requireNonEmptyString(value, label, code) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MemoryRuntimeError(code, `${label} must be a non-empty string`);
  }
}

function requireSha256(value, label, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new MemoryRuntimeError(code, `${label} must be a lowercase SHA-256`);
  }
}

function requireExecutor(executeRoute) {
  if (typeof executeRoute !== "function") {
    throw new MemoryRuntimeError("INVALID_EXECUTOR", "route executor must be a function");
  }
}

function digest(value, length) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

module.exports = {
  MemoryRuntimeError,
  assertCoordinatorReceiptMatchesPlan,
  coordinateMemoryOperation,
  planMemoryOperation,
  resolveMemoryRoutes,
  resumePendingSibling
};
