"""Config flow: one confirm step, single instance."""
from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class EasySidebarProConfigFlow(ConfigFlow, domain=DOMAIN):
    """Add Easy Sidebar Pro."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Easy Sidebar Pro", data={})
        return self.async_show_form(step_id="user")
