"""Layout validation (pure, no Home Assistant imports)."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

from .const import GROUP_PREFIX, LAYOUT_VERSION, MAX_ENTRIES, MAX_GROUPS, MAX_NAME

GROUP_ID = re.compile(r"[a-z0-9]{1,16}")
PANEL = re.compile(r"[A-Za-z0-9_-]{1,100}")
ICON = re.compile(r"[a-z0-9_-]{1,20}:[a-z0-9_-]{1,64}")
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
        clean_groups[gid] = {"name": _name(group.get("name"), where), "icon": icon, "panels": clean_panels}

    if total > MAX_ENTRIES:
        raise LayoutError(f"at most {MAX_ENTRIES} entries")
    return {"version": LAYOUT_VERSION, "order": clean_order, "groups": clean_groups}


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
