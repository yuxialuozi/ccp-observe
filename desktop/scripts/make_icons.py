# -*- coding: utf-8 -*-
"""Generate the ccp-observe app icons for the Tauri bundle.

The mark mirrors the panel logo: a rounded blue tile with three rising bars.
Run this once (needs Pillow) whenever the brand mark changes:

    py -3 desktop/scripts/make_icons.py

Outputs into ``desktop/src-tauri/icons``:
    32x32.png, 128x128.png, 128x128@2x.png, icon.png (1024), icon.ico, icon.icns

Re-run ``npx @tauri-apps/cli icon`` afterwards if you prefer the CLI's own set.
"""

from __future__ import annotations

import os
import struct

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "src-tauri", "icons"))
BASE = 1024
BLUE = (37, 99, 235, 255)      # #2563eb
WHITE = (255, 255, 255, 255)


def _master() -> Image.Image:
    img = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Rounded tile (radius ~ 22% of the canvas, like the 32px logo's rx=7).
    d.rounded_rectangle([0, 0, BASE - 1, BASE - 1], radius=int(BASE * 0.22), fill=BLUE)
    # Three bars, matching logoSvg: x=7/14/21, heights 9/15/19 on a 32 grid.
    def bar(x, y, w, h, opacity):
        color = (255, 255, 255, int(255 * opacity))
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle(
            [x, y, x + w, y + h], radius=int(w * 0.38), fill=color
        )
        return layer

    u = BASE / 32.0
    for (x, y, w, h, op) in [
        (7, 16, 4, 9, 0.55),
        (14, 10, 4, 15, 0.8),
        (21, 6, 4, 19, 1.0),
    ]:
        img = Image.alpha_composite(
            img, bar(int(x * u), int(y * u), int(w * u), int(h * u), op)
        )
    return img


def _write_icns(master: Image.Image, path: str) -> None:
    """Minimal ICNS writer: one PNG payload per size, following the spec."""
    # (OSType, pixel size)
    entries = [
        (b"ic11", 32), (b"ic12", 64), (b"ic07", 128), (b"ic13", 256),
        (b"ic08", 256), (b"ic14", 512), (b"ic09", 512), (b"ic10", 1024),
    ]
    chunks = b""
    for ostype, size in entries:
        buf = os.path.join(OUT, "_tmp_%d.png" % size)
        master.resize((size, size), Image.LANCZOS).save(buf, "PNG")
        with open(buf, "rb") as fh:
            data = fh.read()
        os.remove(buf)
        chunks += ostype + struct.pack(">I", len(data) + 8) + data
    payload = b"icns" + struct.pack(">I", len(chunks) + 8) + chunks
    with open(path, "wb") as fh:
        fh.write(payload)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    master = _master()
    master.save(os.path.join(OUT, "icon.png"), "PNG")
    for size, name in [(32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")]:
        master.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), "PNG")
    master.resize((256, 256), Image.LANCZOS).save(
        os.path.join(OUT, "icon.ico"), "ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    _write_icns(master, os.path.join(OUT, "icon.icns"))
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
