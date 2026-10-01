"""Easy Sidebar Pro: collapsible groups in the Home Assistant sidebar, edited in place."""
from __future__ import annotations

import json
import os

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.typing import ConfigType

from . import websocket
from .const import DOMAIN, MODULE_FILE, SIGNAL_UPDATED, STATIC_URL
from .store import LayoutStore
from .websocket import DATA_STORE

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

STATIC_REGISTERED_KEY = f"{DOMAIN}_static_registered"
DATA_MODULE_URL = f"{DOMAIN}_module_url"


def _read_version_sync() -> str:
    try:
        with open(os.path.join(os.path.dirname(__file__), "manifest.json"), encoding="utf-8") as f:
            return json.load(f).get("version", "0")
    except (OSError, ValueError):
        return "0"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    websocket.async_register(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = LayoutStore(hass)
    await store.async_load()
    hass.data[DATA_STORE] = store
    # Subscriptions opened before a reload must get the new store's data straight away.
    async_dispatcher_send(hass, SIGNAL_UPDATED, None)

    if not hass.data.get(STATIC_REGISTERED_KEY):
        hass.data[STATIC_REGISTERED_KEY] = True
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, os.path.join(os.path.dirname(__file__), "www"), False)]
        )
    version = await hass.async_add_executor_job(_read_version_sync)
    url = f"{STATIC_URL}/{MODULE_FILE}?v={version}"
    add_extra_js_url(hass, url)
    hass.data[DATA_MODULE_URL] = url
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if (url := hass.data.pop(DATA_MODULE_URL, None)) is not None:
        remove_extra_js_url(hass, url)
    if (store := hass.data.pop(DATA_STORE, None)) is not None:
        await store.async_flush()
    return True
