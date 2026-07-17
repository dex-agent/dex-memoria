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

function planThemeV2(request, snapshot, targets) {
  const canonicalRequest = sortValue(request);
  const requestFingerprint = sha256(stableJson(canonicalRequest));
  const theme = themeFromL1Target(targets[0]);
  const targetDirectory = request.target_layer === "L2" ? "memorias" : "conhecimento";
  const destinationLink = request.target_layer === "L2"
    ? `${targetDirectory}/${request.slug}.md`
    : `${targetDirectory}/${request.slug}/README.md`;
  const indexLink = request.target_layer === "L2"
    ? `${request.slug}.md`
    : `${request.slug}/README.md`;
  const routeMetadata = stableJson({
    identity: request.identity,
    layer: request.target_layer,
    slug: request.slug,
    updated_at: request.created_at,
    last_reused_at: null,
    reuse_count: 0
  });
  const l1Block = `- [${escapeMarkdownLabel(request.trigger)}](${destinationLink}) #${theme} <!-- dex.memory.route.v1 ${routeMetadata} -->`;
  const candidateIndexEntry = {
    identity: request.identity,
    layer: request.target_layer,
    slug: request.slug,
    title: request.title,
    link: indexLink
  };
  const indexBytes = renderIndex(request.target_layer, [...(snapshot.index_entries || []), candidateIndexEntry]);
  const destinationBytes = renderDestination(request);
  const afterBySlot = {
    l1: appendBlock(Buffer.from(snapshot.l1.bytes_base64, "base64"), l1Block),
    index: indexBytes,
    destination: destinationBytes
  };
  const slots = ["l1", "index", "destination"];
  const plannedTargets = targets.map((relativePath, index) => {
    const slot = slots[index];
    const before = snapshot[slot];
    const beforeBytes = Buffer.from(before.bytes_base64, "base64");
    const afterBytes = afterBySlot[slot];
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
  const unsignedPlan = {
    contract: "dex.memory.create.theme-v2.plan.v0",
    profile: "governed-theme-v2",
    operation: "create",
    idempotency_key: request.idempotency_key,
    request: canonicalRequest,
    request_fingerprint: requestFingerprint,
    serialization_order_only: true,
    targets: plannedTargets
  };
  return { ...unsignedPlan, plan_hash: sha256(stableJson(unsignedPlan)) };
}

function themeFromL1Target(relativePath) {
  const match = relativePath?.match(/^work\/([a-z0-9]+(?:-[a-z0-9]+)*)\/lembranca\.md$/);
  if (!match) throw new Error("V2 L1 target does not contain a canonical theme");
  return match[1];
}

function renderDestination(request) {
  const metadata = [
    "---",
    "dex_memory: governed-theme-v2",
    "contract_version: 1",
    `identity: ${request.identity}`,
    `layer: ${request.target_layer}`,
    `slug: ${request.slug}`,
    `created_at: ${request.created_at}`,
    `updated_at: ${request.created_at}`,
    "last_reused_at: null",
    "reuse_count: 0"
  ];
  if (request.target_layer === "L3") metadata.push(`owner_skill: ${request.owner_skill}`);
  metadata.push("---");
  const backlink = request.target_layer === "L2" ? "../lembranca.md" : "../../lembranca.md";
  const body = normalizeLf(request.body).trim();
  return Buffer.from(`${metadata.join("\n")}\n\n# ${normalizeLf(request.title).trim()}\n\n${body}\n\nL1 relacionada: [${backlink}](${backlink})\n`, "utf8");
}

function renderIndex(layer, entries) {
  const header = layer === "L2" ? "# Memórias" : "# Conhecimento";
  const unique = new Map();
  for (const entry of entries) unique.set(entry.identity, entry);
  const ordered = [...unique.values()].sort(compareIndexEntries);
  const lines = ordered.map((entry) => {
    const metadata = stableJson({ identity: entry.identity, layer: entry.layer, slug: entry.slug });
    return `- [${escapeMarkdownLabel(entry.title)}](${entry.link}) <!-- dex.memory.index-entry.v1 ${metadata} -->`;
  });
  return Buffer.from(`${header}\n${lines.length ? `\n${lines.join("\n")}\n` : ""}`, "utf8");
}

function compareIndexEntries(first, second) {
  const firstKey = `${first.slug}\u0000${first.identity}`;
  const secondKey = `${second.slug}\u0000${second.identity}`;
  return firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0;
}

function appendBlock(existingBytes, block) {
  const existingText = normalizeLf(existingBytes.toString("utf8"));
  if (existingText.split("\n").includes(block)) return Buffer.from(existingBytes);
  const prefix = existingText.trim().length > 0 ? (existingText.endsWith("\n") ? "\n" : "\n\n") : "";
  return Buffer.from(`${existingText}${prefix}${block}\n`, "utf8");
}

function escapeMarkdownLabel(value) {
  return normalizeLf(value).replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function normalizeLf(value) {
  return value.replace(/\r\n?/g, "\n");
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

module.exports = { planCreate, planThemeV2, stableJson };
