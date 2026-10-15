#!/usr/bin/env python3
"""Card operational voice text from the community wiki (wikiwiki.jp/sidem-gstars).

The client masterdata has no text for the unit formation and live voices (cue suffixes 03_01..04_04), and
the scout/change line (02_00) is often the placeholder "0". Each card page on the wiki lists these lines
in its 限定台詞 table: ホーム, ホーム(チェンジ！後), [スカウト・]チェンジ！, ユニット編成 (three lines),
ライブ開始, スペシャルアピール(通常/ユニット) and スキル発動. This script reads the rarity list pages for
every card page, fetches each page politely (cached under --html-dir), resolves the page to one card by
exact title and idol name, and writes data_pipeline/curated/card_voice_transcripts.json.

A page is only used when its ホーム lines match the card's home voice text from the game scripts, so a page
that belongs to another card, or a table in an unexpected layout, never reaches the archive. Each row's
line count must equal the card's audio files for that row.

  python scripts/extract-wikiwiki-card-voices.py --html-dir <cache dir> [--checked-at 2026-10-15] [--cached-only]

The wiki answers 429 after a handful of requests; the fetcher pauses five minutes and retries. --cached-only
writes what the cache holds and lists the pages still to fetch in <cache dir>/report.json ("pending").
"""
from __future__ import annotations

import argparse
import html as htmllib
import json
import re
import subprocess
import time
import unicodedata
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "masterdata"
OUTPUT = ROOT.parent / "data_pipeline" / "curated" / "card_voice_transcripts.json"
WIKI = "https://wikiwiki.jp/sidem-gstars/"
LIST_PAGES = ["SSR／SSR+", "SR／SR+", "R／R+", "N／N+"]
IDOL_ALIASES = {"アスラン=BBⅡ世": "アスラン＝ベルゼビュートⅡ世"}
# Wiki row label -> cue suffixes, in the order the wiki lists the lines.
ROWS = {
    "ホーム": None,
    "ホーム(チェンジ！後)": None,
    "ホーム(チェンジ後)": None,
    "チェンジ！": ["02_00"],
    "スカウト・チェンジ！": ["02_00"],
    "ユニット編成": ["03_01", "03_02", "03_03"],
    "ライブ開始": ["04_01"],
    "スペシャルアピール(通常)": ["04_02"],
    "スペシャルアピール(ユニット)": ["04_03"],
    "スキル発動": ["04_04"],
}
MAPPING_BASIS = ("wiki 限定台詞 row labels mapped to the standard 02/03/04 cue suffixes; "
                 "page accepted only when its ホーム lines match the card's home voice text")


def page_url(title: str) -> str:
    return WIKI + urllib.parse.quote(title)


def fetch(title: str, path: Path, delay: float) -> str | None:
    if path.exists() and path.stat().st_size > 20000:
        return path.read_text(encoding="utf-8")
    status, failures, limited = "", 0, 0
    while failures < 4 and limited < 10:
        time.sleep(delay)
        result = subprocess.run(["curl", "-s", "-m", "60", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code}",
                                 page_url(title)], capture_output=True, text=True)
        status = result.stdout
        if status == "200" and path.stat().st_size > 20000:
            return path.read_text(encoding="utf-8")
        path.unlink(missing_ok=True)
        if status == "404":
            break
        if status == "429":
            # The wiki rate-limits bursts; pause five minutes, then retry the same page.
            limited += 1
            print(f"{time.strftime('%H:%M:%S')} rate limited at {title}; pausing 5 minutes", flush=True)
            time.sleep(300)
            continue
        failures += 1
        time.sleep(delay * failures)
    print(f"could not fetch {title} (status {status})", flush=True)
    return None


def norm(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", htmllib.unescape(text)))


def match_key(text: str) -> str:
    """Home-line comparison key: the wiki often drops or changes punctuation."""
    return re.sub(r"[、。，．！？!?…・「」『』～〜ー\-]", "", norm(text))


def cell_text(cell: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", cell)
    text = htmllib.unescape(re.sub(r"<[^>]+>", "", text))
    return "\n".join(line.strip() for line in text.split("\n") if line.strip())


def voice_rows(page: str) -> dict[str, list[str]] | None:
    """The 限定台詞 table as {label: [lines]}; a row without a label continues the previous label."""
    start = page.find("限定台詞")
    if start < 0:
        return None
    table = re.search(r"<table.*?</table>", page[start:], re.S)
    if not table:
        return None
    rows: dict[str, list[str]] = {}
    label = None
    for row in re.findall(r"<tr.*?</tr>", table.group(0), re.S):
        cells = re.findall(r"<t([hd])[^>]*>(.*?)</t[hd]>", row, re.S)
        texts = [cell_text(body) for _, body in cells]
        if len(texts) == 2:
            label = texts[0].replace("（", "(").replace("）", ")")
            rows.setdefault(label, []).append(texts[1])
        elif len(texts) == 1 and label:
            rows[label].append(texts[0])
        elif texts:
            return None
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--html-dir", type=Path, required=True)
    parser.add_argument("--checked-at", default="2026-10-15")
    parser.add_argument("--delay", type=float, default=3.0)
    parser.add_argument("--cached-only", action="store_true", help="parse cached pages only; skip pages not fetched yet")
    args = parser.parse_args()
    args.html_dir.mkdir(parents=True, exist_ok=True)

    idols = json.loads((DATA / "idol_unit_dictionary.json").read_text(encoding="utf-8"))["idols"]
    by_name = {norm(idol["display_name"]): idol["idol_code"] for idol in idols}
    cards = json.loads((DATA / "card_index.json").read_text(encoding="utf-8"))["cards"]
    details = json.loads((DATA / "card_detail_index.json").read_text(encoding="utf-8"))["cards_by_resource_id"]
    by_key: dict[tuple[str, str], list[dict]] = {}
    for card in cards:
        by_key.setdefault((norm(card["title_full"]), card["character_id"]), []).append(card)

    titles = set()
    for index, name in enumerate(LIST_PAGES):
        page = fetch(name, args.html_dir / f"list_{index}.html", args.delay)
        body = page[page.find('id="body"'):page.find("最新情報", page.find('id="body"'))]
        titles |= {urllib.parse.unquote(href) for href in re.findall(r'href="/sidem-gstars/([^"#]+)"', body)}
    titles = sorted(title for title in titles if title.startswith("【"))

    existing = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"schema_version": 1, "cards": {}}
    out_cards = dict(existing.get("cards", {}))
    report = {"pages": len(titles), "unresolved": [], "ambiguous": [], "no_table": [], "home_mismatch": [],
              "count_mismatch": [], "pending": [], "cards": 0, "voices": 0}
    for title in titles:
        match = re.match(r"^(【.+?】)(.+)$", title)
        name = IDOL_ALIASES.get(match.group(2), match.group(2))
        code = by_name.get(norm(name))
        candidates = by_key.get((norm(match.group(1)), code), []) if code else []
        if not candidates:
            report["unresolved"].append(title)
            continue
        safe = re.sub(r'[\\/:*?"<>|]', "_", title)
        cached = args.html_dir / f"{safe}.html"
        if args.cached_only and not (cached.exists() and cached.stat().st_size > 20000):
            report["pending"].append(title)
            continue
        page = fetch(title, cached, args.delay)
        rows = voice_rows(page) if page else None
        if not rows:
            report["no_table"].append(title)
            continue
        wiki_home = {match_key(line) for label in ("ホーム", "ホーム(チェンジ！後)", "ホーム(チェンジ後)") for line in rows.get(label, [])}
        # Same-title cards (N 【スタートライン】 variants) are told apart by their home voice text.
        # At least half of the card's home lines must match exactly: the wiki has occasional typos, and the
        # game text carries a ●●●● producer-name slot the wiki leaves out.
        accepted = []
        for card in candidates:
            home = {match_key(cue["preview"]["text"].replace("●", "")) for cue in card.get("home_voice_cues", [])
                    if cue.get("preview", {}).get("text", "").strip() not in ("", "0")}
            if home and len(home & wiki_home) * 2 >= len(home):
                accepted.append(card)
        if len(accepted) != 1:
            report["home_mismatch" if not accepted else "ambiguous"].append(title)
            continue
        card = accepted[0]
        base = card.get("voice_base")
        stems = {cue["cue"] for cue in details.get(card["resource_id"], {}).get("operational_voice_cues", [])}
        voices = {}
        for label, lines in rows.items():
            suffixes = ROWS.get(label)
            if label not in ROWS:
                report["count_mismatch"].append(f"{title}: unknown row {label}")
                voices = None
                break
            if not suffixes:
                continue
            cues = [f"{base}_{suffix}" for suffix in suffixes if f"{base}_{suffix}" in stems]
            if len(cues) != len(lines):
                report["count_mismatch"].append(f"{title}: {label} {len(lines)} lines, {len(cues)} voices")
                voices = None
                break
            voices.update({cue: {"text": line} for cue, line in zip(cues, lines)})
        if not voices:
            continue
        out_cards[card["resource_id"]] = {"source_url": page_url(title), "verified_at": args.checked_at,
                                          "mapping_basis": MAPPING_BASIS, "voices": voices}
        report["cards"] += 1
        report["voices"] += len(voices)

    OUTPUT.write_text(json.dumps({"schema_version": 1, "cards": dict(sorted(out_cards.items()))},
                                 ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value if isinstance(value, int) else len(value) for key, value in report.items()}, ensure_ascii=False))
    (args.html_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
