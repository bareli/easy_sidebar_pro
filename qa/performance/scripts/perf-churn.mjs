import { open, SB } from "./perf-lib.mjs";
const { browser, ctx, page } = await open({ who: "admin" });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable"); await cdp.send("HeapProfiler.enable");
const snap = async (label) => {
  await cdp.send("HeapProfiler.collectGarbage"); await cdp.send("HeapProfiler.collectGarbage");
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  const dom = await page.evaluate(`(() => { ${SB} const r = sb.shadowRoot; const navs = [...r.querySelectorAll("ha-list-nav")].map((n) => n.items.length + "/" + n.items.filter((i) => !i.isConnected).length); return { badgeSpans: r.querySelectorAll(".esp-badge").length, rows: r.querySelectorAll('ha-list-item-button[id^="sidebar-panel-"]').length, navItems_total_detached: navs.join(" ") }; })()`);
  console.log(JSON.stringify({ label, nodes: m.Nodes, listeners: m.JSEventListeners, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), ...dom }));
};
try {
  await snap("start");
  // A: 1000 attribute-only updates of watched entity states (badge signature unchanged)
  const ids = Array.from({ length: 10 }, (_, i) => `counter.perfc${i}`);
  for (let round = 0; round < 4; round++) {
    await page.evaluate(`(async () => { const h = () => document.querySelector("home-assistant").hass; for (let i = 0; i < 250; i++) { const id = ${JSON.stringify(ids)}[i % 10]; const s = h().states[id]; await h().callApi("POST", "states/" + id, { state: s.state, attributes: { ...s.attributes, tick: Date.now() + i } }); } })()`);
    await page.waitForTimeout(300);
    await snap(`A attr-only x${(round + 1) * 250}`);
  }
  // B: 1000 increments (badge text changes every time)
  for (let round = 0; round < 4; round++) {
    await page.evaluate(`(async () => { const h = () => document.querySelector("home-assistant").hass; for (let i = 0; i < 250; i++) { h().callService("counter", "increment", { entity_id: ${JSON.stringify(ids)}[i % 10] }); await new Promise((r) => setTimeout(r, 25)); } })()`);
    await page.waitForTimeout(500);
    await snap(`B increment x${(round + 1) * 250}`);
  }
} finally { await browser.close(); }
