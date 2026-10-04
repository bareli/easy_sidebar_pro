// v0.3.1 forum fixes: hide the folded count (#36), group headers as wide as HA's rows in the narrow drawer (#37).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");
const PY = fs.readFileSync(new URL("../custom_components/easy_sidebar_pro/const.py", import.meta.url), "utf8");

test("#36 hide_count: defaults to false, keeps booleans only, same default as the server", () => {
  assert.equal(L.DEFAULT_SETTINGS.hide_count, false);
  assert.equal(L.cleanSettings({ hide_count: true }).hide_count, true);
  assert.equal(L.cleanSettings({ hide_count: "yes" }).hide_count, false);
  assert.equal(L.cleanSettings({}).hide_count, false);
  assert.match(PY, /"hide_count": False,/);
  assert.equal(L.toLayout([], { ...L.DEFAULT_SETTINGS, hide_count: true }).settings.hide_count, true);
});

test("#36 hide_count: editor checkbox, both languages, passed to the group header", () => {
  assert.match(SRC, /check\("hide_count", "hideCount"\)/);
  assert.equal(SRC.match(/^\s+hideCount: "/gm).length, 2);
  assert.match(SRC, /this\.settings\.header, this\.settings\.hide_count\)/);
  assert.match(SRC, /row\.collapsed && !hideCount \? String\(row\.count\) : ""/);
  // The screen-reader name keeps the count.
  assert.match(SRC, /aria-label", `\$\{row\.name\}, \$\{count\}`/);
});

test("#37 group header rows take HA's item width: 248 px expanded, 240 px in the narrow drawer", () => {
  assert.match(SRC, /margin-inline: 4px; width: var\(--esp-item-width, auto\);/);
  assert.match(SRC, /:host\(\[expanded\]\) esp-group \{ --esp-item-width: var\(--ha-sidebar-expanded-item-width, 248px\); \}/);
  assert.match(SRC, /:host\(\[narrow\]\[expanded\]\) esp-group \{ --esp-item-width: calc\(240px - var\(--safe-area-inset-left, 0px\)\); \}/);
});

test("editor hint names the eye button (hide / show), both languages", () => {
  assert.match(SRC, /hint: "Drag a row onto another row to make a group\. The eye button hides or shows an item\.",/);
  assert.match(SRC, /hint: "גררו שורה אל שורה אחרת כדי ליצור קבוצה\. כפתור העין מסתיר או מציג פריט\.",/);
});
