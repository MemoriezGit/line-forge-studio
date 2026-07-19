# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required operating contract

Read `AGENTS.md` and `docs/30-PHASE-UI-IMPROVEMENT-LOOP.md` before editing. They are the canonical improvement and release contract for both Claude Code and Codex.

For every UI improvement session:

1. Work from the last passing release on one session branch.
2. Run `node scripts/ui-loop-audit.mjs --strict` before editing.
3. Run the browser self-tests and capture the result.
4. Improve the highest-value measurable weakness without creating a parallel rewrite.
5. Re-run structural and browser checks after each behavior slice.
6. Record evidence in `docs/runs/YYYY-MM-DD-ui-loop.md`.
7. Do not mark an advanced 3D phase complete until it has reproducible runtime evidence.

The current app is a working 2D baseline. The advanced 3D direction must be introduced through a renderer-neutral state/schema migration and feature-parity gates, not by deleting the current implementation.

## What this is

A single-file vanilla JS/HTML/CSS app: `index.html` — a kitchen/restaurant station layout planner (drag equipment from a palette onto a canvas, edit/rotate/duplicate placed items, export/import the layout as JSON). No build step, no `package.json`, no external dependencies, no CDN scripts. The entire app — markup, styles, and script — lives in this one file.

## Commands

- **Run**: open `index.html` directly in a browser. There is no dev server or build step.
- **Structural audit**: `node scripts/ui-loop-audit.mjs --strict`.
- **Audit JSON**: `node scripts/ui-loop-audit.mjs --json`.
- **Test**: the file has a built-in self-test harness, `selftest_run()` (~line 2530), which runs automatically on load when `FEATURE_FLAGS.selftest` is `true` (it is, by default). Results print to the browser devtools console via `console.table`/`console.info` as PASS/FAIL per check — open the console to see them.
- There is no separate package test runner, linter, or build command in this repo. To verify changes without a browser, load the `<script>` body into a Node + `jsdom` environment and assert against `STATE` / `selftest_run()` output.

## Critical gotcha when working in this repo

Sandboxed shell access to this drive (and to this repo's git state) has repeatedly returned stale or truncated file content mid-session — even immediately after a fresh copy of the file. Do not trust `wc -l`, `tail`, `cat`, `git status`, or `git log` run through a sandboxed shell for this repo. Always verify file contents by reading the file directly with an editor/file-read tool, and run git mutations (`commit`, `merge`, `push`) from a real terminal on the user's machine rather than through a sandboxed shell.

## Architecture

Strict internal conventions are enforced purely by function-name prefix — there are no classes, modules, or framework:

- **`STATE`** (~line 1149) — the single global source of truth. All other in-memory state hangs off this object (`items`, `selectedId`, `revision`, `status`, `ui.*`).
- **`schema_*`** — normalize/validate layout data coming from localStorage or imported JSON (fills in missing/malformed fields with safe defaults).
- **`action_*`** — the *only* functions allowed to mutate `STATE`. Every action ends by calling `action_commit(reason)`, which increments `STATE.revision` and emits `state:changed` on the internal `Bus`.
- **`select_*`** — pure, read-only selectors over `STATE`/constants. Never mutate.
- **`render_*`** — pure DOM builders. `render_all()` is the single render entrypoint, wired up via `Bus.on("state:changed", render_schedule)` (rAF-batched). There is no partial/diffed rendering — every commit fully re-renders all four mount points (`brandHeader`, `leftPanel`, `mainPanel`, `rightPanel`) plus the status bar via `render_documentMeta`/`render_status`.
- **`render_captureFocus` / `render_restoreFocus`** — wrap every `render_all()` call to preserve focus and cursor/selection position across the full re-render. Any new render path must keep calling these, or focus will jump out of inputs on every keystroke (this was a real bug fixed earlier — see git history).
- **`util_*`** — pure helpers: id generation, numeric coercion, clamping, grid snapping, rectangle-overlap/collision math.
- **`handle_*`** — delegated DOM event handlers (`click`, `input`), attached once in `init()`.
- **`pointer_*`** — all dragging (palette → canvas placement, and moving placed items) is implemented with Pointer Events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`) plus `setPointerCapture`/`releasePointerCapture`. The native HTML5 Drag and Drop API is intentionally not used. Pointer handlers must never call `stopPropagation()`. `POINTER` is a single-session singleton, not keyed by `pointerId` — `pointer_down` intentionally ignores a second `pointerdown` while a session is already active (stray multi-touch contact, fast double-click registering as two pointer ids, etc.), rather than overwriting the in-progress session's state. Found via stress testing 2026-06-21; do not remove that guard without adding real multi-session support (which would also require `STATE.ui.dragging` to hold more than one id).
- **`keyboard_*`** — keyboard shortcuts (save, print, duplicate, rotate, delete, arrow-key nudge), gated by `FEATURE_FLAGS.keyboardShortcuts`.
- **`COPY`** (~line 1022) — every user-facing string lives here. Don't hardcode strings elsewhere in render functions.

## `FEATURE_FLAGS` (~line 993)

Gates optional/deferred behavior: `branding`, `snapToGrid`, `collisionDetection`, `print`, `importExport`, `localStorage`, `keyboardShortcuts`, `selftest`. Check this object before assuming a feature is active — some functionality is fully modeled in schema/state/render code but only takes effect when its flag is on.

## Baseline rules (documented in the file's own header comment — do not violate)

- **Overlap is ALLOWED.** Collision detection (`util_findCollidingIds`, gated by `FEATURE_FLAGS.collisionDetection`) is visual-only (dashed red outline on colliding items + a status-bar note) — it must never block placement or movement of items.
- Rotation swaps an item's width/height in data; items are not visually rotated via CSS `rotate()`.
- The canvas is a large fixed-size surface (`SCALE.canvas`, 1800×1200), not the viewport — it scrolls inside `.main`/`.canvas-wrap`.

## Persistence

`storage_save`/`storage_load` read/write `localStorage` under `STORAGE_KEY` (`"station-layout-builder.version-zero"`), falling back to an in-memory `MemoryStore` when `FEATURE_FLAGS.localStorage` is off or `localStorage` throws (quota exceeded or unavailable). JSON import/export round-trips through `STATE.ui.jsonDraft`, which is part of `STATE` specifically so the textarea survives full re-renders instead of being wiped.

## Equipment sizing

`PALETTE_ITEMS` (~line 1069) models real kitchen equipment at a consistent prototype scale. Rail/well items that pans are meant to sit inside (Full Hotel, Cold Rail, Hot Well) should share the same depth (`h`) as the pans designed to fit them (currently 240, matching the 1/3 Pan, 1/2 Pan, and Full Hotel) — mismatched depths here is a real bug, not a stylistic choice.

## Git workflow

- Remote: `https://github.com/MemoriezGit/line-forge-studio.git`; commit author identity is `MemoriezGit`.
- Branching policy: one new branch per working session, multiple focused commits on that branch, then review through a pull request before merging to `main`.
- `Ai Apolo/Buddy/` is an unrelated stray directory with its own nested empty git repo — it is not part of this app and can be ignored.
