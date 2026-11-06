"use strict";

const { createHash } = require("node:crypto");
const { lstat, readdir, readFile, realpath } = require("node:fs/promises");
const { dirname, extname, relative, resolve, sep } = require("node:path");

const CAPABILITIES = Object.freeze({
  "legacy-obsidian": Object.freeze({ require_obsidian: true }),
  "v2-markdown": Object.freeze({ require_obsidian: false }),
  "v2-obsidian": Object.freeze({ require_obsidian: true })
});

const OBSERVABLE_BACKLINKS = Object.freeze([
  "L1->L2", "L2->L1", "L1->L3", "L3->L1", "L2->L3", "L3->L2"
]);

function validateMemoryCapability(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input) || !(input.capability in CAPABILITIES)) {
    return result(input?.capability, input?.require_obsidian, [{
      code: "UNKNOWN_CAPABILITY",
      message: "capability must be legacy-obsidian, v2-markdown or v2-obsidian"
    }]);
  }

  const contract = CAPABILITIES[input.capability];
  if (input.capability === "legacy-obsidian" && input.require_obsidian !== true) {
    errors.push({ code: "REQUIRE_OBSIDIAN_REQUIRED", message: "legacy Obsidian preserves RequireObsidian" });
  }
  if (input.capability === "v2-markdown" && input.require_obsidian === true) {
    errors.push({ code: "CAPABILITY_UNSUPPORTED", message: "V2 Markdown does not claim Obsidian parity" });
  }
  if (input.capability === "v2-markdown") {
    requireArray(input.markdown_links, "markdown_links", errors);
    if (requireArray(input.unresolved_markdown_links, "unresolved_markdown_links", errors) && input.unresolved_markdown_links.length > 0) {
      errors.push({ code: "UNRESOLVED_MARKDOWN_LINK", message: "V2 Markdown contains unresolved Markdown links" });
    }
  }
  if (input.capability === "v2-obsidian") {
    if (input.require_obsidian !== true) {
      errors.push({ code: "REQUIRE_OBSIDIAN_REQUIRED", message: "V2 Obsidian receipts require require_obsidian=true" });
    }
    const blockIdsValid = requireArray(input.block_ids, "block_ids", errors);
    requireNonEmptyArray(input.markdown_links, "markdown_links", errors);
    requireNonEmptyArray(input.wikilinks, "wikilinks", errors);
    const backlinksValid = requireArray(input.backlinks, "backlinks", errors);
    const unresolvedMarkdownValid = requireArray(input.unresolved_markdown_links, "unresolved_markdown_links", errors);
    const unresolvedWikiValid = requireArray(input.unresolved_wikilinks, "unresolved_wikilinks", errors);

    if (blockIdsValid) {
      const normalized = input.block_ids.map((blockId) => typeof blockId === "string" ? blockId.toLowerCase() : blockId);
      if (new Set(normalized).size !== normalized.length) {
        errors.push({ code: "DUPLICATE_BLOCK_ID", message: "V2 Obsidian block ids must be unique" });
      } else if (input.block_ids.some((blockId) => typeof blockId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blockId))) {
        errors.push({ code: "INVALID_BLOCK_ID", message: "V2 Obsidian block ids must be stable lowercase identifiers" });
      }
    }
    if (unresolvedMarkdownValid && input.unresolved_markdown_links.length > 0) {
      errors.push({ code: "UNRESOLVED_MARKDOWN_LINK", message: "V2 Obsidian contains unresolved Markdown links" });
    }
    if (unresolvedWikiValid && input.unresolved_wikilinks.length > 0) {
      errors.push({ code: "UNRESOLVED_WIKILINK", message: "V2 Obsidian contains unresolved wikilinks" });
    }
    if (backlinksValid) {
      const requiredBacklinks = Array.isArray(input.required_backlinks)
        ? input.required_backlinks
        : deriveRequiredBacklinks(input.backlinks);
      const missing = requiredBacklinks.filter((edge) => !input.backlinks.includes(edge));
      if (missing.length > 0) {
        errors.push({ code: "MISSING_BACKLINK", message: `V2 Obsidian is missing backlinks: ${missing.join(", ")}` });
      }
    }
  }

  return result(input.capability, input.require_obsidian, errors, contract);
}

function deriveRequiredBacklinks(backlinks) {
  const observed = new Set(backlinks);
  const required = [];
  const hasDirectL3 = observed.has("L1->L3") || observed.has("L3->L1");
  const hasL2 = observed.has("L1->L2") || observed.has("L2->L1")
    || observed.has("L2->L3") || observed.has("L3->L2");
  const hasNestedL3 = observed.has("L2->L3") || observed.has("L3->L2");

  if (hasL2 || !hasDirectL3) required.push("L1->L2", "L2->L1");
  if (hasDirectL3) required.push("L1->L3", "L3->L1");
  if (hasNestedL3) required.push("L2->L3", "L3->L2");
  return required;
}

async function validateMemoryCapabilityRoot(input) {
  if (input?.capability === "legacy-obsidian") {
    return validateMemoryCapability(input);
  }

  let evidence;
  try {
    evidence = await inspectV2CapabilityRoot(input?.root);
  } catch (error) {
    const receipt = result(input?.capability, input?.require_obsidian, [{
      code: "FILESYSTEM_VALIDATION_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }], CAPABILITIES[input?.capability]);
    return { ...receipt, resolved_root: input?.root, touched_files: [], evidence: emptyEvidence() };
  }

  const receipt = validateMemoryCapability({
    capability: input?.capability,
    require_obsidian: input?.require_obsidian,
    block_ids: evidence.block_ids,
    markdown_links: evidence.markdown_links,
    wikilinks: evidence.wikilinks,
    backlinks: evidence.backlinks,
    unresolved_markdown_links: evidence.unresolved_markdown_links,
    unresolved_wikilinks: evidence.unresolved_wikilinks,
    required_backlinks: evidence.required_backlinks
  });
  const orphanL1Errors = [
    ...evidence.unresolved_markdown_links,
    ...evidence.unresolved_wikilinks
  ]
    .filter((label) => label.toLowerCase().startsWith("lembranca.md -> "))
    .map((label) => ({
      code: "ORPHAN_L1_LINE",
      message: `L1 line points to a missing destination: ${label}`
    }));
  return {
    ...receipt,
    ok: receipt.ok && orphanL1Errors.length === 0,
    errors: [...receipt.errors, ...orphanL1Errors],
    resolved_root: evidence.root,
    touched_files: evidence.files,
    evidence
  };
}

async function validateMemoryCapabilityUnit(input) {
  let evidence;
  try {
    evidence = await inspectV2CapabilityUnit(input?.root, input?.touched_paths);
  } catch (error) {
    const receipt = result(input?.capability, input?.require_obsidian, [{
      code: "FILESYSTEM_VALIDATION_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }], CAPABILITIES[input?.capability]);
    return { ...receipt, resolved_root: input?.root, touched_files: [], evidence: emptyEvidence() };
  }
  const receipt = validateMemoryCapability({
    capability: input?.capability,
    require_obsidian: input?.require_obsidian,
    block_ids: evidence.block_ids,
    markdown_links: evidence.markdown_links,
    wikilinks: evidence.wikilinks,
    backlinks: evidence.backlinks,
    unresolved_markdown_links: evidence.unresolved_markdown_links,
    unresolved_wikilinks: evidence.unresolved_wikilinks,
    required_backlinks: evidence.required_backlinks
  });
  const tagErrors = [];
  for (const file of evidence.files) {
    if (!Array.isArray(file.tags) || file.tags.length === 0) {
      tagErrors.push({ code: "MISSING_NESTED_TAG", message: `${file.path} must expose at least one nested lowercase tag` });
    }
    for (const tag of file.tags || []) {
      if (!/^#[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(tag)) {
        tagErrors.push({ code: "INVALID_TAG", message: `${file.path} contains invalid tag ${tag}` });
      }
    }
  }
  if (tagErrors.length === 0) {
    const canonicalTagSets = evidence.files.map((file) => [...file.tags].sort());
    const expectedTagSet = JSON.stringify(canonicalTagSets[0]);
    if (canonicalTagSets.some((tags) => JSON.stringify(tags) !== expectedTagSet)) {
      tagErrors.push({
        code: "DIVERGENT_TAG_SET",
        message: "L1 and destination must expose the same nested tag set"
      });
    }
  }
  return {
    ...receipt,
    ok: receipt.ok && tagErrors.length === 0,
    errors: [...receipt.errors, ...tagErrors],
    contract: "dex.memory.capability.unit-receipt.v2",
    resolved_root: evidence.root,
    touched_files: evidence.files,
    evidence,
    warnings: ["cross-unit block-id collision audit is separate from this write-unit verdict"]
  };
}

async function inspectV2CapabilityRoot(rootPath) {
  if (typeof rootPath !== "string" || rootPath.trim() === "") {
    throw new Error("root must be a non-empty filesystem path");
  }
  const root = await realpath(resolve(rootPath));
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("root must be a real directory, not a symbolic link");
  }

  const markdownFiles = await collectV2MarkdownFiles(root);
  return inspectV2CapabilityFiles(root, markdownFiles);
}

async function inspectV2CapabilityUnit(rootPath, touchedPaths) {
  if (typeof rootPath !== "string" || rootPath.trim() === "") throw new Error("root must be a non-empty filesystem path");
  if (!Array.isArray(touchedPaths) || touchedPaths.length !== 2) throw new Error("touched_paths must contain exactly L1 and one destination");
  const root = await realpath(resolve(rootPath));
  const markdownFiles = [];
  for (const relativePath of touchedPaths) {
    if (typeof relativePath !== "string" || relativePath.trim() === "") throw new Error("touched path is invalid");
    const filePath = resolve(root, ...portablePath(relativePath).split("/"));
    if (!isContained(root, filePath)) throw new Error("touched path escapes the V2 root");
    const info = await lstat(filePath);
    if (!info.isFile() || info.isSymbolicLink() || extname(filePath).toLowerCase() !== ".md") {
      throw new Error(`touched path is not a plain Markdown file: ${relativePath}`);
    }
    markdownFiles.push(filePath);
  }
  if (!touchedPaths.map((entry) => portablePath(entry).toLowerCase()).includes("lembranca.md")) {
    throw new Error("touched_paths must include lembranca.md");
  }
  return inspectV2CapabilityFiles(root, markdownFiles, new Set(touchedPaths.map((entry) => portablePath(entry).toLowerCase())));
}

async function inspectV2CapabilityFiles(root, markdownFiles, unitPaths = null) {
  const unitDestination = unitPaths ? Array.from(unitPaths).find((entry) => entry !== "lembranca.md") : null;
  const documents = new Map();
  const files = [];
  const blockIds = [];
  for (const filePath of markdownFiles) {
    const fileBytes = await readFile(filePath);
    const content = fileBytes.toString("utf8");
    const relativePath = portablePath(relative(root, filePath));
    const unitSlug = unitDestination?.match(/(?:memorias\/([^/]+)\.md|conhecimento\/([^/]+)\/readme\.md)$/i)?.slice(1).find(Boolean);
    const tagContent = unitDestination && relativePath.toLowerCase() === "lembranca.md"
      ? content.split(/\r?\n/).filter((line) => line.toLowerCase().endsWith(`^${unitSlug?.toLowerCase()}`)).join("\n")
      : content;
    const documentTags = Array.from(
      tagContent.matchAll(/(?:^|[\s"])(#[A-Za-z0-9][A-Za-z0-9_/-]*\/[A-Za-z0-9_/-]*)(?=$|[\s"])/g),
      (match) => match[1]
    );
    let documentBlockIds = extractMatches(content, /\^([A-Za-z0-9][A-Za-z0-9_-]*)\s*$/gm);
    if (unitDestination && relativePath.toLowerCase() === "lembranca.md") {
      documentBlockIds = documentBlockIds.filter((blockId) => blockId.toLowerCase() === unitSlug?.toLowerCase());
    }
    const headingIds = extractHeadingIds(content);
    documents.set(relativePath.toLowerCase(), {
      content,
      blockIds: new Set(documentBlockIds.map((value) => value.toLowerCase())),
      headingIds: new Set(headingIds.map((value) => value.toLowerCase()))
    });
    blockIds.push(...documentBlockIds);
    files.push({
      path: relativePath,
      sha256: createHash("sha256").update(fileBytes).digest("hex"),
      tags: [...new Set(documentTags)]
    });
  }

  const markdownLinks = [];
  const wikilinks = [];
  const unresolvedMarkdownLinks = [];
  const unresolvedWikilinks = [];
  const observedBacklinks = new Set();
  for (const filePath of markdownFiles) {
    const sourcePath = portablePath(relative(root, filePath));
    const content = documents.get(sourcePath.toLowerCase()).content;
    for (const match of content.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim();
      if (unitDestination && !isUnitRelation(sourcePath, target, unitDestination)) continue;
      if (unitDestination === null && isLegacyV1LinkTarget(sourcePath, target)) continue;
      const label = `${sourcePath} -> ${target}`;
      markdownLinks.push(label);
      const resolvedTarget = resolveMemoryLink(root, sourcePath, target, false, documents);
      if (!resolvedTarget.resolved) unresolvedMarkdownLinks.push(label);
      addObservedBacklink(observedBacklinks, sourcePath, resolvedTarget.path);
    }
    for (const match of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const target = match[1].trim();
      if (unitDestination && !isUnitRelation(sourcePath, target, unitDestination)) continue;
      if (unitDestination === null && isLegacyV1LinkTarget(sourcePath, target)) continue;
      const label = `${sourcePath} -> [[${target}]]`;
      wikilinks.push(label);
      const resolvedTarget = resolveMemoryLink(root, sourcePath, target, true, documents);
      if (!resolvedTarget.resolved) unresolvedWikilinks.push(label);
      addObservedBacklink(observedBacklinks, sourcePath, resolvedTarget.path);
    }
  }

  const presentLayers = new Set(files.map((file) => memoryLayer(file.path)));
  const requiredBacklinks = [];
  if (presentLayers.has("L2")) requiredBacklinks.push("L1->L2", "L2->L1");
  if (presentLayers.has("L3")) {
    const l2OwnsL3 = observedBacklinks.has("L2->L3") || observedBacklinks.has("L3->L2");
    requiredBacklinks.push(...(l2OwnsL3 ? ["L2->L3", "L3->L2"] : ["L1->L3", "L3->L1"]));
  }
  return {
    root,
    files,
    block_ids: blockIds,
    markdown_links: markdownLinks,
    wikilinks,
    backlinks: OBSERVABLE_BACKLINKS.filter((edge) => observedBacklinks.has(edge)),
    required_backlinks: requiredBacklinks,
    unresolved_markdown_links: unresolvedMarkdownLinks,
    unresolved_wikilinks: unresolvedWikilinks
  };
}

function isUnitRelation(sourcePath, rawTarget, unitDestination) {
  const normalizedSource = portablePath(sourcePath).toLowerCase();
  const normalizedTarget = rawTarget.split("#", 1)[0].replace(/^\.\//, "").replace(/\.md$/i, "").toLowerCase();
  if (normalizedSource === "lembranca.md") {
    return normalizedTarget === unitDestination.replace(/\.md$/i, "").toLowerCase();
  }
  return /(?:^|\/)lembranca$/.test(normalizedTarget.replace(/^\.\.\//, "").replace(/^\.\.\//, ""));
}

function isLegacyV1LinkTarget(sourcePath, rawTarget) {
  const clean = rawTarget
    .split("#", 1)[0]
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/^(?:\.\.\/)+/, "")
    .replace(/^\.\//, "");
  const segments = clean.split("/").filter(Boolean);
  const last = segments[segments.length - 1]?.toLowerCase();
  if (!last) return false;
  if (last === "memoria") return true;
  if (last === "lembranca" && segments.length > 1) return true;
  if (segments[0]?.toLowerCase() === "conhecimento" && segments.length === 2) return true;
  if (portablePath(sourcePath).toLowerCase() === "conhecimento/index.md" && segments.length === 1) {
    return true;
  }
  return false;
}

async function collectV2MarkdownFiles(root) {
  const files = [];
  await addPlainMarkdownIfPresent(root, resolve(root, "lembranca.md"), files);

  const l2Root = resolve(root, "memorias");
  for (const entry of await readV2Directory(root, l2Root)) {
    const entryPath = resolve(l2Root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic links are not supported: ${portablePath(relative(root, entryPath))}`);
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") files.push(entryPath);
  }

  const l3Root = resolve(root, "conhecimento");
  for (const entry of await readV2Directory(root, l3Root)) {
    const entryPath = resolve(l3Root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic links are not supported: ${portablePath(relative(root, entryPath))}`);
    if (entry.isFile() && entry.name.toLowerCase() === "index.md") files.push(entryPath);
    if (entry.isDirectory()) {
      await addPlainMarkdownIfPresent(root, resolve(entryPath, "README.md"), files);
    }
  }
  return files.sort((left, right) => portablePath(relative(root, left)).localeCompare(portablePath(relative(root, right))));
}

async function readV2Directory(root, directory) {
  if (!isContained(root, directory)) throw new Error("filesystem traversal escaped the V2 root");
  let directoryInfo;
  try {
    directoryInfo = await lstat(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error(`V2 layer root must be a real directory: ${portablePath(relative(root, directory))}`);
  }
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

async function addPlainMarkdownIfPresent(root, filePath, files) {
  if (!isContained(root, filePath)) throw new Error("filesystem traversal escaped the V2 root");
  let fileInfo;
  try {
    fileInfo = await lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (!fileInfo.isFile() || fileInfo.isSymbolicLink() || extname(filePath).toLowerCase() !== ".md") {
    throw new Error(`V2 surface must be a plain Markdown file: ${portablePath(relative(root, filePath))}`);
  }
  files.push(filePath);
}

function resolveMemoryLink(root, sourcePath, rawTarget, isWikilink, documents) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rawTarget)) return { resolved: true, path: null };
  const [rawFilePart, rawFragment = ""] = rawTarget.replace(/^<|>$/g, "").split("#", 2);
  const sourceAbsolutePath = resolve(root, ...sourcePath.split("/"));
  const basePath = isWikilink && !rawFilePart.startsWith(".")
    ? resolve(root, ...rawFilePart.split("/"))
    : resolve(dirname(sourceAbsolutePath), ...rawFilePart.split("/"));
  const candidates = rawFilePart === ""
    ? [sourceAbsolutePath]
    : [basePath, `${basePath}.md`, resolve(basePath, "README.md")];
  for (const candidate of candidates) {
    if (!isContained(root, candidate)) continue;
    const candidatePath = portablePath(relative(root, candidate));
    const document = documents.get(candidatePath.toLowerCase());
    if (!document) continue;
    if (rawFragment === "") return { resolved: true, path: candidatePath };
    const fragment = decodeURIComponent(rawFragment).toLowerCase();
    const fragmentResolved = fragment.startsWith("^")
      ? document.blockIds.has(fragment.slice(1))
      : document.blockIds.has(fragment) || document.headingIds.has(fragment);
    return { resolved: fragmentResolved, path: fragmentResolved ? candidatePath : null };
  }
  return { resolved: false, path: null };
}

function addObservedBacklink(observedBacklinks, sourcePath, targetPath) {
  if (!targetPath) return;
  const sourceLayer = memoryLayer(sourcePath);
  const targetLayer = memoryLayer(targetPath);
  const edge = `${sourceLayer}->${targetLayer}`;
  if (OBSERVABLE_BACKLINKS.includes(edge)) observedBacklinks.add(edge);
}

function memoryLayer(filePath) {
  const normalized = portablePath(filePath).toLowerCase();
  if (normalized === "lembranca.md") return "L1";
  if (/^memorias\/[^/]+\.md$/.test(normalized) && !normalized.endsWith("/index.md")) return "L2";
  if (/^conhecimento\/[^/]+\/readme\.md$/.test(normalized)) return "L3";
  return "Other";
}

function extractMatches(content, pattern) {
  return Array.from(content.matchAll(pattern), (match) => match[1]);
}

function extractHeadingIds(content) {
  const headings = [];
  for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const explicit = match[1].match(/\{#([A-Za-z0-9][A-Za-z0-9_-]*)\}\s*$/);
    if (explicit) headings.push(explicit[1]);
    const generated = match[1]
      .replace(/\{#[^}]+\}\s*$/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    if (generated) headings.push(generated);
  }
  return headings;
}

function isContained(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== "..");
}

function portablePath(filePath) {
  return filePath.split(sep).join("/");
}

function emptyEvidence() {
  return {
    files: [],
    block_ids: [],
    markdown_links: [],
    wikilinks: [],
    backlinks: [],
    required_backlinks: [],
    unresolved_markdown_links: [],
    unresolved_wikilinks: []
  };
}

function requireArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push({ code: "INVALID_CAPABILITY_INPUT", message: `${label} must be an array` });
    return false;
  }
  return true;
}

function requireNonEmptyArray(value, label, errors) {
  if (!requireArray(value, label, errors)) return false;
  if (value.length === 0) {
    errors.push({ code: "MISSING_OBSIDIAN_EVIDENCE", message: `${label} must contain observable evidence` });
    return false;
  }
  return true;
}

function result(capability, requireObsidian, errors, contract = null) {
  return {
    contract: "dex.memory.capability.receipt.v2",
    capability,
    require_obsidian: requireObsidian,
    expected_require_obsidian: contract?.require_obsidian,
    ok: errors.length === 0,
    errors
  };
}

module.exports = {
  CAPABILITIES,
  validateMemoryCapability,
  validateMemoryCapabilityRoot,
  validateMemoryCapabilityUnit
};
