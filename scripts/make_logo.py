"""Make the logo: burn the right end of the dollar bill (same method as the page) and export
the header mark, favicons and the Apple touch icon.

Usage:
    pip install pillow
    python3 scripts/make_logo.py
"""
import math, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
src, outdir = ROOT / "assets/img/dollar.jpg", ROOT / "assets/logo"
LOST = 0.30

def mulberry32(a):
    def r():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (1 | t)) & 0xFFFFFFFF
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF) ^ t) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return r

def make_noise(seed):
    rand, P = mulberry32(seed), 64
    g = [rand() for _ in range(P * P)]
    at = lambda x, y: g[(y % P) * P + (x % P)]
    s = lambda t: t * t * (3 - 2 * t)
    def value(x, y):
        xi, yi = math.floor(x), math.floor(y)
        u, v = s(x - xi), s(y - yi)
        a, b, c, d = at(xi, yi), at(xi + 1, yi), at(xi, yi + 1), at(xi + 1, yi + 1)
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
    def fbm(x, y):
        tot, amp, f = 0.0, 0.5, 1.0
        for _ in range(5):
            tot += amp * value(x * f, y * f); amp *= 0.5; f *= 2.1
        return tot
    return fbm

bill = Image.open(src).convert("RGBA")
w, h = bill.size
coarse, fine = make_noise(1913), make_noise(2025)
# Fire comes from the right end only, so the left half with the portrait stays.
corners = [(w, h, 0.55), (w, 0, 0.62), (0, h, 2.4), (0, 0, 2.6)]
field = []
for y in range(h):
    for x in range(w):
        dist = min(wt * math.hypot(x - cx, y - cy) / h for cx, cy, wt in corners)
        edge = min(x, w - x, y, h - y) / h
        field.append(0.5 * dist + 0.18 * edge + 0.55 * coarse(x / 120, y / 120) + 0.12 * fine(x / 18, y / 18))
thr = sorted(field)[int(LOST * len(field))]
px = bill.load()
CHAR, SCORCH = 0.02, 0.11
for i, f in enumerate(field):
    x, y = i % w, i // w
    k = f - thr
    r, g, b, a = px[x, y]
    if k < 0:
        px[x, y] = (0, 0, 0, 0)
    elif k < CHAR:
        t = k / CHAR
        ember = (0.25 - t) * 2.4 if t < 0.25 else 0
        px[x, y] = (int(34 + 150 * ember), int(24 + 40 * ember), 18, 255)
    elif k < SCORCH:
        t = (1 - (k - CHAR) / (SCORCH - CHAR)) ** 1.6
        px[x, y] = (int(r * (1 - 0.62 * t) + 92 * 0.62 * t), int(g * (1 - 0.7 * t) + 52 * 0.7 * t), int(b * (1 - 0.78 * t) + 22 * 0.78 * t), 255)

# A slight tilt, trimmed to the burned outline.
mark = bill.rotate(7, resample=Image.BICUBIC, expand=True)
mark = mark.crop(mark.getbbox())
mw, mh = mark.size
mark.resize((round(mw * 64 / mh), 64), Image.LANCZOS).save(f"{outdir}/logo-64.png", optimize=True)
side = round(max(mw, mh) * 1.04)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(mark, ((side - mw) // 2, (side - mh) // 2), mark)
for size, name in [(32, "favicon-32.png"), (16, "favicon-16.png")]:
    sq.resize((size, size), Image.LANCZOS).save(f"{outdir}/{name}", optimize=True)
side2 = round(mw * 1.25)
bg = Image.new("RGBA", (side2, side2), (239, 237, 232, 255))
bg.paste(mark, ((side2 - mw) // 2, (side2 - mh) // 2), mark)
bg.convert("RGB").resize((180, 180), Image.LANCZOS).save(f"{outdir}/apple-touch-icon.png", optimize=True)
print("logo", mark.size)
