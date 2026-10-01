# Plan: Easy Sidebar Pro (v0.1.0)

Test IDs are stable forever. Add new ones at the end of a series; never renumber.
Run in Hebrew (RTL) first, then English. Desktop 1440x900 and mobile 320x568 (drawer sidebar).

## RND: rendering in the sidebar

- RND-01 Module loads after the integration is added + browser refresh; `window.__easySidebarPro.status === "active"`; pencil next to the title.
- RND-02 Groups render as part of HA's sidebar: no flat-list flash on page load (watch from first paint), no later re-ordering.
- RND-03 Panels not mentioned in the layout (new dashboard) appear at the end of the top level; a removed panel disappears without breaking the group.
- RND-04 Empty group (all members hidden or removed) is not shown outside the editor.
- RND-05 Icon-only (collapsed) desktop sidebar: group shows its icon + tooltip, click toggles, members not indented.
- RND-06 Selected page inside a group: HA's selection highlight intact; inside a folded group: header highlighted.
- RND-07 Integration removed + refresh → native sidebar, no errors.
- RND-08 HA internals missing (simulate: `_renderPanels` undefined) → module stays off, sidebar native.

## GRP: groups and folding

- GRP-01 Click header folds / unfolds; Enter / Space on the focused header does the same.
- GRP-02 Folded state survives reload and is shared by the user's other open browsers (live).
- GRP-03 Folded state is per user (qa_user folding does not fold qa_admin's group).
- GRP-04 Header shows a count when folded; `aria-expanded` matches.

## EDIT: editor operations

- EDIT-01 Pencil opens the editor; all panels listed, including hidden ones (dimmed, eye-off).
- EDIT-02 Add group → new group at the top, name field focused and selected.
- EDIT-03 Rename: empty name rejected with a message; 50-character limit; Hebrew and mixed text.
- EDIT-04 Icon: text field with live preview, invalid value rejected with a message, suggested icons.
- EDIT-05 Ungroup: members take the group's place, in order.
- EDIT-06 Hide / show: saved to HA's native hidden list; default dashboard cannot be hidden.
- EDIT-07 Cancel discards every change; Done saves; focus returns to the pencil.
- EDIT-08 Save error (e.g. invalid layout forced, connection lost) is shown, editor stays open, nothing lost.
- EDIT-09 Admin: "Set as default for everyone", "Remove the default layout"; non-admin does not see them.
- EDIT-10 "Reset to the default layout" appears only when the user has their own layout and a default exists.
- EDIT-11 Editor open while HA state changes rapidly (sidebar re-renders): editor state and focus survive.
- EDIT-12 Editor open while another browser of the same user saves: no clobbering of the open editor; result after Done is defined.

## DND: drag and drop

- DND-01 Mouse: drop between rows moves (top level, into a group, out of a group).
- DND-02 Drop a panel onto a top-level panel → new group with both, at the target's place, name focused.
- DND-03 Drop a panel onto a grouped panel → moves next to it (no nested group).
- DND-04 Drop onto a group header → appended to the group.
- DND-05 Drag a group by its handle → moves as a unit; never nests.
- DND-06 Touch drag (phone width, drawer): same results as mouse; page does not scroll while dragging.
- DND-07 Auto-scroll when dragging near the top / bottom of a long list (60 panels).
- DND-08 Escape cancels a drag; drop outside the list does nothing harmful.
- DND-09 Drop indicator is visible (not hidden under the dragged ghost).

## KBD: keyboard

- KBD-01 Alt + Up / Down moves the focused row; enters and leaves groups; focus stays on the moved row.
- KBD-02 Every move is announced (live region) with position and group.
- KBD-03 Keys typed in editor inputs never trigger HA's global shortcuts or HA's list navigation.
- KBD-04 Tab order through the editor is logical in RTL and LTR.

## PERSIST: storage, sync, default

- PERSIST-01 Save writes `.storage/easy_sidebar_pro` users.<id>.layout and HA user data `sidebar` (panelOrder flattened, hiddenPanels).
- PERSIST-02 Other open browsers of the same user update live after save.
- PERSIST-03 Admin default reaches users without their own layout live; users with their own layout are unaffected.
- PERSIST-04 Reset → user sees the default; collapsed state kept.
- PERSIST-05 Restart HA → layouts, default, collapsed intact.
- PERSIST-06 Corrupt storage file → integration loads, bad parts dropped.

## NATIVE: HA compatibility

- NATIVE-01 HA's long-press "Edit sidebar" dialog still works; its result is reflected sensibly.
- NATIVE-02 Navigation, notifications, settings, profile items unaffected; badges still update.
- NATIVE-03 HA's own keyboard navigation (arrow keys) in the sidebar still works with group headers in the list.
- NATIVE-04 HA restart / websocket reconnect: subscription resumes, no duplicate subscriptions.

## WS: websocket API

- WS-01 subscribe / save / collapsed / reset / default/set happy paths.
- WS-02 Validation: duplicates, unknown groups, bad ids, long names, control characters, bad icons, limits.
- WS-03 default/set as non-admin → unauthorized.

## I18N / MOBILE

- I18N-01 Hebrew UI: all editor strings Hebrew, RTL layout, chevron direction, guide line side.
- I18N-02 English UI.
- MOBILE-01 320px: drawer, editor fits, buttons reachable, no horizontal scroll.

## SEC / PERF / A11Y / UX

Owned by the specialists; IDs `SEC-nn`, `PERF-nn`, `A11Y-nn`, `UX-nn` are assigned when findings are filed.

## Regression cases added by the 2026-10-01 cycle

Each confirmed defect has a stable case. Automated coverage in brackets.

- KBD-05 Pencil opens the editor with Enter and with Space (BUG-003 #24).
- KBD-06 Enter in a group name keeps focus in the field; the next click (Done, Cancel, eye, Add group) works first time (BUG-004 #25, BUG-009 #6).
- EDIT-13 Empty / invisible-only name: inline error tied to the field (`aria-invalid`, `aria-describedby`), Done refuses and focuses the field (BUG-005 #3).
- EDIT-14 Names with C1 / Cf characters are cleaned or rejected identically by editor and server; legitimate Hebrew, Arabic, Persian ZWNJ, emoji ZWJ names pass (BUG-014 #11, SEC-002 #20) [tests_js/qa-regressions, tests/test_layout].
- EDIT-15 Done with no changes closes without saving; a user on the default: hide/show-only Done keeps the default, structural change shows the one-time note then forks (UX-001 #12) [tests_js/ux-batch-c].
- EDIT-16 Reset / Set default / Remove default ask inline and report the result (UX-004 #15).
- EDIT-17 Save errors are short and localized (offline, validation) (UX-007 #18).
- DND-10 Release outside the list with no indicator does nothing (BUG-011 #8).
- DND-11 Drop on an empty group's placeholder fills that group (BUG-012 #9).
- DND-12 Ghost does not cover the target; "onto" hover labels the new group (UX-003 #14).
- MOBILE-02 Done/Cancel bar stays visible while scrolling the editor at 320x568 and on a short desktop (BUG-001 #1).
- RND-09 Switching to icon-only updates group headers immediately (tooltip, folded marker) (BUG-002 #2).
- PERSIST-07 Save keeps HA's native hidden/order entries for panels HA does not list right now (BUG-013 #10).
- PERSIST-08 Open subscriptions follow a config-entry reload (BUG-010 #7) [tests/test_qa_regressions].
- NATIVE-05 Reordering in HA's own dialog is adopted with groups kept; Reset rewrites HA's order (UX-002 #13) [tests_js/ux-batch-b].
- NATIVE-06 After 10 editor open/close cycles, `ha-list-nav` items equal connected rows; ArrowDown visits each row once (PERF-003 #23).
- WS-04 Validators: fullmatch, `version: true` rejected, URI-scheme icon prefixes rejected, caps checked before iterating (SEC-001 #19, PERF-001 #21) [tests/test_layout].
- A11Y-07 Contrast ≥ 4.5:1 for editor text, links, errors, Done in light, dark and an orange theme (BUG-006 #4); name field boundary ≥ 3:1 (BUG-007 #5).
- A11Y-08 List semantics: HA's list owns only listitems while editing; grouped panels describe their group (BUG-008 #26).
- I18N-03 Hebrew wording "עריכת סרגל הצד" (UX-005 #16).
- PERF-04 Editor in-place updates: hide toggle / rename create ≤ 5 nodes (PERF-002 #22).
