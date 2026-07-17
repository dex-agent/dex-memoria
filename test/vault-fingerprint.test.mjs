import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { link, mkdir, mkdtemp, rename, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const testRoot = dirname(fileURLToPath(import.meta.url));
const supportPath = join(testRoot, "support", "vault-fingerprint.js");
const {
  FIXTURE_PROFILE,
  LIVE_PROFILE,
  NO_FOLLOW_ASSURANCE,
  compareManifests,
  observeFixture,
  sanitizeResult,
  validateLogicalPaths
} = require(supportPath);
const execFileAsync = promisify(execFile);

async function createFixture(t, { marked = true, agents = true } = {}) {
  const labBoundary = await mkdtemp(join(tmpdir(), "dex-memory-fingerprint-lab-"));
  const fixtureRoot = join(labBoundary, "fixture");
  const boundaryIdentity = `lab-${basename(labBoundary)}`;
  const rootIdentity = `root-${basename(labBoundary)}`;
  await mkdir(fixtureRoot);
  t.after(() => rm(labBoundary, { recursive: true, force: true }));
  await writeFile(join(labBoundary, ".dex-memory-fingerprint-lab.json"), `${JSON.stringify({
    schema: "dex.memory.vault-fingerprint.lab-boundary.v0",
    disposable: true,
    boundary_identity: boundaryIdentity,
    fixture_identity: rootIdentity
  })}\n`);
  if (agents) await writeFile(join(fixtureRoot, "AGENTS.md"), "# Disposable fixture\n");
  for (const directory of ["global", "temas", "principles", "domains", "extensions"]) {
    await mkdir(join(fixtureRoot, directory));
  }
  if (marked) {
    await writeFile(join(fixtureRoot, ".dex-memory-fingerprint-fixture.json"), `${JSON.stringify({
      schema: "dex.memory.vault-fingerprint.fixture.v0",
      disposable: true,
      profile: "fixture-governed-vault-v1",
      boundary_identity: boundaryIdentity,
      root_identity: rootIdentity
    })}\n`);
  }
  return fixtureRoot;
}

test("a root marker without a disposable lab boundary is insufficient", async (t) => {
  const arbitraryRoot = await mkdtemp(join(tmpdir(), "dex-memory-fingerprint-arbitrary-"));
  t.after(() => rm(arbitraryRoot, { recursive: true, force: true }));
  await writeFile(join(arbitraryRoot, "AGENTS.md"), "# Arbitrary root\n");
  for (const directory of ["global", "temas", "principles", "domains", "extensions"]) await mkdir(join(arbitraryRoot, directory));
  await writeFile(join(arbitraryRoot, ".dex-memory-fingerprint-fixture.json"), JSON.stringify({
    schema: "dex.memory.vault-fingerprint.fixture.v0",
    disposable: true,
    profile: "fixture-governed-vault-v1",
    boundary_identity: "isolated",
    root_identity: "isolated"
  }));

  assert.deepEqual(await observeFixture(arbitraryRoot), { status: "NOT_COMPARABLE", reason_code: "LAB_BOUNDARY_REQUIRED" });
});

test("a fixture moved under a different marked boundary is rejected", async (t) => {
  const firstRoot = await createFixture(t);
  const secondRoot = await createFixture(t);
  const parkedRoot = join(dirname(firstRoot), "parked-fixture");
  await rename(firstRoot, parkedRoot);
  await rename(secondRoot, firstRoot);

  assert.deepEqual(await observeFixture(firstRoot), { status: "NOT_COMPARABLE", reason_code: "LAB_IDENTITY_MISMATCH" });
});

test("an unmarked root fails closed without exposing its path", async (t) => {
  const fixtureRoot = await createFixture(t, { marked: false });

  assert.deepEqual(await observeFixture(fixtureRoot), {
    status: "NOT_COMPARABLE",
    reason_code: "FIXTURE_MARKER_REQUIRED"
  });
});

test("a fixture without required AGENTS.md fails closed", async (t) => {
  const fixtureRoot = await createFixture(t, { agents: false });

  assert.deepEqual(await observeFixture(fixtureRoot), { status: "NOT_COMPARABLE", reason_code: "REQUIRED_ROOT_FILE_MISSING" });
});

test("an unchanged governed fixture produces a stable canonical manifest", async (t) => {
  const fixtureRoot = await createFixture(t);
  await writeFile(join(fixtureRoot, "temas", "memoria.md"), "conteudo governado\n");

  const observation = await observeFixture(fixtureRoot);

  assert.equal(observation.status, "OBSERVED_STABLE");
  assert.deepEqual(Object.keys(observation.manifest), [
    "schema", "contract_version", "profile", "algorithm", "representation_version",
    "exclusion_set_id", "exclusion_reason_codes", "root_identity", "file_count", "total_bytes", "root_digest",
    "records", "status"
  ]);
  assert.equal(observation.manifest.schema, "dex.memory.vault-fingerprint.v0");
  assert.equal(observation.manifest.profile, "fixture-governed-vault-v1");
  assert.match(observation.manifest.root_digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(observation.manifest.records.map((record) => record.path), ["AGENTS.md", "temas/memoria.md"]);
  assert.deepEqual(compareManifests(observation.manifest, observation.manifest), { status: "OBSERVED_STABLE" });
});

test("record ordering is ordinal over preserved UTF-8 path bytes", async (t) => {
  const fixtureRoot = await createFixture(t);
  for (const name of ["z.md", "é.md", "A.md"]) await writeFile(join(fixtureRoot, "global", name), `${name}\n`);
  const records = (await observeFixture(fixtureRoot)).manifest.records.map((record) => record.path);
  const expected = [...records].sort((left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));

  assert.deepEqual(records, expected);
  assert.ok(records.includes("global/é.md"));
});

test("stable observations are deterministic across fresh Node processes", async (t) => {
  const fixtureRoot = await createFixture(t);
  await writeFile(join(fixtureRoot, "global", "MEMORY.md"), "deterministico\n");
  const script = `const s=require(process.argv[1]);s.observeFixture(process.argv[2]).then(x=>process.stdout.write(JSON.stringify(s.sanitizeResult(x))))`;

  const first = await execFileAsync(process.execPath, ["-e", script, supportPath, fixtureRoot]);
  const second = await execFileAsync(process.execPath, ["-e", script, supportPath, fixtureRoot]);

  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assert.doesNotMatch(first.stdout, /records|global\/MEMORY|file_count|total_bytes/i);
});

test("one changed byte is DIFFERENT even with size and mtime restored", async (t) => {
  const fixtureRoot = await createFixture(t);
  const target = join(fixtureRoot, "principles", "rule.md");
  await writeFile(target, "A");
  const originalTimes = await stat(target);
  const before = (await observeFixture(fixtureRoot)).manifest;
  await writeFile(target, "B");
  await utimes(target, originalTimes.atime, originalTimes.mtime);
  const after = (await observeFixture(fixtureRoot)).manifest;

  const comparison = compareManifests(before, after);
  assert.equal(comparison.status, "DIFFERENT");
  assert.deepEqual(comparison.changed, ["principles/rule.md"]);
});

test("add and remove in every governed directory is material", async (t) => {
  const fixtureRoot = await createFixture(t);
  const baseline = (await observeFixture(fixtureRoot)).manifest;
  for (const governedRoot of ["global", "temas", "principles", "domains", "extensions"]) {
    const target = join(fixtureRoot, governedRoot, "added.md");
    await writeFile(target, `${governedRoot}\n`);
    const added = (await observeFixture(fixtureRoot)).manifest;
    assert.deepEqual(compareManifests(baseline, added), {
      status: "DIFFERENT", added: [`${governedRoot}/added.md`], removed: [], changed: []
    });
    await rm(target);
    const removed = (await observeFixture(fixtureRoot)).manifest;
    assert.deepEqual(compareManifests(added, removed), {
      status: "DIFFERENT", added: [], removed: [`${governedRoot}/added.md`], changed: []
    });
  }
});

test("rename is represented only as removed plus added", async (t) => {
  const fixtureRoot = await createFixture(t);
  const oldPath = join(fixtureRoot, "domains", "old.md");
  await writeFile(oldPath, "same bytes\n");
  const before = (await observeFixture(fixtureRoot)).manifest;
  await rename(oldPath, join(fixtureRoot, "domains", "new.md"));
  const comparison = compareManifests(before, (await observeFixture(fixtureRoot)).manifest);

  assert.deepEqual(comparison, {
    status: "DIFFERENT", added: ["domains/new.md"], removed: ["domains/old.md"], changed: []
  });
  assert.equal(Object.hasOwn(comparison, "renamed"), false);
});

test("presence and absence of each optional governed root file is material", async (t) => {
  const fixtureRoot = await createFixture(t);
  for (const optional of ["MEMORY.md", "LEMBRANCA.md", "MEMORIA.md"]) {
    const absent = (await observeFixture(fixtureRoot)).manifest;
    const target = join(fixtureRoot, optional);
    await writeFile(target, `${optional}\n`);
    const present = (await observeFixture(fixtureRoot)).manifest;
    assert.deepEqual(compareManifests(absent, present).added, [optional]);
    await rm(target);
    assert.deepEqual(compareManifests(present, (await observeFixture(fixtureRoot)).manifest).removed, [optional]);
  }
});

test("known root operational noise is pruned before descent", async (t) => {
  const fixtureRoot = await createFixture(t);
  const before = (await observeFixture(fixtureRoot)).manifest;
  for (const directory of [".git", ".agents", ".ppirtv", ".obsidian", ".codex", "graphify-out", "backups", ".backups", "node_modules", "caches", "logs"]) {
    await mkdir(join(fixtureRoot, directory));
    await writeFile(join(fixtureRoot, directory, "private-name.txt"), "private metadata\n");
  }
  await writeFile(join(fixtureRoot, ".env"), "SECRET=not-read\n");
  await writeFile(join(fixtureRoot, "config.toml"), "token='not-read'\n");
  const after = (await observeFixture(fixtureRoot)).manifest;

  assert.equal(after.root_digest, before.root_digest);
  assert.deepEqual(after.records, before.records);
  assert.deepEqual(after.exclusion_reason_codes, [
    "BACKUP_RESIDUE", "CACHE_RESIDUE", "DEPENDENCY_TREE", "DERIVED_INDEX", "LOG_RESIDUE",
    "OPERATIONAL_STATE", "SENSITIVE_CONFIG", "UI_STATE", "VCS_METADATA"
  ]);
});

test("all five governed directories are required", async (t) => {
  for (const governedRoot of ["global", "temas", "principles", "domains", "extensions"]) {
    const fixtureRoot = await createFixture(t);
    await rm(join(fixtureRoot, governedRoot), { recursive: true });
    assert.deepEqual(await observeFixture(fixtureRoot), { status: "NOT_COMPARABLE", reason_code: "GOVERNED_ROOT_MISSING" });
  }
});

test("an undeclared root entry is blocked instead of silently excluded", async (t) => {
  const fixtureRoot = await createFixture(t);
  await writeFile(join(fixtureRoot, "unknown-root.txt"), "not declared\n");

  assert.deepEqual(await observeFixture(fixtureRoot), { status: "NOT_COMPARABLE", reason_code: "UNDECLARED_ROOT_ENTRY" });
});

test("sensitive root omissions are never opened or read", async (t) => {
  const fixtureRoot = await createFixture(t);
  await writeFile(join(fixtureRoot, ".env"), "PRIVATE_VALUE=fixture-only\n");
  await writeFile(join(fixtureRoot, "config.toml"), "private_value='fixture-only'\n");
  const realFs = require("node:fs/promises");
  const sensitiveAccess = [];
  const spyFs = new Proxy(realFs, {
    get(target, property) {
      if (property === "open" || property === "readFile" || property === "lstat") {
        return async (filePath, ...args) => {
          if ([".env", "config.toml"].includes(basename(String(filePath)))) {
            sensitiveAccess.push({ property, file: basename(String(filePath)) });
            throw new Error("sensitive omission was accessed");
          }
          return target[property](filePath, ...args);
        };
      }
      return target[property];
    }
  });

  assert.equal((await observeFixture(fixtureRoot, { fs: spyFs })).status, "OBSERVED_STABLE");
  assert.deepEqual(sensitiveAccess, []);
});

test("sensitive basenames inside governed roots fail closed before metadata or content access", async (t) => {
  for (const sensitiveName of [".env", "config.toml"]) {
    const fixtureRoot = await createFixture(t);
    const sensitivePath = join(fixtureRoot, "temas", sensitiveName);
    await writeFile(sensitivePath, "must-not-be-observed\n");
    const realFs = require("node:fs/promises");
    const sensitiveAccess = [];
    const spyFs = new Proxy(realFs, {
      get(target, property) {
        if (["lstat", "open", "readFile"].includes(property)) {
          return async (filePath, ...args) => {
            if (String(filePath) === sensitivePath) {
              sensitiveAccess.push(property);
              throw new Error("sensitive governed path was accessed");
            }
            return target[property](filePath, ...args);
          };
        }
        return target[property];
      }
    });

    assert.deepEqual(await observeFixture(fixtureRoot, { fs: spyFs }), {
      status: "NOT_COMPARABLE",
      reason_code: "SENSITIVE_GOVERNED_ENTRY"
    });
    assert.deepEqual(sensitiveAccess, []);
  }
});

test("logs backups and caches nested in governed roots remain material", async (t) => {
  const fixtureRoot = await createFixture(t);
  const before = (await observeFixture(fixtureRoot)).manifest;
  for (const directory of ["logs", "backups", "caches"]) {
    await mkdir(join(fixtureRoot, "extensions", directory));
    await writeFile(join(fixtureRoot, "extensions", directory, "governed.md"), `${directory}\n`);
  }
  const comparison = compareManifests(before, (await observeFixture(fixtureRoot)).manifest);

  assert.equal(comparison.status, "DIFFERENT");
  assert.deepEqual(comparison.added, [
    "extensions/backups/governed.md", "extensions/caches/governed.md", "extensions/logs/governed.md"
  ]);
});

test("a symlink in governed content blocks without reading its external target", async (t) => {
  const fixtureRoot = await createFixture(t);
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memory-fingerprint-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  const external = join(externalRoot, "outside-secret.txt");
  await writeFile(external, "never read this unique payload\n");
  await symlink(external, join(fixtureRoot, "temas", "outside.md"), "file");

  assert.deepEqual(await observeFixture(fixtureRoot), { status: "NOT_COMPARABLE", reason_code: "UNSAFE_FILESYSTEM_TYPE" });
});

test("a real hardlink in governed content is ambiguous", async (t) => {
  const fixtureRoot = await createFixture(t);
  const first = join(fixtureRoot, "domains", "first.md");
  await writeFile(first, "shared inode\n");
  await link(first, join(fixtureRoot, "domains", "second.md"));

  assert.deepEqual(await observeFixture(fixtureRoot), { status: "NOT_COMPARABLE", reason_code: "HARDLINK_AMBIGUOUS" });
});

test("a Windows junction or directory symlink is rejected when supported", async (t) => {
  const fixtureRoot = await createFixture(t);
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memory-fingerprint-junction-target-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  try {
    await symlink(externalRoot, join(fixtureRoot, "extensions", "junction"), process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "ENOSYS", "EACCES"].includes(error.code)) {
      t.skip(`junction/symlink unsupported: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.deepEqual(await observeFixture(fixtureRoot), { status: "NOT_COMPARABLE", reason_code: "UNSAFE_FILESYSTEM_TYPE" });
});

test("casefold and NFC-NFD logical collisions fail closed", () => {
  assert.throws(() => validateLogicalPaths(["temas/A.md", "temas/a.md"]), { code: "CASEFOLD_COLLISION" });
  assert.throws(() => validateLogicalPaths(["temas/Straße.md", "temas/strasse.md"]), { code: "CASEFOLD_COLLISION" });
  assert.throws(() => validateLogicalPaths(["temas/caf\u00e9.md", "temas/cafe\u0301.md"]), { code: "UNICODE_EQUIVALENCE_COLLISION" });
});

test("incompatible manifests are NOT_COMPARABLE", async (t) => {
  const fixtureRoot = await createFixture(t);
  const manifest = (await observeFixture(fixtureRoot)).manifest;
  for (const field of ["schema", "contract_version", "profile", "algorithm", "representation_version", "exclusion_set_id"]) {
    assert.deepEqual(compareManifests(manifest, { ...manifest, [field]: `other-${field}` }), { status: "NOT_COMPARABLE" });
  }
  assert.deepEqual(compareManifests(manifest, { ...manifest, records: null }), { status: "NOT_COMPARABLE" });
});

test("byte-identical fixtures with different root identities are NOT_COMPARABLE", async (t) => {
  const firstRoot = await createFixture(t);
  const secondRoot = await createFixture(t);
  const first = (await observeFixture(firstRoot)).manifest;
  const second = (await observeFixture(secondRoot)).manifest;

  assert.equal(first.root_digest, second.root_digest);
  assert.notEqual(first.root_identity, second.root_identity);
  assert.deepEqual(compareManifests(first, second), { status: "NOT_COMPARABLE" });
  const withoutIdentity = { ...first };
  delete withoutIdentity.root_identity;
  assert.deepEqual(compareManifests(first, withoutIdentity), { status: "NOT_COMPARABLE" });
});

test("a coordinated mutation between complete passes is OBSERVATION_UNSTABLE", async (t) => {
  const fixtureRoot = await createFixture(t);
  const target = join(fixtureRoot, "temas", "race.md");
  await writeFile(target, "before\n");

  const result = await observeFixture(fixtureRoot, {
    betweenPasses: () => writeFile(target, "after\n")
  });

  assert.deepEqual(result, { status: "OBSERVATION_UNSTABLE" });
});

test("replacing the marked fixture root between passes is OBSERVATION_UNSTABLE", async (t) => {
  const fixtureRoot = await createFixture(t);
  const result = await observeFixture(fixtureRoot, {
    betweenPasses: async () => {
      await rename(fixtureRoot, join(dirname(fixtureRoot), "fixture-before-swap"));
      await mkdir(fixtureRoot);
    }
  });

  assert.deepEqual(result, { status: "OBSERVATION_UNSTABLE" });
});

test("a non-FingerprintError programming defect still throws", async (t) => {
  const fixtureRoot = await createFixture(t);
  await assert.rejects(observeFixture(fixtureRoot, {
    betweenPasses() {
      throw new TypeError("programming defect");
    }
  }), TypeError);
});

test("TypeError from injected lstat or open is never softened into a fingerprint state", async (t) => {
  for (const operation of ["lstat", "open"]) {
    const fixtureRoot = await createFixture(t);
    const realFs = require("node:fs/promises");
    const brokenFs = new Proxy(realFs, {
      get(target, property) {
        if (property === operation) return async () => { throw new TypeError(`${operation} programming defect`); };
        return target[property];
      }
    });

    await assert.rejects(observeFixture(fixtureRoot, { fs: brokenFs }), TypeError);
  }
});

test("an EACCES during governed traversal fails closed", async (t) => {
  const fixtureRoot = await createFixture(t);
  const deniedPath = join(fixtureRoot, "global", "denied.md");
  await writeFile(deniedPath, "denied\n");
  const realFs = require("node:fs/promises");
  const deniedFs = new Proxy(realFs, {
    get(target, property) {
      if (property === "lstat") {
        return async (filePath, ...args) => {
          if (String(filePath) === deniedPath) throw Object.assign(new Error("denied"), { code: "EACCES" });
          return target.lstat(filePath, ...args);
        };
      }
      return target[property];
    }
  });

  assert.deepEqual(await observeFixture(fixtureRoot, { fs: deniedFs }), { status: "NOT_COMPARABLE", reason_code: "ACCESS_DENIED" });
});

test("the observer performs zero mutating filesystem calls under the fixture root", async (t) => {
  const fixtureRoot = await createFixture(t);
  const realFs = require("node:fs/promises");
  const forbidden = new Set(["appendFile", "chmod", "chown", "cp", "link", "mkdir", "rename", "rm", "rmdir", "symlink", "truncate", "unlink", "utimes", "writeFile"]);
  const calls = [];
  const openFlags = [];
  const mutatingOpenMask = constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC | constants.O_APPEND;
  const spyFs = new Proxy(realFs, {
    get(target, property) {
      if (forbidden.has(property)) return async () => { calls.push(property); throw new Error("mutation attempted"); };
      if (property === "open") return async (filePath, flags, ...args) => {
        openFlags.push(flags);
        if ((flags & mutatingOpenMask) !== 0) throw new Error("mutating open attempted");
        return target.open(filePath, flags, ...args);
      };
      return target[property];
    }
  });

  assert.equal((await observeFixture(fixtureRoot, { fs: spyFs })).status, "OBSERVED_STABLE");
  assert.deepEqual(calls, []);
  assert.ok(openFlags.length > 0);
  assert.ok(openFlags.every((flags) => (flags & mutatingOpenMask) === 0));
});

test("sanitized output contains no records paths or private counts", async (t) => {
  const fixtureRoot = await createFixture(t);
  await writeFile(join(fixtureRoot, "extensions", "private-customer-name.md"), "private\n");
  await mkdir(join(fixtureRoot, ".git"));
  await writeFile(join(fixtureRoot, ".env"), "PRIVATE_VALUE=fixture-only\n");
  const serialized = JSON.stringify(sanitizeResult(await observeFixture(fixtureRoot)));

  assert.doesNotMatch(serialized, /records|private-customer|extensions|file_count|total_bytes/i);
  assert.deepEqual(JSON.parse(serialized), {
    status: "OBSERVED_STABLE",
    exclusion_set_id: "governed-vault-root-operational-v1",
    exclusion_reason_codes: ["SENSITIVE_CONFIG", "VCS_METADATA"]
  });
  assert.deepEqual(sanitizeResult({ status: "NOT_COMPARABLE", reason_code: "ACCESS_DENIED", private_path: "hidden" }), {
    status: "NOT_COMPARABLE", reason_code: "ACCESS_DENIED"
  });
  assert.deepEqual(sanitizeResult({ status: "NOT_COMPARABLE", reason_code: "C:/private/payload" }), {
    status: "NOT_COMPARABLE"
  });
});

test("the live profile remains fail-closed and unexposed", async (t) => {
  const fixtureRoot = await createFixture(t);
  assert.deepEqual(await observeFixture(fixtureRoot, { profile: LIVE_PROFILE }), {
    status: "NOT_COMPARABLE", reason_code: "LIVE_PROFILE_BLOCKED"
  });
  assert.equal(FIXTURE_PROFILE, "fixture-governed-vault-v1");
  assert.equal(NO_FOLLOW_ASSURANCE, "fixture-lstat-handle-revalidation-live-blocked");
});
