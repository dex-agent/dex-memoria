import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");
const fixtureSourceRoot = join(testRoot, "fixtures", "legacy-create-l1-l2-v1");

function registryTargetFor(root) {
  return join(root, ".agents", "skills", "dex-memoria");
}

const request = {
  contract: "dex.memory.create.request.v0",
  operation: "create",
  idempotency_key: "fixture:legacy-create-l1-l2:001",
  candidate: {
    localizer: "TRACER-CREATE-L1-L2",
    trigger: "abrir memoria",
    title: "Tracer create L1+L2",
    anchor: "tracer-create-l1-l2",
    body: "Detalhe fixture-only."
  }
};

async function runCli(args, stdin = "", environment = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], { cwd: repoRoot, env: environment, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      exitCode
    }));
    child.stdin.end(stdin);
  });
}

async function runCliFile(executablePath, workingDirectory, args, environment = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [executablePath, ...args], {
      cwd: workingDirectory,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      exitCode
    }));
  });
}

async function createFixture(t) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "dex-memoria-plan-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(join(fixtureRoot, "work"));
  await writeFile(
    join(fixtureRoot, ".dex-memory-fixture.json"),
    `${JSON.stringify({
      contract: "dex.memory.disposable-run.v1",
      operation: "create",
      disposable: true,
      targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"]
    }, null, 2)}\n`
  );
  await writeFile(
    join(fixtureRoot, "manifest.json"),
    await readFile(join(fixtureSourceRoot, "manifest.json"))
  );
  await writeFile(join(fixtureRoot, "work", "LEMBRANCA.md"), await readFile(join(fixtureSourceRoot, "baseline", "LEMBRANCA.md")));
  await writeFile(join(fixtureRoot, "work", "MEMORIA.md"), await readFile(join(fixtureSourceRoot, "baseline", "MEMORIA.md")));
  return fixtureRoot;
}

async function createPlan(fixtureRoot, input = request) {
  const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(input));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function assertCliError(result, exitCode, code) {
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^\{.*\}\n$/);
  const error = JSON.parse(result.stderr);
  assert.equal(error.contract, "dex.memory.error.v0");
  assert.equal(error.code, code);
  assert.equal(typeof error.message, "string");
  assert.ok(error.message.length > 0);
}

function stableJson(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((entry) => JSON.parse(stableJson(entry))));
  if (value && typeof value === "object") {
    return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, JSON.parse(stableJson(value[key]))])));
  }
  return JSON.stringify(value);
}

function resignPlan(plan) {
  const { plan_hash: ignored, ...unsigned } = plan;
  return { ...unsigned, plan_hash: createHash("sha256").update(stableJson(unsigned)).digest("hex") };
}

function resignPlanAndTransaction(plan) {
  const transaction_id = createHash("sha256").update(stableJson({
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    targets: plan.targets
  })).digest("hex").slice(0, 24);
  return resignPlan({ ...plan, transaction_id });
}

async function assertNoJournal(fixtureRoot) {
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
}

test("preserves exact V1 version output", async () => {
  const result = await runCli(["version"]);
  assert.deepEqual(result, { stdout: "0.1.17\n", stderr: "", exitCode: 0 });
});

test("doctor reports the active V2 runtime contract under a controlled environment", async (t) => {
  const memoryRoot = await mkdtemp(join(tmpdir(), "dex-memoria-doctor-"));
  t.after(() => rm(memoryRoot, { recursive: true, force: true }));
  const result = await runCli(["doctor"], "", { ...process.env, DEX_MEMORIA_HOME: memoryRoot });
  assert.deepEqual(result, {
    stdout: `dex-memoria 0.1.17 ok\nPacote: ${repoRoot}\nImplementation version: v2\nWriter selector: v2\nV1 compatibility: reader/restore\nCanonical skill: C:\\CodexProjetos\\dex-memoria\\SKILL.md\nEntrypoint: ${cliPath}\nMemoria home: ${resolve(memoryRoot)}\nMemoria home source: DEX_MEMORIA_HOME\n`,
    stderr: "",
    exitCode: 0
  });
});

test("preserves exact V1 memory-home output", async (t) => {
  const memoryRoot = await mkdtemp(join(tmpdir(), "dex-memoria-home-"));
  t.after(() => rm(memoryRoot, { recursive: true, force: true }));
  const result = await runCli(["memory-home"], "", { ...process.env, DEX_MEMORIA_HOME: memoryRoot });
  assert.deepEqual(result, {
    stdout: `${resolve(memoryRoot)}\nsource=DEX_MEMORIA_HOME\nglobal=<DEX_MEMORIA_HOME>/global\ntemas=<DEX_MEMORIA_HOME>/temas/<tema>\nprojeto=<WORKSPACE>/.agents\n`,
    stderr: "",
    exitCode: 0
  });
});

test("install dry-run is registry-only and names the canonical source", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryTarget = registryTargetFor(root);
  const result = await runCli(["install", "--registry-target", registryTarget, "--dry-run"], "", {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });
  assert.deepEqual(result, {
    stdout: [
      `Instalaria redirecionador global em: ${join(registryTarget, "SKILL.md")}`,
      `Instalaria interface do redirecionador em: ${join(registryTarget, "agents", "openai.yaml")}`,
      "Fonte canonica: C:\\CodexProjetos\\dex-memoria\\SKILL.md",
      "- registry\\agents-skills\\dex-memoria\\SKILL.md",
      "- registry\\agents-skills\\dex-memoria\\agents\\openai.yaml",
      ""
    ].join("\n"),
    stderr: "",
    exitCode: 0
  });
});

test("install writes only the global redirector package and leaves the legacy install root absent", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-registry-only-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryTarget = registryTargetFor(root);
  const result = await runCli(["install", "--registry-target", registryTarget, "--force"], "", {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(
    await readFile(join(registryTarget, "SKILL.md"), "utf8"),
    await readFile(join(repoRoot, "registry", "agents-skills", "dex-memoria", "SKILL.md"), "utf8")
  );
  assert.equal(
    await readFile(join(registryTarget, "agents", "openai.yaml"), "utf8"),
    await readFile(join(repoRoot, "registry", "agents-skills", "dex-memoria", "agents", "openai.yaml"), "utf8")
  );
  assert.deepEqual((await readdir(registryTarget)).sort(), ["SKILL.md", "agents"]);
  assert.deepEqual(await readdir(join(registryTarget, "agents")), ["openai.yaml"]);
  await assert.rejects(readdir(join(root, ".dex-agent")), { code: "ENOENT" });
});

test("install rejects a registry target outside .agents/skills/dex-memoria", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-registry-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryTarget = join(root, "arbitrary", "dex-memoria");

  const result = await runCli(["install", "--registry-target", registryTarget, "--force"], "", {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\.agents[\\/]skills[\\/]dex-memoria/i);
  await assert.rejects(readdir(registryTarget), { code: "ENOENT" });
});

test("install rejects a canonical-looking registry outside the active user home", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-registry-home-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryTarget = registryTargetFor(join(root, "other-user"));

  const result = await runCli(["install", "--registry-target", registryTarget, "--force"], "", {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /USERPROFILE|home/i);
  await assert.rejects(readdir(registryTarget), { code: "ENOENT" });
});

test("install updates an existing clean bridge through an external backup and verified replacement", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-registry-update-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryTarget = registryTargetFor(root);
  await mkdir(join(registryTarget, "agents"), { recursive: true });
  await writeFile(join(registryTarget, "SKILL.md"), "old-bridge", "utf8");
  await writeFile(join(registryTarget, "agents", "openai.yaml"), "old-interface", "utf8");

  const result = await runCli(["install", "--registry-target", registryTarget, "--force"], "", {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /backup do redirecionador:/i);
  assert.match(result.stdout, /sha-256 verificado/i);
  const backupRoot = join(root, ".agents", "backups");
  const backupEntries = await readdir(backupRoot);
  assert.equal(backupEntries.length, 1);
  const backupPath = join(backupRoot, backupEntries[0]);
  assert.equal(await readFile(join(backupPath, "SKILL.md"), "utf8"), "old-bridge");
  assert.equal(await readFile(join(backupPath, "agents", "openai.yaml"), "utf8"), "old-interface");
  assert.equal(
    await readFile(join(registryTarget, "SKILL.md"), "utf8"),
    await readFile(join(repoRoot, "registry", "agents-skills", "dex-memoria", "SKILL.md"), "utf8")
  );
});

test("install refuses a legacy-contaminated registry before overwriting bytes", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-registry-residue-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryTarget = registryTargetFor(root);
  const installedSkill = join(registryTarget, "SKILL.md");
  await mkdir(join(registryTarget, "bin"), { recursive: true });
  await writeFile(installedSkill, "legacy-skill-bytes", "utf8");
  await writeFile(join(registryTarget, "bin", "dex-memoria.js"), "legacy-runtime-bytes", "utf8");

  const result = await runCli(["install", "--registry-target", registryTarget, "--force"], "", {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /residuos legacy/i);
  assert.match(result.stderr, /backup/i);
  assert.equal(await readFile(installedSkill, "utf8"), "legacy-skill-bytes");
  assert.equal(await readFile(join(registryTarget, "bin", "dex-memoria.js"), "utf8"), "legacy-runtime-bytes");
});

test("install dry-run fails on legacy residue exactly as apply would", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-registry-dry-residue-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryTarget = registryTargetFor(root);
  await mkdir(join(registryTarget, "docs"), { recursive: true });
  await writeFile(join(registryTarget, "SKILL.md"), "legacy-skill-bytes", "utf8");
  await writeFile(join(registryTarget, "docs", "usage.md"), "legacy-doc-bytes", "utf8");

  const result = await runCli(["install", "--registry-target", registryTarget, "--force", "--dry-run"], "", {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /residuos legacy/i);
  assert.equal(await readFile(join(registryTarget, "SKILL.md"), "utf8"), "legacy-skill-bytes");
  assert.equal(await readFile(join(registryTarget, "docs", "usage.md"), "utf8"), "legacy-doc-bytes");
});

test("install refuses a copied CLI even when the canonical skill is readable", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-noncanonical-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const copiedRoot = join(root, "copied-package");
  const copiedCli = join(copiedRoot, "bin", "dex-memoria.js");
  await cp(join(repoRoot, "bin"), join(copiedRoot, "bin"), { recursive: true });
  await cp(join(repoRoot, "registry"), join(copiedRoot, "registry"), { recursive: true });

  const result = await runCliFile(copiedCli, copiedRoot, [
    "install",
    "--registry-target",
    registryTargetFor(root),
    "--force"
  ], { ...process.env, HOME: root, USERPROFILE: root });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /pacote canonico|fonte canonica/i);
  await assert.rejects(readdir(registryTargetFor(root)), { code: "ENOENT" });
});

test("the V2 operational CLI refuses a copied package before parsing a request", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-v2-noncanonical-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const copiedRoot = join(root, "copied-package");
  const copiedCli = join(copiedRoot, "bin", "dex-memoria.js");
  await cp(join(repoRoot, "bin"), join(copiedRoot, "bin"), { recursive: true });

  const result = await runCliFile(copiedCli, copiedRoot, ["v2", "plan"], {
    ...process.env,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /pacote canonico/i);
});

test("a fabricated Git marker cannot authorize a copied package", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-source-checkout-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkoutRoot = join(root, "checkout");
  const checkoutCli = join(checkoutRoot, "bin", "dex-memoria.js");

  await cp(join(repoRoot, "bin"), join(checkoutRoot, "bin"), { recursive: true });
  await cp(join(repoRoot, "registry"), join(checkoutRoot, "registry"), { recursive: true });
  await cp(join(repoRoot, "contracts"), join(checkoutRoot, "contracts"), { recursive: true });
  await mkdir(join(checkoutRoot, "docs"), { recursive: true });
  for (const relativePath of [
    "package.json",
    "VERSION",
    "SKILL.md",
    "SPEC.md",
    "README.md",
    "docs/usage.md"
  ]) {
    await cp(join(repoRoot, relativePath), join(checkoutRoot, relativePath));
  }
  await mkdir(join(checkoutRoot, ".git"), { recursive: true });

  const result = await runCliFile(checkoutCli, checkoutRoot, ["doctor"], {
    ...process.env,
    DEX_MEMORIA_HOME: join(root, "memories"),
    DEX_MEMORIA_SOURCE_CHECKOUT_ROOT: checkoutRoot,
    HOME: root,
    USERPROFILE: root
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /pacote canonico|checkouts Git de verificacao/i);
});

test("install rejects the removed --target option instead of ignoring it", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-target-rejected-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await runCli([
    "install",
    "--target",
    join(root, "forbidden"),
    "--registry-target",
    registryTargetFor(root),
    "--dry-run"
  ], "", { ...process.env, HOME: root, USERPROFILE: root });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Opcao desconhecida para install: --target/);
});

test("install blocks explicitly before writing when the canonical source is absent or not a file", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-canonical-absent-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const productionSource = await readFile(cliPath, "utf8");
  assert.match(productionSource, /accessSync\(CANONICAL_SKILL_PATH, fs\.constants\.R_OK\)/);

  for (const scenario of ["absent", "directory"]) {
    const scenarioRoot = join(root, scenario);
    const sandboxCli = join(scenarioRoot, "bin", "dex-memoria.js");
    const sandboxRedirector = join(scenarioRoot, "registry", "agents-skills", "dex-memoria", "SKILL.md");
    const sandboxRedirectorInterface = join(scenarioRoot, "registry", "agents-skills", "dex-memoria", "agents", "openai.yaml");
    const invalidCanonical = join(scenarioRoot, "canonical", "SKILL.md");
    const registryTarget = registryTargetFor(scenarioRoot);
    await cp(join(repoRoot, "bin"), join(scenarioRoot, "bin"), { recursive: true });
    await mkdir(dirname(sandboxRedirector), { recursive: true });
    await mkdir(dirname(sandboxRedirectorInterface), { recursive: true });
    if (scenario === "directory") {
      await mkdir(invalidCanonical, { recursive: true });
    }

    const sandboxSource = productionSource.replace(
      /const CANONICAL_SKILL_PATH = .*?;/,
      `const CANONICAL_SKILL_PATH = ${JSON.stringify(invalidCanonical)};`
    );
    assert.notEqual(sandboxSource, productionSource);
    await writeFile(sandboxCli, sandboxSource, "utf8");
    await writeFile(
      sandboxRedirector,
      await readFile(join(repoRoot, "registry", "agents-skills", "dex-memoria", "SKILL.md"))
    );
    await writeFile(
      sandboxRedirectorInterface,
      await readFile(join(repoRoot, "registry", "agents-skills", "dex-memoria", "agents", "openai.yaml"))
    );

    const result = await runCliFile(sandboxCli, scenarioRoot, [
      "install",
      "--registry-target",
      registryTarget,
      "--force"
    ], { ...process.env, HOME: scenarioRoot, USERPROFILE: scenarioRoot });

    assert.equal(result.exitCode, 1, scenario);
    assert.equal(result.stdout, "", scenario);
    assert.match(result.stderr, /Fonte canonica indisponivel/, scenario);
    await assert.rejects(readdir(registryTarget), { code: "ENOENT" });
  }
});

test("the registry redirector has one canonical source and no fallback resolution", async () => {
  const redirector = await readFile(join(repoRoot, "registry", "agents-skills", "dex-memoria", "SKILL.md"), "utf8");
  assert.match(redirector, /C:\\CodexProjetos\\dex-memoria\\SKILL\.md/);
  assert.match(redirector, /bloqueio explicito/i);
  assert.doesNotMatch(redirector, /\.dex-agent/);
  assert.doesNotMatch(redirector, /<WORKSPACE>\\skills\\dex-memoria/);
  assert.doesNotMatch(redirector, /Ordem De Resolucao/);
});

test("help advertises the fixture-only create apply command", async () => {
  const result = await runCli(["help"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /dex-memoria create apply --fixture <fixture-root>/);
  assert.match(result.stdout, /dex-memoria v2 validate-root/);
});

test("the internal planner source has no filesystem, clock, random or environment capability", async () => {
  const source = await readFile(join(repoRoot, "bin", "create-plan.js"), "utf8");
  assert.doesNotMatch(source, /node:fs|require\(["']fs["']\)|Date\s*\(|Date\.now|process\.env|Math\.random/);
});

test("npm test runs the node:test contract suite", async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  assert.match(packageJson.scripts.test, /node --test/);
});

test("the test suite is Node 18 portable and self-contained", async () => {
  const source = await readFile(new URL("create-plan.test.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /import\.meta\.dirname/);
  assert.match(source, /fileURLToPath\(import\.meta\.url\)/);
  assert.doesNotMatch(source, new RegExp(["laboratorio", "memories"].join("-")));
  assert.doesNotMatch(source, /import \{ homedir,/);
});

test("create plan emits a deterministic read-only plan matching legacy goldens", async (t) => {
  const fixtureRoot = await createFixture(t);
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));

  const first = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request));
  const second = await runCli(["create", "plan", "--fixture", fixtureRoot], `${JSON.stringify(request)}\n`);

  assert.equal(first.exitCode, 0);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assert.match(first.stdout, /^\{.*\}\n$/);

  const plan = JSON.parse(first.stdout);
  assert.deepEqual(Object.keys(plan), [
    "contract",
    "operation",
    "idempotency_key",
    "request",
    "request_fingerprint",
    "transaction_id",
    "targets",
    "plan_hash"
  ]);
  assert.equal(plan.contract, "dex.memory.create.plan.v0");
  assert.equal(plan.operation, "create");
  assert.equal(plan.idempotency_key, request.idempotency_key);
  assert.deepEqual(plan.request, request);
  assert.match(plan.request_fingerprint, /^[a-f0-9]{64}$/);
  assert.match(plan.transaction_id, /^[a-f0-9]{24}$/);
  assert.match(plan.plan_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(plan.targets.map((target) => target.slot), ["l1", "l2"]);
  assert.deepEqual(plan.targets.map((target) => target.relative_path), ["work/LEMBRANCA.md", "work/MEMORIA.md"]);
  assert.deepEqual(Object.keys(plan.targets[0]), [
    "slot", "relative_path", "before_exists", "before_sha256", "before_base64",
    "after_sha256", "after_base64", "changed"
  ]);
  assert.doesNotMatch(first.stdout, new RegExp(fixtureRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.deepEqual(Buffer.from(plan.targets[0].after_base64, "base64"), await readFile(join(fixtureSourceRoot, "expected", "LEMBRANCA.md")));
  assert.deepEqual(Buffer.from(plan.targets[1].after_base64, "base64"), await readFile(join(fixtureSourceRoot, "expected", "MEMORIA.md")));
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
});

test("create plan rejects invalid JSON documents with the schema exit contract", async (t) => {
  const fixtureRoot = await createFixture(t);
  for (const input of ["", "{", "{}{}", `${JSON.stringify(request)}\n${JSON.stringify(request)}`, Buffer.from([0xff])]) {
    assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], input), 2, "INVALID_JSON");
  }
});

test("create plan rejects requests larger than 1 MiB", async (t) => {
  const fixtureRoot = await createFixture(t);
  const input = Buffer.alloc(1024 * 1024 + 1, 0x20).toString("utf8");
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], input), 2, "INVALID_SCHEMA");
});

test("create plan enforces the closed request schema and lexical rules", async (t) => {
  const fixtureRoot = await createFixture(t);
  const cases = [
    { value: { ...request, path: "work/LEMBRANCA.md" }, label: "unknown root field" },
    { value: { ...request, contract: "other" }, label: "contract" },
    { value: { ...request, operation: "update" }, label: "operation" },
    { value: { ...request, idempotency_key: " " }, label: "blank idempotency key" },
    { value: { ...request, idempotency_key: "x".repeat(257) }, label: "idempotency key limit" },
    { value: { ...request, candidate: { ...request.candidate, target: "work/MEMORIA.md" } }, label: "unknown candidate field" },
    { value: { ...request, candidate: { ...request.candidate, localizer: "bad-localizer" } }, label: "localizer syntax" },
    { value: { ...request, candidate: { ...request.candidate, localizer: "A".repeat(129) } }, label: "localizer limit" },
    { value: { ...request, candidate: { ...request.candidate, trigger: "x".repeat(513) } }, label: "trigger limit" },
    { value: { ...request, candidate: { ...request.candidate, title: "x".repeat(257) } }, label: "title limit" },
    { value: { ...request, candidate: { ...request.candidate, anchor: "Bad-Anchor" } }, label: "anchor syntax" },
    { value: { ...request, candidate: { ...request.candidate, anchor: "a".repeat(129) } }, label: "anchor limit" },
    { value: { ...request, candidate: { ...request.candidate, body: "x".repeat(65537) } }, label: "body limit" },
    { value: { ...request, candidate: { ...request.candidate, body: "\t" } }, label: "blank body" }
  ];
  for (const { value, label } of cases) {
    const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(value));
    try {
      assertCliError(result, 2, "INVALID_SCHEMA");
    } catch (error) {
      error.message = `${label}: ${error.message}`;
      throw error;
    }
  }
});

test("create plan rejects invalid fixture command usage", async () => {
  assertCliError(await runCli(["create", "plan"], JSON.stringify(request)), 2, "INVALID_USAGE");
  assertCliError(await runCli(["create", "plan", "--fixture", "a", "extra"], JSON.stringify(request)), 2, "INVALID_USAGE");
  assertCliError(await runCli(["create", "apply"], JSON.stringify(request)), 2, "INVALID_USAGE");
});

test("create plan blocks invalid marker and manifest before planning", async (t) => {
  const fixtureRoot = await createFixture(t);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), "{}\n");
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");

  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"]
  })}\n`);
  await writeFile(join(fixtureRoot, "manifest.json"), `${JSON.stringify({
    contract: "dex.memory.fixture.legacy-create-l1-l2.v1",
    operation: "create",
    disposable_runs_only: true,
    targets: ["../LEMBRANCA.md", "work/MEMORIA.md"]
  })}\n`);
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");
});

test("create plan enforces closed marker and manifest schemas", async (t) => {
  const markerRoot = await createFixture(t);
  await writeFile(join(markerRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"],
    extra: true
  })}\n`);
  assertCliError(await runCli(["create", "plan", "--fixture", markerRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");

  const manifestRoot = await createFixture(t);
  await writeFile(join(manifestRoot, "manifest.json"), `${JSON.stringify({
    contract: "dex.memory.fixture.legacy-create-l1-l2.v1",
    operation: "create",
    disposable_runs_only: true,
    targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"],
    extra: true
  })}\n`);
  assertCliError(await runCli(["create", "plan", "--fixture", manifestRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");
});

test("create plan blocks a symlink target", async (t) => {
  const fixtureRoot = await createFixture(t);
  const external = join(fixtureRoot, "external.md");
  await writeFile(external, "external\n");
  await rm(join(fixtureRoot, "work", "LEMBRANCA.md"));
  try {
    await symlink(external, join(fixtureRoot, "work", "LEMBRANCA.md"), "file");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");
});

test("create plan sanitizes unexpected target I/O failures", async (t) => {
  const fixtureRoot = await createFixture(t);
  const target = join(fixtureRoot, "work", "LEMBRANCA.md");
  await rm(target);
  await mkdir(target);
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 6, "IO_FAILURE");
});

test("create apply commits both targets byte for byte and emits a receipt", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^\{.*\}\n$/);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, {
    contract: "dex.memory.create.receipt.v0",
    command: "apply",
    status: "COMMITTED",
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
  });
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), Buffer.from(plan.targets[0].after_base64, "base64"));
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), Buffer.from(plan.targets[1].after_base64, "base64"));
  assert.deepEqual(await readdir(join(fixtureRoot, "journal", plan.transaction_id)), [
    "0001-PREPARED.json", "0002-L1_PUBLISHED.json", "0003-COMMITTED.json"
  ]);
  assert.deepEqual(JSON.parse(await readFile(join(fixtureRoot, "journal", plan.transaction_id, "0001-PREPARED.json"), "utf8")), {
    state: "PREPARED",
    transaction_id: plan.transaction_id,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    plan
  });
});

test("create apply rejects a closed-schema violation before journal creation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify({ ...plan, path: "outside" }));
  assertCliError(result, 2, "INVALID_SCHEMA");
  await assertNoJournal(fixtureRoot);
});

test("create apply rejects a tampered plan hash before journal creation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  plan.targets[0].after_base64 = Buffer.from("tampered\n").toString("base64");
  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
  assertCliError(result, 4, "PLAN_CONFLICT");
  await assertNoJournal(fixtureRoot);
});

test("create apply rejects arbitrary re-signed L1 and L2 payloads before journal creation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const original = await createPlan(fixtureRoot);
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  for (const [index, arbitrary] of ["arbitrary-l1\n", "arbitrary-l2\n"].entries()) {
    const bytes = Buffer.from(arbitrary);
    original.targets[index].after_base64 = bytes.toString("base64");
    original.targets[index].after_sha256 = createHash("sha256").update(bytes).digest("hex");
    original.targets[index].changed = true;
  }
  const plan = resignPlanAndTransaction(original);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 4, "PLAN_CONFLICT");
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
  await assertNoJournal(fixtureRoot);
});

test("create apply rejects re-signed relative paths not derived from the fixture", async (t) => {
  const fixtureRoot = await createFixture(t);
  const original = await createPlan(fixtureRoot);
  original.targets[0].relative_path = "work/MEMORIA.md";
  original.targets[1].relative_path = "work/LEMBRANCA.md";
  const plan = resignPlan(original);
  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
  assertCliError(result, 4, "PLAN_CONFLICT");
  await assertNoJournal(fixtureRoot);
});

for (const { slot, file } of [
  { slot: "l1", file: "LEMBRANCA.md" },
  { slot: "l2", file: "MEMORIA.md" }
]) {
  test(`create apply preserves manual ${slot} drift and creates no journal`, async (t) => {
    const fixtureRoot = await createFixture(t);
    const plan = await createPlan(fixtureRoot);
    const targetPath = join(fixtureRoot, "work", file);
    const edited = Buffer.from(`manual-${slot}-edit\n`);
    await writeFile(targetPath, edited);
    const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
    assertCliError(result, 4, "PLAN_CONFLICT");
    assert.deepEqual(await readFile(targetPath), edited);
    await assertNoJournal(fixtureRoot);
  });
}

test("create apply enforces JSON, usage and marker stream contracts before journal", async (t) => {
  const fixtureRoot = await createFixture(t);
  assertCliError(await runCli(["create", "apply", "--fixture", fixtureRoot], "{"), 2, "INVALID_JSON");
  await assertNoJournal(fixtureRoot);

  const plan = await createPlan(fixtureRoot);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), "{}\n");
  const blocked = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
  assertCliError(blocked, 3, "SAFETY_BLOCKED");
  assert.doesNotMatch(blocked.stderr, new RegExp(fixtureRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  await assertNoJournal(fixtureRoot);
});

test("create apply sanitizes unexpected target I/O failure with exit 6 and no journal", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const targetPath = join(fixtureRoot, "work", "LEMBRANCA.md");
  await rm(targetPath);
  await mkdir(targetPath);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 6, "IO_FAILURE");
  assert.doesNotMatch(result.stderr, /EISDIR|LEMBRANCA|dex-memoria-plan-/i);
  await assertNoJournal(fixtureRoot);
});

test("create apply blocks a journal symlink before any external write", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memoria-journal-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  try {
    await symlink(externalRoot, join(fixtureRoot, "journal"), "junction");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 3, "SAFETY_BLOCKED");
  assert.deepEqual(await readdir(externalRoot), []);
});

test("create apply blocks a transaction journal symlink before any external write", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memoria-transaction-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  await mkdir(join(fixtureRoot, "journal"));
  try {
    await symlink(externalRoot, join(fixtureRoot, "journal", plan.transaction_id), "junction");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 3, "SAFETY_BLOCKED");
  assert.deepEqual(await readdir(externalRoot), []);
});

test("create apply returns ALREADY_COMMITTED without new checkpoints or duplicate content", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  assert.equal((await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan))).exitCode, 0);
  const firstL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const firstL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  const beforeCheckpoints = await readdir(join(fixtureRoot, "journal", plan.transaction_id));

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, "ALREADY_COMMITTED");
  assert.equal(receipt.journal_state, "COMMITTED");
  assert.equal(receipt.recovery_required, false);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), firstL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), firstL2);
  assert.deepEqual(await readdir(join(fixtureRoot, "journal", plan.transaction_id)), beforeCheckpoints);
});

test("create apply returns the original ALREADY_COMMITTED receipt for a new plan of the same request and key", async (t) => {
  const fixtureRoot = await createFixture(t);
  const originalPlan = await createPlan(fixtureRoot);
  assert.equal((await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(originalPlan))).exitCode, 0);
  const committedL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const committedL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  const originalCheckpoints = await readdir(join(fixtureRoot, "journal", originalPlan.transaction_id));
  const replanned = await createPlan(fixtureRoot);
  assert.notEqual(replanned.plan_hash, originalPlan.plan_hash);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(replanned));

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    contract: "dex.memory.create.receipt.v0",
    command: "apply",
    status: "ALREADY_COMMITTED",
    transaction_id: originalPlan.transaction_id,
    idempotency_key: originalPlan.idempotency_key,
    request_fingerprint: originalPlan.request_fingerprint,
    plan_hash: originalPlan.plan_hash,
    writes: originalPlan.targets.map((target) => ({
      slot: target.slot,
      relative_path: target.relative_path,
      before_sha256: target.before_sha256,
      after_sha256: target.after_sha256,
      changed: target.changed
    })),
    journal_state: "COMMITTED",
    recovery_required: false
  });
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), committedL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), committedL2);
  assert.deepEqual(await readdir(join(fixtureRoot, "journal", originalPlan.transaction_id)), originalCheckpoints);
  await assert.rejects(readdir(join(fixtureRoot, "journal", replanned.transaction_id)), { code: "ENOENT" });
});

test("create apply rejects a skipped PREPARED to COMMITTED journal sequence without target mutation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  const transactionRoot = join(fixtureRoot, "journal", plan.transaction_id);
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
    state: "PREPARED",
    transaction_id: plan.transaction_id,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    plan
  })}\n`);
  await writeFile(join(transactionRoot, "0002-COMMITTED.json"), `${JSON.stringify({
    state: "COMMITTED",
    transaction_id: plan.transaction_id,
    plan_hash: plan.plan_hash
  })}\n`);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 4, "JOURNAL_CONFLICT");
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
  assert.deepEqual(await readdir(transactionRoot), ["0001-PREPARED.json", "0002-COMMITTED.json"]);
});

test("create apply rejects two valid journals for the same idempotency key without target mutation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const firstPlan = await createPlan(fixtureRoot);
  await writeFile(join(fixtureRoot, "work", "LEMBRANCA.md"), "alternate-l1-baseline\n");
  await writeFile(join(fixtureRoot, "work", "MEMORIA.md"), "alternate-l2-baseline\n");
  const secondPlan = await createPlan(fixtureRoot);
  await writeFile(join(fixtureRoot, "work", "LEMBRANCA.md"), Buffer.from(firstPlan.targets[0].before_base64, "base64"));
  await writeFile(join(fixtureRoot, "work", "MEMORIA.md"), Buffer.from(firstPlan.targets[1].before_base64, "base64"));
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  for (const plan of [firstPlan, secondPlan]) {
    const transactionRoot = join(fixtureRoot, "journal", plan.transaction_id);
    await mkdir(transactionRoot, { recursive: true });
    await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
      state: "PREPARED",
      transaction_id: plan.transaction_id,
      idempotency_key: plan.idempotency_key,
      request_fingerprint: plan.request_fingerprint,
      plan_hash: plan.plan_hash,
      plan
    })}\n`);
    await writeFile(join(transactionRoot, "0002-L1_PUBLISHED.json"), `${JSON.stringify({
      state: "L1_PUBLISHED",
      transaction_id: plan.transaction_id
    })}\n`);
    await writeFile(join(transactionRoot, "0003-COMMITTED.json"), `${JSON.stringify({
      state: "COMMITTED",
      transaction_id: plan.transaction_id,
      plan_hash: plan.plan_hash
    })}\n`);
  }

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(firstPlan));

  assertCliError(result, 4, "JOURNAL_CONFLICT");
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
});

test("create apply rejects an idempotency key reused for a divergent request and plan", async (t) => {
  const fixtureRoot = await createFixture(t);
  const committedPlan = await createPlan(fixtureRoot);
  const divergentPlan = await createPlan(fixtureRoot, {
    ...request,
    candidate: { ...request.candidate, body: "Different fixture-only detail." }
  });
  assert.equal((await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(committedPlan))).exitCode, 0);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(divergentPlan));

  assertCliError(result, 4, "IDEMPOTENCY_CONFLICT");
  await assert.rejects(readdir(join(fixtureRoot, "journal", divergentPlan.transaction_id)), { code: "ENOENT" });
});

for (const state of ["PREPARED", "L1_PUBLISHED"]) {
  test(`create apply requires recovery when an existing journal is ${state}`, async (t) => {
    const fixtureRoot = await createFixture(t);
    const plan = await createPlan(fixtureRoot);
    const transactionRoot = join(fixtureRoot, "journal", plan.transaction_id);
    await mkdir(transactionRoot, { recursive: true });
    await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
      state: "PREPARED",
      transaction_id: plan.transaction_id,
      idempotency_key: plan.idempotency_key,
      request_fingerprint: plan.request_fingerprint,
      plan_hash: plan.plan_hash,
      plan
    })}\n`);
    if (state !== "PREPARED") {
      await writeFile(join(transactionRoot, `0002-${state}.json`), `${JSON.stringify({ state, transaction_id: plan.transaction_id })}\n`);
    }

    const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

    assertCliError(result, 5, "RECOVERY_REQUIRED");
    assert.deepEqual(await readdir(transactionRoot), state === "PREPARED"
      ? ["0001-PREPARED.json"]
      : ["0001-PREPARED.json", `0002-${state}.json`]);
  });
}

test("create apply treats ROLLED_BACK as terminal and requires a new idempotency key", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const transactionRoot = join(fixtureRoot, "journal", plan.transaction_id);
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
    state: "PREPARED",
    transaction_id: plan.transaction_id,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    plan
  })}\n`);
  await writeFile(join(transactionRoot, "0002-ROLLED_BACK.json"), `${JSON.stringify({
    state: "ROLLED_BACK",
    transaction_id: plan.transaction_id
  })}\n`);
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 4, "TRANSACTION_ROLLED_BACK");
  assert.match(JSON.parse(result.stderr).message, /new idempotency key/i);
  assert.doesNotMatch(result.stderr, /recover/i);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
  assert.deepEqual(await readdir(transactionRoot), ["0001-PREPARED.json", "0002-ROLLED_BACK.json"]);
});
