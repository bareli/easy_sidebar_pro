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
MAX_PINNED = 20

# Named colours resolve to Home Assistant's theme variables (`var(--<name>-color)`), so a theme can
# redefine them for light and dark mode. Custom colours are `#rrggbb`.
NAMED_COLORS = (
    "primary", "accent", "red", "pink", "purple", "indigo", "blue", "cyan",
    "teal", "green", "lime", "amber", "orange", "brown", "grey",
)
HEADER_STYLES = ("plain", "tinted", "line")
DIVIDER_STYLES = ("line", "none")
DEFAULT_SETTINGS = {
    "start_collapsed": False,
    "accordion": False,
    "toggle_all": False,
    "header": "plain",
    "divider": "line",
}
