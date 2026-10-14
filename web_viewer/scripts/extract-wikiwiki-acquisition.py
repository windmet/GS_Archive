#!/usr/bin/env python3
"""Confirm how cards were obtained, from the community wiki (wikiwiki.jp/sidem-gstars).

The client masterdata keeps gasha announcements (table 173) but not the server's GashaData, so pickup
cards were derived from LimitbreakItemId plus an exact start time; it keeps THEATER/TOUR point and story
rewards but not event missions or 315 CARNIVAL exchanges. The wiki's notice log lists every gasha's period
and new cards, its event list names each event's limited reward cards, and campaign notices name mission
reward cards. This script reads those pages (cached under --html-dir, fetched politely when missing),
resolves every card to a resource_id by exact title and idol name, links each gasha to its announcement or
ticket-only pool, and writes public/data/editorial/wiki-acquisition-evidence.json. Every row keeps its wiki
lines, and any card, pool or event that does not resolve uniquely stops the run.

  python scripts/extract-wikiwiki-acquisition.py --html-dir <cache dir> [--checked-at 2026-10-14]
"""
from __future__ import annotations

import argparse
import hashlib
import html as htmllib
import json
import re
import subprocess
import time
import unicodedata
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
OUTPUT = DATA / "editorial" / "wiki-acquisition-evidence.json"
WIKI = "https://wikiwiki.jp/sidem-gstars/"
JST = timezone(timedelta(hours=9))
NOTICE_PAGES = {
    "notices_2021": "過去のお知らせ/2021年",
    "notices_2022_h1": "過去のお知らせ/2022年前半",
    "notices_2022_h2": "過去のお知らせ/2022年後半",
    "notices_2023": "過去のお知らせ",
}
EVENTS_PAGE = ("past_events", "過去のイベント")
# The wiki abbreviates one idol's name; every other name matches the idol dictionary after removing spaces.
IDOL_ALIASES = {"アスラン=BBⅡ世": "アスラン＝ベルゼビュートⅡ世"}
# Wiki gasha titles whose draw tickets carry a different pool name.
TICKET_ALIASES = {
    "アイドルマスター SideM 8周年記念！タイプ別ガシャ": [
        "アイドルマスター SideM 8周年記念！フィジカルガシャ",
        "アイドルマスター SideM 8周年記念！インテリガシャ",
        "アイドルマスター SideM 8周年記念！メンタルガシャ",
    ],
    "リリース記念SSR確定10連ガシャ": ["SSR確定10連ガシャ"],
}
CARD_LINE = re.compile(r"^(SSR|SR|R|N)(\+?)【(.+?)】\s*(.+?)(?:\s+(?:期間限定|フェス限定))?\s*$")
SERIES_COUNT = re.compile(r"^フォト(\d+)種類$")
SECTION_HEADINGS = {"ストーリー", "イベント", "ログインボーナス・プレゼント", "ショップ", "アップデート", "その他", "キャンペーン"}


def page_url(title: str) -> str:
    return WIKI + urllib.parse.quote(title)


def fetch(title: str, path: Path, delay: float) -> bytes:
    if path.exists() and path.stat().st_size > 20000:
        return path.read_bytes()
    for attempt in range(4):
        time.sleep(delay * (attempt + 1))
        result = subprocess.run(["curl", "-s", "-m", "60", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code}", page_url(title)],
                                capture_output=True, text=True)
        if result.stdout == "200" and path.stat().st_size > 20000:
            return path.read_bytes()
    raise SystemExit(f"could not fetch {title} (last status {result.stdout})")


def text_lines(raw: bytes) -> list[str]:
    text = raw.decode("utf-8")
    text = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"</(p|li|tr|h\d|div|td|th)>", "\n", text)
    text = htmllib.unescape(re.sub(r"<[^>]+>", "", text))
    return [line.strip() for line in text.split("\n") if line.strip()]


def jst(text: str) -> int:
    match = re.match(r"(\d{4})/(\d{1,2})/(\d{1,2})\s*(\d{1,2}):(\d{2})", text)
    assert match, text
    return int(datetime(*map(int, match.groups()), tzinfo=JST).timestamp())


def period(line: str) -> tuple[int, int | None]:
    parts = re.split(r"\s*[～~]\s*", line)
    start = jst(parts[0])
    end_text = parts[1] if len(parts) > 1 else ""
    if end_text and not re.match(r"^\d{4}/", end_text):
        end_text = f"{datetime.fromtimestamp(start, JST).year}/{end_text}"
    return start, (jst(end_text) if re.match(r"^\d{4}/\d", end_text) else None)


def pool_name(text: str) -> str:
    text = re.sub(r"^(?:SSR確定[！!]?|SR以上確定)\s*", "", text.strip())
    return unicodedata.normalize("NFKC", text).lower().replace(" ", "").replace("～", "").replace("~", "")


class Cards:
    def __init__(self) -> None:
        cards = [card for card in json.loads((DATA / "masterdata" / "card_index.json").read_text(encoding="utf-8"))["cards"]
                 if not str(card["card_id"]).startswith("9")]
        idols = {idol["idol_code"]: idol["display_name"] for idol in
                 json.loads((DATA / "masterdata" / "idol_unit_dictionary.json").read_text(encoding="utf-8"))["idols"]}
        self.by_id = {card["resource_id"]: card for card in cards}
        self.idols = idols
        self.by_name: dict[tuple[str, str, str], list[dict]] = {}
        for card in cards:
            self.by_name.setdefault((card["rarity"], self.norm(card["title"]), self.norm(idols[card["character_id"]])), []).append(card)
        self.series = {}
        for card in cards:
            series = card.get("release_series")
            if series and series["release_at"] > 946652400:
                self.series.setdefault(series["series_id"], {"title": series["title"], "release_at": series["release_at"], "cards": []})["cards"].append(card["resource_id"])

    @staticmethod
    def norm(text: str) -> str:
        text = IDOL_ALIASES.get(text.strip(), text.strip())
        return re.sub(r"\s", "", text).replace("＝", "=")

    def resolve(self, rarity: str, title: str, idol: str) -> str:
        hits = self.by_name.get((rarity, self.norm(title), self.norm(idol)), [])
        assert len(hits) == 1, f"wiki card does not resolve uniquely: {rarity}【{title}】{idol} -> {len(hits)}"
        return hits[0]["resource_id"]


def parse_gashas(key: str, lines: list[str], cards: Cards) -> list[dict]:
    pools = []
    for start in (i for i, line in enumerate(lines) if line == "詳細は各ガシャページを参照"):
        current = None
        for line in lines[start + 1:]:
            if line in SECTION_HEADINGS:
                break
            # Named pools carry 【ガシャ】; a few ticket pools (SSR確定10連ガシャ) are listed by name alone.
            heading = re.match(r"^(\d{1,2})/(\d{1,2})\s*(【ガシャ】.*|.*ガシャ.*)$", line)
            if heading:
                text = heading.group(3)
                title = re.sub(r"^.*?「(.*)」.*$", r"\1", text) if "「" in text else re.sub(r"（復刻）$", "", text).strip()
                current = {"source": key, "heading": line, "title": title, "named": text.startswith("【ガシャ】"),
                           "is_reprint": "【再】" in text or text.endswith("（復刻）"),
                           "start_at": None, "end_at": None, "cards": [], "series": None, "lines": [line]}
                pools.append(current)
                continue
            if current is None:
                continue
            current["lines"].append(line)
            if current["start_at"] is None and re.match(r"^\d{4}/\d", line):
                current["start_at"], current["end_at"] = period(line)
            card = CARD_LINE.match(line)
            if not card:
                continue
            series = SERIES_COUNT.match(card.group(4))
            if card.group(2) == "+" and series:
                current["series"] = {"title": card.group(3), "count": int(series.group(1))}
            else:
                current["cards"].append({"resource_id": cards.resolve(card.group(1), card.group(3), card.group(4)),
                                         "limited": "期間限定" in line or "フェス限定" in line})
    assert all(pool["start_at"] for pool in pools), "a wiki gasha has no period"
    return pools


def parse_event_rewards(lines: list[str], cards: Cards) -> list[dict]:
    rows = []
    reward = re.compile(r"(SSR|SR|R|N)【(.+?)】(.+?)(?=(?:SSR|SR|R|N)【|$)")
    for index, line in enumerate(lines):
        year = re.match(r"^イベント一覧（(\d{4})年開始）$", line)
        if not year or lines[index + 1] != "#":
            continue
        i = index + 5
        while i + 3 < len(lines) and re.fullmatch(r"\d+", lines[i]):
            number, title, term, text = lines[i:i + 4]
            month, day = map(int, re.match(r"(\d{1,2})/(\d{1,2})", term).groups())
            rows.append({"number": int(number), "title": title, "term": term, "listed_year": int(year.group(1)),
                         "start_month_day": [month, day],
                         "cards": [{"resource_id": cards.resolve(m.group(1), m.group(2), m.group(3))} for m in reward.finditer(text)],
                         "lines": [number, title, term, text]})
            i += 4
    return rows


def card_mission(lines: list[str], resource_id: str, cards: Cards) -> dict:
    """The limited mission whose reward line names the card itself (not one of its fragments)."""
    card = cards.by_id[resource_id]
    found = []
    for i, line in enumerate(lines):
        match = re.match(r"^(?:達成報酬：)?【(.+?)】\s*(.+?)$", line)
        if match and cards.norm(match.group(1)) == cards.norm(card["title"]) and                 cards.norm(match.group(2)) == cards.norm(cards.idols[card["character_id"]]):
            heading = next(lines[j] for j in range(i, -1, -1) if re.match(r"^(\d{1,2}/\d{1,2}\s|期間限定ミッション$)", lines[j]))
            term = next((lines[j] for j in range(i, -1, -1) if re.match(r"^\d{4}/\d", lines[j])), "")
            found.append({"condition": lines[i - 1].removeprefix("達成報酬："), "heading": heading, "term": term})
    assert len(found) == 1, f"{resource_id}: expected one mission reward line, found {len(found)}"
    return found[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--html-dir", type=Path, required=True)
    parser.add_argument("--checked-at", default=datetime.now(JST).strftime("%Y-%m-%d"))
    parser.add_argument("--delay", type=float, default=6.0)
    args = parser.parse_args()
    args.html_dir.mkdir(parents=True, exist_ok=True)
    cards = Cards()
    sources = {}

    def page(key: str, title: str) -> list[str]:
        raw = fetch(title, args.html_dir / f"{key}.html", args.delay)
        sources[key] = {"title": title, "url": page_url(title), "html_sha256": hashlib.sha256(raw).hexdigest()}
        return text_lines(raw)

    gasha_index = json.loads((DATA / "masterdata" / "gasha_index.json").read_text(encoding="utf-8"))
    tickets = json.loads((DATA / "editorial" / "gasha-ticket-evidence.json").read_text(encoding="utf-8"))["rows"]
    pools = [pool for key, title in NOTICE_PAGES.items() for pool in parse_gashas(key, page(key, title), cards)]
    # An unnamed listing (the free tutorial draw) is kept only when a ticket pool names it.
    ticket_names = {pool_name(row["source_name"]) for row in tickets}
    pools = [pool for pool in pools if pool["named"] or any(
        pool_name(alias) in ticket_names for alias in TICKET_ALIASES.get(pool["title"], [pool["title"]]))]
    linked_announcements = set()
    for pool in pools:
        name = pool_name(pool["title"])
        announcements = [g for g in gasha_index["gashas"] if g["start_at"] == pool["start_at"] and pool_name(g["display_name"]) == name]
        assert len(announcements) <= 1, pool["heading"]
        pool["announcement_id"] = str(announcements[0]["id"]) if announcements else None
        names = {pool_name(alias) for alias in TICKET_ALIASES.get(pool["title"], [pool["title"]])}
        pool["ticket_group_ids"] = [row["id"] for row in tickets if not row["matched_ids"] and pool_name(row["source_name"]) in names]
        if pool["series"]:
            # The wiki names the SR+ series by its outfit ("NEXT DESTIN@TION" for NEXT DESTIN@TION!); a rerun offers it again later.
            label = pool_name(pool["series"]["title"])
            series = [s for s in cards.series.values() if pool_name(s["title"]).startswith(label) or label.startswith(pool_name(s["title"]))]
            assert len(series) == 1 and len(series[0]["cards"]) == pool["series"]["count"], pool["heading"]
            pool["series"].update(series_title=series[0]["title"], cards=sorted(series[0]["cards"]),
                                  rerun=series[0]["release_at"] != pool["start_at"])
        new_cards = [card["resource_id"] for card in pool["cards"]] + \
            ([] if not pool["series"] or pool["series"]["rerun"] else pool["series"]["cards"])
        if pool["announcement_id"]:
            linked_announcements.add(pool["announcement_id"])
            announcement = gasha_index["by_id"][pool["announcement_id"]]
            derived = {card["card_resource_id"] for card in announcement["derived_pickup_cards"]}
            offered = derived | set(announcement.get("related_pickup_card_ids") or [])
            assert set(new_cards) == derived or (not derived and set(pool["series"]["cards"] if pool["series"] else []) == offered), \
                f"{pool['heading']}: wiki and derived pickups differ"
        else:
            assert all(card not in gasha_index["relations_by_card"] for card in new_cards), pool["heading"]
            assert pool["ticket_group_ids"], f"{pool['heading']}: no announcement or ticket pool"
            for card in new_cards:
                assert cards.by_id[card]["release_at"] == pool["start_at"], f"{card} release differs from {pool['heading']}"
    unconfirmed = [g["code"] for g in gasha_index["gashas"] if g["phase"] == "primary" and str(g["id"]) not in linked_announcements]
    assert not unconfirmed, f"announcements without a wiki pool: {unconfirmed}"

    events_lines = page(*EVENTS_PAGE)
    event_index = json.loads((DATA / "masterdata" / "event_index.json").read_text(encoding="utf-8"))["by_code"]
    event_rewards = []
    for row in parse_event_rewards(events_lines, cards):
        month, day = row["start_month_day"]
        year = row["listed_year"] + (1 if row["listed_year"] == 2021 and month < 10 else 0)
        kind = "carnival" if row["title"].startswith("315カーニバル") else "theater" if row["title"].startswith("GROWING SIGN@L") else "tour"
        matches = [e for e in event_index.values() if (lambda d: (d.year, d.month, d.day) == (year, month, day))(datetime.fromtimestamp(e["start_at"], JST))
                   and e["event_type_label"] == kind and not e["name"].startswith("復刻")]
        assert len(matches) == 1, f"event {row['title']} {row['term']}: {len(matches)} matches"
        event = matches[0]
        reward_ids = set(event.get("reward_card_ids") or [])
        listed = {card["resource_id"] for card in row["cards"]}
        assert reward_ids <= listed, f"{row['title']}: reward table cards missing from the wiki list"
        row["event_code"] = event["event_code"]
        extra = [card for card in row["cards"] if card["resource_id"] not in reward_ids]
        if extra and event["event_type_label"] != "carnival":
            lines = page(f"event_{event['event_code']}", f"【イベント】「{row['title']}」")
            for card in extra:
                card["mission"] = card_mission(lines, card["resource_id"], cards)
                card["source"] = f"event_{event['event_code']}"
        for card in row["cards"]:
            card["in_reward_table"] = card["resource_id"] in reward_ids
        event_rewards.append(row)

    missions = []
    gasha_cards = {card for pool in pools for card in [c["resource_id"] for c in pool["cards"]] + (pool["series"] or {}).get("cards", [])}
    event_cards = {card["resource_id"] for row in event_rewards for card in row["cards"]}
    for key, title in NOTICE_PAGES.items():
        lines = text_lines((args.html_dir / f"{key}.html").read_bytes())
        for i, line in enumerate(lines):
            match = re.match(r"^達成報酬：【(.+?)】\s*(.+?)$", line)
            if not match:
                continue
            hits = [c for c in cards.by_name.get(("SR", cards.norm(match.group(1)), cards.norm(match.group(2))), [])]
            if len(hits) != 1 or hits[0]["resource_id"] in gasha_cards | event_cards:
                continue
            mission = card_mission(lines, hits[0]["resource_id"], cards)
            # The notice's own dated heading names the campaign; 期間限定ミッション is only its subsection.
            mission["heading"] = next(lines[j] for j in range(i, -1, -1) if re.match(r"^\d{1,2}/\d{1,2}\s", lines[j]))
            start, end = period(mission["term"])
            assert hits[0]["release_at"] == start, f"{hits[0]['resource_id']}: mission start differs from release"
            entry = next((m for m in missions if m["heading"] == mission["heading"]), None)
            if not entry:
                entry = {"source": key, "heading": mission["heading"], "title": re.sub(r"^\d{1,2}/\d{1,2}\s*", "", mission["heading"]),
                         "start_at": start, "end_at": end, "cards": []}
                missions.append(entry)
            entry["cards"].append({"resource_id": hits[0]["resource_id"], "condition": mission["condition"]})

    evidence = {
        "schema_version": 1,
        "checked_at": args.checked_at,
        "source_label": "アイドルマスターSideM GROWING STARS Wiki*（wikiwiki.jp）",
        "sources": sources,
        "gasha_pools": pools,
        "event_rewards": event_rewards,
        "missions": missions,
        "summary": {
            "gasha_pools": len(pools),
            "announcement_pools": sum(1 for p in pools if p["announcement_id"]),
            "ticket_pools": sum(1 for p in pools if not p["announcement_id"]),
            "gasha_cards": len(gasha_cards),
            "event_reward_rows": len(event_rewards),
            "event_reward_cards_outside_reward_table": sum(1 for r in event_rewards for c in r["cards"] if not c["in_reward_table"]),
            "mission_cards": sum(len(m["cards"]) for m in missions),
        },
    }
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(evidence["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
