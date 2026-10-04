"""v0.3.0: group colours, display / collapse settings and the pinned grid (#27, #28, #29)."""
from __future__ import annotations

import copy
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.easy_sidebar_pro.const import DEFAULT_SETTINGS, DOMAIN, MAX_PINNED, NAMED_COLORS
from custom_components.easy_sidebar_pro.layout import LayoutError, validate_layout, validate_settings
from custom_components.easy_sidebar_pro.websocket import DATA_STORE

FULL: dict[str, Any] = {
    "version": 1,
    "order": ["lovelace", "g:home", "map"],
    "groups": {
        "home": {"name": "בית", "icon": "mdi:home", "color": "#E91E63", "icon_color": "teal", "panels": ["calendar", "todo"]},
    },
    "grid": ["energy", "logbook"],
    "settings": {"start_collapsed": True, "accordion": True, "toggle_all": True, "hide_count": True, "header": "tinted", "divider": "none"},
}


def test_full_layout_is_normalised():
    out = validate_layout(FULL)
    assert out["groups"]["home"]["color"] == "#e91e63"
    assert out["groups"]["home"]["icon_color"] == "teal"
    assert out["grid"] == ["energy", "logbook"]
    assert out["settings"] == FULL["settings"]
    assert list(out) == ["version", "order", "groups", "grid", "settings"]


def test_old_layout_gets_defaults():
    """A v0.1 / v0.2 layout (no colours, grid or settings) loads with the defaults."""
    old = {"version": 1, "order": ["g:a", "map"], "groups": {"a": {"name": "A", "icon": None, "panels": ["todo"]}}}
    out = validate_layout(old)
    assert out["groups"]["a"] == {"name": "A", "icon": None, "color": None, "icon_color": None, "start_open": False, "panels": ["todo"]}
    assert out["grid"] == []
    assert out["settings"] == DEFAULT_SETTINGS
    assert validate_layout(out) == out


@pytest.mark.parametrize("color", [*NAMED_COLORS, "#000000", "#abcdef", "#ABCDEF", "#abc", None])
def test_valid_colours(color):
    data = copy.deepcopy(FULL)
    data["groups"]["home"]["color"] = color
    out = validate_layout(data)["groups"]["home"]["color"]
    if color is not None and color.startswith("#"):
        assert out == ("#aabbcc" if color == "#abc" else color.lower())
    else:
        assert out == color


@pytest.mark.parametrize(
    "color",
    [
        "", "red ", "Red", "#12345", "#1234567", "#ggg", "abcdef", "#abc\n", "rgb(1,2,3)", "var(--x)",
        "url(javascript:alert(1))", "red;background:url(x)", "expression(1)", 7, True, ["red"], {"r": 1},
        "transparent", "deep-purple",
    ],
)
@pytest.mark.parametrize("field", ["color", "icon_color"])
def test_invalid_colours_rejected(field, color):
    data = copy.deepcopy(FULL)
    data["groups"]["home"][field] = color
    with pytest.raises(LayoutError, match="invalid colour"):
        validate_layout(data)


@pytest.mark.parametrize(
    ("settings", "message"),
    [
        ("x", "settings must be an object"),
        ([], "settings must be an object"),
        ({"accordion": 1}, "true or false"),
        ({"start_collapsed": "yes"}, "true or false"),
        ({"toggle_all": None}, "true or false"),
        ({"hide_count": "no"}, "true or false"),
        ({"header": "bold"}, "settings.header"),
        ({"header": True}, "settings.header"),
        ({"divider": "dotted"}, "settings.divider"),
        ({"evil": True}, "unknown key"),
        ({**DEFAULT_SETTINGS, "extra": 1}, "settings must be an object"),
    ],
)
def test_invalid_settings(settings, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**FULL, "settings": settings})


def test_settings_partial_and_none():
    assert validate_settings(None) == DEFAULT_SETTINGS
    assert validate_settings({"accordion": True}) == {**DEFAULT_SETTINGS, "accordion": True}


@pytest.mark.parametrize(
    ("grid", "message"),
    [
        ("energy", "grid must be a list"),
        (["map"], "listed twice"),
        (["calendar"], "listed twice"),
        (["energy", "energy"], "listed twice"),
        (["../x"], "invalid panel"),
        (["energy\n"], "invalid panel"),
        ([f"p{i}" for i in range(MAX_PINNED + 1)], f"at most {MAX_PINNED} pinned"),
    ],
)
def test_invalid_grid(grid, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**FULL, "grid": grid})


def test_grid_counts_toward_entry_limit():
    order = [f"p{i}" for i in range(490)]
    grid = [f"q{i}" for i in range(11)]
    with pytest.raises(LayoutError, match="at most 500 entries"):
        validate_layout({"version": 1, "order": order, "groups": {}, "grid": grid})
    assert len(validate_layout({"version": 1, "order": order, "groups": {}, "grid": grid[:10]})["grid"]) == 10


async def test_ws_save_and_default_carry_v030_fields(hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client, hass_read_only_access_token) -> None:
    admin = await hass_ws_client(hass)
    user = await hass_ws_client(hass, hass_read_only_access_token)
    await user.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await user.receive_json())["success"]
    await user.receive_json()

    await admin.send_json_auto_id({"type": f"{DOMAIN}/default/set", "layout": FULL})
    assert (await admin.receive_json())["success"]
    event = (await user.receive_json())["event"]
    assert event["layout"] == validate_layout(FULL) and event["own"] is False

    bad = copy.deepcopy(FULL)
    bad["groups"]["home"]["color"] = "red;}"
    await user.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": bad})
    msg = await user.receive_json()
    assert msg["error"]["code"] == "invalid_format"
    await user.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": {**FULL, "settings": {"header": "x"}}})
    assert (await user.receive_json())["error"]["code"] == "invalid_format"
    await user.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": {**FULL, "grid": [f"p{i}" for i in range(MAX_PINNED + 1)]}})
    assert (await user.receive_json())["error"]["code"] == "invalid_format"


async def test_stored_v020_layout_migrates_on_load(hass: HomeAssistant, hass_storage, hass_ws_client) -> None:
    """Layouts saved by v0.2 load with defaults; nothing is lost."""
    old = {"version": 1, "order": ["g:a", "map"], "groups": {"a": {"name": "סלון", "icon": "mdi:sofa", "panels": ["todo"]}}}
    hass_storage[DOMAIN] = {"version": 1, "key": DOMAIN, "data": {"default": old, "users": {"u1": {"layout": old, "collapsed": ["a"]}}}}
    from homeassistant.setup import async_setup_component

    assert await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    store = hass.data[DATA_STORE]
    for layout in (store.default, store.users["u1"]["layout"]):
        assert layout["groups"]["a"]["name"] == "סלון" and layout["groups"]["a"]["color"] is None
        assert layout["grid"] == [] and layout["settings"] == DEFAULT_SETTINGS
    assert store.users["u1"]["collapsed"] == ["a"]
    await hass.config_entries.async_unload(entry.entry_id)


def test_js_rules_match_server():
    """Validation parity (historical risk): the editor's lists and limits equal the server's."""
    import json
    import pathlib
    import re

    from custom_components.easy_sidebar_pro.const import DIVIDER_STYLES, GROUP_KEYS, HEADER_STYLES

    js = (pathlib.Path(__file__).parent.parent / "custom_components" / "easy_sidebar_pro" / "www" / "layout.js").read_text(encoding="utf-8")

    def const(name):
        return re.search(rf"export const {name} = (.+?);\n", js).group(1)

    assert json.loads(const("NAMED_COLORS")) == list(NAMED_COLORS)
    assert json.loads(const("HEADER_STYLES")) == list(HEADER_STYLES)
    assert json.loads(const("DIVIDER_STYLES")) == list(DIVIDER_STYLES)
    # Group fields (#33 start_open): same keys, same order as the server's output.
    assert json.loads(const("GROUP_KEYS")) == list(GROUP_KEYS)
    assert list(validate_layout(FULL)["groups"]["home"]) == list(GROUP_KEYS)
    assert int(const("MAX_PINNED")) == MAX_PINNED
    defaults = re.sub(r"(\w+):", r'"\1":', const("DEFAULT_SETTINGS")[len("Object.freeze(") : -1])
    assert json.loads(defaults) == DEFAULT_SETTINGS


# ---- forum requests: per-group "starts open" (#33) and the "pill" header style (#34) ----


def test_start_open_validated_and_defaulted():
    data = copy.deepcopy(FULL)
    data["groups"]["home"]["start_open"] = True
    assert validate_layout(data)["groups"]["home"]["start_open"] is True
    del data["groups"]["home"]["start_open"]
    assert validate_layout(data)["groups"]["home"]["start_open"] is False


@pytest.mark.parametrize("value", [1, 0, "true", None, [], {"a": 1}])
def test_start_open_must_be_boolean(value):
    data = copy.deepcopy(FULL)
    data["groups"]["home"]["start_open"] = value
    with pytest.raises(LayoutError, match=r"start_open: must be true or false"):
        validate_layout(data)


def test_pill_header_style():
    assert validate_settings({"header": "pill"})["header"] == "pill"
    for bad in ("Pill", "pill ", "rounded"):
        with pytest.raises(LayoutError, match="settings.header"):
            validate_settings({"header": bad})


async def test_ws_forum_layout_per_user_and_default(hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client, hass_read_only_access_token) -> None:
    """The forum setup (main group starts open, accordion, pill) saves per user and as the admin default."""
    forum = copy.deepcopy(FULL)
    forum["order"] = ["lovelace", "g:home", "g:media", "map"]
    forum["groups"]["home"]["start_open"] = True
    forum["groups"]["media"] = {"name": "Media", "icon": None, "panels": ["media-browser"]}
    forum["settings"] = {"start_collapsed": True, "accordion": True, "header": "pill"}
    admin = await hass_ws_client(hass)
    user = await hass_ws_client(hass, hass_read_only_access_token)
    await user.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await user.receive_json())["success"]
    await user.receive_json()

    await admin.send_json_auto_id({"type": f"{DOMAIN}/default/set", "layout": forum})
    assert (await admin.receive_json())["success"]
    event = (await user.receive_json())["event"]
    assert event["layout"]["groups"]["home"]["start_open"] is True
    assert event["layout"]["groups"]["media"]["start_open"] is False
    assert event["layout"]["settings"]["header"] == "pill"

    forum["groups"]["media"]["start_open"] = True
    await user.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": forum})
    msgs = [await user.receive_json(), await user.receive_json()]
    assert any(m.get("type") == "result" and m["success"] for m in msgs)
    event = next(m for m in msgs if m.get("type") == "event")["event"]
    assert event["own"] is True and event["layout"]["groups"]["media"]["start_open"] is True
    store = hass.data[DATA_STORE]
    assert store.default["groups"]["media"]["start_open"] is False

    forum["groups"]["media"]["start_open"] = "yes"
    await user.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": forum})
    assert (await user.receive_json())["error"]["code"] == "invalid_format"
