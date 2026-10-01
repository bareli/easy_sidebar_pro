"""Websocket API for the sidebar module."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, SIGNAL_UPDATED
from .layout import LayoutError, validate_collapsed, validate_layout
from .store import LayoutStore

DATA_STORE = f"{DOMAIN}_store"


@callback
def async_register(hass: HomeAssistant) -> None:
    for handler in (ws_subscribe, ws_save, ws_collapsed, ws_reset, ws_default_set):
        websocket_api.async_register_command(hass, handler)


def _store(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> LayoutStore | None:
    store: LayoutStore | None = hass.data.get(DATA_STORE)
    if store is None:
        connection.send_error(msg["id"], "not_loaded", "Easy Sidebar Pro is not set up")
    return store


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if _store(hass, connection, msg) is None:
        return
    user = connection.user
    msg_id = msg["id"]

    @callback
    def send(user_id: str | None = None) -> None:
        # Resolve the store per event: a config-entry reload replaces it while subscriptions stay open.
        if (store := hass.data.get(DATA_STORE)) is None:
            return
        if user_id is None or user_id == user.id:
            connection.send_message(websocket_api.event_message(msg_id, store.view(user.id, user.is_admin)))

    connection.subscriptions[msg_id] = async_dispatcher_connect(hass, SIGNAL_UPDATED, send)
    connection.send_result(msg_id)
    send()


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/save", vol.Required("layout"): dict})
@callback
def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    try:
        layout = validate_layout(msg["layout"])
    except LayoutError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    store.set_layout(connection.user.id, layout)
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/collapsed", vol.Required("collapsed"): list})
@callback
def ws_collapsed(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    try:
        collapsed = validate_collapsed(msg["collapsed"])
    except LayoutError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    store.set_collapsed(connection.user.id, collapsed)
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/reset"})
@callback
def ws_reset(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    store.set_layout(connection.user.id, None)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/default/set", vol.Required("layout"): vol.Any(dict, None)}
)
@websocket_api.require_admin
@callback
def ws_default_set(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    layout = msg["layout"]
    if layout is not None:
        try:
            layout = validate_layout(layout)
        except LayoutError as err:
            connection.send_error(msg["id"], "invalid_format", str(err))
            return
    store.set_default(layout)
    connection.send_result(msg["id"])
