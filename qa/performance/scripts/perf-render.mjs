import { open, SB, ws } from "./perf-lib.mjs";
const MODE = process.env.MODE || "esp";
const { browser, ctx, page } = await open({ who: "admin" });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
try {
  await page.evaluate(`(() => {
    ${SB}
    const P = sb.constructor.prototype;
    const S = (window.__perf = { su: 0, suTrue: 0, rp: 0, rpMs: 0, up: 0, upMs: 0, suMs: 0, rpMax: 0, upMax: 0 });
    const so = P.shouldUpdate, ro = P._renderPanels, uo = P.updated;
    P.shouldUpdate = function (c) { const t = performance.now(); const r = so.call(this, c); S.suMs += performance.now() - t; S.su++; if (r) S.suTrue++; return r; };
    P._renderPanels = function (a, b) { const t = performance.now(); const r = ro.call(this, a, b); const d = performance.now() - t; S.rp++; S.rpMs += d; S.rpMax = Math.max(S.rpMax, d); return r; };
    P.updated = function (c) { const t = performance.now(); const r = uo.call(this, c); const d = performance.now() - t; S.up++; S.upMs += d; S.upMax = Math.max(S.upMax, d); return r; };
    window.__perfReset = () => { for (const k of Object.keys(S)) S[k] = 0; };
  })()`);
  const phase = async (name, ids, secs, rate = 10) => {
    await page.evaluate("window.__perfReset()");
    const m0 = await metrics();
    const t0 = Date.now();
    const sent = await page.evaluate(`(async () => { const h = () => document.querySelector("home-assistant").hass; const ids = ${JSON.stringify(ids)}; let n = 0, i = 0; const end = performance.now() + ${secs * 1000}; while (performance.now() < end) { if (ids.length) { h().callService("counter", "increment", { entity_id: ids[i++ % ids.length] }); n++; } await new Promise((r) => setTimeout(r, ${1000 / rate})); } await new Promise((r) => setTimeout(r, 500)); return n; })()`);
    const m1 = await metrics();
    const S = await page.evaluate("window.__perf");
    const secsReal = (Date.now() - t0) / 1000;
    const d = (k) => +(((m1[k] - m0[k]) * 1000) / 1).toFixed(0);
    console.log(JSON.stringify({ mode: MODE, phase: name, calls: sent, secs: +secsReal.toFixed(1), shouldUpdateCalls: S.su, shouldUpdateTrue: S.suTrue, renderPanels: S.rp, renderMsAvg: S.rp ? +(S.rpMs / S.rp).toFixed(3) : null, renderMsMax: +S.rpMax.toFixed(2), updatedCalls: S.up, updatedMsAvg: S.up ? +(S.upMs / S.up).toFixed(3) : null, updatedMsMax: +S.upMax.toFixed(2), shouldUpdateMsAvg: S.su ? +(S.suMs / S.su).toFixed(4) : null, cdpScriptMs: d("ScriptDuration"), cdpTaskMs: d("TaskDuration"), cdpLayoutMs: d("LayoutDuration"), cdpStyleMs: d("RecalcStyleDuration") }));
  };
  const watched = Array.from({ length: 20 }, (_, i) => `counter.perfc${i}`);
  const unrelated = Array.from({ length: 5 }, (_, i) => `counter.perfc${20 + i}`);
  await phase("idle10s", [], 10);
  await phase("unrelated-10ps-30s", unrelated, 30);
  await phase("watched-10ps-30s", watched, 30);
} finally { await browser.close(); }
