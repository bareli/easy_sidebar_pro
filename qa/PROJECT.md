# QA project profile: Easy Sidebar Pro

The global QA kit (`~/.claude/qa-kit/`) holds process only. Everything that is true of THIS product
lives here and in `qa/CLAUDE.md` (environments, instances, traps) and `qa/knowledge/` (what QA learned).

## Product

- Name: Easy Sidebar Pro  (code: domain `easy_sidebar_pro`, frontend module `easy-sidebar-pro.js`,
  custom elements `esp-group`, `esp-editor`)
- What it does: a Home Assistant custom integration (installed through HACS) that adds collapsible
  groups to the HA sidebar. A pencil next to the sidebar title switches the panel list into an
  in-place editor: drag rows, drop one row onto another to create a group, rename, pick an icon,
  ungroup, hide / show panels. Layouts are stored per HA user on the server; an admin can publish a
  default layout. Hebrew and English.
- Owner (rules on UX/ENH decisions): Victor (Bar Eli), repo owner `bareli`.
- Production URL: none. There is no hosted service; "production" is each user's own Home Assistant.
  QA never touches anyone's real Home Assistant.
- Deploy: GitHub release → users update through HACS. A push is not a release.
- Spec: `SPEC.md`; architecture notes: root `CLAUDE.md` (git-ignored, local).

## Users

- Home Assistant owners and their household members. Admin users configure; non-admin users (family)
  can organise their own sidebar.
- Devices: desktop browser (mouse), wall tablets and phones (touch, HA companion app, narrow drawer
  sidebar). Many users have 10-40 sidebar panels (dashboards, add-ons, built-in panels).
- Expertise: from tinkerers to non-technical family members. Editing is occasional; the folded
  sidebar is seen every day.

## Locale

- Hebrew (right-to-left) and English. The owner is Hebrew-first; test both, Hebrew first.
- Language follows the HA user's language setting (`hass.language`); direction follows HA.
- Realistic content: Hebrew group names ("בית", "תקשורת", "מצלמות"), mixed Hebrew / English panel
  titles, long names (40-50 characters), many panels.

## Stack

- Python integration (HA custom component): config flow, `Store`, websocket commands, static path,
  `frontend.add_extra_js_url`. No entities, no database.
- Frontend: vanilla JS ES modules, no build step. Patches the prototype of HA's `ha-sidebar` (Lit)
  at runtime; own custom elements with shadow DOM. Pure model in `www/layout.js`.
- Persistence: `.storage/easy_sidebar_pro` (per-user layouts + admin default), plus HA's own
  `frontend/set_user_data` key `sidebar` (panelOrder, hiddenPanels).

## Paths

- Application code (read-only for everyone except qa-developer): `custom_components/easy_sidebar_pro/`
- Test project (finders may add a failing regression test only): `tests/` (pytest), `tests_js/`
  (node --test)
- Build / test commands: no build. Python: see `qa/CLAUDE.md` §3. JS: `npm test`.

## Roles

engineer, ux, accessibility (drag-and-drop editor, keyboard alternative, screen reader), security
(websocket authorization, stored strings rendered in every user's sidebar), performance (the patch
runs on every sidebar render; HA re-renders the sidebar on state changes), developer. All apply.

## Always in scope

- Authorization: only admins set or clear the default layout; a user's save, reset and collapsed
  state touch only that user's record; one user's change never reaches another user's sidebar
  (except the default, by design).
- HA compatibility: the native sidebar keeps working (navigation, HA's own long-press edit dialog,
  notifications, settings, profile), and the integration switches itself off cleanly if HA's
  internals are missing.
- Input validation on the server (`layout.py`) for every websocket write.

## Business outcomes

- Save: `.storage/easy_sidebar_pro` → `users.<user_id>.layout` updated; HA user data `sidebar`
  gets the flattened `panelOrder` and `hiddenPanels`; every open browser of that user updates live.
- Collapse: `users.<user_id>.collapsed` updated; survives reload and other devices.
- Set default (admin): `default` updated; users without their own layout see it live.
- Reset: `users.<user_id>.layout` = null; the user sees the default.
- Remove integration: the module URL is removed; after a browser refresh the sidebar is native.

## Security shape

- No public routes. All writes go through authenticated HA websocket commands.
- `default/set` is admin-only (`require_admin`). Other commands act on `connection.user`.
- Stored strings (group names, icons, panel paths) are shown in other users' sidebars (via the default
  layout) → rendering must never interpret them as HTML.
- No personal data beyond HA user ids; no third-party credentials.

## Deliberate behaviour

- Hidden panels are HA's native list for everyone; the admin default does not hide panels for others.
- A panel missing from HA (add-on switched off) keeps its place in the stored layout but is not shown.
- Empty groups exist in the editor and are not shown in the normal sidebar.
- Up to 1.5 s after page load the panel list may render empty while the layout loads (instead of a
  flat list flashing). See SPEC §3.3.
- The default dashboard cannot be hidden (HA rule); its eye button is disabled.
- Requires HA 2026.9+ (`hacs.json`); older versions are not supported.

## Accessibility

WCAG 2.1 AA. Drag and drop must have a keyboard alternative (WCAG 2.5.7 / 2.1.1); state changes are
announced. No national statement page (not a public website).

## Scale target

Up to 60 panels in the sidebar, 20 groups, 3 open browsers per user, 10 users. The sidebar re-renders
on HA state changes (can be several per second on busy systems).

## Fix constraints

- No `console.log`, no `innerHTML` in `www/` (enforced by `tests/test_conventions.py`).
- Server-side validation is authoritative; the editor validates too.
- Hebrew and English strings together; the `STRINGS` tables must keep the same keys.
- Do not depend on more HA internals than needed; every internal used must be feature-detected.
- Release flow: CHANGELOG, version in `manifest.json`, owner is asked "anything else for this version?"
  before a tag.

## Test ID series

`RND` (rendering in the sidebar), `GRP` (groups, collapse), `EDIT` (editor operations), `DND`
(drag and drop, mouse and touch), `KBD` (keyboard), `PERSIST` (storage, sync, default, reset),
`NATIVE` (HA compatibility), `WS` (websocket API), `I18N` (Hebrew / English, RTL), `MOBILE`,
`UX`, `A11Y`, `SEC`, `PERF`.

## Leak terms

- easy sidebar pro
- easy_sidebar_pro
- easy-sidebar-pro
- esp-editor
- esp-group
- bareli/easy_sidebar_pro
