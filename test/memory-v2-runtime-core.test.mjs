import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  coordinateMemoryOperation,
  planMemoryOperation,
  resolveMemoryRoutes,
  resumePendingSibling
} = require("../bin/memory-v2-runtime-core.js");
const {
  CAPABILITIES,
  validateMemoryCapability
} = require("../bin/memory-v2-capabilities.js");
const { planCreate, planThemeV2 } = require("../bin/create-plan.js");
const { applyCreate } = require("../bin/create-apply.js");
const { applyThemeV2 } = require("../bin/create-theme-v2-transaction.js");
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

async function portableRoots(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-v2-runtime-core-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    workspace_root: join(root, "workspace"),
    memory_home: join(root, "memory-home")
  };
}

function operationRequest(roots, overrides = {}) {
  return {
    contract: "dex.memory.operation.request.v2",
    implementation_version: "v2",
    scope: "dual",
    workspace_root: roots.workspace_root,
    memory_home: roots.memory_home,
    operation_id: "op-20260719-runtime-core-001",
    ...overrides
  };
}

test("project, global and theme resolve to their explicit literal roots", async (t) => {
  const roots = await portableRoots(t);

  assert.deepEqual(resolveMemoryRoutes(operationRequest(roots, { scope: "project" })), [{
    scope: "project",
    resolved_root: resolve(roots.workspace_root, ".agents")
  }]);
  assert.deepEqual(resolveMemoryRoutes(operationRequest(roots, { scope: "global" })), [{
    scope: "global",
    resolved_root: resolve(roots.memory_home, "global")
  }]);
  assert.deepEqual(resolveMemoryRoutes(operationRequest(roots, { scope: "theme", theme: "arquitetura" })), [{
    scope: "theme",
    theme: "arquitetura",
    resolved_root: resolve(roots.memory_home, "temas", "arquitetura")
  }]);
});

test("dual expands to project and global with common operation and independent transaction identities", async (t) => {
  const roots = await portableRoots(t);
  const plan = planMemoryOperation(operationRequest(roots));

  assert.equal(plan.contract, "dex.memory.operation.plan.v2");
  assert.equal(plan.implementation_version, "v2");
  assert.equal("profile" in plan, false);
  assert.equal("compatibility_profile" in plan, false);
  assert.equal(plan.requested_scope, "dual");
  assert.deepEqual(plan.routes.map((route) => route.scope), ["project", "global"]);
  assert.deepEqual(new Set(plan.routes.map((route) => route.operation_id)), new Set([plan.operation_id]));
  assert.equal(new Set(plan.routes.map((route) => route.idempotency_key)).size, 2);
  assert.equal(new Set(plan.routes.map((route) => route.transaction_id)).size, 2);
  assert.equal(new Set(plan.routes.map((route) => route.receipt_id)).size, 2);
  assert.notEqual(plan.routes[0].resolved_root, plan.routes[1].resolved_root);
});

test("PARTIAL_PENDING resumes only the pending sibling and rejects cross-scope credit", async (t) => {
  const roots = await portableRoots(t);
  const plan = planMemoryOperation(operationRequest(roots));
  const attempts = [];

  const first = await coordinateMemoryOperation(plan, async (route) => {
    attempts.push(route.scope);
    if (route.scope === "global") {
      return { status: "FAILED", code: "SYNTHETIC_GLOBAL_FAILURE" };
    }
    const receiptPath = join(roots.root, `${route.scope}-receipt.json`);
    await writeFile(receiptPath, JSON.stringify({ scope: route.scope }));
    return {
      status: "COMMITTED",
      transaction_id: route.transaction_id,
      idempotency_key: route.idempotency_key,
      receipt_id: route.receipt_id,
      receipt_path: receiptPath,
      write_set_hash: `${route.scope}-hash`,
      candidate_id: "a".repeat(64),
      content_hash: (route.scope === "project" ? "b" : "c").repeat(64),
      route_identity: (route.scope === "project" ? "d" : "e").repeat(64),
      validation_receipt_path: join(roots.root, `${route.scope}-validation.json`),
      validation_receipt_hash: `${route.scope}-validation-hash`,
      validation_contract: "dex.memory.capability.unit-receipt.v2",
      validation_ok: true
    };
  });

  assert.equal(first.status, "PARTIAL_PENDING");
  assert.deepEqual(attempts, ["project", "global"]);
  assert.equal(first.route_receipts.project.status, "COMMITTED");
  assert.equal(first.route_receipts.global.status, "PENDING");
  assert.equal(first.route_receipts.project.operation_id, first.operation_id);
  assert.equal(first.route_receipts.global.operation_id, first.operation_id);
  assert.notEqual(first.route_receipts.project.idempotency_key, first.route_receipts.global.idempotency_key);
  assert.notEqual(first.route_receipts.project.transaction_id, first.route_receipts.global.transaction_id);
  assert.notEqual(first.route_receipts.project.receipt_id, first.route_receipts.global.receipt_id);

  const resumedAttempts = [];
  const resumedProvenance = {
    entrypoint_realpath: resolve("bin", "dex-memoria.js"),
    entrypoint_sha256: "f".repeat(64)
  };
  const complete = await resumePendingSibling(first, async (route) => {
    resumedAttempts.push(route.scope);
    return {
      status: "COMMITTED",
      transaction_id: route.transaction_id,
      idempotency_key: route.idempotency_key,
      receipt_id: route.receipt_id,
      receipt_path: join(roots.root, `${route.scope}-receipt-retry.json`),
      write_set_hash: `${route.scope}-hash`,
      candidate_id: "a".repeat(64),
      content_hash: (route.scope === "project" ? "b" : "c").repeat(64),
      route_identity: (route.scope === "project" ? "d" : "e").repeat(64),
      validation_receipt_path: join(roots.root, `${route.scope}-validation-retry.json`),
      validation_receipt_hash: `${route.scope}-validation-hash`,
      validation_contract: "dex.memory.capability.unit-receipt.v2",
      validation_ok: true,
      receipt_revision: 2,
      producer_provenance: resumedProvenance
    };
  });

  assert.deepEqual(resumedAttempts, ["global"]);
  assert.equal(complete.status, "COMMITTED");
  assert.equal(complete.route_receipts.project.receipt_path, first.route_receipts.project.receipt_path);
  assert.equal(complete.route_receipts.project.receipt_revision, undefined);
  assert.equal(complete.route_receipts.global.status, "COMMITTED");
  assert.equal(complete.route_receipts.global.receipt_revision, 2);
  assert.deepEqual(complete.route_receipts.global.producer_provenance, resumedProvenance);

  const crossCredited = structuredClone(first);
  crossCredited.route_receipts.project.resolved_root = crossCredited.route_receipts.global.resolved_root;
  await assert.rejects(
    () => resumePendingSibling(crossCredited, async () => ({ status: "COMMITTED" })),
    (error) => error?.code === "CROSS_SCOPE_CREDIT"
  );

  const sharedReceiptPath = join(roots.root, "incorrectly-shared-receipt.json");
  await assert.rejects(
    () => coordinateMemoryOperation(plan, async (route) => ({
      status: "COMMITTED",
      transaction_id: route.transaction_id,
      idempotency_key: route.idempotency_key,
      receipt_id: route.receipt_id,
      receipt_path: sharedReceiptPath,
      write_set_hash: `${route.scope}-hash`,
      candidate_id: "a".repeat(64),
      content_hash: (route.scope === "project" ? "b" : "c").repeat(64),
      route_identity: (route.scope === "project" ? "d" : "e").repeat(64),
      validation_receipt_path: join(roots.root, `${route.scope}-validation-shared.json`),
      validation_receipt_hash: `${route.scope}-validation-hash`,
      validation_contract: "dex.memory.capability.unit-receipt.v2",
      validation_ok: true
    })),
    (error) => error?.code === "CROSS_SCOPE_CREDIT"
  );
});

test("implementation_version stays separate from profile, scope and resolved root", async (t) => {
  const roots = await portableRoots(t);
  const livePlan = planMemoryOperation(operationRequest(roots, { scope: "project" }));
  const legacyCompatibilityPlan = planMemoryOperation(operationRequest(roots, {
    scope: "project",
    profile: "legacy-v1"
  }));

  assert.equal(livePlan.implementation_version, "v2");
  assert.equal("profile" in livePlan, false);
  assert.equal("compatibility_profile" in livePlan, false);
  assert.equal(legacyCompatibilityPlan.compatibility_profile, "legacy-v1");
  assert.equal(livePlan.routes[0].resolved_root, legacyCompatibilityPlan.routes[0].resolved_root);
  assert.equal("implementation_version" in livePlan.routes[0], false);
  assert.equal("profile" in livePlan.routes[0], false);
  assert.throws(
    () => planMemoryOperation(operationRequest(roots, {
      scope: "project",
      profile: "governed-theme-v2",
      fixture_mode: true
    })),
    (error) => error?.code === "HISTORICAL_WRAPPER_ONLY"
  );
});

test("receipt revision 2 requires producer provenance while historical receipts stay readable", async (t) => {
  const roots = await portableRoots(t);
  const plan = planMemoryOperation(operationRequest(roots, { scope: "project", operation_id: "op-provenance-contract" }));
  const route = plan.routes[0];
  const legacy = await coordinateMemoryOperation(plan, async () => ({
    status: "COMMITTED",
    transaction_id: route.transaction_id,
    idempotency_key: route.idempotency_key,
    receipt_id: route.receipt_id,
    receipt_path: join(roots.root, "legacy-receipt.json"),
    write_set_hash: "legacy-hash",
    candidate_id: "a".repeat(64),
    content_hash: "b".repeat(64),
    route_identity: "c".repeat(64),
    validation_receipt_path: join(roots.root, "legacy-validation.json"),
    validation_receipt_hash: "legacy-validation-hash",
    validation_contract: "dex.memory.capability.unit-receipt.v2",
    validation_ok: true
  }));
  assert.equal(legacy.route_receipts.project.receipt_revision, undefined);
  assert.equal(legacy.route_receipts.project.producer_provenance, undefined);

  await assert.rejects(
    () => coordinateMemoryOperation(plan, async () => ({
      ...legacy.route_receipts.project,
      receipt_revision: 2
    })),
    (error) => error?.code === "INVALID_ROUTE_RECEIPT"
  );
  await assert.rejects(
    () => coordinateMemoryOperation(plan, async () => ({
      ...legacy.route_receipts.project,
      receipt_revision: 2,
      producer_provenance: {
        entrypoint_realpath: "relative/dex-memoria.js",
        entrypoint_sha256: "d".repeat(64)
      }
    })),
    (error) => error?.code === "INVALID_ROUTE_RECEIPT"
  );
  await assert.rejects(
    () => coordinateMemoryOperation(plan, async () => ({
      ...legacy.route_receipts.project,
      receipt_revision: 2,
      producer_provenance: {
        entrypoint_realpath: resolve("bin", "dex-memoria.js"),
        entrypoint_sha256: "not-a-sha256"
      }
    })),
    (error) => error?.code === "INVALID_ROUTE_RECEIPT"
  );
});

test("capability matrix separates Legacy Obsidian, V2 Markdown and V2 Obsidian with observable negatives", () => {
  assert.deepEqual(Object.keys(CAPABILITIES), ["legacy-obsidian", "v2-markdown", "v2-obsidian"]);

  assert.equal(validateMemoryCapability({
    capability: "legacy-obsidian",
    require_obsidian: true
  }).ok, true);
  assert.equal(validateMemoryCapability({
    capability: "legacy-obsidian",
    require_obsidian: false
  }).errors[0].code, "REQUIRE_OBSIDIAN_REQUIRED");

  assert.equal(validateMemoryCapability({
    capability: "v2-markdown",
    require_obsidian: false,
    markdown_links: ["memorias/exemplo.md"],
    unresolved_markdown_links: []
  }).ok, true);
  assert.equal(validateMemoryCapability({
    capability: "v2-markdown",
    require_obsidian: true,
    markdown_links: [],
    unresolved_markdown_links: []
  }).errors[0].code, "CAPABILITY_UNSUPPORTED");

  const obsidianDocument = {
    capability: "v2-obsidian",
    require_obsidian: true,
    block_ids: ["gatilho-exemplo", "memoria-exemplo"],
    markdown_links: ["memorias/exemplo.md"],
    wikilinks: ["[[memorias/exemplo|Exemplo]]"],
    backlinks: ["L1->L2", "L2->L1", "L2->L3", "L3->L2"],
    unresolved_markdown_links: [],
    unresolved_wikilinks: []
  };
  assert.equal(validateMemoryCapability(obsidianDocument).ok, true);
  const directL3Document = {
    ...obsidianDocument,
    block_ids: ["gatilho-exemplo", "conhecimento-exemplo"],
    markdown_links: ["conhecimento/exemplo/README.md"],
    wikilinks: ["[[conhecimento/exemplo/README|Exemplo]]"],
    backlinks: ["L1->L3", "L3->L1"]
  };
  assert.equal(validateMemoryCapability(directL3Document).ok, true);
  assert.equal(validateMemoryCapability({
    ...directL3Document,
    backlinks: ["L1->L3"]
  }).errors[0].code, "MISSING_BACKLINK");
  assert.equal(validateMemoryCapability({
    ...obsidianDocument,
    block_ids: ["duplicado", "duplicado"]
  }).errors[0].code, "DUPLICATE_BLOCK_ID");
  assert.equal(validateMemoryCapability({
    ...obsidianDocument,
    unresolved_wikilinks: ["[[ausente]]"]
  }).errors[0].code, "UNRESOLVED_WIKILINK");
  assert.equal(validateMemoryCapability({
    ...obsidianDocument,
    backlinks: ["L1->L2", "L2->L1"]
  }).ok, true);
  assert.equal(validateMemoryCapability({
    ...obsidianDocument,
    backlinks: ["L1->L2"]
  }).errors[0].code, "MISSING_BACKLINK");
});

test("CLI exposes V2 planning and capability validation without touching either resolved root", async (t) => {
  const roots = await portableRoots(t);
  const request = operationRequest(roots, { scope: "theme", theme: "arquitetura" });
  const planResult = await runCli(["v2", "plan"], JSON.stringify(request));
  assert.equal(planResult.exitCode, 0, planResult.stderr);
  assert.equal(planResult.stderr, "");
  const plan = JSON.parse(planResult.stdout);
  assert.equal(plan.contract, "dex.memory.operation.plan.v2");
  assert.equal(plan.routes[0].resolved_root, resolve(roots.memory_home, "temas", "arquitetura"));

  const capabilityResult = await runCli(["v2", "capability"], JSON.stringify({
    capability: "v2-markdown",
    require_obsidian: true,
    markdown_links: [],
    unresolved_markdown_links: []
  }));
  assert.equal(capabilityResult.exitCode, 5);
  const capabilityReceipt = JSON.parse(capabilityResult.stdout);
  assert.equal(capabilityReceipt.ok, false);
  assert.equal(capabilityReceipt.errors[0].code, "CAPABILITY_UNSUPPORTED");

  const bypassResult = await runCli(["v2", "capability"], JSON.stringify({
    capability: "v2-obsidian",
    require_obsidian: true,
    block_ids: ["gatilho-exemplo", "conhecimento-exemplo"],
    markdown_links: ["conhecimento/exemplo/README.md"],
    wikilinks: ["[[conhecimento/exemplo/README|Exemplo]]"],
    backlinks: ["L1->L3"],
    unresolved_markdown_links: [],
    unresolved_wikilinks: [],
    required_backlinks: []
  }));
  assert.equal(bypassResult.exitCode, 2);
  assert.equal(JSON.parse(bypassResult.stderr).code, "INVALID_SCHEMA");
});

test("public V2 operation and capability schemas keep implementation, scope, root and receipts distinct", async () => {
  const schemaRoot = resolve("contracts", "schemas");
  const request = JSON.parse(await readFile(join(schemaRoot, "dex.memory.operation.request.v2.schema.json"), "utf8"));
  const plan = JSON.parse(await readFile(join(schemaRoot, "dex.memory.operation.plan.v2.schema.json"), "utf8"));
  const receipt = JSON.parse(await readFile(join(schemaRoot, "dex.memory.operation.receipt.v2.schema.json"), "utf8"));
  const capability = JSON.parse(await readFile(join(schemaRoot, "dex.memory.capability.v2.schema.json"), "utf8"));

  assert.deepEqual(request.properties.implementation_version, { const: "v2" });
  assert.equal(request.required.includes("profile"), false);
  assert.deepEqual(request.properties.profile.enum, ["legacy-v1"]);
  assert.deepEqual(request.properties.scope.enum, ["project", "global", "theme", "dual"]);
  assert.equal(plan.required.includes("profile"), false);
  assert.equal(plan.properties.routes.items.properties.resolved_root.type, "string");
  assert.deepEqual(receipt.properties.status.enum, ["COMMITTED", "PARTIAL_PENDING", "FAILED"]);
  const routeReceipt = receipt.properties.route_receipts.additionalProperties;
  assert.equal(routeReceipt.additionalProperties, false);
  assert.ok(routeReceipt.properties.receipt_revision);
  assert.ok(routeReceipt.properties.producer_provenance);
  const committedRule = routeReceipt.allOf
    .find((branch) => branch.if?.properties?.status?.const === "COMMITTED")
    .then;
  const revisionTwo = committedRule.oneOf.find((branch) => branch.required?.includes("receipt_revision"));
  assert.deepEqual(revisionTwo.required, ["receipt_revision", "producer_provenance"]);
  const pendingRule = routeReceipt.allOf.find((branch) => branch.if?.properties?.status?.const === "PENDING");
  assert.ok(pendingRule.then.not.anyOf.some((branch) => branch.required.includes("producer_provenance")));
  assert.deepEqual(capability.properties.capability.enum, ["legacy-obsidian", "v2-markdown", "v2-obsidian"]);
});

test("historical governed-theme-v2 wrappers and legacy V1 entrypoints remain exported", async (t) => {
  assert.equal(typeof planCreate, "function");
  assert.equal(typeof applyCreate, "function");
  assert.equal(typeof planThemeV2, "function");
  assert.equal(typeof applyThemeV2, "function");

  const roots = await portableRoots(t);
  const fixtureSource = join(resolve("test"), "fixtures", "governed-theme-v2-plan-l2");
  const fixtureCopy = join(roots.root, "governed-theme-v2-wrapper");
  await cp(fixtureSource, fixtureCopy, { recursive: true });
  const manifest = JSON.parse(await readFile(join(fixtureCopy, "manifest.json"), "utf8"));
  assert.equal(manifest.profile, "governed-theme-v2");
  assert.equal(manifest.contract, "dex.memory.fixture.governed-theme-v2-plan.v0");
});
