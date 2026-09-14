"""Persistent lossless WebP encoder worker.

Speaks a line-delimited JSON protocol on stdin/stdout so the Node exporter can
keep one interpreter alive across thousands of files instead of paying the
interpreter + Pillow import cost per image.

The encode body is the historical, proven pipeline verbatim: zero the RGB of
fully transparent pixels, then save with libwebp's `exact` flag so the encoder
preserves those zeroes instead of re-spreading colour into transparent pixels.
`method=6` is the slowest/most thorough search and `quality=100` is fixed
because lossless mode ignores it. Partial alpha is never touched.
"""

import json
import sys
from pathlib import Path

from PIL import Image


def encode(src, dst):
    im = Image.open(src).convert("RGBA")
    pixels = bytearray(im.tobytes())

    cleared = 0
    for i in range(0, len(pixels), 4):
        if pixels[i + 3] == 0:
            if pixels[i] or pixels[i + 1] or pixels[i + 2]:
                cleared += 1
            pixels[i] = 0
            pixels[i + 1] = 0
            pixels[i + 2] = 0

    clean = Image.frombytes("RGBA", im.size, bytes(pixels))
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    clean.save(
        dst,
        "WEBP",
        lossless=True,
        quality=100,
        method=6,
        exact=True,
    )
    return {"width": im.size[0], "height": im.size[1], "alphaClearedPixels": cleared}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        job = json.loads(line)
        if job.get("op") == "shutdown":
            return
        try:
            result = encode(job["source"], job["target"])
            result["id"] = job["id"]
            result["ok"] = True
        except Exception as exc:  # noqa: BLE001 - reported to the Node caller
            result = {
                "id": job.get("id"),
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
            }
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
