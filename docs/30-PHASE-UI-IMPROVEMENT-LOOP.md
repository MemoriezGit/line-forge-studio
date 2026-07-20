# 30-Phase Advanced UI Improvement Loop

This document is the release contract for Line Forge Studio. It converts the advanced 3D editor specification into a repeatable, evidence-based improvement loop while preserving the last working release.

## Baseline truth

As of the start of the July 19, 2026 run, `main` is a working single-file 2D station-layout builder. It has a state-driven architecture, pointer placement, selection, editing, visual collision hints, local persistence, JSON portability, keyboard behaviors, accessibility work, and built-in self-tests.

The approved destination is the advanced 3D spatial editor described below. The current 2D release must not be discarded or silently replaced. The migration must preserve working behaviors until the 3D path reaches feature parity and passes the release gates.

### Status vocabulary

- **Verified** — reproducible evidence exists in the current release.
- **Partial** — useful behavior exists, but it does not yet satisfy the advanced gate.
- **Not present** — no production implementation is verified.
- **Blocked** — implementation cannot safely continue until a documented dependency is resolved.

## Phase matrix

| Phase | Improvement gate | Baseline status | Current evidence / measurable weakness | Advanced completion evidence required |
|---:|---|---|---|---|
| 1 | Product independence | Verified | Standalone repository and single-file application; no runtime service dependency. | Canonical repository, versioned schema, no parallel rewrite, migration history recorded. |
| 2 | Advanced information architecture | Partial | Palette, main canvas, editor panel, header, and status bar exist. No dedicated outliner or intelligence panel. | Asset library, 3D stage, scene configuration, inspector, outliner, and intelligence panels are all navigable and synchronized. |
| 3 | Production 3D engine | Not present | Current renderer is DOM/CSS 2D. | Bundled Three.js WebGL renderer, explicit color-space handling, tone mapping, resize safety, context-loss handling, and no external runtime URL. |
| 4 | Camera interaction | Not present | No spatial camera model. | Orbit, pan, zoom, damping, focus, top, front, left, and isometric views verified with mouse and keyboard. |
| 5 | Spatial floor system | Partial | Fixed 1800×1200 2D canvas and grid exist. | Configurable station width/depth, physical floor, quarter-foot grid, scene bounds, unit conversion, and grounded placement. |
| 6 | Lighting and depth readability | Not present | 2D shadows and surface tokens only. | Hemisphere, directional key, rim/fill lighting, shadows, fog/depth cues, and material response remain readable across templates. |
| 7 | Kitchen asset geometry | Partial | 2D palette models pans, rails, wells, tables, notes, and blocks. | Production 3D geometry for pans, containers, bottles, drawers, worktables, equipment, rails, shelving, and dividers with stable physical meshes. |
| 8 | Real-world sizing | Partial | Consistent prototype pixel scale; rail/well depth constraints are documented. | Exact feet/inches editing, normalized internal units, dimension validation, and repeatable asset defaults. |
| 9 | Drag-to-place workflow | Verified in 2D | Pointer Events place palette items on the canvas. | HTML asset cards raycast to the 3D floor at pointer drop position; invalid drops fail safely. |
| 10 | Object selection system | Verified in 2D | Canvas selection and editor synchronization exist. | Raycast stage selection plus synchronized outliner selection; selection survives camera movement and scene switching correctly. |
| 11 | Transform tooling | Partial | Move and rotate are implemented; rotation swaps width/height. | DCC-style move/rotate gizmos, orbit suppression while dragging, lock enforcement, and final transform committed once. |
| 12 | Precision snapping | Partial | Grid snapping is modeled behind a feature flag. | Configurable position and angle snapping applies consistently to drops, nudges, inspector edits, and gizmos. |
| 13 | Inspector precision | Partial | Name, type, notes, dimensions, and position editing exist. | Name, dimensions, X/Z, elevation, rotation, finish, lock, labels, layer, grounding, validation, and unit-aware inputs. |
| 14 | Selection feedback | Partial | Selected item styling and editor state exist. | Physical-object bounding box, HUD dimensions, position readout, inspector state, and locked/colliding feedback. |
| 15 | Object naming and labels | Partial | Item names and notes are rendered in 2D. | 3D label sprites, scale-aware sizing, occlusion/readability rules, and per-object visibility. |
| 16 | Scene templates | Not present | Single-layout workflow only. | Advanced blank, sauté, pantry/cold, and prep-production templates with documented expected object counts and no startup collisions. |
| 17 | Multi-scene project model | Not present | One layout per saved state. | Create, switch, duplicate, rename, reorder, and delete independent scenes in one versioned project. |
| 18 | Object outliner | Not present | No object hierarchy/list panel. | Layer-sorted object list with selection, visibility/lock state, collision indicator, keyboard access, and scene scoping. |
| 19 | Undo/redo history | Not present | No verified snapshot history. | Bounded undo/redo for edits, transforms, duplication, deletion, scene operations, and configuration; import/load boundaries documented. |
| 20 | Local persistence | Verified in 2D | Debounced/local save path with in-memory fallback is documented. | Versioned project autosave, migration handling, quota/error containment, explicit autosave state, and no data loss across scene switching. |
| 21 | Portable project format | Verified in 2D | JSON import/export round-trip exists. | Versioned project + scene validation, schema migration, rejected-invalid-file behavior, and lossless round-trip tests. |
| 22 | Visual export | Partial | Print behavior is modeled; no verified renderer PNG export. | PNG capture directly from the WebGL renderer with predictable framing, transparent/opaque choice where supported, and error handling. |
| 23 | Spatial intelligence | Verified in 2D / Partial target | Rectangle-overlap collision hints exist and do not block placement. | Physical-mesh collision checks exclude labels/helpers, report pairs, avoid false positives, and remain informational unless a future rule explicitly changes that. |
| 24 | Operational metrics | Partial | Status information and collision notes exist. | Object count, collision count, estimated floor coverage, selected-object dimensions, performance state, and autosave state. |
| 25 | Command system | Not present | No searchable command palette. | Searchable commands for views, tools, project operations, scene operations, selection actions, and asset creation with keyboard navigation. |
| 26 | Keyboard efficiency | Partial | Save, print, duplicate, rotate, delete, and nudge shortcuts exist behind feature flags. | Move, rotate, focus, views, new scene, duplicate, undo/redo, delete, escape, command palette, and shortcut conflict handling. |
| 27 | Responsive interface | Partial | Desktop grid exists; constrained-width behavior is not verified. | Three desktop breakpoints that collapse or dock inspector/asset rail without losing stage access, selection, or keyboard usability. |
| 28 | Accessibility and error containment | Partial | Focus-visible, ARIA work, validation, save fallback, and self-test coverage exist. | Complete labeling, logical focus order, keyboard-only critical path, reduced-motion handling, contrast verification, warnings, and contained runtime/storage/import failures. |
| 29 | Offline production packaging | Verified in 2D | Single HTML, no build step, dependency, or CDN runtime. | Three.js, controls, CSS, and application code bundled into a deterministic offline artifact with license notices and reproducible packaging. |
| 30 | Release verification | Partial | Built-in self-tests run; current release has no WebGL verification. | Syntax/build checks, structural artifact checks, Chromium WebGL runtime, interaction smoke test, persistence/import test, accessibility smoke test, screenshot evidence, and zero page errors. |

## Migration sequence: advanced without a rewrite

### Stage A — Protect and measure the working release

1. Install structural audit and CI.
2. Capture current self-test output and screenshots.
3. Add a run ledger and regression inventory.
4. Stabilize responsive behavior, focus management, persistence, and import/export tests.
5. Add history and command infrastructure only where it can reuse the existing `STATE`/`action_*` model.

### Stage B — Introduce a renderer-neutral spatial model

1. Version the project schema.
2. Normalize dimensions into a real-world internal unit.
3. Separate logical objects from 2D rendering details.
4. Add scenes, layers, lock state, label visibility, elevation, and rotation fields behind migrations.
5. Keep the 2D renderer functioning as the compatibility surface.

### Stage C — Add the 3D path behind an explicit feature flag

1. Bundle the renderer locally.
2. Build floor, camera, lighting, selection, and transform foundations.
3. Render the same normalized objects in 2D and 3D from one state model.
4. Add parity tests for placement, selection, inspector edits, persistence, and JSON portability.
5. Do not default to 3D until clean startup and core parity pass.

### Stage D — Reach operational parity

1. Complete kitchen geometry and templates.
2. Add outliner, multi-scene operations, collision intelligence, metrics, commands, and exports.
3. Add undo/redo boundaries and stress tests.
4. Verify responsive and keyboard workflows.
5. Resolve performance, memory, and context-loss issues.

### Stage E — Promote the 3D release

1. Run the complete release gate.
2. Preserve a rollback artifact.
3. Update README and migration notes.
4. Default to the 3D experience only after all protected behaviors pass.
5. Retire compatibility code only in a separate measured cleanup release.

## Mandatory loop for every run

Each run must:

1. Begin from the last passing release, not a parallel rewrite.
2. Record the baseline branch and commit SHA.
3. Run `node scripts/ui-loop-audit.mjs --strict` before editing.
4. Run the built-in browser self-tests and capture their output.
5. Identify one measurable weakness in every applicable phase.
6. Rank the next work by behavior value, dependency order, and regression risk.
7. Improve behavior before adding decoration.
8. Make focused, reversible commits on one session branch.
9. Re-run structural and browser tests after every behavior slice.
10. Reject or revert any change that breaks selection, transforms, persistence, portability, keyboard access, or clean startup.
11. Update `docs/runs/YYYY-MM-DD-ui-loop.md` with evidence instead of marking phases complete by assertion.
12. End with explicit remaining risks and the next highest-value action.

## Target advanced release gate

The advanced 3D release is not complete until all of the following are reproducibly verified:

- Production bundle builds successfully.
- JavaScript syntax validation passes.
- Structural artifact checks pass.
- Chromium initializes WebGL 2.
- Default sauté scene contains eight expected physical objects.
- Default scene reports zero collisions.
- Outliner selection opens the inspector and selection HUD.
- Duplicate increases the object count from eight to nine.
- Undo restores the object count to eight.
- Import/export round-trip preserves project, scenes, objects, dimensions, labels, layers, locks, and configuration.
- Local autosave restores the same active scene and selection-safe state after reload.
- Keyboard-only users can place/select/edit/duplicate/delete/undo and switch views.
- Browser runtime reports no page errors or unhandled promise rejections.

## Evidence rules

Acceptable evidence includes:

- command output committed to a dated run ledger,
- test output with pass/fail counts,
- browser console results,
- screenshots named by viewport and scenario,
- performance traces or measured timings,
- exact reproduction steps for a regression,
- commit SHAs associated with each passing increment.

A phase cannot be marked `Verified` or `Complete` because code appears to exist. It must be exercised.