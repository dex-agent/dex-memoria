"use strict";

const { constants } = require("node:fs");
const fs = require("node:fs/promises");
const { createHash } = require("node:crypto");
const path = require("node:path");

const FIXTURE_MARKER = ".dex-memory-fingerprint-fixture.json";
const LAB_MARKER = ".dex-memory-fingerprint-lab.json";
const SCHEMA = "dex.memory.vault-fingerprint.v0";
const CONTRACT_VERSION = "0";
const FIXTURE_PROFILE = "fixture-governed-vault-v1";
const LIVE_PROFILE = "governed-vault-v1";
const ALGORITHM = "sha256";
const REPRESENTATION_VERSION = "utf8-preserved-windows-conservative-key-v2";
const EXCLUSION_SET_ID = "governed-vault-root-operational-v1";
// Node on Windows does not provide a dependable O_NOFOLLOW guarantee. This
// harness remains fixture-only and combines a disposable lab boundary, lstat,
// handle/path identity checks and revalidation; the live profile stays blocked.
const NO_FOLLOW_ASSURANCE = "fixture-lstat-handle-revalidation-live-blocked";
const GOVERNED_DIRECTORIES = ["global", "temas", "principles", "domains", "extensions"];
const ROOT_FILES = ["AGENTS.md", "MEMORY.md", "LEMBRANCA.md", "MEMORIA.md"];
const ROOT_EXCLUSIONS = new Map([
  [".git", "VCS_METADATA"],
  [".agents", "OPERATIONAL_STATE"],
  [".ppirtv", "OPERATIONAL_STATE"],
  [".obsidian", "UI_STATE"],
  [".codex", "OPERATIONAL_STATE"],
  ["graphify-out", "DERIVED_INDEX"],
  ["backups", "BACKUP_RESIDUE"],
  [".backups", "BACKUP_RESIDUE"],
  ["node_modules", "DEPENDENCY_TREE"],
  ["caches", "CACHE_RESIDUE"],
  ["logs", "LOG_RESIDUE"],
  [".env", "SENSITIVE_CONFIG"],
  ["config.toml", "SENSITIVE_CONFIG"]
]);
const SENSITIVE_OMISSIONS = new Set([".env", "config.toml"]);
const EXCLUSION_REASON_CODES = new Set(ROOT_EXCLUSIONS.values());
const STRUCTURAL_REASON_CODES = new Set([
  "ACCESS_DENIED",
  "CASEFOLD_COLLISION",
  "FILESYSTEM_OBSERVATION_BLOCKED",
  "FIXTURE_MARKER_REQUIRED",
  "GOVERNED_ROOT_MISSING",
  "HARDLINK_AMBIGUOUS",
  "LAB_BOUNDARY_REQUIRED",
  "LAB_CONTAINMENT_UNPROVEN",
  "LAB_IDENTITY_MISMATCH",
  "LIVE_PROFILE_BLOCKED",
  "PATH_ESCAPE_BLOCKED",
  "PROFILE_BLOCKED",
  "REPRESENTATION_LIMIT",
  "REQUIRED_ROOT_FILE_MISSING",
  "SENSITIVE_GOVERNED_ENTRY",
  "UNDECLARED_ROOT_ENTRY",
  "UNICODE_EQUIVALENCE_COLLISION",
  "UNSAFE_FILESYSTEM_TYPE",
  "UNSAFE_FIXTURE_ROOT"
]);
const RESULT_STATUSES = new Set(["OBSERVED_STABLE", "DIFFERENT", "NOT_COMPARABLE", "OBSERVATION_UNSTABLE"]);
const OPERATIONAL_FILESYSTEM_CODES = new Set([
  "EACCES", "EBADF", "EBUSY", "EIO", "EISDIR", "ELOOP", "EMFILE", "ENAMETOOLONG",
  "ENFILE", "ENOENT", "ENOSPC", "ENOTDIR", "EPERM", "EROFS", "ESTALE"
]);

class FingerprintError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FingerprintError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new FingerprintError(code, message);
}

function isMissing(error) {
  return error && error.code === "ENOENT";
}

function failFilesystem(error, fallbackCode = "FILESYSTEM_OBSERVATION_BLOCKED") {
  if (!error || typeof error.code !== "string" || !OPERATIONAL_FILESYSTEM_CODES.has(error.code)) throw error;
  if (error.code === "EACCES" || error.code === "EPERM") fail("ACCESS_DENIED", "Fixture observation failed closed.");
  if (error.code === "ELOOP") fail("UNSAFE_FILESYSTEM_TYPE", "An unsafe filesystem type was blocked.");
  fail(fallbackCode, "Fixture observation failed closed.");
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode &&
    left.size === right.size && left.nlink === right.nlink && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function assertContained(root, absolute) {
  const relative = path.relative(root, absolute);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("PATH_ESCAPE_BLOCKED", "An unsafe fixture path was blocked.");
  }
}

async function safeLstat(io, absolute, missingAllowed = false) {
  try {
    return await io.lstat(absolute, { bigint: true });
  } catch (error) {
    if (missingAllowed && isMissing(error)) return null;
    failFilesystem(error);
  }
}

function assertRegular(stat) {
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail("UNSAFE_FILESYSTEM_TYPE", "An unsafe filesystem type was blocked.");
  }
  if (stat.nlink > 1n) fail("HARDLINK_AMBIGUOUS", "Ambiguous filesystem identity was blocked.");
}

async function readRegularFile(io, absolute, expectedStat) {
  assertRegular(expectedStat);
  let handle;
  try {
    handle = await io.open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const openedStat = await handle.stat({ bigint: true });
    assertRegular(openedStat);
    if (!sameIdentity(expectedStat, openedStat)) fail("OBSERVATION_RACE", "Fixture observation changed during a pass.");
    const bytes = await handle.readFile();
    const handleAfter = await handle.stat({ bigint: true });
    const pathAfter = await safeLstat(io, absolute);
    if (!sameIdentity(openedStat, handleAfter) || !sameIdentity(handleAfter, pathAfter) || BigInt(bytes.length) !== pathAfter.size) {
      fail("OBSERVATION_RACE", "Fixture observation changed during a pass.");
    }
    return bytes;
  } catch (error) {
    if (error instanceof FingerprintError) throw error;
    failFilesystem(error);
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

async function readControl(io, absolute, missingCode, missingMessage) {
  const stat = await safeLstat(io, absolute, true);
  if (!stat) fail(missingCode, missingMessage);
  try {
    return { value: JSON.parse((await readRegularFile(io, absolute, stat)).toString("utf8")), stat };
  } catch (error) {
    if (error instanceof FingerprintError && error.code !== "FILESYSTEM_OBSERVATION_BLOCKED") throw error;
    if (!(error instanceof SyntaxError) && !(error instanceof FingerprintError)) throw error;
    fail(missingCode, missingMessage);
  }
}

async function validateFixtureRoot(root, io, profile) {
  if (profile === LIVE_PROFILE) fail("LIVE_PROFILE_BLOCKED", "Live vault observation is blocked in fixture-only support.");
  if (profile !== FIXTURE_PROFILE) fail("PROFILE_BLOCKED", "The requested fingerprint profile is unavailable.");
  const rootStat = await safeLstat(io, root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("UNSAFE_FIXTURE_ROOT", "The fixture root is unsafe.");
  const boundary = path.dirname(root);
  const boundaryStat = await safeLstat(io, boundary);
  if (!boundaryStat.isDirectory() || boundaryStat.isSymbolicLink()) fail("LAB_BOUNDARY_REQUIRED", "A disposable laboratory boundary is required.");
  let rootReal;
  let boundaryReal;
  try {
    [rootReal, boundaryReal] = await Promise.all([io.realpath(root), io.realpath(boundary)]);
  } catch {
    fail("LAB_CONTAINMENT_UNPROVEN", "Laboratory containment could not be proven.");
  }
  if (path.dirname(rootReal) !== boundaryReal) fail("LAB_CONTAINMENT_UNPROVEN", "Laboratory containment could not be proven.");

  const boundaryControl = await readControl(io, path.join(boundary, LAB_MARKER), "LAB_BOUNDARY_REQUIRED", "A disposable laboratory boundary is required.");
  const markerControl = await readControl(io, path.join(root, FIXTURE_MARKER), "FIXTURE_MARKER_REQUIRED", "A governed disposable fixture marker is required.");
  const boundaryMarker = boundaryControl.value;
  const marker = markerControl.value;
  if (boundaryMarker.schema !== "dex.memory.vault-fingerprint.lab-boundary.v0" || boundaryMarker.disposable !== true ||
      typeof boundaryMarker.boundary_identity !== "string" || typeof boundaryMarker.fixture_identity !== "string") {
    fail("LAB_BOUNDARY_REQUIRED", "A disposable laboratory boundary is required.");
  }
  if (marker.schema !== "dex.memory.vault-fingerprint.fixture.v0" || marker.disposable !== true || marker.profile !== FIXTURE_PROFILE) {
    fail("FIXTURE_MARKER_REQUIRED", "A governed disposable fixture marker is required.");
  }
  if (marker.boundary_identity !== boundaryMarker.boundary_identity || marker.root_identity !== boundaryMarker.fixture_identity) {
    fail("LAB_IDENTITY_MISMATCH", "Laboratory and fixture identities do not match.");
  }

  const agentsStat = await safeLstat(io, path.join(root, "AGENTS.md"), true);
  if (!agentsStat || !agentsStat.isFile() || agentsStat.isSymbolicLink()) {
    fail("REQUIRED_ROOT_FILE_MISSING", "The required governed root contract is unavailable.");
  }
  return {
    root,
    boundary,
    rootReal,
    boundaryReal,
    rootStat,
    boundaryStat,
    rootIdentity: marker.root_identity,
    boundaryIdentity: marker.boundary_identity
  };
}

async function assertBoundaryStable(context, io) {
  const [rootStat, boundaryStat] = await Promise.all([safeLstat(io, context.root), safeLstat(io, context.boundary)]);
  if (!sameIdentity(context.rootStat, rootStat) || !sameIdentity(context.boundaryStat, boundaryStat)) {
    fail("OBSERVATION_RACE", "The laboratory boundary changed during observation.");
  }
  let rootReal;
  let boundaryReal;
  try {
    [rootReal, boundaryReal] = await Promise.all([io.realpath(context.root), io.realpath(context.boundary)]);
  } catch {
    fail("OBSERVATION_RACE", "The laboratory boundary changed during observation.");
  }
  if (rootReal !== context.rootReal || boundaryReal !== context.boundaryReal || path.dirname(rootReal) !== boundaryReal) {
    fail("OBSERVATION_RACE", "The laboratory boundary changed during observation.");
  }
}

function registerLogicalPath(seen, relative) {
  const nfc = relative.normalize("NFC");
  const keys = [relative.toUpperCase().toLowerCase(), nfc, nfc.toUpperCase().toLowerCase()];
  for (const [index, key] of keys.entries()) {
    const map = index === 0 ? seen.casefold : index === 1 ? seen.nfc : seen.combined;
    const prior = map.get(key);
    if (prior !== undefined && prior !== relative) {
      fail(index === 0 ? "CASEFOLD_COLLISION" : "UNICODE_EQUIVALENCE_COLLISION", "Ambiguous logical fixture paths were blocked.");
    }
    map.set(key, relative);
  }
}

function validateLogicalPaths(paths) {
  const seen = { casefold: new Map(), nfc: new Map(), combined: new Map() };
  for (const relative of paths) registerLogicalPath(seen, relative);
  return true;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8"));
}

async function collectPass(root, io, profile) {
  const records = [];
  const seen = { casefold: new Map(), nfc: new Map(), combined: new Map(), physical: new Map() };
  const exclusionReasonCodes = new Set();

  let rootEntries;
  try {
    rootEntries = await io.readdir(root);
  } catch (error) {
    failFilesystem(error);
  }
  const declaredEntries = new Set([...GOVERNED_DIRECTORIES, ...ROOT_FILES, FIXTURE_MARKER]);
  for (const name of rootEntries) {
    if (declaredEntries.has(name)) continue;
    const reasonCode = ROOT_EXCLUSIONS.get(name);
    if (!reasonCode) fail("UNDECLARED_ROOT_ENTRY", "An undeclared root entry was blocked.");
    exclusionReasonCodes.add(reasonCode);
    if (SENSITIVE_OMISSIONS.has(name)) continue;
    const excludedStat = await safeLstat(io, path.join(root, name));
    if (!excludedStat.isDirectory() || excludedStat.isSymbolicLink()) fail("UNSAFE_FILESYSTEM_TYPE", "An unsafe excluded root entry was blocked.");
  }

  async function visitDirectory(absolute, relative) {
    assertContained(root, absolute);
    const before = await safeLstat(io, absolute);
    if (!before.isDirectory() || before.isSymbolicLink()) fail("UNSAFE_FILESYSTEM_TYPE", "An unsafe filesystem type was blocked.");
    let entries;
    try {
      entries = await io.readdir(absolute);
    } catch (error) {
      failFilesystem(error);
    }
    entries.sort((left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
    for (const name of entries) {
      if (name === "." || name === ".." || name.includes("/") || name.includes("\\")) fail("PATH_ESCAPE_BLOCKED", "An unsafe fixture path was blocked.");
      if (SENSITIVE_OMISSIONS.has(name)) fail("SENSITIVE_GOVERNED_ENTRY", "Sensitive governed content prevents comparison.");
      const childRelative = `${relative}/${name}`;
      const childAbsolute = path.join(absolute, name);
      assertContained(root, childAbsolute);
      registerLogicalPath(seen, childRelative);
      const stat = await safeLstat(io, childAbsolute);
      if (stat.isSymbolicLink()) fail("UNSAFE_FILESYSTEM_TYPE", "An unsafe filesystem type was blocked.");
      if (stat.isDirectory()) {
        await visitDirectory(childAbsolute, childRelative);
      } else if (stat.isFile()) {
        registerPhysicalIdentity(seen, stat);
        const bytes = await readRegularFile(io, childAbsolute, stat);
        records.push({
          path: childRelative,
          size: bytes.length,
          sha256: createHash(ALGORITHM).update(bytes).digest("hex")
        });
      } else {
        fail("UNSAFE_FILESYSTEM_TYPE", "An unsafe filesystem type was blocked.");
      }
    }
    const after = await safeLstat(io, absolute);
    if (!sameIdentity(before, after)) fail("OBSERVATION_RACE", "Fixture observation changed during a pass.");
  }

  for (const relative of ROOT_FILES) {
    const absolute = path.join(root, relative);
    const stat = await safeLstat(io, absolute, relative !== "AGENTS.md");
    if (!stat) continue;
    registerLogicalPath(seen, relative);
    registerPhysicalIdentity(seen, stat);
    const bytes = await readRegularFile(io, absolute, stat);
    records.push({ path: relative, size: bytes.length, sha256: createHash(ALGORITHM).update(bytes).digest("hex") });
  }
  for (const relative of GOVERNED_DIRECTORIES) {
    const absolute = path.join(root, relative);
    const stat = await safeLstat(io, absolute, true);
    if (!stat) fail("GOVERNED_ROOT_MISSING", "A required governed root is unavailable.");
    registerLogicalPath(seen, relative);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("UNSAFE_FILESYSTEM_TYPE", "An unsafe filesystem type was blocked.");
    await visitDirectory(absolute, relative);
  }

  records.sort(compareUtf8);
  let totalBytes = 0;
  for (const record of records) {
    totalBytes += record.size;
    if (!Number.isSafeInteger(totalBytes)) fail("REPRESENTATION_LIMIT", "Fixture metadata exceeds the supported representation.");
  }
  const rootHash = createHash(ALGORITHM);
  for (const field of [SCHEMA, CONTRACT_VERSION, profile, ALGORITHM, REPRESENTATION_VERSION, EXCLUSION_SET_ID]) frame(rootHash, Buffer.from(field, "utf8"));
  for (const record of records) {
    frame(rootHash, Buffer.from(record.path, "utf8"));
    frame(rootHash, Buffer.from(String(record.size), "ascii"));
    frame(rootHash, Buffer.from(record.sha256, "ascii"));
  }
  return {
    schema: SCHEMA,
    contract_version: CONTRACT_VERSION,
    profile,
    algorithm: ALGORITHM,
    representation_version: REPRESENTATION_VERSION,
    exclusion_set_id: EXCLUSION_SET_ID,
    exclusion_reason_codes: [...exclusionReasonCodes].sort(utf8Strings),
    root_identity: null,
    file_count: records.length,
    total_bytes: totalBytes,
    root_digest: rootHash.digest("hex"),
    records,
    status: "OBSERVED_STABLE"
  };
}

function registerPhysicalIdentity(seen, stat) {
  if (stat.nlink > 1n) fail("HARDLINK_AMBIGUOUS", "Ambiguous filesystem identity was blocked.");
  const identity = `${stat.dev}:${stat.ino}`;
  if (seen.physical.has(identity)) fail("HARDLINK_AMBIGUOUS", "Ambiguous filesystem identity was blocked.");
  seen.physical.set(identity, true);
}

function frame(hash, bytes) {
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  hash.update(length);
  hash.update(bytes);
}

async function observeFixtureInternal(root, options = {}) {
  const io = options.fs || fs;
  const profile = options.profile || FIXTURE_PROFILE;
  const resolvedRoot = path.resolve(root);
  const context = await validateFixtureRoot(resolvedRoot, io, profile);
  let first;
  let second;
  try {
    await assertBoundaryStable(context, io);
    first = await collectPass(resolvedRoot, io, profile);
    await assertBoundaryStable(context, io);
    if (options.betweenPasses) await options.betweenPasses();
    await assertBoundaryStable(context, io);
    second = await collectPass(resolvedRoot, io, profile);
    await assertBoundaryStable(context, io);
  } catch (error) {
    if (error instanceof FingerprintError && error.code === "OBSERVATION_RACE") return { status: "OBSERVATION_UNSTABLE" };
    if (error instanceof FingerprintError && error.code === "SENSITIVE_GOVERNED_ENTRY") {
      return { status: "NOT_COMPARABLE", reason_code: error.code };
    }
    throw error;
  }
  if (first.root_digest !== second.root_digest || JSON.stringify(first.records) !== JSON.stringify(second.records)) {
    return { status: "OBSERVATION_UNSTABLE" };
  }
  second.root_identity = `fixture:${createHash(ALGORITHM).update(`${context.boundaryIdentity}\0${context.rootIdentity}`, "utf8").digest("hex")}`;
  return { status: "OBSERVED_STABLE", manifest: second };
}

async function observeFixture(root, options = {}) {
  try {
    return await observeFixtureInternal(root, options);
  } catch (error) {
    if (error instanceof FingerprintError && error.code === "OBSERVATION_RACE") {
      return { status: "OBSERVATION_UNSTABLE" };
    }
    if (error instanceof FingerprintError && STRUCTURAL_REASON_CODES.has(error.code)) {
      return { status: "NOT_COMPARABLE", reason_code: error.code };
    }
    throw error;
  }
}

module.exports = {
  ALGORITHM,
  EXCLUSION_SET_ID,
  FIXTURE_PROFILE,
  FingerprintError,
  LIVE_PROFILE,
  NO_FOLLOW_ASSURANCE,
  REPRESENTATION_VERSION,
  compareManifests,
  observeFixture,
  sanitizeResult,
  validateLogicalPaths
};

function compareManifests(left, right) {
  const compatibility = ["schema", "contract_version", "profile", "algorithm", "representation_version", "exclusion_set_id", "root_identity"];
  if (!isComparableManifest(left) || !isComparableManifest(right) || compatibility.some((field) => left[field] !== right[field])) {
    return { status: "NOT_COMPARABLE" };
  }
  if (left.root_digest === right.root_digest && JSON.stringify(left.records) === JSON.stringify(right.records)) {
    return { status: "OBSERVED_STABLE" };
  }
  const leftByPath = new Map(left.records.map((record) => [record.path, record]));
  const rightByPath = new Map(right.records.map((record) => [record.path, record]));
  const added = [...rightByPath.keys()].filter((key) => !leftByPath.has(key)).sort(utf8Strings);
  const removed = [...leftByPath.keys()].filter((key) => !rightByPath.has(key)).sort(utf8Strings);
  const changed = [...leftByPath.keys()].filter((key) => rightByPath.has(key) &&
    (leftByPath.get(key).size !== rightByPath.get(key).size || leftByPath.get(key).sha256 !== rightByPath.get(key).sha256)).sort(utf8Strings);
  return { status: "DIFFERENT", added, removed, changed };
}

function isComparableManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.records) ||
      manifest.schema !== SCHEMA || manifest.contract_version !== CONTRACT_VERSION || manifest.profile !== FIXTURE_PROFILE ||
      manifest.algorithm !== ALGORITHM || manifest.representation_version !== REPRESENTATION_VERSION ||
      manifest.exclusion_set_id !== EXCLUSION_SET_ID || !Array.isArray(manifest.exclusion_reason_codes) ||
      typeof manifest.root_identity !== "string" || !/^fixture:[a-f0-9]{64}$/.test(manifest.root_identity) ||
      typeof manifest.root_digest !== "string" || !/^[a-f0-9]{64}$/.test(manifest.root_digest) ||
      manifest.status !== "OBSERVED_STABLE" || manifest.file_count !== manifest.records.length ||
      !Number.isSafeInteger(manifest.total_bytes) || manifest.total_bytes < 0) return false;
  let totalBytes = 0;
  for (const record of manifest.records) {
    if (!record || typeof record.path !== "string" || !Number.isSafeInteger(record.size) || record.size < 0 ||
        typeof record.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(record.sha256)) return false;
    totalBytes += record.size;
  }
  return Number.isSafeInteger(totalBytes) && totalBytes === manifest.total_bytes;
}

function utf8Strings(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function sanitizeResult(result) {
  if (!result || !RESULT_STATUSES.has(result.status)) return { status: "NOT_COMPARABLE" };
  const sanitized = { status: result.status };
  if (result.status === "OBSERVED_STABLE" && result.manifest && result.manifest.exclusion_set_id === EXCLUSION_SET_ID) {
    sanitized.exclusion_set_id = EXCLUSION_SET_ID;
    sanitized.exclusion_reason_codes = Array.isArray(result.manifest.exclusion_reason_codes)
      ? [...new Set(result.manifest.exclusion_reason_codes.filter((code) => EXCLUSION_REASON_CODES.has(code)))].sort(utf8Strings)
      : [];
  }
  if (result.status === "NOT_COMPARABLE" && STRUCTURAL_REASON_CODES.has(result.reason_code)) {
    sanitized.reason_code = result.reason_code;
  }
  return sanitized;
}
