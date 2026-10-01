# Easy Sidebar Pro — Specification

Home Assistant custom integration (HACS) that organizes the sidebar into collapsible groups, edited
in place with drag and drop. Hebrew and English, RTL aware.

## 1. Problem

The HA sidebar is a flat list. With many dashboards and add-on panels it gets long. HA's own
"Edit sidebar" dialog only reorders and hides. Sidebar Organizer (ngocjohn) adds groups, but:
configuration lives in a separate dialog (no editing in the sidebar itself), groups are created by
name + picker, the layout is stored in the browser's localStorage (not per HA user), the groups
appear ~6 s after load (DOM patching after render), and using HA's native editor resets it.

## 2. Goals (v0.1)

1. **Groups** in the sidebar: header row (chevron, icon, name), click to collapse / expand. A
   collapsed group that holds the current page is highlighted.
2. **Edit mode inside the sidebar**: a pencil button in the sidebar header turns the panel list into
   an editor. Drag handles on every row.
   - Drop between rows: move (into a group, out of a group, reorder groups).
   - **Drop one panel onto another panel: creates a group** holding both, name field opens focused.
   - Drop a panel onto a group header: append to that group.
   - Per row: hide / show (HA's native hidden list). Per group: rename, icon (text field with live
     preview + common icons), ungroup (its panels take its place; there is no separate delete).
   - Done (save) / Cancel. Keyboard: Alt+Arrow moves the focused row; screen reader announcements.
3. **Per user, server side**: each HA user's layout and collapsed state is stored by the
   integration, so it follows the user to every device and the companion app.
4. **Admin default**: an admin can publish their layout as the default. Users without their own
   layout see the default; editing forks it; "Reset to default" drops the fork.
5. **Native compatible**: order and hidden panels are also written to HA's own `sidebar` user data,
   so HA's native dialog and devices see a consistent order. Hidden panels are always HA's native
   list (one source of truth).
6. **No flicker**: groups render inside HA's own Lit render cycle (prototype patch of `ha-sidebar`),
   never DOM-patched after the fact.
7. **Zero YAML**: the integration registers its JS with `frontend.add_extra_js_url`.

Non-goals v0.1: nested groups, per-device layouts, group visibility per user role, theming options,
custom (non-panel) links.

## 3. Architecture

### 3.1 Integration (`custom_components/easy_sidebar_pro`)
- `manifest.json`: `single_config_entry`, config flow with a single confirm step,
  `integration_type: service`, `iot_class: calculated`. Dependencies: frontend, http, websocket_api.
- On entry setup: static path `/easy_sidebar_pro_static` → `www/`, `add_extra_js_url(
  /easy_sidebar_pro_static/easy-sidebar-pro.js?v=<version>)`. Unload removes the URL. A browser
  refresh is needed after install / removal (the frontend reads the list on page load).
- `store.py`: `.storage/easy_sidebar_pro` = `{default: Layout|null, users: {user_id: {layout:
  Layout|null, collapsed: [group_id]}}}`, delayed save (1 s).
- `layout.py`: pure validation (server side; the panel validates too).
- `websocket.py`:
  - `easy_sidebar_pro/subscribe` (any user): event `{layout, default, collapsed, own, is_admin}`
    now and on every change of this user's record or the default.
  - `easy_sidebar_pro/save` `{layout}`: validate, store as the user's own layout.
  - `easy_sidebar_pro/collapsed` `{collapsed}`: store the user's collapsed group ids.
  - `easy_sidebar_pro/reset`: drop the user's own layout (back to the default).
  - `easy_sidebar_pro/default/set` `{layout|null}`: **admin only**; null clears.
  - Error codes: `invalid_format` (with message), `unauthorized`.

### 3.2 Layout format (v1)
```json
{
  "version": 1,
  "order": ["lovelace", "g:a1b2c3", "map"],
  "groups": {"a1b2c3": {"name": "בית", "icon": "mdi:home", "panels": ["calendar", "todo"]}}
}
```
- `order`: top-level entries, a panel `url_path` or `g:<group id>`.
- Rules: version 1; group id `[a-z0-9]{1,16}`; every group appears in `order` exactly once and
  every `g:` entry exists; a panel appears at most once in the whole layout; name 1-50 chars, no
  control characters; icon `prefix:name` (≤64) or null; panel path `[A-Za-z0-9_-]{1,100}`; at most
  50 groups, 500 entries total.
- Panels the layout does not mention (new dashboards, new add-ons) appear at the end of the top
  level, in HA's order. Layout entries for panels that no longer exist are ignored (kept, so an
  add-on that is temporarily off keeps its place).
- Empty groups are allowed in the editor and hidden outside it.

### 3.3 Frontend (`www/`)
- `layout.js`: pure functions (tree build, move, merge, ungroup, flatten, arrange for view).
  Unit tested with `node --test`.
- `easy-sidebar-pro.js`: waits for `ha-sidebar`, patches its prototype:
  - `_renderPanels(panels, selected)` returns the arranged list: HA's own `_renderPanel` results
    plus our `<esp-group>` header elements; panels of a collapsed group are omitted. In edit mode it
    returns one `<esp-editor>` element instead.
  - `shouldUpdate` re-renders when our data changes; `updated` marks grouped rows
    (`data-esp-group`) for indentation and inserts the pencil button into the header.
  - Feature detection: if `_renderPanels` / `_renderPanel` are missing (future HA change) the patch
    is skipped and the sidebar stays native.
- `<esp-group>` joins HA's list keyboard navigation (`ha-list-item-register`), `aria-expanded`,
  tooltip name when the sidebar is icon-only.
- `<esp-editor>`: own shadow DOM. Pointer-event drag (mouse, touch, pen), ghost row, drop indicator
  (line = between, outline = onto), auto-scroll near the list edges. Drop zones on a panel row: top
  30% before, bottom 30% after, middle = group with it (on a grouped panel: middle = after). A group
  is never dropped into a group.
- Language from `hass.language` (he / en); direction follows the sidebar's computed direction.
- The editor sets `user-select: text` (HA's sidebar sets `none`, which blocks typing in inputs).
- HA's `ha-icon-picker` is not used: its popover did not take keyboard input inside the sidebar.
- Until our layout arrives (≤1.5 s) the panel list renders empty instead of flat, so the flat
  order never flashes.

## 4. Compatibility
- Built against HA frontend 2026.9 (`ha-list-nav`, `ha-list-item-button`, introduced May 2026).
  `hacs.json` minimum 2026.9.0 until older versions are tested.
- Sidebar Organizer: do not run both (both patch the sidebar). README says so.

## 5. Quality
- Python tests (pytest-homeassistant-custom-component): setup / unload, extra JS URL, WS commands,
  validation, admin check, subscription events, persistence across reload.
- JS tests: layout operations.
- Manual / Playwright on a dev HA: render, collapse, edit mode drag and drop (mouse + touch
  emulation), RTL Hebrew user, narrow screen, keyboard.
- Release flow as Good Days (CHANGELOG, tag, GitHub release, HACS validation in CI).

## 6. Decisions (owner, 2026-10-01)
- Ships as an integration (auto-loads the JS, holds the admin default).
- Layout per user, stored server side, with an admin default.
- Edit mode entry: pencil button in the sidebar header; HA's long-press keeps opening HA's dialog.
