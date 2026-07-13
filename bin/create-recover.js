"use strict";

const fs = require("fs");
const path = require("path");
const {
  assertJournalPathSafe,
  publishTarget,
  validatePlanIntegrity,
  validatePlanSchema,
  writeCheckpoint
} = require("./create-apply");

class RecoverError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

async function recoverCreate(request, fixtureRoot, targetPaths) {
  validateRecoverRequest(request);
  const journal = findRecoveryJournal(fixtureRoot, request.idempotency_key);
  const plan = journal.prepared.plan;
  const expectedPaths = targetPaths.map((targetPath) => path.relative(fixtureRoot, targetPath).split(path.sep).join("/"));
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

function findRecoveryJournal(fixtureRoot, idempotencyKey) {
  assertJournalPathSafe(fixtureRoot);
  const journalRoot = path.join(fixtureRoot, "journal");
  if (!fs.existsSync(journalRoot)) recoveryConflict("recovery journal was not found");
  const entries = fs.readdirSync(journalRoot, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if (!/^[a-f0-9]{24}$/.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) {
      recoveryConflict("fixture journal contains an invalid transaction entry");
    }
    const journal = readAndValidateJournal(path.join(journalRoot, entry.name), entry.name);
    if (journal.prepared.idempotency_key === idempotencyKey) matches.push(journal);
  }
  if (matches.length !== 1) recoveryConflict(matches.length === 0 ? "recovery journal was not found" : "recovery journal is ambiguous");
  return matches[0];
}

function readAndValidateJournal(transactionRoot, directoryTransactionId) {
  const entries = fs.readdirSync(transactionRoot, { withFileTypes: true });
  if (entries.length === 0) recoveryConflict("transaction journal is empty");
  const checkpointNames = entries.map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink() || !/^\d{4}-(?:PREPARED|L1_PUBLISHED|COMMITTED|ROLLED_BACK)\.json$/.test(entry.name)) {
      recoveryConflict("transaction journal contains an invalid checkpoint");
    }
    return entry.name;
  }).sort();
  const checkpoints = checkpointNames.map((name) => readCheckpoint(path.join(transactionRoot, name)));
  validateCheckpointSequence(checkpointNames, checkpoints);
  const prepared = checkpoints[0];
  try {
    requireJournalExactKeys(prepared, ["idempotency_key", "plan", "plan_hash", "request_fingerprint", "state", "transaction_id"], "PREPARED checkpoint");
    validatePlanSchema(prepared.plan);
    validatePlanIntegrity(prepared.plan);
  } catch (error) {
    recoveryConflict("PREPARED checkpoint or plan is invalid");
  }
  if (
    prepared.state !== "PREPARED" ||
    prepared.transaction_id !== directoryTransactionId ||
    prepared.plan.transaction_id !== directoryTransactionId ||
    prepared.idempotency_key !== prepared.plan.idempotency_key ||
    prepared.request_fingerprint !== prepared.plan.request_fingerprint ||
    prepared.plan_hash !== prepared.plan.plan_hash
  ) {
    recoveryConflict("PREPARED checkpoint identifiers do not match");
  }
  for (let index = 1; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index];
    const state = checkpoint.state;
    requireJournalExactKeys(checkpoint, state === "COMMITTED" ? ["plan_hash", "state", "transaction_id"] : ["state", "transaction_id"], `${state} checkpoint`);
    if (checkpoint.transaction_id !== directoryTransactionId) recoveryConflict("checkpoint transaction identifier does not match");
    if (state === "COMMITTED" && checkpoint.plan_hash !== prepared.plan_hash) recoveryConflict("COMMITTED plan hash does not match");
  }
  return {
    transactionRoot,
    checkpointNames,
    prepared,
    latest: checkpoints.at(-1)
  };
}

function readCheckpoint(checkpointPath) {
  const text = fs.readFileSync(checkpointPath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    recoveryConflict("transaction journal contains corrupt JSON");
  }
}

function validateCheckpointSequence(names, checkpoints) {
  const states = checkpoints.map((checkpoint) => checkpoint && checkpoint.state);
  const validStates = [
    ["PREPARED"],
    ["PREPARED", "L1_PUBLISHED"],
    ["PREPARED", "ROLLED_BACK"],
    ["PREPARED", "L1_PUBLISHED", "COMMITTED"],
    ["PREPARED", "L1_PUBLISHED", "ROLLED_BACK"]
  ];
  const numbersAreContiguous = names.every((name, index) => name.startsWith(`${String(index + 1).padStart(4, "0")}-`));
  if (!numbersAreContiguous || !validStates.some((candidate) => candidate.length === states.length && candidate.every((state, index) => state === states[index]))) {
    recoveryConflict("transaction checkpoint sequence is invalid");
  }
  if (names.some((name, index) => !name.endsWith(`-${states[index]}.json`))) recoveryConflict("checkpoint filename and state do not match");
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

function requireJournalExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) recoveryConflict(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) recoveryConflict(`${label} contains missing or unknown fields`);
}

function invalidSchema(message) {
  throw new RecoverError(2, "INVALID_SCHEMA", message);
}

function recoveryConflict(message) {
  throw new RecoverError(4, "RECOVERY_CONFLICT", message);
}

module.exports = { RecoverError, recoverCreate };
