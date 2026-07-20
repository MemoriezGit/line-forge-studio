# Line Forge Studio — Agent Operating Rules

This repository is the source of truth for Line Forge Studio. Work from the last passing release on the active branch. Never create a parallel rewrite, replacement project, or disconnected prototype.

## Current baseline

- The current `main` release is a single-file, dependency-free 2D station-layout builder in `index.html`.
- `STATE` is the source of truth.
- Only `action_*` functions may mutate state, and each action must commit exactly once.
- Full renders must preserve focus and text selection.
- Pointer Events are intentional; do not replace them with native HTML drag-and-drop.
- Overlap is allowed. Collision detection is informational and must not block movement or placement.
- Persistence, JSON portability, keyboard behavior, clean startup, and the self-test harness are protected behaviors.

## Target direction

The approved product direction is an advanced spatial kitchen editor with a production-quality 3D stage, precise real-world dimensions, multi-scene project support, inspection/outlining tools, collision intelligence, local persistence, portable exports, keyboard efficiency, accessibility, offline packaging, and browser-runtime verification.

The target is not permission to discard the working 2D app. Upgrade from the working release through measured, reviewable increments.

## Mandatory 30-phase loop

Use `docs/30-PHASE-UI-IMPROVEMENT-LOOP.md` as the release contract. Every improvement run must:

1. Read the current implementation and latest run ledger before editing.
2. Record the baseline commit SHA and test evidence.
3. Identify one measurable weakness in each applicable phase.
4. Rank weaknesses by user impact, regression risk, and dependency order.
5. Improve behavior before decoration.
6. Keep each commit focused and reversible.
7. Run structural checks after every commit.
8. Run browser checks after any interaction, rendering, persistence, import/export, or accessibility change.
9. Reject or revert changes that break selection, transforms, persistence, portability, clean startup, or keyboard access.
10. Update the run ledger with evidence, regressions, remaining risks, and the next highest-value action.

## Improvement-session protocol

Use one working branch for the session and multiple focused commits on that branch. Do not open a new branch for each commit.

Recommended loop:

1. `node scripts/ui-loop-audit.mjs --strict`
2. Open `index.html` and run the built-in `selftest_run()` harness.
3. Capture baseline screenshots at desktop and constrained-width breakpoints.
4. Select the highest-value passing increment from the run ledger.
5. Implement the smallest complete behavior slice.
6. Re-run structural and browser verification.
7. Record evidence in `docs/runs/YYYY-MM-DD-ui-loop.md`.
8. Commit only when the increment passes.
9. Continue with the next safe increment until the session ends or a real blocker is documented.

## Non-negotiable release gates

Do not mark a phase `Complete` by assertion. Completion requires reproducible evidence in the run ledger.

A release may not merge when any of these regress:

- clean browser startup
- console or page errors
- object placement or movement
- selection and editor synchronization
- duplicate, delete, rotate, undo, or redo behavior where implemented
- local persistence or import/export round-trip
- keyboard focus and focus-visible behavior
- current self-tests
- structural audit

## Architecture discipline

- Preserve one canonical app and one canonical state model.
- Prefer extraction and adapters over duplicate implementations.
- Do not introduce a framework, build system, CDN, connector, or service unless it removes more complexity than it adds and the decision is documented.
- Keep optional integrations outside the application core.
- Store secrets and private data outside Git.
- Keep user-facing copy centralized.
- Add tests before expanding fragile behavior.

## Definition of a useful run

A useful run produces at least one of the following:

- a verified behavior improvement,
- a regression fix with a reproducer,
- a measurable performance/accessibility improvement,
- a new automated gate that catches a real failure mode,
- or a documented blocker with enough evidence for the next agent to resume immediately.

A visual-only pass without behavioral evidence does not satisfy the loop.