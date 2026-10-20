"""v0.8: action rows, hold / double tap, state rules, panel labels."""
from __future__ import annotations

import pytest

from custom_components.easy_sidebar_pro.layout import LayoutError, validate_layout

BASE = {
    "version": 1,
    "order": ["g:home", "map", "l:nas", "a:lamp"],
    "groups": {"home": {"name": "Home", "panels": ["history"]}},
    "links": {"nas": {"name": "NAS", "url": "http://192.168.1.251:5000"}},
    "actions": {"lamp": {"name": "Lamp", "icon": "mdi:lamp", "tap": {"type": "toggle", "entity": "light.lamp"}}},
}


def test_action_rows_round_trip_and_stay_out_of_old_layouts():
    out = validate_layout(BASE)
    assert out["actions"] == BASE["actions"]
    assert validate_layout(out) == out
    old = {k: v for k, v in BASE.items() if k != "actions"}
    old["order"] = ["g:home", "map", "l:nas"]
    assert "actions" not in validate_layout(old)


def test_action_rows_can_be_grouped_and_pinned():
    layout = {**BASE, "order": ["g:home", "map", "l:nas"], "groups": {"home": {"name": "Home", "panels": ["history", "a:lamp"]}}}
    assert validate_layout(layout)["groups"]["home"]["panels"] == ["history", "a:lamp"]
    layout = {**BASE, "order": ["g:home", "map", "l:nas"], "grid": ["a:lamp"]}
    assert validate_layout(layout)["grid"] == ["a:lamp"]


@pytest.mark.parametrize(
    ("tap", "expected"),
    [
        ({"type": "more-info", "entity": "sensor.x"}, {"type": "more-info", "entity": "sensor.x"}),
        (
            {"type": "call-service", "service": "script.turn_on", "entity": "script.bye", "data": {"a": 1}},
            {"type": "call-service", "service": "script.turn_on", "entity": "script.bye", "data": {"a": 1}},
        ),
        ({"type": "call-service", "service": "scene.turn_on", "data": {}}, {"type": "call-service", "service": "scene.turn_on"}),
        ({"type": "toggle", "entity": "light.a", "service": "ignored.x"}, {"type": "toggle", "entity": "light.a"}),  # fields of another type are dropped
    ],
)
def test_tap_actions(tap, expected):
    layout = {**BASE, "actions": {"lamp": {"name": "Lamp", "tap": tap}}}
    assert validate_layout(layout)["actions"]["lamp"]["tap"] == expected


@pytest.mark.parametrize(
    ("action", "message"),
    [
        ({"name": "L"}, "tap: required"),
        ({"name": "L", "tap": {"type": "navigate", "path": "/x"}}, "type"),
        ({"name": "L", "tap": {"type": "toggle"}}, "entity"),
        ({"name": "L", "tap": {"type": "toggle", "entity": "Light.A"}}, "entity"),
        ({"name": "L", "tap": {"type": "call-service", "service": "nodot"}}, "service"),
        ({"name": "L", "tap": {"type": "call-service", "service": "a.b", "data": [1]}}, "object"),
        ({"name": "L", "tap": {"type": "call-service", "service": "a.b", "data": {"k": "x" * 1001}}}, "characters"),
        ({"name": "", "tap": {"type": "toggle", "entity": "light.a"}}, "name"),
        ({"name": "L", "extra": 1, "tap": {"type": "toggle", "entity": "light.a"}}, "known keys"),
        ({"name": "L", "tap": {"type": "toggle", "entity": "light.a", "bogus": 1}}, "known keys"),
    ],
)
def test_invalid_action_rows(action, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**BASE, "actions": {"lamp": action}})


def test_action_rows_must_be_placed_and_referenced_ones_defined():
    with pytest.raises(LayoutError, match="not placed"):
        validate_layout({**BASE, "order": ["g:home", "map", "l:nas"]})
    with pytest.raises(LayoutError, match="unknown action"):
        validate_layout({**BASE, "order": ["g:home", "map", "l:nas", "a:lamp", "a:nope"]})
    with pytest.raises(LayoutError, match="invalid action id"):
        validate_layout({**BASE, "actions": {"Bad Id": BASE["actions"]["lamp"]}})
    with pytest.raises(LayoutError, match="at most"):
        validate_layout({**BASE, "actions": {f"a{i}": BASE["actions"]["lamp"] for i in range(51)}})


def test_hold_and_double_tap_on_panels_links_and_actions():
    nav = {"type": "navigate", "path": "/config/automation"}
    items = {
        "map": {"hold": nav, "double_tap": {"type": "toggle", "entity": "light.a"}},
        "l:nas": {"hold": {"type": "more-info", "entity": "sensor.x"}},
        "a:lamp": {"double_tap": nav},
    }
    out = validate_layout({**BASE, "items": items})["items"]
    assert out["map"]["hold"] == nav and out["map"]["double_tap"]["entity"] == "light.a"
    assert out["l:nas"]["hold"]["type"] == "more-info"
    assert out["a:lamp"]["double_tap"] == nav
    assert "hold" not in validate_layout({**BASE, "items": {"map": {"hold": None, "aliases": "x"}}})["items"]["map"]


@pytest.mark.parametrize(
    ("items", "message"),
    [
        ({"g:home": {"hold": {"type": "toggle", "entity": "light.a"}}}, "not for groups"),
        ({"map": {"hold": {"type": "navigate", "path": "https://x.y"}}}, "path|Home Assistant"),
        ({"map": {"hold": {"type": "navigate", "path": "//evil.com"}}}, "path|Home Assistant|address"),
        ({"map": {"hold": {"type": "nothing"}}}, "type"),
        ({"map": {"double_tap": "toggle"}}, "object"),
    ],
)
def test_invalid_gestures(items, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**BASE, "items": items})


def test_state_rules():
    rules = [{"entity": "binary_sensor.door", "when": "active", "icon": "mdi:door-open", "color": "red"}, {"entity": "alarm.x", "when": "inactive", "color": "#ABC"}]
    out = validate_layout({**BASE, "items": {"a:lamp": {"state_rules": rules}, "map": {"state_rules": rules[:1]}}})["items"]
    assert out["a:lamp"]["state_rules"] == [{**rules[0]}, {"entity": "alarm.x", "when": "inactive", "icon": None, "color": "#aabbcc"}]
    assert "state_rules" in out["map"]


@pytest.mark.parametrize(
    ("items", "message"),
    [
        ({"map": {"state_rules": [{"entity": "a.b", "when": "active"}]}}, "icon or a colour"),
        ({"map": {"state_rules": [{"entity": "a.b", "when": "sometimes", "color": "red"}]}}, "active or inactive"),
        ({"map": {"state_rules": [{"when": "active", "color": "red"}]}}, "required"),
        ({"map": {"state_rules": [{"entity": "a.b", "when": "active", "color": "nope"}]}}, "colour"),
        ({"map": {"state_rules": [{"entity": "a.b", "when": "active", "icon": "javascript:x"}]}}, "icon"),
        ({"map": {"state_rules": [{"entity": f"a.b{i}", "when": "active", "color": "red"} for i in range(4)]}}, "at most"),
        ({"map": {"state_rules": "x"}}, "at most"),
        ({"g:home": {"state_rules": [{"entity": "a.b", "when": "active", "color": "red"}]}}, "not for groups"),
    ],
)
def test_invalid_state_rules(items, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**BASE, "items": items})


def test_panel_label():
    out = validate_layout({**BASE, "items": {"map": {"label": "  Karta  "}, "history": {"label": "   ", "aliases": "h"}}})["items"]
    assert out["map"]["label"] == "Karta"
    assert "label" not in out["history"]


@pytest.mark.parametrize(
    ("items", "message"),
    [
        ({"map": {"label": "x" * 51}}, "name"),
        ({"map": {"label": "a\u0007b"}}, "control"),
        ({"map": {"label": 5}}, "text"),
        ({"l:nas": {"label": "NAS"}}, "only Home Assistant panels"),
        ({"a:lamp": {"label": "Lamp"}}, "only Home Assistant panels"),
        ({"g:home": {"label": "Home"}}, "not for groups"),
    ],
)
def test_invalid_label(items, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**BASE, "items": items})


def test_badges_and_colour_work_on_action_rows():
    out = validate_layout({**BASE, "items": {"a:lamp": {"badge": "sensor.x", "badge_color": "red", "color": "amber", "show_when": "light.a"}}})["items"]["a:lamp"]
    assert out["badge"] == "sensor.x" and out["color"] == "amber"


def test_action_rows_cannot_be_tabs():
    layout = {**BASE, "order": ["g:home", "map", "l:nas"], "groups": {"home": {"name": "Home", "tabbed": True, "panels": ["history", "a:lamp"]}}}
    with pytest.raises(LayoutError, match="cannot be a tab"):
        validate_layout(layout)
    layout["groups"]["home"]["tabbed"] = False
    assert validate_layout(layout)["groups"]["home"]["panels"] == ["history", "a:lamp"]


async def test_ws_save_carries_actions_and_refuses_bad_ones(hass, entry, hass_ws_client):
    from custom_components.easy_sidebar_pro.const import DOMAIN

    layout = {**BASE, "items": {"a:lamp": {"hold": {"type": "more-info", "entity": "light.lamp"}}, "map": {"label": "Karta"}}}
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": layout})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await client.receive_json())["success"]
    event = (await client.receive_json())["event"]
    assert event["layout"] == validate_layout(layout)
    assert event["layout"]["actions"]["lamp"]["tap"]["type"] == "toggle"
    bad = {**layout, "actions": {"lamp": {"name": "Lamp", "tap": {"type": "call-service", "service": "nodot"}}}}
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": bad})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "invalid_format" and "service" in msg["error"]["message"]
