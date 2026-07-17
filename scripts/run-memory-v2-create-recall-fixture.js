#!/usr/bin/env node
"use strict";

const { fork, spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "bin", "dex-memoria.js");
const V1_CORPUS_PATH = path.join(REPO_ROOT, "contracts", "fixtures", "precutover-v1-recall-corpus.v0.json");
const CONTRACT = "dex.memory.create-recall.fixture-receipt.v0";
const REQUIRED_ARGS = [
  "--commit-fixture-l2",
  "--recovery-fixture-l2",
  "--request-l2",
  "--commit-fixture-l3",
  "--recovery-fixture-l3",
  "--request-l3",
  "--link-validator",
  "--finder",
  "--baseline-finder",
  "--legacy-fixture-root",
  "--laboratory-root",
  "--live-vault-path"
];
const FIXTURE_ARGS = [
  "--commit-fixture-l2",
  "--recovery-fixture-l2",
  "--commit-fixture-l3",
  "--recovery-fixture-l3"
];
const FILE_ARGS = [
  "--request-l2",
  "--request-l3",
  "--link-validator",
  "--finder",
  "--baseline-finder"
];
const EXIT = {
  usage: 2,
  safety: 3,
  proof: 4,
  tool: 6
};

class RunnerError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  const inputs = validateInputs(options);
  const preWriteV1 = await runLegacyNoShrinkProbe(inputs.finder, inputs.baselineFinder, inputs.legacyFixtureRoot, inputs.v1Corpus);
  const l2Fixture = await runLayerProbe("L2", inputs);
  const postL2V1 = await runLegacyNoShrinkProbe(inputs.finder, inputs.baselineFinder, inputs.legacyFixtureRoot, inputs.v1Corpus);
  const l3Fixture = await runLayerProbe("L3", inputs);
  const postRecoveryV1 = await runLegacyNoShrinkProbe(inputs.finder, inputs.baselineFinder, inputs.legacyFixtureRoot, inputs.v1Corpus);
  const legacyV1Probe = mergeLegacyReplay([preWriteV1, postL2V1, postRecoveryV1]);
  const fixtures = [l2Fixture, l3Fixture];

  process.stdout.write(`${JSON.stringify({
    contract: CONTRACT,
    profile: "governed-theme-v2",
    authority: "fixture_only_experimental",
    status: "PASS",
    active_write_profile: "legacy-v1",
    legacy_v1_probe: legacyV1Probe,
    fixtures
  })}\n`);
}

function printHelp() {
  process.stdout.write(`Fixture-only integrated create/recall V2 adapter.

DEFAULT: off. The runner executes only when every explicit fixture and tool path
below is supplied. It never resolves DEX_MEMORIA_HOME and never targets a live
memory vault.

Usage:
  node scripts/run-memory-v2-create-recall-fixture.js \\
    --commit-fixture-l2 <absolute-fixture-root> \\
    --recovery-fixture-l2 <absolute-fixture-root> \\
    --request-l2 <absolute-request.json> \\
    --commit-fixture-l3 <absolute-fixture-root> \\
    --recovery-fixture-l3 <absolute-fixture-root> \\
    --request-l3 <absolute-request.json> \\
    --link-validator <absolute-validate-memory-links.ps1> \\
    --finder <absolute-find-memory.ps1> \\
    --baseline-finder <absolute-find-memory.ps1> \\
    --legacy-fixture-root <absolute-new-directory-under-laboratory> \\
    --laboratory-root <absolute-governed-laboratory-root> \\
    --live-vault-path <absolute-live-vault-deny-path>

Success emits exactly one ${CONTRACT} JSON line. Errors emit one JSON line on
stderr and point to --help.

Exit codes:
  0 success or help
  2 invalid usage or input
  3 safety boundary blocked
  4 integrated proof divergence
  6 child process or tool failure

Recovery after an error:
  Inspect the JSON error, remove the disposable fixtures, recreate them from
  sanitized baselines, and rerun with the complete explicit argument set.
`);
}

function parseArgs(argv) {
  if (argv.length === 0) usage("all explicit fixture and tool arguments are required");
  if (argv.length % 2 !== 0) usage("every argument requires one non-empty value");
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!REQUIRED_ARGS.includes(name)) usage(`unknown argument: ${name}`);
    if (Object.hasOwn(options, name)) usage(`duplicate argument: ${name}`);
    if (typeof value !== "string" || value.trim() === "" || value.startsWith("--")) {
      usage(`argument requires a non-empty value: ${name}`);
    }
    options[name] = value;
  }
  const missing = REQUIRED_ARGS.filter((name) => !Object.hasOwn(options, name));
  if (missing.length > 0) usage(`missing required arguments: ${missing.join(", ")}`);
  return options;
}

function validateInputs(options) {
  const resolved = {};
  for (const name of REQUIRED_ARGS) {
    const value = options[name];
    if (!path.isAbsolute(value)) usage(`path must be absolute: ${name}`);
    resolved[name] = path.resolve(value);
  }

  const laboratoryRoot = resolved["--laboratory-root"];
  const liveVaultPath = resolved["--live-vault-path"];
  requirePlainPath(laboratoryRoot, "directory", "laboratory root");
  requirePlainPath(liveVaultPath, "directory", "live vault deny path");
  const laboratoryMarker = readJsonFile(path.join(laboratoryRoot, "lab-marker.json"), "laboratory marker");
  if (
    laboratoryMarker.contract !== "dex.memory.precutover.clone.v0" ||
    laboratoryMarker.disposable !== true ||
    laboratoryMarker.live_vault_touched !== false
  ) {
    safety("laboratory marker is invalid");
  }
  if (pathsOverlap(laboratoryRoot, REPO_ROOT) || pathsOverlap(laboratoryRoot, liveVaultPath)) {
    safety("laboratory root overlaps a prohibited root");
  }

  for (const name of FIXTURE_ARGS) requirePlainPath(resolved[name], "directory", name);
  for (const name of FILE_ARGS) requirePlainPath(resolved[name], "file", name);
  const legacyFixtureRoot = resolved["--legacy-fixture-root"];
  if (fs.existsSync(legacyFixtureRoot)) safety("legacy fixture root must not already exist");
  requirePlainPath(path.dirname(legacyFixtureRoot), "directory", "legacy fixture parent");
  requirePlainPath(CLI_PATH, "file", "repo CLI");
  requirePlainPath(V1_CORPUS_PATH, "file", "V1 corpus contract");
  const validatorPolicy = path.join(
    path.dirname(path.dirname(resolved["--link-validator"])),
    "policies",
    "memory-policy.json"
  );
  requirePlainPath(validatorPolicy, "file", "validator policy");

  const fixtures = FIXTURE_ARGS.map((name) => resolved[name]);
  for (let first = 0; first < fixtures.length; first += 1) {
    for (let second = first + 1; second < fixtures.length; second += 1) {
      if (pathsOverlap(fixtures[first], fixtures[second])) {
        safety("fixture roots must be pairwise disjoint");
      }
    }
  }
  const defaultVault = path.join(os.homedir(), ".agents", "memories");
  const environmentVault = process.env.DEX_MEMORIA_HOME ? path.resolve(process.env.DEX_MEMORIA_HOME) : null;
  const dexAgentRoot = path.join(os.homedir(), ".dex-agent");
  if ([defaultVault, environmentVault, dexAgentRoot].filter(Boolean).some((root) => pathsOverlap(laboratoryRoot, root))) {
    safety("laboratory root overlaps a prohibited memory root");
  }
  for (const fixture of fixtures) {
    if (!isStrictDescendant(fixture, laboratoryRoot)) safety("fixture root must be inside the governed laboratory");
    if (pathsOverlap(fixture, REPO_ROOT)) safety("fixture root must be outside the repository");
    if ([liveVaultPath, defaultVault, environmentVault, dexAgentRoot].filter(Boolean).some((root) => pathsOverlap(fixture, root))) {
      safety("fixture root overlaps a prohibited memory root");
    }
  }
  if (!isStrictDescendant(legacyFixtureRoot, laboratoryRoot)) safety("legacy fixture root must be inside the governed laboratory");
  if (pathsOverlap(legacyFixtureRoot, REPO_ROOT)) safety("legacy fixture root must be outside the repository");
  if ([liveVaultPath, defaultVault, environmentVault, dexAgentRoot].filter(Boolean).some((root) => pathsOverlap(legacyFixtureRoot, root))) {
    safety("legacy fixture root overlaps a prohibited memory root");
  }
  if (fixtures.some((fixture) => pathsOverlap(legacyFixtureRoot, fixture))) {
    safety("legacy fixture root must be disjoint from V2 fixture roots");
  }
  if (samePath(fs.realpathSync.native(resolved["--finder"]), fs.realpathSync.native(resolved["--baseline-finder"]))) {
    safety("current Finder and baseline Finder must be distinct files");
  }
  const requestFixturePairs = [
    [resolved["--request-l2"], resolved["--commit-fixture-l2"]],
    [resolved["--request-l3"], resolved["--commit-fixture-l3"]]
  ];
  for (const [requestPath, fixtureRoot] of requestFixturePairs) {
    if (!isStrictDescendant(requestPath, fixtureRoot)) safety("request path must stay inside its commit fixture");
  }

  const l2Request = readJsonFile(resolved["--request-l2"], "L2 request");
  const l3Request = readJsonFile(resolved["--request-l3"], "L3 request");
  validateFixture(resolved["--commit-fixture-l2"], "L2");
  validateFixture(resolved["--recovery-fixture-l2"], "L2");
  validateFixture(resolved["--commit-fixture-l3"], "L3");
  validateFixture(resolved["--recovery-fixture-l3"], "L3");
  validateRequest(l2Request, "L2");
  validateRequest(l3Request, "L3");
  const v1Corpus = readJsonFile(V1_CORPUS_PATH, "V1 corpus contract");
  validateV1Corpus(v1Corpus);

  return {
    commitL2: resolved["--commit-fixture-l2"],
    recoveryL2: resolved["--recovery-fixture-l2"],
    requestL2Path: resolved["--request-l2"],
    requestL2: l2Request,
    commitL3: resolved["--commit-fixture-l3"],
    recoveryL3: resolved["--recovery-fixture-l3"],
    requestL3Path: resolved["--request-l3"],
    requestL3: l3Request,
    linkValidator: resolved["--link-validator"],
    validatorPolicy,
    finder: resolved["--finder"],
    baselineFinder: resolved["--baseline-finder"],
    legacyFixtureRoot,
    laboratoryRoot,
    liveVaultPath,
    v1Corpus
  };
}

function requirePlainPath(filePath, expectedType, label) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    usage(`path does not exist: ${label}`);
  }
  const validType = expectedType === "directory" ? stat.isDirectory() : stat.isFile();
  if (!validType || stat.isSymbolicLink()) safety(`path must be a plain ${expectedType}: ${label}`);
  let real;
  try {
    real = fs.realpathSync.native(filePath);
  } catch {
    safety(`path cannot be resolved safely: ${label}`);
  }
  if (!samePath(real, filePath)) safety(`path must not cross a reparse point: ${label}`);
}

function validateFixture(fixtureRoot, expectedLayer) {
  const marker = readJsonFile(path.join(fixtureRoot, ".dex-memory-fixture.json"), "fixture marker");
  const manifest = readJsonFile(path.join(fixtureRoot, "manifest.json"), "fixture manifest");
  requireExactKeys(marker, ["contract", "disposable", "operation", "targets"], "fixture marker");
  requireExactKeys(
    manifest,
    ["contract", "disposable_runs_only", "operation", "profile", "target_layer", "theme"],
    "fixture manifest"
  );
  if (
    marker.contract !== "dex.memory.disposable-run.v1" ||
    marker.operation !== "create" ||
    marker.disposable !== true ||
    marker.targets.length !== 1 ||
    marker.targets[0] !== `work/${manifest.theme}` ||
    manifest.contract !== "dex.memory.fixture.governed-theme-v2-transaction.v0" ||
    manifest.operation !== "create" ||
    manifest.profile !== "governed-theme-v2" ||
    manifest.disposable_runs_only !== true ||
    manifest.target_layer !== expectedLayer ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.theme)
  ) {
    safety(`fixture contract is incompatible with ${expectedLayer}`);
  }
  const themeRoot = path.join(fixtureRoot, "work", manifest.theme);
  for (const relative of ["lembranca.md", "memorias/INDEX.md", "conhecimento/INDEX.md"]) {
    requirePlainPath(path.join(themeRoot, ...relative.split("/")), "file", `${expectedLayer} fixture ${relative}`);
  }
}

function validateRequest(request, expectedLayer) {
  const expectedKeys = [
    "body", "contract", "created_at", "idempotency_key", "identity", "operation",
    "profile", "route_decision", "slug", "target_layer", "title", "trigger"
  ];
  if (expectedLayer === "L3") expectedKeys.push("owner_skill");
  requireExactKeys(request, expectedKeys, `${expectedLayer} request`);
  const expectedDecision = expectedLayer === "L2" ? "explicit-l2-memory" : "explicit-l3-knowledge";
  if (
    request.contract !== "dex.memory.create.theme-v2.request.v0" ||
    request.profile !== "governed-theme-v2" ||
    request.operation !== "create" ||
    request.target_layer !== expectedLayer ||
    request.route_decision !== expectedDecision
  ) {
    usage(`${expectedLayer} request contract is incompatible`);
  }
  for (const field of ["idempotency_key", "identity", "slug", "trigger", "title", "body", "created_at"]) {
    if (typeof request[field] !== "string" || request[field].trim() === "") {
      usage(`${expectedLayer} request field is empty: ${field}`);
    }
  }
  if (expectedLayer === "L3" && request.owner_skill !== "dex-memoria") {
    usage("L3 request requires owner_skill=dex-memoria");
  }
}

function validateV1Corpus(corpus) {
  requireExactKeys(corpus, ["contract", "corpus_id", "oracle", "queries", "sensitive", "synthetic", "theme"], "V1 corpus");
  if (
    corpus.contract !== "dex.memory.precutover.v1-corpus.v0" ||
    corpus.corpus_id !== "v1-synthetic-daily-memory-v0" ||
    corpus.synthetic !== true ||
    corpus.sensitive !== false ||
    corpus.theme !== "dex-precutover-v1-synthetic" ||
    !Array.isArray(corpus.queries) ||
    corpus.queries.length !== 3
  ) {
    proof("V1 corpus contract is invalid");
  }
  requireExactKeys(corpus.oracle, ["exit_code", "layers", "result_count_per_query", "result_ids", "warnings_count"], "V1 corpus oracle");
  if (
    corpus.oracle.exit_code !== 0 ||
    corpus.oracle.warnings_count !== 0 ||
    corpus.oracle.result_count_per_query !== 2 ||
    stableJson(corpus.oracle.layers) !== stableJson(["L1", "L2"]) ||
    stableJson(corpus.oracle.result_ids) !== stableJson(["v1-l1", "v1-l2"]) ||
    new Set(corpus.oracle.layers).size !== corpus.oracle.layers.length ||
    new Set(corpus.oracle.result_ids).size !== corpus.oracle.result_ids.length
  ) {
    proof("V1 corpus oracle is invalid");
  }
  const expectedForms = ["localizer", "natural_phrase", "tag"];
  const actualForms = corpus.queries.map((query) => query.form).sort();
  if (stableJson(actualForms) !== stableJson(expectedForms)) proof("V1 corpus query forms are invalid");
  for (const query of corpus.queries) {
    requireExactKeys(query, ["expected_layers", "expected_result_ids", "form", "term"], "V1 corpus query");
    if (
      typeof query.term !== "string" ||
      query.term.length < 3 ||
      stableJson(query.expected_layers) !== stableJson(corpus.oracle.layers) ||
      stableJson(query.expected_result_ids) !== stableJson(corpus.oracle.result_ids)
    ) {
      proof("V1 corpus query oracle is invalid");
    }
  }
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) usage(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    usage(`${label} contains missing or unknown fields`);
  }
}

async function runLayerProbe(layer, inputs) {
  const commitFixture = layer === "L2" ? inputs.commitL2 : inputs.commitL3;
  const recoveryFixture = layer === "L2" ? inputs.recoveryL2 : inputs.recoveryL3;
  const request = layer === "L2" ? inputs.requestL2 : inputs.requestL3;

  const commitProbe = await runCommitProbe({
    layer,
    fixtureRoot: commitFixture,
    request,
    linkValidator: inputs.linkValidator,
    validatorPolicy: inputs.validatorPolicy,
    finder: inputs.finder
  });
  const crashRecoveryProbe = await runCrashRecoveryProbe(recoveryFixture, request);
  const receipt = {
    target_layer: layer,
    identity: request.identity,
    slug: request.slug,
    commit_probe: commitProbe,
    crash_recovery_probe: crashRecoveryProbe
  };
  if (layer === "L3") receipt.owner_skill = request.owner_skill;
  return receipt;
}

async function runCommitProbe({ layer, fixtureRoot, request, linkValidator, validatorPolicy, finder }) {
  const workRoot = path.join(fixtureRoot, "work");
  const beforeTreeSha256 = await treeSha256(workRoot);
  const firstPlanRun = await runNodeCli(["create", "plan", "--fixture", fixtureRoot], request);
  const secondPlanRun = await runNodeCli(["create", "plan", "--fixture", fixtureRoot], request);
  if (firstPlanRun.stdout !== secondPlanRun.stdout) proof("repeated create plan output diverged");
  const afterPlanTreeSha256 = await treeSha256(workRoot);
  if (beforeTreeSha256 !== afterPlanTreeSha256) proof("create plan mutated the fixture work tree");
  const plan = parseJsonLine(firstPlanRun.stdout, "create plan");

  const driftTarget = plan.targets.find((target) => target.slot === "index");
  if (!driftTarget?.before_exists) proof("plan did not expose an existing index for drift proof");
  const driftPath = path.join(fixtureRoot, ...driftTarget.relative_path.split("/"));
  const originalBytes = fs.readFileSync(driftPath);
  let driftRun;
  try {
    fs.writeFileSync(driftPath, Buffer.concat([originalBytes, Buffer.from("\ncontrolled-drift\n")]));
    driftRun = await runNodeCli(
      ["create", "apply", "--fixture", fixtureRoot],
      plan,
      { expectedExit: 4, expectedErrorCode: "PLAN_CONFLICT" }
    );
  } finally {
    fs.writeFileSync(driftPath, originalBytes);
  }
  if (!fs.readFileSync(driftPath).equals(originalBytes)) proof("controlled drift bytes were not restored");

  const applyRun = await runNodeCli(["create", "apply", "--fixture", fixtureRoot], plan);
  const retryRun = await runNodeCli(["create", "apply", "--fixture", fixtureRoot], plan);
  const applyReceipt = parseJsonLine(applyRun.stdout, "create apply");
  const retryReceipt = parseJsonLine(retryRun.stdout, "create apply retry");
  validateCreateReceipt(applyReceipt, "apply", "COMMITTED", request.idempotency_key);
  validateCreateReceipt(retryReceipt, "apply", "ALREADY_COMMITTED", request.idempotency_key);

  const routesRun = await runNodeCli(["routes", "inspect", "--fixture", fixtureRoot], undefined);
  const routesReceipt = parseJsonLine(routesRun.stdout, "routes inspect");
  if (
    routesReceipt.contract !== "dex.memory.routes.inspect.v0" ||
    routesReceipt.profile !== "governed-theme-v2" ||
    routesReceipt.status !== "VALID" ||
    !Array.isArray(routesReceipt.routes) ||
    !routesReceipt.counts ||
    typeof routesReceipt.theme !== "string"
  ) {
    proof("routes inspect receipt contract is invalid");
  }
  const routesReceiptPath = path.join(fixtureRoot, "routes-receipt.json");
  fs.writeFileSync(routesReceiptPath, `${asciiJson(routesReceipt)}\n`, "ascii");
  const route = routesReceipt.routes.find((entry) => entry.identity === request.identity);
  if (
    !route ||
    route.layer !== layer ||
    route.slug !== request.slug ||
    (layer === "L3" && route.owner_skill !== request.owner_skill)
  ) {
    proof("created route is absent or incompatible in routes inspect");
  }

  const linksReceipt = await runLinkValidator(
    linkValidator,
    validatorPolicy,
    fixtureRoot,
    routesReceiptPath,
    routesReceipt.theme
  );
  if (
    linksReceipt.profile !== "governed-theme-v2" ||
    linksReceipt.ok !== true ||
    linksReceipt.require_obsidian !== false ||
    linksReceipt.safety_stop !== false ||
    !Array.isArray(linksReceipt.errors) ||
    linksReceipt.errors.length !== 0 ||
    !samePath(linksReceipt.theme_path, path.join(fixtureRoot, "work", routesReceipt.theme))
  ) {
    proof("link validator did not return a clean governed-theme-v2 receipt");
  }

  const recallReceipts = [];
  const recallTerms = [
    ["trigger", request.trigger],
    ["slug", request.slug],
    ["natural_phrase", request.body]
  ];
  for (const [form, term] of recallTerms) {
    let finderReceipt;
    try {
      finderReceipt = await runFinder(finder, {
        term,
        fixtureRoot,
        theme: routesReceipt.theme,
        layer,
        routesReceiptPath
      });
    } catch (error) {
      if (error instanceof RunnerError) {
        throw new RunnerError(error.exitCode, error.code, `Finder ${layer}/${form}: ${error.message}`);
      }
      throw error;
    }
    if (
      finderReceipt.schema !== "dex.memory.recall.v1" ||
      finderReceipt.ok !== true ||
      finderReceipt.status !== "ok" ||
      finderReceipt.query?.term !== term ||
      finderReceipt.scope?.theme !== routesReceipt.theme ||
      finderReceipt.scope?.layer !== layer ||
      !samePath(finderReceipt.scope?.vault_path, fixtureRoot) ||
      !samePath(finderReceipt.scope?.search_root, path.join(fixtureRoot, "work", routesReceipt.theme)) ||
      !Array.isArray(finderReceipt.errors) ||
      finderReceipt.errors.length !== 0
    ) {
      proof(`Finder ${form} did not return dex.memory.recall.v1`);
    }
    const result = finderReceipt.results.find((entry) =>
      entry.layer === layer &&
      normalizeRelative(entry.path) === route.destination_relative_path &&
      entry.life_status === "live" &&
      entry.provenance?.confidence === "confirmed"
    );
    if (!result) proof(`Finder ${form} did not recover the created destination`);
    recallReceipts.push({
      form,
      receipt: finderReceipt,
      layer: result.layer,
      relative_path: normalizeRelative(result.path)
    });
  }

  const destinationPath = path.join(fixtureRoot, ...route.destination_relative_path.split("/"));
  return {
    plan_first_sha256: sha256(Buffer.from(firstPlanRun.stdout)),
    plan_second_sha256: sha256(Buffer.from(secondPlanRun.stdout)),
    before_tree_sha256: beforeTreeSha256,
    after_plan_tree_sha256: afterPlanTreeSha256,
    drift_error: parseJsonLine(driftRun.stderr, "controlled drift"),
    apply_receipt: applyReceipt,
    retry_receipt: retryReceipt,
    routes_receipt: routesReceipt,
    links_receipt: linksReceipt,
    recall_receipts: recallReceipts,
    destination_relative_path: route.destination_relative_path,
    destination_sha256: sha256(fs.readFileSync(destinationPath)),
    after_apply_tree_sha256: await treeSha256(workRoot)
  };
}

async function runCrashRecoveryProbe(fixtureRoot, request) {
  const baselineTreeSha256 = await treeSha256(path.join(fixtureRoot, "work"));
  const planRun = await runNodeCli(["create", "plan", "--fixture", fixtureRoot], request);
  const plan = parseJsonLine(planRun.stdout, "recovery create plan");
  const killed = await killAtFailpoint(fixtureRoot, plan);
  const recoverRequest = {
    contract: "dex.memory.create.theme-v2.recover.v0",
    profile: "governed-theme-v2",
    idempotency_key: request.idempotency_key
  };
  const recoveryRun = await runNodeCli(["create", "recover", "--fixture", fixtureRoot], recoverRequest);
  const recoveryReceipt = parseJsonLine(recoveryRun.stdout, "create recover");
  validateCreateReceipt(recoveryReceipt, "recover", "ROLLED_BACK", request.idempotency_key);
  const restoredTreeSha256 = await treeSha256(path.join(fixtureRoot, "work"));
  if (
    recoveryReceipt.status !== "ROLLED_BACK" ||
    killed.pid === recoveryRun.pid ||
    baselineTreeSha256 !== restoredTreeSha256
  ) {
    proof("hard-kill recovery proof diverged");
  }
  return {
    killed_pid: killed.pid,
    recovery_pid: recoveryRun.pid,
    recovery_receipt: recoveryReceipt,
    baseline_tree_sha256: baselineTreeSha256,
    restored_tree_sha256: restoredTreeSha256
  };
}

function killAtFailpoint(fixtureRoot, plan) {
  const failpoint = "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT";
  return new Promise((resolveRun, rejectRun) => {
    const child = fork(CLI_PATH, ["create", "apply", "--fixture", fixtureRoot], {
      cwd: REPO_ROOT,
      env: { ...process.env, DEX_MEMORIA_INTERNAL_TEST_FAILPOINT: failpoint },
      stdio: ["pipe", "pipe", "pipe", "ipc"]
    });
    let signaled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new RunnerError(EXIT.tool, "FAILPOINT_TIMEOUT", `timed out waiting for ${failpoint}`));
    }, 15000);
    child.on("message", (message) => {
      if (
        message?.contract !== "dex.memory.test.failpoint.v0" ||
        message.failpoint !== failpoint ||
        message.pid !== child.pid
      ) {
        clearTimeout(timer);
        child.kill("SIGKILL");
        rejectRun(new RunnerError(EXIT.proof, "FAILPOINT_SIGNAL_INVALID", "failpoint IPC receipt diverged"));
        return;
      }
      signaled = true;
      child.kill("SIGKILL");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectRun(new RunnerError(EXIT.tool, "CHILD_PROCESS_FAILED", error.message));
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (!signaled) {
        rejectRun(new RunnerError(EXIT.proof, "FAILPOINT_NOT_REACHED", `apply closed before ${failpoint}`));
        return;
      }
      resolveRun({ pid: child.pid, exitCode, signal });
    });
    child.stdin.end(JSON.stringify(plan));
  });
}

async function runLinkValidator(scriptPath, policyPath, fixtureRoot, routesReceiptPath, theme) {
  const args = [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
    "-ThemePath", path.join(fixtureRoot, "work", theme),
    "-MemoryProfile", "governed-theme-v2",
    "-FixtureRoot", fixtureRoot,
    "-RoutesReceiptPath", routesReceiptPath,
    "-MemoryPolicyPath", policyPath,
    "-AsJson"
  ];
  const result = await runProcess(powershellCommand(), args);
  return parseJsonDocument(result.stdout, "link validator");
}

async function runFinder(scriptPath, { term, fixtureRoot, theme, layer, routesReceiptPath }) {
  const args = [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
    "-Term", term,
    "-Theme", theme,
    "-Layer", layer,
    "-VaultPath", fixtureRoot,
    "-MemoryProfile", "governed-theme-v2",
    "-RouteReceiptPath", routesReceiptPath,
    "-DexMemoriaRoot", REPO_ROOT,
    "-RecallJson"
  ];
  const result = await runProcess(powershellCommand(), args);
  return parseJsonDocument(result.stdout, "Finder");
}

async function runLegacyNoShrinkProbe(finder, baselineFinder, fixtureRoot, corpus) {
  const queries = corpus.queries;
  fs.mkdirSync(fixtureRoot);
  try {
    const theme = corpus.theme;
    const themeRoot = path.join(fixtureRoot, "temas", theme);
    fs.mkdirSync(themeRoot, { recursive: true });
    fs.writeFileSync(path.join(themeRoot, "lembranca.md"), [
      "# Lembranças",
      "",
      "- [DEX-PRECUTOVER-DAILY-PROBE] rotina sintetica diaria de memoria #dex/precutover-daily-probe -> [memoria.md#dex-precutover-daily-probe]",
      ""
    ].join("\n"));
    fs.writeFileSync(path.join(themeRoot, "memoria.md"), [
      "# Memória",
      "",
      "## Rotina sintética diária de memória {#dex-precutover-daily-probe}",
      "",
      "Localizador: DEX-PRECUTOVER-DAILY-PROBE",
      "",
      "Tag: #dex/precutover-daily-probe",
      "",
      "rotina sintetica diaria de memoria",
      ""
    ].join("\n"));
    const queryReceipts = [];
    for (const query of queries) {
      const current = await runLegacyFinder(finder, fixtureRoot, theme, query.term);
      const baseline = await runLegacyFinder(baselineFinder, fixtureRoot, theme, query.term);
      const currentIdentity = validateLegacyNoShrinkReceipt(current, "current", query, corpus);
      const baselineIdentity = validateLegacyNoShrinkReceipt(baseline, "baseline", query, corpus);
      const currentNormalized = normalizeLegacyReceipt(current);
      const baselineNormalized = normalizeLegacyReceipt(baseline);
      if (stableJson(currentNormalized) !== stableJson(baselineNormalized)) {
        proof(`legacy-v1 Finder ${query.form} output shrank or diverged from baseline`);
      }
      queryReceipts.push({
        form: query.form,
        current_sha256: sha256(Buffer.from(stableJson(currentNormalized))),
        baseline_sha256: sha256(Buffer.from(stableJson(baselineNormalized))),
        result_count: currentIdentity.length,
        result_ids: currentIdentity
      });
    }
    return {
      contract: "dex.memory.recall.v1",
      no_shrink: true,
      query_count: queries.length,
      query_forms: queries.map((query) => query.form).sort(),
      queries: queryReceipts,
      result_count: queryReceipts.reduce((total, receipt) => total + receipt.result_count, 0),
      result_layers: corpus.oracle.layers,
      result_paths: [`temas/${theme}/lembranca.md`, `temas/${theme}/memoria.md`]
    };
  } finally {
    if (fs.existsSync(fixtureRoot)) {
      requirePlainPath(fixtureRoot, "directory", "legacy fixture cleanup root");
      fs.rmSync(fixtureRoot, { recursive: true, force: false });
    }
  }
}

async function runLegacyFinder(scriptPath, fixtureRoot, theme, term) {
  const args = [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
    "-Term", term,
    "-Theme", theme,
    "-VaultPath", fixtureRoot,
    "-RecallJson"
  ];
  const result = await runProcess(powershellCommand(), args);
  const receipt = parseJsonDocument(result.stdout, "legacy Finder");
  if (receipt.schema !== "dex.memory.recall.v1" || receipt.ok !== true) {
    proof("legacy Finder did not return dex.memory.recall.v1");
  }
  return receipt;
}

function validateLegacyNoShrinkReceipt(receipt, label, query, corpus) {
  const results = Array.isArray(receipt.results) ? receipt.results : [];
  const layers = new Set(results.map((entry) => entry.layer));
  const warningsCount = Array.isArray(receipt.warnings) ? receipt.warnings.length : 0;
  const resultIds = [...new Set(results.map((entry) => {
    const normalizedPath = normalizeRelative(entry.path || "").toLowerCase();
    if (entry.layer === "L1" && normalizedPath.endsWith("/lembranca.md")) return "v1-l1";
    if (entry.layer === "L2" && normalizedPath.endsWith("/memoria.md")) return "v1-l2";
    return "unexpected";
  }))].sort();
  if (
    receipt.status !== "ok" ||
    receipt.query?.term !== query.term ||
    receipt.scope?.theme !== corpus.theme ||
    receipt.counts?.results !== results.length ||
    results.length < 2 ||
    !layers.has("L1") ||
    !layers.has("L2") ||
    !results.every((entry) =>
      entry.life_status === "live" &&
      entry.provenance?.confidence === "confirmed" &&
      typeof entry.path === "string" &&
      entry.path.length > 0
    ) ||
    warningsCount !== corpus.oracle.warnings_count ||
    stableJson([...layers].sort()) !== stableJson(query.expected_layers) ||
    stableJson(resultIds) !== stableJson(query.expected_result_ids)
  ) {
    proof(`legacy-v1 Finder ${label} receipt is empty or incomplete`);
  }
  return resultIds;
}

function mergeLegacyReplay(probes) {
  const baseline = stableJson(probes[0].queries);
  if (probes.some((probe) => probe.no_shrink !== true || stableJson(probe.queries) !== baseline)) {
    proof("legacy-v1 replay changed across pre-write, post-layer and post-recovery phases");
  }
  return {
    ...probes[probes.length - 1],
    replay_phases: ["pre_write", "post_l2", "post_recovery"],
    replay_count: probes.length
  };
}

function normalizeLegacyReceipt(receipt) {
  const clone = JSON.parse(JSON.stringify(receipt));
  delete clone.generated_at;
  return clone;
}

function validateCreateReceipt(receipt, command, status, idempotencyKey) {
  const expectedJournalState = status === "ROLLED_BACK" ? "ROLLED_BACK" : "COMMITTED";
  if (
    receipt.contract !== "dex.memory.create.theme-v2.receipt.v0" ||
    receipt.profile !== "governed-theme-v2" ||
    receipt.command !== command ||
    receipt.status !== status ||
    receipt.idempotency_key !== idempotencyKey ||
    receipt.journal_state !== expectedJournalState ||
    receipt.recovery_required !== false
  ) {
    proof(`${command} receipt contract is invalid for status ${status}`);
  }
}

function runNodeCli(args, input, expectation = {}) {
  const stdin = input === undefined ? "" : `${JSON.stringify(input)}\n`;
  return runProcess(process.execPath, [CLI_PATH, ...args], stdin, expectation);
}

function runProcess(command, args, stdin = "", expectation = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: childEnvironment(command),
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      rejectRun(new RunnerError(EXIT.tool, "CHILD_PROCESS_FAILED", error.message));
    });
    child.on("close", (exitCode, signal) => {
      const result = {
        pid: child.pid,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode,
        signal
      };
      const expectedExit = expectation.expectedExit ?? 0;
      if (exitCode !== expectedExit || signal !== null) {
        rejectRun(new RunnerError(
          EXIT.tool,
          "CHILD_PROCESS_FAILED",
          `${path.basename(command)} failed; inspect the private laboratory receipt`
        ));
        return;
      }
      if (expectation.expectedErrorCode) {
        const errorReceipt = parseJsonLine(result.stderr, "expected child error");
        if (result.stdout !== "" || errorReceipt.code !== expectation.expectedErrorCode) {
          rejectRun(new RunnerError(EXIT.proof, "CHILD_ERROR_DIVERGED", "expected child error receipt diverged"));
          return;
        }
      } else if (result.stderr !== "") {
        rejectRun(new RunnerError(EXIT.tool, "CHILD_STDERR_NOT_EMPTY", `${path.basename(command)} wrote to stderr`));
        return;
      }
      resolveRun(result);
    });
    child.stdin.end(stdin);
  });
}

function powershellCommand() {
  return process.platform === "win32" ? "powershell.exe" : "pwsh";
}

function childEnvironment(command) {
  const environment = { ...process.env };
  if (process.platform !== "win32" || path.basename(command).toLowerCase() !== "powershell.exe") {
    return environment;
  }
  const nativeModuleRoots = [
    path.join(os.homedir(), "Documents", "WindowsPowerShell", "Modules"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "WindowsPowerShell", "Modules"),
    path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules")
  ];
  environment.PSModulePath = nativeModuleRoots.join(path.delimiter);
  return environment;
}

function parseJsonLine(text, label) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) proof(`${label} did not emit exactly one JSON line`);
  return parseJsonDocument(lines[0], label);
}

function parseJsonDocument(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    proof(`${label} did not emit valid JSON`);
  }
}

function readJsonFile(filePath, label) {
  requirePlainPath(filePath, "file", label);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    usage(`${label} is not valid JSON`);
  }
}

async function treeSha256(root) {
  const rows = [];
  async function visit(relative = "") {
    const directory = relative ? path.join(root, ...relative.split("/")) : root;
    for (const name of fs.readdirSync(directory).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name;
      const childPath = path.join(root, ...childRelative.split("/"));
      const stat = fs.lstatSync(childPath);
      if (stat.isSymbolicLink()) safety("fixture work tree contains a reparse point");
      if (stat.isDirectory()) {
        rows.push(`d:${childRelative}`);
        await visit(childRelative);
      } else if (stat.isFile()) {
        rows.push(`f:${childRelative}:${sha256(fs.readFileSync(childPath))}`);
      } else {
        safety("fixture work tree contains a non-file entry");
      }
    }
  }
  await visit();
  return sha256(Buffer.from(rows.join("\n")));
}

function normalizeRelative(value) {
  return String(value).replaceAll("\\", "/");
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function asciiJson(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function pathsOverlap(first, second) {
  const firstNormalized = normalizePath(first);
  const secondNormalized = normalizePath(second);
  return (
    firstNormalized === secondNormalized ||
    firstNormalized.startsWith(`${secondNormalized}${path.sep}`) ||
    secondNormalized.startsWith(`${firstNormalized}${path.sep}`)
  );
}

function isStrictDescendant(candidate, parent) {
  const candidateNormalized = normalizePath(candidate);
  const parentNormalized = normalizePath(parent);
  return candidateNormalized.startsWith(`${parentNormalized}${path.sep}`);
}

function normalizePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function samePath(first, second) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  return normalizePath(first) === normalizePath(second);
}

function usage(message) {
  throw new RunnerError(EXIT.usage, "INVALID_USAGE", message);
}

function safety(message) {
  throw new RunnerError(EXIT.safety, "SAFETY_BLOCKED", message);
}

function proof(message) {
  throw new RunnerError(EXIT.proof, "PROOF_DIVERGED", message);
}

main().catch((error) => {
  const known = error instanceof RunnerError;
  const receipt = {
    contract: "dex.memory.create-recall.fixture-error.v0",
    code: known ? error.code : "INTERNAL_ERROR",
    message: known ? error.message : "fixture-only runner failed",
    help_hint: "--help"
  };
  process.stderr.write(`${JSON.stringify(receipt)}\n`);
  process.exitCode = known ? error.exitCode : EXIT.tool;
});
