# PERF-004 Every sidebar update, even for entities the layout never reads, forces layout and repaint (about 4 ms per update, 4x native)

| | |
|---|---|
| Type | PERFORMANCE RISK |
| Severity | LOW |
| Evidence basis | MEASURED |
| Status | OPEN - not filed (this run was told not to file issues) |
| Issue | [#49](https://github.com/bareli/easy_sidebar_pro/issues/49) |
| Feature | Group header `EspGroup.update`, `Controller.afterUpdate` |
| Test case | PERF |
| Environment | dev, instance 8175, HA 2026.9.4, Playwright Chromium headless, 61 sidebar panels (50 extra dashboards), 20 groups, 30 links, 20 badges, 10 show_when, search on, warm |
| Branch / commit | feature/links-search-badges d381a73 (v0.5.0) |
| Detected by | qa-performance-engineer |
| Detected | 2026-10-09 |
| Model | model:sonnet |

## Observed

HA re-renders `ha-sidebar` on every `hass` change (native does too: 279 of 279 state changes gave `shouldUpdate` true with the module blocked). With the module, each of those updates also forces layout and paint, which native does not. Not caused by `statesChanged()`: the churn entities were not in the layout.

## Measurement

Method: 15 s of `counter.increment` at 10/s on three counters the layout does not read (150 updates), Chrome trace (`devtools.timeline`), summed event durations. Same page; module blocked for the native run (`qa/performance/scripts/perf-trace.mjs`, `MODE=native NATIVE=1`).

| | ESP v0.5 | native (module blocked) |
|---|---|---|
| RunTask total | 757 ms | 190 ms |
| Layout | 70 ms / 141 events | 0 ms / 1 |
| UpdateLayoutTree | 13 ms / 141 | 1 ms / 1 |
| Paint | 86 ms / 3102 events | 0 ms / 2 |
| Layerize + Commit | 78 ms | 1 ms |

That is (757 - 190) / 150 = 3.8 ms extra main-thread time per update. The earlier 30 s run (`perf-render.mjs`, 279 updates) agrees: CDP TaskDuration 1589 ms vs 428 ms, LayoutDuration 212 ms vs 0.

Script cost alone is small (in-page timers, 279 updates): `_renderPanels` 0.32 ms avg (native 0.03), `updated` 0.55 ms avg (native 0.008), max 1.8 / 1.5 ms. The cost is mostly the browser doing layout and paint, not our JS.

Cause evidence (`perf-mut.mjs`): a `MutationObserver` on the sidebar shadow root and the 20 `esp-group` shadow roots during 30 updates of unrelated counters recorded 600 `title` writes on `esp-group` hosts, 600 `childList` changes on a span, 600 each of `role` and `aria-label`, 570 `aria-expanded`, 450 `hidden` on the badge span, plus 30 `aria-label` and 30 `title` on the pencil button. That is 20 writes of each kind per update, one per group, with unchanged values. In `EspGroup.update` these are unconditional: `textContent` for name and count, `setAttribute("role"...)`, `aria-label`, `aria-expanded`, `this.title`, `_badge.hidden`. `Controller.afterUpdate` also sets the pencil button's `aria-label` and `title` every time. I did not isolate which write produces the layout (I'm speculating: the `textContent` assignments, which replace the text nodes).

## Baseline

None for v0.4 (not built). Native sidebar is the comparison above.

## Scale implication

Scale target: 60 panels, 20 groups, 3 open browsers per user, "several state changes per second on busy systems". At 10 updates/s the extra cost is about 3.8% of one core per open tab. It grows linearly with update rate and with group count: at 50 updates/s about 19% of a core (arithmetic on the measured 3.8 ms, not measured at that rate). Wall tablets and phones feel it first. Not user-visible at 10/s.

## Likely root cause

Unconditional attribute and text writes in `EspGroup.update` and the pencil block of `afterUpdate`. Rows already write only on change (the code comment in `afterUpdate` says why); groups do not.

## Recommended remediation

Write on change in `EspGroup.update` (compare with the current value, or keep the last row signature and return early when row, lang, iconOnly, rtl, look and header are identical), and in the pencil button block. Re-run `perf-trace.mjs`; target Layout and Paint counts near native when nothing changed.

## Suggested regression

Playwright: 30 updates of an unrelated entity; a `MutationObserver` on the group shadow roots records zero mutations.
