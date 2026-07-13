"use strict";

const fs = require("fs");
const path = require("path");

function findValidatedJournal(fixtureRoot, idempotencyKey, options) {
  const { conflict, invalidEntry = conflict, requireMatch = false, validatePlan } = options;
  const journalRoot = path.join(fixtureRoot, "journal");
  if (!fs.existsSync(journalRoot)) {
    if (requireMatch) conflict("transaction journal was not found");
    return null;
  }
  const entries = fs.readdirSync(journalRoot, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if (!/^[a-f0-9]{24}$/.test(entry.name)) {
      conflict("fixture journal contains an invalid transaction entry");
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) invalidEntry("fixture transaction journal path is invalid");
    const journal = readAndValidateJournal(
      path.join(journalRoot, entry.name),
      entry.name,
      conflict,
      invalidEntry,
      validatePlan
    );
    if (journal.prepared.idempotency_key === idempotencyKey) matches.push(journal);
  }
  if (matches.length > 1) conflict("transaction journal is ambiguous");
  if (matches.length === 0 && requireMatch) conflict("transaction journal was not found");
  return matches[0] || null;
}

function readAndValidateJournal(transactionRoot, directoryTransactionId, conflict, invalidEntry, validatePlan) {
  const entries = fs.readdirSync(transactionRoot, { withFileTypes: true });
  if (entries.length === 0) conflict("transaction journal is empty");
  const checkpointNames = entries.map((entry) => {
    if (!/^\d{4}-(?:PREPARED|L1_PUBLISHED|COMMITTED|ROLLED_BACK)\.json$/.test(entry.name)) {
      conflict("transaction journal contains an invalid checkpoint");
    }
    if (!entry.isFile() || entry.isSymbolicLink()) invalidEntry("fixture journal checkpoint path is invalid");
    return entry.name;
  }).sort();
  const checkpoints = checkpointNames.map((name) => readCheckpoint(path.join(transactionRoot, name), conflict));
  validateCheckpointSequence(checkpointNames, checkpoints, conflict);
  const prepared = checkpoints[0];
  requireExactKeys(prepared, ["idempotency_key", "plan", "plan_hash", "request_fingerprint", "state", "transaction_id"], "PREPARED checkpoint", conflict);
  try {
    validatePlan(prepared.plan);
  } catch (error) {
    conflict("PREPARED checkpoint or plan is invalid");
  }
  if (
    prepared.state !== "PREPARED" ||
    prepared.transaction_id !== directoryTransactionId ||
    prepared.plan.transaction_id !== directoryTransactionId ||
    prepared.idempotency_key !== prepared.plan.idempotency_key ||
    prepared.request_fingerprint !== prepared.plan.request_fingerprint ||
    prepared.plan_hash !== prepared.plan.plan_hash
  ) {
    conflict("PREPARED checkpoint identifiers do not match");
  }
  for (let index = 1; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index];
    const state = checkpoint.state;
    requireExactKeys(checkpoint, state === "COMMITTED" ? ["plan_hash", "state", "transaction_id"] : ["state", "transaction_id"], `${state} checkpoint`, conflict);
    if (checkpoint.transaction_id !== directoryTransactionId) conflict("checkpoint transaction identifier does not match");
    if (state === "COMMITTED" && checkpoint.plan_hash !== prepared.plan_hash) conflict("COMMITTED plan hash does not match");
  }
  return {
    transactionRoot,
    checkpointNames,
    prepared,
    latest: checkpoints.at(-1)
  };
}

function readCheckpoint(checkpointPath, conflict) {
  const text = fs.readFileSync(checkpointPath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    conflict("transaction journal contains corrupt JSON");
  }
}

function validateCheckpointSequence(names, checkpoints, conflict) {
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
    conflict("transaction checkpoint sequence is invalid");
  }
  if (names.some((name, index) => !name.endsWith(`-${states[index]}.json`))) conflict("checkpoint filename and state do not match");
}

function requireExactKeys(value, expected, label, conflict) {
  if (!value || typeof value !== "object" || Array.isArray(value)) conflict(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) conflict(`${label} contains missing or unknown fields`);
}

module.exports = { findValidatedJournal };
