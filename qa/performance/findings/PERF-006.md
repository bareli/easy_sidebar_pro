# PERF-006 Controller cleanup never runs: the ha-sidebar connected/disconnected patches are set on the prototype, which custom elements ignore after define()

| | |
|---|---|
| Type | PERFORMANCE RISK |
| Severity | LOW |
| Evidence basis | MEASURED |
| Status | OPEN - not filed (this run was told not to file issues) |
| Issue | |
| Feature | `patch()` connectedCallback / disconnectedCallback, `Controller.disconnect` |
| Test case | PERF |
| Environment | dev, instance 8175, HA 2026.9.4, Playwright Chromium headless, warm |
| Branch / commit | feature/links-search-badges d381a73 (v0.5.0) |
| Detected by | qa-performance-engineer |
| Detected | 2026-10-09 |
| Model | model:sonnet |

## Observed

`patch()` replaces `p.connectedCallback` and `p.disconnectedCallback` to start and stop the `Controller` (WS subscriptions, `location-changed` and `popstate` listeners, timers). Browsers read a custom element's lifecycle callbacks once, at `customElements.define()`, so replacing them on the prototype later has no effect. `Controller.disconnect()` therefore never runs when the sidebar is removed.

## Measurement

`perf-disc2.mjs`: wrapped `ha-sidebar.prototype.connectedCallback` and `disconnectedCallback` (already the module's patched ones: `__espPatched` true, own property true) with loggers, then removed and re-inserted the real `ha-sidebar` 3 times. Neither logger fired; no window listener add or remove for `location-changed` / `popstate`. `perf-disc.mjs` (5 cycles): only HA's own `frontend/subscribe_user_data` was unsubscribed and resubscribed (HA's own component callbacks run); no unsubscribe or resubscribe of `easy_sidebar_pro/subscribe`.

Not established: whether HA ever discards and recreates `ha-sidebar` in normal use. In my runs 6 narrow/wide viewport switches never disconnected it (0 connected, 0 disconnected callbacks, with and without the module), so on 2026.9.4 a viewport change does not reach this. If HA does recreate it (I'm speculating: some other flow or a future HA version), the old Controller keeps its subscription and window listeners, which keep the old element alive, once per recreation.

## Baseline

None.

## Scale implication

None at the scale target while HA keeps one sidebar element for the life of the page (the observed behaviour). The code and CLAUDE.md describe cleanup on disconnect, which does not happen, so this is a latent leak and a documentation error rather than a measured cost. `shouldUpdate`, `updated` and `_renderPanels` patches do work (Lit looks them up at call time; verified: they are called).

## Likely root cause

Lifecycle callbacks are captured at define() time.

## Recommended remediation

Do not rely on the connected/disconnected patches. Tie cleanup to something the module controls: e.g. `Controller` checks `sb.isConnected` in `afterUpdate` / `connect()`, or a `MutationObserver` on the sidebar's parent. Correct CLAUDE.md / SPEC wording.

## Suggested regression

Playwright: remove the sidebar and assert the module's subscription is unsubscribed and the window listeners are gone (needs a test hook or a WS frame count for `unsubscribe_events`).
