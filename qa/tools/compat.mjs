// Easy Sidebar Pro compatibility smoke test: PORT=<port> node espjs/compat.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const PORT = process.env.PORT;
const BASE = `http://127.0.0.1:${PORT}`;
const ACC = JSON.parse(fs.readFileSync(`D:/Code/home assistant extensions/easy_sidebar_pro/qa/fixtures/dev-accounts-${PORT}.json`, "utf8"));
const SHOT = `D:/Code/home assistant extensions/good_days/.playwright-mcp/compat-${PORT}`;
const SB = `document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main").shadowRoot.querySelector("ha-sidebar")`;
const res = { port: PORT, errors: [] };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => res.errors.push(e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && /easy|esp-|sidebar/i.test(m.text())) res.errors.push(m.text().slice(0, 160)); });
  await page.goto(BASE + "/");
  await page.waitForTimeout(2000);
  if (page.url().includes("/auth/")) {
    await page.locator("input[name=username]").fill(ACC.admin.username);
    await page.locator("input[name=password]").fill(ACC.admin.password);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.toString().includes("/auth/"), { timeout: 30000 });
  }
  await page.waitForFunction(() => !document.getElementById("ha-launch-screen") && document.querySelector("home-assistant")?.hass, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  res.ha = await page.evaluate(() => document.querySelector("home-assistant").hass.config.version);
  res.status = await page.evaluate(() => window.__easySidebarPro?.status ?? null);
  res.listNav = await page.evaluate(() => !!customElements.get("ha-list-nav"));
  const ws = (m) => page.evaluate((m) => document.querySelector("home-assistant").hass.callWS(m), m);
  const snap = (await ws({ type: "frontend/get_user_data", key: "sidebar" })).value ?? null;
  if (res.status === "active") {
    await ws({ type: "easy_sidebar_pro/save", layout: { version: 1, order: ["g:c1"], groups: { c1: { name: "בדיקה", icon: "mdi:home", panels: ["map", "todo"] } } } });
    await page.waitForTimeout(1000);
    res.render = await page.evaluate(`(() => { const r = ${SB}.shadowRoot; return { groups: r.querySelectorAll("esp-group").length, grouped: r.querySelectorAll("ha-list-item-button[data-esp-group]").length, pencil: !!r.querySelector(".esp-edit") }; })()`);
    await page.screenshot({ path: SHOT + "-sidebar.png", clip: { x: 1180, y: 0, width: 260, height: 600 } });
    // fold
    await page.evaluate(`${SB}.shadowRoot.querySelector("esp-group").click()`);
    await page.waitForTimeout(500);
    res.fold = await page.evaluate(`(() => { const r = ${SB}.shadowRoot; const g = r.querySelector("esp-group"); return { expanded: (g.shadowRoot?.querySelector("[aria-expanded]") ?? g).getAttribute("aria-expanded"), grouped: r.querySelectorAll("ha-list-item-button[data-esp-group]").length }; })()`);
    await page.evaluate(`${SB}.shadowRoot.querySelector("esp-group").click()`);
    await page.waitForTimeout(500);
    // keyboard open + leak check over 5 open/cancel cycles
    let ok = true;
    for (let i = 0; i < 5; i++) {
      await page.evaluate(`${SB}.shadowRoot.querySelector(".esp-edit").focus()`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      const open = await page.evaluate(`!!${SB}.shadowRoot.querySelector("esp-editor")?.isConnected`);
      ok = ok && open;
      await page.locator('esp-editor .bar .btn:not(.primary)').first().click();
      await page.waitForTimeout(400);
    }
    res.keyboardOpen5x = ok;
    res.listItems = await page.evaluate(`(() => { const nav = ${SB}.shadowRoot.querySelector("ha-list-nav.before-spacer"); const items = nav?.items ?? []; return { items: items.length, detached: items.filter((i) => !i.isConnected).length }; })()`);
    // drag-merge two top-level rows in the editor
    await page.evaluate(`${SB}.shadowRoot.querySelector(".esp-edit").click()`);
    await page.waitForTimeout(600);
    const rows = await page.evaluate(`(() => { const ed = ${SB}.shadowRoot.querySelector("esp-editor"); return [...ed.shadowRoot.querySelectorAll('.row[data-key^="p:"]')].filter((r) => !r.dataset.group).slice(0, 2).map((r) => { const h = r.querySelector(".handle").getBoundingClientRect(); const b = r.getBoundingClientRect(); return { key: r.dataset.key, hx: h.x + h.width / 2, hy: h.y + h.height / 2, mid: b.y + b.height / 2 }; }); })()`);
    if (rows.length === 2) {
      const [a, b] = rows;
      await page.mouse.move(b.hx, b.hy); await page.mouse.down();
      for (let i = 1; i <= 12; i++) { await page.mouse.move(b.hx, b.hy + (a.mid - b.hy) * i / 12); await page.waitForTimeout(16); }
      await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(400);
      await page.keyboard.type("שניה"); await page.keyboard.press("Enter");
      await page.locator("esp-editor .bar .btn.primary").first().click();
      await page.waitForTimeout(1200);
      const lay = await page.evaluate(() => new Promise((r) => { const h = document.querySelector("home-assistant").hass; h.connection.subscribeMessage((m) => r(m.layout), { type: "easy_sidebar_pro/subscribe" }).then((u) => setTimeout(u, 300)); }));
      res.mergeSaved = Object.values(lay?.groups ?? {}).some((g) => g.name === "שניה" && g.panels.length === 2);
    } else res.mergeSaved = "not enough rows";
    // HA's own order change adopted (UX-002)
    const cur = (await ws({ type: "frontend/get_user_data", key: "sidebar" })).value ?? {};
    await ws({ type: "frontend/set_user_data", key: "sidebar", value: { ...cur, panelOrder: ["todo", "map", ...(cur.panelOrder ?? []).filter((p) => p !== "todo" && p !== "map")] } });
    await page.waitForTimeout(2500);
    const lay2 = await page.evaluate(() => new Promise((r) => { const h = document.querySelector("home-assistant").hass; h.connection.subscribeMessage((m) => r(m.layout), { type: "easy_sidebar_pro/subscribe" }).then((u) => setTimeout(u, 300)); }));
    res.adoptOrder = lay2?.groups?.c1?.panels;
    await page.screenshot({ path: SHOT + "-after.png", clip: { x: 1180, y: 0, width: 260, height: 600 } });
    await ws({ type: "easy_sidebar_pro/reset" });
  } else {
    await page.screenshot({ path: SHOT + "-native.png", clip: { x: 1180, y: 0, width: 260, height: 600 } });
    res.nativeRows = await page.evaluate(`${SB}.shadowRoot.querySelectorAll('[id^="sidebar-panel-"]').length`);
  }
  await ws({ type: "frontend/set_user_data", key: "sidebar", value: snap });
} catch (e) {
  res.fatal = String(e).slice(0, 300);
} finally {
  await browser.close();
}
console.log(JSON.stringify(res));
