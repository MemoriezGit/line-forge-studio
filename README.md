# Line Forge Studio — Station Layout Builder

Plan kitchen and restaurant station layouts in the browser: drag real-scale equipment
from a palette onto a canvas, arrange/rotate/duplicate it, and export the layout as JSON.

**Single-file vanilla app** — the entire tool (markup, styles, script) lives in
[index.html](index.html). No build step, no dependencies, no CDN scripts.

## Run

Open `index.html` in a browser. That's it.

A marketing/landing page lives in [landing.html](landing.html).

## Features

- **Palette → canvas placement** with Pointer Events (no HTML5 drag-and-drop) —
  works with mouse, touch, and pen.
- **Real equipment scale** — pans, rails, wells, and tables modeled at a consistent
  prototype scale (rail/well depths match the pans that sit in them).
- **Edit tools** — select, move, rotate (width/height swap), duplicate, delete,
  arrow-key nudge, snap-to-grid.
- **Visual collision hints** — overlapping items get a dashed outline; overlap is
  allowed by design and never blocks placement.
- **Persistence** — layouts auto-save to `localStorage`; JSON import/export for
  sharing and backup.
- **Keyboard shortcuts** — save, print, duplicate, rotate, delete, nudge
  (gated by `FEATURE_FLAGS.keyboardShortcuts`).
- **Built-in self-tests** — `selftest_run()` executes on load (when
  `FEATURE_FLAGS.selftest` is on) and prints PASS/FAIL results to the devtools console.

## Architecture (short)

One global `STATE` object is the source of truth. Function-name prefixes enforce the
conventions: `action_*` are the only mutators (each ends in `action_commit()`),
`select_*` are pure selectors, `render_*` are pure DOM builders re-run in full on every
commit, `util_*` are pure helpers, `handle_*`/`pointer_*`/`keyboard_*` own events.
All user-facing strings live in `COPY`; optional behavior is gated by `FEATURE_FLAGS`.

See [CLAUDE.md](CLAUDE.md) for the full conventions and contributor gotchas.

## Releases

- **v0.1.0** — action fixes, accessibility pass, expanded self-tests, visual polish
  (icons, type glyphs, CSS token system, canvas illustrations).
