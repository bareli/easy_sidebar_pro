import { chromium } from "playwright";
import fs from "node:fs";
const PORT = process.env.PORT || "8137";
export const BASE = `http://127.0.0.1:${PORT}`;
const ACC = JSON.parse(fs.readFileSync(`D:/Code/home assistant extensions/easy_sidebar_pro/qa/fixtures/dev-accounts-${PORT}.json`, "utf8"));
const SCR = "C:/Users/barel/AppData/Local/Temp/claude/D--Code-home-assistant-extensions-easy-sidebar-pro/2cac0904-877a-4fd9-bc26-15b75b13144b/scratchpad";
export async function open({ who = "admin", viewport = { width: 1280, height: 900 }, dark = false, touch = false, scale = 1 } = {}) {
  const browser = await chromium.launch();
  const state = `${SCR}/esp-state-${PORT}-${who}.json`;
  let ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: scale, storageState: fs.existsSync(state) ? state : undefined });
  const page = await ctx.newPage();
  if (process.env.BASE_JS) await page.route((u) => u.pathname.startsWith("/easy_sidebar_pro_static/") && u.pathname.endsWith(".js"), (route) => { const name = new URL(route.request().url()).pathname.split("/").pop(); route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(process.env.BASE_JS + "/" + name, "utf8") }); });
  if (dark) await page.addInitScript(() => localStorage.setItem("selectedTheme", JSON.stringify({ dark: true })));
  await page.goto(BASE + "/lovelace/0");
  await page.waitForTimeout(1500);
  if (page.url().includes("/auth/")) {
    await page.locator("input[name=username]").fill(ACC[who].username);
    await page.locator("input[name=password]").fill(ACC[who].password);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.toString().includes("/auth/"), { timeout: 20000 });
    await page.waitForTimeout(1500);
    await ctx.storageState({ path: state });
  }
  if (page.url().includes("/auth/")) throw new Error("still on login");
  if (!process.env.NATIVE) await page.waitForFunction(() => window.__easySidebarPro?.status === "active", null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById("ha-launch-screen"), null, { timeout: 30000 });
  await page.waitForTimeout(1600);
  return { browser, ctx, page };
}
// evaluate with sidebar handles available
export const SB = `const sb = document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main").shadowRoot.querySelector("ha-sidebar");`;
export async function ws(page, msg) { return page.evaluate((m) => document.querySelector("home-assistant").hass.callWS(m), msg); }
