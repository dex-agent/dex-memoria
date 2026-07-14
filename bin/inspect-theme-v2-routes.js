"use strict";

const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

const MAX_DOCUMENT_BYTES = 1024 * 1024;
const MAX_ROUTES = 1000;

class RouteInspectionError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

function inspectThemeV2Routes(fixture) {
  const l1Path = path.join(fixture.themeRoot, "lembranca.md");
  const l2IndexPath = path.join(fixture.themeRoot, "memorias", "INDEX.md");
  const l3IndexPath = path.join(fixture.themeRoot, "conhecimento", "INDEX.md");
  const l1Routes = parseL1(readPlainFile(l1Path));
  const indexEntries = [
    ...parseIndex(readPlainFile(l2IndexPath), "L2", fixture.manifest.theme),
    ...parseIndex(readPlainFile(l3IndexPath), "L3", fixture.manifest.theme)
  ];
  const destinations = [
    ...readDestinations(fixture, "L2"),
    ...readDestinations(fixture, "L3")
  ];
  if (l1Routes.length > MAX_ROUTES || indexEntries.length > MAX_ROUTES || destinations.length > MAX_ROUTES) {
    invalid(`route graph exceeds ${MAX_ROUTES} entries`);
  }

  requireUnique(l1Routes, "L1 route");
  requireUnique(indexEntries, "INDEX entry");
  requireUnique(destinations, "destination");
  requireCasefoldSlugUniqueness([...l1Routes, ...indexEntries, ...destinations]);

  const l1ByIdentity = byIdentity(l1Routes);
  const indexByIdentity = byIdentity(indexEntries);
  const destinationByIdentity = byIdentity(destinations);
  const identities = [...new Set([
    ...l1ByIdentity.keys(),
    ...indexByIdentity.keys(),
    ...destinationByIdentity.keys()
  ])].sort();
  if (
    identities.length !== l1Routes.length ||
    identities.length !== indexEntries.length ||
    identities.length !== destinations.length
  ) {
    invalid("L1, INDEX and destination must form a one-to-one route graph");
  }

  const routes = identities.map((identity) => {
    const l1 = l1ByIdentity.get(identity);
    const index = indexByIdentity.get(identity);
    const destination = destinationByIdentity.get(identity);
    if (!l1 || !index || !destination) invalid("route component is orphaned");
    for (const field of ["layer", "slug"]) {
      if (l1[field] !== index[field] || l1[field] !== destination[field]) {
        invalid(`route ${field} diverges between L1, INDEX and destination`);
      }
    }
    if (index.title !== destination.title) invalid("route title diverges between INDEX and destination");
    if (l1.destination !== destination.linkFromTheme) invalid("L1 route points to the wrong destination");
    if (index.link !== destination.linkFromIndex) invalid("INDEX entry points to the wrong destination");
    if (l1.updated_at !== destination.updated_at || l1.last_reused_at !== destination.last_reused_at || l1.reuse_count !== destination.reuse_count) {
      invalid("route lifecycle metadata diverges between L1 and destination");
    }
    const result = {
      identity,
      layer: l1.layer,
      slug: l1.slug,
      title: destination.title,
      trigger: l1.trigger,
      destination_relative_path: destination.relativePath,
      index_relative_path: index.relativePath,
      content_sha256: destination.contentSha256,
      updated_at: destination.updated_at,
      last_reused_at: destination.last_reused_at,
      reuse_count: destination.reuse_count
    };
    if (destination.layer === "L3") result.owner_skill = destination.owner_skill;
    return result;
  }).sort(compareRoutes);

  return {
    contract: "dex.memory.routes.inspect.v0",
    profile: "governed-theme-v2",
    status: "VALID",
    theme: fixture.manifest.theme,
    routes,
    counts: {
      routes: routes.length,
      l1_routes: l1Routes.length,
      index_entries: indexEntries.length,
      destinations: destinations.length,
      l2: routes.filter((route) => route.layer === "L2").length,
      l3: routes.filter((route) => route.layer === "L3").length
    }
  };
}

function parseL1(text) {
  const routes = [];
  for (const line of normalizeLf(text).split("\n")) {
    if (!line.includes("dex.memory.route.v1")) continue;
    const match = line.match(/^- \[(.*)\]\(([^)]+)\) <!-- dex\.memory\.route\.v1 (\{.*\}) -->$/);
    if (!match) invalid("L1 route is not parseable");
    const metadata = parseJsonObject(match[3], "L1 route metadata");
    requireExactKeys(metadata, ["identity", "last_reused_at", "layer", "reuse_count", "slug", "updated_at"], "L1 route metadata");
    validateCoreMetadata(metadata, "L1 route metadata");
    const expected = metadata.layer === "L2"
      ? `memorias/${metadata.slug}.md`
      : `conhecimento/${metadata.slug}/README.md`;
    if (match[2] !== expected) invalid("L1 route path does not match layer and slug");
    routes.push({
      ...metadata,
      trigger: unescapeMarkdownLabel(match[1]),
      destination: match[2]
    });
    const trigger = routes.at(-1).trigger;
    if (!trigger || trigger.length > 512 || /[\r\n\0]/.test(trigger)) invalid("L1 trigger is invalid");
  }
  return routes;
}

function parseIndex(text, layer, theme) {
  const normalized = normalizeLf(text);
  const expectedHeader = layer === "L2" ? "# Memórias" : "# Conhecimento";
  if (normalized.split("\n")[0] !== expectedHeader) invalid(`${layer} INDEX header is invalid`);
  const entries = [];
  for (const line of normalized.split("\n")) {
    if (!line.includes("dex.memory.index-entry.v1")) continue;
    const match = line.match(/^- \[(.*)\]\(([^)]+)\) <!-- dex\.memory\.index-entry\.v1 (\{.*\}) -->$/);
    if (!match) invalid("INDEX entry is not parseable");
    const metadata = parseJsonObject(match[3], "INDEX metadata");
    requireExactKeys(metadata, ["identity", "layer", "slug"], "INDEX metadata");
    validateIdentityLayerSlug(metadata, "INDEX metadata");
    if (metadata.layer !== layer) invalid("INDEX entry is stored in the wrong layer");
    const expectedLink = layer === "L2" ? `${metadata.slug}.md` : `${metadata.slug}/README.md`;
    if (match[2] !== expectedLink) invalid("INDEX link does not match layer and slug");
    entries.push({
      ...metadata,
      title: unescapeMarkdownLabel(match[1]),
      link: match[2],
      relativePath: `work/${theme}/${metadata.layer === "L2" ? "memorias" : "conhecimento"}/INDEX.md`
    });
    const title = entries.at(-1).title;
    if (!title || title.length > 256 || /[\r\n\0]/.test(title)) invalid("INDEX title is invalid");
  }
  return entries;
}

function readDestinations(fixture, layer) {
  const directoryName = layer === "L2" ? "memorias" : "conhecimento";
  const directoryPath = path.join(fixture.themeRoot, directoryName);
  const destinations = [];
  const names = fs.readdirSync(directoryPath).sort();
  if (names.length > MAX_ROUTES + 1) invalid(`route layer exceeds ${MAX_ROUTES} entries`);
  for (const name of names) {
    if (name.toLowerCase() === "index.md") continue;
    const candidatePath = path.join(directoryPath, name);
    const stat = fs.lstatSync(candidatePath);
    if (stat.isSymbolicLink()) invalid("destination must not be a symbolic link or reparse point");
    let documentPath;
    let slugFromPath;
    if (layer === "L2") {
      if (!stat.isFile() || path.extname(name) !== ".md") invalid("L2 destination shape is invalid");
      slugFromPath = path.basename(name, ".md");
      documentPath = candidatePath;
    } else {
      if (!stat.isDirectory()) invalid("L3 destination shape is invalid");
      slugFromPath = name;
      documentPath = path.join(candidatePath, "README.md");
    }
    const bytes = readPlainFileBytes(documentPath);
    const parsed = parseDestination(decodeUtf8(bytes), layer);
    if (parsed.slug !== slugFromPath) invalid("destination slug does not match its path");
    const relativePath = layer === "L2"
      ? `work/${fixture.manifest.theme}/memorias/${parsed.slug}.md`
      : `work/${fixture.manifest.theme}/conhecimento/${parsed.slug}/README.md`;
    destinations.push({
      ...parsed,
      relativePath,
      linkFromTheme: layer === "L2" ? `memorias/${parsed.slug}.md` : `conhecimento/${parsed.slug}/README.md`,
      linkFromIndex: layer === "L2" ? `${parsed.slug}.md` : `${parsed.slug}/README.md`,
      contentSha256: sha256(bytes)
    });
  }
  return destinations;
}

function parseDestination(text, expectedLayer) {
  const normalized = normalizeLf(text);
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n\n# ([^\n]+)\n/);
  if (!match) invalid("destination document is not parseable");
  const metadata = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) invalid("destination metadata is not parseable");
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (Object.hasOwn(metadata, key)) invalid("destination metadata contains duplicate fields");
    metadata[key] = parseScalar(rawValue);
  }
  const expectedKeys = ["contract_version", "created_at", "dex_memory", "identity", "last_reused_at", "layer", "reuse_count", "slug", "updated_at"];
  if (expectedLayer === "L3") expectedKeys.push("owner_skill");
  requireExactKeys(metadata, expectedKeys, "destination metadata");
  if (metadata.dex_memory !== "governed-theme-v2" || metadata.contract_version !== 1) invalid("destination contract is invalid");
  validateCoreMetadata(metadata, "destination metadata");
  if (metadata.layer !== expectedLayer) invalid("destination is stored in the wrong layer");
  if (typeof metadata.created_at !== "string" || !isIsoInstant(metadata.created_at)) invalid("destination created_at is invalid");
  if (expectedLayer === "L3" && (typeof metadata.owner_skill !== "string" || !/^[a-z0-9]+(?:(?:-|:)[a-z0-9]+)*$/.test(metadata.owner_skill))) {
    invalid("L3 destination owner_skill is invalid");
  }
  const backlink = expectedLayer === "L2" ? "../lembranca.md" : "../../lembranca.md";
  const backlinks = normalized.match(/^L1 relacionada: \[([^\]]+)\]\(([^)]+)\)$/gm) || [];
  if (backlinks.length !== 1 || backlinks[0] !== `L1 relacionada: [${backlink}](${backlink})`) invalid("destination backlink to L1 is invalid");
  if (!match[2] || match[2].length > 256 || /[\r\n\0]/.test(match[2])) invalid("destination title is invalid");
  return { ...metadata, title: match[2] };
}

function validateCoreMetadata(value, label) {
  validateIdentityLayerSlug(value, label);
  if (typeof value.updated_at !== "string" || !isIsoInstant(value.updated_at)) invalid(`${label} updated_at is invalid`);
  if (value.last_reused_at !== null && (typeof value.last_reused_at !== "string" || !isIsoInstant(value.last_reused_at))) invalid(`${label} last_reused_at is invalid`);
  if (!Number.isSafeInteger(value.reuse_count) || value.reuse_count < 0) invalid(`${label} reuse_count is invalid`);
}

function validateIdentityLayerSlug(value, label) {
  if (typeof value.identity !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.identity)) invalid(`${label} identity is invalid`);
  if (!["L2", "L3"].includes(value.layer)) invalid(`${label} layer is invalid`);
  if (typeof value.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) invalid(`${label} slug is invalid`);
}

function requireUnique(entries, label) {
  if (new Set(entries.map((entry) => entry.identity)).size !== entries.length) invalid(`${label} identity is duplicated`);
}

function requireCasefoldSlugUniqueness(entries) {
  const identitiesBySlug = new Map();
  for (const entry of entries) {
    const key = entry.slug.toLowerCase();
    const known = identitiesBySlug.get(key);
    if (known && known !== entry.identity) invalid("slug collides across active routes");
    identitiesBySlug.set(key, entry.identity);
  }
}

function byIdentity(entries) {
  return new Map(entries.map((entry) => [entry.identity, entry]));
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) invalid(`${label} contains missing or unknown fields`);
}

function parseJsonObject(text, label) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object`);
    return value;
  } catch (error) {
    if (error instanceof RouteInspectionError) throw error;
    invalid(`${label} is invalid JSON`);
  }
}

function parseScalar(value) {
  if (value === "null") return null;
  if (/^(0|[1-9]\d*)$/.test(value)) return Number(value);
  return value;
}

function readPlainFile(filePath) {
  return decodeUtf8(readPlainFileBytes(filePath));
}

function readPlainFileBytes(filePath) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    invalid("required route document is missing");
  }
  if (!stat.isFile() || stat.isSymbolicLink()) invalid("route document must be a plain file");
  if (stat.size > MAX_DOCUMENT_BYTES) invalid("route document exceeds 1 MiB");
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    invalid("route document could not be read");
  }
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    invalid("route document must be valid UTF-8");
  }
}

function unescapeMarkdownLabel(value) {
  return value.replace(/\\([\\\[\]])/g, "$1");
}

function compareRoutes(first, second) {
  const firstKey = `${first.layer}\u0000${first.slug}\u0000${first.identity}`;
  const secondKey = `${second.layer}\u0000${second.slug}\u0000${second.identity}`;
  return firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0;
}

function isIsoInstant(value) {
  try {
    return new Date(value).toISOString() === value;
  } catch (error) {
    return false;
  }
}

function normalizeLf(value) {
  return value.replace(/\r\n?/g, "\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function invalid(message) {
  throw new RouteInspectionError(4, "ROUTE_INVALID", message);
}

module.exports = { RouteInspectionError, inspectThemeV2Routes };
