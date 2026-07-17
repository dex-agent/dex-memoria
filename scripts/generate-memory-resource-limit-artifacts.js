#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const POLICY_FILE = "dex.memory.resource-limits.v1.json";
const SCHEMA_FILE = "dex.memory.resource-limits.v1.schema.json";
const GENERATED_DIR = "generated";
const NODE_BOOTSTRAP = "dex.memory.resource-limits.bootstrap.node.v1.cjs";
const POWERSHELL_BOOTSTRAP = "dex.memory.resource-limits.bootstrap.powershell.v1.ps1";
const PROVENANCE_FILE = "dex.memory.resource-limits.provenance.v1.json";
const POLICY_KEYS = ["$schema", "contract", "version", "authority_state", "effective", "owner", "limits"];
const LIMIT_REQUIRED_KEYS = ["limit_id", "value", "unit", "kind", "scope", "profile", "owner", "source_evidence"];
const LIMIT_KEYS = [...LIMIT_REQUIRED_KEYS, "ceiling_limit_id", "duplicate_group"];
const EVIDENCE_REQUIRED_KEYS = ["source_id", "locator", "path", "line"];
const EVIDENCE_KEYS = [...EVIDENCE_REQUIRED_KEYS, "repo_commit"];
const UNITS = new Set(["bytes", "lines", "references", "entries", "packages", "files", "seconds"]);
const KINDS = new Set(["safety_ceiling", "operational_default", "fixture_profile"]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readCanonicalJson(filePath, label) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error(`${label} must not contain UTF-8 BOM`);
  }
  const text = bytes.toString("utf8");
  if (text.includes("\r")) throw new Error(`${label} must use LF line endings`);
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
  if (!bytes.equals(canonicalJson(value))) throw new Error(`${label} is not canonical pretty JSON with terminal LF`);
  return { bytes, value };
}

function assertExactKeys(value, allowed, required, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const keys = Object.keys(value);
  for (const key of required) if (!keys.includes(key)) throw new Error(`${label} is missing ${key}`);
  for (const key of keys) if (!allowed.includes(key)) throw new Error(`${label} has unsupported key ${key}`);
}

function isPortableEvidencePath(sourcePath) {
  if (typeof sourcePath !== "string") return false;
  const portableSegments = "[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*";
  if (new RegExp(`^\\$DEX_MEMORY_HOME/${portableSegments}$`).test(sourcePath)) return true;
  return new RegExp(`^${portableSegments}$`).test(sourcePath) && !sourcePath.split("/").some((segment) => segment === "." || segment === "..");
}

function validatePolicy(policy) {
  assertExactKeys(policy, POLICY_KEYS, POLICY_KEYS, "policy");
  if (policy.contract !== "dex.memory.resource-limits.v1") throw new Error("policy contract mismatch");
  if (policy.version !== 1) throw new Error("policy version mismatch");
  if (policy.authority_state !== "SHADOW" || policy.effective !== false) throw new Error("policy must remain SHADOW and effective=false");
  if (policy.owner !== "dex-memoria") throw new Error("policy owner mismatch");
  if (!Array.isArray(policy.limits) || policy.limits.length === 0) throw new Error("policy limits must be a non-empty array");

  const byId = new Map();
  for (const [index, limit] of policy.limits.entries()) {
    const label = `limits[${index}]`;
    assertExactKeys(limit, LIMIT_KEYS, LIMIT_REQUIRED_KEYS, label);
    if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/.test(limit.limit_id)) throw new Error(`${label} limit_id is invalid`);
    if (byId.has(limit.limit_id)) throw new Error(`duplicate limit_id: ${limit.limit_id}`);
    if (!Number.isSafeInteger(limit.value) || limit.value < 1) throw new Error(`${limit.limit_id} value must be a positive safe integer`);
    if (!UNITS.has(limit.unit)) throw new Error(`${limit.limit_id} unit is invalid`);
    if (!KINDS.has(limit.kind)) throw new Error(`${limit.limit_id} kind is invalid`);
    for (const key of ["scope", "profile", "owner"]) if (typeof limit[key] !== "string" || !limit[key].trim()) throw new Error(`${limit.limit_id} ${key} is required`);
    assertExactKeys(limit.source_evidence, EVIDENCE_KEYS, EVIDENCE_REQUIRED_KEYS, `${label}.source_evidence`);
    const evidence = limit.source_evidence;
    if (!isPortableEvidencePath(evidence.path)) throw new Error(`${limit.limit_id} evidence path must be portable`);
    if (!Number.isSafeInteger(evidence.line) || evidence.line < 1) throw new Error(`${limit.limit_id} evidence line is invalid`);
    for (const key of ["source_id", "locator", "path"]) if (typeof evidence[key] !== "string" || !evidence[key].trim()) throw new Error(`${limit.limit_id} evidence ${key} is required`);
    if (!evidence.path.startsWith("$DEX_MEMORY_HOME/") && !/^[0-9a-f]{40}$/.test(evidence.repo_commit || "")) {
      throw new Error(`${limit.limit_id} repository evidence requires repo_commit`);
    }
    byId.set(limit.limit_id, limit);
  }

  for (const limit of policy.limits) {
    if (!limit.ceiling_limit_id) continue;
    const ceiling = byId.get(limit.ceiling_limit_id);
    if (!ceiling) throw new Error(`${limit.limit_id} references missing ceiling ${limit.ceiling_limit_id}`);
    if (ceiling.kind !== "safety_ceiling") throw new Error(`${limit.limit_id} ceiling must have kind safety_ceiling`);
    if (ceiling.unit !== limit.unit) throw new Error(`${limit.limit_id} ceiling unit mismatch`);
    if (limit.value > ceiling.value) throw new Error(`${limit.limit_id} exceeds ${limit.ceiling_limit_id}`);
  }
}

function collectNumbers(value, result = []) {
  if (typeof value === "number") result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, result));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectNumbers(item, result));
  return result;
}

function validateSchema(schema, policy = null) {
  const text = JSON.stringify(schema);
  if (text.includes('"default"')) throw new Error("schema must not own numeric defaults");
  if (policy) {
    const observedValues = new Set(policy.limits.map((limit) => limit.value));
    const duplicatedValues = collectNumbers(schema).filter((value) => value > 1 && observedValues.has(value));
    if (duplicatedValues.length > 0) throw new Error("schema must not duplicate observed resource values");
  }
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") throw new Error("schema draft mismatch");
  if (schema.type !== "object" || schema.additionalProperties !== false) throw new Error("schema root must be a closed object");
}

function readAndValidateBundleSources(bundleRoot) {
  const policyResult = readCanonicalJson(path.join(bundleRoot, POLICY_FILE), "policy");
  const schemaResult = readCanonicalJson(path.join(bundleRoot, SCHEMA_FILE), "schema");
  validatePolicy(policyResult.value);
  validateSchema(schemaResult.value, policyResult.value);
  return { policy: policyResult, schema: schemaResult };
}

function metadataFor(relativePath, bytes) {
  return { path: relativePath.replace(/\\/g, "/"), bytes: bytes.length, sha256: sha256(bytes) };
}

function nodeBootstrapBytes(policyMeta, schemaMeta) {
  const value = {
    contract: "dex.memory.resource-limits.bootstrap.v1",
    version: 1,
    authority_state: "SHADOW",
    effective: false,
    bootstrap_ceiling: null,
    policy_path: policyMeta.path,
    policy_bytes: policyMeta.bytes,
    policy_sha256: policyMeta.sha256,
    schema_path: schemaMeta.path,
    schema_bytes: schemaMeta.bytes,
    schema_sha256: schemaMeta.sha256
  };
  return Buffer.from(`"use strict";\n\nmodule.exports = Object.freeze(${JSON.stringify(value, null, 2)});\n`, "utf8");
}

function powershellLiteral(value) {
  if (value === null) return "$null";
  if (value === false) return "$false";
  if (value === true) return "$true";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function powershellBootstrapBytes(policyMeta, schemaMeta) {
  const value = {
    contract: "dex.memory.resource-limits.bootstrap.v1",
    version: 1,
    authority_state: "SHADOW",
    effective: false,
    bootstrap_ceiling: null,
    policy_path: policyMeta.path,
    policy_bytes: policyMeta.bytes,
    policy_sha256: policyMeta.sha256,
    schema_path: schemaMeta.path,
    schema_bytes: schemaMeta.bytes,
    schema_sha256: schemaMeta.sha256
  };
  const rows = Object.entries(value).map(([key, item]) => `  ${key} = ${powershellLiteral(item)}`);
  return Buffer.from(["[pscustomobject][ordered]@{", ...rows, "}", ""].join("\n"), "utf8");
}

function renderArtifacts(bundleRoot) {
  const { policy, schema } = readAndValidateBundleSources(bundleRoot);
  const policyMeta = metadataFor(POLICY_FILE, policy.bytes);
  const schemaMeta = metadataFor(SCHEMA_FILE, schema.bytes);
  const nodeBytes = nodeBootstrapBytes(policyMeta, schemaMeta);
  const powershellBytes = powershellBootstrapBytes(policyMeta, schemaMeta);
  const provenance = {
    contract: "dex.memory.resource-limits.provenance.v1",
    version: 1,
    authority_state: "SHADOW",
    effective: false,
    policy: policyMeta,
    schema: schemaMeta,
    generated: {
      node_bootstrap: metadataFor(`${GENERATED_DIR}/${NODE_BOOTSTRAP}`, nodeBytes),
      powershell_bootstrap: metadataFor(`${GENERATED_DIR}/${POWERSHELL_BOOTSTRAP}`, powershellBytes)
    }
  };
  return {
    provenance,
    files: new Map([
      [NODE_BOOTSTRAP, nodeBytes],
      [POWERSHELL_BOOTSTRAP, powershellBytes],
      [PROVENANCE_FILE, canonicalJson(provenance)]
    ])
  };
}

function generate(bundleRoot) {
  const rendered = renderArtifacts(bundleRoot);
  const generatedRoot = path.join(bundleRoot, GENERATED_DIR);
  fs.mkdirSync(generatedRoot, { recursive: true });
  for (const [fileName, bytes] of rendered.files) fs.writeFileSync(path.join(generatedRoot, fileName), bytes);
  return rendered.provenance;
}

function verifyGeneratedArtifacts(bundleRoot) {
  const rendered = renderArtifacts(bundleRoot);
  const generatedRoot = path.join(bundleRoot, GENERATED_DIR);
  for (const [fileName, expectedBytes] of rendered.files) {
    const actualBytes = fs.readFileSync(path.join(generatedRoot, fileName));
    if (!actualBytes.equals(expectedBytes)) throw new Error(`generated artifact is stale: ${fileName}`);
  }
  return rendered.provenance;
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--bundle" || !argv[1]) throw new Error("usage: generate-memory-resource-limit-artifacts.js --bundle <contracts/policies>");
  return path.resolve(argv[1]);
}

if (require.main === module) {
  try {
    const bundleRoot = parseArguments(process.argv.slice(2));
    const provenance = generate(bundleRoot);
    process.stdout.write(`${JSON.stringify({ status: "GENERATED", authority_state: provenance.authority_state, effective: provenance.effective })}\n`);
  } catch (error) {
    process.stderr.write(`RESOURCE_LIMIT_GENERATION_FAILED: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { generate, readAndValidateBundleSources, renderArtifacts, validatePolicy, validateSchema, verifyGeneratedArtifacts };
