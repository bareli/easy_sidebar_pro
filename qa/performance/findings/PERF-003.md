# PERF-003 Opening and closing the editor leaks the native panel buttons: about 3,800 DOM nodes and 0.4 MB per cycle, never released

| | |
|---|---|
| Type | PERFORMANCE BUG |
| Severity | LOW |
| Evidence basis | MEASURED |
| Status | DRAFT - claimed 2026-10-01, not yet filed (orchestrator files) |
| Issue | |
| Feature | Editor (`Controller.startEdit` / `stopEdit`, `render()` returning `[this.editor]`) |
| Test case | PERF |
| Environment | dev, instance 8140, HA 2026.9.x, Playwright Chromium headless, 61 panels, 20 groups (qa_admin layout), warm |
| Branch / commit | b68d6f8 |
| Detected by | qa-performance-engineer |
| Detected | 2026-10-01 |
| Model | model:opus |

## Observed

Each open-editor then Cancel cycle leaves the 61 native `ha-list-item-button` elements (and their `ha-icon` children) detached but still referenced, so the garbage collector cannot free them. Growth is linear and does not recover when idle.

## Measurement

Method: page loaded, 3 s settle, then 20 cycles of click pencil, wait 200 ms, click Cancel, wait 200 ms. Before each reading: `HeapProfiler.collectGarbage` (twice); numbers from `Performance.getMetrics`.

| cycles | JS heap | DOM nodes | JS event listeners |
|---|---|---|---|
| 0 | 13.8 MB | 8 346 | 1 353 |
| 1 | 14.9 | 14 401 | 1 783 |
| 2 | 15.2 | 18 165 | 1 905 |
| 5 | 16.1 | 29 367 | 2 271 |
| 10 | 18.1 | 48 187 | 2 881 |
| 20 | 21.8 | 85 827 | 4 101 |
| 20 + 5 s idle | 21.8 | 85 827 | 4 101 |

Separate run, `Runtime.queryObjects` alive/connected after 10 cycles (0 cycles in brackets): `ha-list-item-button` 674/64 (64/64), `ha-icon` 709/78 (78/78), `esp-group` 20/20 (20/20), `esp-editor` 1/0.

Control, module blocked (native sidebar): forced `_renderPanels` to return `[]` and back 10 times, so the native buttons are removed and recreated the same way. `ha-list-item-button` stays 64/64 and `ha-icon` 58/58, so removal alone does not leak; something in the module's editing path retains them. The retainer is NOT identified (no heap snapshot taken). Hypotheses, unverified: the `ha-list-nav` item registry interacting with the `esp-group` register/unregister events, or the controller/editor holding references.

Also measured, no leak: 10 drags of a group handle with 30 pointer moves each: nodes 85 240 to 85 241, listeners 3 552 to 3 552, heap 21.8 to 21.9 MB. (The 500 ms per drag in the run is Playwright round-trip time, not a cost figure.)

## Scale implication

Editing is occasional, so this is slow growth: about 0.4 MB per edit session (8 MB over 20). A wall tablet that stays open for weeks with a few edits a day would accumulate tens of MB; I did not measure that duration. It also scales with panel count (61 buttons per cycle here).

## Recommended remediation

Find the retainer with a heap snapshot after 3 cycles (look at retainers of a detached `ha-list-item-button`), release it on `stopEdit`. Likely candidates are listed above.

## Suggested regression

Playwright test: 10 open/Cancel cycles, `queryObjects` for `ha-list-item-button` after GC, assert alive count stays under connected + a small margin.

## Manager's hypothesis (unverified, I'm speculating)

HA's list items fire `ha-list-item-unregister` from `disconnectedCallback`, i.e. after they left the
tree, so the event never reaches the `ha-list-nav`; the list keeps every removed item in its `items`
array. Native HA rarely replaces its panel buttons, but the editor (and possibly re-arranging rows)
makes Lit drop and recreate every `ha-list-item-button`, so the list accumulates detached buttons.
This would also explain NATIVE-03 (functional review): ArrowDown held focus on the same row for
three presses, as if the roving-tabindex list had stale entries. Check `listNav.items.length` vs
connected items after a few editor cycles before designing the fix.
