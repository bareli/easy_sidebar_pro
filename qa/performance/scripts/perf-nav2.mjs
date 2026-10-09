import { open } from "./perf-lib.mjs";
const { browser, page } = await open({ who: "admin" });
try {
  const out = await page.evaluate(async () => {
    const sb = document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main").shadowRoot.querySelector("ha-sidebar");
    const log = []; const ru = sb.requestUpdate.bind(sb);
    sb.requestUpdate = function (...a) { log.push((new Error().stack || "").split("\n").slice(2, 7).map((l) => l.trim().replace(/https?:\/\/[^ )]*\//g, "")).join(" < ")); return ru(...a); };
    history.pushState(null, "", "/perf-dash-12"); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    await new Promise((r) => setTimeout(r, 1000)); return log;
  });
  console.log(out.join("\n---\n"));
} finally { await browser.close(); }
