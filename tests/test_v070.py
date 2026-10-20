"""v0.7: badge colour and extra badges per item (issue #64)."""
from __future__ import annotations

import pytest

from custom_components.easy_sidebar_pro.layout import LayoutError, validate_layout

BASE = {
    "version": 1,
    "order": ["g:home", "map", "l:nas"],
    "groups": {"home": {"name": "Home", "panels": ["history"]}},
    "links": {"nas": {"name": "NAS", "url": "http://192.168.1.251:5000"}},
}


def test_badge_colour_and_extra_badges():
    items = {
        "map": {
            "badge": "sensor.overdue",
            "badge_color": "red",
            "more_badges": [{"entity": "sensor.due_soon", "color": "#FFA500"}, {"entity": "sensor.later"}],
        }
    }
    out = validate_layout({**BASE, "items": items})["items"]["map"]
    assert out["badge_color"] == "red"
    assert out["more_badges"] == [{"entity": "sensor.due_soon", "color": "#ffa500"}, {"entity": "sensor.later", "color": None}]
    assert validate_layout({**BASE, "items": {"map": out}})["items"]["map"] == out


def test_badge_colour_allowed_on_a_group_and_needs_a_badge():
    out = validate_layout({**BASE, "items": {"g:home": {"badge": "sensor.x", "badge_color": "teal"}, "map": {"badge_color": "red", "aliases": "a"}}})["items"]
    assert out["g:home"]["badge_color"] == "teal"
    assert "badge_color" not in out["map"]


def test_extra_badges_alone_keep_the_item_and_unset_keys_are_absent():
    out = validate_layout({**BASE, "items": {"l:nas": {"more_badges": [{"entity": "sensor.a", "color": None}]}, "map": {"aliases": "x"}}})["items"]
    assert out["l:nas"]["more_badges"] == [{"entity": "sensor.a", "color": None}]
    assert "more_badges" not in out["map"] and "badge_color" not in out["map"]


@pytest.mark.parametrize(
    ("items", "message"),
    [
        ({"map": {"badge": "sensor.x", "badge_color": "chartreuse"}}, "colour"),
        ({"map": {"more_badges": "sensor.x"}}, "extra badges"),
        ({"map": {"more_badges": [{"entity": f"sensor.s{i}"} for i in range(4)]}}, "extra badges"),
        ({"map": {"more_badges": [{"entity": "nope"}]}}, "entity"),
        ({"map": {"more_badges": [{"color": "red"}]}}, "required"),
        ({"map": {"more_badges": [{"entity": "sensor.a", "extra": 1}]}}, "known keys"),
        ({"map": {"more_badges": [{"entity": "sensor.a", "color": "#12"}]}}, "colour"),
        ({"g:home": {"more_badges": [{"entity": "sensor.a"}]}}, "panels and links"),
    ],
)
def test_invalid_badges(items, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**BASE, "items": items})
