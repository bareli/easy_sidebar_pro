"""v0.4: tabbed groups."""
from __future__ import annotations

import copy

import pytest

from custom_components.easy_sidebar_pro.const import GROUP_KEYS
from custom_components.easy_sidebar_pro.layout import LayoutError, validate_layout

from .test_v030 import FULL


def test_tabbed_validated_and_defaulted():
    data = copy.deepcopy(FULL)
    data["groups"]["home"]["tabbed"] = True
    assert validate_layout(data)["groups"]["home"]["tabbed"] is True
    del data["groups"]["home"]["tabbed"]
    assert validate_layout(data)["groups"]["home"]["tabbed"] is False


@pytest.mark.parametrize("value", [1, 0, "true", None, [], {"a": 1}])
def test_tabbed_must_be_boolean(value):
    data = copy.deepcopy(FULL)
    data["groups"]["home"]["tabbed"] = value
    with pytest.raises(LayoutError, match=r"tabbed: must be true or false"):
        validate_layout(data)


def test_tabbed_in_group_keys_before_panels():
    assert GROUP_KEYS.index("tabbed") == GROUP_KEYS.index("panels") - 1
    assert list(validate_layout(FULL)["groups"]["home"]) == list(GROUP_KEYS)


def test_search_setting_validated_and_defaulted():
    from custom_components.easy_sidebar_pro.layout import validate_settings

    assert validate_settings(None)["search"] is False
    assert validate_settings({"search": True})["search"] is True
    with pytest.raises(LayoutError, match=r"settings\.search: must be true or false"):
        validate_settings({"search": "yes"})
