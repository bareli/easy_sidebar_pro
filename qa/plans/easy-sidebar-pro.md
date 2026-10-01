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
