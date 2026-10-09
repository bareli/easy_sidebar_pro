"""v0.6: an item's own icon colour (forum #15)."""
from __future__ import annotations

import pytest

from custom_components.easy_sidebar_pro.layout import LayoutError, validate_layout

BASE = {
    "version": 1,
    "order": ["g:home", "map", "l:nas"],
    "groups": {"home": {"name": "Home", "panels": ["history"]}},
    "links": {"nas": {"name": "NAS", "url": "http://192.168.1.251:5000"}},
}


def test_item_colour_on_panels_and_links():
    out = validate_layout({**BASE, "items": {"map": {"color": "red"}, "history": {"color": "#ABC"}, "l:nas": {"color": "#00ff00", "badge": "sensor.x"}}})
    assert out["items"]["map"] == {"badge": None, "show_when": None, "aliases": "", "color": "red"}
    assert out["items"]["history"]["color"] == "#aabbcc"
    assert out["items"]["l:nas"]["color"] == "#00ff00"
    assert validate_layout(out) == out


def test_no_colour_key_when_unset():
    out = validate_layout({**BASE, "items": {"map": {"color": None, "aliases": "world"}, "history": {"color": None}}})
    assert "color" not in out["items"]["map"]
    assert "history" not in out["items"]


@pytest.mark.parametrize(
    ("items", "message"),
    [
        ({"map": {"color": "chartreuse"}}, "colour"),
        ({"map": {"color": "#12345"}}, "colour"),
        ({"map": {"color": 5}}, "colour"),
        ({"map": {"color": "var(--x)"}}, "colour"),
        ({"g:home": {"color": "red"}}, "group"),
    ],
)
def test_invalid_item_colour(items, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**BASE, "items": items})
