# Export, import and defaults

## Per user, on every device

Your layout is stored in Home Assistant for your user, not in the browser. The sidebar looks the same on every computer, tablet and phone, and in the companion app. Which groups are folded is remembered per user too.

## Admin default

An admin can press **Set as default for everyone** in the editor footer. Users who never edited their sidebar get that layout.

- Anyone can go back to it with **Reset to the default layout**.
- These actions ask for confirmation inside the editor first.
- A user on the default who only hides or shows panels keeps following it (only Home Assistant's hidden list is written). Any other saved change tells them once that the layout becomes their own.
- **Remove the default layout** (admin) sends users who have not customised their sidebar back to Home Assistant's own order.
- If a new order saved in Home Assistant's own "Edit sidebar" dialog makes someone's layout their own, a short message says so, with **Undo**.

## Export layout

**Export layout** in the editor footer saves the layout as a JSON file. It holds what the editor holds right now, including unsaved changes.

## Import layout

**Import layout** loads such a file into the editor **as unsaved changes**. Review it and press **Done** to save; the server checks it again.

- Files over 256 KB are refused.
- A file that is not a layout of Easy Sidebar Pro, or is from a newer version, is refused with a message.
- Panels this Home Assistant does not have keep their place, as with a stopped add-on.

Export and import are a way to back up a layout, copy it to another Home Assistant, or hand it to a friend.
