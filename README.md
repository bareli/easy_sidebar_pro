# Easy Sidebar Pro

Collapsible groups for the Home Assistant sidebar, edited right inside the sidebar with drag and drop.
Hebrew and English, right-to-left aware.

**Same layout on every device.** Your groups, order, colours and display settings are stored in Home
Assistant for your user, not in the browser, so the sidebar looks the same on every computer, tablet and
phone, and in the companion app. An admin can press **Set as default for everyone** in the editor to give
the same layout to every user who has not made their own.

![Icon](custom_components/easy_sidebar_pro/brand/icon.png)

## What it does

- **Groups**: a header row with an icon and a name. Click it to fold or unfold. A folded group that
  holds the page you are on is highlighted, so you always know where you are.
- **Edit in place**: press the pencil next to the sidebar title. Every row gets a drag handle.
  - Drop a row **onto** another row to create a group with both. Type the name right away.
  - Drop a row onto a group header to add it to that group.
  - Drop between rows to move. Whole groups move by their handle.
  - The eye button hides or shows a panel (the same hidden list Home Assistant uses).
  - Group icon and name are edited on the group row; "ungroup" puts its panels back in place.
  - **Done** saves (with nothing changed it just closes), **Cancel** throws the changes away.
- **Your layout follows you**: it is stored in Home Assistant per user, not in the browser, so it is
  the same on every computer, tablet and in the companion app.
- **Admin default**: an admin can press "Set as default for everyone". Users who never edited their
  sidebar get that layout; anyone can go back to it with "Reset to the default layout". These actions
  ask for confirmation inside the editor first. A user on the default who only hides or shows panels
  keeps following it (only Home Assistant's hidden list is written); any other saved change tells them
  once that the layout becomes their own.
- **Works with Home Assistant's own sidebar settings**: order and hidden panels are written to Home
  Assistant's own sidebar settings too. Its long-press "Edit sidebar" dialog keeps working: hiding
  works as before, and a new order saved there is applied to your layout (groups stay; panels inside
  each group follow the new order). If you were following the admin default, a short message tells you the
  layout is now your own, with Undo.
- **Start over**: without an admin default, "Remove groups and custom order" in the editor brings back
  Home Assistant's own sidebar (hidden panels stay hidden).
- **Colours and styles**: open a group's icon in the editor to give it a colour (its name and the line
  beside its items) and an icon colour. Choose one of Home Assistant's theme colours, which follow your
  theme in light and dark mode, or any `#rrggbb` colour. If a colour would be hard to read on your theme
  it is darkened or lightened just enough (WCAG AA). Under **Display** in the editor: group headers plain,
  with a tinted background, with a line above, or **rounded with background** (a pill a step lighter than
  the sidebar on dark themes and a step darker on light ones, tinted with the group's colour if it has one),
  and the line beside grouped items shown or hidden.
- **Collapse settings** (editor, **Display**): groups start collapsed on every page load; only one group
  open at a time; a collapse / expand all button next to the sidebar title (off by default, because it
  shortens the title). With "one group open at a time" the button only collapses, and is hidden while every
  group is folded. The number of items on folded group headers can be hidden.
- **A group that starts open**: with "Groups start collapsed" on, each group row in the editor gets an
  open folder button. Groups with it pressed start open on every page load, the rest start folded. With
  "One group open at a time" only the first of them (top to bottom) opens.
  What decides the folding when a page loads:
  1. "Groups start collapsed" on: the "starts open" buttons decide (as above). Folding during the visit
     is not saved.
  2. "Groups start collapsed" off: each group is as you last left it (remembered per user, on every
     device). The "starts open" buttons have no effect and are hidden in the editor.
- **Pinned icons at the bottom**: drag items into **Pinned at the bottom** in the editor. They appear as a
  compact grid of icons above Settings and Notifications (four per row; one column when the sidebar shows
  icons only). Hover or focus an icon for its name. With the keyboard, use the arrow keys inside the grid
  and Enter to open; in the editor, Alt + Down on the last row pins it. Up to 20 items.
- **No flicker**: groups are drawn as part of Home Assistant's own sidebar, not patched in afterwards.
- **Touch and keyboard**: drag with a finger or a mouse. With the keyboard, focus a handle and press
  Alt + Up / Down; a screen reader hears where the row landed.

## Install

1. HACS → three dots → Custom repositories → `https://github.com/bareli/easy_sidebar_pro`, type
   **Integration**.
2. Download **Easy Sidebar Pro**, restart Home Assistant.
3. Settings → Devices & services → Add integration → **Easy Sidebar Pro**.
4. Refresh the browser (and close and reopen the companion app). The pencil appears next to the
   sidebar title.

No `configuration.yaml` changes are needed.

## Theme variables

Themes can restyle the groups. A colour set on a group in the editor wins over these.

| Variable | What it changes |
|---|---|
| `esp-group-header-text-color` | group header name |
| `esp-group-header-icon-color` | group header icon |
| `esp-group-header-background` | header background when headers are "tinted" or "rounded" |
| `esp-group-header-radius` | header corner radius (also of "rounded" headers) |
| `esp-group-divider-color` | line beside grouped items, and "line above" headers |
| `esp-group-divider-width` | width of the line beside grouped items (default 2px) |

Example theme entry: `esp-group-divider-color: "#7e57c2"`.

## Requirements and compatibility

- Home Assistant 2026.6 or newer (tested on 2026.6.4, 2026.7.4, 2026.8.3 and 2026.9.4). On older
  versions, whose sidebar is built differently, the integration loads but leaves the sidebar untouched.
- Do not use it together with another sidebar plugin that changes the panel list (for example
  Sidebar Organizer): both change the same sidebar and the result is unpredictable. Coming from Sidebar
  Organizer: groups, default collapsed groups, accordion, the collapse all toggle, divider styling and
  bottom grid items have equivalents here; sidebar background / scrollbar colours are left to your HA
  theme, and bottom groups, custom links and templates are not supported.
- If a future Home Assistant release changes the sidebar internals, Easy Sidebar Pro switches itself
  off and the normal sidebar stays. Your layout is kept.

## Removing

Delete the integration and refresh the browser. Home Assistant's own order and hidden panels stay as
you last saved them.

## Development

- Python tests: `pytest` (pytest-homeassistant-custom-component).
- JavaScript tests: `npm test` (Node 20+, no dependencies).
- See `SPEC.md` for the design.

## License

MIT
