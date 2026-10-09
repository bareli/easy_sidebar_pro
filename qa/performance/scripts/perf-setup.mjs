import { open, SB, ws } from "./lib2.mjs";
const { browser, page } = await open({ who: "admin" });
try {
  const call = (m) => ws(page, m).catch((e) => ({ err: e.message ?? JSON.stringify(e) }));
  for (let i = 0; i < 50; i++) await call({ type: "lovelace/dashboards/create", url_path: `perf-dash-${String(i).padStart(2, "0")}`, title: `Perf dash ${i}`, icon: "mdi:view-dashboard", show_in_sidebar: true, require_admin: false, mode: "storage" });
  for (let i = 0; i < 10; i++) {
    const up = `perf-dash-${String(i).padStart(2, "0")}`;
    const r = await call({ type: "lovelace/config/save", url_path: up, config: { title: `D${i}`, views: [1, 2, 3].map((v) => ({ title: `View ${v} of ${i}`, path: `v${v}`, cards: [] })) } });
    if (r?.err) console.log("save", up, r.err);
  }
  for (let i = 0; i < 25; i++) await call({ type: "counter/create", name: `perfc${i}`, initial: 1, step: 1, restore: false });
  for (let i = 0; i < 10; i++) await call({ type: "input_boolean/create", name: `perfb${i}`, initial: true });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(`(() => { ${SB} const r = sb.shadowRoot; const ids = [...r.querySelectorAll('ha-list-nav.before-spacer ha-list-item-button[id^="sidebar-panel-"]')].map(i => i.id.slice(14)); const h = document.querySelector("home-assistant").hass; return { rows: ids.length, ids, counters: Object.keys(h.states).filter(e=>e.startsWith("counter.perfc")).length, bools: Object.keys(h.states).filter(e=>e.startsWith("input_boolean.perfb")).length, total: Object.keys(h.states).length, panels: Object.keys(h.panels).length }; })()`);
  console.log(JSON.stringify({ ...info, ids: undefined }));
  console.log(info.ids.join(","));
} finally { await browser.close(); }
