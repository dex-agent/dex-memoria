#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { verifyGeneratedArtifacts } = require("./generate-memory-resource-limit-artifacts");

const repoRoot = path.resolve(__dirname, "..");
const policyFile = "dex.memory.resource-limits.v1.json";
const receiptContract = "dex.memory.resource-limits.shadow-comparison.v1";

const consumers = Object.freeze({
  "dex-memoria.cli": [
    {
      limit_id: "cli.stdin.max_bytes",
      unit: "bytes",
      source_id: "dex-memoria-repository",
      locator: "MAX_STDIN_BYTES",
      source_path: "bin/dex-memoria.js"
    }
  ],
  "dex-memoria.route-inspector": [
    {
      limit_id: "v2.routes.document.max_bytes",
      unit: "bytes",
      source_id: "dex-memoria-repository",
      locator: "MAX_DOCUMENT_BYTES",
      source_path: "bin/inspect-theme-v2-routes.js"
    },
    {
      limit_id: "v2.routes.max_entries",
      unit: "entries",
      source_id: "dex-memoria-repository",
      locator: "MAX_ROUTES",
      source_path: "bin/inspect-theme-v2-routes.js"
    }
  ],
  "validate-memory-tags": [
    {
      limit_id: "v2.tags.max_files",
      unit: "files",
      source_id: "installed-tag-validator",
      locator: "MaxFiles",
      source_path: "$DEX_MEMORY_HOME/.agents/tools/validate-memory-tags.ps1",
      reader: "powershell-parameter-default",
      source_basename: "validate-memory-tags.ps1"
    }
  ],
  "validate-memory-links": [
    {
      limit_id: "v2.document.max_lines",
      unit: "lines",
      source_id: "installed-link-validator",
      locator: "MaxLines",
      source_path: "$DEX_MEMORY_HOME/.agents/tools/validate-memory-links.ps1",
      reader: "powershell-parameter-default",
      source_basename: "validate-memory-links.ps1"
    }
  ]
});

class ComparisonError extends Error {
  constructor(code, message, exitCode = 2) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}

function helpText() {
  return [
    "Resource-limit SHADOW comparison child (fixture-only)",
    "",
    "usage:",
    "  node scripts/compare-memory-resource-limits-shadow.js --consumer <consumer-id> --fixture <fixture-root> --bundle <contracts/policies> --receipt <fixture/receipts/name.json>",
    "",
    "consumer-id:",
    "  dex-memoria.cli",
    "  dex-memoria.route-inspector",
    "  validate-memory-tags          requires --current-source <validate-memory-tags.ps1>",
    "  validate-memory-links         requires --current-source <validate-memory-links.ps1>",
    "",
    "This process compares only. Current sources keep precedence; the SHADOW bundle never decides the operation."
  ].join("\n") + "\n";
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  const allowed = new Set(["--consumer", "--fixture", "--bundle", "--receipt", "--current-source"]);
  if (argv.length !== 8 && argv.length !== 10) throw new ComparisonError("INVALID_USAGE", "arguments are incomplete");
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || Object.hasOwn(values, key)) {
      throw new ComparisonError("INVALID_USAGE", "arguments are invalid");
    }
    values[key] = value;
  }
  const consumerId = values["--consumer"];
  if (!consumers[consumerId]) throw new ComparisonError("INVALID_CONSUMER", "consumer is not allowed");
  for (const key of ["--fixture", "--bundle", "--receipt"]) {
    if (!values[key]) throw new ComparisonError("INVALID_USAGE", "required arguments are missing");
  }
  const currentSourcePath = values["--current-source"];
  const requiresCurrentSource = consumers[consumerId].some(({ reader }) => reader === "powershell-parameter-default");
  if (requiresCurrentSource && !currentSourcePath) {
    throw new ComparisonError("CURRENT_SOURCE_REQUIRED", "validation requires an explicit current source");
  }
  if (!requiresCurrentSource && currentSourcePath) {
    throw new ComparisonError("INVALID_USAGE", "current source is not accepted for this consumer");
  }
  return {
    consumerId,
    fixtureRoot: values["--fixture"],
    bundleRoot: values["--bundle"],
    receiptPath: values["--receipt"],
    currentSourcePath
  };
}

function assertPlainDirectory(directoryPath, code) {
  let stat;
  try {
    stat = fs.lstatSync(directoryPath);
  } catch {
    throw new ComparisonError(code, "required directory is invalid");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ComparisonError(code, "required directory is invalid");
}

function validateGovernedLaboratoryFixture(fixtureRoot) {
  const memoryRoot = path.resolve(process.env.DEX_MEMORIA_HOME || path.join(os.homedir(), ".agents", "memories"));
  const laboratoryRoot = path.join(path.dirname(memoryRoot), "laboratorio-memories");
  assertPlainDirectory(laboratoryRoot, "FIXTURE_INVALID");
  if (fs.realpathSync(laboratoryRoot) !== laboratoryRoot) {
    throw new ComparisonError("FIXTURE_INVALID", "governed laboratory boundary is invalid");
  }
  const relativeFixture = path.relative(laboratoryRoot, fixtureRoot);
  if (!relativeFixture || relativeFixture === ".." || relativeFixture.startsWith(`..${path.sep}`) || path.isAbsolute(relativeFixture)) {
    throw new ComparisonError("FIXTURE_INVALID", "fixture must be a child of the governed laboratory");
  }
}

function validateFixture(fixturePath, consumerId) {
  const fixtureRoot = path.resolve(fixturePath);
  assertPlainDirectory(fixtureRoot, "FIXTURE_INVALID");
  if (fs.realpathSync(fixtureRoot) !== fixtureRoot) throw new ComparisonError("FIXTURE_INVALID", "fixture boundary is invalid");
  if (consumerId === "validate-memory-links") validateGovernedLaboratoryFixture(fixtureRoot);
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(path.join(fixtureRoot, ".dex-memory-fixture.json"), "utf8"));
  } catch {
    throw new ComparisonError("FIXTURE_INVALID", "fixture marker is invalid");
  }
  const markerKeys = Object.keys(marker).sort().join("|");
  const markerIdentityValid = markerKeys === "contract|disposable|operation|targets" &&
    marker.contract === "dex.memory.disposable-run.v1" &&
    marker.disposable === true &&
    Array.isArray(marker.targets) &&
    marker.targets.length === 1;
  if (!markerIdentityValid) {
    throw new ComparisonError("FIXTURE_INVALID", "fixture marker is invalid");
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "manifest.json"), "utf8"));
  } catch {
    throw new ComparisonError("FIXTURE_INVALID", "fixture manifest is invalid");
  }
  const createContracts = new Set([
    "dex.memory.fixture.governed-theme-v2-plan.v0",
    "dex.memory.fixture.governed-theme-v2-transaction.v0"
  ]);
  const createFixtureValid = consumerId !== "validate-memory-tags" &&
    marker.operation === "create" &&
    /^work\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(marker.targets[0]) &&
    createContracts.has(manifest.contract) &&
    manifest.operation === "create" &&
    manifest.profile === "governed-theme-v2" &&
    manifest.disposable_runs_only === true &&
    marker.targets[0] === `work/${manifest.theme}`;
  const tagFixtureValid = consumerId === "validate-memory-tags" &&
    marker.operation === "validate-tags" &&
    marker.targets[0] === "theme" &&
    manifest.contract === "dex.memory.fixture.tag-validation.v1" &&
    manifest.operation === "validate-tags" &&
    manifest.disposable_runs_only === true &&
    manifest.theme === "theme";
  if (!createFixtureValid && !tagFixtureValid) {
    throw new ComparisonError("FIXTURE_INVALID", "fixture manifest is invalid");
  }
  if (tagFixtureValid) {
    const themeRoot = path.join(fixtureRoot, "theme");
    assertPlainDirectory(themeRoot, "FIXTURE_INVALID");
    if (fs.realpathSync(themeRoot) !== themeRoot) throw new ComparisonError("FIXTURE_INVALID", "fixture theme boundary is invalid");
  }
  return fixtureRoot;
}

function validateReceiptPath(fixturePath, requestedPath, consumerId) {
  const fixtureRoot = validateFixture(fixturePath, consumerId);
  const receiptsRoot = path.join(fixtureRoot, "receipts");
  if (!fs.existsSync(receiptsRoot)) fs.mkdirSync(receiptsRoot);
  assertPlainDirectory(receiptsRoot, "RECEIPT_BOUNDARY_INVALID");
  if (fs.realpathSync(receiptsRoot) !== receiptsRoot) {
    throw new ComparisonError("RECEIPT_BOUNDARY_INVALID", "receipt directory is invalid");
  }
  const receiptPath = path.resolve(requestedPath);
  if (path.dirname(receiptPath) !== receiptsRoot || !/^[a-z0-9][a-z0-9._-]*\.json$/i.test(path.basename(receiptPath))) {
    throw new ComparisonError("RECEIPT_BOUNDARY_INVALID", "receipt must be a direct JSON child of fixture receipts");
  }
  if (fs.existsSync(receiptPath)) {
    const stat = fs.lstatSync(receiptPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new ComparisonError("RECEIPT_BOUNDARY_INVALID", "receipt target is invalid");
  }
  return receiptPath;
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeReceipt(fixtureRoot, receiptPath, receipt) {
  const safeReceiptPath = validateReceiptPath(fixtureRoot, receiptPath, receipt.consumer_id);
  const temporaryPath = `${safeReceiptPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, canonicalJson(receipt), { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporaryPath, safeReceiptPath);
  } finally {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // The final receipt is already authoritative; cleanup failure is non-fatal.
    }
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function parseIntegerExpression(expression, locator) {
  if (!/^\d+(?:\s*\*\s*\d+)*$/.test(expression)) {
    throw new ComparisonError("CURRENT_SOURCE_INVALID", `${locator} is not a supported integer expression`, 1);
  }
  return expression.split("*").map((part) => Number(part.trim())).reduce((product, value) => product * value, 1);
}

function validateCurrentSource(requestedPath, definition) {
  const currentSourcePath = path.resolve(requestedPath);
  let stat;
  try {
    stat = fs.lstatSync(currentSourcePath);
  } catch {
    throw new ComparisonError("CURRENT_SOURCE_INVALID", "current source is invalid", 1);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || path.basename(currentSourcePath).toLowerCase() !== definition.source_basename) {
    throw new ComparisonError("CURRENT_SOURCE_INVALID", "current source is invalid", 1);
  }
  return currentSourcePath;
}

function readCurrentValue(definition, currentSourcePath) {
  if (definition.reader === "powershell-parameter-default") {
    const source = fs.readFileSync(validateCurrentSource(currentSourcePath, definition), "utf8");
    const match = source.match(new RegExp(`\\[int\\]\\s*\\$${definition.locator}\\s*=\\s*(\\d+)`, "i"));
    if (!match) throw new ComparisonError("CURRENT_SOURCE_INVALID", `${definition.locator} was not found`, 1);
    return Number(match[1]);
  }
  const source = fs.readFileSync(path.join(repoRoot, definition.source_path), "utf8");
  const match = source.match(new RegExp(`const\\s+${definition.locator}\\s*=\\s*([^;]+);`));
  if (!match) throw new ComparisonError("CURRENT_SOURCE_INVALID", `${definition.locator} was not found`, 1);
  return parseIntegerExpression(match[1].trim(), definition.locator);
}

function baseReceipt(consumerId, status, stage, errorCode) {
  const usesParameterDefault = consumers[consumerId].some(({ reader }) => reader === "powershell-parameter-default");
  return {
    contract: receiptContract,
    version: 1,
    status,
    consumer_id: consumerId,
    authority_state: "SHADOW",
    effective: false,
    precedence: "current",
    candidate_fallback: "none",
    current_resolution_source: usesParameterDefault ? "parameter-default" : "literal-constant",
    candidate_contract: null,
    candidate_version: null,
    candidate_policy_sha256: null,
    comparisons: [],
    stage,
    error_code: errorCode
  };
}

function compareLimits({ consumerId, fixtureRoot, bundleRoot, receiptPath, currentSourcePath }) {
  validateReceiptPath(fixtureRoot, receiptPath, consumerId);
  let policy;
  let policyBytes;
  try {
    verifyGeneratedArtifacts(path.resolve(bundleRoot));
    policyBytes = fs.readFileSync(path.join(path.resolve(bundleRoot), policyFile));
    policy = JSON.parse(policyBytes.toString("utf8"));
  } catch {
    const receipt = baseReceipt(consumerId, "candidate_invalid", "candidate_validation", "CANDIDATE_INVALID");
    writeReceipt(fixtureRoot, receiptPath, receipt);
    return { receipt, exitCode: 1 };
  }

  const byId = new Map(policy.limits.map((limit) => [limit.limit_id, limit]));
  const requiredCandidates = consumers[consumerId].map((definition) => byId.get(definition.limit_id));
  if (requiredCandidates.some((candidate, index) => !candidate || candidate.unit !== consumers[consumerId][index].unit)) {
    const receipt = baseReceipt(consumerId, "candidate_invalid", "candidate_validation", "CANDIDATE_INVALID");
    writeReceipt(fixtureRoot, receiptPath, receipt);
    return { receipt, exitCode: 1 };
  }
  const comparisons = consumers[consumerId].map((definition, index) => {
    const candidate = requiredCandidates[index];
    const currentValue = readCurrentValue(definition, currentSourcePath);
    return {
      limit_id: definition.limit_id,
      unit: definition.unit,
      current_source_id: definition.source_id,
      current_locator: definition.locator,
      current_value: currentValue,
      candidate_value: candidate.value,
      result: currentValue === candidate.value ? "match" : "mismatch"
    };
  });
  const status = comparisons.every((comparison) => comparison.result === "match") ? "match" : "mismatch";
  const receipt = {
    ...baseReceipt(consumerId, status, "complete", null),
    candidate_contract: policy.contract,
    candidate_version: policy.version,
    candidate_policy_sha256: sha256(policyBytes),
    comparisons
  };
  writeReceipt(fixtureRoot, receiptPath, receipt);
  return { receipt, exitCode: 0 };
}

function writeComparisonNotRun({ consumerId, fixtureRoot, receiptPath }) {
  const receipt = baseReceipt(consumerId, "comparison_not_run", "comparison_spawn", "COMPARISON_NOT_RUN");
  writeReceipt(fixtureRoot, receiptPath, receipt);
  return receipt;
}

function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
    if (options.help) {
      process.stdout.write(helpText());
      return 0;
    }
    const result = compareLimits(options);
    if (result.exitCode !== 0) process.stderr.write("RESOURCE_LIMIT_SHADOW_COMPARISON_FAILED: CANDIDATE_INVALID\n");
    return result.exitCode;
  } catch (error) {
    const code = error instanceof ComparisonError ? error.code : "COMPARISON_FAILED";
    process.stderr.write(`RESOURCE_LIMIT_SHADOW_COMPARISON_FAILED: ${code}\n`);
    return error instanceof ComparisonError ? error.exitCode : 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  ComparisonError,
  compareLimits,
  helpText,
  main,
  parseArguments,
  validateFixture,
  writeComparisonNotRun
};
