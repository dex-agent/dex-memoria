import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
const repoRoot = resolve(import.meta.dirname, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");
const oracleRoot = join(homedir(), ".agents", "laboratorio-memories", "fixtures", "legacy-create-l1-l2-v1");

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
    await readFile(join(oracleRoot, "manifest.json"))
  );
  await writeFile(join(fixtureRoot, "work", "LEMBRANCA.md"), await readFile(join(oracleRoot, "baseline", "LEMBRANCA.md")));
  await writeFile(join(fixtureRoot, "work", "MEMORIA.md"), await readFile(join(oracleRoot, "baseline", "MEMORIA.md")));
  return fixtureRoot;
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

test("preserves exact V1 version output", async () => {
  const result = await runCli(["version"]);
  assert.deepEqual(result, { stdout: "0.1.6\n", stderr: "", exitCode: 0 });
});

test("preserves exact V1 doctor output shape", async () => {
  const result = await runCli(["doctor"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^dex-memoria 0\.1\.6 ok\nPacote: .+\nMemoria home: .+\nMemoria home source: .+\nModo: contrato documental, sem runtime proprio\n$/);
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

test("preserves exact V1 install dry-run output", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "target");
  const registryTarget = join(root, "registry");
  const result = await runCli(["install", "--target", target, "--registry-target", registryTarget, "--dry-run"]);
  assert.deepEqual(result, {
    stdout: [
      `Instalaria dex-memoria em: ${target}`,
      "- SKILL.md", "- SPEC.md", "- README.md", "- CHANGELOG.md", "- DECISIONS.md", "- VERSION", "- package.json",
      "- bin", "- contracts", "- docs", "- registry", "- templates", "- examples",
      `Instalaria redirecionador global em: ${join(registryTarget, "SKILL.md")}`,
      "- registry\\agents-skills\\dex-memoria\\SKILL.md",
      ""
    ].join("\n"),
    stderr: "",
    exitCode: 0
  });
});

test("the internal planner source has no filesystem, clock, random or environment capability", async () => {
  const source = await readFile(join(repoRoot, "bin", "create-plan.js"), "utf8");
  assert.doesNotMatch(source, /node:fs|require\(["']fs["']\)|Date\s*\(|Date\.now|process\.env|Math\.random/);
});

test("npm test runs the node:test contract suite", async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  assert.match(packageJson.scripts.test, /node --test/);
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
    "request_fingerprint",
    "transaction_id",
    "targets",
    "plan_hash"
  ]);
  assert.equal(plan.contract, "dex.memory.create.plan.v0");
  assert.equal(plan.operation, "create");
  assert.equal(plan.idempotency_key, request.idempotency_key);
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
  assert.deepEqual(Buffer.from(plan.targets[0].after_base64, "base64"), await readFile(join(oracleRoot, "expected", "LEMBRANCA.md")));
  assert.deepEqual(Buffer.from(plan.targets[1].after_base64, "base64"), await readFile(join(oracleRoot, "expected", "MEMORIA.md")));
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
  assertCliError(await runCli(["create", "apply", "--fixture", "a"], JSON.stringify(request)), 2, "INVALID_USAGE");
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
