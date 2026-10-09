import { open, SB } from "./perf-lib.mjs";
const { browser, ctx, page } = await open({ who: "admin" });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable"); await cdp.send("HeapProfiler.enable");
const entCount = () => page.evaluate(`Object.keys(document.querySelector("home-assistant").hass.states).length`);
const addStates = (from, to) => page.evaluate(`(async () => { const h = () => document.querySelector("home-assistant").hass; for (let i = ${from}; i < ${to}; i += 50) { await Promise.all(Array.from({ length: Math.min(50, ${to} - i) }, (_, k) => h().callApi("POST", "states/sensor.perfx_" + (i + k), { state: "1", attributes: {} }))); } })()`);
const metrics = async () => { await cdp.send("HeapProfiler.collectGarbage"); await cdp.send("HeapProfiler.collectGarbage"); return Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value])); };
const cycle = async (n) => {
  const open_ms = [], opt_ms = [], close_ms = [];
  for (let i = 0; i < n; i++) {
    const r = await page.evaluate(`(async () => { ${SB} const root = sb.shadowRoot; const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      let t = performance.now(); root.querySelector(".esp-edit").click(); await raf(); const ed = root.querySelector("esp-editor"); const open = performance.now() - t;
      // open the options block of the first row that has a badge field (first ⋮ button)
      const more = ed.shadowRoot.querySelector('[data-focus-key^="more"], button[aria-label*="options" i], .esp-more, button.more');
      let opt = null; if (more) { t = performance.now(); more.click(); await raf(); opt = performance.now() - t; }
      const opts = ed.shadowRoot.querySelectorAll("#esp-entities option").length;
      t = performance.now(); ed.shadowRoot.querySelector('[data-focus-key="cancel"]').click(); await raf(); const close = performance.now() - t;
      return { open, opt, close, opts, haveMore: !!more }; })()`);
    open_ms.push(r.open); if (r.opt != null) opt_ms.push(r.opt); close_ms.push(r.close); cycle.last = r;
    await page.waitForTimeout(250);
  }
  const med = (a) => a.length ? +a.sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(1) : null;
  return { openMedianMs: med(open_ms), openMaxMs: +Math.max(...open_ms).toFixed(1), optionsMedianMs: med(opt_ms), closeMedianMs: med(close_ms), datalistOptions: cycle.last.opts, moreFound: cycle.last.haveMore };
};
try {
  for (const target of [0, 1000, 5000]) {
    if (target) await addStates(target === 1000 ? 0 : 1000, target);
    await page.waitForTimeout(1500);
    const m0 = await metrics();
    const res = await cycle(8);
    const m1 = await metrics();
    const dom = await page.evaluate(`(() => { ${SB} const r = sb.shadowRoot; return [...r.querySelectorAll("ha-list-nav")].map((n) => n.items.length + "/" + n.items.filter((i) => !i.isConnected).length).join(" "); })()`);
    console.log(JSON.stringify({ states: await entCount(), ...res, nodesBefore: m0.Nodes, nodesAfter: m1.Nodes, heapBeforeMB: +(m0.JSHeapUsedSize / 1048576).toFixed(1), heapAfterMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1), listenersBefore: m0.JSEventListeners, listenersAfter: m1.JSEventListeners, navItemsTotalDetached: dom }));
  }
  // cleanup the fake states
  await page.evaluate(`(async () => { const h = () => document.querySelector("home-assistant").hass; for (let i = 0; i < 5000; i += 50) await Promise.all(Array.from({ length: 50 }, (_, k) => h().callApi("DELETE", "states/sensor.perfx_" + (i + k)).catch(() => {}))); })()`);
  console.log("cleanup states now", await entCount());
} finally { await browser.close(); }
