"""Layout validation (pure, no Home Assistant imports)."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

from .const import (
    DEFAULT_SETTINGS,
    DIVIDER_STYLES,
    GROUP_PREFIX,
    HEADER_STYLES,
    LAYOUT_VERSION,
    MAX_ENTRIES,
    MAX_GROUPS,
    MAX_NAME,
    MAX_PINNED,
    NAMED_COLORS,
)

GROUP_ID = re.compile(r"[a-z0-9]{1,16}")
PANEL = re.compile(r"[A-Za-z0-9_-]{1,100}")
ICON = re.compile(r"[a-z0-9_-]{1,20}:[a-z0-9_-]{1,64}")
HEX_COLOR = re.compile(r"#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}")
# `prefix:name` icon sets stay open (mdi, hass, custom sets), but URI schemes are never icon sets.
ICON_BLOCKED_PREFIXES = frozenset(
    {"javascript", "data", "vbscript", "http", "https", "file", "blob", "about", "ftp", "ws", "wss", "mailto", "tel"}
)
# Format characters that real text needs: joiners for emoji sequences and Persian/Arabic shaping.
_ALLOWED_FORMAT = frozenset("\u200c\u200d")


class LayoutError(ValueError):
    """Invalid layout; the message says what and where."""


def _name(value: Any, where: str) -> str:
    if not isinstance(value, str):
        raise LayoutError(f"{where}: name must be text")
    name = value.strip()
    if not 1 <= len(name) <= MAX_NAME:
        raise LayoutError(f"{where}: name must be 1-{MAX_NAME} characters")
    categories = [unicodedata.category(c) for c in name]
    if "Cc" in categories:
        raise LayoutError(f"{where}: name contains control characters")
    if any(cat == "Cf" and c not in _ALLOWED_FORMAT for c, cat in zip(name, categories)):
        raise LayoutError(f"{where}: name contains invisible formatting characters")
    if not any(cat[0] not in "CZ" for cat in categories):
        raise LayoutError(f"{where}: name must contain a visible character")
    return name


def _icon(value: Any, where: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not ICON.fullmatch(value) or value.split(":", 1)[0] in ICON_BLOCKED_PREFIXES:
        raise LayoutError(f"{where}: invalid icon")
    return value


def _color(value: Any, where: str) -> str | None:
    """None, a named theme colour, or `#rrggbb` (`#rgb` is expanded; output is lowercase)."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise LayoutError(f"{where}: invalid colour")
    if value in NAMED_COLORS:
        return value
    if not HEX_COLOR.fullmatch(value):
        raise LayoutError(f"{where}: invalid colour")
    value = value.lower()
    if len(value) == 4:
        value = "#" + "".join(c * 2 for c in value[1:])
    return value


def _flag(value: Any, where: str) -> bool:
    if not isinstance(value, bool):
        raise LayoutError(f"{where}: must be true or false")
    return value


def validate_settings(data: Any) -> dict[str, Any]:
    """Display and collapse settings; missing keys take their defaults, unknown keys are refused."""
    if data is None:
        return dict(DEFAULT_SETTINGS)
    if not isinstance(data, dict) or len(data) > len(DEFAULT_SETTINGS):
        raise LayoutError("settings must be an object with known keys")
    out = dict(DEFAULT_SETTINGS)
    for key, value in data.items():
        if key not in DEFAULT_SETTINGS:
            raise LayoutError(f"settings: unknown key {key!r}")
        if key == "header":
            if value not in HEADER_STYLES:
                raise LayoutError("settings.header: invalid value")
        elif key == "divider":
            if value not in DIVIDER_STYLES:
                raise LayoutError("settings.divider: invalid value")
        elif not isinstance(value, bool):
            raise LayoutError(f"settings.{key}: must be true or false")
        out[key] = value
    return out


def _panel(value: Any, where: str) -> str:
    if not isinstance(value, str) or not PANEL.fullmatch(value):
        raise LayoutError(f"{where}: invalid panel {value!r}")
    return value


def validate_layout(data: Any) -> dict[str, Any]:
    """Return a clean copy of a layout, or raise LayoutError."""
    if not isinstance(data, dict):
        raise LayoutError("layout must be an object")
    version = data.get("version")
    if isinstance(version, bool) or version != LAYOUT_VERSION:
        raise LayoutError(f"unsupported layout version {data.get('version')!r}")
    order = data.get("order")
    groups = data.get("groups", {})
    if not isinstance(order, list):
        raise LayoutError("order must be a list")
    if not isinstance(groups, dict):
        raise LayoutError("groups must be an object")
    if len(groups) > MAX_GROUPS:
        raise LayoutError(f"at most {MAX_GROUPS} groups")
    if len(order) > MAX_ENTRIES:
        raise LayoutError(f"at most {MAX_ENTRIES} entries")
    grid = data.get("grid", [])
    if not isinstance(grid, list):
        raise LayoutError("grid must be a list")
    if len(grid) > MAX_PINNED:
        raise LayoutError(f"at most {MAX_PINNED} pinned panels")
    settings = validate_settings(data.get("settings"))

    seen_panels: set[str] = set()
    seen_groups: set[str] = set()
    total = 0
    clean_order: list[str] = []
    for i, entry in enumerate(order):
        where = f"order[{i}]"
        if isinstance(entry, str) and entry.startswith(GROUP_PREFIX):
            gid = entry[len(GROUP_PREFIX):]
            if gid not in groups:
                raise LayoutError(f"{where}: unknown group {gid!r}")
            if gid in seen_groups:
                raise LayoutError(f"{where}: group {gid!r} listed twice")
            seen_groups.add(gid)
        else:
            panel = _panel(entry, where)
            if panel in seen_panels:
                raise LayoutError(f"{where}: panel {panel!r} listed twice")
            seen_panels.add(panel)
        clean_order.append(entry)
        total += 1

    clean_groups: dict[str, dict[str, Any]] = {}
    for gid, group in groups.items():
        where = f"groups[{gid!r}]"
        if not isinstance(gid, str) or not GROUP_ID.fullmatch(gid):
            raise LayoutError(f"{where}: invalid group id")
        if gid not in seen_groups:
            raise LayoutError(f"{where}: group is not in order")
        if not isinstance(group, dict):
            raise LayoutError(f"{where}: group must be an object")
        icon = _icon(group.get("icon"), where)
        panels = group.get("panels", [])
        if not isinstance(panels, list):
            raise LayoutError(f"{where}: panels must be a list")
        if total + len(panels) > MAX_ENTRIES:
            raise LayoutError(f"at most {MAX_ENTRIES} entries")
        clean_panels = []
        for j, value in enumerate(panels):
            panel = _panel(value, f"{where}.panels[{j}]")
            if panel in seen_panels:
                raise LayoutError(f"{where}.panels[{j}]: panel {panel!r} listed twice")
            seen_panels.add(panel)
            clean_panels.append(panel)
            total += 1
        clean_groups[gid] = {
            "name": _name(group.get("name"), where),
            "icon": icon,
            "color": _color(group.get("color"), f"{where}.color"),
            "icon_color": _color(group.get("icon_color"), f"{where}.icon_color"),
            "start_open": _flag(group.get("start_open", False), f"{where}.start_open"),
            "panels": clean_panels,
        }

    clean_grid: list[str] = []
    for i, value in enumerate(grid):
        panel = _panel(value, f"grid[{i}]")
        if panel in seen_panels:
            raise LayoutError(f"grid[{i}]: panel {panel!r} listed twice")
        seen_panels.add(panel)
        clean_grid.append(panel)
        total += 1

    if total > MAX_ENTRIES:
        raise LayoutError(f"at most {MAX_ENTRIES} entries")
    return {"version": LAYOUT_VERSION, "order": clean_order, "groups": clean_groups, "grid": clean_grid, "settings": settings}


def validate_collapsed(data: Any) -> list[str]:
    """Return a clean list of collapsed group ids, or raise LayoutError."""
    if not isinstance(data, list) or len(data) > MAX_GROUPS:
        raise LayoutError(f"collapsed must be a list of at most {MAX_GROUPS} group ids")
    out: list[str] = []
    for value in data:
        if not isinstance(value, str) or not GROUP_ID.fullmatch(value):
            raise LayoutError(f"invalid group id {value!r}")
        if value not in out:
            out.append(value)
    return out
