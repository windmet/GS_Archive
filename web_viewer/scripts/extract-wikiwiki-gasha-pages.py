#!/usr/bin/env python3
"""Keep each gasha's own wiki page: its periods, rules, exchange list and notes.

The notice log (scripts/extract-wikiwiki-acquisition.py) names every pool and its new cards; each named pool
also links to a page of its own (【ガシャ】「…」) that records the rules the in-game "ガシャ詳細" showed:
the SSR-guaranteed one-time draw, what プラチナガシャ guarantees, the メモリースター or selection-ticket
exchange with its cost per card, step-up prices, and the 注意事項. The client never stored this (GashaData,
GashaRate and GashaCeiling were server replies), so these pages are the only record. This script follows the
notice links, reads the pages (cached under --html-dir, fetched politely when missing), resolves every card it
lists, and writes public/data/editorial/wiki-gasha-pages.json. Any card, cost row or pool link that does not
resolve stops the run.

  python scripts/extract-wikiwiki-gasha-pages.py --html-dir <cache dir> [--checked-at 2026-10-14]
"""
from __future__ import annotations

import argparse
import hashlib
import html as htmllib
import importlib.util
import json
import re
import urllib.parse
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("acquisition", ROOT / "scripts" / "extract-wikiwiki-acquisition.py")
acquisition = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(acquisition)

EVIDENCE = acquisition.DATA / "editorial" / "wiki-acquisition-evidence.json"
OUTPUT = acquisition.DATA / "editorial" / "wiki-gasha-pages.json"
LINK = re.compile(r'<a href="/sidem-gstars/([^"#?]+)"[^>]*class="rel-wiki-page">([^<]+)</a>')
CARD = re.compile(r"^(SSR|SR|R|N)(\+?)：?\s*【(.+?)】\s*(.+?)(?:\s+(?:期間限定|フェス限定))?\s*$")
STEP = re.compile(r"^STEP(\d+)：(有償)?スタージェム(\d+)個（(\d+)回引く）$")
EXCHANGE_HEADING = re.compile(r"^(メモリースター交換|.+セレクションチケット交換)(?:（(.+?)まで）)?$")


# Rule sentences the pages repeat, read into facts the archive can state in Chinese. Lines that match none stay
# in the page's sections as source text only.
FACTS = [
    ("currency_any", re.compile(r"^有償スタージェム、または無償スタージェムでご利用いただけ(?:るガシャです|ます)。$")),
    ("guarantee_ten", re.compile(r"^R以上のアイドルフォトが出現し、「10回引く」ではSR以上のアイドルフォトが必ず(?P<count>\d+)枚以上出現します。$")),
    ("ssr_costume", re.compile(r"^SSRアイドルフォトが出現した場合はライブで使用できる専用衣装を獲得できます。$")),
    ("ssr_guaranteed", re.compile(r"^SSRアイドルフォトが必ず(?P<count>\d+)枚以上出現するガシャです。$")),
    ("per_user_paid", re.compile(r"^期間中お一人様(?P<count>\d+)回(?:限り|まで)、有償スタージェムでのみご利用いただけます。$")),
    ("rate_up", re.compile(r"^本ガシャの開催中は「(?P<target>.+?)」の提供割合が、同じレアリティの他のアイドルフォトよりも高くなります$")),
    ("rate_up", re.compile(r"^※開催期間中は(?P<target>新登場アイドルフォト)の出現率がUPいたします。?$")),
    ("rate_varies", re.compile(r"^提供割合はアイドルフォト毎に異なります$")),
    ("limited_leaves", re.compile(r"^期間限定 表示のあるアイドルフォトは(?:「.+?」|本ガシャ)開催終了後、出現しなくなります$")),
    ("limited_returns", re.compile(r"^期間限定 表示のあるアイドルフォトは(?:後日、期間限定で|今後)再登場する場合があります$")),
    ("no_memory_star", re.compile(r"^※?(?:「(?P<target>.+?)」|本ガシャ)ではメモリースターを獲得することはできません$")),
    ("memory_to_piece", re.compile(r"^期間中に入手したメモリースターは期間終了(?:時|後)にメモリーピースに変換されます$")),
    ("no_changed_cards", re.compile(r"^本ガシャからチェンジ！後のアイドルフォトは出現しません$")),
    ("daily_discount_paid", re.compile(r"^1日1回限定の割引ガシャは有償スタージェムでのみご利用いただけます$")),
    ("daily_discount_reset", re.compile(r"^1日1回限定の割引ガシャは毎日(?P<time>\d{1,2}:\d{2})にリセットされます$")),
    ("bonus_item", re.compile(r"^(?:限定ステッカー)?「(?P<item>.+?)」がおまけでついてくる(?:お得|特別)なガシャです。$")),
    ("sr_ticket", re.compile(r"^期間中に「(?P<ticket>.+?)」を使用すると、開催中の「(?P<gasha>.+?)」にて提供中のアイドルフォトの中からSR以上のアイドルフォトが必ず出現します。$")),
    ("rarity_ticket", re.compile(r"^期間中、「(?P<ticket>.+?)」および「(?P<ticket2>.+?)」を使用すると、(?:開催中の)?「(?P<gasha>.+?)」にて提供中のアイドルフォトのうち、該当するレアリティのアイドルフォトが必ず出現します。$")),
    ("use_limit", re.compile(r"^利用回数：(?P<count>\d+)回まで$")),
    ("duplicates", re.compile(r"^アイドルフォトが重複した場合、該当する「(?P<item>.+?)」に変換されます$")),
]
PRICE = re.compile(r"(有償)?スタージェム(\d+)個（(\d+)回引く）")


def page_facts(sections: list[dict]) -> tuple[list[dict], int, int]:
    facts, matched, total = [], 0, 0
    for section in sections:
        heading = section["heading"]
        if heading in ("開催期間", "新登場アイドルフォト") or EXCHANGE_HEADING.match(heading):
            continue
        for line in section["lines"]:
            total += 1
            if line.startswith("価格："):
                prices = [{"paid_only": bool(m[0]), "jewels": int(m[1]), "draws": int(m[2])} for m in PRICE.findall(line)]
                if prices:
                    facts.append({"kind": "price", "section": heading, "prices": prices, "line": line})
                    matched += 1
                continue
            for kind, pattern in FACTS:
                match = pattern.match(line)
                if match:
                    facts.append({"kind": kind, "section": heading, **{k: v for k, v in match.groupdict().items() if v}, "line": line})
                    matched += 1
                    break
    return facts, matched, total


def content_html(raw: bytes) -> str:
    text = raw.decode("utf-8")
    start, end = text.index('<div id="content"'), text.index('<div id="main-contents-bottom"')
    text = text[start:end]
    # Struck-out text is a superseded value (a period extended after publication), not part of the record.
    text = re.sub(r"<(del|s)\b.*?</\1>", "", text, flags=re.S)
    return re.sub(r'<div id="pc-caption-ad-container".*?</div>', "", text, flags=re.S)


def sections(html: str) -> list[dict]:
    parts = re.split(r"(<h([234])[^>]*>.*?</h\2>)", html, flags=re.S)
    result = [{"level": 0, "heading": "", "lines": acquisition.text_lines(parts[0].encode())}]
    for i in range(1, len(parts), 3):
        heading = " ".join(acquisition.text_lines(parts[i].encode()))
        result.append({"level": int(parts[i + 1]), "heading": heading, "lines": acquisition.text_lines(parts[i + 2].encode())})
    return [section for section in result if section["heading"] or section["lines"]]


def banner(html: str) -> dict | None:
    # The page's own header image (bannar.jpg / banner.png); card images follow it.
    for src, alt, width, height in re.findall(r'<img src="([^"]+)" alt="([^"]*)"[^>]*width="(\d+)" height="(\d+)"', html):
        if re.match(r"^bann?ar\.", alt, re.I) or alt.lower().startswith("banner"):
            return {"file": alt, "url": htmllib.unescape(src).split("?")[0], "width": int(width), "height": int(height)}
    return None


def page_period(line: str) -> dict:
    # One rerun line gives only the start date ("2023/2/11 ～ 2023/2/12 23:59"); keep the day and say so.
    match = re.match(r"^(\d{4}/\d{1,2}/\d{1,2})(\s*[～~].*)$", line)
    if match:
        start, end = acquisition.period(f"{match.group(1)} 00:00{match.group(2)}")
        return {"start_at": start, "end_at": end, "start_time_missing": True}
    start, end = acquisition.period(line)
    return {"start_at": start, "end_at": end}


def page_links(html_dir: Path) -> list[tuple[str, str, str]]:
    links = []
    for key in acquisition.NOTICE_PAGES:
        text = (html_dir / f"{key}.html").read_text(encoding="utf-8")
        links += [(key, urllib.parse.unquote(href), htmllib.unescape(label)) for href, label in LINK.findall(text)]
    return links


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--html-dir", type=Path, required=True)
    parser.add_argument("--checked-at", default=datetime.now(acquisition.JST).strftime("%Y-%m-%d"))
    parser.add_argument("--delay", type=float, default=6.0)
    args = parser.parse_args()
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    cards = acquisition.Cards()

    # Each named pool's dated heading in the notice log carries the link to its page.
    links = page_links(args.html_dir)
    pages: dict[str, dict] = {}
    unlinked: list[str] = []
    conflicts: list[dict] = []
    coverage = [0, 0]
    for pool in evidence["gasha_pools"]:
        if not pool["named"]:
            continue
        label = re.sub(r"^\d{1,2}/\d{1,2}\s*", "", pool["heading"])
        hits = sorted({title for source, title, text in links if source == pool["source"] and text.strip() == label.strip()})
        assert len(hits) <= 1, f"{pool['heading']}: {len(hits)} page links"
        if not hits:
            # A notice heading without a link has no page of its own (the 2023 プラチナガシャ renewal).
            unlinked.append(pool["heading"])
            continue
        page = pages.setdefault(hits[0], {"title": hits[0], "pools": []})
        page["pools"].append({"source": pool["source"], "heading": pool["heading"], "start_at": pool["start_at"],
                              "announcement_id": pool["announcement_id"], "ticket_group_ids": pool["ticket_group_ids"]})

    for index, page in enumerate(sorted(pages.values(), key=lambda p: p["pools"][0]["start_at"])):
        page["key"] = f"gasha_{hashlib.sha256(page['title'].encode()).hexdigest()[:12]}"
        raw = acquisition.fetch(page["title"], args.html_dir / f"{page['key']}.html", args.delay)
        html = content_html(raw)
        modified = re.search(r"Last-modified:\s*(\d{4}-\d{2}-\d{2})", raw.decode("utf-8"))
        page.update(url=acquisition.page_url(page["title"]), html_sha256=hashlib.sha256(raw).hexdigest(),
                    last_modified=modified.group(1) if modified else None, banner=banner(html), sections=sections(html))
        periods = next((s["lines"] for s in page["sections"] if s["heading"] == "開催期間"), [])
        page["periods"] = [page_period(line) for line in periods if re.match(r"^\d{4}/\d", line)]
        assert page["periods"], f"{page['title']}: no period"
        # Every pool linked here opened on the day of one of the page's periods (reruns share the page). Where the
        # notice log and the page disagree on the hour, both are kept and the difference is recorded, not resolved.
        day = lambda ts: datetime.fromtimestamp(ts, acquisition.JST).date()
        for pool in page["pools"]:
            same_day = [p for p in page["periods"] if day(p["start_at"]) == day(pool["start_at"])]
            assert same_day, f"{page['title']}: {pool['heading']} not in its periods"
            if all(p["start_at"] != pool["start_at"] and not p.get("start_time_missing") for p in same_day):
                conflicts.append({"page": page["title"], "pool": pool["heading"], "notice_start_at": pool["start_at"], "page_start_at": same_day[0]["start_at"]})
        page["facts"], matched, total = page_facts(page["sections"])
        coverage[0] += matched
        coverage[1] += total
        page["steps"] = [{"step": int(m[1]), "paid_only": bool(m[2]), "jewels": int(m[3]), "draws": int(m[4])}
                         for s in page["sections"] for m in map(STEP.match, s["lines"]) if m]
        page["exchanges"] = []
        for section in page["sections"]:
            heading = EXCHANGE_HEADING.match(section["heading"])
            if not heading or section["level"] < 4 and not any(CARD.match(line) for line in section["lines"]):
                continue
            rows, pending = [], None
            for line in section["lines"]:
                card = CARD.match(line)
                if card:
                    assert pending is None, f"{page['title']}: card without a cost before {line}"
                    pending = cards.resolve(card.group(1), card.group(3), card.group(4))
                elif pending and re.fullmatch(r"\d+", line):
                    rows.append({"resource_id": pending, "cost": int(line)})
                    pending = None
            assert pending is None and rows, f"{page['title']}: unreadable exchange table {section['heading']}"
            until = heading.group(2)
            # A heading may give two deadlines (a rerun's exchange: "A まで・B まで"); keep each.
            deadlines = [acquisition.jst(part) for part in re.split(r"まで・", until)] if until else []
            page["exchanges"].append({"heading": section["heading"], "currency": "メモリースター" if heading.group(1) == "メモリースター交換" else heading.group(1).removesuffix("交換"),
                                      "until_at": deadlines, "rows": rows})

    result = {
        "schema_version": 1,
        "checked_at": args.checked_at,
        "source_label": evidence["source_label"],
        "pages": sorted(pages.values(), key=lambda p: p["pools"][0]["start_at"]),
        "summary": {
            "pages": len(pages),
            "pools": sum(len(p["pools"]) for p in pages.values()),
            "with_banner": sum(1 for p in pages.values() if p["banner"]),
            "with_exchange": sum(1 for p in pages.values() if p["exchanges"]),
            "with_steps": sum(1 for p in pages.values() if p["steps"]),
            "rule_lines": coverage[1],
            "rule_lines_read_as_facts": coverage[0],
            "named_pools_without_page": unlinked,
        },
        "period_conflicts": conflicts,
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
