# Historical risk areas (where it actually broke)

Map changed files to tests through this list.

| Area | Code | What broke (cycle 2026-10-01, v0.1.0) | Plan IDs |
|---|---|---|---|
| HA list registration | `www/easy-sidebar-pro.js` (afterUpdate, EspGroup) | HA list items unregister from `disconnectedCallback`, after leaving the tree, so `ha-list-nav` kept every replaced row: memory leak per editor cycle and arrow keys stuck on stale rows (PERF-003 / NATIVE-03). Any change that makes Lit recreate panel rows can bring it back. | PERF, NATIVE-03 |
| Keys inside HA's sidebar header | pencil button in `.menu` | HA's `.menu` cancels Enter/Space: the editor could not be opened by keyboard (BUG-003, HIGH). Anything appended inside `.menu` must stop keydown, not only pointer events. | KBD, A11Y |
| Editor re-render | `EspEditor` | Full rebuild on rename/blur dropped focus and ate the next click (BUG-004, BUG-009) and lost `aria-invalid` (BUG-005). Keep updates in place; pass a focus key when a rebuild is unavoidable. | EDIT-03/07 |
| Drop targets | `_updateTarget`, `_dragEnd` | Stale target after leaving the list moved rows (BUG-011); empty-group placeholder not a target (BUG-012). | DND-01..09 |
| Native sidebar sync | `save`, `nativeSidebar`, UX-002 adoption | Save deleted HA's hidden/order entries for panels not listed right now (BUG-013). Adoption of HA's order must not loop with our own writes. | PERSIST-01, NATIVE-01 |
| Store lifetime | `websocket.py` subscribe | Subscriptions captured the old store across an entry reload (BUG-010). | PERSIST-02 |
| Validation parity | `layout.py` vs `www/layout.js` | `re.match(...$)` accepted trailing newlines; Cf/C1 characters passed one side and failed the other (SEC-001/002, BUG-014). Keep server and client rules identical; use `fullmatch`. | WS-02, EDIT-03 |
| Colours | editor CSS | HA's default primary (#009ac7) fails 4.5:1 for text and white-on-primary (BUG-006). Derive darker variants; test light + dark + an orange theme. | A11Y |
| Stacking inside HA's list | sticky bar | `ha-list-nav`'s inner `.base` is `overflow:hidden auto` but never scrolls, so `position: sticky` inside it never sticks (BUG-001). | MOBILE-01 |
| Reflected attributes | icon-only detection | HA reflects `expanded` only in `updated()`; read `alwaysExpand` during render (BUG-002). | RND-05 |

## Added by the v0.5 cycle (2026-10-09)

| Area | Code | What broke | Plan IDs |
|---|---|---|---|
| Text length parity | `cleanName`, `cleanAliases`, `validUrl`, input `maxlength` | JS counts UTF-16 units, Python code points: an emoji cut in half at the limit produced a lone surrogate and HA dropped the websocket (BUG-020). Count code points on both sides. | EDIT-18 |
| Option fields vs Done | editor ⋮ options | A field showing an error did not stop Done: the bad value was silently dropped (BUG-021). Every inline error must block Done like the group name does. | EDIT-27, EDIT-30 |
| Regex flags | `layout.py` URL_EXTERNAL | `re.IGNORECASE` folds `ſ` to `s`: server accepted `httpſ://`, client refused (SEC-003). Keep scheme matching ASCII. | WS-05 |
| Tab strip placement | `syncTabs`, TABS_CSS | A transform on HA's resolver made the header and the strip scroll away on long pages (v0.4); the strip on the bottom was painted over by the page's layer. Fixed in v0.5 with fixed position + safe-area insets. | MOBILE-03 |
| Lifecycle patches | `patch()` connected/disconnected | Custom elements capture lifecycle callbacks at `define()`: wrapping them on the prototype later never runs (PERF-006). | PERF |
