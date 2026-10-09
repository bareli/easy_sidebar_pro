# PERF-005 Each navigation renders the sidebar two extra times: the location-changed listener refreshes on every event although nothing changed

| | |
|---|---|
| Type | PERFORMANCE OPTIMIZATION |
| Severity | LOW |
| Evidence basis | MEASURED |
| Status | OPEN - not filed (this run was told not to file issues) |
| Issue | [#50](https://github.com/bareli/easy_sidebar_pro/issues/50) |
| Feature | `Controller.onLocation` (links, v0.5) |
| Test case | PERF |
| Environment | dev, instance 8175, HA 2026.9.4, Playwright Chromium headless, 61 sidebar panels, 20 groups, 30 links, warm |
| Branch / commit | feature/links-search-badges d381a73 (v0.5.0) |
| Detected by | qa-performance-engineer |
| Detected | 2026-10-09 |
| Model | model:sonnet |

## Observed

With at least one link in the layout, `onLocation` calls `refresh()` on every `location-changed` and `popstate`. HA fires `location-changed` twice per sidebar click, so each navigation costs two forced renders in addition to HA's own.

## Measurement

Real mouse click on a sidebar row (`perf-nav3.mjs`, 8 navigations), counting `updated` and `_renderPanels` calls (HA calls `_renderPanels` twice per update) and `location-changed` events on `window`:

| per click | ESP v0.5 | native (module blocked) |
|---|---|---|
| location-changed events | 2 | 2 |
| `updated` | 3 to 4 | 1 to 2 |
| `_renderPanels` | 6 to 8 | 2 to 4 |

`requestUpdate` stacks for one navigation (`perf-nav2.mjs`): `Controller.refresh < onLocation` twice, plus HA's own `hass` and `route` setters.

Cost (`perf-nav.mjs`, synthetic `location-changed`, 20 panel navigations): `_renderPanels` 1.13 ms and `updated` 1.07 ms per navigation with the module; 0.07 and 0.02 ms native. Small in absolute terms; the extra renders also repeat the layout and paint cost of PERF-004.

## Baseline

None for v0.4.

## Scale implication

Navigation is a user action, not a stream, so about 2 to 3 ms extra per click is not a problem at the scale target. It matters only on slow wall tablets and when views are switched quickly. Optimization, not a defect.

## Likely root cause

`onLocation` neither compares the new `location.pathname` with the one the last render used nor coalesces the two events.

## Recommended remediation

Remember the link `L.linkAt(links, location.pathname)` used by the last render; refresh only when it differs. HA already re-renders for the route change itself.

## Suggested regression

Playwright: click a panel row with a link in the layout, count `updated` calls; expect at most native's plus one.
