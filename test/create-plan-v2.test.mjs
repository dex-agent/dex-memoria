import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");
const fixturesRoot = join(testRoot, "fixtures");

const l2Request = {
  contract: "dex.memory.create.theme-v2.request.v0",
  profile: "governed-theme-v2",
  operation: "create",
  idempotency_key: "fixture:theme-v2:l2:001",
  identity: "11111111-1111-4111-8111-111111111111",
  target_layer: "L2",
  route_decision: "explicit-l2-memory",
  slug: "mapa-visual-v2",
  trigger: "Quando o mapa [visual] (V2) falhar?",
  title: "Mapa visual V2",
  body: "Memória operacional curta.",
  created_at: "2026-07-13T12:00:00.000Z"
};

const l3Request = {
  ...l2Request,
  idempotency_key: "fixture:theme-v2:l3:001",
  identity: "22222222-2222-4222-8222-222222222222",
  target_layer: "L3",
  route_decision: "explicit-l3-knowledge",
  slug: "journal-recuperavel",
  trigger: "E SE o journal falhar?",
  title: "Journal recuperável",
  body: "Conhecimento profundo com referências e artefatos sob demanda.",
  owner_skill: "dex-memoria"
};

async function runCli(args, stdin = "") {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
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
    child.stdin.end(stdin);
  });
}

async function createFixture(t, layer) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), `dex-memoria-v2-${layer.toLowerCase()}-`));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const sourceRoot = join(fixturesRoot, `governed-theme-v2-plan-${layer.toLowerCase()}`);
  await cp(join(sourceRoot, "baseline"), join(fixtureRoot, "work"), { recursive: true });
  await cp(join(sourceRoot, "manifest.json"), join(fixtureRoot, "manifest.json"));
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/tema-exemplo"]
  }, null, 2)}\n`);
  return fixtureRoot;
}

async function snapshotTree(root) {
  const rows = [];
  async function visit(relative = "") {
    const absolute = join(root, relative);
    for (const name of (await readdir(absolute)).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name;
      const childAbsolute = join(root, childRelative);
      const stat = await lstat(childAbsolute);
      if (stat.isDirectory()) {
        rows.push(`d:${childRelative}`);
        await visit(childRelative);
      } else {
        const bytes = await readFile(childAbsolute);
        rows.push(`f:${childRelative}:${createHash("sha256").update(bytes).digest("hex")}`);
      }
    }
  }
  await visit();
  return rows;
}

function assertCliError(result, exitCode, code) {
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^\{.*\}\n$/);
  const error = JSON.parse(result.stderr);
  assert.equal(error.contract, "dex.memory.error.v0");
  assert.equal(error.code, code);
  assert.equal(typeof error.message, "string");
}

function decodeTarget(plan, slot) {
  const target = plan.targets.find((entry) => entry.slot === slot);
  assert.ok(target, `missing target ${slot}`);
  return Buffer.from(target.after_base64, "base64").toString("utf8");
}

test("V2 L2 plan is deterministic, read-only and routes only to memorias", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const before = await snapshotTree(fixtureRoot);
  const first = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(l2Request));
  const second = await runCli(["create", "plan", "--fixture", fixtureRoot], `${JSON.stringify(l2Request)}\n`);
  const reorderedRequest = Object.fromEntries(Object.entries(l2Request).reverse());
  const reordered = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(reorderedRequest));

  assert.equal(first.exitCode, 0);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stdout, reordered.stdout);
  assert.deepEqual(await snapshotTree(fixtureRoot), before);

  const plan = JSON.parse(first.stdout);
  assert.equal(plan.contract, "dex.memory.create.theme-v2.plan.v0");
  assert.equal(plan.profile, "governed-theme-v2");
  assert.equal(plan.serialization_order_only, true);
  assert.equal("publish_order" in plan, false);
  assert.deepEqual(plan.targets.map((target) => target.slot), ["l1", "index", "destination"]);
  assert.deepEqual(plan.targets.map((target) => target.relative_path), [
    "work/tema-exemplo/lembranca.md",
    "work/tema-exemplo/memorias/INDEX.md",
    "work/tema-exemplo/memorias/mapa-visual-v2.md"
  ]);
  assert.doesNotMatch(first.stdout, /conhecimento\/mapa-visual-v2/);
  assert.ok(decodeTarget(plan, "l1").includes("[Quando o mapa \\[visual\\] (V2) falhar?](memorias/mapa-visual-v2.md)"));
  assert.ok(decodeTarget(plan, "l1").includes(") #tema-exemplo <!-- dex.memory.route.v1"));
  assert.match(decodeTarget(plan, "l1"), /dex\.memory\.route\.v1 \{"identity":"11111111-1111-4111-8111-111111111111","last_reused_at":null,"layer":"L2","reuse_count":0,"slug":"mapa-visual-v2","updated_at":"2026-07-13T12:00:00\.000Z"\}/);
  assert.match(decodeTarget(plan, "index"), /\[Mapa visual V2\]\(mapa-visual-v2\.md\)/);
  assert.match(decodeTarget(plan, "destination"), /layer: L2/);
  assert.match(decodeTarget(plan, "destination"), /last_reused_at: null/);
  assert.match(decodeTarget(plan, "destination"), /reuse_count: 0/);
  assert.match(decodeTarget(plan, "destination"), /L1 relacionada: \[\.\.\/lembranca\.md\]\(\.\.\/lembranca\.md\)/);
});

test("V2 L3 plan routes directly from L1 to knowledge and requires an owner", async (t) => {
  const fixtureRoot = await createFixture(t, "L3");
  const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(l3Request));
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");

  const plan = JSON.parse(result.stdout);
  assert.deepEqual(plan.targets.map((target) => target.relative_path), [
    "work/tema-exemplo/lembranca.md",
    "work/tema-exemplo/conhecimento/INDEX.md",
    "work/tema-exemplo/conhecimento/journal-recuperavel/README.md"
  ]);
  assert.doesNotMatch(result.stdout, /memorias\/journal-recuperavel/);
  assert.match(decodeTarget(plan, "l1"), /\]\(conhecimento\/journal-recuperavel\/README\.md\) #tema-exemplo/);
  assert.match(decodeTarget(plan, "destination"), /layer: L3/);
  assert.match(decodeTarget(plan, "destination"), /owner_skill: dex-memoria/);
  assert.match(decodeTarget(plan, "destination"), /L1 relacionada: \[\.\.\/\.\.\/lembranca\.md\]\(\.\.\/\.\.\/lembranca\.md\)/);

  const { owner_skill: ignored, ...withoutOwner } = l3Request;
  assertCliError(
    await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(withoutOwner)),
    2,
    "INVALID_SCHEMA"
  );
});

test("V2 request is closed and freezes declared limits before GREEN", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const invalid = [
    { ...l2Request, path: "work/tema-exemplo" },
    { ...l2Request, idempotency_key: "x".repeat(257) },
    { ...l2Request, slug: "x".repeat(81) },
    { ...l2Request, trigger: "x".repeat(513) },
    { ...l2Request, trigger: "linha\nquebrada" },
    { ...l2Request, title: "x".repeat(257) },
    { ...l2Request, title: "titulo\rquebrado" },
    { ...l2Request, title: "titulo\u0000quebrado" },
    { ...l2Request, body: "x".repeat(65537) },
    { ...l2Request, target_layer: "L3" },
    { ...l2Request, route_decision: "explicit-l3-knowledge" }
  ];
  for (const request of invalid) {
    assertCliError(
      await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)),
      2,
      "INVALID_SCHEMA"
    );
  }
});

test("V2 plan rejects cross-layer casefold collisions and reserved or hostile slugs", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  await mkdir(join(fixtureRoot, "work", "tema-exemplo", "conhecimento", "Mapa-Visual-V2"));
  await writeFile(join(fixtureRoot, "work", "tema-exemplo", "conhecimento", "Mapa-Visual-V2", "README.md"), "collision\n");

  for (const slug of ["mapa-visual-v2", "con", "index", "../escape", "dois/caminhos", "Mapa-Visual-V2"] ) {
    const result = await runCli(
      ["create", "plan", "--fixture", fixtureRoot],
      JSON.stringify({ ...l2Request, slug })
    );
    assertCliError(result, slug === "mapa-visual-v2" ? 4 : 2, slug === "mapa-visual-v2" ? "PLAN_CONFLICT" : "INVALID_SCHEMA");
  }
});

test("V2 plan derives INDEX from valid destinations and rejects an existing identity", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const existingIdentity = "33333333-3333-4333-8333-333333333333";
  const existingPath = join(fixtureRoot, "work", "tema-exemplo", "memorias", "ancora-existente.md");
  await writeFile(existingPath, [
    "---",
    "dex_memory: governed-theme-v2",
    "contract_version: 1",
    `identity: ${existingIdentity}`,
    "layer: L2",
    "slug: ancora-existente",
    "created_at: 2026-07-12T12:00:00.000Z",
    "updated_at: 2026-07-12T12:00:00.000Z",
    "last_reused_at: null",
    "reuse_count: 0",
    "---",
    "",
    "# Âncora existente",
    "",
    "Memória já presente na fixture.",
    "",
    "L1 relacionada: [../lembranca.md](../lembranca.md)",
    ""
  ].join("\n"));

  const planResult = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(l2Request));
  assert.equal(planResult.exitCode, 0, planResult.stderr);
  const index = decodeTarget(JSON.parse(planResult.stdout), "index");
  assert.match(index, /\[Âncora existente\]\(ancora-existente\.md\)/);
  assert.match(index, /\[Mapa visual V2\]\(mapa-visual-v2\.md\)/);
  assert.ok(index.indexOf("ancora-existente.md") < index.indexOf("mapa-visual-v2.md"));

  const duplicateIdentity = await runCli(
    ["create", "plan", "--fixture", fixtureRoot],
    JSON.stringify({ ...l2Request, identity: existingIdentity, slug: "outro-slug" })
  );
  assertCliError(duplicateIdentity, 4, "PLAN_CONFLICT");
});

test("V2 fixture blocks a theme symlink or reparse point", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memoria-v2-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  await rm(join(fixtureRoot, "work", "tema-exemplo"), { recursive: true });
  try {
    await symlink(externalRoot, join(fixtureRoot, "work", "tema-exemplo"), "junction");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }
  assertCliError(
    await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(l2Request)),
    3,
    "SAFETY_BLOCKED"
  );
  assert.deepEqual(await readdir(externalRoot), []);
});

test("legacy apply and recover reject a V2 plan before journal or mutation", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const planResult = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(l2Request));
  assert.equal(planResult.exitCode, 0);
  const before = await snapshotTree(fixtureRoot);

  for (const command of ["apply", "recover"]) {
    const result = await runCli(["create", command, "--fixture", fixtureRoot], planResult.stdout);
    assertCliError(result, 2, "INVALID_SCHEMA");
    assert.deepEqual(await snapshotTree(fixtureRoot), before);
    await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
  }
});

test("V2 public layout and payload contracts are separate closed schemas", async () => {
  const expected = [
    ["contracts/layouts/governed-theme-v2.json", "dex.memory.layout.v1"],
    ["contracts/schemas/dex.memory.layout.v1.schema.json", "dex.memory.layout.v1"],
    ["contracts/schemas/dex.memory.create.theme-v2.request.v0.schema.json", "dex.memory.create.theme-v2.request.v0"],
    ["contracts/schemas/dex.memory.create.theme-v2.plan.v0.schema.json", "dex.memory.create.theme-v2.plan.v0"],
    ["contracts/schemas/dex.memory.fixture.governed-theme-v2-plan.v0.schema.json", "dex.memory.fixture.governed-theme-v2-plan.v0"]
  ];
  for (const [relativePath, contract] of expected) {
    const document = JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
    if (relativePath.includes("schemas/")) {
      assert.equal(document.title, contract);
      assert.equal(document.additionalProperties, false);
    } else {
      assert.equal(document.contract, contract);
      assert.equal(document.profile, "governed-theme-v2");
      assert.equal(document.status, "approved_not_active");
      assert.equal(document.artifact_role, "historical_fixture_contract");
      assert.equal(document.runtime_authority, false);
      assert.equal(document.superseded_by, "v2");
      assert.equal(document.active_write_profile, "legacy-v1");
    }
  }
});

test("public validators explicitly own every V2 contract file", async () => {
  const contractValidator = await readFile(join(repoRoot, "scripts", "validate-create-contracts.js"), "utf8");
  const publicValidator = await readFile(join(repoRoot, "scripts", "validate-public.js"), "utf8");
  for (const file of [
    "dex.memory.layout.v1.schema.json",
    "dex.memory.create.theme-v2.request.v0.schema.json",
    "dex.memory.create.theme-v2.plan.v0.schema.json",
    "dex.memory.fixture.governed-theme-v2-plan.v0.schema.json"
  ]) {
    assert.match(contractValidator, new RegExp(file.replaceAll(".", "\\.")));
    assert.match(publicValidator, new RegExp(file.replaceAll(".", "\\.")));
  }
  assert.match(publicValidator, /contracts\/layouts\/governed-theme-v2\.json/);
});

test("the public V2 plan document states the inactive and non-writing boundary", async () => {
  const document = await readFile(join(repoRoot, "docs", "cli-create-theme-v2-plan-v0.md"), "utf8");
  for (const statement of [
    "governed-theme-v2",
    "approved_not_active",
    "L1 -> L2 OU L1 -> L3",
    "create plan",
    "fixture-only",
    "serialization_order_only",
    "não implementa apply, journal ou recover V2",
    "não aceita o vault vivo"
  ]) {
    assert.match(document, new RegExp(statement.replaceAll(".", "\\."), "i"));
  }
  const publicValidator = await readFile(join(repoRoot, "scripts", "validate-public.js"), "utf8");
  assert.match(publicValidator, /docs\/cli-create-theme-v2-plan-v0\.md/);
});

test("the disposable marker schema accepts legacy targets or one governed V2 theme root", async () => {
  const schema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.disposable-run.v1.schema.json"),
    "utf8"
  ));
  assert.equal(schema.properties.targets.oneOf.length, 2);
  assert.deepEqual(schema.properties.targets.oneOf[0].prefixItems.map((entry) => entry.const), [
    "work/LEMBRANCA.md",
    "work/MEMORIA.md"
  ]);
  assert.equal(schema.properties.targets.oneOf[1].minItems, 1);
  assert.equal(schema.properties.targets.oneOf[1].maxItems, 1);
  assert.equal(schema.properties.targets.oneOf[1].items.pattern, "^work/[a-z0-9]+(?:-[a-z0-9]+)*$");
});

test("V2 request and fixture schemas reserve structural and Windows names", async () => {
  const requestSchema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.create.theme-v2.request.v0.schema.json"),
    "utf8"
  ));
  const fixtureSchema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.fixture.governed-theme-v2-plan.v0.schema.json"),
    "utf8"
  ));
  for (const schema of [requestSchema.properties.slug, fixtureSchema.properties.theme]) {
    assert.ok(schema.not.enum.includes("index"));
    assert.ok(schema.not.enum.includes("con"));
    assert.ok(schema.not.enum.includes("lembranca"));
  }
});
