import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import * as fsPromises from "node:fs/promises";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { coordinateMemoryOperation, planMemoryOperation, resumePendingSibling } = require("../bin/memory-v2-runtime-core.js");
const { executeMemoryRoute: executeMemoryRouteRaw, recoverMemoryRoute } = require("../bin/memory-v2-route-executor.js");
const { validateMemoryCapabilityRoot } = require("../bin/memory-v2-capabilities.js");
const cliPath = join(process.cwd(), "bin", "dex-memoria.js");
const testEntrypointRealpath = await fsPromises.realpath(cliPath);
const testProducerProvenance = Object.freeze({
  entrypoint_realpath: testEntrypointRealpath,
  entrypoint_sha256: createHash("sha256").update(await readFile(testEntrypointRealpath)).digest("hex")
});

function executeMemoryRoute(route, candidate, options = {}) {
  const effectiveOptions = { ...options };
  if (!Object.hasOwn(effectiveOptions, "producer_provenance")) {
    effectiveOptions.producer_provenance = testProducerProvenance;
  }
  return executeMemoryRouteRaw(route, candidate, effectiveOptions);
}

function runCli(args, stdin) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
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
    child.stdin.end(JSON.stringify(stdin));
  });
}

function runCrashProbe(probePath) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [join(process.cwd(), "test", "support", "run-memory-v2-crash-probe.mjs"), probePath], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stderr = [];
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode, signal) => resolveRun({
      exitCode,
      signal,
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}

async function roots(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-v2-route-executor-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    workspace_root: join(root, "workspace"),
    memory_home: join(root, "memory-home")
  };
}

function planFor(testRoots, overrides = {}) {
  return planMemoryOperation(operationRequestFor(testRoots, overrides));
}

function operationRequestFor(testRoots, overrides = {}) {
  return {
    contract: "dex.memory.operation.request.v2",
    implementation_version: "v2",
    scope: "project",
    workspace_root: testRoots.workspace_root,
    memory_home: testRoots.memory_home,
    operation_id: "op-route-executor-001",
    ...overrides
  };
}

function l2Candidate(overrides = {}) {
  return {
    contract: "dex.memory.write.candidate.v2",
    target_layer: "L2",
    slug: "executor-real",
    trigger: "Quando o executor real for necessário",
    title: "Executor real",
    body: "Memória operacional gravada pelo executor canônico.",
    tags: ["#dex-memoria/executor-v2"],
    ...overrides
  };
}

async function leaveRecoverableDestination(testRoots, operationId) {
  const route = planFor(testRoots, { operation_id: operationId }).routes[0];
  const l1Path = join(route.resolved_root, "lembranca.md");
  const destinationPath = join(route.resolved_root, "memorias", "executor-real.md");
  let l1PublishFailed = false;
  let rollbackRemovalFailed = false;
  const testFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      if (!l1PublishFailed && destination === l1Path) {
        l1PublishFailed = true;
        const error = new Error("synthetic test transport failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    },
    async rm(target, options) {
      if (l1PublishFailed && !rollbackRemovalFailed && target === destinationPath) {
        rollbackRemovalFailed = true;
        const error = new Error("synthetic test rollback transport failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rm(target, options);
    }
  };
  const failed = await executeMemoryRoute(route, l2Candidate(), { file_system: testFileSystem });
  assert.equal(failed.code, "ROLLBACK_REQUIRED", JSON.stringify(failed));
  return { route, l1Path, destinationPath };
}

test("canonical route executor writes a real L1->L2 transaction and retries idempotently", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots).routes[0];
  const first = await executeMemoryRoute(route, l2Candidate());

  assert.equal(first.status, "COMMITTED");
  assert.equal(first.idempotency_key, route.idempotency_key);
  assert.equal(first.transaction_id, route.transaction_id);
  assert.equal(first.receipt_id, route.receipt_id);
  assert.ok(first.validation_receipt_path.endsWith("validation.json"));
  const validationBytes = await readFile(first.validation_receipt_path);
  assert.equal(JSON.parse(validationBytes.toString("utf8")).ok, true);
  assert.equal(first.validation_receipt_hash, createHash("sha256").update(validationBytes).digest("hex"));
  assert.match(await readFile(join(route.resolved_root, "lembranca.md"), "utf8"), /\[Executor real\]\(memorias\/executor-real\.md\)/);
  assert.match(await readFile(join(route.resolved_root, "memorias", "executor-real.md"), "utf8"), /layer: L2[\s\S]*Memória operacional/);
  assert.equal(JSON.parse(await readFile(first.receipt_path, "utf8")).status, "COMMITTED");

  const beforeRetryL1 = await readFile(join(route.resolved_root, "lembranca.md"), "utf8");
  const retry = await executeMemoryRoute(route, l2Candidate());
  assert.equal(retry.status, "COMMITTED");
  assert.equal(retry.receipt_path, first.receipt_path);
  assert.equal(await readFile(join(route.resolved_root, "lembranca.md"), "utf8"), beforeRetryL1);
  const obsidian = await validateMemoryCapabilityRoot({
    capability: "v2-obsidian",
    require_obsidian: true,
    root: route.resolved_root
  });
  assert.equal(obsidian.ok, true, JSON.stringify(obsidian.errors));
  assert.deepEqual(obsidian.evidence.required_backlinks, ["L1->L2", "L2->L1"]);
});

test("historical retry preserves receipt and journal bytes while receipt divergence fails closed", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-historical-receipt" }).routes[0];
  const committed = await executeMemoryRoute(route, l2Candidate({ slug: "historical-receipt" }));
  const journalPath = join(dirname(committed.receipt_path), "journal.json");
  const historicalReceipt = structuredClone(committed);
  delete historicalReceipt.receipt_revision;
  delete historicalReceipt.producer_provenance;
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.receipt = historicalReceipt;
  await writeFile(committed.receipt_path, `${JSON.stringify(historicalReceipt, null, 2)}\n`);
  await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

  const receiptBefore = await readFile(committed.receipt_path);
  const journalBefore = await readFile(journalPath);
  const receiptMtimeBefore = (await stat(committed.receipt_path)).mtimeMs;
  const journalMtimeBefore = (await stat(journalPath)).mtimeMs;
  const retry = await executeMemoryRouteRaw(route, l2Candidate({ slug: "historical-receipt" }));
  assert.equal(retry.status, "COMMITTED");
  assert.equal(retry.receipt_revision, undefined);
  assert.equal(retry.producer_provenance, undefined);
  assert.deepEqual(await readFile(committed.receipt_path), receiptBefore);
  assert.deepEqual(await readFile(journalPath), journalBefore);
  assert.equal((await stat(committed.receipt_path)).mtimeMs, receiptMtimeBefore);
  assert.equal((await stat(journalPath)).mtimeMs, journalMtimeBefore);

  const divergent = { ...historicalReceipt, write_set_hash: "divergent" };
  await writeFile(committed.receipt_path, `${JSON.stringify(divergent, null, 2)}\n`);
  const divergentBytes = await readFile(committed.receipt_path);
  const failed = await executeMemoryRouteRaw(route, l2Candidate({ slug: "historical-receipt" }));
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.code, "RECEIPT_JOURNAL_DIVERGENCE");
  assert.deepEqual(await readFile(committed.receipt_path), divergentBytes);
  assert.deepEqual(await readFile(journalPath), journalBefore);
});

test("equivalent candidate keeps stable identities across flows and never appends L1 twice", async (t) => {
  const testRoots = await roots(t);
  const firstRoute = planFor(testRoots, { operation_id: "op-equivalent-a" }).routes[0];
  const secondRoute = planFor(testRoots, { operation_id: "op-equivalent-b" }).routes[0];
  const candidate = l2Candidate({ slug: "identidade-estavel" });

  const first = await executeMemoryRoute(firstRoute, candidate);
  const beforeL1 = await readFile(join(firstRoute.resolved_root, "lembranca.md"), "utf8");
  const second = await executeMemoryRoute(secondRoute, candidate);
  const afterL1 = await readFile(secondRoute.resolved_root + "\\lembranca.md", "utf8");

  assert.equal(first.status, "COMMITTED");
  assert.equal(second.status, "COMMITTED");
  assert.equal(second.deduplicated, true);
  assert.equal(first.candidate_id, second.candidate_id);
  assert.equal(first.content_hash, second.content_hash);
  assert.equal(first.route_identity, second.route_identity);
  assert.equal(afterL1, beforeL1);
  assert.equal(afterL1.match(/\^identidade-estavel$/gm)?.length, 1);
});

test("dedupe finds A:X after intervening B:Y and does not append A twice", async (t) => {
  const testRoots = await roots(t);
  const candidateA = l2Candidate({ slug: "dedupe-a", title: "Candidato A", body: "Conteúdo X." });
  const candidateB = l2Candidate({ slug: "dedupe-b", title: "Candidato B", body: "Conteúdo Y." });
  const firstRoute = planFor(testRoots, { operation_id: "op-dedupe-a-first" }).routes[0];
  const first = await executeMemoryRoute(firstRoute, candidateA);
  const middle = await executeMemoryRoute(planFor(testRoots, { operation_id: "op-dedupe-b" }).routes[0], candidateB);
  const repeated = await executeMemoryRoute(firstRoute, candidateA);
  const l1 = await readFile(join(testRoots.workspace_root, ".agents", "lembranca.md"), "utf8");

  assert.equal(first.status, "COMMITTED");
  assert.equal(middle.status, "COMMITTED");
  assert.equal(repeated.status, "COMMITTED");
  assert.equal(repeated.deduplicated, true);
  assert.equal(l1.match(/\^dedupe-a$/gm)?.length, 1);
  assert.equal(l1.match(/\^dedupe-b$/gm)?.length, 1);
  assert.equal(repeated.validation_ok, true);
  assert.notEqual(repeated.write_set_hash, first.write_set_hash);
  const repeatedValidation = JSON.parse(await readFile(repeated.validation_receipt_path, "utf8"));
  assert.equal(repeatedValidation.ok, true, JSON.stringify(repeatedValidation.errors));
  assert.equal(
    repeatedValidation.touched_files.find((file) => file.path === "lembranca.md")?.sha256,
    createHash("sha256").update(l1).digest("hex")
  );
  assert.equal(JSON.parse(await readFile(repeated.receipt_path, "utf8")).write_set_hash, repeated.write_set_hash);
  const refreshedJournal = JSON.parse(await readFile(join(
    firstRoute.resolved_root,
    ".dex-memoria",
    "transactions",
    firstRoute.transaction_id,
    "journal.json"
  ), "utf8"));
  assert.equal(refreshedJournal.receipt.write_set_hash, repeated.write_set_hash);
  assert.equal(refreshedJournal.receipt.deduplicated, true);
});

test("material conflict is detected before changing either memory file", async (t) => {
  const testRoots = await roots(t);
  const firstRoute = planFor(testRoots, { operation_id: "op-conflict-a" }).routes[0];
  const secondRoute = planFor(testRoots, { operation_id: "op-conflict-b" }).routes[0];
  const original = l2Candidate({ slug: "conflito-material" });
  assert.equal((await executeMemoryRoute(firstRoute, original)).status, "COMMITTED");
  const l1Path = join(firstRoute.resolved_root, "lembranca.md");
  const destinationPath = join(firstRoute.resolved_root, "memorias", "conflito-material.md");
  const beforeL1 = await readFile(l1Path);
  const beforeDestination = await readFile(destinationPath);

  const conflict = await executeMemoryRoute(secondRoute, { ...original, body: "Conteúdo material diferente." });
  assert.equal(conflict.status, "FAILED");
  assert.equal(conflict.code, "ROUTE_CONFLICT");
  assert.deepEqual(await readFile(l1Path), beforeL1);
  assert.deepEqual(await readFile(destinationPath), beforeDestination);
});

test("L1 casing follows scope for new roots", async (t) => {
  const testRoots = await roots(t);
  const projectRoute = planFor(testRoots, { operation_id: "op-casing-project" }).routes[0];
  const globalRoute = planFor(testRoots, { scope: "global", operation_id: "op-casing-global" }).routes[0];
  assert.equal((await executeMemoryRoute(projectRoute, l2Candidate({ slug: "casing-project" }))).status, "COMMITTED");
  assert.equal((await executeMemoryRoute(globalRoute, l2Candidate({ slug: "casing-global" }))).status, "COMMITTED");
  assert.match(await readFile(join(projectRoute.resolved_root, "lembranca.md"), "utf8"), /casing-project/);
  assert.match(await readFile(join(globalRoute.resolved_root, "LEMBRANCA.md"), "utf8"), /casing-global/);

  const themeRoute = planFor(testRoots, { scope: "theme", theme: "arquitetura", operation_id: "op-casing-theme" }).routes[0];
  assert.equal((await executeMemoryRoute(themeRoute, l2Candidate({ slug: "casing-theme" }))).status, "COMMITTED");
  assert.ok((await readdir(themeRoute.resolved_root)).includes("LEMBRANCA.md"));
});

test("V2 reuses the exact historical V1 L1 casing for global and theme roots", async (t) => {
  const testRoots = await roots(t);

  for (const [scope, theme] of [["global", undefined], ["theme", "dex"]]) {
    const route = planFor(testRoots, {
      scope,
      ...(theme ? { theme } : {}),
      operation_id: `op-historical-l1-casing-${scope}`
    }).routes[0];
    await mkdir(route.resolved_root, { recursive: true });
    await writeFile(join(route.resolved_root, "lembranca.md"), "# Lembranças V1 históricas\n");

    const receipt = await executeMemoryRoute(route, l2Candidate({
      slug: `historical-casing-${scope}`,
      title: `Casing histórico ${scope}`
    }));

    assert.equal(receipt.status, "COMMITTED", JSON.stringify(receipt));
    assert.match(
      await readFile(join(route.resolved_root, "memorias", `historical-casing-${scope}.md`), "utf8"),
      /\[Voltar às lembranças\]\(\.\.\/lembranca\.md\)/
    );
    assert.deepEqual(
      (await readdir(route.resolved_root)).filter((name) => name.toLowerCase() === "lembranca.md"),
      ["lembranca.md"]
    );
  }
});

test("candidate requires nested lowercase tags and renders them in L1 and destination", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-tags" }).routes[0];
  const receipt = await executeMemoryRoute(route, l2Candidate({
    slug: "tags-validas",
    tags: ["#dex-memoria/runtime-v2", "#engenharia/memoria-operacional"]
  }));
  assert.equal(receipt.status, "COMMITTED");
  assert.match(await readFile(join(route.resolved_root, "lembranca.md"), "utf8"), /#dex-memoria\/runtime-v2 #engenharia\/memoria-operacional/);
  assert.match(await readFile(join(route.resolved_root, "memorias", "tags-validas.md"), "utf8"), /tags:\n  - "#dex-memoria\/runtime-v2"/);

  const invalidTagSets = [["#memoria"], ["#Dex/memoria"], ["#dex/Memoria"], ["#dex/memoria", "#dex/memoria"]];
  for (const [index, tags] of invalidTagSets.entries()) {
    const invalidRoute = planFor(testRoots, { operation_id: `op-tags-${index}` }).routes[0];
    const invalidReceipt = await executeMemoryRoute(invalidRoute, l2Candidate({ slug: `tags-invalidas-${index}`, tags }));
    assert.equal(invalidReceipt.status, "FAILED");
    assert.equal(invalidReceipt.code, "INVALID_CANDIDATE");
  }
});

test("L3 writes the explicit V2 direct L1->L3 exception without an artificial L2 sibling", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, {
    scope: "theme",
    theme: "arquitetura",
    operation_id: "op-route-executor-l3"
  }).routes[0];
  const candidate = {
    ...l2Candidate({
      target_layer: "L3",
      slug: "conhecimento-direto",
      title: "Conhecimento direto",
      body: "Conhecimento profundo sem L2 artificial."
    }),
    owner_skill: "dex-memoria"
  };

  const receipt = await executeMemoryRoute(route, candidate);
  assert.equal(receipt.status, "COMMITTED");
  assert.equal(route.resolved_root, join(testRoots.memory_home, "temas", "arquitetura"));
  assert.match(await readFile(join(route.resolved_root, "lembranca.md"), "utf8"), /conhecimento\/conhecimento-direto\/README\.md/);
  assert.match(await readFile(join(route.resolved_root, "conhecimento", "conhecimento-direto", "README.md"), "utf8"), /owner_skill: dex-memoria/);
  await assert.rejects(() => readFile(join(route.resolved_root, "memorias", "conhecimento-direto.md")), { code: "ENOENT" });
  const obsidian = await validateMemoryCapabilityRoot({
    capability: "v2-obsidian",
    require_obsidian: true,
    root: route.resolved_root
  });
  assert.equal(obsidian.ok, true, JSON.stringify(obsidian.errors));
  assert.deepEqual(obsidian.evidence.required_backlinks, ["L1->L3", "L3->L1"]);
});

test("route executor rejects a resolved-root junction before writing outside the canonical boundary", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-route-root-junction" }).routes[0];
  const outsideRoot = join(testRoots.root, "outside-root");
  await mkdir(testRoots.workspace_root, { recursive: true });
  await mkdir(outsideRoot, { recursive: true });
  try {
    await fsPromises.symlink(outsideRoot, route.resolved_root, "junction");
  } catch (error) {
    if (["EPERM", "ENOTSUP", "EINVAL"].includes(error.code)) {
      t.skip(`junctions unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  const receipt = await executeMemoryRoute(route, l2Candidate());
  assert.equal(receipt.status, "FAILED");
  assert.equal(receipt.code, "SAFETY_BOUNDARY");
  await assert.rejects(() => readFile(join(outsideRoot, "memorias", "executor-real.md")), { code: "ENOENT" });
});

test("route executor rejects final L1 and destination symlinks before snapshot or journal", async (t) => {
  for (const slot of ["l1", "destination"]) {
    const testRoots = await roots(t);
    const route = planFor(testRoots, { operation_id: `op-route-final-symlink-${slot}` }).routes[0];
    const outsidePath = join(testRoots.root, `outside-${slot}.md`);
    const l1Path = join(route.resolved_root, "lembranca.md");
    const destinationPath = join(route.resolved_root, "memorias", "executor-real.md");
    const linkedPath = slot === "l1" ? l1Path : destinationPath;
    await mkdir(join(route.resolved_root, "memorias"), { recursive: true });
    await writeFile(outsidePath, `outside-${slot}\n`);
    try {
      await fsPromises.symlink(outsidePath, linkedPath, "file");
    } catch (error) {
      if (["EPERM", "ENOTSUP", "EINVAL"].includes(error.code)) {
        t.skip(`file symlinks unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    const receipt = await executeMemoryRoute(route, l2Candidate());
    assert.equal(receipt.status, "FAILED");
    assert.equal(receipt.code, "SAFETY_BOUNDARY");
    assert.equal(await readFile(outsidePath, "utf8"), `outside-${slot}\n`);
    await assert.rejects(
      () => readFile(join(route.resolved_root, ".dex-memoria", "transactions", route.transaction_id, "journal.json")),
      { code: "ENOENT" }
    );
  }
});

test("route executor revalidates destination ancestors immediately before publish", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-route-publish-junction" }).routes[0];
  const outsideRoot = join(testRoots.root, "outside-publish");
  const destinationDirectory = join(route.resolved_root, "memorias");
  const sentinelPath = join(outsideRoot, "sentinel.txt");
  await mkdir(outsideRoot, { recursive: true });
  await writeFile(sentinelPath, "untouched\n");
  let swapped = false;
  const testFileSystem = {
    ...fsPromises,
    async writeFile(target, bytes, options) {
      const result = await fsPromises.writeFile(target, bytes, options);
      if (!swapped && target.endsWith(".destination.tmp")) {
        swapped = true;
        await fsPromises.rm(destinationDirectory, { recursive: true, force: true });
        await fsPromises.symlink(outsideRoot, destinationDirectory, "junction");
      }
      return result;
    }
  };

  const receipt = await executeMemoryRoute(route, l2Candidate(), { file_system: testFileSystem });
  assert.equal(receipt.status, "FAILED");
  assert.ok(["SAFETY_BOUNDARY", "ROLLBACK_REQUIRED"].includes(receipt.code), receipt.code);
  assert.equal(await readFile(sentinelPath, "utf8"), "untouched\n");
  await assert.rejects(() => readFile(join(outsideRoot, "executor-real.md")), { code: "ENOENT" });
});

test("L3 casing resolution never reads through an intermediate junction", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { scope: "theme", theme: "dex", operation_id: "op-l3-casing-junction" }).routes[0];
  const outsideRoot = join(testRoots.root, "outside-l3-casing");
  const candidate = { ...l2Candidate({ target_layer: "L3", slug: "linked-knowledge" }), owner_skill: "dex-memoria" };
  const junctionPath = join(route.resolved_root, "conhecimento", candidate.slug);
  await mkdir(join(route.resolved_root, "conhecimento"), { recursive: true });
  await mkdir(outsideRoot, { recursive: true });
  try {
    await fsPromises.symlink(outsideRoot, junctionPath, "junction");
  } catch (error) {
    if (["EPERM", "ENOTSUP", "EINVAL"].includes(error.code)) {
      t.skip(`junctions unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  let readThroughJunction = false;
  const observingFileSystem = {
    ...fsPromises,
    async readdir(target, ...args) {
      if (String(target).toLowerCase() === junctionPath.toLowerCase()) readThroughJunction = true;
      return fsPromises.readdir(target, ...args);
    }
  };

  const receipt = await executeMemoryRoute(route, candidate, { file_system: observingFileSystem });
  assert.equal(receipt.code, "SAFETY_BOUNDARY");
  assert.equal(readThroughJunction, false);
});

test("opposite-layer casing check never reads through a junction", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-opposite-layer-junction" }).routes[0];
  const outsideRoot = join(testRoots.root, "outside-opposite-layer");
  const junctionPath = join(route.resolved_root, "conhecimento", "executor-real");
  await mkdir(join(route.resolved_root, "conhecimento"), { recursive: true });
  await mkdir(outsideRoot, { recursive: true });
  try {
    await fsPromises.symlink(outsideRoot, junctionPath, "junction");
  } catch (error) {
    if (["EPERM", "ENOTSUP", "EINVAL"].includes(error.code)) {
      t.skip(`junctions unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  let readThroughJunction = false;
  const observingFileSystem = {
    ...fsPromises,
    async readdir(target, ...args) {
      if (String(target).toLowerCase() === junctionPath.toLowerCase()) readThroughJunction = true;
      return fsPromises.readdir(target, ...args);
    }
  };

  const receipt = await executeMemoryRoute(route, l2Candidate(), { file_system: observingFileSystem });
  assert.equal(receipt.code, "SAFETY_BOUNDARY");
  assert.equal(readThroughJunction, false);
});

test("JSON publication refuses a preexisting temporary symlink", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-json-temp-symlink" }).routes[0];
  const transactionRoot = join(route.resolved_root, ".dex-memoria", "transactions", route.transaction_id);
  const journalPath = join(transactionRoot, "journal.json");
  const temporaryPath = `${journalPath}.${route.transaction_id}.tmp`;
  const outsidePath = join(testRoots.root, "outside-json-temp.txt");
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(outsidePath, "outside-json-temp\n");
  try {
    await fsPromises.symlink(outsidePath, temporaryPath, "file");
  } catch (error) {
    if (["EPERM", "ENOTSUP", "EINVAL"].includes(error.code)) {
      t.skip(`file symlinks unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  const receipt = await executeMemoryRoute(route, l2Candidate());
  assert.equal(receipt.status, "FAILED");
  assert.equal(await readFile(outsidePath, "utf8"), "outside-json-temp\n");
  await assert.rejects(() => readFile(journalPath), { code: "ENOENT" });
});

test("rollback refuses an L1 symlink injected after publish failure", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-rollback-final-symlink" }).routes[0];
  const l1Path = join(route.resolved_root, "lembranca.md");
  const outsidePath = join(testRoots.root, "outside-rollback-l1.txt");
  await mkdir(route.resolved_root, { recursive: true });
  await writeFile(l1Path, "# baseline L1\n");
  await writeFile(outsidePath, "outside-rollback\n");
  let injected = false;
  const swappingFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      if (!injected && destination === l1Path) {
        injected = true;
        await fsPromises.rm(l1Path, { force: true });
        await fsPromises.symlink(outsidePath, l1Path, "file");
        const error = new Error("synthetic publish failure after L1 swap");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    }
  };

  const receipt = await executeMemoryRoute(route, l2Candidate(), { file_system: swappingFileSystem });
  assert.equal(receipt.code, "ROLLBACK_REQUIRED");
  assert.equal(await readFile(outsidePath, "utf8"), "outside-rollback\n");
});

test("failure after receipt publication leaves no committed orphan and converges to rollback", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-receipt-before-journal-crash" }).routes[0];
  const journalPath = join(route.resolved_root, ".dex-memoria", "transactions", route.transaction_id, "journal.json");
  const receiptPath = join(route.resolved_root, ".dex-memoria", "transactions", route.transaction_id, "receipt.json");
  const validationPath = join(route.resolved_root, ".dex-memoria", "transactions", route.transaction_id, "validation.json");
  const journalTemporary = `${journalPath}.${route.transaction_id}.tmp`;
  let receiptPublished = false;
  let finalJournalFailureInjected = false;
  const failingFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      if (destination === receiptPath) receiptPublished = true;
      if (destination === journalPath && receiptPublished && !finalJournalFailureInjected) {
        finalJournalFailureInjected = true;
        const error = new Error("synthetic final journal publication failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    }
  };

  const failed = await executeMemoryRoute(route, l2Candidate(), { file_system: failingFileSystem });
  assert.equal(failed.status, "FAILED");
  await assert.rejects(() => readFile(receiptPath), { code: "ENOENT" });
  await assert.rejects(() => readFile(validationPath), { code: "ENOENT" });
  await assert.rejects(() => readFile(journalTemporary), { code: "ENOENT" });
  const recovered = await recoverMemoryRoute(route);
  assert.ok(["ROLLED_BACK", "ALREADY_ROLLED_BACK"].includes(recovered.recovery_status), JSON.stringify(recovered));
  await assert.rejects(() => readFile(join(route.resolved_root, "lembranca.md")), { code: "ENOENT" });
  await assert.rejects(() => readFile(join(route.resolved_root, "memorias", "executor-real.md")), { code: "ENOENT" });
});

test("dual real writes become PARTIAL_PENDING and resume only the conflicted global sibling", async (t) => {
  const testRoots = await roots(t);
  const plan = planFor(testRoots, { scope: "dual", operation_id: "op-route-executor-dual" });
  const globalRoute = plan.routes.find((route) => route.scope === "global");
  const conflictPath = join(globalRoute.resolved_root, "memorias", "executor-real.md");
  await mkdir(join(globalRoute.resolved_root, "memorias"), { recursive: true });
  await writeFile(conflictPath, "existing conflict\n");

  const first = await coordinateMemoryOperation(plan, (route) => executeMemoryRoute(route, l2Candidate()));
  assert.equal(first.status, "PARTIAL_PENDING");
  assert.equal(first.route_receipts.project.status, "COMMITTED");
  assert.equal(first.route_receipts.global.status, "PENDING");
  await rm(conflictPath);

  const resumed = await resumePendingSibling(first, (route) => executeMemoryRoute(route, l2Candidate()));
  assert.equal(resumed.status, "COMMITTED");
  assert.notEqual(resumed.route_receipts.project.receipt_path, resumed.route_receipts.global.receipt_path);
  assert.notEqual(resumed.route_receipts.project.write_set_hash, "");
  assert.match(await readFile(join(globalRoute.resolved_root, "LEMBRANCA.md"), "utf8"), /executor-real/);
});

test("recover rolls back an interrupted physical route without a live failpoint", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-route-executor-recover" }).routes[0];
  let l1PublishFailed = false;
  let rollbackRemovalFailed = false;
  const testFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      if (!l1PublishFailed && destination === join(route.resolved_root, "lembranca.md")) {
        l1PublishFailed = true;
        const error = new Error("synthetic test transport failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    },
    async rm(target, options) {
      if (l1PublishFailed && !rollbackRemovalFailed && target.endsWith(join("memorias", "executor-real.md"))) {
        rollbackRemovalFailed = true;
        const error = new Error("synthetic test rollback transport failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rm(target, options);
    }
  };

  const failed = await executeMemoryRoute(route, l2Candidate(), { file_system: testFileSystem });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.code, "ROLLBACK_REQUIRED", JSON.stringify(failed));
  assert.equal(failed.recoverable, true);
  const staleLockPath = join(route.resolved_root, ".dex-memoria", "write.lock");
  await writeFile(staleLockPath, `${JSON.stringify({
    contract: "dex.memory.route-lock.v2",
    owner_token: "dead-owner",
    pid: 2147483647,
    operation_id: route.operation_id,
    transaction_id: route.transaction_id,
    idempotency_key: route.idempotency_key
  })}\n`);
  const retry = await executeMemoryRoute(route, l2Candidate());
  assert.equal(retry.code, "RECOVERY_REQUIRED");
  const recovered = await recoverMemoryRoute(route);
  assert.equal(recovered.recovery_status, "ROLLED_BACK");
  await assert.rejects(() => readFile(join(route.resolved_root, "memorias", "executor-real.md")), { code: "ENOENT" });
  await assert.rejects(() => readFile(join(route.resolved_root, "lembranca.md")), { code: "ENOENT" });
  await assert.rejects(
    () => readFile(join(route.resolved_root, `lembranca.md.${route.transaction_id}.l1.tmp`)),
    { code: "ENOENT" }
  );
});

test("recover refuses third-version drift without mutating either target", async (t) => {
  const testRoots = await roots(t);
  const { route, l1Path, destinationPath } = await leaveRecoverableDestination(testRoots, "op-recover-third-version");
  await writeFile(destinationPath, "third-version\n");

  const recovered = await recoverMemoryRoute(route);
  assert.equal(recovered.status, "FAILED");
  assert.equal(recovered.code, "RECOVERY_CONFLICT");
  assert.equal(await readFile(destinationPath, "utf8"), "third-version\n");
  await assert.rejects(() => readFile(l1Path), { code: "ENOENT" });
});

test("recover rejects journal paths redirected to a neighboring file", async (t) => {
  const testRoots = await roots(t);
  const { route } = await leaveRecoverableDestination(testRoots, "op-recover-journal-path-tamper");
  const journalPath = join(route.resolved_root, ".dex-memoria", "transactions", route.transaction_id, "journal.json");
  const neighborPath = join(route.resolved_root, "neighbor.txt");
  await writeFile(neighborPath, "neighbor-untouched\n");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.paths.destination = neighborPath;
  await writeFile(journalPath, `${JSON.stringify(journal)}\n`);

  const recovered = await recoverMemoryRoute(route);
  assert.equal(recovered.status, "FAILED");
  assert.equal(recovered.code, "JOURNAL_CONFLICT");
  assert.equal(await readFile(neighborPath, "utf8"), "neighbor-untouched\n");
});

test("recover shares the same root mutex and cannot mutate while apply owns it", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-route-recover-mutex" }).routes[0];
  let announceLock;
  let releaseLock;
  const lockWritten = new Promise((resolve) => { announceLock = resolve; });
  const continueApply = new Promise((resolve) => { releaseLock = resolve; });
  const holdingFileSystem = {
    ...fsPromises,
    async open(target, flags) {
      const handle = await fsPromises.open(target, flags);
      if (target.endsWith(join(".dex-memoria", "write.lock"))) {
        return {
          async writeFile(...args) {
            const result = await handle.writeFile(...args);
            announceLock();
            await continueApply;
            return result;
          },
          close: (...args) => handle.close(...args)
        };
      }
      return handle;
    }
  };

  const applying = executeMemoryRoute(route, l2Candidate(), { file_system: holdingFileSystem });
  await lockWritten;
  const recovering = await recoverMemoryRoute(route);
  releaseLock();
  const applyReceipt = await applying;
  assert.equal(recovering.status, "FAILED");
  assert.equal(recovering.code, "ROUTE_BUSY");
  assert.equal(applyReceipt.status, "COMMITTED");
});

test("a real child crash leaves a recoverable journal without permanent ROUTE_BUSY", async (t) => {
  const testRoots = await roots(t);
  const route = planFor(testRoots, { operation_id: "op-route-child-crash" }).routes[0];
  const candidate = l2Candidate({ slug: "child-crash", title: "Child crash" });
  const probePath = join(testRoots.root, "crash-probe.json");
  await writeFile(probePath, JSON.stringify({
    route,
    candidate,
    destination: join(route.resolved_root, "memorias", "child-crash.md")
  }));

  const crashed = await runCrashProbe(probePath);
  assert.notEqual(crashed.exitCode, 0, crashed.stderr);
  const retry = await executeMemoryRoute(route, candidate);
  assert.equal(retry.code, "RECOVERY_REQUIRED");
  assert.notEqual(retry.code, "ROUTE_BUSY");
  const recovered = await recoverMemoryRoute(route);
  assert.equal(recovered.recovery_status, "ROLLED_BACK");

  const nextRoute = planFor(testRoots, { operation_id: "op-route-after-child-crash" }).routes[0];
  assert.equal((await executeMemoryRoute(nextRoute, candidate)).status, "COMMITTED");
});

test("same-root concurrent writers cannot both commit from one stale L1 snapshot", async (t) => {
  const testRoots = await roots(t);
  const firstRoute = planFor(testRoots, { operation_id: "op-route-concurrency-a" }).routes[0];
  const secondRoute = planFor(testRoots, { operation_id: "op-route-concurrency-b" }).routes[0];
  const results = await Promise.all([
    executeMemoryRoute(firstRoute, l2Candidate({ slug: "concorrencia-a", title: "Concorrência A" })),
    executeMemoryRoute(secondRoute, l2Candidate({ slug: "concorrencia-b", title: "Concorrência B" }))
  ]);

  assert.equal(results.filter((result) => result.status === "COMMITTED").length, 1);
  assert.equal(results.find((result) => result.status === "FAILED")?.code, "ROUTE_BUSY");
  const pending = results[0].status === "FAILED"
    ? [firstRoute, l2Candidate({ slug: "concorrencia-a", title: "Concorrência A" })]
    : [secondRoute, l2Candidate({ slug: "concorrencia-b", title: "Concorrência B" })];
  assert.equal((await executeMemoryRoute(pending[0], pending[1])).status, "COMMITTED");
  const l1 = await readFile(join(firstRoute.resolved_root, "lembranca.md"), "utf8");
  assert.match(l1, /concorrencia-a/);
  assert.match(l1, /concorrencia-b/);
});

test("canonical executor has no SHADOW, fixture, governed-theme-v2 or laboratory authority gate", async () => {
  const source = await readFile(join("bin", "memory-v2-route-executor.js"), "utf8");
  for (const forbidden of [
    "dex.memory.resource-limits.v1.json",
    "LiveVaultDenyPath",
    "AuthorizedFixtureParent",
    "governed-theme-v2",
    "precutover",
    "laboratorio-memories",
    "fixture manifest"
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("CLI v2 apply, recover and validate expose the canonical executable surface", async (t) => {
  const testRoots = await roots(t);
  const plan = planFor(testRoots, { operation_id: "op-route-cli" });
  await mkdir(join(plan.routes[0].resolved_root, "historico-v1"), { recursive: true });
  await writeFile(
    join(plan.routes[0].resolved_root, "historico-v1", "MEMORIA.md"),
    "# V1 histórico\n\n[link antigo quebrado](ausente.md) ^cli-real\n"
  );
  await writeFile(join(plan.routes[0].resolved_root, "lembranca.md"), "# Lembranças\n\n- [V1 quebrado](historico-v1/ausente.md) ^cli-real-old\n");
  const applyResult = await runCli(["v2", "apply"], {
    contract: "dex.memory.apply.request.v2",
    request: operationRequestFor(testRoots, { operation_id: "op-route-cli" }),
    candidate: l2Candidate({ slug: "cli-real", title: "CLI real" })
  });
  assert.equal(applyResult.exitCode, 0, applyResult.stderr);
  const applyReceipt = JSON.parse(applyResult.stdout);
  assert.equal(applyReceipt.status, "COMMITTED");
  const routeReceipt = applyReceipt.route_receipts.project;
  const entrypointRealpath = await fsPromises.realpath(cliPath);
  const entrypointSha256 = createHash("sha256")
    .update(await readFile(entrypointRealpath))
    .digest("hex");
  assert.equal(routeReceipt.receipt_revision, 2);
  assert.deepEqual(routeReceipt.producer_provenance, {
    entrypoint_realpath: entrypointRealpath,
    entrypoint_sha256: entrypointSha256
  });
  assert.ok(routeReceipt.validation_receipt_path.endsWith("validation.json"));
  const physicalReceipt = JSON.parse(await readFile(routeReceipt.receipt_path, "utf8"));
  assert.equal(physicalReceipt.receipt_revision, 2);
  assert.deepEqual(physicalReceipt.producer_provenance, routeReceipt.producer_provenance);
  const unitValidation = JSON.parse(await readFile(routeReceipt.validation_receipt_path, "utf8"));
  assert.equal(unitValidation.ok, true, JSON.stringify(unitValidation.errors));
  assert.deepEqual(unitValidation.touched_files.map((file) => file.path).sort(), ["lembranca.md", "memorias/cli-real.md"]);

  const validateResult = await runCli(["v2", "validate"], {
    capability: "v2-markdown",
    require_obsidian: false,
    root: plan.routes[0].resolved_root,
    touched_paths: ["lembranca.md", "memorias/cli-real.md"]
  });
  assert.equal(validateResult.exitCode, 0, validateResult.stderr);
  const validationReceipt = JSON.parse(validateResult.stdout);
  assert.equal(validationReceipt.ok, true);
  assert.ok(validationReceipt.touched_files.some((file) => file.path === "lembranca.md"));
  assert.ok(validationReceipt.touched_files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));

  const rootOnlyValidation = await runCli(["v2", "validate"], {
    capability: "v2-markdown",
    require_obsidian: false,
    root: plan.routes[0].resolved_root
  });
  assert.equal(rootOnlyValidation.exitCode, 2);
  assert.equal(JSON.parse(rootOnlyValidation.stderr).code, "INVALID_SCHEMA");

  const recoverResult = await runCli(["v2", "recover"], {
    contract: "dex.memory.recover.request.v2",
    request: operationRequestFor(testRoots, { operation_id: "op-route-cli" }),
    scope: "project"
  });
  assert.equal(recoverResult.exitCode, 0, recoverResult.stderr);
  assert.equal(JSON.parse(recoverResult.stdout).recovery_status, "ALREADY_COMMITTED");

  const retryResult = await runCli(["v2", "apply"], {
    contract: "dex.memory.apply.request.v2",
    request: operationRequestFor(testRoots, { operation_id: "op-route-cli" }),
    candidate: l2Candidate({ slug: "cli-real", title: "CLI real" })
  });
  assert.equal(retryResult.exitCode, 0, retryResult.stderr);
  const retryReceipt = JSON.parse(retryResult.stdout).route_receipts.project;
  assert.equal(retryReceipt.deduplicated, true);
  assert.deepEqual(retryReceipt.producer_provenance, routeReceipt.producer_provenance);
});

test("CLI v2 resume executes only the pending real sibling", async (t) => {
  const testRoots = await roots(t);
  const plan = planFor(testRoots, { scope: "dual", operation_id: "op-route-cli-resume" });
  const globalRoute = plan.routes.find((route) => route.scope === "global");
  const conflictPath = join(globalRoute.resolved_root, "memorias", "executor-real.md");
  await mkdir(join(globalRoute.resolved_root, "memorias"), { recursive: true });
  await writeFile(conflictPath, "conflict\n");
  const applyResult = await runCli(["v2", "apply"], {
    contract: "dex.memory.apply.request.v2",
    request: operationRequestFor(testRoots, { scope: "dual", operation_id: "op-route-cli-resume" }),
    candidate: l2Candidate()
  });
  assert.equal(applyResult.exitCode, 5);
  const partial = JSON.parse(applyResult.stdout);
  assert.equal(partial.status, "PARTIAL_PENDING");
  await rm(conflictPath);

  const resumeResult = await runCli(["v2", "resume"], {
    contract: "dex.memory.resume.request.v2",
    request: operationRequestFor(testRoots, { scope: "dual", operation_id: "op-route-cli-resume" }),
    receipt: partial,
    candidate: l2Candidate()
  });
  assert.equal(resumeResult.exitCode, 0, resumeResult.stderr);
  const committed = JSON.parse(resumeResult.stdout);
  assert.equal(committed.status, "COMMITTED");
  assert.equal(committed.route_receipts.project.receipt_path, partial.route_receipts.project.receipt_path);
  assert.equal(committed.route_receipts.project.receipt_revision, 2);
  assert.equal(committed.route_receipts.global.receipt_revision, 2);
  assert.deepEqual(
    committed.route_receipts.global.producer_provenance,
    committed.route_receipts.project.producer_provenance
  );
});

test("apply, resume, recover and candidate schemas keep routing separate from write content", async () => {
  const schemaRoot = join("contracts", "schemas");
  const candidate = JSON.parse(await readFile(join(schemaRoot, "dex.memory.write.candidate.v2.schema.json"), "utf8"));
  const apply = JSON.parse(await readFile(join(schemaRoot, "dex.memory.apply.request.v2.schema.json"), "utf8"));
  const resume = JSON.parse(await readFile(join(schemaRoot, "dex.memory.resume.request.v2.schema.json"), "utf8"));
  const recover = JSON.parse(await readFile(join(schemaRoot, "dex.memory.recover.request.v2.schema.json"), "utf8"));
  assert.deepEqual(candidate.properties.target_layer.enum, ["L2", "L3"]);
  assert.ok(candidate.required.includes("tags"));
  assert.deepEqual(apply.required, ["contract", "request", "candidate"]);
  assert.deepEqual(resume.required, ["contract", "request", "receipt", "candidate"]);
  assert.deepEqual(recover.required, ["contract", "request", "scope"]);
  const operationRequest = JSON.parse(await readFile(join(schemaRoot, "dex.memory.operation.request.v2.schema.json"), "utf8"));
  assert.equal("candidate" in operationRequest.properties, false);
});

test("CLI resume and recover reject forged roots instead of trusting caller route metadata", async (t) => {
  const testRoots = await roots(t);
  const request = operationRequestFor(testRoots, { scope: "dual", operation_id: "op-route-forged" });
  const plan = planMemoryOperation(request);
  const globalRoute = plan.routes.find((route) => route.scope === "global");
  const conflictPath = join(globalRoute.resolved_root, "memorias", "executor-real.md");
  await mkdir(join(globalRoute.resolved_root, "memorias"), { recursive: true });
  await writeFile(conflictPath, "conflict\n");
  const partial = await coordinateMemoryOperation(plan, (route) => executeMemoryRoute(route, l2Candidate()));
  await rm(conflictPath);
  const forged = structuredClone(partial);
  const forgedRoot = join(testRoots.root, "forged-root");
  forged.routes[1].resolved_root = forgedRoot;
  forged.route_receipts.global.resolved_root = forgedRoot;

  const resumeResult = await runCli(["v2", "resume"], {
    contract: "dex.memory.resume.request.v2",
    request,
    receipt: forged,
    candidate: l2Candidate()
  });
  assert.equal(resumeResult.exitCode, 2);
  assert.equal(JSON.parse(resumeResult.stderr).code, "RECEIPT_PLAN_MISMATCH");

  const recoverResult = await runCli(["v2", "recover"], {
    contract: "dex.memory.recover.request.v2",
    request,
    scope: "global",
    route: { ...globalRoute, resolved_root: forgedRoot }
  });
  assert.equal(recoverResult.exitCode, 2);
  assert.equal(JSON.parse(recoverResult.stderr).code, "INVALID_SCHEMA");
  await assert.rejects(() => readFile(join(forgedRoot, "lembranca.md")), { code: "ENOENT" });
});
