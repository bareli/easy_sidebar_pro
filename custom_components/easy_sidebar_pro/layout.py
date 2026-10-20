"""Layout validation (pure, no Home Assistant imports)."""
from __future__ import annotations

import json
import re
import unicodedata
from typing import Any

from .const import (
    ACTION_FIELDS,
    ACTION_KEYS,
    ACTION_PREFIX,
    ACTION_TYPES,
    DEFAULT_SETTINGS,
    DIVIDER_STYLES,
    GROUP_PREFIX,
    HEADER_STYLES,
    ITEM_KEYS,
    LAYOUT_VERSION,
    LINK_KEYS,
    LINK_PREFIX,
    MAX_ACTION_DATA,
    MAX_ACTIONS,
    MAX_ALIASES,
    MAX_ENTRIES,
    MAX_MORE_BADGES,
    MORE_BADGE_KEYS,
    MAX_GROUPS,
    MAX_LINKS,
    MAX_NAME,
    MAX_PINNED,
    MAX_STATE_RULES,
    MAX_URL,
    NAMED_COLORS,
    STATE_RULE_KEYS,
    STATE_RULE_WHEN,
    TAP_TYPES,
)

GROUP_ID = re.compile(r"[a-z0-9]{1,16}")
PANEL = re.compile(r"[A-Za-z0-9_-]{1,100}")
ENTITY_ID = re.compile(r"[a-z0-9_]{1,64}\.[a-z0-9_]{1,255}")
SERVICE = re.compile(r"[a-z0-9_]{1,64}\.[a-z0-9_]{1,64}")
# A link opens a page of this Home Assistant ("/config/automation") or a web address (http / https only).
URL_INTERNAL = re.compile(r"/(?![/\\])\S*")
# The scheme is matched in ASCII only: re.IGNORECASE folds "ſ" (U+017F) to "s" and "K" (U+212A) to "k" (SEC-003).
URL_EXTERNAL = re.compile(r"[hH][tT][tT][pP][sS]?://[^\s/\\?#]+\S*")
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


def _more_badges(value: Any, where: str) -> list[dict[str, Any]]:
    """Up to MAX_MORE_BADGES extra badges, each an entity and an optional colour."""
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > MAX_MORE_BADGES:
        raise LayoutError(f"{where}: at most {MAX_MORE_BADGES} extra badges")
    out = []
    for i, badge in enumerate(value):
        at = f"{where}[{i}]"
        if not isinstance(badge, dict) or set(badge) - set(MORE_BADGE_KEYS):
            raise LayoutError(f"{at}: badge must be an object with known keys")
        entity = _entity(badge.get("entity"), f"{at}.entity")
        if entity is None:
            raise LayoutError(f"{at}.entity: required")
        out.append({"entity": entity, "color": _color(badge.get("color"), f"{at}.color")})
    return out


def _label(value: Any, where: str) -> str | None:
    """A panel's own name in the sidebar: empty means none."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise LayoutError(f"{where}: label must be text")
    return _name(value, where) if value.strip() else None


def _action(value: Any, where: str, *, tap: bool = False) -> dict[str, Any] | None:
    """What a tap, hold or double tap does; None for nothing. An action row's tap cannot navigate."""
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) - set(ACTION_FIELDS):
        raise LayoutError(f"{where}: action must be an object with known keys")
    kind = value.get("type")
    if kind not in (TAP_TYPES if tap else ACTION_TYPES):
        raise LayoutError(f"{where}.type: invalid action type")
    out: dict[str, Any] = {"type": kind}
    entity = _entity(value.get("entity"), f"{where}.entity")
    if kind in ("toggle", "more-info"):
        if entity is None:
            raise LayoutError(f"{where}.entity: required")
        out["entity"] = entity
    elif kind == "call-service":
        service = value.get("service")
        if not isinstance(service, str) or not SERVICE.fullmatch(service):
            raise LayoutError(f"{where}.service: use domain.service")
        out["service"] = service
        if entity is not None:
            out["entity"] = entity
        data = value.get("data")
        if data is not None:
            if not isinstance(data, dict):
                raise LayoutError(f"{where}.data: must be an object")
            try:
                size = len(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
            except (TypeError, ValueError) as err:
                raise LayoutError(f"{where}.data: must be JSON") from err
            if size > MAX_ACTION_DATA:
                raise LayoutError(f"{where}.data: at most {MAX_ACTION_DATA} characters")
            if data:
                out["data"] = data
    else:
        path = value.get("path")
        if not isinstance(path, str) or not isinstance(_url(path, f"{where}.path"), str) or not URL_INTERNAL.fullmatch(path):
            raise LayoutError(f"{where}.path: must be a page of Home Assistant")
        out["path"] = path
    return out


def _state_rules(value: Any, where: str) -> list[dict[str, Any]]:
    """Up to MAX_STATE_RULES rules: while the entity is active / inactive, the icon and / or icon colour change."""
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > MAX_STATE_RULES:
        raise LayoutError(f"{where}: at most {MAX_STATE_RULES} rules")
    out = []
    for i, rule in enumerate(value):
        at = f"{where}[{i}]"
        if not isinstance(rule, dict) or set(rule) - set(STATE_RULE_KEYS):
            raise LayoutError(f"{at}: rule must be an object with known keys")
        entity = _entity(rule.get("entity"), f"{at}.entity")
        if entity is None:
            raise LayoutError(f"{at}.entity: required")
        if rule.get("when") not in STATE_RULE_WHEN:
            raise LayoutError(f"{at}.when: must be active or inactive")
        icon = _icon(rule.get("icon"), f"{at}.icon")
        color = _color(rule.get("color"), f"{at}.color")
        if icon is None and color is None:
            raise LayoutError(f"{at}: needs an icon or a colour")
        out.append({"entity": entity, "when": rule["when"], "icon": icon, "color": color})
    return out


def _actions(data: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(data, dict):
        raise LayoutError("actions must be an object")
    if len(data) > MAX_ACTIONS:
        raise LayoutError(f"at most {MAX_ACTIONS} actions")
    out: dict[str, dict[str, Any]] = {}
    for aid, action in data.items():
        where = f"actions[{aid!r}]"
        if not isinstance(aid, str) or not GROUP_ID.fullmatch(aid):
            raise LayoutError(f"{where}: invalid action id")
        if not isinstance(action, dict) or set(action) - set(ACTION_KEYS):
            raise LayoutError(f"{where}: action row must be an object with known keys")
        tap = _action(action.get("tap"), f"{where}.tap", tap=True)
        if tap is None:
            raise LayoutError(f"{where}.tap: required")
        out[aid] = {"name": _name(action.get("name"), where), "icon": _icon(action.get("icon"), f"{where}.icon"), "tap": tap}
    return out


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


def _items(data: Any, groups: dict[str, Any], links: dict[str, Any], actions: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Per-entry extras (badge entity, show-only-when entity, search words, icon colour); empty entries are dropped.

    The icon colour is kept only when set, and only on panels and links: a group has its own colours. The badge colour
    is kept only with a badge entity; extra badges (a list of entity + colour) are for panels and links.
    """
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
        elif key.startswith(ACTION_PREFIX):
            if key[len(ACTION_PREFIX):] not in actions:
                raise LayoutError(f"{where}: unknown action")
        else:
            _panel(key, where)
        if not isinstance(item, dict) or set(item) - set(ITEM_KEYS):
            raise LayoutError(f"{where}: item must be an object with known keys")
        clean = {
            "badge": _entity(item.get("badge"), f"{where}.badge"),
            "show_when": _entity(item.get("show_when"), f"{where}.show_when"),
            "aliases": _aliases(item.get("aliases"), f"{where}.aliases"),
        }
        color = _color(item.get("color"), f"{where}.color")
        if color is not None:
            if key.startswith(GROUP_PREFIX):
                raise LayoutError(f"{where}.color: a group's colours are set on the group")
            clean["color"] = color
        badge_color = _color(item.get("badge_color"), f"{where}.badge_color")
        if badge_color is not None and clean["badge"]:
            clean["badge_color"] = badge_color
        more = _more_badges(item.get("more_badges"), f"{where}.more_badges")
        if more:
            if key.startswith(GROUP_PREFIX):
                raise LayoutError(f"{where}.more_badges: only panels and links take extra badges")
            clean["more_badges"] = more
        is_group = key.startswith(GROUP_PREFIX)
        # v0.8: gestures and state rules are for rows (not groups); a label renames a Home Assistant panel only.
        extra = {
            "hold": _action(item.get("hold"), f"{where}.hold"),
            "double_tap": _action(item.get("double_tap"), f"{where}.double_tap"),
            "state_rules": _state_rules(item.get("state_rules"), f"{where}.state_rules"),
            "label": _label(item.get("label"), f"{where}.label"),
        }
        for field, value in extra.items():
            if not value:
                continue
            if is_group:
                raise LayoutError(f"{where}.{field}: not for groups")
            if field == "label" and key.startswith((LINK_PREFIX, ACTION_PREFIX)):
                raise LayoutError(f"{where}.label: only Home Assistant panels take a label")
            clean[field] = value
        if clean["badge"] or clean["show_when"] or clean["aliases"] or color or more or any(extra.values()):
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
    actions = _actions(data.get("actions", {}))

    seen_panels: set[str] = set()
    seen_groups: set[str] = set()

    def member(value: Any, where: str) -> str:
        """A panel path or a link (`l:<id>`), placed at most once in the whole layout."""
        if isinstance(value, str) and value.startswith(LINK_PREFIX):
            if value[len(LINK_PREFIX):] not in links:
                raise LayoutError(f"{where}: unknown link {value!r}")
            entry = value
        elif isinstance(value, str) and value.startswith(ACTION_PREFIX):
            if value[len(ACTION_PREFIX):] not in actions:
                raise LayoutError(f"{where}: unknown action {value!r}")
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
        tabbed = _flag(group.get("tabbed", False), f"{where}.tabbed")
        if tabbed and any(p.startswith(ACTION_PREFIX) for p in clean_panels):
            raise LayoutError(f"{where}: an action row cannot be a tab")
        clean_groups[gid] = {
            "name": _name(group.get("name"), where),
            "icon": icon,
            "color": _color(group.get("color"), f"{where}.color"),
            "icon_color": _color(group.get("icon_color"), f"{where}.icon_color"),
            "start_open": _flag(group.get("start_open", False), f"{where}.start_open"),
            "tabbed": tabbed,
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
    for aid in actions:
        if f"{ACTION_PREFIX}{aid}" not in seen_panels:
            raise LayoutError(f"actions[{aid!r}]: action is not placed in the layout")
    items = _items(data.get("items", {}), clean_groups, links, actions)
    out = {
        "version": LAYOUT_VERSION,
        "order": clean_order,
        "groups": clean_groups,
        "grid": clean_grid,
        "settings": settings,
        "links": links,
        "items": items,
    }
    # v0.8: only when there are action rows, so a v0.7 layout reads back unchanged.
    if actions:
        out["actions"] = actions
    return out


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
