import { open } from "./perf-lib.mjs";
const { browser, page } = await open({ who: "admin" });
try {
  const r = await page.evaluate(async () => {
    const main = document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main");
    const sb = main.shadowRoot.querySelector("ha-sidebar"); const parent = sb.parentNode; const next = sb.nextSibling;
    const log = [];
    const a = window.addEventListener.bind(window), rm = window.removeEventListener.bind(window);
    window.addEventListener = (t, ...x) => { if (/location-changed|popstate/.test(t)) log.push("+" + t); return a(t, ...x); };
    window.removeEventListener = (t, ...x) => { if (/location-changed|popstate/.test(t)) log.push("-" + t); return rm(t, ...x); };
    const send = WebSocket.prototype.send; const subs = {};
    WebSocket.prototype.send = function (d) { try { const o = JSON.parse(d); if (o.type === "unsubscribe_events") log.push("unsub#" + o.subscription); else if (/easy_sidebar_pro\/subscribe|subscribe_user_data/.test(o.type)) { subs[o.id] = o.type; log.push("sub:" + o.type + "#" + o.id); } } catch {} return send.call(this, d); };
    for (let c = 0; c < 3; c++) {
      log.push("|cycle" + c + " remove");
      sb.remove(); await new Promise((r) => setTimeout(r, 200));
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: true } }));
      await new Promise((r) => setTimeout(r, 400));
      log.push("|reinsert"); parent.insertBefore(sb, next);
      await new Promise((r) => setTimeout(r, 800));
      sb.requestUpdate?.(); main.requestUpdate?.(); await new Promise((r) => setTimeout(r, 800));
    }
    const st = window.__easySidebarPro?.status;
    const rows = sb.shadowRoot.querySelectorAll('ha-list-item-button[id^="sidebar-panel-"]').length;
    const groups = sb.shadowRoot.querySelectorAll("esp-group").length;
    return { status: st, rows, groups, subs, log: log.join(" ") };
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await browser.close(); }
