"""QA v0.5 cycle regressions (issues #41-#51), server side."""
from __future__ import annotations

import pytest

from custom_components.easy_sidebar_pro.layout import LayoutError, validate_layout

EMOJI = "\U0001F600"


def _with_link(name="Link", url="/config", aliases=None, group_name="Home"):
    layout = {
        "version": 1,
        "order": ["g:home", "l:a"],
        "groups": {"home": {"name": group_name, "icon": None, "panels": ["map"]}},
        "links": {"a": {"name": name, "icon": None, "url": url, "new_tab": False}},
    }
    if aliases is not None:
        layout["items"] = {"map": {"aliases": aliases}}
    return layout


# ---- #44 BUG-020: code points, lone surrogates refused ----


def test_44_names_count_code_points():
    assert validate_layout(_with_link(name=EMOJI * 50))["links"]["a"]["name"] == EMOJI * 50
    assert validate_layout(_with_link(group_name=EMOJI * 50))["groups"]["home"]["name"] == EMOJI * 50
    with pytest.raises(LayoutError):
        validate_layout(_with_link(name=EMOJI * 51))


@pytest.mark.parametrize("bad", ["abc\ud83d", "\ude00abc", "a\ud83d\ud83d"])
def test_44_lone_surrogates_refused_in_names(bad):
    with pytest.raises(LayoutError):
        validate_layout(_with_link(name=bad))
    with pytest.raises(LayoutError):
        validate_layout(_with_link(group_name=bad))


def test_44_lone_surrogates_refused_in_search_words_and_addresses():
    with pytest.raises(LayoutError):
        validate_layout(_with_link(aliases="word\ud83d"))
    with pytest.raises(LayoutError):
        validate_layout(_with_link(url="/config\ud83d"))
    assert validate_layout(_with_link(aliases=EMOJI * 100))["items"]["map"]["aliases"] == EMOJI * 100
    with pytest.raises(LayoutError):
        validate_layout(_with_link(aliases=EMOJI * 101))
    assert validate_layout(_with_link(url="/" + EMOJI * 1999))["links"]["a"]["url"] == "/" + EMOJI * 1999


# ---- #48 SEC-003: the scheme is matched in ASCII only (parity with www/layout.js validUrl) ----


@pytest.mark.parametrize("bad", ["http\u017f://example.invalid", "HTTP\u017f://example.invalid", "\u017fttp://x.invalid"])
def test_48_long_s_scheme_refused(bad):
    with pytest.raises(LayoutError):
        validate_layout(_with_link(url=bad))


@pytest.mark.parametrize("ok", ["HTTPS://example.com", "Http://example.com/x", "hTtPs://nas.local:5000"])
def test_48_ascii_case_variants_accepted(ok):
    assert validate_layout(_with_link(url=ok))["links"]["a"]["url"] == ok
