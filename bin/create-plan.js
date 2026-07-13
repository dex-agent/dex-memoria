"use strict";

const { createHash } = require("crypto");

function planCreate(request, snapshot, targets) {
  const requestFingerprint = sha256(stableJson(request));
  const blocks = {
    l1: `- [${request.candidate.localizer}] ${request.candidate.trigger} -> [MEMORIA.md#${request.candidate.anchor}]`,
    l2: `## ${request.candidate.title} {#${request.candidate.anchor}}\n\n${request.candidate.body}`
  };
  const plannedTargets = targets.map((relativePath, index) => {
    const slot = index === 0 ? "l1" : "l2";
    const before = snapshot[slot];
    const beforeBytes = Buffer.from(before.bytes_base64, "base64");
    const afterBytes = appendLegacyBlock(beforeBytes, blocks[slot]);
    return {
      slot,
      relative_path: relativePath,
      before_exists: before.exists,
      before_sha256: sha256(beforeBytes),
      before_base64: beforeBytes.toString("base64"),
      after_sha256: sha256(afterBytes),
      after_base64: afterBytes.toString("base64"),
      changed: !beforeBytes.equals(afterBytes)
    };
  });
  const transactionId = sha256(stableJson({
    idempotency_key: request.idempotency_key,
    request_fingerprint: requestFingerprint,
    targets: plannedTargets
  })).slice(0, 24);
  const unsignedPlan = {
    contract: "dex.memory.create.plan.v0",
    operation: "create",
    idempotency_key: request.idempotency_key,
    request,
    request_fingerprint: requestFingerprint,
    transaction_id: transactionId,
    targets: plannedTargets
  };
  return { ...unsignedPlan, plan_hash: sha256(stableJson(unsignedPlan)) };
}

function appendLegacyBlock(existingBytes, block) {
  const normalizedBlock = block.trim();
  const existingText = existingBytes.toString("utf8");
  if (existingText.includes(normalizedBlock)) {
    return Buffer.from(existingBytes);
  }
  const prefix = existingText.trim().length > 0 ? "\n\n" : "";
  return Buffer.concat([existingBytes, Buffer.from(`${prefix}${normalizedBlock}\n`, "utf8")]);
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

module.exports = { planCreate, stableJson };
