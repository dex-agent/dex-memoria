"use strict";

const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");
const { stableJson } = require("./create-plan");

const PUBLISH_ORDER = ["destination", "index", "l1"];
const ROLLBACK_ORDER = ["l1", "index", "destination"];
const FAILPOINTS = new Set([
  "FP_AFTER_DESTINATION_DIRECTORY_CREATE_BEFORE_PUBLISH",
  "FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT",
  "FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX",
  "FP_AFTER_INDEX_PUBLISH_BEFORE_CHECKPOINT",
  "FP_AFTER_INDEX_CHECKPOINT_BEFORE_L1",
  "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT",
  "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT"
]);
const CHECKPOINT_STATES = [
  "PREPARED",
  "DESTINATION_PUBLISHED",
  "INDEX_PUBLISHED",
  "L1_PUBLISHED",
  "COMMITTED",
  "ROLLED_BACK"
];

class ThemeV2TransactionError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

async function applyThemeV2(plan, fixtureRoot, prepareFresh, failpointControl = {}) {
  validatePlan(plan);
  validateFailpointControl(failpointControl);
  assertJournalRootSafe(fixtureRoot);
  const transactionId = deriveTransactionId(plan);
  const prior = findJournalByIdempotency(fixtureRoot, plan.idempotency_key, "apply");
  if (prior) {
    const priorPlan = prior.prepared.plan;
    if (
      priorPlan.profile !== plan.profile ||
      priorPlan.request_fingerprint !== plan.request_fingerprint ||
      priorPlan.plan_hash !== plan.plan_hash ||
      prior.prepared.transaction_id !== transactionId
    ) {
      fail(4, "IDEMPOTENCY_CONFLICT", "idempotency key already belongs to a different V2 plan");
    }
    if (prior.latest.state === "COMMITTED") return createReceipt(priorPlan, transactionId, "apply", "ALREADY_COMMITTED", "COMMITTED");
    if (prior.latest.state === "ROLLED_BACK") {
      fail(4, "TRANSACTION_ROLLED_BACK", "transaction was rolled back; submit a new idempotency key");
    }
    fail(5, "RECOVERY_REQUIRED", "transaction journal requires recovery before apply");
  }

  const preparedFresh = prepareFresh(plan);
  const { targetPaths, expectedPlan, directories } = preparedFresh;
  if (stableJson(expectedPlan) !== stableJson(plan)) {
    fail(4, "PLAN_CONFLICT", "plan does not match the owner reconstruction and current fixture baseline");
  }
  const targetsByRole = roleMap(plan.targets);
  const pathsByRole = roleMap(targetPaths.map((targetPath, index) => ({
    slot: plan.targets[index].slot,
    targetPath
  })), "targetPath");
  validateCurrentBaseline(plan, pathsByRole);
  validateDirectoryBaseline(fixtureRoot, directories);

  const temporaryPaths = PUBLISH_ORDER.map((slot) => ({
    slot,
    relative_path: relativeFixturePath(fixtureRoot, temporaryPathFor(pathsByRole[slot], transactionId, slot))
  }));
  for (const entry of temporaryPaths) {
    const absolute = resolveSafeRelativePath(fixtureRoot, entry.relative_path);
    if (fs.existsSync(absolute)) fail(4, "PLAN_CONFLICT", `transaction temporary path already exists for ${entry.slot}`);
  }

  const journalRoot = path.join(fixtureRoot, "journal");
  fs.mkdirSync(journalRoot, { recursive: true });
  assertJournalRootSafe(fixtureRoot);
  const transactionRoot = path.join(journalRoot, transactionId);
  fs.mkdirSync(transactionRoot);
  await writeCheckpoint(transactionRoot, "0001-PREPARED.json", {
    state: "PREPARED",
    transaction_id: transactionId,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    publish_order: PUBLISH_ORDER,
    rollback_order: ROLLBACK_ORDER,
    directories,
    temporary_paths: temporaryPaths,
    plan
  });

  for (const directory of directories) {
    if (!directory.before_exists) {
      const directoryPath = resolveSafeRelativePath(fixtureRoot, directory.relative_path);
      fs.mkdirSync(directoryPath);
      assertPlainDirectoryInside(fixtureRoot, directoryPath);
    }
  }
  if (directories.some((directory) => !directory.before_exists)) {
    await stopAtFailpoint(failpointControl, "FP_AFTER_DESTINATION_DIRECTORY_CREATE_BEFORE_PUBLISH", transactionId);
  }

  await publishTarget(fixtureRoot, pathsByRole.destination, targetsByRole.destination, transactionId, "destination");
  await stopAtFailpoint(failpointControl, "FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT", transactionId);
  await writeCheckpoint(transactionRoot, "0002-DESTINATION_PUBLISHED.json", {
    state: "DESTINATION_PUBLISHED",
    transaction_id: transactionId
  });
  await stopAtFailpoint(failpointControl, "FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX", transactionId);

  await publishTarget(fixtureRoot, pathsByRole.index, targetsByRole.index, transactionId, "index");
  await stopAtFailpoint(failpointControl, "FP_AFTER_INDEX_PUBLISH_BEFORE_CHECKPOINT", transactionId);
  await writeCheckpoint(transactionRoot, "0003-INDEX_PUBLISHED.json", {
    state: "INDEX_PUBLISHED",
    transaction_id: transactionId
  });
  await stopAtFailpoint(failpointControl, "FP_AFTER_INDEX_CHECKPOINT_BEFORE_L1", transactionId);

  await publishTarget(fixtureRoot, pathsByRole.l1, targetsByRole.l1, transactionId, "l1");
  await stopAtFailpoint(failpointControl, "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT", transactionId);
  await writeCheckpoint(transactionRoot, "0004-L1_PUBLISHED.json", {
    state: "L1_PUBLISHED",
    transaction_id: transactionId
  });
  await stopAtFailpoint(failpointControl, "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT", transactionId);

  verifyAfterState(plan, pathsByRole);
  await writeCheckpoint(transactionRoot, "0005-COMMITTED.json", {
    state: "COMMITTED",
    transaction_id: transactionId,
    plan_hash: plan.plan_hash
  });
  return createReceipt(plan, transactionId, "apply", "COMMITTED", "COMMITTED");
}

async function recoverThemeV2(request, fixtureRoot, manifest) {
  validateRecoverRequest(request);
  assertJournalRootSafe(fixtureRoot);
  const journal = findJournalByIdempotency(fixtureRoot, request.idempotency_key, "recover", true);
  const plan = journal.prepared.plan;
  if (plan.request.target_layer !== manifest.target_layer) recoveryConflict("journal target layer does not match fixture manifest");
  if (plan.targets[0].relative_path !== `work/${manifest.theme}/lembranca.md`) {
    recoveryConflict("journal theme does not match fixture manifest");
  }
  const transactionId = journal.prepared.transaction_id;

  if (journal.latest.state === "COMMITTED") return createReceipt(plan, transactionId, "recover", "ALREADY_COMMITTED", "COMMITTED");
  if (journal.latest.state === "ROLLED_BACK") return createReceipt(plan, transactionId, "recover", "ALREADY_ROLLED_BACK", "ROLLED_BACK");

  const targetPaths = plan.targets.map((target) => resolveSafeRelativePath(fixtureRoot, target.relative_path));
  const targetsByRole = roleMap(plan.targets);
  const pathsByRole = roleMap(targetPaths.map((targetPath, index) => ({ slot: plan.targets[index].slot, targetPath })), "targetPath");
  const vector = currentVector(targetsByRole, pathsByRole);
  validateVector(journal.latest.state, vector);
  validateRecoveryDirectories(
    fixtureRoot,
    journal.prepared.directories,
    journal.prepared.temporary_paths,
    journal.latest.state,
    targetsByRole,
    pathsByRole
  );
  validateRollbackTemporaryPaths(fixtureRoot, transactionId, targetsByRole, pathsByRole);

  for (const temporary of journal.prepared.temporary_paths) {
    const temporaryPath = resolveSafeRelativePath(fixtureRoot, temporary.relative_path);
    if (fs.existsSync(temporaryPath)) await fs.promises.rm(temporaryPath, { force: true });
  }
  for (const slot of ROLLBACK_ORDER) {
    await restoreTarget(fixtureRoot, pathsByRole[slot], targetsByRole[slot], transactionId, slot);
  }
  for (const directory of [...journal.prepared.directories].sort((a, b) => b.relative_path.length - a.relative_path.length)) {
    if (directory.before_exists) continue;
    const directoryPath = resolveSafeRelativePath(fixtureRoot, directory.relative_path);
    if (!fs.existsSync(directoryPath)) continue;
    const entries = fs.readdirSync(directoryPath);
    if (entries.length !== 0) recoveryConflict("transaction-owned directory is not empty after target rollback");
    fs.rmdirSync(directoryPath);
  }
  verifyBeforeState(plan, pathsByRole);
  verifyDirectoryBaseline(fixtureRoot, journal.prepared.directories);
  const checkpointNumber = String(journal.checkpointNames.length + 1).padStart(4, "0");
  await writeCheckpoint(journal.transactionRoot, `${checkpointNumber}-ROLLED_BACK.json`, {
    state: "ROLLED_BACK",
    transaction_id: transactionId
  });
  return createReceipt(plan, transactionId, "recover", "ROLLED_BACK", "ROLLED_BACK");
}

function validatePlan(plan) {
  requireExactKeys(plan, [
    "contract", "profile", "operation", "idempotency_key", "request", "request_fingerprint",
    "serialization_order_only", "targets", "plan_hash"
  ], "V2 plan", invalidSchema);
  if (
    plan.contract !== "dex.memory.create.theme-v2.plan.v0" ||
    plan.profile !== "governed-theme-v2" ||
    plan.operation !== "create" ||
    plan.serialization_order_only !== true
  ) invalidSchema("unsupported V2 plan contract or profile");
  requireString(plan.idempotency_key, "idempotency_key", 256, undefined, invalidSchema);
  validateEmbeddedRequest(plan.request);
  if (plan.idempotency_key !== plan.request.idempotency_key) {
    invalidSchema("plan and embedded request idempotency keys do not match");
  }
  requireHash(plan.request_fingerprint, "request_fingerprint", 64, invalidSchema);
  requireHash(plan.plan_hash, "plan_hash", 64, invalidSchema);
  if (!Array.isArray(plan.targets) || plan.targets.length !== 3) invalidSchema("V2 plan targets are invalid");
  const expectedSlots = ["l1", "index", "destination"];
  plan.targets.forEach((target, index) => {
    requireExactKeys(target, [
      "after_base64", "after_sha256", "before_base64", "before_exists", "before_sha256",
      "changed", "relative_path", "slot"
    ], `targets[${index}]`, invalidSchema);
    if (target.slot !== expectedSlots[index]) invalidSchema("V2 plan target slots are invalid");
    requireString(target.relative_path, `targets[${index}].relative_path`, 256, /^work\/[A-Za-z0-9/-]+\.md$/, invalidSchema);
    if (typeof target.before_exists !== "boolean" || target.changed !== true) invalidSchema("V2 create targets must be changed");
    requireHash(target.before_sha256, `targets[${index}].before_sha256`, 64, invalidSchema);
    requireHash(target.after_sha256, `targets[${index}].after_sha256`, 64, invalidSchema);
    requireBase64(target.before_base64, `targets[${index}].before_base64`, invalidSchema);
    requireBase64(target.after_base64, `targets[${index}].after_base64`, invalidSchema);
  });
  validatePlanPaths(plan);
  const { plan_hash: ignored, ...unsignedPlan } = plan;
  if (sha256(Buffer.from(stableJson(unsignedPlan))) !== plan.plan_hash) planConflict("plan hash does not match V2 plan contents");
  if (sha256(Buffer.from(stableJson(plan.request))) !== plan.request_fingerprint) planConflict("request fingerprint does not match embedded request");
  for (const target of plan.targets) {
    const before = Buffer.from(target.before_base64, "base64");
    const after = Buffer.from(target.after_base64, "base64");
    if (
      sha256(before) !== target.before_sha256 ||
      sha256(after) !== target.after_sha256 ||
      before.equals(after) ||
      (!target.before_exists && before.length !== 0)
    ) planConflict(`plan target integrity failed for ${target.slot}`);
  }
}

function validateEmbeddedRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) invalidSchema("embedded request must be an object");
  const expected = [
    "body", "contract", "created_at", "idempotency_key", "identity", "operation", "profile",
    "route_decision", "slug", "target_layer", "title", "trigger"
  ];
  if (request.target_layer === "L3") expected.push("owner_skill");
  requireExactKeys(request, expected, "embedded request", invalidSchema);
  if (
    request.contract !== "dex.memory.create.theme-v2.request.v0" ||
    request.profile !== "governed-theme-v2" ||
    request.operation !== "create" ||
    !["L2", "L3"].includes(request.target_layer)
  ) invalidSchema("embedded request contract or target layer is invalid");
  requireString(request.idempotency_key, "request.idempotency_key", 256, undefined, invalidSchema);
  requireString(request.identity, "request.identity", 36, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/, invalidSchema);
  requireString(request.slug, "request.slug", 80, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, invalidSchema);
  if (isReservedName(request.slug)) invalidSchema("request slug is reserved");
  requireSingleLine(request.trigger, "request.trigger", 512);
  requireSingleLine(request.title, "request.title", 256);
  requireString(request.body, "request.body", 65536, undefined, invalidSchema);
  requireString(request.created_at, "request.created_at", 24, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, invalidSchema);
  if (Number.isNaN(Date.parse(request.created_at)) || new Date(request.created_at).toISOString() !== request.created_at) {
    invalidSchema("request created_at is invalid");
  }
  const expectedDecision = request.target_layer === "L2" ? "explicit-l2-memory" : "explicit-l3-knowledge";
  if (request.route_decision !== expectedDecision) invalidSchema("embedded route decision is invalid");
  if (request.target_layer === "L3") {
    requireString(request.owner_skill, "request.owner_skill", 128, /^[a-z0-9]+(?:(?:-|:)[a-z0-9]+)*$/, invalidSchema);
  }
}

function validatePlanPaths(plan) {
  const l1 = plan.targets[0].relative_path;
  const match = l1.match(/^work\/([a-z0-9]+(?:-[a-z0-9]+)*)\/lembranca\.md$/);
  if (!match) invalidSchema("V2 L1 path is invalid");
  const themeRoot = `work/${match[1]}`;
  const request = plan.request;
  const directory = request.target_layer === "L2" ? "memorias" : "conhecimento";
  const expected = [
    `${themeRoot}/lembranca.md`,
    `${themeRoot}/${directory}/INDEX.md`,
    request.target_layer === "L2"
      ? `${themeRoot}/memorias/${request.slug}.md`
      : `${themeRoot}/conhecimento/${request.slug}/README.md`
  ];
  if (plan.targets.some((target, index) => target.relative_path !== expected[index])) invalidSchema("V2 plan paths do not match request");
}

function validateRecoverRequest(request) {
  requireExactKeys(request, ["contract", "idempotency_key", "profile"], "V2 recover request", invalidSchema);
  if (request.contract !== "dex.memory.create.theme-v2.recover.v0" || request.profile !== "governed-theme-v2") {
    invalidSchema("unsupported V2 recover contract or profile");
  }
  requireString(request.idempotency_key, "idempotency_key", 256, undefined, invalidSchema);
}

function findJournalByIdempotency(fixtureRoot, idempotencyKey, command, requireMatch = false) {
  const journalRoot = path.join(fixtureRoot, "journal");
  if (!fs.existsSync(journalRoot)) {
    if (requireMatch) recoveryConflict("transaction journal was not found");
    return null;
  }
  assertPlainDirectoryInside(fixtureRoot, journalRoot);
  const matches = [];
  for (const entry of fs.readdirSync(journalRoot, { withFileTypes: true })) {
    if (!/^[a-f0-9]{24}$/.test(entry.name)) journalFailure(command, "fixture journal contains an invalid transaction entry");
    if (!entry.isDirectory() || entry.isSymbolicLink()) safetyFailure(command, "fixture transaction journal path is invalid");
    const journal = readJournal(path.join(journalRoot, entry.name), entry.name, command);
    if (journal.prepared.idempotency_key === idempotencyKey) matches.push(journal);
  }
  if (matches.length > 1) journalFailure(command, "transaction journal is ambiguous");
  if (matches.length === 0 && requireMatch) recoveryConflict("transaction journal was not found");
  return matches[0] || null;
}

function readJournal(transactionRoot, directoryTransactionId, command) {
  assertPlainDirectoryInside(path.dirname(transactionRoot), transactionRoot);
  const entries = fs.readdirSync(transactionRoot, { withFileTypes: true });
  const checkpointNames = [];
  for (const entry of entries) {
    if (/^\.\d{4}-(?:PREPARED|DESTINATION_PUBLISHED|INDEX_PUBLISHED|L1_PUBLISHED|COMMITTED|ROLLED_BACK)\.json\.\d+\.tmp$/.test(entry.name)) {
      if (!entry.isFile() || entry.isSymbolicLink()) safetyFailure(command, "fixture checkpoint staging path is invalid");
      continue;
    }
    if (!/^\d{4}-(?:PREPARED|DESTINATION_PUBLISHED|INDEX_PUBLISHED|L1_PUBLISHED|COMMITTED|ROLLED_BACK)\.json$/.test(entry.name)) {
      journalFailure(command, "transaction journal contains an invalid checkpoint");
    }
    if (!entry.isFile() || entry.isSymbolicLink()) safetyFailure(command, "fixture checkpoint path is invalid");
    checkpointNames.push(entry.name);
  }
  checkpointNames.sort();
  if (checkpointNames.length === 0) journalFailure(command, "transaction journal has no published checkpoint");
  const checkpoints = checkpointNames.map((name) => readCheckpoint(path.join(transactionRoot, name), command));
  validateCheckpointSequence(checkpointNames, checkpoints, command);
  const prepared = checkpoints[0];
  requireExactKeys(prepared, [
    "directories", "idempotency_key", "plan", "plan_hash", "publish_order", "request_fingerprint",
    "rollback_order", "state", "temporary_paths", "transaction_id"
  ], "V2 PREPARED checkpoint", (message) => journalFailure(command, message));
  try {
    validatePlan(prepared.plan);
  } catch (error) {
    journalFailure(command, "V2 PREPARED plan is invalid");
  }
  if (
    prepared.state !== "PREPARED" ||
    prepared.transaction_id !== directoryTransactionId ||
    deriveTransactionId(prepared.plan) !== directoryTransactionId ||
    prepared.idempotency_key !== prepared.plan.idempotency_key ||
    prepared.request_fingerprint !== prepared.plan.request_fingerprint ||
    prepared.plan_hash !== prepared.plan.plan_hash ||
    stableJson(prepared.publish_order) !== stableJson(PUBLISH_ORDER) ||
    stableJson(prepared.rollback_order) !== stableJson(ROLLBACK_ORDER)
  ) journalFailure(command, "V2 PREPARED identifiers do not match");
  validatePreparedDirectories(prepared.directories, prepared.plan, command);
  validateTemporaryPaths(prepared.temporary_paths, prepared.plan, directoryTransactionId, command);
  for (let index = 1; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index];
    const expectedKeys = checkpoint.state === "COMMITTED"
      ? ["plan_hash", "state", "transaction_id"]
      : ["state", "transaction_id"];
    requireExactKeys(checkpoint, expectedKeys, `${checkpoint.state} checkpoint`, (message) => journalFailure(command, message));
    if (checkpoint.transaction_id !== directoryTransactionId) journalFailure(command, "checkpoint transaction identifier does not match");
    if (checkpoint.state === "COMMITTED" && checkpoint.plan_hash !== prepared.plan_hash) journalFailure(command, "COMMITTED plan hash does not match");
  }
  return { transactionRoot, checkpointNames, prepared, latest: checkpoints.at(-1) };
}

function validateCheckpointSequence(names, checkpoints, command) {
  const states = checkpoints.map((checkpoint) => checkpoint && checkpoint.state);
  const prefixes = [
    ["PREPARED"],
    ["PREPARED", "DESTINATION_PUBLISHED"],
    ["PREPARED", "DESTINATION_PUBLISHED", "INDEX_PUBLISHED"],
    ["PREPARED", "DESTINATION_PUBLISHED", "INDEX_PUBLISHED", "L1_PUBLISHED"],
    ["PREPARED", "DESTINATION_PUBLISHED", "INDEX_PUBLISHED", "L1_PUBLISHED", "COMMITTED"]
  ];
  const valid = prefixes.some((prefix) => sameArray(prefix, states)) ||
    prefixes.slice(0, -1).some((prefix) => sameArray([...prefix, "ROLLED_BACK"], states));
  const contiguous = names.every((name, index) => name.startsWith(`${String(index + 1).padStart(4, "0")}-`));
  const filenamesMatch = names.every((name, index) => name.endsWith(`-${states[index]}.json`));
  if (!valid || !contiguous || !filenamesMatch || states.some((state) => !CHECKPOINT_STATES.includes(state))) {
    journalFailure(command, "transaction checkpoint sequence is invalid");
  }
}

function validatePreparedDirectories(directories, plan, command) {
  if (!Array.isArray(directories)) journalFailure(command, "PREPARED directories are invalid");
  const destination = plan.targets.find((target) => target.slot === "destination");
  const expected = plan.request.target_layer === "L3"
    ? [{ relative_path: path.posix.dirname(destination.relative_path), before_exists: false, owned_if_created: true }]
    : [];
  if (stableJson(directories) !== stableJson(expected)) journalFailure(command, "PREPARED directory ownership is invalid");
}

function validateTemporaryPaths(temporaryPaths, plan, transactionId, command) {
  if (!Array.isArray(temporaryPaths) || temporaryPaths.length !== 3) journalFailure(command, "PREPARED temporary paths are invalid");
  const expected = PUBLISH_ORDER.map((slot) => {
    const target = plan.targets.find((entry) => entry.slot === slot);
    return { slot, relative_path: `${path.posix.dirname(target.relative_path)}/.dex-memory-${transactionId}-${slot}.tmp` };
  });
  if (stableJson(temporaryPaths) !== stableJson(expected)) journalFailure(command, "PREPARED temporary ownership is invalid");
}

function readCheckpoint(checkpointPath, command) {
  try {
    return JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  } catch (error) {
    journalFailure(command, "transaction journal contains corrupt JSON");
  }
}

function validateCurrentBaseline(plan, pathsByRole) {
  for (const target of plan.targets) {
    const current = snapshot(pathsByRole[target.slot]);
    const before = Buffer.from(target.before_base64, "base64");
    if (current.exists !== target.before_exists || !current.bytes.equals(before)) {
      planConflict(`fixture target drifted for ${target.slot}`);
    }
  }
}

function validateDirectoryBaseline(fixtureRoot, directories) {
  for (const directory of directories) {
    const directoryPath = resolveSafeRelativePath(fixtureRoot, directory.relative_path);
    if (fs.existsSync(directoryPath) !== directory.before_exists) planConflict("fixture destination directory drifted");
  }
}

function currentVector(targetsByRole, pathsByRole) {
  return Object.fromEntries(PUBLISH_ORDER.map((slot) => {
    const current = snapshot(pathsByRole[slot]);
    const target = targetsByRole[slot];
    const before = Buffer.from(target.before_base64, "base64");
    const after = Buffer.from(target.after_base64, "base64");
    if (current.exists === target.before_exists && current.bytes.equals(before)) return [slot, "before"];
    if (current.exists && current.bytes.equals(after)) return [slot, "after"];
    recoveryConflict(`fixture target has an unknown version for ${slot}`);
  }));
}

function validateVector(latestState, vector) {
  const serial = `${vector.destination},${vector.index},${vector.l1}`;
  const allowed = {
    PREPARED: new Set(["before,before,before", "after,before,before"]),
    DESTINATION_PUBLISHED: new Set(["after,before,before", "after,after,before"]),
    INDEX_PUBLISHED: new Set(["after,after,before", "after,after,after"]),
    L1_PUBLISHED: new Set(["after,after,after"])
  };
  if (!allowed[latestState] || !allowed[latestState].has(serial)) recoveryConflict("fixture target vector is impossible for the latest checkpoint");
}

function validateRecoveryDirectories(fixtureRoot, directories, temporaryPaths, latestState, targetsByRole, pathsByRole) {
  for (const directory of directories) {
    const directoryPath = resolveSafeRelativePath(fixtureRoot, directory.relative_path);
    if (!fs.existsSync(directoryPath)) continue;
    assertPlainDirectoryInside(fixtureRoot, directoryPath, recoveryConflict);
    const destinationName = path.basename(pathsByRole.destination);
    const allowedTemporary = new Set(temporaryPaths
      .filter((entry) => path.posix.dirname(entry.relative_path) === directory.relative_path)
      .map((entry) => path.posix.basename(entry.relative_path)));
    const allowed = new Set([destinationName, ...allowedTemporary]);
    const unexpected = fs.readdirSync(directoryPath).filter((entry) => !allowed.has(entry));
    if (unexpected.length > 0) recoveryConflict("transaction-owned directory contains unexpected entries");
  }
  const permittedTemporarySlot = {
    PREPARED: "destination",
    DESTINATION_PUBLISHED: "index",
    INDEX_PUBLISHED: "l1",
    L1_PUBLISHED: null
  }[latestState];
  for (const temporary of temporaryPaths) {
    const temporaryPath = resolveSafeRelativePath(fixtureRoot, temporary.relative_path);
    if (!fs.existsSync(temporaryPath)) continue;
    const stat = fs.lstatSync(temporaryPath);
    if (!stat.isFile() || stat.isSymbolicLink()) safetyBlocked("transaction temporary path is invalid");
    if (temporary.slot !== permittedTemporarySlot) recoveryConflict("transaction temporary path is impossible for the latest checkpoint");
    const expected = Buffer.from(targetsByRole[temporary.slot].after_base64, "base64");
    if (!fs.readFileSync(temporaryPath).equals(expected)) recoveryConflict("transaction temporary bytes are not owned by the V2 plan");
  }
}

function validateRollbackTemporaryPaths(fixtureRoot, transactionId, targetsByRole, pathsByRole) {
  for (const slot of ROLLBACK_ORDER) {
    if (!targetsByRole[slot].before_exists) continue;
    const temporaryPath = path.join(path.dirname(pathsByRole[slot]), `.dex-memory-${transactionId}-rollback-${slot}.tmp`);
    resolveSafeRelativePath(fixtureRoot, relativeFixturePath(fixtureRoot, temporaryPath));
    if (fs.existsSync(temporaryPath)) safetyBlocked("rollback temporary path already exists");
  }
}

async function publishTarget(fixtureRoot, targetPath, target, transactionId, slot) {
  resolveSafeRelativePath(fixtureRoot, relativeFixturePath(fixtureRoot, targetPath));
  const parent = path.dirname(targetPath);
  assertPlainDirectoryInside(fixtureRoot, parent);
  const temporaryPath = temporaryPathFor(targetPath, transactionId, slot);
  await publishBytes(targetPath, Buffer.from(target.after_base64, "base64"), temporaryPath);
}

async function restoreTarget(fixtureRoot, targetPath, target, transactionId, slot) {
  resolveSafeRelativePath(fixtureRoot, relativeFixturePath(fixtureRoot, targetPath));
  if (!target.before_exists) {
    await fs.promises.rm(targetPath, { force: true });
    return;
  }
  const temporaryPath = path.join(path.dirname(targetPath), `.dex-memory-${transactionId}-rollback-${slot}.tmp`);
  if (fs.existsSync(temporaryPath)) safetyBlocked("rollback temporary path already exists");
  await publishBytes(targetPath, Buffer.from(target.before_base64, "base64"), temporaryPath);
}

async function publishBytes(targetPath, bytes, temporaryPath) {
  const handle = await fs.promises.open(temporaryPath, "wx");
  try {
    await handle.writeFile(bytes);
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
  if (!published.equals(bytes)) throw new Error("published V2 target verification failed");
}

async function writeCheckpoint(transactionRoot, name, payload) {
  const temporaryPath = path.join(transactionRoot, `.${name}.${process.pid}.tmp`);
  const finalPath = path.join(transactionRoot, name);
  const handle = await fs.promises.open(temporaryPath, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(payload)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.promises.rename(temporaryPath, finalPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
}

function verifyAfterState(plan, pathsByRole) {
  for (const target of plan.targets) {
    const current = snapshot(pathsByRole[target.slot]);
    if (!current.exists || !current.bytes.equals(Buffer.from(target.after_base64, "base64"))) {
      throw new Error("V2 after-state verification failed");
    }
  }
}

function verifyBeforeState(plan, pathsByRole) {
  for (const target of plan.targets) {
    const current = snapshot(pathsByRole[target.slot]);
    if (current.exists !== target.before_exists || !current.bytes.equals(Buffer.from(target.before_base64, "base64"))) {
      throw new Error("V2 before-state verification failed");
    }
  }
}

function verifyDirectoryBaseline(fixtureRoot, directories) {
  for (const directory of directories) {
    const directoryPath = resolveSafeRelativePath(fixtureRoot, directory.relative_path);
    if (fs.existsSync(directoryPath) !== directory.before_exists) throw new Error("V2 directory baseline verification failed");
  }
}

function snapshot(targetPath) {
  const exists = fs.existsSync(targetPath);
  return { exists, bytes: exists ? fs.readFileSync(targetPath) : Buffer.alloc(0) };
}

function roleMap(entries, valueKey) {
  const result = {};
  for (const entry of entries) {
    if (!PUBLISH_ORDER.includes(entry.slot) || Object.hasOwn(result, entry.slot)) invalidSchema("V2 roles are missing or duplicated");
    result[entry.slot] = valueKey ? entry[valueKey] : entry;
  }
  if (PUBLISH_ORDER.some((slot) => !Object.hasOwn(result, slot))) invalidSchema("V2 roles are missing or duplicated");
  return result;
}

function deriveTransactionId(plan) {
  return sha256(Buffer.from(stableJson({
    profile: plan.profile,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    targets: plan.targets
  }))).slice(0, 24);
}

function createReceipt(plan, transactionId, command, status, journalState) {
  return {
    contract: "dex.memory.create.theme-v2.receipt.v0",
    profile: "governed-theme-v2",
    command,
    status,
    transaction_id: transactionId,
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
    publish_order: PUBLISH_ORDER,
    journal_state: journalState,
    recovery_required: false
  };
}

function validateDirectoryBaselineShape(plan) {
  const destination = plan.targets.find((target) => target.slot === "destination");
  return plan.request.target_layer === "L3"
    ? [{ relative_path: path.posix.dirname(destination.relative_path), before_exists: false, owned_if_created: true }]
    : [];
}

function resolveSafeRelativePath(fixtureRoot, relativePath) {
  if (typeof relativePath !== "string" || relativePath.includes("\\") || path.posix.normalize(relativePath) !== relativePath || !relativePath.startsWith("work/")) {
    safetyBlocked("V2 relative path is invalid");
  }
  const root = fs.realpathSync(fixtureRoot);
  const candidate = path.resolve(fixtureRoot, ...relativePath.split("/"));
  if (!isInsideOrEqual(root, candidate)) safetyBlocked("V2 path escapes fixture root");
  let current = fixtureRoot;
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) safetyBlocked("V2 path contains a symlink or reparse point");
    const realCurrent = fs.realpathSync(current);
    if (!isInsideOrEqual(root, realCurrent)) safetyBlocked("V2 path escapes fixture root");
  }
  return candidate;
}

function assertJournalRootSafe(fixtureRoot) {
  const journalRoot = path.join(fixtureRoot, "journal");
  if (!fs.existsSync(journalRoot)) return;
  assertPlainDirectoryInside(fixtureRoot, journalRoot);
}

function assertPlainDirectoryInside(fixtureRoot, directoryPath, onError = safetyBlocked) {
  try {
    const stat = fs.lstatSync(directoryPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) onError("directory path is invalid");
    const root = fs.realpathSync(fixtureRoot);
    const realDirectory = fs.realpathSync(directoryPath);
    if (!isInsideOrEqual(root, realDirectory)) onError("directory path escapes fixture root");
  } catch (error) {
    if (error instanceof ThemeV2TransactionError) throw error;
    onError("directory path is invalid");
  }
}

function isInsideOrEqual(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function relativeFixturePath(fixtureRoot, targetPath) {
  return path.relative(fixtureRoot, targetPath).split(path.sep).join("/");
}

function temporaryPathFor(targetPath, transactionId, slot) {
  return path.join(path.dirname(targetPath), `.dex-memory-${transactionId}-${slot}.tmp`);
}

function validateFailpointControl(control) {
  if (!FAILPOINTS.has(control.name)) return;
  if (typeof control.send !== "function") fail(6, "FAILPOINT_UNAVAILABLE", "requested V2 test failpoint requires an IPC controller");
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

function requireExactKeys(value, expected, label, onError) {
  if (!value || typeof value !== "object" || Array.isArray(value)) onError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) onError(`${label} contains missing or unknown fields`);
}

function requireString(value, label, maximum, pattern, onError) {
  if (typeof value !== "string" || value.trim().length === 0 || [...value].length > maximum) onError(`${label} is invalid`);
  if (pattern && !pattern.test(value)) onError(`${label} has invalid syntax`);
}

function requireSingleLine(value, label, maximum) {
  requireString(value, label, maximum, undefined, invalidSchema);
  if (/[\r\n\0]/.test(value)) invalidSchema(`${label} must be a single line`);
}

function requireHash(value, label, length, onError) {
  if (typeof value !== "string" || !new RegExp(`^[a-f0-9]{${length}}$`).test(value)) onError(`${label} is invalid`);
}

function requireBase64(value, label, onError) {
  if (typeof value !== "string" || Buffer.from(value, "base64").toString("base64") !== value) onError(`${label} is invalid`);
}

function sameArray(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function isReservedName(value) {
  const reserved = new Set(["lembranca", "memoria", "memorias", "conhecimento", "index", "readme", "referencias", "artefatos"]);
  return reserved.has(value.toLowerCase()) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(exitCode, code, message) {
  throw new ThemeV2TransactionError(exitCode, code, message);
}

function invalidSchema(message) {
  fail(2, "INVALID_SCHEMA", message);
}

function planConflict(message) {
  fail(4, "PLAN_CONFLICT", message);
}

function recoveryConflict(message) {
  fail(4, "RECOVERY_CONFLICT", message);
}

function safetyBlocked(message) {
  fail(3, "SAFETY_BLOCKED", message);
}

function journalFailure(command, message) {
  fail(4, command === "recover" ? "RECOVERY_CONFLICT" : "JOURNAL_CONFLICT", message);
}

function safetyFailure(command, message) {
  fail(3, "SAFETY_BLOCKED", message);
}

module.exports = {
  PUBLISH_ORDER,
  ROLLBACK_ORDER,
  ThemeV2TransactionError,
  applyThemeV2,
  deriveTransactionId,
  recoverThemeV2,
  validateDirectoryBaselineShape,
  validatePlan
};
