"""Server-side layout validation."""
from __future__ import annotations

import pytest

from custom_components.easy_sidebar_pro.layout import LayoutError, validate_collapsed, validate_layout

GOOD = {
    "version": 1,
    "order": ["lovelace", "g:home", "map"],
    "groups": {"home": {"name": " בית ", "icon": "mdi:home", "panels": ["calendar", "todo"]}},
}


def test_valid_layout_is_cleaned():
    out = validate_layout(GOOD)
    assert out["groups"]["home"]["name"] == "בית"
    assert out["order"] == GOOD["order"]


def test_icon_optional():
    data = {"version": 1, "order": ["g:a"], "groups": {"a": {"name": "A", "panels": []}}}
    assert validate_layout(data)["groups"]["a"]["icon"] is None


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda d: d.update(version=2), "version"),
        (lambda d: d.update(order="x"), "order must be a list"),
        (lambda d: d["order"].append("g:nope"), "unknown group"),
        (lambda d: d["order"].append("g:home"), "listed twice"),
        (lambda d: d["order"].append("map"), "listed twice"),
        (lambda d: d["groups"]["home"]["panels"].append("map"), "listed twice"),
        (lambda d: d["order"].append("../etc"), "invalid panel"),
        (lambda d: d["groups"]["home"].update(name=""), "1-50"),
        (lambda d: d["groups"]["home"].update(name="x" * 51), "1-50"),
        (lambda d: d["groups"]["home"].update(name="a\x07b"), "control"),
        (lambda d: d["groups"]["home"].update(icon="<svg>"), "icon"),
        (lambda d: d["groups"].update(extra={"name": "E", "panels": []}), "not in order"),
        (lambda d: d.update(order=["g:BAD"], groups={"BAD": {"name": "x", "panels": []}}), "invalid group id"),
    ],
)
def test_invalid_layouts(mutate, message):
    import copy

    data = copy.deepcopy(GOOD)
    mutate(data)
    with pytest.raises(LayoutError, match=message):
        validate_layout(data)


def test_limits():
    groups = {f"g{i}": {"name": "x", "panels": []} for i in range(51)}
    with pytest.raises(LayoutError, match="at most 50 groups"):
        validate_layout({"version": 1, "order": [f"g:{k}" for k in groups], "groups": groups})
    with pytest.raises(LayoutError, match="at most 500 entries"):
        validate_layout({"version": 1, "order": [f"p{i}" for i in range(501)], "groups": {}})


def test_collapsed():
    assert validate_collapsed(["a", "a", "b"]) == ["a", "b"]
    with pytest.raises(LayoutError):
        validate_collapsed(["A!"])
    with pytest.raises(LayoutError):
        validate_collapsed("a")
