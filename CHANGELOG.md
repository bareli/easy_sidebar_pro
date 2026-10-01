# Changelog

## v0.2.1 (unreleased)

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
