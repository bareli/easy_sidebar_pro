import { open, SB } from "./perf-lib.mjs";
const { browser, page } = await open({ who: "admin", viewport: { width: 1280, height: 1000 } });
try {
  await page.evaluate(`(() => { ${SB}
    window.__lc = []; window.__lat = []; window.__ev = [];
    const send = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { try { const o = JSON.parse(d); if (o.type === "lovelace/config") window.__lc.push(performance.now()); } catch {} return send.call(this, d); };
    const inp = sb.shadowRoot.querySelector("esp-search").shadowRoot.querySelector("input");
    inp.addEventListener("input", () => { const t = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => window.__lat.push(+(performance.now() - t).toFixed(1)))); }, true);
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__ev.push([e.name, +e.duration.toFixed(0)]))).observe({ type: "event", durationThreshold: 16, buffered: false });
  })()`);
  const rows = () => page.evaluate(`(() => { ${SB} return { rows: sb.shadowRoot.querySelectorAll('ha-list-nav.before-spacer ha-list-item-button[id^="sidebar-panel-"]').length, views: [...sb.shadowRoot.querySelectorAll('ha-list-item-button[id^="sidebar-panel-"]')].filter(i => /View \d/.test(i.textContent)).length }; })()`);
  const type = async (s) => { await page.locator("home-assistant").evaluate((_, q) => {}, null); };
  const input = page.locator("esp-search input");
  await input.click();
  const t0 = Date.now();
  await page.keyboard.type("view 2 of", { delay: 150 });
  await page.waitForTimeout(1500);
  const afterFirst = await page.evaluate(() => ({ lc: window.__lc.length, lat: window.__lat.slice(), ev: window.__ev.slice() }));
  console.log("first search (9 keys, 150ms apart)", JSON.stringify(afterFirst), JSON.stringify(await rows()));
  await page.evaluate(() => { window.__lat = []; window.__ev = []; });
  await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("perf dash 4", { delay: 100 });
  await page.waitForTimeout(800);
  console.log("second search lovelace/config total", await page.evaluate(() => window.__lc.length), "lat", JSON.stringify(await page.evaluate(() => ({ lat: window.__lat, ev: window.__ev }))), JSON.stringify(await rows()));
  // TTL: pretend 301 s passed
  await page.evaluate(() => { const n = Date.now; Date.now = () => n.call(Date) + 301000; });
  await page.keyboard.type("x", { delay: 100 }); await page.waitForTimeout(1500);
  console.log("after fake +301 s, one keystroke: lovelace/config total", await page.evaluate(() => window.__lc.length));
  await page.keyboard.type("y", { delay: 100 }); await page.waitForTimeout(800);
  console.log("one more keystroke: total", await page.evaluate(() => window.__lc.length));
  // clear
  await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace"); await page.waitForTimeout(300);
} finally { await browser.close(); }
