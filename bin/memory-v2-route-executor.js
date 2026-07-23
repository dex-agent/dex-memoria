"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { createHash, randomUUID } = require("crypto");
const { validateMemoryCapabilityUnit } = require("./memory-v2-capabilities");

const JOURNAL_DIRECTORY = ".dex-memoria/transactions";
const INCOMPLETE_LOCK_GRACE_MILLISECONDS = 30_000;

async function executeMemoryRoute(route, candidate, options = {}) {
  const fileSystem = options.file_system || fsp;
  const producerProvenance = normalizeProducerProvenance(options.producer_provenance);
  let mutex;
  try {
    validateRoute(route);
    validateCandidate(candidate);
    await assertSafeAncestors(fileSystem, route.resolved_root);
    mutex = await acquireRouteMutex(fileSystem, route, "apply");
    await assertSafeAncestors(fileSystem, route.resolved_root);
    const l1Name = await resolveL1FileName(fileSystem, route);
    const paths = resolveTransactionPaths(route, candidate, l1Name);
    await assertSafeAncestors(fileSystem, paths.l1);
    await assertSafeAncestors(fileSystem, paths.destination);
    await assertSafeAncestors(fileSystem, paths.journal);
    await assertCanonicalPathCasing(fileSystem, paths.l1);
    await assertCanonicalPathCasing(fileSystem, paths.destination);
    const existing = await readJsonIfExists(fileSystem, paths.journal);
    const requestHash = hashJson({ route, candidate });
    if (existing) {
      validateStoredJournal(route, existing, paths);
      if (existing.request_hash !== requestHash || existing.state !== "COMMITTED" || !existing.receipt) {
        return existingTransactionResult(existing, requestHash, paths.receipt);
      }
      await assertStoredReceiptMatchesJournal(fileSystem, paths.receipt, existing.receipt);
      return await refreshCommittedTransaction(fileSystem, route, candidate, paths, existing);
    }

    if (!producerProvenance) {
      return failed(route, "PRODUCER_PROVENANCE_REQUIRED", "new route commits require producer provenance");
    }

    const oppositeDestination = candidate.target_layer === "L2"
      ? path.join(route.resolved_root, "conhecimento", candidate.slug, "README.md")
      : path.join(route.resolved_root, "memorias", `${candidate.slug}.md`);
    await assertSafeAncestors(fileSystem, oppositeDestination);
    await assertCanonicalPathCasing(fileSystem, oppositeDestination);
    if (await exists(fileSystem, oppositeDestination)) {
      return failed(route, "ROUTE_CONFLICT", "slug is already active in L2 or L3");
    }

    const before = {
      l1: await snapshot(fileSystem, paths.l1),
      destination: await snapshot(fileSystem, paths.destination)
    };
    const identities = deriveStableIdentities(route, candidate, paths.l1_name);
    const l1Bytes = renderL1(before.l1, candidate);
    const destinationBytes = renderDestination(route, candidate, paths.l1_name);
    if (before.destination.exists) {
      const existingDestination = Buffer.from(before.destination.bytes_base64, "base64");
      const existingL1 = before.l1.exists ? Buffer.from(before.l1.bytes_base64, "base64").toString("utf8") : "";
      if (!existingDestination.equals(destinationBytes) || !hasExactL1Entry(existingL1, route, candidate)) {
        return failed(route, "ROUTE_CONFLICT", "slug exists with materially different content or routing");
      }
      await fileSystem.mkdir(paths.transaction_root, { recursive: true });
      const validationReceipt = await validateWrittenUnit(route, paths);
      const receipt = committedReceipt(route, paths, Buffer.from(before.l1.bytes_base64, "base64"), destinationBytes, validationReceipt, identities, true, producerProvenance);
      const journal = {
        contract: "dex.memory.route.journal.v2",
        state: "COMMITTED",
        request_hash: requestHash,
        route,
        candidate,
        paths: { l1: paths.l1, destination: paths.destination, receipt: paths.receipt },
        before,
        receipt
      };
      await writeJsonAtomic(fileSystem, paths.validation, validationReceipt, route.transaction_id, route.resolved_root);
      await writeJsonAtomic(fileSystem, paths.receipt, receipt, route.transaction_id, route.resolved_root);
      await writeJsonAtomic(fileSystem, paths.journal, journal, route.transaction_id, route.resolved_root);
      return receipt;
    }
    await fileSystem.mkdir(paths.transaction_root, { recursive: true });
    const journal = {
      contract: "dex.memory.route.journal.v2",
      state: "PREPARED",
      request_hash: requestHash,
      route,
      candidate,
      paths: { l1: paths.l1, destination: paths.destination, receipt: paths.receipt },
      before
    };
    await writeJsonAtomic(fileSystem, paths.journal, journal, route.transaction_id, route.resolved_root);

    try {
      await writeBytesAtomic(fileSystem, paths.destination, destinationBytes, route.transaction_id, "destination", route.resolved_root);
      journal.state = "DESTINATION_PUBLISHED";
      await writeJsonAtomic(fileSystem, paths.journal, journal, route.transaction_id, route.resolved_root);
      await writeBytesAtomic(fileSystem, paths.l1, l1Bytes, route.transaction_id, "l1", route.resolved_root);
      journal.state = "L1_PUBLISHED";
      await writeJsonAtomic(fileSystem, paths.journal, journal, route.transaction_id, route.resolved_root);

      const validationReceipt = await validateWrittenUnit(route, paths);
      await writeJsonAtomic(fileSystem, paths.validation, validationReceipt, route.transaction_id, route.resolved_root);
      const receipt = committedReceipt(route, paths, l1Bytes, destinationBytes, validationReceipt, identities, false, producerProvenance);
      await writeJsonAtomic(fileSystem, paths.receipt, receipt, route.transaction_id, route.resolved_root);
      journal.state = "COMMITTED";
      journal.receipt = receipt;
      await writeJsonAtomic(fileSystem, paths.journal, journal, route.transaction_id, route.resolved_root);
      return receipt;
    } catch (error) {
      try {
        await restore(fileSystem, paths.destination, before.destination, route.resolved_root, route.transaction_id, "destination-restore");
        await restore(fileSystem, paths.l1, before.l1, route.resolved_root, route.transaction_id, "l1-restore");
        await removePublishTemporaries(fileSystem, paths, route.transaction_id, route.resolved_root);
        journal.state = "ROLLED_BACK";
        journal.failure_code = error.code || "ROUTE_IO_FAILURE";
        await writeJsonAtomic(fileSystem, paths.journal, journal, route.transaction_id, route.resolved_root);
        return failed(route, "TRANSACTION_ROLLED_BACK", "route write failed and was rolled back; retry with a new operation_id", false, journal.failure_code);
      } catch (rollbackError) {
        return failed(route, "ROLLBACK_REQUIRED", "route write failed and requires recover", true);
      }
    }
  } catch (error) {
    return failed(route, error.code || "ROUTE_EXECUTION_FAILED", error.message || "route execution failed", Boolean(error.recoverable));
  } finally {
    if (mutex) await releaseRouteMutex(fileSystem, mutex);
  }
}

async function recoverMemoryRoute(route, options = {}) {
  const fileSystem = options.file_system || fsp;
  let mutex;
  try {
    validateRoute(route);
    await assertSafeAncestors(fileSystem, route.resolved_root);
    mutex = await acquireRouteMutex(fileSystem, route, "recover");
    const transactionRoot = path.join(route.resolved_root, ...JOURNAL_DIRECTORY.split("/"), route.transaction_id);
    const journalPath = path.join(transactionRoot, "journal.json");
    await assertSafeAncestors(fileSystem, journalPath);
    const journal = await readJsonIfExists(fileSystem, journalPath);
    if (!journal) return failed(route, "JOURNAL_NOT_FOUND", "route journal was not found");
    validateCandidate(journal.candidate);
    const l1Name = await resolveL1FileName(fileSystem, route);
    const paths = resolveTransactionPaths(route, journal.candidate, l1Name);
    validateStoredJournal(route, journal, paths);
    if (journal.state === "COMMITTED") return { ...journal.receipt, recovery_status: "ALREADY_COMMITTED" };
    if (journal.state === "ROLLED_BACK") return recoveryReceipt(route, journalPath, "ALREADY_ROLLED_BACK");
    await assertSafeAncestors(fileSystem, paths.l1);
    await assertSafeAncestors(fileSystem, paths.destination);
    await assertRecoveryStateMatches(fileSystem, journal, paths);
    await restore(fileSystem, paths.destination, journal.before.destination, route.resolved_root, route.transaction_id, "destination-recover");
    await restore(fileSystem, paths.l1, journal.before.l1, route.resolved_root, route.transaction_id, "l1-recover");
    await removePublishTemporaries(fileSystem, paths, route.transaction_id, route.resolved_root);
    journal.state = "ROLLED_BACK";
    await writeJsonAtomic(fileSystem, journalPath, journal, route.transaction_id, route.resolved_root);
    return recoveryReceipt(route, journalPath, "ROLLED_BACK");
  } catch (error) {
    return failed(route, error.code || "RECOVERY_FAILED", error.message || "route recovery failed", true);
  } finally {
    if (mutex) await releaseRouteMutex(fileSystem, mutex);
  }
}

async function acquireRouteMutex(fileSystem, route, mode) {
  const controlRoot = path.join(route.resolved_root, ".dex-memoria");
  await assertSafeAncestors(fileSystem, route.resolved_root);
  await fileSystem.mkdir(controlRoot, { recursive: true });
  await assertSafeAncestors(fileSystem, controlRoot);
  const lockPath = path.join(controlRoot, "write.lock");
  const record = {
    contract: "dex.memory.route-lock.v2",
    owner_token: randomUUID(),
    pid: process.pid,
    created_at: new Date().toISOString(),
    operation_id: route.operation_id,
    transaction_id: route.transaction_id,
    idempotency_key: route.idempotency_key
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const handle = await fileSystem.open(lockPath, "wx");
      try {
        await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
        return { handle, lockPath, ownerToken: record.owner_token };
      } catch (error) {
        await handle.close().catch(() => {});
        await fileSystem.unlink(lockPath).catch(() => {});
        throw error;
      }
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await assertSafeAncestors(fileSystem, lockPath);
      const existing = await readJsonIfExists(fileSystem, lockPath).catch(() => null);
      if (!existing) {
        const lockStat = await fileSystem.lstat(lockPath);
        if (Date.now() - lockStat.mtimeMs <= INCOMPLETE_LOCK_GRACE_MILLISECONDS) {
          invalidRecoverable("ROUTE_BUSY", "another writer is initializing this resolved_root mutex");
        }
        await fileSystem.unlink(lockPath);
        continue;
      }
      if (isProcessAlive(existing.pid)) {
        invalidRecoverable("ROUTE_BUSY", "another live writer owns this resolved_root");
      }
      const journalPath = path.join(route.resolved_root, ...JOURNAL_DIRECTORY.split("/"), route.transaction_id, "journal.json");
      const journal = await readJsonIfExists(fileSystem, journalPath);
      await reclaimDeadMutex(fileSystem, lockPath, existing.owner_token);
      if (mode === "apply" && journal && !["COMMITTED", "ROLLED_BACK"].includes(journal.state)) {
        invalidRecoverable("RECOVERY_REQUIRED", `transaction is ${journal.state}; recover before retry`);
      }
    }
  }
  invalidRecoverable("ROUTE_BUSY", "route mutex changed while it was being acquired");
}

async function reclaimDeadMutex(fileSystem, lockPath, expectedOwnerToken) {
  const current = await readJsonIfExists(fileSystem, lockPath).catch(() => null);
  if (!current || current.owner_token !== expectedOwnerToken) {
    invalidRecoverable("ROUTE_BUSY", "route mutex ownership changed during stale-owner reconciliation");
  }
  await fileSystem.unlink(lockPath);
}

async function releaseRouteMutex(fileSystem, mutex) {
  await mutex.handle.close().catch(() => {});
  const current = await readJsonIfExists(fileSystem, mutex.lockPath).catch(() => null);
  if (current?.owner_token === mutex.ownerToken) await fileSystem.unlink(mutex.lockPath).catch(() => {});
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function validateRoute(route) {
  if (!route || typeof route !== "object" || !["project", "global", "theme"].includes(route.scope)) invalid("INVALID_ROUTE", "route is invalid");
  for (const field of ["resolved_root", "operation_id", "idempotency_key", "transaction_id", "receipt_id"]) {
    if (typeof route[field] !== "string" || route[field].trim() === "") invalid("INVALID_ROUTE", `${field} is invalid`);
  }
  if (!path.isAbsolute(route.resolved_root)) invalid("INVALID_ROUTE", "resolved_root must be absolute");
}

function validateCandidate(candidate) {
  if (!candidate || candidate.contract !== "dex.memory.write.candidate.v2" || !["L2", "L3"].includes(candidate.target_layer)) {
    invalid("INVALID_CANDIDATE", "candidate contract or target_layer is invalid");
  }
  const expected = ["body", "contract", "slug", "tags", "target_layer", "title", "trigger"];
  if (candidate.target_layer === "L3") expected.push("owner_skill");
  const actual = Object.keys(candidate).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected.sort()[index])) {
    invalid("INVALID_CANDIDATE", "candidate contains missing or unknown fields");
  }
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug) ||
    [...candidate.slug].length > 80 ||
    RESERVED_SLUGS.has(candidate.slug)
  ) invalid("INVALID_CANDIDATE", "slug is invalid");
  if (!Array.isArray(candidate.tags) || candidate.tags.length === 0 || new Set(candidate.tags).size !== candidate.tags.length) {
    invalid("INVALID_CANDIDATE", "tags must be a non-empty unique array");
  }
  for (const tag of candidate.tags) {
    if (typeof tag !== "string" || !/^#[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(tag)) {
      invalid("INVALID_CANDIDATE", "tags must be nested lowercase non-generic tag names");
    }
  }
  if (!isSingleLineText(candidate.trigger, 512)) invalid("INVALID_CANDIDATE", "trigger is invalid");
  if (!isSingleLineText(candidate.title, 256)) invalid("INVALID_CANDIDATE", "title is invalid");
  if (typeof candidate.body !== "string" || candidate.body.trim() === "" || [...candidate.body].length > 65536) {
    invalid("INVALID_CANDIDATE", "body is invalid");
  }
  if (candidate.target_layer === "L3" && (
    typeof candidate.owner_skill !== "string" ||
    [...candidate.owner_skill].length > 128 ||
    !/^[a-z0-9]+(?:(?:-|:)[a-z0-9]+)*$/.test(candidate.owner_skill)
  )) {
    invalid("INVALID_CANDIDATE", "L3 requires a canonical owner_skill");
  }
}

const RESERVED_SLUGS = new Set([
  "lembranca", "memoria", "memorias", "conhecimento", "index", "readme", "referencias", "artefatos",
  "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"
]);

function isSingleLineText(value, maxCodePoints) {
  return typeof value === "string" &&
    [...value].length <= maxCodePoints &&
    !/[\r\n\u0000]/.test(value) &&
    /\S/.test(value);
}

function resolveTransactionPaths(route, candidate, l1Name) {
  const destination = candidate.target_layer === "L2"
    ? path.join(route.resolved_root, "memorias", `${candidate.slug}.md`)
    : path.join(route.resolved_root, "conhecimento", candidate.slug, "README.md");
  const transactionRoot = path.join(route.resolved_root, ...JOURNAL_DIRECTORY.split("/"), route.transaction_id);
  return {
    l1: path.join(route.resolved_root, l1Name),
    l1_name: l1Name,
    destination,
    transaction_root: transactionRoot,
    journal: path.join(transactionRoot, "journal.json"),
    receipt: path.join(transactionRoot, "receipt.json"),
    validation: path.join(transactionRoot, "validation.json")
  };
}

function renderL1(before, candidate) {
  const existing = before.exists ? Buffer.from(before.bytes_base64, "base64").toString("utf8").replace(/\r\n?/g, "\n").trimEnd() : "# Lembranças\n";
  return Buffer.from(`${existing}\n\n${renderL1Entry(candidate)}\n`, "utf8");
}

function renderL1Entry(candidate) {
  const relative = candidate.target_layer === "L2"
    ? `memorias/${candidate.slug}.md`
    : `conhecimento/${candidate.slug}/README.md`;
  const wikiTarget = relative.replace(/\.md$/i, "");
  return `- ${candidate.trigger} -> [${candidate.title}](${relative}) [[${wikiTarget}|${candidate.title}]] ${candidate.tags.join(" ")} ^${candidate.slug}`;
}

function renderDestination(route, candidate, l1Name) {
  const owner = candidate.target_layer === "L3" ? `owner_skill: ${candidate.owner_skill}\n` : "";
  const l1Relative = candidate.target_layer === "L2" ? `../${l1Name}` : `../../${l1Name}`;
  const wikiL1 = l1Name.replace(/\.md$/i, "");
  const backlink = `[Voltar às lembranças](${l1Relative}) [[${wikiL1}|Lembranças]]`;
  const tags = candidate.tags.map((tag) => `  - "${tag}"`).join("\n");
  return Buffer.from(`---\nimplementation_version: v2\nlayer: ${candidate.target_layer}\nslug: ${candidate.slug}\ntags:\n${tags}\n${owner}---\n\n# ${candidate.title}\n\n${candidate.body}\n\n${candidate.tags.join(" ")}\n\n${backlink}\n\n^${candidate.slug}-content\n`, "utf8");
}

function committedReceipt(route, paths, l1Bytes, destinationBytes, validationReceipt, identities, deduplicated, producerProvenance = null) {
  const receipt = {
    contract: "dex.memory.route.receipt.v2",
    status: "COMMITTED",
    scope: route.scope,
    resolved_root: route.resolved_root,
    operation_id: route.operation_id,
    idempotency_key: route.idempotency_key,
    transaction_id: route.transaction_id,
    receipt_id: route.receipt_id,
    receipt_path: paths.receipt,
    validation_receipt_path: paths.validation,
    validation_receipt_hash: sha256(serializeJson(validationReceipt)),
    validation_contract: validationReceipt.contract,
    validation_ok: validationReceipt.ok,
    candidate_id: identities.candidate_id,
    content_hash: identities.content_hash,
    route_identity: identities.route_identity,
    deduplicated,
    write_set_hash: sha256(Buffer.concat([l1Bytes, Buffer.from("\0"), destinationBytes])),
    target_hashes: {
      l1: sha256(l1Bytes),
      destination: sha256(destinationBytes)
    }
  };
  if (producerProvenance) {
    receipt.receipt_revision = 2;
    receipt.producer_provenance = { ...producerProvenance };
  }
  return receipt;
}

function normalizeProducerProvenance(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid("INVALID_PRODUCER_PROVENANCE", "producer provenance must be an object");
  }
  const keys = Object.keys(value).sort();
  if (keys.join("\0") !== ["entrypoint_realpath", "entrypoint_sha256"].join("\0")) {
    invalid("INVALID_PRODUCER_PROVENANCE", "producer provenance fields are invalid");
  }
  if (!path.isAbsolute(value.entrypoint_realpath)) {
    invalid("INVALID_PRODUCER_PROVENANCE", "producer entrypoint realpath must be absolute");
  }
  if (!/^[a-f0-9]{64}$/.test(value.entrypoint_sha256)) {
    invalid("INVALID_PRODUCER_PROVENANCE", "producer entrypoint sha256 is invalid");
  }
  return Object.freeze({
    entrypoint_realpath: path.resolve(value.entrypoint_realpath),
    entrypoint_sha256: value.entrypoint_sha256
  });
}

function l1FileName(route) {
  return route.scope === "project" ? "lembranca.md" : "LEMBRANCA.md";
}

async function resolveL1FileName(fileSystem, route) {
  const preferred = l1FileName(route);
  let entries;
  try {
    entries = await fileSystem.readdir(route.resolved_root);
  } catch (error) {
    if (error.code === "ENOENT") return preferred;
    throw error;
  }
  const equivalents = entries.filter((entry) => entry.toLowerCase() === preferred.toLowerCase());
  if (equivalents.length > 1) {
    invalid("CASE_COLLISION", `multiple case-equivalent L1 files exist under resolved_root: ${route.resolved_root}`);
  }
  return equivalents[0] ?? preferred;
}

function deriveStableIdentities(route, candidate, l1Name) {
  const candidateId = hashJson(candidate);
  const destinationBytes = renderDestination(route, candidate, l1Name);
  return {
    candidate_id: candidateId,
    content_hash: sha256(destinationBytes),
    route_identity: hashJson({
      scope: route.scope,
      theme: route.theme ?? null,
      resolved_root: path.resolve(route.resolved_root).toLowerCase(),
      candidate_id: candidateId
    })
  };
}

function hasExactL1Entry(content, route, candidate) {
  void route;
  return content.replace(/\r\n?/g, "\n").split("\n").includes(renderL1Entry(candidate));
}

async function validateWrittenUnit(route, paths) {
  const validationReceipt = await validateMemoryCapabilityUnit({
    capability: "v2-obsidian",
    require_obsidian: true,
    root: route.resolved_root,
    touched_paths: [
      paths.l1_name,
      path.relative(route.resolved_root, paths.destination).split(path.sep).join("/")
    ]
  });
  if (!validationReceipt.ok) invalid("CAPABILITY_VALIDATION_FAILED", "written V2 unit failed Obsidian validation");
  return validationReceipt;
}

async function assertCanonicalPathCasing(fileSystem, targetPath) {
  // Publication casing is a cross-platform contract. Enforce it even on
  // case-sensitive hosts so an artifact cannot pass Linux and collide later
  // when consumed on a case-insensitive filesystem.
  const absolute = path.resolve(targetPath);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    let entries;
    try {
      entries = await fileSystem.readdir(current);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    const equivalents = entries.filter((entry) => entry.toLowerCase() === segment.toLowerCase());
    if (equivalents.length > 1 || (equivalents.length === 1 && equivalents[0] !== segment)) {
      invalid("CASE_COLLISION", `case-equivalent path does not match canonical casing: ${targetPath}`);
    }
    current = path.join(current, equivalents[0] ?? segment);
  }
}

function existingTransactionResult(journal, requestHash, receiptPath) {
  if (journal.request_hash !== requestHash) return failed(journal.route, "IDEMPOTENCY_CONFLICT", "idempotency key belongs to another request");
  if (journal.state === "COMMITTED" && journal.receipt) return journal.receipt;
  if (journal.state === "ROLLED_BACK") {
    return failed(journal.route, "TRANSACTION_ROLLED_BACK", "transaction was rolled back; use a new operation_id", false, journal.failure_code);
  }
  return failed(journal.route, "RECOVERY_REQUIRED", `transaction is ${journal.state}; recover before retry`, true, receiptPath);
}

async function refreshCommittedTransaction(fileSystem, route, candidate, paths, journal) {
  const currentL1 = await snapshot(fileSystem, paths.l1);
  const currentDestination = await snapshot(fileSystem, paths.destination);
  if (!currentL1.exists || !currentDestination.exists) {
    return failed(route, "ROUTE_CONFLICT", "committed route targets are missing");
  }
  const l1Bytes = Buffer.from(currentL1.bytes_base64, "base64");
  const destinationBytes = Buffer.from(currentDestination.bytes_base64, "base64");
  const expectedDestination = renderDestination(route, candidate, paths.l1_name);
  if (!destinationBytes.equals(expectedDestination) || !hasExactL1Entry(l1Bytes.toString("utf8"), route, candidate)) {
    return failed(route, "ROUTE_CONFLICT", "committed route has materially different content or routing");
  }
  const validationReceipt = await validateWrittenUnit(route, paths);
  if (journal.receipt?.receipt_revision === undefined && journal.receipt?.producer_provenance === undefined) {
    return structuredClone(journal.receipt);
  }
  const originalProvenance = journal.receipt?.receipt_revision === 2
    ? normalizeProducerProvenance(journal.receipt.producer_provenance)
    : null;
  const receipt = committedReceipt(route, paths, l1Bytes, destinationBytes, validationReceipt, deriveStableIdentities(route, candidate, paths.l1_name), true, originalProvenance);
  journal.receipt = receipt;
  await writeJsonAtomic(fileSystem, paths.validation, validationReceipt, route.transaction_id, route.resolved_root);
  await writeJsonAtomic(fileSystem, paths.receipt, receipt, route.transaction_id, route.resolved_root);
  await writeJsonAtomic(fileSystem, paths.journal, journal, route.transaction_id, route.resolved_root);
  return receipt;
}

async function assertStoredReceiptMatchesJournal(fileSystem, receiptPath, journalReceipt) {
  let storedBytes;
  try {
    storedBytes = await fileSystem.readFile(receiptPath);
  } catch (error) {
    invalid("RECEIPT_JOURNAL_DIVERGENCE", "committed receipt file is missing or unreadable");
  }
  if (!Buffer.from(storedBytes).equals(serializeJson(journalReceipt))) {
    invalid("RECEIPT_JOURNAL_DIVERGENCE", "committed receipt file differs from journal receipt");
  }
}

function validateStoredJournal(route, journal, expectedPaths) {
  const identityFields = ["scope", "theme", "resolved_root", "operation_id", "idempotency_key", "transaction_id", "receipt_id"];
  const routeMatches = journal.route && identityFields.every((field) => (journal.route[field] ?? null) === (route[field] ?? null));
  const pathsMatch = !expectedPaths || (
    journal.paths &&
    journal.paths.l1 === expectedPaths.l1 &&
    journal.paths.destination === expectedPaths.destination &&
    journal.paths.receipt === expectedPaths.receipt
  );
  const requestMatches = journal.candidate && journal.request_hash === hashJson({ route, candidate: journal.candidate });
  const stateValid = ["PREPARED", "DESTINATION_PUBLISHED", "L1_PUBLISHED", "COMMITTED", "ROLLED_BACK"].includes(journal.state);
  if (journal.contract !== "dex.memory.route.journal.v2" || !routeMatches || !pathsMatch || !requestMatches || !stateValid) {
    invalid("JOURNAL_CONFLICT", "stored journal does not belong to this route");
  }
}

async function assertRecoveryStateMatches(fileSystem, journal, paths) {
  const current = {
    l1: await snapshot(fileSystem, paths.l1),
    destination: await snapshot(fileSystem, paths.destination)
  };
  const published = {
    l1: bytesSnapshot(renderL1(journal.before.l1, journal.candidate)),
    destination: bytesSnapshot(renderDestination(journal.route, journal.candidate, paths.l1_name))
  };
  const baselineRestored = sameSnapshot(current.l1, journal.before.l1)
    && sameSnapshot(current.destination, journal.before.destination);
  if (baselineRestored) return;
  const allowed = journal.state === "PREPARED"
    ? { l1: [journal.before.l1], destination: [journal.before.destination, published.destination] }
    : journal.state === "DESTINATION_PUBLISHED"
      ? { l1: [journal.before.l1, published.l1], destination: [published.destination] }
      : { l1: [published.l1], destination: [published.destination] };
  if (!matchesAnySnapshot(current.l1, allowed.l1) || !matchesAnySnapshot(current.destination, allowed.destination)) {
    invalid("RECOVERY_CONFLICT", "route targets changed after the recorded checkpoint");
  }
}

function bytesSnapshot(bytes) {
  return { exists: true, bytes_base64: bytes.toString("base64") };
}

function sameSnapshot(actual, expected) {
  return Boolean(actual?.exists) === Boolean(expected?.exists) && String(actual?.bytes_base64 ?? "") === String(expected?.bytes_base64 ?? "");
}

function matchesAnySnapshot(actual, expectedSnapshots) {
  return expectedSnapshots.some((expected) => sameSnapshot(actual, expected));
}

async function snapshot(fileSystem, filePath) {
  try {
    const before = await fileSystem.lstat(filePath);
    if (before.isSymbolicLink() || !before.isFile()) {
      invalid("SAFETY_BOUNDARY", `snapshot target must be a regular file: ${filePath}`);
    }
    const bytes = await fileSystem.readFile(filePath);
    const after = await fileSystem.lstat(filePath);
    if (after.isSymbolicLink() || !after.isFile() || fileIdentity(before) !== fileIdentity(after)) {
      invalid("SAFETY_BOUNDARY", `snapshot target identity changed while reading: ${filePath}`);
    }
    return { exists: true, bytes_base64: bytes.toString("base64") };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, bytes_base64: "" };
    throw error;
  }
}

function fileIdentity(stat) {
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`;
}

async function exists(fileSystem, filePath) {
  try {
    await fileSystem.lstat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeBytesAtomic(fileSystem, filePath, bytes, transactionId, slot, boundaryRoot) {
  await assertSafeAncestors(fileSystem, path.dirname(filePath));
  await fileSystem.mkdir(path.dirname(filePath), { recursive: true });
  await assertSafeAncestors(fileSystem, path.dirname(filePath));
  const temporary = `${filePath}.${transactionId}.${slot}.tmp`;
  await fileSystem.writeFile(temporary, bytes, { flag: "wx" });
  await assertSafeAncestors(fileSystem, path.dirname(filePath));
  assertLexicallyContained(boundaryRoot, filePath);
  await fileSystem.rename(temporary, filePath);
}

async function writeJsonAtomic(fileSystem, filePath, value, transactionId, boundaryRoot) {
  await assertSafeAncestors(fileSystem, path.dirname(filePath));
  await fileSystem.mkdir(path.dirname(filePath), { recursive: true });
  await assertSafeAncestors(fileSystem, path.dirname(filePath));
  const temporary = `${filePath}.${transactionId}.tmp`;
  await fileSystem.writeFile(temporary, serializeJson(value), { flag: "wx" });
  await assertSafeAncestors(fileSystem, path.dirname(filePath));
  assertLexicallyContained(boundaryRoot, filePath);
  await fileSystem.rename(temporary, filePath);
}

async function restore(fileSystem, filePath, before, boundaryRoot, transactionId, slot) {
  assertLexicallyContained(boundaryRoot, filePath);
  await assertSafeAncestors(fileSystem, filePath);
  if (before.exists) {
    await writeBytesAtomic(fileSystem, filePath, Buffer.from(before.bytes_base64, "base64"), transactionId, slot, boundaryRoot);
  } else {
    await assertSafeAncestors(fileSystem, filePath);
    await fileSystem.rm(filePath, { force: true });
  }
}

async function removePublishTemporaries(fileSystem, paths, transactionId, boundaryRoot) {
  const ownedPaths = [
    `${paths.destination}.${transactionId}.destination.tmp`,
    `${paths.l1}.${transactionId}.l1.tmp`,
    paths.receipt,
    paths.validation,
    `${paths.journal}.${transactionId}.tmp`,
    `${paths.receipt}.${transactionId}.tmp`,
    `${paths.validation}.${transactionId}.tmp`
  ].filter(Boolean);
  for (const ownedPath of ownedPaths) {
    assertLexicallyContained(boundaryRoot, ownedPath);
    await assertSafeAncestors(fileSystem, path.dirname(ownedPath));
    await fileSystem.rm(ownedPath, { force: true });
  }
}

async function assertSafeAncestors(fileSystem, targetPath) {
  const absoluteTarget = path.resolve(targetPath);
  const parsed = path.parse(absoluteTarget);
  let current = parsed.root;
  const segments = absoluteTarget.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const stat = await fileSystem.lstat(current);
      if (stat.isSymbolicLink()) invalid("SAFETY_BOUNDARY", `reparse ancestor is not allowed: ${current}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function assertLexicallyContained(boundaryRoot, targetPath) {
  const relative = path.relative(path.resolve(boundaryRoot), path.resolve(targetPath));
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    invalid("SAFETY_BOUNDARY", "target escapes the canonical resolved_root");
  }
}

async function readJsonIfExists(fileSystem, filePath) {
  try {
    return JSON.parse(await fileSystem.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function recoveryReceipt(route, journalPath, recoveryStatus) {
  return {
    contract: "dex.memory.route.recovery.v2",
    status: "ROLLED_BACK",
    recovery_status: recoveryStatus,
    scope: route.scope,
    operation_id: route.operation_id,
    idempotency_key: route.idempotency_key,
    transaction_id: route.transaction_id,
    journal_path: journalPath
  };
}

function failed(route, code, message, recoverable = false, causeCode = null) {
  return {
    contract: "dex.memory.route.failure.v2",
    status: "FAILED",
    scope: route?.scope,
    operation_id: route?.operation_id,
    idempotency_key: route?.idempotency_key,
    transaction_id: route?.transaction_id,
    receipt_id: route?.receipt_id,
    code,
    message,
    recoverable,
    ...(typeof causeCode === "string" ? { cause_code: causeCode } : {})
  };
}

function invalid(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function invalidRecoverable(code, message) {
  const error = new Error(message);
  error.code = code;
  error.recoverable = true;
  throw error;
}

function hashJson(value) {
  return sha256(Buffer.from(JSON.stringify(sortValue(value)), "utf8"));
}

function serializeJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

module.exports = { executeMemoryRoute, recoverMemoryRoute, validateCandidate };
