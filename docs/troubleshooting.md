# Troubleshooting

## The pencil does not appear

- Refresh the browser after adding the integration, and close and reopen the companion app. Home Assistant reads the list of extra scripts on page load.
- Check that **Settings → Devices & services** lists **Easy Sidebar Pro**.
- Check your Home Assistant version: 2026.6 or newer is needed.

## I updated and the browser still behaves like the old version

Home Assistant's service worker and the browser cache can keep the previous JavaScript. Refresh the page; if that does not help, clear the site's cache, or unregister the service worker in your browser's developer tools (Application, Service Workers) and reload.

## The sidebar is the normal one, no groups

If a future Home Assistant release changes the sidebar internals, Easy Sidebar Pro switches itself off. The status can be read in the browser console as `window.__easySidebarPro.status`: `active` means it is running, `unsupported` means it detected a sidebar it does not know. Your layout is kept; update Easy Sidebar Pro, or wait for a release that supports your Home Assistant version.

## Two sidebar plugins at once

Do not run Easy Sidebar Pro together with another plugin that changes the panel list (for example Sidebar Organizer). Remove the other one.

## Save fails

The message says whether it is the connection or Home Assistant refusing the layout; the reason is shown on a details line under it. Items whose address has characters other than letters, digits, `-` and `_` (some custom panels) are left out of the layout and keep Home Assistant's own place.

## A badge or a hidden row looks wrong

A row hidden by a show-only-when rule is dimmed in the editor with the reason. An entity that does not exist is flagged under its field. Off, closed, locked, unavailable, unknown and 0 show no badge.

## The tab bar covers or moves the page

On narrow screens the bar is at the bottom; on wide screens it is above the page. The bar and the page header stay in place while you scroll.

## Start over

**Remove groups and custom order** in the editor brings back Home Assistant's own sidebar. To stop using the integration, delete it and refresh the browser.

## Still stuck

Open an issue at [github.com/bareli/easy_sidebar_pro/issues](https://github.com/bareli/easy_sidebar_pro/issues) with your Home Assistant version and a description of what you see.
