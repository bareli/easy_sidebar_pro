import { open } from "./perf-lib.mjs";
import fs from "node:fs";
const MODE = process.env.MODE || "esp";
const { browser, page } = await open({ who: "admin" });
const b = browser;
try {
  const cdp = await page.context().newCDPSession(page);
  const events = [];
  cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline", transferMode: "ReportEvents" });
  await page.evaluate(async () => { const h = () => document.querySelector("home-assistant").hass; const ids = ["counter.perfc20", "counter.perfc21", "counter.perfc22"]; let i = 0; const end = performance.now() + 15000; while (performance.now() < end) { h().callService("counter", "increment", { entity_id: ids[i++ % 3] }); await new Promise((r) => setTimeout(r, 100)); } await new Promise((r) => setTimeout(r, 500)); });
  await cdp.send("Tracing.end"); await done;
  const sum = {}; const cnt = {};
  for (const e of events) if (e.ph === "X" && e.dur) { sum[e.name] = (sum[e.name] || 0) + e.dur / 1000; cnt[e.name] = (cnt[e.name] || 0) + 1; }
  const top = Object.entries(sum).filter(([n]) => ["Layout", "UpdateLayoutTree", "Paint", "PrePaint", "Layerize", "Commit", "FunctionCall", "RunTask", "HitTest", "ParseHTML", "EventDispatch", "FireAnimationFrame", "TimerFire", "UpdateLayer", "CompositeLayers", "RunMicrotasks"].includes(n)).map(([n, v]) => `${n}=${v.toFixed(0)}ms/${cnt[n]}`);
  console.log(MODE, "15 s, 10 increments/s of unrelated counters (150 updates):", top.join("  "));
} finally { await b.close(); }
