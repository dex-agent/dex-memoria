import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");

const l2Route = {
  identity: "11111111-1111-4111-8111-111111111111",
  layer: "L2",
  slug: "memoria-operacional",
  trigger: "Quando a operação precisar de contexto curto?",
  title: "Memória operacional",
  body: "Contexto curto e acionável.",
  updated_at: "2026-07-14T12:00:00.000Z",
  last_reused_at: null,
  reuse_count: 0
};

const l3Route = {
  identity: "22222222-2222-4222-8222-222222222222",
  layer: "L3",
  slug: "conhecimento-profundo",
  trigger: "Quando o assunto exigir referências e artefatos?",
  title: "Conhecimento profundo",
  body: "Modelo profundo com referências e artefatos.",
  updated_at: "2026-07-14T12:30:00.000Z",
  last_reused_at: null,
  reuse_count: 0,
  owner_skill: "dex-memoria"
};

const newL2Request = {
  contract: "dex.memory.create.theme-v2.request.v0",
  profile: "governed-theme-v2",
  operation: "create",
  idempotency_key: "fixture:routes-inspect:no-shrink:001",
  identity: "33333333-3333-4333-8333-333333333333",
  target_layer: "L2",
  route_decision: "explicit-l2-memory",
  slug: "nova-memoria",
  trigger: "Quando a nova memória for necessária?",
  title: "Nova memória",
  body: "Nova memória operacional.",
  created_at: "2026-07-14T13:00:00.000Z"
};

function runCli(args, stdin = "") {
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

async function createFixture(t, routes = [l2Route, l3Route], theme = "tema-exemplo") {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "dex-memoria-routes-v2-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const themeRoot = join(fixtureRoot, "work", theme);
  await mkdir(join(themeRoot, "memorias"), { recursive: true });
  await mkdir(join(themeRoot, "conhecimento"), { recursive: true });
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: [`work/${theme}`]
  }, null, 2)}\n`);
  await writeFile(join(fixtureRoot, "manifest.json"), `${JSON.stringify({
    contract: "dex.memory.fixture.governed-theme-v2-transaction.v0",
    disposable_runs_only: true,
    operation: "create",
    profile: "governed-theme-v2",
    target_layer: "L2",
    theme
  }, null, 2)}\n`);
  await renderFixture(themeRoot, routes);
  return { fixtureRoot, themeRoot };
}

async function renderFixture(themeRoot, routes) {
  const ordered = [...routes].sort(compareRoutes);
  const l1Lines = ordered.map((route) => {
    const destination = route.layer === "L2"
      ? `memorias/${route.slug}.md`
      : `conhecimento/${route.slug}/README.md`;
    return `- [${route.trigger}](${destination}) #tema-exemplo <!-- dex.memory.route.v1 ${stableJson({
      identity: route.identity,
      layer: route.layer,
      slug: route.slug,
      updated_at: route.updated_at,
      last_reused_at: route.last_reused_at,
      reuse_count: route.reuse_count
    })} -->`;
  });
  await writeFile(join(themeRoot, "lembranca.md"), `# Lembranças\n${l1Lines.length ? `\n${l1Lines.join("\n")}\n` : ""}`);

  for (const layer of ["L2", "L3"]) {
    const entries = ordered.filter((route) => route.layer === layer);
    const header = layer === "L2" ? "# Memórias" : "# Conhecimento";
    const lines = entries.map((route) => {
      const link = layer === "L2" ? `${route.slug}.md` : `${route.slug}/README.md`;
      return `- [${route.title}](${link}) <!-- dex.memory.index-entry.v1 ${stableJson({
        identity: route.identity,
        layer: route.layer,
        slug: route.slug
      })} -->`;
    });
    const directory = join(themeRoot, layer === "L2" ? "memorias" : "conhecimento");
    await writeFile(join(directory, "INDEX.md"), `${header}\n${lines.length ? `\n${lines.join("\n")}\n` : ""}`);
  }

  for (const route of ordered) {
    const destination = route.layer === "L2"
      ? join(themeRoot, "memorias", `${route.slug}.md`)
      : join(themeRoot, "conhecimento", route.slug, "README.md");
    await mkdir(dirname(destination), { recursive: true });
    const metadata = [
      "---",
      "dex_memory: governed-theme-v2",
      "contract_version: 1",
      `identity: ${route.identity}`,
      `layer: ${route.layer}`,
      `slug: ${route.slug}`,
      `created_at: ${route.updated_at}`,
      `updated_at: ${route.updated_at}`,
      `last_reused_at: ${route.last_reused_at === null ? "null" : route.last_reused_at}`,
      `reuse_count: ${route.reuse_count}`
    ];
    if (route.owner_skill) metadata.push(`owner_skill: ${route.owner_skill}`);
    metadata.push("---");
    const backlink = route.layer === "L2" ? "../lembranca.md" : "../../lembranca.md";
    await writeFile(destination, `${metadata.join("\n")}\n\n# ${route.title}\n\n${route.body}\n\nL1 relacionada: [${backlink}](${backlink})\n`);
  }
}

async function snapshotTree(root) {
  const rows = [];
  async function visit(relative = "") {
    const directory = relative ? join(root, ...relative.split("/")) : root;
    for (const name of (await readdir(directory)).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name;
      const childPath = join(root, ...childRelative.split("/"));
      const stat = await lstat(childPath);
      if (stat.isDirectory()) {
        rows.push(`d:${childRelative}`);
        await visit(childRelative);
      } else {
        rows.push(`f:${childRelative}:${sha256(await readFile(childPath))}`);
      }
    }
  }
  await visit();
  return rows;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function compareRoutes(first, second) {
  return `${first.layer}\0${first.slug}\0${first.identity}`.localeCompare(`${second.layer}\0${second.slug}\0${second.identity}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectedRoute(route, destinationBytes, theme = "tema-exemplo") {
  const result = {
    identity: route.identity,
    layer: route.layer,
    slug: route.slug,
    title: route.title,
    trigger: route.trigger,
    destination_relative_path: route.layer === "L2"
      ? `work/${theme}/memorias/${route.slug}.md`
      : `work/${theme}/conhecimento/${route.slug}/README.md`,
    index_relative_path: route.layer === "L2"
      ? `work/${theme}/memorias/INDEX.md`
      : `work/${theme}/conhecimento/INDEX.md`,
    content_sha256: sha256(destinationBytes),
    updated_at: route.updated_at,
    last_reused_at: route.last_reused_at,
    reuse_count: route.reuse_count
  };
  if (route.owner_skill) result.owner_skill = route.owner_skill;
  return result;
}

function assertCliError(result, exitCode, code) {
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^\{.*\}\n$/);
  const error = JSON.parse(result.stderr);
  assert.equal(error.contract, "dex.memory.error.v0");
  assert.equal(error.code, code);
}

test("routes inspect emits a deterministic independent shadow for mixed L2 and direct L3", async (t) => {
  const theme = "tema-alternativo";
  const { fixtureRoot, themeRoot } = await createFixture(t, [l2Route, l3Route], theme);
  const before = await snapshotTree(fixtureRoot);
  const first = await runCli(["routes", "inspect", "--fixture", fixtureRoot]);
  const second = await runCli(["routes", "inspect", `--fixture=${fixtureRoot}`]);
  assert.equal(first.exitCode, 0, first.stderr);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assert.deepEqual(await snapshotTree(fixtureRoot), before);

  const l2Bytes = await readFile(join(themeRoot, "memorias", `${l2Route.slug}.md`));
  const l3Bytes = await readFile(join(themeRoot, "conhecimento", l3Route.slug, "README.md"));
  assert.deepEqual(JSON.parse(first.stdout), {
    contract: "dex.memory.routes.inspect.v0",
    profile: "governed-theme-v2",
    status: "VALID",
    theme,
    routes: [expectedRoute(l2Route, l2Bytes, theme), expectedRoute(l3Route, l3Bytes, theme)],
    counts: { routes: 2, l1_routes: 2, index_entries: 2, destinations: 2, l2: 1, l3: 1 }
  });
  assert.doesNotMatch(first.stdout, /dex-memoria-routes-v2-|Contexto curto|Modelo profundo/);
});

test("routes inspect accepts preserved untagged fixtures and rejects non-canonical visible tags", async (t) => {
  const untagged = await createFixture(t, [l2Route]);
  const untaggedPath = join(untagged.themeRoot, "lembranca.md");
  await writeFile(
    untaggedPath,
    (await readFile(untaggedPath, "utf8")).replace(" #tema-exemplo <!--", " <!--")
  );
  const compatible = await runCli(["routes", "inspect", "--fixture", untagged.fixtureRoot]);
  assert.equal(compatible.exitCode, 0, compatible.stderr);
  assert.equal(JSON.parse(compatible.stdout).status, "VALID");

  const invalidTag = await createFixture(t, [l2Route]);
  const invalidTagPath = join(invalidTag.themeRoot, "lembranca.md");
  await writeFile(
    invalidTagPath,
    (await readFile(invalidTagPath, "utf8")).replace("#tema-exemplo", "#Tema_Exemplo")
  );
  assertCliError(
    await runCli(["routes", "inspect", "--fixture", invalidTag.fixtureRoot]),
    4,
    "ROUTE_INVALID"
  );
});

test("routes inspect proves no-shrink after a fixture-only create", async (t) => {
  const { fixtureRoot } = await createFixture(t, [l3Route]);
  const beforeResult = await runCli(["routes", "inspect", "--fixture", fixtureRoot]);
  assert.equal(beforeResult.exitCode, 0, beforeResult.stderr);
  const before = JSON.parse(beforeResult.stdout);

  const planResult = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(newL2Request));
  assert.equal(planResult.exitCode, 0, planResult.stderr);
  const applyResult = await runCli(["create", "apply", "--fixture", fixtureRoot], planResult.stdout);
  assert.equal(applyResult.exitCode, 0, applyResult.stderr);

  const afterResult = await runCli(["routes", "inspect", "--fixture", fixtureRoot]);
  assert.equal(afterResult.exitCode, 0, afterResult.stderr);
  const after = JSON.parse(afterResult.stdout);
  const beforeByIdentity = new Map(before.routes.map((route) => [route.identity, route]));
  const afterByIdentity = new Map(after.routes.map((route) => [route.identity, route]));
  assert.equal(after.routes.length, before.routes.length + 1);
  for (const [identity, route] of beforeByIdentity) assert.deepEqual(afterByIdentity.get(identity), route);
  assert.deepEqual([...afterByIdentity.keys()].filter((identity) => !beforeByIdentity.has(identity)), [newL2Request.identity]);
});

test("routes inspect fails closed for orphaned or divergent route components", async (t) => {
  const cases = [
    ["l1 orphan", async ({ themeRoot }) => writeFile(join(themeRoot, "memorias", "INDEX.md"), "# Memórias\n")],
    ["index orphan", async ({ themeRoot }) => writeFile(join(themeRoot, "lembranca.md"), "# Lembranças\n")],
    ["destination orphan", async ({ themeRoot }) => rm(join(themeRoot, "memorias", `${l2Route.slug}.md`))],
    ["identity drift", async ({ themeRoot }) => {
      const filePath = join(themeRoot, "memorias", `${l2Route.slug}.md`);
      const text = await readFile(filePath, "utf8");
      await writeFile(filePath, text.replace(l2Route.identity, "99999999-9999-4999-8999-999999999999"));
    }],
    ["casefold collision", async ({ themeRoot }) => {
      const collision = { ...l3Route, identity: "44444444-4444-4444-8444-444444444444", slug: l2Route.slug.toUpperCase() };
      await renderFixture(themeRoot, [l2Route, collision]);
    }],
    ["bad backlink", async ({ themeRoot }) => {
      const filePath = join(themeRoot, "memorias", `${l2Route.slug}.md`);
      const text = await readFile(filePath, "utf8");
      await writeFile(filePath, text.replace("../lembranca.md", "../../lembranca.md"));
    }],
    ["missing owner", async ({ themeRoot }) => {
      const filePath = join(themeRoot, "conhecimento", l3Route.slug, "README.md");
      const text = await readFile(filePath, "utf8");
      await writeFile(filePath, text.replace(`owner_skill: ${l3Route.owner_skill}\n`, ""));
    }],
    ["invalid UTF-8", async ({ themeRoot }) => {
      const filePath = join(themeRoot, "memorias", `${l2Route.slug}.md`);
      await writeFile(filePath, Buffer.concat([await readFile(filePath), Buffer.from([0xff])]));
    }]
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, async (subtest) => {
      const fixture = await createFixture(subtest);
      await mutate(fixture);
      assertCliError(await runCli(["routes", "inspect", "--fixture", fixture.fixtureRoot]), 4, "ROUTE_INVALID");
    });
  }
});

test("routes inspect refuses legacy fixtures and unexpected stdin", async (t) => {
  const { fixtureRoot } = await createFixture(t);
  assertCliError(await runCli(["routes", "inspect", "--fixture", fixtureRoot], "{}"), 2, "INVALID_USAGE");

  const legacyRoot = await mkdtemp(join(tmpdir(), "dex-memoria-routes-legacy-"));
  t.after(() => rm(legacyRoot, { recursive: true, force: true }));
  await mkdir(join(legacyRoot, "work"), { recursive: true });
  await writeFile(join(legacyRoot, "work", "LEMBRANCA.md"), "");
  await writeFile(join(legacyRoot, "work", "MEMORIA.md"), "");
  const targets = ["work/LEMBRANCA.md", "work/MEMORIA.md"];
  await writeFile(join(legacyRoot, ".dex-memory-fixture.json"), `${JSON.stringify({ contract: "dex.memory.disposable-run.v1", operation: "create", disposable: true, targets })}\n`);
  await writeFile(join(legacyRoot, "manifest.json"), `${JSON.stringify({ contract: "dex.memory.fixture.legacy-create-l1-l2.v1", operation: "create", disposable_runs_only: true, targets })}\n`);
  assertCliError(await runCli(["routes", "inspect", "--fixture", legacyRoot]), 2, "INVALID_PROFILE");
});

test("help advertises the fixture-only routes inspector", async () => {
  const result = await runCli(["help"]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /dex-memoria routes inspect --fixture <fixture-root>/);
});
