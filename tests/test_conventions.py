"""Repository conventions for the frontend module."""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
WWW = ROOT / "custom_components" / "easy_sidebar_pro" / "www"


def test_no_console_log_or_inner_html():
    for path in WWW.glob("*.js"):
        text = path.read_text(encoding="utf-8")
        assert "console.log" not in text, path.name
        assert "innerHTML" not in text, path.name


def test_versions_match():
    manifest = json.loads((ROOT / "custom_components" / "easy_sidebar_pro" / "manifest.json").read_text(encoding="utf-8"))
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## v{manifest['version']} " in changelog


def test_translations_match_strings():
    base = ROOT / "custom_components" / "easy_sidebar_pro"
    strings = json.loads((base / "strings.json").read_text(encoding="utf-8"))
    assert json.loads((base / "translations" / "en.json").read_text(encoding="utf-8")) == strings

    def keys(d, prefix=""):
        return {prefix + k for k in d} | {x for k, v in d.items() if isinstance(v, dict) for x in keys(v, prefix + k + ".")}

    he = json.loads((base / "translations" / "he.json").read_text(encoding="utf-8"))
    assert keys(he) == keys(strings)


def test_js_string_tables_have_same_keys():
    text = (WWW / "easy-sidebar-pro.js").read_text(encoding="utf-8")
    start = text.index("const STRINGS = {")
    block = text[start : text.index("\n};", start)]
    en = block[block.index("  en: {") : block.index("  he: {")]
    he = block[block.index("  he: {") :]

    def names(part):
        return {line.strip().split(":")[0] for line in part.splitlines() if line.startswith("    ") and ":" in line}

    assert names(en) == names(he)
