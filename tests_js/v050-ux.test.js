// v0.5 owner rulings 2026-10-09 (issues #40, #52-#62).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../custom_components/easy_sidebar_pro/www/layout.js";

const SRC = readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const strings = (lang) => {
  const start = SRC.indexOf(`  ${lang}: {`);
  return SRC.slice(start, SRC.indexOf("\n  },", start));
};
const EN = strings("en");
const HE = strings("he");

/* ---- #40 BUG-016: badge fill dark enough for white text and the dot ---- */

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mixBlack = (c, p) => c.map((v) => Math.round(v * p));

test("#40 our badges (rows and group header) use the accent mixed 60% with black under white text", () => {
  const fill = /background-color: color-mix\(in srgb, var\(--accent-color\) 60%, black\); color: #fff;/;
  const group = SRC.slice(SRC.indexOf("const GROUP_CSS"), SRC.indexOf("class EspGroup"));
  assert.match(group.match(/\n\.badge \{[^}]*\}/)[0], fill);
  const side = SRC.slice(SRC.indexOf("const SIDEBAR_CSS"), SRC.indexOf("let sidebarSheet"));
  assert.match(side, /ha-list-item-button > \.badge\.esp-badge \{[^}]*color-mix\(in srgb, var\(--accent-color\) 60%, black\); color: #fff; \}/);
  // HA's own badges (Settings) are not restyled: only .esp-badge.
  assert.doesNotMatch(side, /(^|\n)\.badge \{/);
});

test("#40 HA's default orange mixed 60% with black: white 4.5:1, dot 3:1 on light and dark sidebars", () => {
  const fill = mixBlack(hex("#ff9800"), 0.6);
  assert.ok(L.contrast([255, 255, 255], fill) >= 4.5);
  assert.ok(L.contrast(fill, [255, 255, 255]) >= 3);
  assert.ok(L.contrast(fill, [250, 250, 250]) >= 3);
  assert.ok(L.contrast(fill, [28, 28, 28]) >= 3);
});
