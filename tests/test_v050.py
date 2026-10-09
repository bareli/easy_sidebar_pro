"""v0.5: links, per-entry extras (badge, show-only-when, search words)."""
from __future__ import annotations

import pytest

from custom_components.easy_sidebar_pro.const import DOMAIN, ITEM_KEYS, LINK_KEYS, MAX_LINKS
from custom_components.easy_sidebar_pro.layout import LayoutError, validate_layout

LINK = {"name": "Automations", "icon": "mdi:robot", "url": "/config/automation", "new_tab": False}
FULL = {
    "version": 1,
    "order": ["l:auto", "g:home", "map"],
    "groups": {"home": {"name": "Home", "icon": None, "panels": ["history", "l:site"]}},
    "grid": ["l:pin"],
    "links": {
        "auto": LINK,
        "site": {"name": "Site", "icon": None, "url": "https://example.com", "new_tab": True},
        "pin": {"name": "NAS", "url": "http://192.168.1.251:5000"},
    },
    "items": {
        "map": {"show_when": "input_boolean.alarm"},
        "g:home": {"badge": "counter.open_windows", "aliases": "  house   home "},
        "l:auto": {"aliases": "robots"},
        "energy": {"badge": "sensor.power"},
    },
}


def test_full_layout_with_links_and_items():
    out = validate_layout(FULL)
    assert list(out["links"]["auto"]) == list(LINK_KEYS)
    assert out["links"]["pin"] == {"name": "NAS", "icon": None, "url": "http://192.168.1.251:5000", "new_tab": False}
    assert out["items"]["g:home"] == {"badge": "counter.open_windows", "show_when": None, "aliases": "house home"}
    assert list(out["items"]["map"]) == list(ITEM_KEYS)
    # a panel the layout does not place (shown at the end) may still have extras
    assert out["items"]["energy"]["badge"] == "sensor.power"
    assert validate_layout(out) == out


def test_old_layout_gets_empty_links_and_items():
    out = validate_layout({"version": 1, "order": ["map"], "groups": {}})
    assert out["links"] == {} and out["items"] == {}


@pytest.mark.parametrize(
    "url",
    ["/config/automation", "/", "/lovelace/0?edit=1#x", "https://example.com", "HTTP://EXAMPLE.COM/a", "http://192.168.1.251:5000/x"],
)
def test_good_urls(url):
    data = {**FULL, "links": {**FULL["links"], "auto": {**LINK, "url": url}}}
    assert validate_layout(data)["links"]["auto"]["url"] == url


@pytest.mark.parametrize(
    "url",
    [
        "", "config", "//evil.com", "/\\evil.com", "javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x",
        "vbscript:x", "ftp://x.com", "https://", "https:///x", "/a b", "/a\nb", "/a​b", "/a b", "x" * 2001, None, 5, ["/x"],
    ],
)
def test_bad_urls(url):
    data = {**FULL, "links": {**FULL["links"], "auto": {**LINK, "url": url}}}
    with pytest.raises(LayoutError, match="address"):
        validate_layout(data)


@pytest.mark.parametrize(
    "change, message",
    [
        ({"order": ["g:home", "map"]}, "not placed"),
        ({"order": ["l:auto", "l:auto", "g:home"]}, "listed twice"),
        ({"order": ["l:nope", "l:auto", "g:home"]}, "unknown link"),
        ({"grid": ["l:pin", "l:auto"]}, "listed twice"),
        ({"links": {**FULL["links"], "Bad": LINK}}, "invalid link id"),
        ({"links": {**FULL["links"], "auto": {**LINK, "extra": 1}}}, "known keys"),
        ({"links": {**FULL["links"], "auto": {**LINK, "name": "   "}}}, "name"),
        ({"links": {**FULL["links"], "auto": {**LINK, "icon": "javascript:x"}}}, "icon"),
        ({"links": {**FULL["links"], "auto": {**LINK, "new_tab": "yes"}}}, "true or false"),
        ({"links": []}, "links must be an object"),
        ({"items": {"g:nope": {"badge": "a.b"}}}, "unknown group"),
        ({"items": {"l:nope": {"badge": "a.b"}}}, "unknown link"),
        ({"items": {"bad path!": {"badge": "a.b"}}}, "invalid panel"),
        ({"items": {"map": {"badge": "Sensor.X"}}}, "entity"),
        ({"items": {"map": {"show_when": "sensor"}}}, "entity"),
        ({"items": {"map": {"badge": "a.b c"}}}, "entity"),
        ({"items": {"map": {"other": 1}}}, "known keys"),
        ({"items": {"map": {"aliases": "x" * 101}}}, "search words"),
        ({"items": {"map": {"aliases": "a\u0007b"}}}, "control"),
        ({"items": {"map": {"aliases": 5}}}, "search words"),
        ({"items": []}, "items must be an object"),
    ],
)
def test_refused(change, message):
    with pytest.raises(LayoutError, match=message):
        validate_layout({**FULL, **change})


def test_empty_items_are_dropped():
    out = validate_layout({**FULL, "items": {"map": {"badge": None, "show_when": None, "aliases": "   "}}})
    assert out["items"] == {}


def test_too_many_links():
    links = {f"l{i}": {**LINK} for i in range(MAX_LINKS + 1)}
    with pytest.raises(LayoutError, match="links"):
        validate_layout({"version": 1, "order": [f"l:{k}" for k in links], "groups": {}, "links": links})


async def test_ws_save_carries_links_and_items(hass, entry, hass_ws_client):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": FULL})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await client.receive_json())["success"]
    event = (await client.receive_json())["event"]
    assert event["layout"] == validate_layout(FULL)
    bad = {**FULL, "links": {**FULL["links"], "auto": {**LINK, "url": "javascript:alert(1)"}}}
    await client.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": bad})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "invalid_format" and "address" in msg["error"]["message"]
