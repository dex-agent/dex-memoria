"use strict";

const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

class ApplyError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

const TEST_FAILPOINTS = new Set([
  "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT",
  "FP_AFTER_L1_CHECKPOINT_BEFORE_L2"
]);

async function applyCreate(plan, fixtureRoot, targetPaths, failpointControl = {}) {
  validatePlanSchema(plan);
  validatePlanIntegrity(plan);
  validateFailpointControl(failpointControl);
  assertJournalPathSafe(fixtureRoot);
  const expectedPaths = targetPaths.map((targetPath) => path.relative(fixtureRoot, targetPath).split(path.sep).join("/"));
  if (plan.targets.some((target, index) => target.relative_path !== expectedPaths[index])) {
    conflict("plan targets do not match fixture targets");
  }
  const prior = findJournalByIdempotencyKey(fixtureRoot, plan.idempotency_key);
  if (prior) {
    if (
      prior.prepared.request_fingerprint !== plan.request_fingerprint ||
      prior.prepared.plan_hash !== plan.plan_hash ||
      prior.prepared.transaction_id !== plan.transaction_id
    ) {
      throw new ApplyError(4, "IDEMPOTENCY_CONFLICT", "idempotency key already belongs to a different request or plan");
    }
    if (prior.latest.state === "COMMITTED") return createReceipt(plan, "ALREADY_COMMITTED");
    throw new ApplyError(5, "RECOVERY_REQUIRED", "transaction journal requires recovery before apply");
  }
  for (let index = 0; index < plan.targets.length; index += 1) {
    const target = plan.targets[index];
    const exists = fs.existsSync(targetPaths[index]);
    const bytes = exists ? fs.readFileSync(targetPaths[index]) : Buffer.alloc(0);
    if (exists !== target.before_exists || sha256(bytes) !== target.before_sha256) {
      conflict(`fixture target drifted for ${target.slot}`);
    }
  }
  const transactionRoot = path.join(fixtureRoot, "journal", plan.transaction_id);
  fs.mkdirSync(path.dirname(transactionRoot), { recursive: true });
  fs.mkdirSync(transactionRoot);
  writeCheckpoint(transactionRoot, "0001-PREPARED.json", {
    state: "PREPARED",
    transaction_id: plan.transaction_id,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    plan
  });

  await publishTarget(targetPaths[0], plan.targets[0], plan.transaction_id);
  await stopAtFailpoint(failpointControl, "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT", plan.transaction_id);
  writeCheckpoint(transactionRoot, "0002-L1_PUBLISHED.json", {
    state: "L1_PUBLISHED",
    transaction_id: plan.transaction_id
  });
  await stopAtFailpoint(failpointControl, "FP_AFTER_L1_CHECKPOINT_BEFORE_L2", plan.transaction_id);
  await publishTarget(targetPaths[1], plan.targets[1], plan.transaction_id);
  await verifyPublishedPair(targetPaths, plan.targets);
  writeCheckpoint(transactionRoot, "0003-COMMITTED.json", {
    state: "COMMITTED",
    transaction_id: plan.transaction_id,
    plan_hash: plan.plan_hash
  });

  return createReceipt(plan, "COMMITTED");
}

function validateFailpointControl(control) {
  if (!TEST_FAILPOINTS.has(control.name)) return;
  if (typeof control.send !== "function") {
    throw new ApplyError(6, "FAILPOINT_UNAVAILABLE", "requested test failpoint requires an IPC controller");
  }
}

async function stopAtFailpoint(control, expectedName, transactionId) {
  if (control.name !== expectedName) return;
  await new Promise((resolve, reject) => {
    control.send({
      contract: "dex.memory.test.failpoint.v0",
      failpoint: expectedName,
      pid: process.pid,
      transaction_id: transactionId
    }, (error) => error ? reject(error) : resolve());
  });
  await new Promise(() => {});
}

async function verifyPublishedPair(targetPaths, targets) {
  for (let index = 0; index < targets.length; index += 1) {
    const published = await fs.promises.readFile(targetPaths[index]);
    if (!published.equals(Buffer.from(targets[index].after_base64, "base64"))) {
      throw new Error("published target pair verification failed");
    }
  }
}

function assertJournalPathSafe(fixtureRoot) {
  const journalRoot = path.join(fixtureRoot, "journal");
  if (!fs.existsSync(journalRoot)) return;
  const stat = fs.lstatSync(journalRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) safetyBlocked("fixture journal path is invalid");
  const realRoot = fs.realpathSync(fixtureRoot);
  const realJournal = fs.realpathSync(journalRoot);
  const relative = path.relative(realRoot, realJournal);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    safetyBlocked("fixture journal path escapes root");
  }
}

function findJournalByIdempotencyKey(fixtureRoot, idempotencyKey) {
  const journalRoot = path.join(fixtureRoot, "journal");
  if (!fs.existsSync(journalRoot)) return null;
  const entries = fs.readdirSync(journalRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!/^[a-f0-9]{24}$/.test(entry.name)) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink()) safetyBlocked("fixture transaction journal path is invalid");
    const transactionRoot = path.join(journalRoot, entry.name);
    const checkpointNames = fs.readdirSync(transactionRoot, { withFileTypes: true })
      .filter((checkpoint) => /^\d{4}-(?:PREPARED|L1_PUBLISHED|COMMITTED|ROLLED_BACK)\.json$/.test(checkpoint.name))
      .map((checkpoint) => {
        if (!checkpoint.isFile() || checkpoint.isSymbolicLink()) safetyBlocked("fixture journal checkpoint path is invalid");
        return checkpoint.name;
      })
      .sort();
    if (checkpointNames.length === 0 || checkpointNames[0] !== "0001-PREPARED.json") continue;
    const prepared = JSON.parse(fs.readFileSync(path.join(transactionRoot, checkpointNames[0]), "utf8"));
    if (prepared.idempotency_key !== idempotencyKey) continue;
    const latest = JSON.parse(fs.readFileSync(path.join(transactionRoot, checkpointNames.at(-1)), "utf8"));
    return { prepared, latest };
  }
  return null;
}

function validatePlanSchema(plan) {
  requireExactKeys(plan, ["contract", "idempotency_key", "operation", "plan_hash", "request_fingerprint", "targets", "transaction_id"], "plan");
  if (plan.contract !== "dex.memory.create.plan.v0" || plan.operation !== "create") invalidSchema("unsupported plan contract or operation");
  requireString(plan.idempotency_key, "idempotency_key", 256);
  requireHash(plan.request_fingerprint, "request_fingerprint", 64);
  requireHash(plan.transaction_id, "transaction_id", 24);
  requireHash(plan.plan_hash, "plan_hash", 64);
  if (!Array.isArray(plan.targets) || plan.targets.length !== 2) invalidSchema("plan targets are invalid");
  plan.targets.forEach((target, index) => {
    requireExactKeys(target, ["after_base64", "after_sha256", "before_base64", "before_exists", "before_sha256", "changed", "relative_path", "slot"], `targets[${index}]`);
    if (target.slot !== (index === 0 ? "l1" : "l2")) invalidSchema("plan target slots are invalid");
    requireString(target.relative_path, `targets[${index}].relative_path`, 256);
    if (typeof target.before_exists !== "boolean" || typeof target.changed !== "boolean") invalidSchema("plan target flags are invalid");
    requireHash(target.before_sha256, `targets[${index}].before_sha256`, 64);
    requireHash(target.after_sha256, `targets[${index}].after_sha256`, 64);
    requireBase64(target.before_base64, `targets[${index}].before_base64`);
    requireBase64(target.after_base64, `targets[${index}].after_base64`);
  });
}

function validatePlanIntegrity(plan) {
  const { plan_hash: planHash, ...unsignedPlan } = plan;
  if (sha256(Buffer.from(stableJson(unsignedPlan))) !== planHash) conflict("plan hash does not match plan contents");
  const expectedTransactionId = sha256(Buffer.from(stableJson({
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    targets: plan.targets
  }))).slice(0, 24);
  if (plan.transaction_id !== expectedTransactionId) conflict("transaction id does not match plan contents");
  for (const target of plan.targets) {
    const before = Buffer.from(target.before_base64, "base64");
    const after = Buffer.from(target.after_base64, "base64");
    if (
      sha256(before) !== target.before_sha256 ||
      sha256(after) !== target.after_sha256 ||
      target.changed !== !before.equals(after) ||
      (!target.before_exists && before.length !== 0)
    ) {
      conflict(`plan target integrity failed for ${target.slot}`);
    }
  }
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidSchema(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) invalidSchema(`${label} contains missing or unknown fields`);
}

function requireString(value, label, maximum) {
  if (typeof value !== "string" || value.trim().length === 0 || [...value].length > maximum) invalidSchema(`${label} is invalid`);
}

function requireHash(value, label, length) {
  if (typeof value !== "string" || !new RegExp(`^[a-f0-9]{${length}}$`).test(value)) invalidSchema(`${label} is invalid`);
}

function requireBase64(value, label) {
  if (typeof value !== "string" || Buffer.from(value, "base64").toString("base64") !== value) invalidSchema(`${label} is invalid`);
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function invalidSchema(message) {
  throw new ApplyError(2, "INVALID_SCHEMA", message);
}

function conflict(message) {
  throw new ApplyError(4, "PLAN_CONFLICT", message);
}

function safetyBlocked(message) {
  throw new ApplyError(3, "SAFETY_BLOCKED", message);
}

function createReceipt(plan, status) {
  return {
    contract: "dex.memory.create.receipt.v0",
    command: "apply",
    status,
    transaction_id: plan.transaction_id,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    writes: plan.targets.map((target) => ({
      slot: target.slot,
      relative_path: target.relative_path,
      before_sha256: target.before_sha256,
      after_sha256: target.after_sha256,
      changed: target.changed
    })),
    journal_state: "COMMITTED",
    recovery_required: false
  };
}

async function publishTarget(targetPath, target, transactionId) {
  const temporaryPath = path.join(path.dirname(targetPath), `.dex-memory-${transactionId}-${target.slot}.tmp`);
  const handle = await fs.promises.open(temporaryPath, "wx");
  try {
    await handle.writeFile(Buffer.from(target.after_base64, "base64"));
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.promises.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
  const published = await fs.promises.readFile(targetPath);
  if (!published.equals(Buffer.from(target.after_base64, "base64"))) {
    throw new Error("published target verification failed");
  }
}

function writeCheckpoint(transactionRoot, name, payload) {
  fs.writeFileSync(path.join(transactionRoot, name), `${JSON.stringify(payload)}\n`, { flag: "wx" });
}

module.exports = {
  ApplyError,
  applyCreate,
  assertJournalPathSafe,
  createReceipt,
  publishTarget,
  validatePlanIntegrity,
  validatePlanSchema,
  writeCheckpoint
};
