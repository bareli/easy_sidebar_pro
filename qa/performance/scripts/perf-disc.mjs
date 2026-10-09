import { open } from "./perf-lib.mjs";
const { browser, page } = await open({ who: "admin" });
try {
  const r = await page.evaluate(async () => {
    const main = document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main");
    const sb = main.shadowRoot.querySelector("ha-sidebar"); const parent = sb.parentNode; const next = sb.nextSibling;
    const S = { add: 0, rem: 0, subs: [], unsubs: 0 };
    const a = window.addEventListener.bind(window), rm = window.removeEventListener.bind(window);
    S.all = []; window.addEventListener = (t, ...x) => { S.all.push("+" + t); if (t === "location-changed" || t === "popstate") S.add++; return a(t, ...x); };
    window.removeEventListener = (t, ...x) => { S.all.push("-" + t); if (t === "location-changed" || t === "popstate") S.rem++; return rm(t, ...x); };
    const send = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { try { const o = JSON.parse(d); S.subs.push(o.type + (o.subscription ? "#sub" : "")); if (o.type === "unsubscribe_events") S.unsubs++; } catch {} return send.call(this, d); };
    for (let i = 0; i < 5; i++) { sb.remove(); await new Promise((r) => setTimeout(r, 200)); parent.insertBefore(sb, next); await new Promise((r) => setTimeout(r, 500)); }
    const counts = {}; for (const s of S.subs) counts[s] = (counts[s] || 0) + 1;
    const ev = {}; for (const e of S.all) ev[e] = (ev[e] || 0) + 1; return { add: S.add, rem: S.rem, subs: counts, unsubs: S.unsubs, ev };
  });
  console.log("5 detach/reattach cycles", JSON.stringify(r));
} finally { await browser.close(); }
