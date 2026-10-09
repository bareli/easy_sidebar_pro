import { open, SB } from "./perf-lib.mjs";
const { browser, ctx, page } = await open({ who: "admin" });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable"); await cdp.send("HeapProfiler.enable"); await cdp.send("Runtime.enable");
const m = async () => { for (let i = 0; i < 4; i++) { await cdp.send("HeapProfiler.collectGarbage"); await page.waitForTimeout(150); } const x = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((y) => [y.name, y.value])); return { nodes: x.Nodes, listeners: x.JSEventListeners, heapMB: +(x.JSHeapUsedSize / 1048576).toFixed(2) }; };
const one = () => page.evaluate(`(async () => { ${SB} const root = sb.shadowRoot; const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); root.querySelector(".esp-edit").click(); await raf(); const ed = root.querySelector("esp-editor"); ed.shadowRoot.querySelector('[data-focus-key^="more"]')?.click(); await raf(); ed.shadowRoot.querySelector('[data-focus-key="cancel"]').click(); await raf(); })()`);
const count = async (proto) => { const p = await cdp.send("Runtime.evaluate", { expression: proto }); const q = await cdp.send("Runtime.queryObjects", { prototypeObjectId: p.result.objectId, objectGroup: "g" }); const c = await cdp.send("Runtime.callFunctionOn", { objectId: q.objects.objectId, functionDeclaration: "function(){ return [this.length, this.filter(e=>e.isConnected).length]; }", returnByValue: true, objectGroup: "g" }); await cdp.send("Runtime.releaseObjectGroup", { objectGroup: "g" }); return c.result.value; };
try {
  console.log("0", JSON.stringify(await m()));
  let done = 0;
  for (const target of [1, 2, 4, 8, 16, 32]) {
    while (done < target) { await one(); await page.waitForTimeout(200); done++; }
    await page.waitForTimeout(1500);
    console.log(target, JSON.stringify(await m()));
  }
  console.log("esp-editor [alive, connected]", JSON.stringify(await count("customElements.get('esp-editor').prototype")));
  console.log("esp-group [alive, connected]", JSON.stringify(await count("customElements.get('esp-group').prototype")));
  console.log("HTMLLIElement skip; ha-list-item-button", JSON.stringify(await count("customElements.get('ha-list-item-button').prototype")));
} finally { await browser.close(); }
