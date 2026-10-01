"""Failing regression tests for reproduced QA defects (qa-engineer). They pass once the defect is fixed."""
from __future__ import annotations

import asyncio

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.easy_sidebar_pro.const import DOMAIN
from custom_components.easy_sidebar_pro.layout import validate_layout



async def _recv(ws):
    async with asyncio.timeout(3):
        return await ws.receive_json()


LAYOUT = {"version": 1, "order": ["map", "g:home"], "groups": {"home": {"name": "בית", "icon": None, "panels": ["todo"]}}}
N_LAYOUT = validate_layout(LAYOUT)


async def test_bug_010_subscription_survives_entry_reload(hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client) -> None:
    """BUG-010: after the config entry reloads, an open subscription must report the new store's data."""
    ws = await hass_ws_client(hass)
    await ws.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await ws.receive_json())["success"]
    assert (await ws.receive_json())["event"]["layout"] is None

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert (await _recv(ws))["type"] == "event"  # refresh pushed by the reloaded entry

    await ws.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": LAYOUT})
    msgs = [await ws.receive_json(), await ws.receive_json()]
    assert next(m for m in msgs if m["type"] == "result")["success"]
    events = [m["event"] for m in msgs if m["type"] == "event"]
    assert events, "no event after save"
    assert events[-1]["layout"] == N_LAYOUT, f"open subscription got stale data: {events[-1]}"


async def test_bug_010_reload_pushes_new_store_to_open_subscription(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client
) -> None:
    """BUG-010: an open subscription is refreshed from the new store when the entry reloads."""
    ws = await hass_ws_client(hass)
    await ws.send_json_auto_id({"type": f"{DOMAIN}/subscribe"})
    assert (await ws.receive_json())["success"]
    assert (await ws.receive_json())["event"]["layout"] is None
    await ws.send_json_auto_id({"type": f"{DOMAIN}/save", "layout": LAYOUT})
    await ws.receive_json()
    await ws.receive_json()

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    event = await _recv(ws)
    assert event["type"] == "event" and event["event"]["layout"] == N_LAYOUT
