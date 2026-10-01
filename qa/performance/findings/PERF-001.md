# PERF-001 Layout save validates the whole payload before the entry cap: one authenticated user can block the event loop for about 200 ms per 4 MB message

| | |
|---|---|
| Type | PERFORMANCE RISK |
| Severity | LOW |
| Evidence basis | MEASURED (validator in isolation); the full websocket path was not measured |
| Status | DRAFT - claimed 2026-10-01, not yet filed (orchestrator files) |
| Issue | |
| Feature | WS `easy_sidebar_pro/save` and `default/set`, `layout.py` `validate_layout` |
| Test case | PERF |
| Environment | dev (no instance involved; module run directly, Python 3.14.3, Windows) |
| Branch / commit | b68d6f8 |
| Detected by | qa-performance-engineer |
| Detected | 2026-10-01 |
| Model | model:sonnet |

## Summary

`validate_layout` walks every element of `order` (and every group's `panels`) and only compares the
total with `MAX_ENTRIES` (500) after the loops finish. `ws_save` is a `@callback`, so validation runs
on the HA event loop. The only size bound is the websocket message limit. A non-admin user (or a
buggy client) can send a layout with hundreds of thousands of unique one-token entries; it is rejected
("at most 500 entries") but only after the whole list was processed.

## Measurement

Method: imported `layout.py` and `const.py` directly, called `validate_layout({"version":1,"order":[f"p{i}" ...],"groups":{}})` with unique names (duplicates raise early). Single run each, warm interpreter, no HA.

| entries | JSON size | validate_layout | result |
|---|---|---|---|
| 500 | 3.9 KB | 0.3 ms | ok |
| 100 000 | 0.99 MB | 44.2 ms | rejected after the loop |
| 400 000 | 4.29 MB | 201.9 ms | rejected after the loop |

Not measured: the JSON decode of the message, nor the real event-loop stall on a running HA. The 4 MB
figure is the websocket frame limit I believe HA applies; I did not verify it on this instance.
Single-run numbers on a developer machine, so treat as order of magnitude.

## Expected

Cheap rejection: cap `len(order)` and each `len(panels)` (and `groups`, already capped at 50) before iterating.

## Actual

Cost is linear in the attacker-chosen payload size, paid on the event loop, before the cap applies.

## Scale implication

At the scale target (10 users, 500-entry cap) legitimate use costs 0.3 ms. The risk is only abuse or a
client bug: roughly 0.2 s of stalled HA per large message, repeatable.

## Recommended remediation

In `validate_layout`: `if len(order) > MAX_ENTRIES: raise LayoutError(...)` before the loop; same for `len(panels)` per group, and fail as soon as `total` exceeds the cap inside the loop. Optionally set a smaller `max_message_size` is not available per command, so the early cap is the fix.

## Suggested regression

pytest: a 100 000-entry order is rejected with "at most 500 entries" and does not iterate the list (assert it fails in under a small bound, or assert the check order with a list subclass counting `__iter__`).

## Relevant files

`custom_components/easy_sidebar_pro/layout.py` (lines 42-99), `websocket.py` (`ws_save`, `ws_default_set`).
