import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { validateMemoryCapabilityRoot, validateMemoryCapabilityUnit } = require("../bin/memory-v2-capabilities.js");
const cliPath = resolve("bin", "dex-memoria.js");

function runCli(args, stdin = "") {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: resolve("."),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({
      exitCode,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    child.stdin.end(stdin);
  });
}

async function writeFixtureFile(root, relativePath, content) {
  const filePath = join(root, ...relativePath.split("/"));
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function createCapabilityRoot(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-capability-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    "lembranca.md": [
      "# Lembranca",
      "",
      "- [Memoria](memorias/topic.md#^memory-topic) [[memorias/topic#^memory-topic|Topic]] ^trigger-topic",
      ""
    ].join("\n"),
    "memorias/topic.md": [
      "# Memoria",
      "",
      "[L1](../lembranca.md#^trigger-topic) [[lembranca#^trigger-topic|Trigger]]",
      "[L3](../conhecimento/topic/README.md#^knowledge-topic) [[conhecimento/topic/README#^knowledge-topic|Knowledge]]",
      "^memory-topic",
      ""
    ].join("\n"),
    "conhecimento/topic/README.md": [
      "# Conhecimento",
      "",
      "[L2](../../memorias/topic.md#^memory-topic) [[memorias/topic#^memory-topic|Memory]]",
      "^knowledge-topic",
      ""
    ].join("\n"),
    ...overrides
  };
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFixtureFile(root, relativePath, content);
  }
  return root;
}

test("filesystem-owned validator derives V2 Markdown and Obsidian evidence with touched hashes", async (t) => {
  const root = await createCapabilityRoot(t);
  const markdown = await validateMemoryCapabilityRoot({
    root,
    capability: "v2-markdown",
    require_obsidian: false
  });
  assert.equal(markdown.ok, true, JSON.stringify(markdown.errors));
  assert.equal(markdown.evidence.files.length, 3);
  assert.deepEqual(markdown.touched_files, markdown.evidence.files);
  assert.ok(markdown.evidence.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.ok(markdown.evidence.markdown_links.length >= 4);
  assert.deepEqual(markdown.evidence.unresolved_markdown_links, []);

  const obsidian = await validateMemoryCapabilityRoot({
    root,
    capability: "v2-obsidian",
    require_obsidian: true,
    block_ids: [],
    markdown_links: [],
    wikilinks: [],
    backlinks: [],
    unresolved_markdown_links: ["caller supplied fiction"],
    unresolved_wikilinks: ["caller supplied fiction"]
  });
  assert.equal(obsidian.ok, true, JSON.stringify(obsidian.errors));
  assert.deepEqual(obsidian.evidence.backlinks, ["L1->L2", "L2->L1", "L2->L3", "L3->L2"]);
  assert.deepEqual(obsidian.evidence.block_ids.sort(), ["knowledge-topic", "memory-topic", "trigger-topic"]);
  assert.ok(obsidian.evidence.wikilinks.length >= 4);
  assert.deepEqual(obsidian.evidence.unresolved_wikilinks, []);
});

test("filesystem-owned validator accepts the direct bidirectional L1 to L3 route without an artificial L2", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-capability-direct-l3-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixtureFile(root, "lembranca.md", [
    "# Lembranca",
    "",
    "- [Knowledge](conhecimento/topic/README.md#^knowledge-topic) [[conhecimento/topic/README#^knowledge-topic|Knowledge]] ^trigger-topic",
    ""
  ].join("\n"));
  await writeFixtureFile(root, "conhecimento/topic/README.md", [
    "# Conhecimento",
    "",
    "[L1](../../lembranca.md#^trigger-topic) [[../../lembranca#^trigger-topic|Trigger]]",
    "^knowledge-topic",
    ""
  ].join("\n"));

  const receipt = await validateMemoryCapabilityRoot({
    root,
    capability: "v2-obsidian",
    require_obsidian: true
  });

  assert.equal(receipt.ok, true, JSON.stringify(receipt.errors));
  assert.deepEqual(receipt.evidence.required_backlinks, ["L1->L3", "L3->L1"]);
  assert.deepEqual(receipt.evidence.backlinks, ["L1->L3", "L3->L1"]);
  assert.deepEqual(receipt.touched_files.map((file) => file.path).sort(), [
    "conhecimento/topic/README.md",
    "lembranca.md"
  ]);
});

test("root-wide V2 validation ignores neighboring project and V1 Markdown surfaces", async (t) => {
  const root = await createCapabilityRoot(t, {
    "PROJECT.md": "# Project\n\n[Broken](missing.md) [[missing|Missing]]\n^memory-topic\n",
    "ACTIVE.md": "# Active\n\nHistorical V1 neighbor.\n^memory-topic\n",
    "conhecimento/topic/referencias/source.md": "# Reference\n\n[External fixture note](missing-local.md)\n^memory-topic\n"
  });
  const receipt = await validateMemoryCapabilityRoot({
    root,
    capability: "v2-obsidian",
    require_obsidian: true
  });

  assert.equal(receipt.ok, true, JSON.stringify(receipt.errors));
  assert.deepEqual(
    receipt.touched_files.map((file) => file.path).sort(),
    ["conhecimento/topic/README.md", "lembranca.md", "memorias/topic.md"]
  );
});

test("root-wide V2 validation ignores legacy V1 links inside mixed L1 and INDEX", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-capability-legacy-mixed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixtureFile(root, "lembranca.md", [
    "# Lembrancas",
    "",
    "- [Legado V1](MEMORIA.md#^legado-v1) [[MEMORIA#^legado-v1|Legado]] ^legado-v1",
    "- [Topic](memorias/topic.md#^memory-topic) [[memorias/topic#^memory-topic|Topic]] ^trigger-topic",
    ""
  ].join("\n"));
  await writeFixtureFile(root, "memorias/topic.md", [
    "# Memoria",
    "",
    "[L1](../lembranca.md#^trigger-topic) [[lembranca#^trigger-topic|Trigger]]",
    "[L3](../conhecimento/topic/README.md#^knowledge-topic) [[conhecimento/topic/README#^knowledge-topic|Knowledge]]",
    "^memory-topic",
    ""
  ].join("\n"));
  await writeFixtureFile(root, "conhecimento/topic/README.md", [
    "# Conhecimento",
    "",
    "[L2](../../memorias/topic.md#^memory-topic) [[memorias/topic#^memory-topic|Memory]]",
    "^knowledge-topic",
    ""
  ].join("\n"));
  await writeFixtureFile(root, "conhecimento/INDEX.md", [
    "# Indice",
    "",
    "[Legado flat](legado-flat.md)",
    "[Memoria V1](../MEMORIA.md#^legado-v1)",
    "[[temas/ppirtv/MEMORIA#^legado-v1]]",
    "[Topic](topic/README.md#^knowledge-topic) [[conhecimento/topic/README#^knowledge-topic|Topic]]",
    ""
  ].join("\n"));

  const receipt = await validateMemoryCapabilityRoot({
    root,
    capability: "v2-obsidian",
    require_obsidian: true
  });

  assert.equal(receipt.ok, true, JSON.stringify(receipt.errors));
  assert.deepEqual(receipt.evidence.unresolved_markdown_links, []);
  assert.deepEqual(receipt.evidence.unresolved_wikilinks, []);
});

test("filesystem-owned validator observes duplicate block ids", async (t) => {
  const root = await createCapabilityRoot(t, {
    "conhecimento/topic/README.md": "# Conhecimento\n\n[L2](../../memorias/topic.md#^memory-topic) [[memorias/topic#^memory-topic|Memory]]\n^memory-topic\n"
  });
  const receipt = await validateMemoryCapabilityRoot({
    root,
    capability: "v2-obsidian",
    require_obsidian: true,
    block_ids: ["caller-claims-valid"],
    markdown_links: ["caller claims valid"],
    wikilinks: ["caller claims valid"],
    backlinks: ["L1->L2", "L2->L1", "L2->L3", "L3->L2"],
    unresolved_markdown_links: [],
    unresolved_wikilinks: []
  });
  assert.equal(receipt.ok, false);
  assert.ok(receipt.errors.some((error) => error.code === "DUPLICATE_BLOCK_ID"));
});

test("CLI exposes independent root-wide V2 validation and reports cross-unit block-id collisions", async (t) => {
  const root = await createCapabilityRoot(t, {
    "conhecimento/topic/README.md": "# Conhecimento\n\n[L2](../../memorias/topic.md#^memory-topic) [[memorias/topic#^memory-topic|Memory]]\n^memory-topic\n"
  });
  const result = await runCli(["v2", "validate-root"], JSON.stringify({
    root,
    capability: "v2-obsidian",
    require_obsidian: true
  }));

  assert.equal(result.exitCode, 5);
  assert.equal(result.stderr, "");
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.ok, false);
  assert.ok(receipt.errors.some((error) => error.code === "DUPLICATE_BLOCK_ID"));
  assert.ok(receipt.touched_files.length >= 2);
});

test("validate-root request and receipt contracts are formalized and audited (F-04)", async () => {
  const { readFile } = await import("node:fs/promises");
  const schemaRoot = join(resolve("."), "contracts", "schemas");
  const requestSchema = JSON.parse(
    await readFile(join(schemaRoot, "dex.memory.validate-root.request.v2.schema.json"), "utf8")
  );
  assert.equal(requestSchema.additionalProperties, false);
  assert.deepEqual(
    [...requestSchema.required].sort(),
    ["capability", "require_obsidian", "root"].sort()
  );
  const receiptSchema = JSON.parse(
    await readFile(join(schemaRoot, "dex.memory.capability.receipt.v2.schema.json"), "utf8")
  );
  assert.equal(receiptSchema.properties.contract.const, "dex.memory.capability.receipt.v2");
  const { default: createContractValidator } = await import("../scripts/validate-create-contracts.js");
  const { SCHEMA_FILES } = createContractValidator;
  assert.ok(SCHEMA_FILES.includes("dex.memory.validate-root.request.v2.schema.json"));
  assert.ok(SCHEMA_FILES.includes("dex.memory.capability.receipt.v2.schema.json"));
});

test("filesystem-owned validator observes unresolved Markdown and wikilinks", async (t) => {
  const root = await createCapabilityRoot(t, {
    "memorias/topic.md": "# Memoria\n\n[L1](../lembranca.md#^trigger-topic) [[lembranca#^trigger-topic|Trigger]]\n[Missing](../conhecimento/missing/README.md) [[conhecimento/missing/README|Missing]]\n^memory-topic\n"
  });
  const receipt = await validateMemoryCapabilityRoot({ root, capability: "v2-obsidian", require_obsidian: true });
  assert.equal(receipt.ok, false);
  assert.ok(receipt.errors.some((error) => error.code === "UNRESOLVED_MARKDOWN_LINK"));
  assert.ok(receipt.errors.some((error) => error.code === "UNRESOLVED_WIKILINK"));
  assert.ok(receipt.evidence.unresolved_markdown_links.some((link) => link.includes("missing")));
  assert.ok(receipt.evidence.unresolved_wikilinks.some((link) => link.includes("missing")));
});

test("filesystem-owned validator observes a missing L3 to L2 backlink", async (t) => {
  const root = await createCapabilityRoot(t, {
    "conhecimento/topic/README.md": "# Conhecimento\n\nNo backlink is present.\n^knowledge-topic\n"
  });
  const receipt = await validateMemoryCapabilityRoot({ root, capability: "v2-obsidian", require_obsidian: true });
  assert.equal(receipt.ok, false);
  const missingBacklink = receipt.errors.find((error) => error.code === "MISSING_BACKLINK");
  assert.ok(missingBacklink);
  assert.match(missingBacklink.message, /L3->L2/);
});

test("write-unit validator requires one identical deterministic nested-tag set in L1 and destination", async (t) => {
  const validRoot = await mkdtemp(join(tmpdir(), "dex-memory-tags-order-independent-"));
  t.after(() => rm(validRoot, { recursive: true, force: true }));
  await writeFixtureFile(validRoot, "lembranca.md", "# Lembranças\n\n- [Topic](memorias/topic.md) [[memorias/topic|Topic]] #dex-memoria/runtime-v2 #engenharia/memoria-operacional ^topic\n");
  await writeFixtureFile(validRoot, "memorias/topic.md", "# Topic\n\n#engenharia/memoria-operacional #dex-memoria/runtime-v2\n\n[Voltar](../lembranca.md) [[lembranca|Lembranças]]\n\n^topic-content\n");
  const validReceipt = await validateMemoryCapabilityUnit({
    root: validRoot,
    capability: "v2-obsidian",
    require_obsidian: true,
    touched_paths: ["lembranca.md", "memorias/topic.md"]
  });
  assert.equal(validReceipt.ok, true, JSON.stringify(validReceipt.errors));

  const cases = [
    {
      name: "divergent",
      l1Tags: "#dex-memoria/runtime-v2 #engenharia/memoria-operacional",
      destinationTags: "#dex-memoria/runtime-v2 #engenharia/outro-contexto",
      expectedCode: "DIVERGENT_TAG_SET"
    },
    {
      name: "missing",
      l1Tags: "#dex-memoria/runtime-v2",
      destinationTags: "sem tag aninhada",
      expectedCode: "MISSING_NESTED_TAG"
    },
    {
      name: "invalid",
      l1Tags: "#dex-memoria/runtime-v2",
      destinationTags: "#dex-memoria/",
      expectedCode: "INVALID_TAG"
    }
  ];

  for (const fixtureCase of cases) {
    const root = await mkdtemp(join(tmpdir(), `dex-memory-tags-${fixtureCase.name}-`));
    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFixtureFile(root, "lembranca.md", `# Lembranças\n\n- [Topic](memorias/topic.md) [[memorias/topic|Topic]] ${fixtureCase.l1Tags} ^topic\n`);
    await writeFixtureFile(root, "memorias/topic.md", `# Topic\n\n${fixtureCase.destinationTags}\n\n[Voltar](../lembranca.md) [[lembranca|Lembranças]]\n\n^topic-content\n`);

    const receipt = await validateMemoryCapabilityUnit({
      root,
      capability: "v2-obsidian",
      require_obsidian: true,
      touched_paths: ["lembranca.md", "memorias/topic.md"]
    });
    assert.equal(receipt.ok, false, fixtureCase.name);
    assert.ok(receipt.errors.some((error) => error.code === fixtureCase.expectedCode), JSON.stringify(receipt.errors));
  }
});
