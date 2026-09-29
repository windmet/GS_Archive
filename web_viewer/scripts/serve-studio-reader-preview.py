#!/usr/bin/env python3
"""Loopback-only Reader preview; serves draft overlays without editing public files."""

from __future__ import annotations

import argparse
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
BUILD = (ROOT / ".analysis/build-check").resolve()
PUBLIC = (ROOT / "public").resolve()
PREVIEW_BASE = (ROOT / ".analysis/translation-preview").resolve()
BADGE_STYLE = (
    '<div role="status" aria-label="本地未审试译" '
    'style="position:fixed;bottom:12px;left:12px;z-index:2147483647;'
    'padding:8px 12px;border-radius:8px;background:#542d1f;color:#fff;'
    'font:600 13px system-ui;box-shadow:0 3px 12px #0005">'
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--overlay", required=True, type=Path)
    parser.add_argument("--models", required=True, type=Path)
    parser.add_argument("--review-receipt", type=Path)
    parser.add_argument("--port", type=int, default=5196)
    args = parser.parse_args()
    overlay_root = args.overlay.resolve()
    models_root = args.models.resolve()
    if not overlay_root.is_relative_to(PREVIEW_BASE) or not BUILD.is_dir():
        raise SystemExit("Overlay must be under this checkout's .analysis/translation-preview; build:check required")
    manifest = json.loads((overlay_root / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "GS-LOCAL-READER-TRIAL-V1" or manifest.get("human_status") != "unreviewed":
        raise SystemExit("Invalid local preview manifest")
    receipt = None
    if args.review_receipt:
        receipt_path = args.review_receipt.resolve()
        review_base = (ROOT / "translation/studio/reviews").resolve()
        if not receipt_path.is_relative_to(review_base):
            raise SystemExit("Review receipt must be under translation/studio/reviews")
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        if (receipt.get("schema") != "GS-STUDIO-HUMAN-REVIEW-V1"
                or receipt.get("status") != "reviewed"
                or receipt.get("source_commit") != manifest["source_commit"]
                or receipt.get("output_sha256") != manifest["output_sha256"]):
            raise SystemExit("Review receipt does not match this trial")
        reviewed_files = {item["scenario_id"]: item for item in receipt["files"]}
        if len(reviewed_files) != len(manifest["files"]):
            raise SystemExit("Review file count differs from trial")
    badge = BADGE_STYLE.replace('aria-label="本地未审试译"',
                                'aria-label="本地已审译文"' if receipt else 'aria-label="本地未审试译"')
    badge += 'B001 已审译文 · 本地</div>' if receipt else 'R3 本地未审试译 · 仅 B001</div>'
    html = (BUILD / "index.html").read_text(encoding="utf-8")
    embedded = re.search(r'<script type="application/json" id="archive-bootstrap">([^<]*)</script>', html)
    if not embedded or json.loads(embedded.group(1)) != json.loads((models_root / "bootstrap.inline.json").read_text(encoding="utf-8")):
        raise SystemExit("Read-model bootstrap does not match build:check")
    model_pages = (models_root / "pages").resolve()
    files = {}
    trial_documents = set()
    for item in manifest["files"]:
        relative = Path(item["path"])
        target = (overlay_root / relative).resolve()
        if not target.is_relative_to(overlay_root) or relative.suffix != ".json":
            raise SystemExit("Invalid overlay path")
        data = target.read_bytes()
        if "sha256:" + hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise SystemExit(f"Overlay hash mismatch: {relative}")
        overlay = json.loads(data)
        trial_documents.update(unit_id.split(":")[3] for unit_id in overlay["entries"])
        if receipt:
            reviewed = (PUBLIC / "translations" / relative).read_bytes()
            review_file = reviewed_files.get(item["scenario_id"])
            if (not review_file or "sha256:" + hashlib.sha256(reviewed).hexdigest() != review_file["sha256"]):
                raise SystemExit(f"Reviewed file hash mismatch: {relative}")
            reviewed_overlay = json.loads(reviewed)
            if (reviewed_overlay["source_raw_hash"] != overlay["source_raw_hash"]
                    or reviewed_overlay["scenario_id"] != overlay["scenario_id"]
                    or reviewed_overlay["entries"].keys() != overlay["entries"].keys()
                    or any(reviewed_overlay["entries"][unit_id] != {**value, "status": "reviewed"}
                           for unit_id, value in overlay["entries"].items())):
                raise SystemExit(f"Reviewed entries differ from approved trial: {relative}")
            data = reviewed
        files["/translations/" + relative.as_posix()] = data
    reading_entries = json.loads((PUBLIC / "data/reading/manifest.json").read_text(encoding="utf-8"))["entries"]
    reading_by_id = {entry["document_id"]: entry for entry in reading_entries}
    if not trial_documents.issubset(reading_by_id):
        raise SystemExit("Trial Reader document missing from current manifest")

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
                self._send(html.replace("</body>", badge + "</body>").encode("utf-8"),
                           "text/html; charset=utf-8", head)
                return
            if route.startswith("/_catalog/"):
                target = (model_pages / route.lstrip("/")).resolve()
                if not target.is_relative_to(model_pages) or not target.is_file():
                    self.send_error(404, "Catalogue unavailable")
                    return
                data = target.read_bytes()
                if "/reading-docs/detail/" in route:
                    detail = json.loads(data)
                    document_id = detail.get("data", {}).get("id")
                    if document_id in trial_documents:
                        entry = reading_by_id[document_id]
                        siblings = [candidate for candidate in reading_entries
                                    if candidate["logical_id"] == entry["logical_id"]]
                        detail["data"]["view"] = {"entry": entry, "entries": siblings}
                        data = json.dumps(detail, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
                self._send(data, "application/json; charset=utf-8", head)
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
    print(f"R3 Reader trial http://127.0.0.1:{args.port}/ ({'reviewed' if receipt else 'draft'})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
