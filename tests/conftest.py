"""Shared fixtures for Easy Sidebar Pro tests."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.easy_sidebar_pro.const import DOMAIN


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture(autouse=True)
def no_static_paths():
    """Static file serving needs the real http server; not under test."""
    with patch("homeassistant.components.http.HomeAssistantHTTP.async_register_static_paths", new=AsyncMock()):
        yield


@pytest.fixture
async def entry(hass: HomeAssistant) -> MockConfigEntry:
    assert await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, title="Easy Sidebar Pro", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry
