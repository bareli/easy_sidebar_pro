import { open, SB } from "./perf-lib.mjs";
const { browser, page } = await open({ who: "admin" });
try {
  const res = await page.evaluate(`(async () => {
    ${SB}
    const h = () => document.querySelector("home-assistant").hass;
    const log = {};
    const note = (m, where) => { const k = where + ":" + m.type + ":" + (m.attributeName || "") + ":" + (m.target.nodeName || ""); log[k] = (log[k] || 0) + 1; };
    const roots = [["sb", sb.shadowRoot], ...[...sb.shadowRoot.querySelectorAll("esp-group")].map((g, i) => ["grp", g.shadowRoot]).filter(([, r]) => r)];
    const obs = roots.map(([w, r]) => { const o = new MutationObserver((ms) => ms.forEach((m) => note(m, w))); o.observe(r, { subtree: true, childList: true, attributes: true, characterData: true }); return o; });
    const ids = ["counter.perfc20","counter.perfc21"];
    for (let i = 0; i < 30; i++) { h().callService("counter", "increment", { entity_id: ids[i % 2] }); await new Promise((r) => setTimeout(r, 120)); }
    await new Promise((r) => setTimeout(r, 400));
    obs.forEach((o) => { for (const ms of [o.takeRecords()]) ms.forEach((m) => note(m, "tail")); o.disconnect(); });
    return { groupsObserved: roots.length - 1, log };
  })()`);
  console.log(JSON.stringify(res, null, 1));
} finally { await browser.close(); }
