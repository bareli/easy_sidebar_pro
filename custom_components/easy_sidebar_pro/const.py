"""Constants for Easy Sidebar Pro."""
from __future__ import annotations

DOMAIN = "easy_sidebar_pro"

STATIC_URL = "/easy_sidebar_pro_static"
MODULE_FILE = "easy-sidebar-pro.js"

STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1

SIGNAL_UPDATED = f"{DOMAIN}_updated"

LAYOUT_VERSION = 1
MAX_GROUPS = 50
MAX_ENTRIES = 500
MAX_NAME = 50
GROUP_PREFIX = "g:"
LINK_PREFIX = "l:"
ACTION_PREFIX = "a:"
MAX_PINNED = 20
MAX_LINKS = 50
MAX_ACTIONS = 50
MAX_URL = 2000
MAX_ALIASES = 100

# Named colours resolve to Home Assistant's theme variables (`var(--<name>-color)`), so a theme can
# redefine them for light and dark mode. Custom colours are `#rrggbb`.
NAMED_COLORS = (
    "primary", "accent", "red", "pink", "purple", "indigo", "blue", "cyan",
    "teal", "green", "lime", "amber", "orange", "brown", "grey",
)
HEADER_STYLES = ("plain", "tinted", "line", "pill")
DIVIDER_STYLES = ("line", "none")
# Keys of a stored group, in output order (layout.js GROUP_KEYS is the same list).
GROUP_KEYS = ("name", "icon", "color", "icon_color", "start_open", "tabbed", "panels")
# Keys of a stored link and of an entry's extras (layout.js LINK_KEYS / ITEM_KEYS).
LINK_KEYS = ("name", "icon", "url", "new_tab")
ITEM_KEYS = ("badge", "show_when", "aliases", "color", "badge_color", "more_badges", "hold", "double_tap", "state_rules", "label")
# Extra badges beside an entry's own (layout.js MAX_MORE_BADGES); keys of one of them.
MAX_MORE_BADGES = 3
MORE_BADGE_KEYS = ("entity", "color")
# v0.8: action rows (`actions: {id: {name, icon, tap}}`, path "a:<id>"), gestures, state rules (layout.js has the same lists).
ACTION_KEYS = ("name", "icon", "tap")
ACTION_FIELDS = ("type", "entity", "service", "data", "path")
ACTION_TYPES = ("toggle", "more-info", "call-service", "navigate")
TAP_TYPES = ("toggle", "more-info", "call-service")
MAX_ACTION_DATA = 1000
STATE_RULE_KEYS = ("entity", "when", "icon", "color")
STATE_RULE_WHEN = ("active", "inactive")
MAX_STATE_RULES = 3
DEFAULT_SETTINGS = {
    "start_collapsed": False,
    "accordion": False,
    "toggle_all": False,
    "hide_count": False,
    "search": False,
    "header": "plain",
    "divider": "line",
}
