"use strict";

const fs = require("fs");
const path = require("path");
const {
  assertJournalPathSafe,
  publishTarget,
  validatePlanIntegrity,
  validateOwnerPlannedContents,
  validatePlanSchema,
  writeCheckpoint
} = require("./create-apply");
const { findValidatedJournal } = require("./create-journal");

class RecoverError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

async function recoverCreate(request, fixtureRoot, targetPaths) {
  validateRecoverRequest(request);
  const expectedPaths = targetPaths.map((targetPath) => path.relative(fixtureRoot, targetPath).split(path.sep).join("/"));
  const journal = findRecoveryJournal(fixtureRoot, request.idempotency_key, expectedPaths);
  const plan = journal.prepared.plan;
  if (plan.targets.some((target, index) => target.relative_path !== expectedPaths[index])) {
    recoveryConflict("journal plan targets do not match fixture targets");
  }

  if (journal.latest.state === "COMMITTED") {
    return createRecoveryReceipt(plan, "ALREADY_COMMITTED", "COMMITTED");
  }
  if (journal.latest.state === "ROLLED_BACK") {
    return createRecoveryReceipt(plan, "ALREADY_ROLLED_BACK", "ROLLED_BACK");
  }

  const current = targetPaths.map((targetPath) => snapshotCurrent(targetPath));
  for (let index = 0; index < plan.targets.length; index += 1) {
    const target = plan.targets[index];
    const matchesBefore = current[index].exists === target.before_exists && current[index].bytes.equals(Buffer.from(target.before_base64, "base64"));
    const matchesAfter = current[index].exists && current[index].bytes.equals(Buffer.from(target.after_base64, "base64"));
    if (!matchesBefore && !matchesAfter) {
      recoveryConflict(`fixture target has an unknown version for ${target.slot}`);
    }
  }

  await restoreTarget(targetPaths[0], plan.targets[0], plan.transaction_id);
  await restoreTarget(targetPaths[1], plan.targets[1], plan.transaction_id);
  await verifyBaselinePair(targetPaths, plan.targets);
  const checkpointNumber = String(journal.checkpointNames.length + 1).padStart(4, "0");
  writeCheckpoint(journal.transactionRoot, `${checkpointNumber}-ROLLED_BACK.json`, {
    state: "ROLLED_BACK",
    transaction_id: plan.transaction_id
  });
  return createRecoveryReceipt(plan, "ROLLED_BACK", "ROLLED_BACK");
}

function validateRecoverRequest(request) {
  requireExactKeys(request, ["contract", "idempotency_key"], "recover request");
  if (request.contract !== "dex.memory.create.recover.v0") invalidSchema("unsupported recover contract");
  if (typeof request.idempotency_key !== "string" || request.idempotency_key.trim().length === 0 || [...request.idempotency_key].length > 256) {
    invalidSchema("idempotency_key is invalid");
  }
}

function findRecoveryJournal(fixtureRoot, idempotencyKey, expectedPaths) {
  assertJournalPathSafe(fixtureRoot);
  return findValidatedJournal(fixtureRoot, idempotencyKey, {
    conflict: recoveryConflict,
    invalidEntry: safetyBlocked,
    requireMatch: true,
    validatePlan: (plan) => {
      validatePlanSchema(plan);
      validatePlanIntegrity(plan);
      validateOwnerPlannedContents(plan, expectedPaths);
    }
  });
}

function snapshotCurrent(targetPath) {
  const exists = fs.existsSync(targetPath);
  const bytes = exists ? fs.readFileSync(targetPath) : Buffer.alloc(0);
  return {
    exists,
    bytes
  };
}

async function restoreTarget(targetPath, target, transactionId) {
  if (!target.before_exists) {
    await fs.promises.rm(targetPath, { force: true });
    if (fs.existsSync(targetPath)) throw new Error("baseline target removal verification failed");
    return;
  }
  await publishTarget(targetPath, { ...target, after_base64: target.before_base64 }, transactionId);
}

async function verifyBaselinePair(targetPaths, targets) {
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (!target.before_exists) {
      if (fs.existsSync(targetPaths[index])) throw new Error("baseline pair verification failed");
      continue;
    }
    const bytes = await fs.promises.readFile(targetPaths[index]);
    if (!bytes.equals(Buffer.from(target.before_base64, "base64"))) throw new Error("baseline pair verification failed");
  }
}

function createRecoveryReceipt(plan, status, journalState) {
  return {
    contract: "dex.memory.create.receipt.v0",
    command: "recover",
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
    journal_state: journalState,
    recovery_required: false
  };
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidSchema(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) invalidSchema(`${label} contains missing or unknown fields`);
}

function invalidSchema(message) {
  throw new RecoverError(2, "INVALID_SCHEMA", message);
}

function recoveryConflict(message) {
  throw new RecoverError(4, "RECOVERY_CONFLICT", message);
}

function safetyBlocked(message) {
  throw new RecoverError(3, "SAFETY_BLOCKED", message);
}

module.exports = { RecoverError, recoverCreate };
