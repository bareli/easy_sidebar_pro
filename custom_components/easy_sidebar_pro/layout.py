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
    ITEM_KEYS,
    LAYOUT_VERSION,
    LINK_KEYS,
    LINK_PREFIX,
    MAX_ALIASES,
    MAX_ENTRIES,
    MAX_GROUPS,
    MAX_LINKS,
    MAX_NAME,
    MAX_PINNED,
    MAX_URL,
    NAMED_COLORS,
)

GROUP_ID = re.compile(r"[a-z0-9]{1,16}")
PANEL = re.compile(r"[A-Za-z0-9_-]{1,100}")
ENTITY_ID = re.compile(r"[a-z0-9_]{1,64}\.[a-z0-9_]{1,255}")
# A link opens a page of this Home Assistant ("/config/automation") or a web address (http / https only).
URL_INTERNAL = re.compile(r"/(?![/\\])\S*")
URL_EXTERNAL = re.compile(r"https?://[^\s/\\?#]+\S*", re.IGNORECASE)
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
    if "Cs" in categories:
        raise LayoutError(f"{where}: name contains half of a character (lone surrogate)")
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


def _url(value: Any, where: str) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= MAX_URL:
        raise LayoutError(f"{where}: address must be 1-{MAX_URL} characters")
    if "\\" in value or any(unicodedata.category(c)[0] in "CZ" for c in value):
        raise LayoutError(f"{where}: address contains spaces or control characters")
    if not (URL_INTERNAL.fullmatch(value) or URL_EXTERNAL.fullmatch(value)):
        raise LayoutError(f"{where}: address must start with / or http(s)://")
    return value


def _entity(value: Any, where: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not ENTITY_ID.fullmatch(value):
        raise LayoutError(f"{where}: invalid entity id")
    return value


def _aliases(value: Any, where: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str) or len(value) > MAX_ALIASES:
        raise LayoutError(f"{where}: search words must be text of at most {MAX_ALIASES} characters")
    if any(unicodedata.category(c) in ("Cc", "Cs") or (unicodedata.category(c) == "Cf" and c not in _ALLOWED_FORMAT) for c in value):
        raise LayoutError(f"{where}: search words contain control characters")
    return " ".join(value.split())


def _links(data: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(data, dict):
        raise LayoutError("links must be an object")
    if len(data) > MAX_LINKS:
        raise LayoutError(f"at most {MAX_LINKS} links")
    out: dict[str, dict[str, Any]] = {}
    for lid, link in data.items():
        where = f"links[{lid!r}]"
        if not isinstance(lid, str) or not GROUP_ID.fullmatch(lid):
            raise LayoutError(f"{where}: invalid link id")
        if not isinstance(link, dict) or set(link) - set(LINK_KEYS):
            raise LayoutError(f"{where}: link must be an object with known keys")
        out[lid] = {
            "name": _name(link.get("name"), where),
            "icon": _icon(link.get("icon"), f"{where}.icon"),
            "url": _url(link.get("url"), f"{where}.url"),
            "new_tab": _flag(link.get("new_tab", False), f"{where}.new_tab"),
        }
    return out


def _items(data: Any, groups: dict[str, Any], links: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Per-entry extras (badge entity, show-only-when entity, search words); empty entries are dropped."""
    if not isinstance(data, dict):
        raise LayoutError("items must be an object")
    if len(data) > MAX_ENTRIES:
        raise LayoutError(f"at most {MAX_ENTRIES} items")
    out: dict[str, dict[str, Any]] = {}
    for key, item in data.items():
        where = f"items[{key!r}]"
        if not isinstance(key, str):
            raise LayoutError(f"{where}: invalid key")
        if key.startswith(GROUP_PREFIX):
            if key[len(GROUP_PREFIX):] not in groups:
                raise LayoutError(f"{where}: unknown group")
        elif key.startswith(LINK_PREFIX):
            if key[len(LINK_PREFIX):] not in links:
                raise LayoutError(f"{where}: unknown link")
        else:
            _panel(key, where)
        if not isinstance(item, dict) or set(item) - set(ITEM_KEYS):
            raise LayoutError(f"{where}: item must be an object with known keys")
        clean = {
            "badge": _entity(item.get("badge"), f"{where}.badge"),
            "show_when": _entity(item.get("show_when"), f"{where}.show_when"),
            "aliases": _aliases(item.get("aliases"), f"{where}.aliases"),
        }
        if clean["badge"] or clean["show_when"] or clean["aliases"]:
            out[key] = clean
    return out


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
    links = _links(data.get("links", {}))

    seen_panels: set[str] = set()
    seen_groups: set[str] = set()

    def member(value: Any, where: str) -> str:
        """A panel path or a link (`l:<id>`), placed at most once in the whole layout."""
        if isinstance(value, str) and value.startswith(LINK_PREFIX):
            if value[len(LINK_PREFIX):] not in links:
                raise LayoutError(f"{where}: unknown link {value!r}")
            entry = value
        else:
            entry = _panel(value, where)
        if entry in seen_panels:
            raise LayoutError(f"{where}: {entry!r} listed twice")
        seen_panels.add(entry)
        return entry

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
            member(entry, where)
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
            clean_panels.append(member(value, f"{where}.panels[{j}]"))
            total += 1
        clean_groups[gid] = {
            "name": _name(group.get("name"), where),
            "icon": icon,
            "color": _color(group.get("color"), f"{where}.color"),
            "icon_color": _color(group.get("icon_color"), f"{where}.icon_color"),
            "start_open": _flag(group.get("start_open", False), f"{where}.start_open"),
            "tabbed": _flag(group.get("tabbed", False), f"{where}.tabbed"),
            "panels": clean_panels,
        }

    clean_grid: list[str] = []
    for i, value in enumerate(grid):
        clean_grid.append(member(value, f"grid[{i}]"))
        total += 1

    if total > MAX_ENTRIES:
        raise LayoutError(f"at most {MAX_ENTRIES} entries")
    for lid in links:
        if f"{LINK_PREFIX}{lid}" not in seen_panels:
            raise LayoutError(f"links[{lid!r}]: link is not placed in the layout")
    items = _items(data.get("items", {}), clean_groups, links)
    return {
        "version": LAYOUT_VERSION,
        "order": clean_order,
        "groups": clean_groups,
        "grid": clean_grid,
        "settings": settings,
        "links": links,
        "items": items,
    }


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
