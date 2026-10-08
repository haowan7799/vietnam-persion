"""Make a set of new "photos" from the single family photo.

People are cut out with rembg (u2net_human_seg), then regrouped onto designed backgrounds,
or the whole photo is restyled. Output: assets/gen/<name>.jpg (1280x853).

Usage: python3 -I gen_photos.py assets/family.jpg assets/gen
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

SRC, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1280, 853
os.makedirs(OUT, exist_ok=True)
random.seed(3)

photo = Image.open(SRC).convert("RGB").resize((W, H))
mask_path = os.path.join(OUT, "_mask.png")
if os.path.exists(mask_path):
    mask = Image.open(mask_path).convert("L")
else:
    from rembg import new_session, remove

    mask = remove(photo, session=new_session("u2net_human_seg"), only_mask=True, post_process_mask=True)
    mask.save(mask_path)
people = photo.convert("RGBA")
people.putalpha(mask)

# x-ranges of each person in the source photo (they hold hands, so groups keep joined hands)
COLS = {"dad": (0, 395), "boy": (395, 640), "girl": (640, 890), "mom": (890, W),
        "all": (0, W), "boys": (0, 640), "girls": (640, W), "kids": (395, 890)}
FACES = {"dad": (305, 105), "boy": (520, 300), "girl": (752, 322), "mom": (1005, 158)}


def font(size, name="Fredoka.ttf", weight="Bold"):
    f = ImageFont.truetype(os.path.join(HERE, "fonts", name), size)
    if name == "Fredoka.ttf":
        f.set_variation_by_name(weight)
    return f


def cut(group, trim=0):
    x0, x1 = COLS[group]
    im = people.crop((x0, 0, x1, H))
    if trim:  # drop stray hands of people outside the group
        a = np.asarray(im.getchannel("A")).copy()
        if x0 > 0: a[:, :trim] = 0
        if x1 < W: a[:, -trim:] = 0
        im.putalpha(Image.fromarray(a))
    return im.crop(im.getbbox())


def vgrad(top, bottom, w=W, h=H):
    t = np.linspace(0, 1, h)[:, None, None]
    a, b = np.array(top, float), np.array(bottom, float)
    return Image.fromarray(np.broadcast_to(a + (b - a) * t, (h, w, 3)).astype("uint8"))


def place(canvas, im, cx, bottom, height, shadow=True, tint=None):
    s = height / im.height
    im = im.resize((max(1, int(im.width * s)), int(height)), Image.LANCZOS)
    if tint:
        rgb = Image.blend(im.convert("RGB"), Image.new("RGB", im.size, tint[0]), tint[1])
        rgb.putalpha(im.getchannel("A"))
        im = rgb
    x, y = int(cx - im.width / 2), int(bottom - im.height)
    if shadow:
        sh = Image.new("RGBA", im.size, (40, 30, 70, 0))
        sh.putalpha(im.getchannel("A").point(lambda v: v * 0.35))
        sh = sh.filter(ImageFilter.GaussianBlur(14))
        canvas.alpha_composite(sh, (x + 18, y + 14))
    canvas.alpha_composite(im, (x, y))
    return canvas


def title(canvas, text, xy, size, fill, stroke="#2B2250", anchor="la", rot=0, f=None):
    f = f or font(size)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((xy[0] + size * .06, xy[1] + size * .08), text, font=f, fill=stroke, anchor=anchor,
           stroke_width=int(size * .09), stroke_fill=stroke)
    d.text(xy, text, font=f, fill=fill, anchor=anchor, stroke_width=int(size * .09), stroke_fill=stroke)
    if rot:
        layer = layer.rotate(rot, center=xy, resample=Image.BICUBIC)
    canvas.alpha_composite(layer)


def star(d, cx, cy, r, fill, n=5, inner=.45, rot=-math.pi / 2):
    pts = [(cx + math.cos(rot + i * math.pi / n) * (r if i % 2 == 0 else r * inner),
            cy + math.sin(rot + i * math.pi / n) * (r if i % 2 == 0 else r * inner)) for i in range(2 * n)]
    d.polygon(pts, fill=fill)


def heart(d, cx, cy, s, fill):
    d.ellipse((cx - s, cy - s * .6, cx, cy + s * .4), fill=fill)
    d.ellipse((cx, cy - s * .6, cx + s, cy + s * .4), fill=fill)
    d.polygon([(cx - s * .97, cy), (cx + s * .97, cy), (cx, cy + s * 1.1)], fill=fill)


def burst(color_a, color_b, center, n=24):
    im = Image.new("RGB", (W, H), color_a)
    d = ImageDraw.Draw(im)
    R = 2000
    for i in range(n):
        if i % 2:
            continue
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        d.polygon([center, (center[0] + R * math.cos(a0), center[1] + R * math.sin(a0)),
                   (center[0] + R * math.cos(a1), center[1] + R * math.sin(a1))], fill=color_b)
    return im


def save(canvas, name):
    canvas.convert("RGB").save(os.path.join(OUT, name + ".jpg"), quality=92)
    print("wrote", name)


# 1. beach day -----------------------------------------------------------------
c = vgrad((143, 211, 255), (255, 229, 194)).convert("RGBA")
d = ImageDraw.Draw(c)
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((930, 50, 1170, 290), fill=(255, 240, 160, 160))
c.alpha_composite(glow.filter(ImageFilter.GaussianBlur(40)))
d.ellipse((990, 110, 1110, 230), fill=(255, 226, 122))
sea = vgrad((59, 169, 217), (127, 208, 238), W, 140)
c.paste(sea, (0, 420))
for i in range(14):
    y = 440 + (i % 5) * 26
    x = (i * 173) % W
    d.arc((x, y, x + 90, y + 20), 200, 340, fill=(255, 255, 255), width=4)
d.rectangle((0, 555, W, H), fill=(246, 221, 175))
d.polygon([(0, 555), (W, 540), (W, 575), (0, 590)], fill=(255, 245, 225))
for x, col in [(150, (255, 111, 168)), (1150, (255, 210, 63))]:  # starfish
    star(d, x, 760, 30, col)
# umbrella
d.line((210, 330, 230, 640), fill=(120, 90, 70), width=10)
for i in range(6):
    d.pieslice((60, 230, 380, 430), 180 + i * 30, 210 + i * 30, fill=[(255, 111, 168), (255, 255, 255)][i % 2])
place(c, cut("all"), 700, 830, 600)
title(c, "BEACH DAY", (60, 60), 92, "#FFD23F")
save(c, "beach")

# 2. team boys ---------------------------------------------------------------------
c = burst((76, 201, 240), (110, 214, 245), (420, 500)).convert("RGBA")
d = ImageDraw.Draw(c)
for y in range(0, H, 28):
    for x in range(0, W, 28):
        r = 3 + 3 * (x / W)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 40))
place(c, cut("boys", 30), 430, H + 10, 800)
title(c, "TEAM", (1100, 230), 120, "#FFFFFF", anchor="mm", rot=6)
title(c, "BOYS", (1100, 370), 150, "#FFD23F", anchor="mm", rot=6)
for (x, y, r) in [(920, 520, 34), (1210, 560, 24), (1180, 100, 28)]:
    star(d, x, y, r, (255, 210, 63))
save(c, "boys")

# 3. girls' day --------------------------------------------------------------------
c = vgrad((255, 179, 209), (255, 226, 238)).convert("RGBA")
d = ImageDraw.Draw(c, "RGBA")
for i in range(40):
    x, y, s = random.randint(0, W), random.randint(0, H), random.randint(14, 40)
    heart(d, x, y, s, random.choice([(255, 255, 255, 170), (255, 111, 168, 150), (255, 210, 63, 150)]))
place(c, cut("girls", 30), 820, H + 10, 800)
title(c, "GIRLS'", (230, 260), 120, "#FFFFFF", anchor="mm", rot=-6)
title(c, "DAY", (230, 400), 150, "#FF6FA8", anchor="mm", rot=-6)
save(c, "girls")

# 4. siblings ------------------------------------------------------------------------
c = burst((255, 210, 63), (255, 226, 120), (640, 470), 30).convert("RGBA")
d = ImageDraw.Draw(c)
for i in range(70):
    x, y = random.randint(0, W), random.randint(0, H)
    col = random.choice([(255, 111, 168), (123, 97, 255), (79, 214, 181), (76, 201, 240)])
    a = random.random() * math.pi
    d.polygon([(x + 12 * math.cos(a), y + 12 * math.sin(a)), (x + 6 * math.cos(a + 1.6), y + 6 * math.sin(a + 1.6)),
               (x - 12 * math.cos(a), y - 12 * math.sin(a)), (x - 6 * math.cos(a + 1.6), y - 6 * math.sin(a + 1.6))], fill=col)
place(c, cut("kids", 45), 640, H + 10, 720)
title(c, "SIBLINGS!", (640, 90), 120, "#FFFFFF", anchor="mm")
save(c, "kids2")

# 5. party time -----------------------------------------------------------------------
c = vgrad((123, 97, 255), (190, 170, 255)).convert("RGBA")
d = ImageDraw.Draw(c)
for i in range(13):  # bunting
    x = i * 105
    d.polygon([(x, 0), (x + 100, 0), (x + 50, 80)], fill=[(255, 111, 168), (255, 210, 63), (79, 214, 181), (76, 201, 240)][i % 4])
for x, y, col in [(110, 300, (255, 111, 168)), (200, 220, (255, 210, 63)), (1080, 260, (79, 214, 181)), (1180, 340, (255, 111, 168)), (1000, 160, (76, 201, 240))]:
    d.line((x, y + 70, x + 15, y + 330), fill=(255, 255, 255), width=3)
    d.ellipse((x - 55, y - 70, x + 55, y + 70), fill=col)
    d.ellipse((x - 30, y - 45, x - 8, y - 15), fill=(255, 255, 255))
place(c, cut("all"), 640, H + 10, 660)
title(c, "PARTY TIME", (640, 150), 110, "#FFD23F", anchor="mm")
save(c, "party")

# 6. night walk ---------------------------------------------------------------------------
c = vgrad((27, 23, 64), (75, 60, 130)).convert("RGBA")
d = ImageDraw.Draw(c)
for i in range(120):
    x, y, r = random.randint(0, W), random.randint(0, 520), random.random() * 2.6 + .6
    d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 230))
d.ellipse((1020, 70, 1150, 200), fill=(255, 244, 200))
d.ellipse((1055, 60, 1175, 180), fill=(27, 23, 64))
for i in range(22):  # fairy lights
    x = i * 62
    y = 40 + 50 * math.sin(i / 21 * math.pi)
    col = [(255, 210, 63), (255, 111, 168), (79, 214, 181)][i % 3]
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse((x - 20, y - 20, x + 20, y + 20), fill=col + (120,))
    c.alpha_composite(g.filter(ImageFilter.GaussianBlur(10)))
    d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=col)
d.rectangle((0, 700, W, H), fill=(38, 32, 80))
place(c, cut("all"), 640, 840, 640, tint=((70, 60, 160), .28))
title(c, "NIGHT WALK", (60, 760), 80, "#FFE9A8")
save(c, "night")

# 7. retro film ------------------------------------------------------------------------------
im = ImageEnhance.Color(photo).enhance(.75)
arr = np.asarray(im).astype(float)
arr = arr * [1.06, .98, .86] + [18, 10, 0]           # warm, faded
arr = 22 + arr * .9                                   # lifted blacks
yy, xx = np.mgrid[0:H, 0:W]
vig = 1 - .45 * (((xx - W / 2) / (W / 1.2)) ** 2 + ((yy - H / 2) / (H / 1.2)) ** 2)
arr *= vig[..., None]
leak = np.clip(1 - xx / 420, 0, 1)[..., None] * [255, 120, 40] * .45
arr = arr + leak + np.random.default_rng(1).normal(0, 9, arr.shape)
c = Image.fromarray(np.clip(arr, 0, 255).astype("uint8")).convert("RGBA")
d = ImageDraw.Draw(c)
mono = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 44)
g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(g).text((1220, 800), "'26 10 08", font=mono, fill=(255, 140, 40, 255), anchor="rs")
c.alpha_composite(g.filter(ImageFilter.GaussianBlur(4)))
c.alpha_composite(g)
save(c, "retro")

# 8. polaroid wall ---------------------------------------------------------------------------
cork = np.full((H, W, 3), (201, 155, 109), float) + np.random.default_rng(2).normal(0, 14, (H, W, 1))
c = Image.fromarray(np.clip(cork, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(.8)).convert("RGBA")
labels = {"dad": "dad", "mom": "mom", "boy": "bro", "girl": "sis"}
spots = [("dad", 190, 300, -7), ("boy", 500, 520, 5), ("girl", 790, 330, -4), ("mom", 1090, 520, 7)]
for k, cx, cy, rot in spots:
    fx, fy = FACES[k]
    sz = 300 if k in ("dad", "mom") else 250
    face = photo.crop((fx - sz // 2, max(0, fy - sz // 3), fx + sz // 2, max(0, fy - sz // 3) + sz)).resize((250, 250))
    card = Image.new("RGBA", (290, 350), (255, 253, 248, 255))
    card.paste(face, (20, 20))
    ImageDraw.Draw(card).text((145, 310), labels[k], font=ImageFont.truetype(os.path.join(HERE, "fonts", "Pacifico.ttf"), 40), fill="#7B61FF", anchor="mm")
    card = card.rotate(rot, expand=True, resample=Image.BICUBIC)
    sh = Image.new("RGBA", card.size, (40, 25, 10, 0))
    sh.putalpha(card.getchannel("A").point(lambda v: v * .4))
    c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)), (cx - card.width // 2 + 10, cy - card.height // 2 + 12))
    c.alpha_composite(card, (cx - card.width // 2, cy - card.height // 2))
    tape = Image.new("RGBA", (120, 36), (255, 240, 180, 190)).rotate(rot * 2 + 8, expand=True)
    c.alpha_composite(tape, (cx - tape.width // 2, cy - 175 - tape.height // 2))
title(c, "our crew", (640, 80), 80, "#FFFFFF", anchor="mm", f=font(80, "Pacifico.ttf", None))
save(c, "polaroids")

# 9. comic pop art -----------------------------------------------------------------------------
im = ImageEnhance.Color(photo.filter(ImageFilter.ModeFilter(5))).enhance(1.6)
im = ImageOps.posterize(im, 4)
edges = photo.convert("L").filter(ImageFilter.GaussianBlur(1.5)).filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 22 else 0)
c = im.convert("RGBA")
ink = Image.new("RGBA", (W, H), (30, 20, 50, 255))
c.paste(ink, mask=edges)
dots = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(dots)
for y in range(0, H, 16):
    for x in range(0, W, 16):
        dd.ellipse((x, y, x + 4, y + 4), fill=(255, 255, 255, 28))
c.alpha_composite(dots)
d = ImageDraw.Draw(c)
d.ellipse((780, 40, 1240, 230), fill="#FFFFFF", outline="#1E1432", width=8)
d.polygon([(880, 210), (820, 300), (950, 220)], fill="#FFFFFF", outline="#1E1432")
d.line([(880, 214), (820, 300), (950, 222)], fill="#1E1432", width=8)
d.text((1010, 135), "best day ever!!", font=font(50), fill="#1E1432", anchor="mm")
title(c, "POW!", (130, 120), 110, "#FFD23F", anchor="mm", rot=12)
save(c, "comic")

# 10. studio portrait (rearranged: kids up front) ---------------------------------------------------
yy, xx = np.mgrid[0:H, 0:W]
r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * .45) / H) ** 2)
t = np.clip(r * 1.6, 0, 1)[..., None]
arr = np.array([236, 226, 255]) * (1 - t) + np.array([170, 150, 230]) * t
c = Image.fromarray(arr.astype("uint8")).convert("RGBA")
place(c, cut("dad", 30), 470, 830, 700)
place(c, cut("mom", 30), 820, 830, 700)
place(c, cut("boy", 30), 570, 853, 470, shadow=False)
place(c, cut("girl", 30), 720, 853, 470, shadow=False)
title(c, "the family", (640, 80), 72, "#FFFFFF", anchor="mm", f=font(72, "Pacifico.ttf", None))
save(c, "studio")
