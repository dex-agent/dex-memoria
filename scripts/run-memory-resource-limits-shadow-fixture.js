#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "bin", "dex-memoria.js");
const comparatorPath = path.join(__dirname, "compare-memory-resource-limits-shadow.js");
const allowedConsumers = new Set(["dex-memoria.cli", "dex-memoria.route-inspector"]);

class UsageError extends Error {}

function helpText() {
  return [
    "Fixture-only resource-limit SHADOW probe",
    "",
    "DEFAULT is off: without both candidate arguments, only the current operation runs.",
    "",
    "usage:",
    "  node scripts/run-memory-resource-limits-shadow-fixture.js --consumer <consumer-id> --fixture <fixture-root>",
    "  node scripts/run-memory-resource-limits-shadow-fixture.js --consumer <consumer-id> --fixture <fixture-root> --bundle <contracts/policies> --receipt <fixture/receipts/name.json>",
    "",
    "consumer-id:",
    "  dex-memoria.cli                 reads request JSON from stdin and runs create plan",
    "  dex-memoria.route-inspector     runs routes inspect and requires empty stdin",
    "",
    "SHADOW compares after the operation finishes. Current limits keep precedence.",
    "Recovery: remove --bundle and --receipt, then repeat the current operation."
  ].join("\n") + "\n";
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.length !== 4 && argv.length !== 8) throw new UsageError("arguments are incomplete");
  const allowed = new Set(["--consumer", "--fixture", "--bundle", "--receipt"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || Object.hasOwn(values, key)) throw new UsageError("arguments are invalid");
    values[key] = value;
  }
  const consumerId = values["--consumer"];
  if (!allowedConsumers.has(consumerId) || !values["--fixture"]) throw new UsageError("consumer or fixture is invalid");
  const hasBundle = Object.hasOwn(values, "--bundle");
  const hasReceipt = Object.hasOwn(values, "--receipt");
  if (hasBundle !== hasReceipt) throw new UsageError("--bundle and --receipt must be supplied together");
  return {
    consumerId,
    fixtureRoot: values["--fixture"],
    shadow: hasBundle,
    bundleRoot: values["--bundle"],
    receiptPath: values["--receipt"]
  };
}

function operationArguments(options) {
  if (options.consumerId === "dex-memoria.cli") {
    return [cliPath, "create", "plan", "--fixture", options.fixtureRoot];
  }
  return [cliPath, "routes", "inspect", "--fixture", options.fixtureRoot];
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

function runFixtureProbe(argv, inputBytes = Buffer.alloc(0), dependencies = {}) {
  const options = parseArguments(argv);
  if (options.help) return { help: true, operation: null, comparison: null };
  const spawnOperation = dependencies.spawnOperation || spawnSync;
  const spawnComparison = dependencies.spawnComparison || spawnSync;
  const operation = normalizeChildResult(spawnOperation(
    process.execPath,
    operationArguments(options),
    { cwd: repoRoot, env: process.env, input: inputBytes, encoding: null }
  ));
  if (operation.error) {
    operation.status = 6;
    operation.stdout = Buffer.alloc(0);
    operation.stderr = Buffer.from('{"contract":"dex.memory.error.v0","code":"IO_FAILURE","message":"operation child could not start"}\n');
  }
  if (!options.shadow) return { options, operation, comparison: { status: "comparison_not_requested" } };

  const comparisonResult = normalizeChildResult(spawnComparison(
    process.execPath,
    [
      comparatorPath,
      "--consumer", options.consumerId,
      "--fixture", options.fixtureRoot,
      "--bundle", options.bundleRoot,
      "--receipt", options.receiptPath
    ],
    { cwd: repoRoot, env: process.env, input: Buffer.alloc(0), encoding: null }
  ));

  if (comparisonResult.error) {
    try {
      const { writeComparisonNotRun } = require("./compare-memory-resource-limits-shadow");
      writeComparisonNotRun(options);
    } catch {
      // The operation remains authoritative even if the diagnostic receipt cannot be written.
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

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArguments(argv);
    if (parsed.help) {
      process.stdout.write(helpText());
      return 0;
    }
    const input = await readStdin();
    const result = runFixtureProbe(argv, input);
    process.stdout.write(result.operation.stdout);
    process.stderr.write(result.operation.stderr);
    return Number.isInteger(result.operation.status) ? result.operation.status : 6;
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write("SHADOW_FIXTURE_USAGE: run with --help\n");
      return 2;
    }
    process.stderr.write("SHADOW_FIXTURE_FAILURE: fixture probe failed\n");
    return 6;
  }
}

if (require.main === module) main().then((exitCode) => { process.exitCode = exitCode; });

module.exports = { helpText, main, parseArguments, runFixtureProbe };
