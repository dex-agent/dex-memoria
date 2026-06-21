#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const casesPath = path.join(root, "examples", "graduated-memory-test-cases.json");

const activeClassifications = new Set(["simples", "operacional", "robusta"]);
const allowedClassifications = new Set([
  ...activeClassifications,
  "ledger-only",
  "descarte"
]);
const allowedPromotions = new Set(["memory", "ledger-only", "discard", "manual-unblock"]);
const allowedEvidence = new Set(["fraca", "boa", "forte", "bloqueante"]);

function main() {
  const errors = [];
  const data = readCases(errors);

  if (data) {
    if (data.schema !== "dex-memoria graduated-memory-test-cases v1") {
      errors.push("examples/graduated-memory-test-cases.json has unexpected schema");
    }

    if (!Array.isArray(data.cases) || data.cases.length < 6) {
      errors.push("graduated memory battery must include at least 6 cases");
    } else {
      const ids = new Set();
      for (const testCase of data.cases) {
        validateCase(testCase, ids, errors);
      }
      validateCoverage(data.cases, errors);
    }
  }

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  if (process.argv.includes("--self-test")) {
    runSelfTest(data);
  }

  console.log("graduated memory documental test battery ok");
}

function readCases(errors) {
  try {
    return JSON.parse(fs.readFileSync(casesPath, "utf8"));
  } catch (error) {
    errors.push(`Cannot read graduated memory test cases: ${error.message}`);
    return null;
  }
}

function validateCoverage(cases, errors) {
  requireSome(cases, errors, "simple memory without required anti-example", (testCase) =>
    testCase.expectedClassification === "simples" &&
    testCase.expectedPromotion === "memory" &&
    testCase.requiresAntiExample === false
  );
  requireSome(cases, errors, "operational memory with example or anti-example", (testCase) =>
    testCase.expectedClassification === "operacional" &&
    testCase.expectedPromotion === "memory" &&
    Boolean(testCase.l2 && (testCase.l2.hasExample || testCase.l2.hasAntiExample))
  );
  requireSome(cases, errors, "robust memory with false-ready risk", (testCase) =>
    testCase.expectedClassification === "robusta" &&
    hasRisk(testCase, "falso pronto")
  );
  requireSome(cases, errors, "unconfirmed Graphify case", (testCase) =>
    Boolean(testCase.graphify && testCase.graphify.used) &&
    testCase.graphify.confirmedHits.length === 0 &&
    testCase.expectedPromotion !== "memory"
  );
  requireSome(cases, errors, "blocking evidence case", (testCase) =>
    testCase.evidenceStrength === "bloqueante" &&
    testCase.expectedPromotion !== "memory"
  );
  requireSome(cases, errors, "controlled manual unblock case", (testCase) =>
    testCase.expectedPromotion === "manual-unblock" &&
    Boolean(testCase.manualUnblock && testCase.manualUnblock.requestedExplicitly && testCase.manualUnblock.allowed)
  );
  requireSome(cases, errors, "discard case", (testCase) =>
    testCase.expectedClassification === "descarte" &&
    testCase.expectedPromotion === "discard"
  );
  requireSome(cases, errors, "L1 -> L2 bridge", (testCase) =>
    isActive(testCase) && Boolean(testCase.l1 && testCase.l1.target && testCase.l2 && testCase.l2.anchor)
  );
  requireSome(cases, errors, "L2 -> L3 and L3 -> L2 bridge", (testCase) =>
    Boolean(
      testCase.l3 &&
      testCase.l3.exists &&
      testCase.l2 &&
      testCase.l2.knowledgePath &&
      testCase.l3.backlinkAnchor === testCase.l2.anchor
    )
  );
}

function validateCase(testCase, ids, errors) {
  const prefix = testCase && testCase.id ? `[${testCase.id}]` : "[missing-id]";

  if (!testCase || typeof testCase !== "object") {
    errors.push("Each graduated memory case must be an object");
    return;
  }

  if (!testCase.id || typeof testCase.id !== "string") {
    errors.push(`${prefix} must have an id`);
  } else if (ids.has(testCase.id)) {
    errors.push(`${prefix} id is duplicated`);
  } else {
    ids.add(testCase.id);
  }

  requireString(testCase, "title", prefix, errors);
  requireString(testCase, "capture", prefix, errors);
  requireString(testCase, "decision", prefix, errors);
  requireString(testCase, "evidenceMinimum", prefix, errors);

  if (!allowedClassifications.has(testCase.expectedClassification)) {
    errors.push(`${prefix} has invalid expectedClassification: ${testCase.expectedClassification}`);
  }
  if (!allowedPromotions.has(testCase.expectedPromotion)) {
    errors.push(`${prefix} has invalid expectedPromotion: ${testCase.expectedPromotion}`);
  }
  if (!allowedEvidence.has(testCase.evidenceStrength)) {
    errors.push(`${prefix} has invalid evidenceStrength: ${testCase.evidenceStrength}`);
  }

  if (!Array.isArray(testCase.riskFactors)) {
    errors.push(`${prefix} riskFactors must be an array`);
  }

  validateAntiTrigger(testCase, prefix, errors);
  validateAntiExample(testCase, prefix, errors);
  validateEvidence(testCase, prefix, errors);
  validateManualUnblock(testCase, prefix, errors);
  validateLayerBridges(testCase, prefix, errors);
  validateClassificationFields(testCase, prefix, errors);
  validateGraphify(testCase, prefix, errors);
}

function validateAntiTrigger(testCase, prefix, errors) {
  const realRisk = Array.isArray(testCase.riskFactors) && testCase.riskFactors.length > 0;

  if (isActive(testCase) && realRisk !== testCase.requiresAntiTrigger) {
    errors.push(`${prefix} requiresAntiTrigger must match real confusion risk for active memory`);
  }
  if (!realRisk && testCase.requiresAntiTrigger) {
    errors.push(`${prefix} cannot require anti-gatilho without real confusion risk`);
  }
  if (testCase.requiresAntiTrigger && !(testCase.l1 && testCase.l1.hasAntiTrigger) && !(testCase.l2 && testCase.l2.hasAntiTriggers)) {
    errors.push(`${prefix} requires anti-gatilho but no L1/L2 anti-trigger is present`);
  }
}

function validateAntiExample(testCase, prefix, errors) {
  const avoidsRealError = hasRisk(testCase, "falso pronto") || hasRisk(testCase, "erro recorrente");
  const hasAntiExample = Boolean(testCase.l2 && testCase.l2.hasAntiExample);

  if (isActive(testCase) && avoidsRealError !== testCase.requiresAntiExample) {
    errors.push(`${prefix} requiresAntiExample must match real false-ready/recurrent-error risk`);
  }
  if (testCase.requiresAntiExample && !hasAntiExample) {
    errors.push(`${prefix} requires anti-exemplo but L2 has no anti-example`);
  }
  if (!avoidsRealError && testCase.requiresAntiExample) {
    errors.push(`${prefix} cannot require decorative anti-exemplo`);
  }
}

function validateEvidence(testCase, prefix, errors) {
  if (testCase.evidenceStrength === "bloqueante" && testCase.expectedPromotion === "memory") {
    errors.push(`${prefix} blocking evidence cannot promote active memory`);
  }
  if (testCase.expectedPromotion === "memory" && testCase.evidenceStrength === "fraca") {
    errors.push(`${prefix} weak evidence cannot be the only basis for active memory promotion`);
  }
}

function validateManualUnblock(testCase, prefix, errors) {
  const unblock = testCase.manualUnblock;

  if (testCase.expectedPromotion !== "manual-unblock" && !unblock) {
    return;
  }

  if (!unblock || typeof unblock !== "object") {
    errors.push(`${prefix} manual-unblock promotion requires manualUnblock object`);
    return;
  }

  if (!unblock.allowed && testCase.expectedPromotion !== "manual-unblock") {
    if (unblock.preservesOriginalEvidence !== true) {
      errors.push(`${prefix} blocked manual unblock metadata must preserve original evidence`);
    }
    return;
  }

  if (unblock.allowed && !unblock.requestedExplicitly) {
    errors.push(`${prefix} manual unblock requires explicit user request`);
  }
  if (testCase.expectedPromotion === "manual-unblock" && !unblock.allowed) {
    errors.push(`${prefix} manual-unblock promotion must be marked allowed`);
  }
  if (testCase.expectedPromotion === "manual-unblock" && testCase.expectedClassification !== "descarte") {
    errors.push(`${prefix} manual unblock is a work-continuation override, not an active memory classification`);
  }
  if (unblock.allowed && testCase.expectedPromotion === "memory") {
    errors.push(`${prefix} manual unblock cannot convert blocking evidence into active memory proof`);
  }

  for (const key of ["reason", "scope", "acceptedBy", "expiresWhen", "nextValidation"]) {
    if (typeof unblock[key] !== "string" || unblock[key].trim() === "") {
      errors.push(`${prefix} allowed manual unblock requires ${key}`);
    }
  }

  if (unblock.preservesOriginalEvidence !== true) {
    errors.push(`${prefix} manual unblock must preserve original blocking evidence`);
  }
  if (unblock.notGlobalRule !== true) {
    errors.push(`${prefix} manual unblock must not become a global rule`);
  }
  if (!Array.isArray(unblock.nonOverridableRisks)) {
    errors.push(`${prefix} manualUnblock.nonOverridableRisks must be an array`);
  } else if (unblock.allowed && unblock.nonOverridableRisks.length > 0) {
    errors.push(`${prefix} manual unblock cannot override non-overridable risks`);
  }
}

function runSelfTest(data) {
  const baseCase = data.cases.find((testCase) => testCase.expectedPromotion === "manual-unblock");
  if (!baseCase) {
    console.error("Self-test cannot find manual-unblock base case");
    process.exit(1);
  }

  const scenarios = [
    {
      label: "manual unblock without explicit request",
      mutate: (testCase) => {
        testCase.manualUnblock.requestedExplicitly = false;
      },
      expectedMessage: "manual unblock requires explicit user request"
    },
    {
      label: "manual unblock overriding non-overridable risk",
      mutate: (testCase) => {
        testCase.manualUnblock.nonOverridableRisks = ["secret"];
      },
      expectedMessage: "manual unblock cannot override non-overridable risks"
    },
    {
      label: "manual unblock promoted as memory",
      mutate: (testCase) => {
        testCase.expectedClassification = "robusta";
        testCase.expectedPromotion = "memory";
      },
      expectedMessage: "manual unblock cannot convert blocking evidence into active memory proof"
    },
    {
      label: "manual unblock without expiration",
      mutate: (testCase) => {
        testCase.manualUnblock.expiresWhen = "";
      },
      expectedMessage: "allowed manual unblock requires expiresWhen"
    }
  ];

  for (const scenario of scenarios) {
    const candidate = clone(baseCase);
    scenario.mutate(candidate);
    const errors = [];
    validateCase(candidate, new Set(), errors);
    if (!errors.some((error) => error.includes(scenario.expectedMessage))) {
      console.error(`Self-test failed: ${scenario.label}`);
      console.error(`Expected message: ${scenario.expectedMessage}`);
      console.error(errors.join("\n") || "No validation error emitted");
      process.exit(1);
    }
  }

  const graphifyCase = data.cases.find((testCase) => testCase.graphify && testCase.graphify.used);
  if (graphifyCase) {
    const candidate = clone(graphifyCase);
    candidate.expectedClassification = "robusta";
    candidate.expectedPromotion = "memory";
    candidate.graphify.promotedFromGraphifyOnly = true;
    const errors = [];
    validateCase(candidate, new Set(), errors);
    if (!errors.some((error) => error.includes("cannot promote memory directly from Graphify"))) {
      console.error("Self-test failed: Graphify direct promotion");
      console.error(errors.join("\n") || "No validation error emitted");
      process.exit(1);
    }
  }

  console.log("graduated memory validator self-test ok");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateLayerBridges(testCase, prefix, errors) {
  const l1 = testCase.l1 || {};
  const l2 = testCase.l2 || {};
  const l3 = testCase.l3 || {};

  if (isActive(testCase)) {
    if (!l1.trigger || !l1.target) {
      errors.push(`${prefix} active memory requires L1 trigger and target`);
    }
    if (!l2.anchor) {
      errors.push(`${prefix} active memory requires L2 anchor`);
    }
    if (l1.target && l2.anchor && !l1.target.endsWith(`#${l2.anchor}`)) {
      errors.push(`${prefix} L1 target must point to the L2 anchor`);
    }
  }

  if (l2.anchor && !l1.target) {
    errors.push(`${prefix} L2 must not exist without L1 target or equivalent live source`);
  }
  if (l3.exists && !l2.anchor) {
    errors.push(`${prefix} L3 must not exist without L2 anchor`);
  }
  if (l3.exists && !l2.knowledgePath) {
    errors.push(`${prefix} L2 must point to L3 knowledge path`);
  }
  if (l3.exists && l3.backlinkAnchor !== l2.anchor) {
    errors.push(`${prefix} L3 must point back to the related L2 anchor`);
  }
}

function validateClassificationFields(testCase, prefix, errors) {
  const l2 = testCase.l2 || {};

  if (testCase.expectedClassification === "simples") {
    if (testCase.requiresAntiExample || l2.hasAntiExample) {
      errors.push(`${prefix} simple memory must not force anti-example without real risk`);
    }
    if (testCase.l3 && testCase.l3.exists) {
      errors.push(`${prefix} simple memory must not become L3 robusta without need`);
    }
  }

  if (testCase.expectedClassification === "operacional") {
    requireL2Flags(testCase, prefix, errors, [
      "hasProblem",
      "hasMechanism",
      "hasVerification",
      "hasPrevention",
      "hasWhenRemember",
      "hasWhenNotRemember",
      "hasSource",
      "hasRgAchability"
    ]);
    if (!Array.isArray(l2.aliases) || l2.aliases.length === 0) {
      errors.push(`${prefix} operational memory requires aliases`);
    }
    if (testCase.requiresAntiTrigger && !(l2.hasExample || l2.hasAntiExample)) {
      errors.push(`${prefix} operational memory with confusion risk requires at least one correct example or anti-example`);
    }
  }

  if (testCase.expectedClassification === "robusta") {
    requireL2Flags(testCase, prefix, errors, [
      "hasProblem",
      "hasMechanism",
      "hasVerification",
      "hasPrevention",
      "hasWhenRemember",
      "hasWhenNotRemember",
      "hasSource",
      "hasRgAchability",
      "hasStrongTriggers",
      "hasAntiTriggers",
      "hasExample",
      "hasAntiExample",
      "hasRoutes"
    ]);
    if (!(testCase.l3 && testCase.l3.exists)) {
      errors.push(`${prefix} robust memory test case must exercise L3 bridge`);
    }
  }
}

function validateGraphify(testCase, prefix, errors) {
  const graphify = testCase.graphify || {};
  if (!graphify.used) {
    return;
  }

  requireString(graphify, "query", `${prefix} graphify`, errors);
  requireString(graphify, "graph", `${prefix} graphify`, errors);

  if (!Array.isArray(graphify.confirmedHits)) {
    errors.push(`${prefix} graphify.confirmedHits must be an array`);
  }
  if (!Array.isArray(graphify.unpromotedHits)) {
    errors.push(`${prefix} graphify.unpromotedHits must be an array`);
  }
  if (graphify.promotedFromGraphifyOnly) {
    errors.push(`${prefix} cannot promote memory directly from Graphify`);
  }
  if (testCase.expectedPromotion === "memory" && graphify.confirmedHits.length === 0) {
    errors.push(`${prefix} Graphify-assisted memory needs confirmed source hits`);
  }
  if (graphify.unpromotedHits.some((hit) => !String(hit).includes("source: graphify"))) {
    errors.push(`${prefix} unpromoted Graphify hits must stay marked as source: graphify`);
  }
}

function requireL2Flags(testCase, prefix, errors, flags) {
  const l2 = testCase.l2 || {};
  for (const flag of flags) {
    if (!l2[flag]) {
      errors.push(`${prefix} ${testCase.expectedClassification} memory requires L2.${flag}`);
    }
  }
}

function requireString(object, key, prefix, errors) {
  if (typeof object[key] !== "string" || object[key].trim() === "") {
    errors.push(`${prefix} must have non-empty ${key}`);
  }
}

function requireSome(cases, errors, label, predicate) {
  if (!cases.some(predicate)) {
    errors.push(`graduated memory battery missing: ${label}`);
  }
}

function isActive(testCase) {
  return activeClassifications.has(testCase.expectedClassification) && testCase.expectedPromotion === "memory";
}

function hasRisk(testCase, needle) {
  return Array.isArray(testCase.riskFactors) && testCase.riskFactors.includes(needle);
}

main();
