#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  ComparisonError,
  validateFixture,
  writeComparisonNotRun
} = require("./compare-memory-resource-limits-shadow");

const repoRoot = path.resolve(__dirname, "..");
const comparatorPath = path.join(__dirname, "compare-memory-resource-limits-shadow.js");
const consumerId = "validate-memory-tags";

class UsageError extends Error {}

function helpText() {
  return [
    "Fixture-only tag file-limit SHADOW probe",
    "",
    "DEFAULT is off: without both candidate arguments, only the installed validator runs.",
    "",
    "usage:",
    "  node scripts/run-memory-tag-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-tags.ps1>",
    "  node scripts/run-memory-tag-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-tags.ps1> --bundle <contracts/policies> --receipt <fixture/receipts/name.json>",
    "",
    "The fixture must be explicitly marked disposable for validate-tags.",
    "SHADOW compares after the validator finishes. Its current MaxFiles default keeps precedence.",
    "Recovery: remove --bundle and --receipt, then repeat the current validator operation."
  ].join("\n") + "\n";
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.length !== 4 && argv.length !== 8) throw new UsageError("arguments are incomplete");
  const allowed = new Set(["--fixture", "--validator", "--bundle", "--receipt"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || Object.hasOwn(values, key)) throw new UsageError("arguments are invalid");
    values[key] = value;
  }
  if (!values["--fixture"] || !values["--validator"]) throw new UsageError("fixture and validator are required");
  const hasBundle = Object.hasOwn(values, "--bundle");
  const hasReceipt = Object.hasOwn(values, "--receipt");
  if (hasBundle !== hasReceipt) throw new UsageError("--bundle and --receipt must be supplied together");
  return {
    fixtureRoot: values["--fixture"],
    validatorPath: values["--validator"],
    shadow: hasBundle,
    bundleRoot: values["--bundle"],
    receiptPath: values["--receipt"]
  };
}

function validateValidator(requestedPath) {
  const validatorPath = path.resolve(requestedPath);
  let stat;
  try {
    stat = fs.lstatSync(validatorPath);
  } catch {
    throw new UsageError("validator is invalid");
  }
  if (!stat.isFile() || stat.isSymbolicLink() || path.basename(validatorPath).toLowerCase() !== "validate-memory-tags.ps1") {
    throw new UsageError("validator is invalid");
  }
  return validatorPath;
}

function powershellExecutable() {
  return process.platform === "win32" ? "powershell.exe" : "pwsh";
}

function operationArguments(fixtureRoot, validatorPath) {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", validatorPath,
    "-ThemePath", path.join(fixtureRoot, "theme"),
    "-AsJson"
  ];
}

function normalizeChildResult(result) {
  return {
    status: result.status,
    signal: result.signal || null,
    error: result.error || null,
    stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout || ""),
    stderr: Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr || "")
  };
}

function runTagLimitProbe(argv, dependencies = {}) {
  const options = parseArguments(argv);
  if (options.help) return { help: true, operation: null, comparison: null };
  const fixtureRoot = validateFixture(options.fixtureRoot, consumerId);
  const validatorPath = validateValidator(options.validatorPath);
  const spawnOperation = dependencies.spawnOperation || spawnSync;
  const spawnComparison = dependencies.spawnComparison || spawnSync;
  const operation = normalizeChildResult(spawnOperation(
    powershellExecutable(),
    operationArguments(fixtureRoot, validatorPath),
    { cwd: repoRoot, env: process.env, input: Buffer.alloc(0), encoding: null }
  ));
  if (operation.error) {
    operation.status = 6;
    operation.stdout = Buffer.alloc(0);
    operation.stderr = Buffer.from("TAG_LIMIT_FIXTURE_FAILURE: operation child could not start\n");
  }
  if (!options.shadow) return { options, operation, comparison: { status: "comparison_not_requested" } };

  const comparisonResult = normalizeChildResult(spawnComparison(
    process.execPath,
    [
      comparatorPath,
      "--consumer", consumerId,
      "--fixture", fixtureRoot,
      "--bundle", options.bundleRoot,
      "--receipt", options.receiptPath,
      "--current-source", validatorPath
    ],
    { cwd: repoRoot, env: process.env, input: Buffer.alloc(0), encoding: null }
  ));
  if (comparisonResult.error) {
    try {
      writeComparisonNotRun({
        consumerId,
        fixtureRoot,
        receiptPath: options.receiptPath,
        currentSourcePath: validatorPath
      });
    } catch {
      // The current operation remains authoritative if the diagnostic receipt cannot be written.
    }
    return { options, operation, comparison: { status: "comparison_not_run", exitCode: null } };
  }
  return {
    options,
    operation,
    comparison: {
      status: comparisonResult.status === 0 ? "comparison_completed" : "comparison_failed",
      exitCode: comparisonResult.status
    }
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArguments(argv);
    if (parsed.help) {
      process.stdout.write(helpText());
      return 0;
    }
    const result = runTagLimitProbe(argv);
    process.stdout.write(result.operation.stdout);
    process.stderr.write(result.operation.stderr);
    return Number.isInteger(result.operation.status) ? result.operation.status : 6;
  } catch (error) {
    if (error instanceof UsageError || error instanceof ComparisonError) {
      process.stderr.write("TAG_LIMIT_FIXTURE_USAGE: run with --help\n");
      return 2;
    }
    process.stderr.write("TAG_LIMIT_FIXTURE_FAILURE: fixture probe failed\n");
    return 6;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { helpText, main, parseArguments, runTagLimitProbe };
