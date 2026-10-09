# Changelog

## v0.5.0 (2026-10-09)

- **Links**: add items that are not Home Assistant panels, with **Add link** in the editor: a page of Home Assistant (for example `/config/automation` or one dashboard view) or a web address (router, NAS...). Links can be grouped, pinned and be tabs. Web addresses open in a new browser tab.
- **Item options** (⋮ on each row in the editor, **More** on a group): **Move to** a group, the top level or the pinned area without dragging; a **badge** entity (its number, or a dot while it is on, like Home Assistant's update count; folded and tabs groups add up their items' badges); **show only while an entity is on** (an item or a whole group); **search words**.
- **Search** also finds Home Assistant's English names of built-in panels in any language ("his" finds History in Hebrew), links by name or address, search words, and dashboard views ("View · Dashboard").
- **Tabs on phones**: on narrow screens the tabs of a tabs group are a bar at the bottom of the screen.
- Tabs groups: on long pages the tab bar and the page header scrolled away with the page. They now stay in place.
- Link addresses typed without a scheme: home network addresses (IP, `nas.local`, `router.lan`, any address with a port) get `http://`, other web names `https://`; a single word is a Home Assistant page.
- Clearer Hebrew wording in the editor (badge field, address error, Undo, "אפשרויות נוספות", one consistent register); the address error now says http or https.
- Hebrew editor: the add buttons read "קבוצה" and "קישור" on one line; the full text is their tooltip and accessible name.
- Phone tab bar: a coloured top edge and the group's icon set it apart from a page's own bottom tabs; the tab list fades at the edge(s) where more tabs scroll in.
- Entity fields suggest entities by friendly name (any language, accents ignored) or id, shown as "Name (entity_id)"; arrow keys, Enter and Escape work.
- Editor: rows with a badge or show-only-when rule carry a small mark; a row its rule hides right now is dimmed and says why.
- Badge and show-only-when fields warn when the entity does not exist in Home Assistant (saving stays allowed).
- Icon-only sidebar: groups show Home Assistant's own tooltip with their full name, like the other items.
- A link's icon field has tappable suggested icons, like a group's, plus router, NAS, web, robot, cog and link icons.
- Editor on phones: the hint folds behind a **?** button, and the drag handle, eye and ⋮ buttons are 44 px tap targets.
- The editor hint says where to turn on the search box (Display options; search stays off by default).
- Badges have a darker fill than Home Assistant's own, so the white number (5.4:1) and the dot are readable on light and dark sidebars.

## v0.4.2 (2026-10-08)

- A refused save always said "a group name, icon or colour is not valid", whatever the real reason (#39). The message now says Home Assistant refused the layout and shows the reason on a details line under it.
- Sidebar items whose address has characters other than letters, digits, `-` and `_` (some custom panels) no longer make the whole save fail: they are left out of the layout and keep Home Assistant's own place.

## v0.4.1 (2026-10-06)

- Editor: the group name had almost no room next to the new tabs button, so it could not be read or edited. The name now has the whole row; **Tabs**, **Starts open** and **Ungroup** are labelled buttons on a line under it.
- Editor: **Display options** (groups start collapsed, one group open at a time, search box, header style...) moved from the bottom of the editor to the top, right under Done / Cancel, folded until you open them. A note there says changes apply when you press Done.

## v0.4.0 (2026-10-06)

- **Groups as tabs**: a new button on each group row in the editor shows the group as **one item** in the sidebar. Clicking it opens the group's first item (or the one you had open last in this page), with a bar of tabs above the page: one tab per item of the group, in the group's order. The page itself is Home Assistant's own (dashboards, map, history, settings...), so everything in it works as before; its header sits below the tab bar. While any of its tabs is open, the group's row is highlighted in the sidebar. Hidden items are not tabs. On narrow screens the tabs scroll sideways. Tabs are links: Ctrl / middle click opens one in a new browser tab.
- **Search box** (option under **Display** in the editor, off by default): a box at the top of the sidebar that filters by the names you see as you type (any case, accents ignored). Matching items show with their group, unfolded; a group whose name matches shows all its items. A tabs group shows as its one row when its name or any of its items match, and opens that item. Enter opens the first result, Down moves into the results, Escape clears. Hidden in the icon-only sidebar.
- A group's "starts open" button turned off again only after reopening the editor; a second click now turns it off.
- After an update, the browser could keep the previous version's `layout.js` from its cache next to the new sidebar code. The file is now loaded with the version in its address.

## v0.3.2 (2026-10-04)

- The editor hint now mentions the eye button: it hides or shows an item in the sidebar (hidden items stay listed in the editor, dimmed).

## v0.3.1 (2026-10-04)

Forum feedback on v0.3.0.

- **Hide the item count** (#36, forum request): new option under **Display** in the editor, "Hide the number of items on folded groups". Screen readers still hear the count.
- **Narrow screens** (#37, forum report): on phones and other narrow screens, group headers were 8 px wider than Home Assistant's own rows, so the highlighted page looked shorter than the headers next to it (most visible with "Rounded with background"). Headers now have the same width as the rows in every style.

## v0.3.0 (2026-10-01)

Styling, collapse settings and a bottom grid, for parity with Sidebar Organizer (forum request). Everything is set in the sidebar editor and saved with the layout, so it follows each user and the admin default.

- **Group colours** (#27): each group can have a colour (header name, guide line beside its items) and an icon colour (header icon and its items' icons). Pick one of Home Assistant's theme colours (they follow your theme in light and dark mode) or type `#rrggbb` / use the colour picker. Colours are adjusted automatically when they would be hard to read on your theme (WCAG AA: 4.5:1 for the name, 3:1 for icons and lines).
- **Header and divider style** (#27): group headers plain, with a tinted background, or with a line above; the line beside grouped items can be hidden. Themes can restyle all of it with CSS variables (see the README).
- **Collapse settings** (#28): "Groups start collapsed" (on every page load; folding is then not remembered), "One group open at a time" (opening a group folds the others), and an optional collapse / expand all button next to the sidebar title.
- **A group that starts open** (#33, forum request): with "Groups start collapsed" on, an open folder button on each group row in the editor keeps that group open on every page load (with "One group open at a time": the first such group). Without "Groups start collapsed" each group keeps the state you left it in, as before.
- **Rounded headers** (#34, forum request): a new group header style, "Rounded with background": pill-shaped headers a step lighter than the sidebar on dark themes (a step darker on light ones), tinted with the group's colour if it has one. Text, counts and icons on it are adjusted for contrast like the other styles; right-to-left, the icon-only rail and narrow screens included.
- **Pinned icons at the bottom** (#29): drag items into the new "Pinned at the bottom" area of the editor to show them as a compact icon grid above Settings / Notifications, four per row. Names show as tooltips; in the icon-only sidebar they stack in the rail. Keyboard: arrow keys move through the grid (Down from the last row continues to Settings), Enter opens; in the editor Alt + Down from the last row pins an item. Screen readers hear each item's name and "Pinned". At most 20 pinned items.
- With "One group open at a time" the collapse / expand all button only collapses (expanding all would open several groups); it is hidden while every group is folded.
- Home Assistant's own "Edit sidebar" dialog: a new order there also re-sorts the pinned icons (they stay pinned), as it does for groups (#31).
- Switching between light and dark (or another theme) with the page open updates the group colours right away (#30).
- With the collapse / expand all button on, a Latin sidebar title in Hebrew is shortened at its end ("Home Assi..."), not its start (#32).
- Layouts saved by earlier versions load unchanged, with the new options at their defaults. The server validates every new value (colour format, known options only, "starts open" true or false, at most 20 pinned items).

## v0.2.1 (2026-10-01)

- Works with Home Assistant 2026.6, 2026.7 and 2026.8 (tested on 2026.6.4, 2026.7.4, 2026.8.3); the minimum version is now 2026.6.0.
- On older Home Assistant versions (different sidebar) the module now stays off instead of half-working.

## v0.2.0 (2026-10-01)

Fixes from the first full QA cycle (26 issues, #1 to #26, all verified).

- **Keyboard and screen readers**: the pencil opens the editor with Enter / Space (#24); focus stays put after renaming and the next click works first time (#25, #6); name errors sit under their field (#3); contrast meets WCAG AA in light and dark themes while following the theme colour (#4, #5); proper list semantics, and grouped panels announce their group (#26).
- **Admin default**: pressing Done with no changes just closes; hiding or showing panels keeps you on the default; any other change shows a one-time note that the layout becomes yours (#12). Reset, Set as default and Remove default ask for confirmation inside the editor and report the result (#15).
- **Home Assistant's own "Edit sidebar" dialog**: a new order saved there is now applied to your layout with groups kept; Reset also restores Home Assistant's own order (#13). If that makes the layout of someone on the admin default their own, Home Assistant shows a short message with Undo.
- **No admin default**: "Remove groups and custom order" in the editor takes you back to Home Assistant's own sidebar; hidden panels stay hidden.
- **Editor**: Done / Cancel stay visible while scrolling on phones (#1); the dragged row no longer hides the drop target and "New group with ..." is shown when dropping onto a row (#14); releasing outside the list does nothing (#8); dropping on an empty group works (#9); friendlier save errors in Hebrew and English (#18); wording matches Home Assistant ("עריכת סרגל הצד") (#16); eight smaller polish items (#17).
- **Sidebar**: switching to the icon-only sidebar updates group headers immediately (#2); saving no longer drops Home Assistant's settings for panels that are temporarily missing, such as a stopped add-on (#10).
- **Robustness and security**: open browsers follow an integration reload (#7); stricter validation of names and icons, identical in the editor and on the server (#11, #19, #20); oversized requests are rejected before any work (#21).
- **Performance**: the editor no longer leaks memory each time it opens (#23) and updates rows in place (#22).

## v0.1.0 (2026-10-01)

First release.

- Collapsible groups in the sidebar, drawn as part of Home Assistant's own sidebar (no flicker).
- Edit mode inside the sidebar (pencil next to the title): drag a row onto another to create a group, drag into and out of groups, move whole groups, rename, choose an icon, ungroup, hide and show panels. Done / Cancel.
- Mouse, touch and keyboard (Alt + arrow keys with screen reader announcements).
- Layout and folded groups stored per Home Assistant user on the server; admin default layout with "Reset to the default layout".
- Order and hidden panels are also saved to Home Assistant's own sidebar settings.
- Hebrew and English, right-to-left aware.
