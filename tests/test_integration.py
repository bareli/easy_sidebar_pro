"""Setup, frontend module registration and the websocket API."""
from __future__ import annotations

from typing import Any

from homeassistant import config_entries
from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry, flush_store

from custom_components.easy_sidebar_pro.const import DOMAIN
from custom_components.easy_sidebar_pro.layout import validate_layout
from custom_components.easy_sidebar_pro.websocket import DATA_STORE

LAYOUT: dict[str, Any] = {
    "version": 1,
    "order": ["lovelace", "g:home", "map"],
    "groups": {"home": {"name": "בית", "icon": "mdi:home", "panels": ["calendar", "todo"]}},
}
OTHER = {"version": 1, "order": ["map", "lovelace"], "groups": {}}
# The server returns the canonical form (v0.3: colours, grid and settings filled in).
N_LAYOUT = validate_layout(LAYOUT)
N_OTHER = validate_layout(OTHER)


def _module_urls(hass: HomeAssistant) -> list[str]:
    return [u for u in hass.data[DATA_EXTRA_MODULE_URL].urls if "easy_sidebar_pro" in u]


async def test_config_flow_single_instance(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_module_url_added_and_removed(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    urls = _module_urls(hass)
    assert len(urls) == 1
    assert urls[0].startswith("/easy_sidebar_pro_static/easy-sidebar-pro.js?v=")
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert _module_urls(hass) == []
    assert DATA_STORE not in hass.data


async def test_subscribe_save_collapse_reset(hass: HomeAssistant, entry, hass_ws_client) -> None:
    ws = await hass_ws_client(hass)
    await ws.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await ws.receive_json())["success"]
    first = (await ws.receive_json())["event"]
    assert first == {"layout": None, "default": None, "own": False, "collapsed": [], "is_admin": True}

    await ws.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": LAYOUT})
    msgs = [await ws.receive_json(), await ws.receive_json()]
    event = next(m for m in msgs if m["type"] == "event")["event"]
    assert next(m for m in msgs if m["type"] == "result")["success"]
    assert event["own"] is True and event["layout"] == N_LAYOUT

    await ws.send_json_auto_id({"type": f"{DOMAIN}/collapsed", "collapsed": ["home"]})
    msgs = [await ws.receive_json(), await ws.receive_json()]
    assert next(m for m in msgs if m["type"] == "event")["event"]["collapsed"] == ["home"]

    await ws.send_json_auto_id({"type": f"{DOMAIN}/reset"})
    msgs = [await ws.receive_json(), await ws.receive_json()]
    event = next(m for m in msgs if m["type"] == "event")["event"]
    assert event["own"] is False and event["layout"] is None
    assert event["collapsed"] == ["home"]


async def test_invalid_layout_rejected(hass: HomeAssistant, entry, hass_ws_client) -> None:
    ws = await hass_ws_client(hass)
    bad = {**LAYOUT, "order": [*LAYOUT["order"], "map"]}
    await ws.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": bad})
    msg = await ws.receive_json()
    assert not msg["success"]
    assert msg["error"]["code"] == "invalid_format"
    assert "listed twice" in msg["error"]["message"]
    await ws.send_json_auto_id({"type": f"{DOMAIN}/collapsed", "collapsed": ["NOPE!"]})
    assert (await ws.receive_json())["error"]["code"] == "invalid_format"


async def test_default_layout_admin_only_and_shared(hass: HomeAssistant, entry, hass_ws_client, hass_admin_user, hass_read_only_access_token) -> None:
    admin = await hass_ws_client(hass)
    user = await hass_ws_client(hass, hass_read_only_access_token)

    await user.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await user.receive_json())["success"]
    assert (await user.receive_json())["event"]["is_admin"] is False

    await user.send_json_auto_id({"type": f"{DOMAIN}/default/set", "layout": LAYOUT})
    assert (await user.receive_json())["error"]["code"] == "unauthorized"

    await admin.send_json_auto_id({"type": f"{DOMAIN}/default/set", "layout": LAYOUT})
    assert (await admin.receive_json())["success"]
    event = (await user.receive_json())["event"]
    assert event == {"layout": N_LAYOUT, "default": N_LAYOUT, "own": False, "collapsed": [], "is_admin": False}

    # The user's own layout wins over the default; the admin's save does not reach the user.
    await user.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": OTHER})
    msgs = [await user.receive_json(), await user.receive_json()]
    assert next(m for m in msgs if m["type"] == "event")["event"]["layout"] == N_OTHER
    await admin.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": LAYOUT})
    assert (await admin.receive_json())["success"]

    await admin.send_json_auto_id({"type": f"{DOMAIN}/default/set", "layout": None})
    assert (await admin.receive_json())["success"]
    event = (await user.receive_json())["event"]
    assert event["default"] is None and event["layout"] == N_OTHER


async def test_persists_across_reload(hass: HomeAssistant, entry, hass_ws_client, hass_storage) -> None:
    ws = await hass_ws_client(hass)
    await ws.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": LAYOUT})
    assert (await ws.receive_json())["success"]
    await ws.send_json_auto_id({"type": f"{DOMAIN}/default/set", "layout": OTHER})
    assert (await ws.receive_json())["success"]

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    stored = hass_storage[DOMAIN]["data"]
    assert stored["default"] == N_OTHER
    assert list(stored["users"].values())[0]["layout"] == N_LAYOUT

    ws2 = await hass_ws_client(hass)
    await ws2.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    await ws2.receive_json()
    event = (await ws2.receive_json())["event"]
    assert event["layout"] == N_LAYOUT and event["default"] == N_OTHER and event["own"] is True


async def test_corrupt_storage_is_ignored(hass: HomeAssistant, hass_storage, hass_ws_client) -> None:
    hass_storage[DOMAIN] = {
        "version": 1,
        "key": DOMAIN,
        "data": {"default": {"version": 9}, "users": {"u1": {"layout": "x", "collapsed": ["BAD!"]}, "u2": 5}},
    }
    from homeassistant.setup import async_setup_component

    assert await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    store = hass.data[DATA_STORE]
    assert store.default is None
    assert store.users == {"u1": {"layout": None, "collapsed": []}}
    await flush_store(store._store)


async def test_not_loaded(hass: HomeAssistant, hass_ws_client) -> None:
    from homeassistant.setup import async_setup_component

    assert await async_setup_component(hass, DOMAIN, {})
    ws = await hass_ws_client(hass)
    await ws.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await ws.receive_json())["error"]["code"] == "not_loaded"
