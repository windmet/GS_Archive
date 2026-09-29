#!/usr/bin/env python3
"""Loopback-only Reader preview; serves draft overlays without editing public files."""

from __future__ import annotations

import argparse
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
BUILD = (ROOT / ".analysis/build-check").resolve()
PUBLIC = (ROOT / "public").resolve()
PREVIEW_BASE = (ROOT / ".analysis/translation-preview").resolve()
BADGE = (
    '<div role="status" aria-label="本地未审试译" '
    'style="position:fixed;bottom:12px;left:12px;z-index:2147483647;'
    'padding:8px 12px;border-radius:8px;background:#542d1f;color:#fff;'
    'font:600 13px system-ui;box-shadow:0 3px 12px #0005">'
    'R3 本地未审试译 · 仅 B001</div>'
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--overlay", required=True, type=Path)
    parser.add_argument("--port", type=int, default=5196)
    args = parser.parse_args()
    overlay_root = args.overlay.resolve()
    if not overlay_root.is_relative_to(PREVIEW_BASE) or not BUILD.is_dir():
        raise SystemExit("Overlay must be under this checkout's .analysis/translation-preview; build:check required")
    manifest = json.loads((overlay_root / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "GS-LOCAL-READER-TRIAL-V1" or manifest.get("human_status") != "unreviewed":
        raise SystemExit("Invalid local preview manifest")
    files = {}
    for item in manifest["files"]:
        relative = Path(item["path"])
        target = (overlay_root / relative).resolve()
        if not target.is_relative_to(overlay_root) or relative.suffix != ".json":
            raise SystemExit("Invalid overlay path")
        data = target.read_bytes()
        if "sha256:" + hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise SystemExit(f"Overlay hash mismatch: {relative}")
        files["/translations/" + relative.as_posix()] = data

    class Handler(SimpleHTTPRequestHandler):
        def _send(self, data: bytes, content_type: str, head: bool = False) -> None:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if not head:
                self.wfile.write(data)

        def _handle(self, head: bool = False) -> None:
            route = unquote(urlsplit(self.path).path)
            if route in files:
                self._send(files[route], "application/json; charset=utf-8", head)
                return
            if route.startswith("/translations/zh-CN/scenarios/"):
                self.send_error(404, "No R3 trial overlay for this catalogue")
                return
            if route in ("/", "/index.html"):
                html = (BUILD / "index.html").read_text(encoding="utf-8")
                if "</body>" not in html:
                    self.send_error(500, "Build index lacks body")
                    return
                self._send(html.replace("</body>", BADGE + "</body>").encode("utf-8"),
                           "text/html; charset=utf-8", head)
                return
            if route.startswith("/_catalog/"):
                try:
                    with urlopen("http://127.0.0.1:5176" + self.path, timeout=15) as response:
                        self._send(response.read(), response.headers.get("Content-Type", "application/json"), head)
                except HTTPError as error:
                    self.send_error(error.code, "Catalogue unavailable")
                except OSError:
                    self.send_error(502, "Catalogue service unavailable")
                return
            target = self.translate_path(self.path)
            if not Path(target).is_file():
                self.send_error(404)
                return
            data = Path(target).read_bytes()
            self._send(data, mimetypes.guess_type(target)[0] or "application/octet-stream", head)

        def translate_path(self, path: str) -> str:
            route = Path(unquote(urlsplit(path).path).lstrip("/"))
            if ".." in route.parts or route.is_absolute():
                return str(BUILD / "__invalid__")
            for base in (BUILD, PUBLIC):
                target = (base / route).resolve()
                if target.is_relative_to(base) and target.is_file():
                    return str(target)
            return str(BUILD / "__missing__")

        def do_GET(self) -> None:  # noqa: N802
            self._handle()

        def do_HEAD(self) -> None:  # noqa: N802
            self._handle(head=True)

    if not 1024 <= args.port <= 65535:
        raise SystemExit("Invalid port")
    print(f"R3 Reader trial http://127.0.0.1:{args.port}/ (draft, unreviewed)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
