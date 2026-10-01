# PERF-002 Editor rebuilds every row and ha-icon on every change; sidebar patch does per-render DOM work (sustained-render cost not measured)

| | |
|---|---|
| Type | PERFORMANCE OPTIMIZATION |
| Severity | LOW |
| Evidence basis | ANALYTICAL (plus a short load comparison that does not cover this) |
| Status | DRAFT - claimed 2026-10-01, not yet filed (orchestrator files) |
| Issue | |
| Feature | `www/easy-sidebar-pro.js`: `EspEditor.render`, `Controller.render`, `afterUpdate`, drag handlers |
| Test case | PERF |
| Environment | dev (instance 8140 died mid-run; see "Not measured") |
| Branch / commit | b68d6f8 |
| Detected by | qa-performance-engineer |
| Detected | 2026-10-01 |
| Model | model:sonnet |

## Summary

Source-level observations, none shown to be slow. Evidence unavailable - analytical only.

1. `EspEditor.render()` rebuilds the whole bar, list and footer with `replaceChildren` on every `set()`: each rename commit, hide toggle, icon chip click, move and drop. At 61 panels / 20 groups that is about 60 rows x (handle, `ha-icon`, title, eye button) plus 20 group heads, so several hundred elements and 80+ new `ha-icon` elements per interaction. When an icon editor is open it adds 16 chip `ha-icon` elements.
2. `Controller.render()` calls `getComputedStyle(this.sb).direction` on every sidebar render (forces style resolution), and `afterUpdate()` runs a `querySelectorAll` over all panel buttons plus attribute writes on every `updated`, even when nothing in the grouping changed.
3. Drag: each `pointermove` does `_clearMarks` (querySelectorAll), `elementFromPoint`, and `getBoundingClientRect` right after class changes (forced layout); a `requestAnimationFrame` loop also runs for the whole drag.
4. `allPanels()` sorts with `visibleOrder.indexOf` inside the comparator: O(n^2 log n), trivial at 60.

## Measurement

Measured (node v24.9.0, pure model `layout.js`, 60 panels / 20 groups, 20 000 calls after warm-up): `buildTree` 5.4 us, `arrange` 8.3 us, `toLayout` 5.9 us, `moveBy` 9.0 us per call. The model is not a cost.

Measured (Playwright Chromium, instance 8140, 61 sidebar panels, 3 native vs 3 patched cold loads, no layout saved yet so the patched path rendered a flat list; `ha-sidebar` update wrappers injected after load):

| | native | patched |
|---|---|---|
| `_renderPanels` total over the load | 0.4, 0.7, 0.2 ms | 1.7, 1.0, 2.1 ms |
| sidebar Lit updates | 8, 9, 8 | 9, 9, 10 |
| nav appears to first panel rows (ms) | 40, 40, 41 | 72, 25, 56 |
| first panel rows after navigation start (ms) | 397, 427, 294 | 415, 293, 293 |

Three samples each, same machine, noisy; difference between native and patched is within noise for the first paint. No extra render loop seen at load (update counts within +-2).

Sustained run (added after 8140 returned): 60 s, one REST state change every 200 ms (see table), 61 panels, 20-group layout, instance 8140, Chromium headless, warm. Each state change re-renders the native sidebar (updates = changes).

| | native | patched |
|---|---|---|
| sidebar updates | 286 | 284 |
| sum of `performUpdate` | 35.7 ms | 126.6 ms |
| main-thread TaskDuration | 0.303 s | 1.066 s |
| forced layouts (LayoutCount) | 1 | 285 |
| LayoutDuration | 0 | 0.132 s |
| long tasks (>50 ms) | 0 | 0 |
| heap after | 14.4 MB | 14.7 MB |

Single run each. Patched is about 3.5x the main-thread time per state change (about 3.7 ms vs 1.1 ms) and forces one layout per update (likely the attribute writes in `afterUpdate` plus `getComputedStyle`; cause not isolated). Absolute cost is about 1.8% of one core at 5 changes/s; no long task. So this stays an optimization.

Not measured earlier (instance 8140 stopped by HA's own "Pending HTTP config was not confirmed ... restarting" revert at 05:12 and the launcher does not relaunch; I did not restart it): sustained 5 renders/s for 60 s with a 20-group layout, editor open/close x20 heap growth, drag frame cost, websocket reconnect subscription count, the 1.5 s hold with a slow websocket. The editor open/close memory result is filed separately as PERF-003.

## Scale implication

At 60 panels / 20 groups the work per interaction is in the low hundreds of DOM nodes. I expect it to be fine on desktop and to be worth a look only on wall tablets; I am speculating, not measuring.

## Recommended remediation

Only after a measurement shows a long task on a low-end device: patch the editor DOM incrementally (or reuse row elements keyed by `data-key`), cache `rtl` per sidebar (direction attribute change), and skip `afterUpdate` work when `rowGroups` is unchanged.

## Suggested regression

None until a number exists.
