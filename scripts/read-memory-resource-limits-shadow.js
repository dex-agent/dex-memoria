#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readCanonicalJson(filePath, label) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error(`${label} contains BOM`);
  const text = bytes.toString("utf8");
  if (text.includes("\r")) throw new Error(`${label} contains CRLF`);
  const value = JSON.parse(text);
  const canonical = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (!bytes.equals(canonical)) throw new Error(`${label} is not canonical`);
  return { bytes, value };
}

function assertFile(root, metadata, label) {
  const bytes = fs.readFileSync(path.join(root, ...metadata.path.split("/")));
  if (bytes.length !== metadata.bytes || sha256(bytes) !== metadata.sha256) throw new Error(`${label} integrity mismatch`);
  return bytes;
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join("|") !== expected.join("|")) throw new Error(`${label} keys mismatch`);
}

function main() {
  if (process.argv.length !== 3 || !process.argv[2]) throw new Error("usage: read-memory-resource-limits-shadow.js <contracts/policies>");
  const bundleRoot = path.resolve(process.argv[2]);
  const provenanceResult = readCanonicalJson(path.join(bundleRoot, "generated", "dex.memory.resource-limits.provenance.v1.json"), "provenance");
  const provenance = provenanceResult.value;
  assertExactKeys(provenance, ["contract", "version", "authority_state", "effective", "policy", "schema", "generated"], "provenance");
  assertExactKeys(provenance.generated, ["node_bootstrap", "powershell_bootstrap"], "provenance.generated");
  for (const [label, metadata, expectedPath] of [
    ["policy", provenance.policy, "dex.memory.resource-limits.v1.json"],
    ["schema", provenance.schema, "dex.memory.resource-limits.v1.schema.json"],
    ["Node bootstrap", provenance.generated.node_bootstrap, "generated/dex.memory.resource-limits.bootstrap.node.v1.cjs"],
    ["PowerShell bootstrap", provenance.generated.powershell_bootstrap, "generated/dex.memory.resource-limits.bootstrap.powershell.v1.ps1"]
  ]) {
    assertExactKeys(metadata, ["path", "bytes", "sha256"], `${label} metadata`);
    if (metadata.path !== expectedPath) throw new Error(`${label} path mismatch`);
  }
  if (provenance.contract !== "dex.memory.resource-limits.provenance.v1" || provenance.version !== 1 || provenance.authority_state !== "SHADOW" || provenance.effective !== false) throw new Error("provenance identity mismatch");
  assertFile(bundleRoot, provenance.generated.node_bootstrap, "Node bootstrap provenance");
  const bootstrapPath = path.join(bundleRoot, "generated", "dex.memory.resource-limits.bootstrap.node.v1.cjs");
  delete require.cache[require.resolve(bootstrapPath)];
  const bootstrap = require(bootstrapPath);
  assertExactKeys(bootstrap, ["contract", "version", "authority_state", "effective", "bootstrap_ceiling", "policy_path", "policy_bytes", "policy_sha256", "schema_path", "schema_bytes", "schema_sha256"], "bootstrap");
  if (bootstrap.contract !== "dex.memory.resource-limits.bootstrap.v1" || bootstrap.version !== 1 || bootstrap.authority_state !== "SHADOW" || bootstrap.effective !== false || bootstrap.bootstrap_ceiling !== null) throw new Error("bootstrap identity mismatch");
  if (bootstrap.policy_path !== provenance.policy.path || bootstrap.schema_path !== provenance.schema.path) throw new Error("bootstrap path mismatch");
  if (bootstrap.policy_bytes !== provenance.policy.bytes || bootstrap.policy_sha256 !== provenance.policy.sha256 || bootstrap.schema_bytes !== provenance.schema.bytes || bootstrap.schema_sha256 !== provenance.schema.sha256) throw new Error("bootstrap metadata mismatch");

  const policyBytes = fs.readFileSync(path.join(bundleRoot, bootstrap.policy_path));
  const schemaBytes = fs.readFileSync(path.join(bundleRoot, bootstrap.schema_path));
  if (policyBytes.length !== bootstrap.policy_bytes || sha256(policyBytes) !== bootstrap.policy_sha256) throw new Error("policy bootstrap integrity mismatch");
  if (schemaBytes.length !== bootstrap.schema_bytes || sha256(schemaBytes) !== bootstrap.schema_sha256) throw new Error("schema bootstrap integrity mismatch");
  const policy = readCanonicalJson(path.join(bundleRoot, bootstrap.policy_path), "policy").value;
  readCanonicalJson(path.join(bundleRoot, bootstrap.schema_path), "schema");

  assertFile(bundleRoot, provenance.policy, "policy provenance");
  assertFile(bundleRoot, provenance.schema, "schema provenance");
  assertFile(bundleRoot, provenance.generated.powershell_bootstrap, "PowerShell bootstrap provenance");
  if (policy.contract !== "dex.memory.resource-limits.v1" || policy.version !== 1 || policy.authority_state !== "SHADOW" || policy.effective !== false || !Array.isArray(policy.limits)) throw new Error("policy identity mismatch");

  process.stdout.write(`${JSON.stringify({
    contract: "dex.memory.resource-limits.shadow-receipt.v1",
    status: "SHADOW_VERIFIED",
    authority_state: "SHADOW",
    effective: false,
    policy_contract: policy.contract,
    policy_version: policy.version,
    policy_sha256: sha256(policyBytes),
    schema_sha256: sha256(schemaBytes),
    limit_count: policy.limits.length
  })}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`RESOURCE_LIMIT_SHADOW_INVALID: ${error.message}\n`);
  process.exitCode = 1;
}
