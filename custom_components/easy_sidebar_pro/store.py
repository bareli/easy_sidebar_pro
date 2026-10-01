"""Persistent layouts: the admin default and one record per user."""
from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import SIGNAL_UPDATED, STORAGE_KEY, STORAGE_VERSION
from .layout import LayoutError, validate_collapsed, validate_layout

SAVE_DELAY = 1


class LayoutStore:
    """Default layout + per-user layout and collapsed groups."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.default: dict[str, Any] | None = None
        self.users: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.default = _safe_layout(data.get("default"))
        users = data.get("users") if isinstance(data.get("users"), dict) else {}
        for user_id, record in users.items():
            if not isinstance(record, dict):
                continue
            try:
                collapsed = validate_collapsed(record.get("collapsed", []))
            except LayoutError:
                collapsed = []
            self.users[user_id] = {"layout": _safe_layout(record.get("layout")), "collapsed": collapsed}

    @callback
    def view(self, user_id: str, is_admin: bool) -> dict[str, Any]:
        record = self.users.get(user_id, {})
        own = record.get("layout")
        return {
            "layout": own or self.default,
            "default": self.default,
            "own": own is not None,
            "collapsed": record.get("collapsed", []),
            "is_admin": is_admin,
        }

    def _record(self, user_id: str) -> dict[str, Any]:
        return self.users.setdefault(user_id, {"layout": None, "collapsed": []})

    @callback
    def set_layout(self, user_id: str, layout: dict[str, Any] | None) -> None:
        self._record(user_id)["layout"] = layout
        self._changed(user_id)

    @callback
    def set_collapsed(self, user_id: str, collapsed: list[str]) -> None:
        self._record(user_id)["collapsed"] = collapsed
        self._changed(user_id)

    @callback
    def set_default(self, layout: dict[str, Any] | None) -> None:
        self.default = layout
        self._changed(None)

    @callback
    def _changed(self, user_id: str | None) -> None:
        self._store.async_delay_save(self._data, SAVE_DELAY)
        async_dispatcher_send(self.hass, SIGNAL_UPDATED, user_id)

    @callback
    def _data(self) -> dict[str, Any]:
        return {"default": self.default, "users": self.users}

    async def async_flush(self) -> None:
        await self._store.async_save(self._data())


def _safe_layout(data: Any) -> dict[str, Any] | None:
    if data is None:
        return None
    try:
        return validate_layout(data)
    except LayoutError:
        return None
