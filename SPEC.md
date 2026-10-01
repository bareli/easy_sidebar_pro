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
custom (non-panel) links. (Theming, collapse options and pinned icons were added in v0.3, see section 7.)

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
- v0.3 adds optional keys (layouts without them load with the defaults; the server returns the full form):
  `groups.<id>.color` / `icon_color` (null, a named theme colour or `#rrggbb`), `grid` (pinned panels,
  at most 20) and `settings` `{start_collapsed, accordion, toggle_all, header: plain|tinted|line,
  divider: line|none}`. See section 7.
- `order`: top-level entries, a panel `url_path` or `g:<group id>`.
- Rules: version 1; group id `[a-z0-9]{1,16}`; every group appears in `order` exactly once and
  every `g:` entry exists; a panel appears at most once in the whole layout (order, groups and grid); name 1-50 chars, no
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

## 7. v0.3: styling, collapse settings, pinned grid (issues #27, #28, #29)

Requested for parity with Sidebar Organizer. Everything is part of the layout (per user, admin default),
edited in the in-sidebar editor, validated by `layout.py` and mirrored in `layout.js`.

### 7.1 Colours and styles (#27)
- Per group `color` (header name, guide line, "line above") and `icon_color` (header icon, member icons;
  the header icon falls back to `color`). Values: null, a named HA theme colour (`primary`, `accent`,
  `red`, `pink`, `purple`, `indigo`, `blue`, `cyan`, `teal`, `green`, `lime`, `amber`, `orange`, `brown`,
  `grey`, drawn as `var(--<name>-color)`, so themes redefine them per mode) or `#rrggbb` (`#rgb` is
  expanded, output lowercase). Anything else is refused (`invalid_format`).
- Contrast: the frontend resolves the colour and the sidebar background / text of the current theme
  (re-read when `hass.themes` changes; a theme or light / dark change re-renders the sidebar, which
  HA's own sidebar does not do) and mixes the colour toward the theme's text colour only as far
  as needed: 4.5:1 for the name (on the tinted header background when used), 3:1 for icons and lines.
- `settings.header`: `plain` | `tinted` (background = 14% of the group colour, or a neutral tint) |
  `line` (a line above each group, not above the first row). `settings.divider`: `line` | `none` (the
  guide line beside grouped items).
- Theme CSS variables (lower precedence than a group's own colour): `--esp-group-header-text-color`,
  `--esp-group-header-icon-color`, `--esp-group-header-background`, `--esp-group-header-radius`,
  `--esp-group-divider-color`, `--esp-group-divider-width`.

### 7.2 Collapse settings (#28)
- `start_collapsed`: on each page load every group starts folded; folding is kept in the page only (not
  written to the server, so devices do not fold each other). Turned on during a session, the current
  state is kept until the next load.
- `accordion`: opening a group folds every other shown group. "Expand all" would break that, so with
  `accordion` the `toggle_all` button only collapses: it is shown while a group is open and hidden when
  every group is folded.
- `toggle_all`: a collapse all / expand all button next to the sidebar title (expanded sidebar only,
  two or more groups). Off by default: it shortens the title. The title takes its direction from its own
  text (`unicode-bidi: plaintext`), so a Latin name in a Hebrew UI is cut at its end ("Home Assi...").
  Collapse all when any group is open, expand all otherwise; stored like a click (or page-only with `start_collapsed`).

### 7.3 Pinned grid (#29)
- `grid`: panels shown as icons at the top of HA's fixed (bottom) list, above Settings / Notifications /
  profile. Rendered by patching `_renderFixedPanels` (feature-detected; without it pinned panels stay
  in the main list) with HA's own `_renderPanel` rows, so icons, selection, navigation and HA's list
  keyboard handling are native. The fixed list wraps rows (`flex-flow: row wrap`) while it holds pins;
  four cells per row in the expanded sidebar, one column in the icon-only rail.
- Tooltips: HA draws row tooltips only in the rail; pinned rows are rendered as if icon-only (a view
  object with `alwaysExpand: false`) so they get HA's tooltip, placed on top in the expanded grid.
- Keyboard: Left / Right along a row (mirrored in RTL), Up / Down by grid row, Down from the last row to
  the next HA row (capture-phase handler on the fixed list; HA's own keys for everything else).
  Screen readers: each pinned row keeps its name and gets `aria-describedby` "Pinned".
- Editor: a "Pinned at the bottom" block, always last; drop panels into it like a group; a group dropped
  on it lands above it; at most 20 items (drops refused when full); Alt + Down from the last row pins.
  Hidden pinned panels are not shown. HA's native `panelOrder` lists pinned panels last. An order saved
  in HA's Edit sidebar dialog re-sorts the pinned panels by their relative order there (like group
  members); they stay pinned wherever HA lists them.

### 7.4 Sidebar Organizer options not taken
- Sidebar background / scrollbar colours, width, text transform, custom theme per sidebar: HA themes
  already do these. Per-mode colour pairs: replaced by theme colours plus automatic contrast.
- Bottom items as full rows / bottom groups, custom (non-panel) items with actions, visibility and
  notification templates, YAML config file: out of scope for this release.
- Animations (delay / off): no slide animation is added.
