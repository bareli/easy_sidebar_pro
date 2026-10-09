import { open, SB } from "./perf-lib.mjs";
const MODE = process.env.MODE || "esp";
const { browser, page } = await open({ who: "admin" });
try {
  await page.evaluate(`(() => { ${SB}
    const P = sb.constructor.prototype; const S = (window.__p = { rp: 0, up: 0, rpMs: 0, upMs: 0, conn: 0, disc: 0, add: 0, rem: 0 });
    const ro = P._renderPanels, uo = P.updated, co = P.connectedCallback, dco = P.disconnectedCallback;
    P._renderPanels = function (a, b) { const t = performance.now(); const r = ro.call(this, a, b); S.rpMs += performance.now() - t; S.rp++; return r; };
    P.updated = function (c) { const t = performance.now(); const r = uo.call(this, c); S.upMs += performance.now() - t; S.up++; return r; };
    P.connectedCallback = function () { S.conn++; return co.call(this); }; P.disconnectedCallback = function () { S.disc++; return dco.call(this); };
    const a = window.addEventListener.bind(window), rm = window.removeEventListener.bind(window);
    window.addEventListener = (t, ...x) => { if (t === "location-changed" || t === "popstate") S.add++; return a(t, ...x); };
    window.removeEventListener = (t, ...x) => { if (t === "location-changed" || t === "popstate") S.rem++; return rm(t, ...x); };
    window.__reset = () => { for (const k of Object.keys(S)) S[k] = 0; };
  })()`);
  const nav = async (label, paths) => {
    await page.evaluate("window.__reset()");
    await page.evaluate(`(async () => { for (const p of ${JSON.stringify(paths)}) { history.pushState(null, "", p); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } })); await new Promise((r) => setTimeout(r, 700)); } })()`);
    const s = await page.evaluate("window.__p");
    console.log(JSON.stringify({ mode: MODE, label, navigations: paths.length, renderPanelsPerNav: +(s.rp / paths.length).toFixed(2), updatedPerNav: +(s.up / paths.length).toFixed(2), renderMsPerNav: +(s.rpMs / paths.length).toFixed(2), updatedMsPerNav: +(s.upMs / paths.length).toFixed(2) }));
  };
  const dashes = Array.from({ length: 20 }, (_, i) => `/perf-dash-${String(10 + i).padStart(2, "0")}`);
  await nav("20 panel navigations (HA router follows)", dashes);
  const views = Array.from({ length: 10 }, (_, i) => `/perf-dash-0${i % 3}/v${(i % 3) + 1}`);
  await nav("10 view navigations inside dashboards", views);
  // narrow / wide switches
  await page.evaluate("window.__reset()");
  for (let i = 0; i < 6; i++) { await page.setViewportSize({ width: i % 2 ? 1280 : 600, height: 900 }); await page.waitForTimeout(800); }
  const s = await page.evaluate("window.__p");
  console.log(JSON.stringify({ mode: MODE, label: "6 narrow/wide switches", connected: s.conn, disconnected: s.disc, locListenerAdds: s.add, locListenerRemoves: s.rem, renderPanels: s.rp }));
  const sbConn = await page.evaluate(`(() => { ${SB} return sb.isConnected; })()`);
  console.log("sidebar connected at end", sbConn);
  // keystroke render cost
  await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(800);
  if (MODE === "esp") {
    await page.evaluate("window.__reset()");
    await page.locator("esp-search input").click();
    await page.keyboard.type("p", { delay: 300 }); await page.keyboard.type("e", { delay: 300 }); await page.keyboard.type("rf", { delay: 300 });
    const k = await page.evaluate("window.__p");
    console.log(JSON.stringify({ label: "search keystrokes (4)", renderPanelsPerKey: k.rp / 4, renderMsPerKey: +(k.rpMs / 4).toFixed(2), updatedMsPerKey: +(k.upMs / 4).toFixed(2) }));
  }
} finally { await browser.close(); }
