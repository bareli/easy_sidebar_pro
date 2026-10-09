import { open, SB, ws } from "./lib2.mjs";
const { browser, page } = await open({ who: "admin" });
try {
  const dash = (i) => `perf-dash-${String(i).padStart(2, "0")}`;
  const top = ["home", "dash-kids", "dash-cameras", "dash-energy-home", "dash-garden", "map", "energy", "logbook", "history", "media-browser", "todo", ...[0,1,2,3,4,5,6,7,8,9].map(dash)];
  const groups = {}, order = [], items = {}, links = {};
  for (let g = 0; g < 20; g++) {
    groups[`g${g}`] = { name: g % 2 ? `קבוצה ${g}` : `Group ${g}`, icon: "mdi:folder", color: null, icon_color: null, start_open: g < 5, tabbed: g === 19, panels: [dash(10 + 2 * g), dash(11 + 2 * g)] };
  }
  const topEntries = [...top];
  for (let l = 0; l < 30; l++) { links[`l${l}`] = { name: `Link ${l}`, icon: "mdi:link", url: l % 3 ? `/config/dashboard?x=${l}` : `https://example.com/${l}`, new_tab: false }; topEntries.push(`l:l${l}`); }
  order.push(...topEntries.slice(0, 11));
  for (let g = 0; g < 20; g++) order.push(`g:g${g}`);
  order.push(...topEntries.slice(11));
  const badgeTargets = [...top.slice(0, 6), dash(0), dash(1), dash(2), dash(3)];
  badgeTargets.forEach((p, i) => (items[p] = { badge: `counter.perfc${i}`, show_when: null, aliases: null }));
  for (let g = 0; g < 5; g++) items[`g:g${g}`] = { badge: `counter.perfc${10 + g}`, show_when: null, aliases: null };
  for (let l = 0; l < 5; l++) items[`l:l${l}`] = { badge: `counter.perfc${15 + l}`, show_when: null, aliases: null };
  const sw = [dash(4), dash(5), dash(6), dash(7), dash(8), dash(9), "energy", "logbook", "history", "todo"];
  sw.forEach((p, i) => (items[p] = { badge: null, show_when: `input_boolean.perfb${i}`, aliases: null }));
  const layout = { version: 1, order, groups, grid: [], settings: { start_collapsed: false, accordion: false, toggle_all: true, hide_count: false, search: true, header: "plain", divider: "line" }, links, items };
  const r = await ws(page, { type: "easy_sidebar_pro/save", layout }).catch((e) => ({ err: JSON.stringify(e) }));
  console.log("save", JSON.stringify(r));
  await page.waitForTimeout(2500);
  console.log(await page.evaluate(`(() => { ${SB} const r = sb.shadowRoot; const q = (s) => r.querySelectorAll(s).length; return JSON.stringify({ rows: q('ha-list-nav.before-spacer ha-list-item-button[id^="sidebar-panel-"]'), groups: q("esp-group"), badges: q(".esp-badge"), status: window.__easySidebarPro.status }); })()`));
} finally { await browser.close(); }
