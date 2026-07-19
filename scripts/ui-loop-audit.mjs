#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const json = args.has("--json");

const ROOT_FILES = [
  "index.html",
  "README.md",
  "CLAUDE.md",
  "AGENTS.md",
  "docs/30-PHASE-UI-IMPROVEMENT-LOOP.md",
];

async function read(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    return { error: `${error.code ?? "READ_ERROR"}: ${error.message}` };
  }
}

function check(id, description, passed, evidence, severity = "protected") {
  return { id, description, passed: Boolean(passed), evidence, severity };
}

function countMatches(text, expression) {
  return [...text.matchAll(expression)].length;
}

const sources = Object.fromEntries(
  await Promise.all(ROOT_FILES.map(async (path) => [path, await read(path)])),
);

const missingFiles = ROOT_FILES.filter((path) => !existsSync(path));
const index = typeof sources["index.html"] === "string" ? sources["index.html"] : "";
const readme = typeof sources["README.md"] === "string" ? sources["README.md"] : "";
const claude = typeof sources["CLAUDE.md"] === "string" ? sources["CLAUDE.md"] : "";
const agents = typeof sources["AGENTS.md"] === "string" ? sources["AGENTS.md"] : "";
const loopDoc = typeof sources["docs/30-PHASE-UI-IMPROVEMENT-LOOP.md"] === "string"
  ? sources["docs/30-PHASE-UI-IMPROVEMENT-LOOP.md"]
  : "";

const externalRuntimeScripts = countMatches(
  index,
  /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//gi,
);
const nativeDragAttributes = countMatches(index, /\bdraggable\s*=\s*["']true["']/gi);
const inlineDragHandlers = countMatches(index, /\bon(?:drag|drop)[a-z]*\s*=/gi);

const protectedChecks = [
  check("P01", "Canonical application file exists", index.length > 0, `index.html bytes=${index.length}`),
  check("P02", "HTML document has a doctype", /<!doctype html>/i.test(index), "<!DOCTYPE html>"),
  check(
    "P03",
    "Single source-of-truth STATE is declared",
    /\b(?:const|let|var)\s+STATE\s*=/.test(index),
    "STATE declaration",
  ),
  check(
    "P04",
    "Action commit boundary exists",
    /function\s+action_commit\s*\(|\baction_commit\s*=/.test(index),
    "action_commit",
  ),
  check(
    "P05",
    "State-change render path exists",
    /state:changed/.test(index) && /render_schedule|render_all/.test(index),
    "state:changed + render path",
  ),
  check(
    "P06",
    "Focus capture and restoration are preserved",
    /render_captureFocus/.test(index) && /render_restoreFocus/.test(index),
    "render_captureFocus + render_restoreFocus",
  ),
  check(
    "P07",
    "Pointer Event workflow exists",
    /pointerdown/.test(index) && /pointermove/.test(index) && /pointerup/.test(index),
    "pointerdown/pointermove/pointerup",
  ),
  check(
    "P08",
    "Native HTML drag-and-drop is not enabled",
    nativeDragAttributes === 0 && inlineDragHandlers === 0,
    `draggable=true:${nativeDragAttributes}, inline drag/drop handlers:${inlineDragHandlers}`,
  ),
  check(
    "P09",
    "Feature flags remain explicit",
    /\bFEATURE_FLAGS\b/.test(index),
    "FEATURE_FLAGS",
  ),
  check(
    "P10",
    "Schema normalization/validation exists",
    /\bschema_[A-Za-z0-9_]+/.test(index),
    "schema_* function(s)",
  ),
  check(
    "P11",
    "Local persistence exists",
    /localStorage/.test(index) && /storage_save/.test(index) && /storage_load/.test(index),
    "localStorage + storage_save/storage_load",
  ),
  check(
    "P12",
    "Portable JSON workflow exists",
    /JSON\.stringify/.test(index) && /JSON\.parse/.test(index) && /import/i.test(index) && /export/i.test(index),
    "JSON parse/stringify + import/export",
  ),
  check(
    "P13",
    "Collision intelligence remains represented",
    /collid|overlap/i.test(index),
    "collision/overlap implementation",
  ),
  check(
    "P14",
    "Keyboard behavior exists",
    /keydown/.test(index) && /keyboard_/i.test(index),
    "keydown + keyboard_*",
  ),
  check(
    "P15",
    "Focus-visible styling exists",
    /:focus-visible/.test(index),
    ":focus-visible",
  ),
  check(
    "P16",
    "Accessible names or ARIA attributes exist",
    /aria-[a-z-]+/i.test(index),
    "aria-*",
  ),
  check(
    "P17",
    "Built-in self-test harness exists",
    /selftest_run/.test(index),
    "selftest_run",
  ),
  check(
    "P18",
    "Offline runtime has no external script URL",
    externalRuntimeScripts === 0,
    `external runtime scripts:${externalRuntimeScripts}`,
  ),
  check(
    "P19",
    "Repository operating instructions exist",
    agents.includes("Mandatory 30-phase loop") && claude.includes("STATE"),
    "AGENTS.md + CLAUDE.md",
  ),
  check(
    "P20",
    "Evidence-based phase contract exists",
    loopDoc.includes("Phase matrix") && loopDoc.includes("Evidence rules"),
    "30-phase loop document",
  ),
  check(
    "P21",
    "README still identifies the canonical app",
    /index\.html/.test(readme),
    "README -> index.html",
  ),
];

const advancedObservations = [
  check("A03", "Three.js/WebGL renderer", /THREE\.|WebGLRenderer/.test(index), "THREE/WebGLRenderer", "target"),
  check("A04", "Orbit camera controls", /OrbitControls/.test(index), "OrbitControls", "target"),
  check("A11", "Transform gizmos", /TransformControls/.test(index), "TransformControls", "target"),
  check("A16", "Scene templates", /template/i.test(index) && /saut[eé]|pantry|prep-production/i.test(index), "template markers", "target"),
  check("A17", "Multi-scene project model", /scenes/.test(index) && /activeScene/i.test(index), "scenes + activeScene", "target"),
  check("A18", "Object outliner", /outliner/i.test(index), "outliner", "target"),
  check("A19", "Undo and redo", /undo/i.test(index) && /redo/i.test(index), "undo + redo", "target"),
  check("A22", "Renderer PNG capture", /toDataURL\s*\(\s*["']image\/png|image\/png/.test(index), "image/png", "target"),
  check("A25", "Searchable command palette", /command palette/i.test(index), "command palette", "target"),
  check("A30", "WebGL release verification", /WebGL\s*2|webgl2/i.test(index), "WebGL2 verification", "target"),
];

const protectedFailures = protectedChecks.filter((item) => !item.passed);
const targetPassing = advancedObservations.filter((item) => item.passed);

const result = {
  generatedAt: new Date().toISOString(),
  strict,
  files: ROOT_FILES.map((path) => ({
    path,
    exists: existsSync(path),
    bytes: typeof sources[path] === "string" ? sources[path].length : 0,
  })),
  summary: {
    protectedPassed: protectedChecks.length - protectedFailures.length,
    protectedTotal: protectedChecks.length,
    protectedFailed: protectedFailures.length,
    advancedDetected: targetPassing.length,
    advancedObserved: advancedObservations.length,
    missingFiles,
  },
  protectedChecks,
  advancedObservations,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("\nLine Forge Studio — 30-Phase UI Structural Audit\n");
  for (const item of protectedChecks) {
    console.log(`${item.passed ? "PASS" : "FAIL"} ${item.id}  ${item.description} — ${item.evidence}`);
  }

  console.log("\nAdvanced target observations (informational until migration stages activate):\n");
  for (const item of advancedObservations) {
    console.log(`${item.passed ? "DETECTED" : "GAP"} ${item.id}  ${item.description}`);
  }

  console.log(
    `\nProtected baseline: ${result.summary.protectedPassed}/${result.summary.protectedTotal} passing. ` +
    `Advanced target signals: ${result.summary.advancedDetected}/${result.summary.advancedObserved} detected.\n`,
  );
}

if (strict && protectedFailures.length > 0) {
  process.exitCode = 1;
}
