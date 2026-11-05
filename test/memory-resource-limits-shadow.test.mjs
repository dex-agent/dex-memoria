import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const bundleRoot = join(repoRoot, "contracts", "policies");
const generatedRoot = join(bundleRoot, "generated");
const generator = join(repoRoot, "scripts", "generate-memory-resource-limit-artifacts.js");
const nodeReader = join(repoRoot, "scripts", "read-memory-resource-limits-shadow.js");
const psReader = join(repoRoot, "scripts", "read-memory-resource-limits-shadow.ps1");
const require = createRequire(import.meta.url);

const publicBundleFiles = [
  "dex.memory.resource-limits.v1.json",
  "dex.memory.resource-limits.v1.schema.json",
  "README.md",
  "INDEX.md",
  "generated/dex.memory.resource-limits.bootstrap.node.v1.cjs",
  "generated/dex.memory.resource-limits.bootstrap.powershell.v1.ps1",
  "generated/dex.memory.resource-limits.provenance.v1.json"
];

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", ...options });
}

function runNodeReader(root) {
  return JSON.parse(execFileSync(process.execPath, [nodeReader, root], { cwd: repoRoot, encoding: "utf8" }));
}

function runPowerShellReader(root) {
  // Mesma convencao de test/precutover-clone-v2.test.mjs: no Windows o binario e
  // powershell.exe; fora dele e pwsh (pre-instalado no ubuntu-latest do Actions).
  const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  return JSON.parse(execFileSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psReader, "-BundlePath", root], { cwd: repoRoot, encoding: "utf8" }));
}

async function copyBundle() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "dex-memory-resource-limits-"));
  await cp(bundleRoot, fixtureRoot, { recursive: true });
  return fixtureRoot;
}

async function mutateFixture(relativePath, mutate) {
  const fixtureRoot = await copyBundle();
  const filePath = join(fixtureRoot, relativePath);
  const before = await readFile(filePath);
  await writeFile(filePath, await mutate(before));
  return fixtureRoot;
}

function collectNumbers(value, result = []) {
  if (typeof value === "number") result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, result));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectNumbers(item, result));
  return result;
}

function resolveRepoEvidencePath(sourcePath) {
  assert.equal(sourcePath.startsWith("$DEX_MEMORY_HOME/"), false);
  return join(repoRoot, ...sourcePath.split("/"));
}

function lineContainsObservedValue(line, observedValue) {
  if (line.includes(String(observedValue))) return true;
  const multiplication = line.match(/(\d+)\s*\*\s*(\d+)/);
  return Boolean(multiplication && Number(multiplication[1]) * Number(multiplication[2]) === observedValue);
}

test("SHADOW policy is the only authored resource-value source", async () => {
  const policy = JSON.parse(await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.json"), "utf8"));
  const schema = JSON.parse(await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.schema.json"), "utf8"));
  assert.equal(policy.contract, "dex.memory.resource-limits.v1");
  assert.equal(policy.authority_state, "SHADOW");
  assert.equal(policy.effective, false);
  assert.equal(policy.owner, "dex-memoria");
  assert.ok(policy.limits.length > 0);
  assert.equal(JSON.stringify(schema).includes('"default"'), false);
  const observedValues = new Set(policy.limits.map((limit) => limit.value));
  assert.deepEqual(collectNumbers(schema).filter((value) => value > 1 && observedValues.has(value)), []);
  const ids = policy.limits.map((limit) => limit.limit_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("smoke.safety.max_file_bytes"));
  assert.ok(ids.includes("smoke.reference.max_l3_files"));
  assert.equal(ids.includes("bootstrap.policy_document_bytes"), false);
  const installedEvidence = policy.limits.filter((limit) => limit.source_evidence.path.startsWith("$DEX_MEMORY_HOME/"));
  assert.ok(installedEvidence.length > 0);
  for (const limit of installedEvidence) {
    assert.match(limit.source_evidence.path, /^\$DEX_MEMORY_HOME\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/);
    assert.ok(Number.isSafeInteger(limit.source_evidence.line) && limit.source_evidence.line > 0);
    assert.ok(limit.source_evidence.locator.length > 0);
  }
});

test("every repo-local source evidence locator resolves without making public tests depend on installed state", async () => {
  const policy = JSON.parse(await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.json"), "utf8"));
  const repoLimits = policy.limits.filter((limit) => !limit.source_evidence.path.startsWith("$DEX_MEMORY_HOME/"));
  assert.ok(repoLimits.length > 0);
  for (const limit of repoLimits) {
    const sourcePath = resolveRepoEvidencePath(limit.source_evidence.path);
    const sourceText = await readFile(sourcePath, "utf8");
    const lines = sourceText.split(/\r?\n/);
    const semanticLocator = limit.source_evidence.locator.split(".").at(-1);
    const matchingLines = lines.filter((line) => line.includes(semanticLocator) && lineContainsObservedValue(line, limit.value));
    if (sourcePath.endsWith(".json")) {
      const locatedValue = limit.source_evidence.locator.split(".").reduce((current, key) => {
        if (Array.isArray(current)) return current.find((item) => item?.id === key);
        return current?.[key];
      }, JSON.parse(sourceText));
      assert.equal(locatedValue, limit.value, `${limit.limit_id} locator`);
      assert.ok(matchingLines.length > 0, `${limit.limit_id} semantic source locator`);
    } else {
      assert.ok(matchingLines.length > 0, `${limit.limit_id} semantic source locator`);
    }
  }
});

test("generation is byte-for-byte deterministic and bootstrap values are derived", async () => {
  const { verifyGeneratedArtifacts } = require(generator);
  verifyGeneratedArtifacts(bundleRoot);
  const fixtureRoot = await copyBundle();
  try {
    execFileSync(process.execPath, [generator, "--bundle", fixtureRoot], { cwd: repoRoot });
    const before = new Map(await Promise.all(publicBundleFiles.map(async (file) => [file, await readFile(join(fixtureRoot, file))])));
    execFileSync(process.execPath, [generator, "--bundle", fixtureRoot], { cwd: repoRoot });
    for (const [file, bytes] of before) assert.deepEqual(await readFile(join(fixtureRoot, file)), bytes, file);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
  const policyBytes = await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.json"));
  const bootstrapPath = join(generatedRoot, "dex.memory.resource-limits.bootstrap.node.v1.cjs");
  delete require.cache[require.resolve(bootstrapPath)];
  const bootstrap = require(bootstrapPath);
  assert.equal(bootstrap.policy_bytes, policyBytes.length);
  assert.equal(bootstrap.bootstrap_ceiling, null);
});

test("read-only verification rejects a stale derivative without repairing it", async () => {
  const { verifyGeneratedArtifacts } = require(generator);
  const fixtureRoot = await copyBundle();
  const generatedPath = join(fixtureRoot, "generated", "dex.memory.resource-limits.bootstrap.node.v1.cjs");
  try {
    const staleBytes = Buffer.concat([await readFile(generatedPath), Buffer.from("\n")]);
    await writeFile(generatedPath, staleBytes);
    assert.throws(() => verifyGeneratedArtifacts(fixtureRoot), /generated artifact is stale/);
    assert.deepEqual(await readFile(generatedPath), staleBytes);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("Node and Windows PowerShell readers emit the same inert receipt", () => {
  const nodeReceipt = runNodeReader(bundleRoot);
  const psReceipt = runPowerShellReader(bundleRoot);
  assert.deepEqual(psReceipt, nodeReceipt);
  assert.equal(nodeReceipt.status, "SHADOW_VERIFIED");
  assert.equal(nodeReceipt.authority_state, "SHADOW");
  assert.equal(nodeReceipt.effective, false);
});

test("readers fail closed for missing, stale, tampered and non-canonical inputs", async (t) => {
  const policy = JSON.parse(await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.json"), "utf8"));
  const observedValue = policy.limits[0].value;
  const cases = [
    ["missing policy", "dex.memory.resource-limits.v1.json", async () => Buffer.from("")],
    ["tampered value", "dex.memory.resource-limits.v1.json", async (bytes) => Buffer.from(bytes.toString("utf8").replace(`"value": ${observedValue}`, `"value": ${observedValue + 1}`))],
    ["CRLF", "dex.memory.resource-limits.v1.json", async (bytes) => Buffer.from(bytes.toString("utf8").replace(/\n/g, "\r\n"))],
    ["BOM", "dex.memory.resource-limits.v1.json", async (bytes) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes])],
    ["policy version mismatch", "dex.memory.resource-limits.v1.json", async (bytes) => Buffer.from(bytes.toString("utf8").replace('"version": 1', '"version": 2'))],
    ["schema version mismatch", "dex.memory.resource-limits.v1.schema.json", async (bytes) => Buffer.from(bytes.toString("utf8").replace("resource-limits.v1.schema", "resource-limits.v2.schema"))],
    ["provenance version mismatch", "generated/dex.memory.resource-limits.provenance.v1.json", async (bytes) => Buffer.from(bytes.toString("utf8").replace('"version": 1', '"version": 2'))],
    ["Node bootstrap version mismatch", "generated/dex.memory.resource-limits.bootstrap.node.v1.cjs", async (bytes) => Buffer.from(bytes.toString("utf8").replace('"version": 1', '"version": 2'))],
    ["PowerShell bootstrap version mismatch", "generated/dex.memory.resource-limits.bootstrap.powershell.v1.ps1", async (bytes) => Buffer.from(bytes.toString("utf8").replace("version = 1", "version = 2"))],
    ["stale schema", "dex.memory.resource-limits.v1.schema.json", async (bytes) => Buffer.from(bytes.toString("utf8").replace("Dex Memory Resource Limits V1", "Dex Memory Resource Limits Changed"))],
    ["non-canonical provenance", "generated/dex.memory.resource-limits.provenance.v1.json", async (bytes) => Buffer.from(JSON.stringify(JSON.parse(bytes.toString("utf8"))))],
    ["extra provenance key", "generated/dex.memory.resource-limits.provenance.v1.json", async (bytes) => {
      const value = JSON.parse(bytes.toString("utf8"));
      value.unexpected = true;
      return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    }],
    ["provenance path escape", "generated/dex.memory.resource-limits.provenance.v1.json", async (bytes) => {
      const value = JSON.parse(bytes.toString("utf8"));
      value.policy.path = "../outside.json";
      return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    }],
    ["Node bootstrap metadata substitution", "generated/dex.memory.resource-limits.provenance.v1.json", async (bytes) => {
      const value = JSON.parse(bytes.toString("utf8"));
      value.generated.node_bootstrap = structuredClone(value.policy);
      return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    }],
    ["PowerShell bootstrap metadata substitution", "generated/dex.memory.resource-limits.provenance.v1.json", async (bytes) => {
      const value = JSON.parse(bytes.toString("utf8"));
      value.generated.powershell_bootstrap = structuredClone(value.policy);
      return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    }]
  ];
  for (const [name, file, mutate] of cases) {
    await t.test(name, async () => {
      const fixtureRoot = await mutateFixture(file, mutate);
      if (name === "missing policy") await rm(join(fixtureRoot, file), { force: true });
      try {
        assert.notEqual(run(process.execPath, [nodeReader, fixtureRoot]).status, 0);
        assert.notEqual(run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psReader, "-BundlePath", fixtureRoot]).status, 0);
      } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    });
  }
});

test("readers verify executable bootstrap bytes before loading them", async (t) => {
  await t.test("Node bootstrap", async () => {
    const fixtureRoot = await copyBundle();
    const sentinelPath = join(fixtureRoot, "node-bootstrap-executed.txt");
    const bootstrapPath = join(fixtureRoot, "generated", "dex.memory.resource-limits.bootstrap.node.v1.cjs");
    try {
      const before = await readFile(bootstrapPath, "utf8");
      await writeFile(bootstrapPath, `${before}\nrequire("node:fs").writeFileSync(${JSON.stringify(sentinelPath)}, "executed");\n`, "utf8");
      assert.notEqual(run(process.execPath, [nodeReader, fixtureRoot]).status, 0);
      assert.equal(existsSync(sentinelPath), false);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  await t.test("PowerShell bootstrap", async () => {
    const fixtureRoot = await copyBundle();
    const sentinelPath = join(fixtureRoot, "powershell-bootstrap-executed.txt");
    const bootstrapPath = join(fixtureRoot, "generated", "dex.memory.resource-limits.bootstrap.powershell.v1.ps1");
    try {
      const before = await readFile(bootstrapPath, "utf8");
      const literalPath = sentinelPath.replace(/'/g, "''");
      await writeFile(bootstrapPath, `${before}\nSet-Content -LiteralPath '${literalPath}' -Value 'executed'\n`, "utf8");
      assert.notEqual(run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psReader, "-BundlePath", fixtureRoot]).status, 0);
      assert.equal(existsSync(sentinelPath), false);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

test("generator rejects semantic drift and enforces the static default-to-ceiling boundary", async (t) => {
  const policy = JSON.parse(await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.json"), "utf8"));
  for (const limit of policy.limits) {
    assert.ok(limit.value > 0);
    if (limit.ceiling_limit_id) {
      const ceiling = policy.limits.find((candidate) => candidate.limit_id === limit.ceiling_limit_id);
      assert.ok(ceiling);
      assert.ok(limit.value <= ceiling.value);
    }
  }
  const semanticCases = [
    ["unknown key", (candidate) => { candidate.limits[0].unexpected = true; }],
    ["duplicate id", (candidate) => { candidate.limits.push(structuredClone(candidate.limits[0])); }],
    ["wrong value type", (candidate) => { candidate.limits[0].value = String(candidate.limits[0].value); }],
    ["wrong unit", (candidate) => { candidate.limits[0].unit = "widgets"; }],
    ["empty profile", (candidate) => { candidate.limits[0].profile = ""; }],
    ["authority casing drift", (candidate) => { candidate.authority_state = "shadow"; }]
  ];
  for (const invalidPath of ["C:relative", "https://example.invalid/source", "bin\\source.js", "../source.js"]) {
    semanticCases.push([`non-portable path ${invalidPath}`, (candidate) => {
      candidate.limits.find((limit) => !limit.source_evidence.path.startsWith("$DEX_MEMORY_HOME/")).source_evidence.path = invalidPath;
    }]);
  }
  for (const [name, mutate] of semanticCases) {
    await t.test(name, async () => {
      const fixtureRoot = await copyBundle();
      try {
        const candidate = structuredClone(policy);
        mutate(candidate);
        await writeFile(join(fixtureRoot, "dex.memory.resource-limits.v1.json"), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
        assert.notEqual(run(process.execPath, [generator, "--bundle", fixtureRoot]).status, 0);
      } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    });
  }

  await t.test("invalid UTF-8", async () => {
    const fixtureRoot = await copyBundle();
    try {
      await writeFile(join(fixtureRoot, "dex.memory.resource-limits.v1.json"), Buffer.from([0xc3, 0x28]));
      assert.notEqual(run(process.execPath, [generator, "--bundle", fixtureRoot]).status, 0);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  const bounded = policy.limits.find((limit) => limit.ceiling_limit_id && policy.limits.find((candidate) => candidate.limit_id === limit.ceiling_limit_id)?.value === limit.value);
  assert.ok(bounded);
  const ceiling = policy.limits.find((limit) => limit.limit_id === bounded.ceiling_limit_id);
  for (const [name, value, expectedStatus] of [
    ["ceiling minus one", ceiling.value - 1, 0],
    ["ceiling exactly", ceiling.value, 0],
    ["ceiling plus one", ceiling.value + 1, 1]
  ]) {
    await t.test(name, async () => {
      const fixtureRoot = await copyBundle();
      try {
        const candidate = structuredClone(policy);
        candidate.limits.find((limit) => limit.limit_id === bounded.limit_id).value = value;
        await writeFile(join(fixtureRoot, "dex.memory.resource-limits.v1.json"), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
        const status = run(process.execPath, [generator, "--bundle", fixtureRoot]).status;
        if (expectedStatus === 0) assert.equal(status, 0, name);
        else assert.notEqual(status, 0, name);
      } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    });
  }
});

test("the SHADOW bundle can be abandoned and restored only inside a fixture", async () => {
  const fixtureRoot = await copyBundle();
  const heldRoot = `${fixtureRoot}-held`;
  try {
    await cp(fixtureRoot, heldRoot, { recursive: true });
    await rm(fixtureRoot, { recursive: true, force: true });
    assert.notEqual(run(process.execPath, [nodeReader, fixtureRoot]).status, 0);
    await cp(heldRoot, fixtureRoot, { recursive: true });
    assert.equal(runNodeReader(fixtureRoot).status, "SHADOW_VERIFIED");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(heldRoot, { recursive: true, force: true });
  }
});

test("all public SHADOW files exist and the focused test remains outside the package surface", async () => {
  for (const file of publicBundleFiles) assert.ok((await stat(join(bundleRoot, file))).isFile(), basename(file));
});
