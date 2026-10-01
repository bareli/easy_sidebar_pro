"""Placeholder brand: a sidebar with a folded group (rounded square, Home Assistant blue)."""
from PIL import Image, ImageDraw

OUT = r"D:/Code/home assistant extensions/easy_sidebar_pro/custom_components/easy_sidebar_pro/brand"


def icon(size: int) -> Image.Image:
    s = size / 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([8 * s, 8 * s, 248 * s, 248 * s], radius=48 * s, fill=(3, 169, 244, 255))
    white = (255, 255, 255, 255)
    soft = (129, 212, 250, 255)
    # top-level rows
    for y in (52, 92):
        d.rounded_rectangle([48 * s, (y - 8) * s, 72 * s, (y + 8) * s], radius=4 * s, fill=white)
        d.rounded_rectangle([84 * s, (y - 6) * s, 200 * s, (y + 6) * s], radius=6 * s, fill=white)
    # group header: folder + chevron
    d.rounded_rectangle([44 * s, 124 * s, 212 * s, 160 * s], radius=10 * s, fill=(2, 119, 189, 255))
    d.polygon([(52 * s, 132 * s), (64 * s, 132 * s), (68 * s, 136 * s), (80 * s, 136 * s), (80 * s, 154 * s), (52 * s, 154 * s)], fill=white)
    d.rounded_rectangle([92 * s, 137 * s, 170 * s, 147 * s], radius=5 * s, fill=white)
    d.line([(184 * s, 136 * s), (192 * s, 146 * s), (200 * s, 136 * s)], fill=white, width=max(2, int(5 * s)))
    # grouped rows, indented with a guide line
    d.rounded_rectangle([60 * s, 170 * s, 65 * s, 226 * s], radius=2 * s, fill=soft)
    for y in (184, 214):
        d.rounded_rectangle([78 * s, (y - 7) * s, 98 * s, (y + 7) * s], radius=4 * s, fill=white)
        d.rounded_rectangle([108 * s, (y - 5) * s, 196 * s, (y + 5) * s], radius=5 * s, fill=white)
    return img


import os

os.makedirs(OUT, exist_ok=True)
for name, size in (("icon.png", 256), ("icon@2x.png", 512), ("logo.png", 256), ("logo@2x.png", 512)):
    icon(size).save(f"{OUT}/{name}")
print("ok")
