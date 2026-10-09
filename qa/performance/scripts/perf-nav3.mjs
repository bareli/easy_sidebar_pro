import { open } from "./perf-lib.mjs";
const MODE = process.env.MODE || "esp";
const { browser, page } = await open({ who: "admin" });
try {
  await page.evaluate(() => {
    const sb = document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main").shadowRoot.querySelector("ha-sidebar");
    const P = sb.constructor.prototype; const S = (window.__p = { rp: 0, up: 0, loc: 0 }); const ro = P._renderPanels, uo = P.updated;
    P._renderPanels = function (a, b) { S.rp++; return ro.call(this, a, b); }; P.updated = function (c) { S.up++; return uo.call(this, c); };
    window.addEventListener("location-changed", () => S.loc++);
  });
  const paths = ["perf-dash-12","perf-dash-15","perf-dash-02","perf-dash-18","map","perf-dash-10","perf-dash-04","home"];
  const res = [];
  for (const p of paths) {
    await page.evaluate(() => { Object.assign(window.__p, { rp: 0, up: 0, loc: 0 }); });
    let ok = true; try { await page.locator(`#sidebar-panel-${p}`).first().click({ timeout: 3000 }); } catch { ok = false; }
    await page.waitForTimeout(900);
    res.push({ p, ok, ...(await page.evaluate(() => window.__p)), url: page.url().split("/").pop() });
  }
  console.log(MODE, JSON.stringify(res));
} finally { await browser.close(); }
