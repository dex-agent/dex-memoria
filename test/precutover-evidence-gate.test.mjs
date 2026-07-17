import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gatePath = join(repoRoot, "scripts", "validate-memory-v2-precutover-evidence.js");
const corpusContractSha256 = createHash("sha256")
  .update(readFileSync(join(repoRoot, "contracts", "fixtures", "precutover-v1-recall-corpus.v0.json")))
  .digest("hex").toUpperCase();

test("pre-cutover evidence gate freezes the sanitized V1 corpus and accepts an allowlisted receipt", async () => {
  const result = await runGate({
    contract: "dex.memory.precutover.evidence.v0",
    evidence_type: "finder-v1-replay",
    status: "PASS",
    corpus_id: "v1-synthetic-daily-memory-v0",
    corpus_contract_sha256: corpusContractSha256,
    oracle_sha256: "A".repeat(64),
    query_count: 3,
    result_count: 6,
    result_layers: ["L1", "L2"],
    exit_code: 0,
    warnings_count: 0,
    no_shrink: true
  });

  assert.equal(result.exitCode, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, "VALID");
  assert.equal(receipt.query_count, 3);
  assert.equal(receipt.schema_closed, true);
  assert.equal(receipt.redaction_scan, "PASS");
});

test("pre-cutover evidence gate rejects private fields and path-like values fail-closed", async () => {
  const result = await runGate({
    contract: "dex.memory.precutover.evidence.v0",
    evidence_type: "finder-v1-replay",
    status: "PASS",
    corpus_id: "v1-synthetic-daily-memory-v0",
    corpus_contract_sha256: corpusContractSha256,
    oracle_sha256: "B".repeat(64),
    query_count: 3,
    result_count: 6,
    result_layers: ["L1", "L2"],
    exit_code: 0,
    warnings_count: 0,
    no_shrink: true,
    snippet: "private payload",
    source_path: "C:\\Users\\Administrator\\.agents\\memories\\private.md"
  });

  assert.equal(result.exitCode, 4);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, "EVIDENCE_REDACTION_BLOCKED");
  assert.equal(result.stdout, "");
});

test("pre-cutover evidence gate rejects semantically failed evidence", async () => {
  for (const override of [
    { status: "FAIL" },
    { exit_code: 9 },
    { warnings_count: 7 },
    { no_shrink: false },
    { result_count: 0 },
    { result_count: 1, result_layers: [] }
  ]) {
    const result = await runGate({
      contract: "dex.memory.precutover.evidence.v0",
      evidence_type: "finder-v1-replay",
      status: "PASS",
      corpus_id: "v1-synthetic-daily-memory-v0",
      corpus_contract_sha256: corpusContractSha256,
      oracle_sha256: "C".repeat(64),
      query_count: 3,
      result_count: 6,
      result_layers: ["L1", "L2"],
      exit_code: 0,
      warnings_count: 0,
      no_shrink: true,
      ...override
    });
    assert.equal(result.exitCode, 4, JSON.stringify(override));
    assert.equal(JSON.parse(result.stderr).code, "EVIDENCE_PROOF_FAILED");
  }
});

function runGate(document) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [gatePath], {
      cwd: repoRoot,
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
    child.stdin.end(`${JSON.stringify(document)}\n`);
  });
}
