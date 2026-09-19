# -*- coding: utf-8 -*-
"""Generate PWA icons: orange gradient rounded square with a white open book."""
import os
from PIL import Image, ImageDraw

S = 1024  # draw big, downscale for smoothness
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

TOP = (240, 133, 79)
BOT = (216, 80, 30)
WHITE = (255, 255, 255, 255)
LINE = (243, 156, 110, 255)  # text lines on pages
SPINE = (205, 75, 22, 255)


def gradient_canvas(radius):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(S):
        t = y / (S - 1)
        c = tuple(int(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (S, y)], fill=c)
    if radius > 0:
        mask = Image.new("L", (S, S), 0)
        dm = ImageDraw.Draw(mask)
        dm.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
        img.putalpha(mask)
    return img


def draw_book(d, scale=1.0):
    cx, cy = S / 2, S / 2 + 14 * scale
    w, h = 300 * scale, 250 * scale
    drop = 26 * scale   # page tilt
    thick = 30 * scale  # bottom cover offset
    lt = (cx - w / 2, cy - h / 2 + drop)      # left top outer
    ct = (cx, cy - h / 2)                     # center top (spine)
    cb = (cx, cy + h / 2)                     # center bottom
    lb = (cx - w / 2, cy + h / 2 + drop - thick)  # left bottom outer
    # left page
    d.polygon([lt, ct, cb, lb], fill=WHITE)
    # right page (mirror)
    rt = (cx + w / 2, cy - h / 2 + drop)
    rb = (cx + w / 2, cy + h / 2 + drop - thick)
    d.polygon([rt, ct, cb, rb], fill=WHITE)
    # spine shadow
    d.line([ct, cb], fill=SPINE, width=int(10 * scale))
    # text lines on each page
    for i in range(3):
        yy = cy - h / 2 + (60 + i * 46) * scale
        inset = (34 + i * 12) * scale
        d.line([(lt[0] + inset, yy), (ct[0] - 24 * scale, yy - 8 * scale)], fill=LINE, width=int(16 * scale))
        d.line([(ct[0] + 24 * scale, yy - 8 * scale), (rt[0] - inset, yy)], fill=LINE, width=int(16 * scale))


# 1) "any" icons: rounded corners with transparency
img = gradient_canvas(radius=int(S * 0.20))
draw_book(ImageDraw.Draw(img), 1.0)
img.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "icon-512.png"))
img.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, "icon-192.png"))

# 2) maskable icon: full-bleed background, book inside safe zone (80%)
img = gradient_canvas(radius=0)
draw_book(ImageDraw.Draw(img), 0.78)
img.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "icon-maskable-512.png"))

for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    print(f, os.path.getsize(p), "bytes")
