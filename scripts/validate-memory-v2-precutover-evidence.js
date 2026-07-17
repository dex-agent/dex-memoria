#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repoRoot, "contracts", "schemas", "dex.memory.precutover.evidence.v0.schema.json");
const corpusPath = path.join(repoRoot, "contracts", "fixtures", "precutover-v1-recall-corpus.v0.json");
const MAX_INPUT_BYTES = 32 * 1024;

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
  if (Buffer.byteLength(raw, "utf8") > MAX_INPUT_BYTES) fail("EVIDENCE_REDACTION_BLOCKED");
});
process.stdin.on("end", main);

function main() {
  try {
    const document = JSON.parse(raw);
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const corpusBytes = fs.readFileSync(corpusPath);
    const corpus = JSON.parse(corpusBytes.toString("utf8"));
    const corpusContractSha256 = sha256(corpusBytes);
    validateClosedDocument(document, schema, corpus, corpusContractSha256);
    const receipt = {
      contract: "dex.memory.precutover.evidence-gate.v0",
      status: "VALID",
      evidence_type: document.evidence_type,
      corpus_id: document.corpus_id,
      corpus_contract_sha256: corpusContractSha256,
      oracle_sha256: document.oracle_sha256,
      query_count: document.query_count,
      result_count: document.result_count,
      result_layers: [...document.result_layers].sort(),
      exit_code: document.exit_code,
      warnings_count: document.warnings_count,
      no_shrink: document.no_shrink,
      schema_closed: schema.additionalProperties === false,
      redaction_scan: "PASS"
    };
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    fail(error.code || "EVIDENCE_REDACTION_BLOCKED");
  }
}

function validateClosedDocument(document, schema, corpus, corpusContractSha256) {
  if (!document || Array.isArray(document) || typeof document !== "object") throw blocked();
  const allowed = new Set(Object.keys(schema.properties));
  if (Object.keys(document).some((key) => !allowed.has(key))) throw blocked();
  if (schema.required.some((key) => !Object.hasOwn(document, key))) throw blocked();
  if (document.contract !== schema.properties.contract.const) throw blocked();
  if (!schema.properties.evidence_type.enum.includes(document.evidence_type)) throw blocked();
  if (!schema.properties.status.enum.includes(document.status)) throw blocked();
  if (document.corpus_id !== corpus.corpus_id || corpus.synthetic !== true || corpus.sensitive !== false) throw blocked();
  if (document.corpus_contract_sha256 !== corpusContractSha256) throw blocked();
  if (!/^[A-F0-9]{64}$/.test(document.oracle_sha256)) throw blocked();
  for (const key of ["query_count", "result_count", "warnings_count"]) {
    if (!Number.isInteger(document[key]) || document[key] < 0) throw blocked();
  }
  if (!Number.isInteger(document.exit_code) || typeof document.no_shrink !== "boolean") throw blocked();
  if (!Array.isArray(document.result_layers) || document.result_layers.some((layer) => !["L1", "L2", "L3"].includes(layer))) throw blocked();
  if (document.evidence_type === "finder-v1-replay") {
    const expectedResultCount = corpus.queries.length * corpus.oracle.result_count_per_query;
    if (
      document.query_count !== corpus.queries.length ||
      document.result_count !== expectedResultCount ||
      JSON.stringify([...document.result_layers].sort()) !== JSON.stringify([...corpus.oracle.layers].sort())
    ) throw Object.assign(new Error("Finder replay diverged from the frozen corpus oracle"), { code: "EVIDENCE_PROOF_FAILED" });
  }
  scanStrings(document);
  if (
    document.status !== "PASS" ||
    document.exit_code !== 0 ||
    document.warnings_count !== 0 ||
    document.no_shrink !== true ||
    document.result_count < 1
  ) {
    throw Object.assign(new Error("evidence did not satisfy the promotion oracle"), { code: "EVIDENCE_PROOF_FAILED" });
  }
}

function scanStrings(value) {
  if (typeof value === "string") {
    if (/\r|\n|\[\[|(^|\s)#{1,6}\s|[A-Za-z]:[\\/]|(?:^|[\\/])Users[\\/]|\.agents[\\/]|memories[\\/]/i.test(value)) throw blocked();
    return;
  }
  if (Array.isArray(value)) return value.forEach(scanStrings);
  if (value && typeof value === "object") Object.values(value).forEach(scanStrings);
}

function blocked() {
  return Object.assign(new Error("evidence contains non-allowlisted or private material"), { code: "EVIDENCE_REDACTION_BLOCKED" });
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function fail(code) {
  process.stderr.write(`${JSON.stringify({ contract: "dex.memory.precutover.evidence-error.v0", status: "BLOCKED", code })}\n`);
  process.exit(4);
}
