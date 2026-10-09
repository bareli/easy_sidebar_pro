import { open } from "./perf-lib.mjs";
const { browser, page } = await open({ who: "admin" });
try {
  const r = await page.evaluate(async () => {
    const main = document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main");
    const sb = main.shadowRoot.querySelector("ha-sidebar"); const parent = sb.parentNode; const next = sb.nextSibling;
    const P = sb.constructor.prototype;
    const out = { own: Object.prototype.hasOwnProperty.call(P, "disconnectedCallback"), src: String(P.disconnectedCallback).slice(0, 200), patched: !!P.__espPatched };
    const log = []; const dc = P.disconnectedCallback, cc = P.connectedCallback; P.disconnectedCallback = function () { log.push("D(" + this.isConnected + ")"); return dc.call(this); }; P.connectedCallback = function () { log.push("C(" + !!this.hass + ")"); return cc.call(this); };
    const wa = window.addEventListener, wr = window.removeEventListener;
    EventTarget.prototype.addEventListener = new Proxy(EventTarget.prototype.addEventListener, { apply(t, th, a) { if (th === window && /location|popstate/.test(a[0])) log.push("+" + a[0]); return Reflect.apply(t, th, a); } });
    EventTarget.prototype.removeEventListener = new Proxy(EventTarget.prototype.removeEventListener, { apply(t, th, a) { if (th === window && /location|popstate/.test(a[0])) log.push("-" + a[0]); return Reflect.apply(t, th, a); } });
    for (let i = 0; i < 3; i++) { sb.remove(); await new Promise((r) => setTimeout(r, 200)); log.push("|detached"); parent.insertBefore(sb, next); await new Promise((r) => setTimeout(r, 500)); log.push("|attached"); }
    out.log = log.join(" ");
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await browser.close(); }
