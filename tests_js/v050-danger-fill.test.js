// #63 BUG-024: .btn.danger keeps white text at 4.5:1 in dark theme through its own darkened fill.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../custom_components/easy_sidebar_pro/www/easy-sidebar-pro.js", import.meta.url), "utf8");

test("danger button uses --esp-danger-fill, not --esp-error-color", () => {
  const rule = SRC.match(/\.btn\.danger\s*\{([^}]*)\}/)[1];
  assert.match(rule, /background:\s*var\(--esp-danger-fill\)/);
  assert.match(rule, /border-color:\s*var\(--esp-danger-fill\)/);
  assert.doesNotMatch(rule, /--esp-error-color/);
  assert.match(SRC, /--esp-danger-fill:\s*color-mix\(in srgb, var\(--error-color, #db4437\) 70%, black\)/);
});

test("default error colour mixed 70% toward black gives >= 4.5:1 with white", () => {
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0xdb, 0x44, 0x37].map((c) => Math.round(c * 0.7));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  assert.ok(1.05 / (L + 0.05) >= 4.5);
});
