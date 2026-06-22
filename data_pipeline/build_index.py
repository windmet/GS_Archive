"""
Build hierarchical scenario index from compiled JSON files.
Includes event metadata injection and Episode Zero unit grouping.

Outputs lean index.json for frontend navigation.
"""

import json
import os
import re

COMPILED_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..",
    "web_viewer", "public", "data", "compiled"
))
INDEX_PATH = os.path.join(COMPILED_DIR, "index.json")
EXCLUDE = {"manifest.json", "voice_index.json", "index.json"}

# ── Task 2C: Episode Zero Unit Mapping ────────────────────────────
UNIT_MAP = {
    "001jup": "Jupiter",
    "002dra": "DRAMATIC STARS",
    "003alt": "Altessimo",
    "004bei": "Beit",
    "005w00": "W",
    "006fra": "FRAME",
    "007sai": "彩",
    "008hig": "High×Joker",
    "009shi": "神速一魂",
    "010caf": "Café Parade",
    "011mof": "もふもふえん",
    "012sem": "S.E.M",
    "013the": "THE 虎牙道",
    "014fla": "F-LAGS",
    "015leg": "Legenders",
    "016cfi": "C.FIRST",
}

# ── Extra Story Grouping ────────────────────────────────────────
# Maps compiled filename patterns → (group_key, group_title)
EXTRA_GROUP_RULES = [
    (re.compile(r'^5_00_000_22'),              "newyear_2022",   "謹賀新年2022"),
    (re.compile(r'^5_00_\d+_23'),               "newyear_2023",   "謹賀新年2023"),
    (re.compile(r'^5_0[12]_\d+_22'),            "valentine_2022", "バレンタイン2022"),
    (re.compile(r'^5_01_\d+_23'),               "valentine_2023", "バレンタイン2023"),
    (re.compile(r'^5_02_\d+_23'),               "whiteday_2023",  "ホワイトデー2023"),
    (re.compile(r'^5_03_'),                     "event_new_member", "新たなるメンバー？"),
    (re.compile(r'^5_04_'),                     "sports_festival", "運動会"),
    (re.compile(r'^5_05_001'),                  "fes_night",       "GROWING FES -夜陰のルミネセンス-"),
    (re.compile(r'^5_05_002'),                  "fes_astrology",   "GROWING FES -終夜のアストロロジー-"),
    (re.compile(r'^5_05_003'),                  "fes_glorious",    "GROWING FES -窮月のグロリアスナイト-"),
    (re.compile(r'^5_05_004'),                  "fes_portrait",    "GROWING FES -光彩のポートレート-"),
    (re.compile(r'^5_06_'),                     "anniversary_1st", "1st Anniversary"),
    (re.compile(r'^1_x_101ken'),                "producer_ken",    "山村賢"),
    (re.compile(r'^3_x_102sha'),                "president",       "齋藤社長"),
    (re.compile(r'^4_x_101ken'),                "login_bonus",     "ログインボーナス"),
    (re.compile(r'^7\)'),                       "link_chat",       "LINKチャット"),
]


def compute_extra_group(parent: str) -> tuple[str, str]:
    """Returns (group_key, group_title) for extra-category files."""
    for pattern, gkey, gtitle in EXTRA_GROUP_RULES:
        if pattern.match(parent):
            return gkey, gtitle
    # Fallback: use parent as-is (individual group)
    return parent, parent


# ── Task 2B: Event Metadata ──────────────────────────────────────
# GROWING SIGN@L (10001–10018)
SIGNAL_EVENTS = {
    10001: {"title": "Not Alone", "catchphrase": "世界を変えるユニット"},
    10002: {"title": "Plus 1 Good Day!", "catchphrase": "届け、エール！"},
    10003: {"title": "Pavé Étoiles", "catchphrase": "円環に導かれる先に"},
    10004: {"title": "Time Before Time", "catchphrase": "Legendersのデートプラン"},
    10005: {"title": "いとをかし！～一彩×合彩～", "catchphrase": "結んで・解いて"},
    10006: {"title": "はるかぜバトン", "catchphrase": "ぼくらの向こうへ"},
    10007: {"title": "Infinite Octave!", "catchphrase": "心が望むままに"},
    10008: {"title": "K.now O.nly", "catchphrase": "漢たちの熱い戦い"},
    10009: {"title": "Made in「 ♪ 」", "catchphrase": "新たなる挑戦へ！"},
    10010: {"title": "ROUTE77", "catchphrase": "かっとばす漢たち"},
    10011: {"title": "Inner Dignity", "catchphrase": "前に立つ背中"},
    10012: {"title": "Multiple Entertainment Show!", "catchphrase": "Life is beautiful！"},
    10013: {"title": "Change to Chance", "catchphrase": "選んできた道の先に"},
    10014: {"title": "VIVA!!ファミリーリズム", "catchphrase": "カッコいいお兄ちゃんのススメ"},
    10015: {"title": "Platinum MASK", "catchphrase": "Get drunk on us."},
    10016: {"title": "JOYFUL HEART MAKER", "catchphrase": "青春真っ只中！"},
    10017: {"title": "GROWING SIGN@L", "catchphrase": ""},
    10018: {"title": "GROWING SIGN@L", "catchphrase": ""},
}

# GROWING SELECTION (30001–30018)
SELECTION_EVENTS = {
    30001: {"title": "想いはETERNITY", "catchphrase": "笑顔の花を咲かせて"},
    30002: {"title": "Study Equal Magic!", "catchphrase": "返ってきたノート"},
    30003: {"title": "OUR SONG -それは世界でひとつだけ-", "catchphrase": "本気の想い"},
    30004: {"title": "LEADING YOUR DREAM", "catchphrase": "新しい世界"},
    30005: {"title": "MOON NIGHTのせいにして", "catchphrase": "かじかむ夜を溶かす月"},
    30006: {"title": "ANYWHERE", "catchphrase": "撮影の裏側の裏側"},
    30007: {"title": "RED HOT BEAT!!", "catchphrase": "熱き5人の挑戦！"},
    30008: {"title": "リトルハピネス", "catchphrase": "それぞれのいいところ"},
    30009: {"title": "Swing Your Leaves", "catchphrase": "Being there for you."},
    30010: {"title": "String of Fate", "catchphrase": "時とともに、心にも"},
    30011: {"title": "祝彩！", "catchphrase": "繋がる想い、繋げる想い"},
    30012: {"title": "はんどめいど・きみはーと！", "catchphrase": "はんどめいど・きみはーと！"},
    30013: {"title": "Reversed Masquerade", "catchphrase": "Petit à petit l'oiseau fait son nid."},
    30014: {"title": "PROOF OF ONESELF", "catchphrase": "新たな情熱"},
    30015: {"title": "Tone's Destiny", "catchphrase": "わたしたちが歌う理由"},
    30016: {"title": "GROWING SELECTION", "catchphrase": ""},
    30017: {"title": "GROWING SELECTION", "catchphrase": ""},
    30018: {"title": "GROWING SELECTION", "catchphrase": ""},
}

ALL_EVENTS = {**SIGNAL_EVENTS, **SELECTION_EVENTS}


def get_event_meta(event_num: int) -> dict:
    """Return event metadata with series name."""
    meta = ALL_EVENTS.get(event_num, {})
    series = "GROWING SIGN@L" if event_num <= 10018 else "GROWING SELECTION"
    return {
        "series": series,
        "title": meta.get("title", ""),
        "catchphrase": meta.get("catchphrase", ""),
        "logo": f"/assets/events/logos/image_event_logo_{event_num}.png",
    }


# ── Category mapping ──────────────────────────────────────────────
CATEGORY_MAP = [
    (re.compile(r'^\d{3}[a-z]{3}_'), "idol"),
    (re.compile(r'^1_2_'), "idol"),
    (re.compile(r'^1_5_'), "idol"),
    (re.compile(r'^1_x_'), "idol"),
    (re.compile(r'^3_x_'), "idol"),
    (re.compile(r'^8_1_'), "idol_chat"),
    (re.compile(r'^8_2_'), "idol_chat"),
    (re.compile(r'^1_4_'), "main_story"),
    (re.compile(r'^1_3_'), "event"),
]
DEFAULT_CATEGORY = "extra"


def parse_compiled_filename(fn: str):
    """Returns (parent, scenario_id). Handles merged and standalone names."""
    name = fn[:-5] if fn.endswith(".json") else fn
    idx = name.find("_scenario_")
    if idx == -1:
        # Merged file or unknown — name is both parent and id
        return name, name
    parent = name[:idx]
    sid = name[idx + len("_scenario_"):]
    return parent, sid


def categorize(parent: str | None) -> str:
    if parent is None:
        return DEFAULT_CATEGORY
    for pattern, cat in CATEGORY_MAP:
        if pattern.match(parent):
            return cat
    return DEFAULT_CATEGORY


def extract_chara_id(parent: str) -> str | None:
    m = re.search(r'(\d{3}[a-z0-9]{3})', parent)
    return m.group(1) if m else None


def is_idol_id(cid: str) -> bool:
    m = re.match(r'^(\d{3})', cid)
    if m:
        num = int(m.group(1))
        return 1 <= num <= 49
    return False


def is_chat_file(steps: list) -> bool:
    """Check if file content is SMS/chat (only talk/choice steps, no adv/call)."""
    if not steps:
        return False
    for step in steps:
        t = step.get("type", "")
        if t not in ("talk", "choice"):
            return False
    return True


def extract_unit_code(parent: str) -> str | None:
    """For 1_1_xxx files, extract the unit code (e.g. 001jup)."""
    m = re.search(r'1_1_(\d{3}[a-z0-9]{3})', parent)
    return m.group(1) if m else None


def compute_group_key(parent: str, cat: str) -> str:
    if cat == "main_story" and parent:
        parts = parent.split("_")
        if len(parts) >= 3:
            return "_".join(parts[:3])
    return parent


def derive_title(steps: list, fallback: str) -> str:
    for step in steps:
        if step.get("type") == "title":
            parts = []
            if step.get("dialogue", {}).get("speaker"):
                parts.append(step["dialogue"]["speaker"])
            if step.get("dialogue", {}).get("text"):
                parts.append(step["dialogue"]["text"])
            if parts:
                return " - ".join(parts)
    for step in steps:
        d = step.get("dialogue", {})
        if d.get("text"):
            return d["text"][:80].replace("\n", " ").strip()
    return fallback


def build_index():
    files_list = sorted(
        f for f in os.listdir(COMPILED_DIR)
        if f.endswith(".json") and f not in EXCLUDE
    )

    characters: dict[str, str] = {}
    main_groups: dict[str, dict] = {}
    event_groups: dict[str, dict] = {}
    idol_chars: dict[str, dict] = {}
    chat_chars: dict[str, dict] = {}      # 8_1_x individual chat → by chara_id
    chat_groups_by_unit: dict[str, dict] = {}  # 8_2_x group chat → by unit_code
    phone_chars: dict[str, dict] = {}     # phone call (1_x_..._1_8_ etc.) → by chara_id
    episode_zero_units: dict[str, dict] = {}  # unit_code → {name, episodes: [...]}
    extra_groups: dict[str, dict] = {}

    total = len(files_list)
    for i, fn in enumerate(files_list):
        if (i + 1) % 500 == 0:
            print(f"  [{i+1}/{total}]")

        parent, scenario_id = parse_compiled_filename(fn)
        cat = categorize(parent)
        chara_id = extract_chara_id(parent) if parent else None

        # Non-idol chars → extra
        if cat == "idol" and chara_id and not is_idol_id(chara_id):
            cat = DEFAULT_CATEGORY

        # Episode Zero detection (1_1_xxx prefix)
        unit_code = extract_unit_code(parent) if parent else None

        try:
            with open(os.path.join(COMPILED_DIR, fn), "r", encoding="utf-8") as f:
                data = json.load(f)
            steps = data.get("steps", [])
        except Exception:
            steps = []

        # Build character map
        for step in steps:
            d = step.get("dialogue", {})
            sp = d.get("speaker", "")
            cid = step.get("chara_id") or ""
            if cid and sp and cid not in characters:
                characters[cid] = sp.replace(" ", " ")

        if cat == "main_story":
            gk = compute_group_key(parent, cat)
            g = main_groups.setdefault(gk, {"id": gk, "files": [], "_snip": []})
            g["files"].append(fn)
            if not g["_snip"] and steps:
                g["_snip"] = steps[:5]

        elif cat == "event":
            gk = parent
            g = event_groups.setdefault(gk, {"id": gk, "files": [], "_snip": []})
            g["files"].append(fn)
            if not g["_snip"] and steps:
                g["_snip"] = steps[:5]

        elif cat == "idol":
            # Detect phone calls by step content (type: "call")
            is_phone_call = any(step.get("type") == "call" for step in steps)
            if is_phone_call:
                cid = chara_id or "unknown"
                if cid not in phone_chars:
                    phone_chars[cid] = {"groups": {}}
                gk = parent
                g = phone_chars[cid]["groups"].setdefault(gk, {"id": gk, "files": [], "_snip": []})
                g["files"].append(fn)
                if not g["_snip"] and steps:
                    g["_snip"] = steps[:5]
            elif is_chat_file(steps):
                # SMS chat (all steps are talk/choice) → idol_chat
                cid = chara_id or "unknown"
                if cid not in chat_chars:
                    chat_chars[cid] = {"groups": {}}
                gk = parent
                g = chat_chars[cid]["groups"].setdefault(gk, {"id": gk, "files": [], "_snip": []})
                g["files"].append(fn)
                if not g["_snip"] and steps:
                    g["_snip"] = steps[:5]
            else:
                cid = chara_id or "unknown"
                if cid not in idol_chars:
                    idol_chars[cid] = {"groups": {}}
                gk = parent
                g = idol_chars[cid]["groups"].setdefault(gk, {"id": gk, "files": [], "_snip": []})
                g["files"].append(fn)
                if not g["_snip"] and steps:
                    g["_snip"] = steps[:5]

        elif cat == "idol_chat":
            if parent and parent.startswith("8_2_"):
                # Group chat — key by unit code extracted from parent
                uc = extract_chara_id(parent) or "unknown"
                if uc not in chat_groups_by_unit:
                    chat_groups_by_unit[uc] = {"unit_code": uc, "groups": {}}
                gk = parent
                g = chat_groups_by_unit[uc]["groups"].setdefault(gk, {"id": gk, "files": [], "_snip": []})
                g["files"].append(fn)
                if not g["_snip"] and steps:
                    g["_snip"] = steps[:5]
            else:
                # Individual chat — key by chara_id
                cid = chara_id or "unknown"
                if cid not in chat_chars:
                    chat_chars[cid] = {"groups": {}}
                gk = parent
                g = chat_chars[cid]["groups"].setdefault(gk, {"id": gk, "files": [], "_snip": []})
                g["files"].append(fn)
                if not g["_snip"] and steps:
                    g["_snip"] = steps[:5]

        elif cat == "phone":
            cid = chara_id or "unknown"
            if cid not in phone_chars:
                phone_chars[cid] = {"groups": {}}
            gk = parent
            g = phone_chars[cid]["groups"].setdefault(gk, {"id": gk, "files": [], "_snip": []})
            g["files"].append(fn)
            if not g["_snip"] and steps:
                g["_snip"] = steps[:5]

        elif unit_code and unit_code in UNIT_MAP:
            # Episode Zero — group by unit
            if unit_code not in episode_zero_units:
                episode_zero_units[unit_code] = {
                    "unit_name": UNIT_MAP[unit_code],
                    "episodes": [],
                }
            ep = {"id": parent, "files": [fn], "_snip": steps[:5] if steps else []}
            episode_zero_units[unit_code]["episodes"].append(ep)

        else:  # extra
            gk, gtitle = compute_extra_group(parent or "unknown")
            g = extra_groups.setdefault(gk, {"id": gk, "files": [], "_snip": [], "_title_override": gtitle})
            g["files"].append(fn)
            if not g["_snip"] and steps:
                g["_snip"] = steps[:5]

    print(f"  [{total}/{total}] Done — building output…")

    def finalize(g: dict) -> dict:
        # Use title override if set (from extra grouping rules)
        override = g.pop("_title_override", None)
        snip = g.pop("_snip", [])
        if override and override != g["id"]:
            g["title"] = override
        else:
            g["title"] = derive_title(snip, g["id"])
        return g

    # Sort within groups
    for groups_dict in [main_groups, event_groups, extra_groups]:
        for g in groups_dict.values():
            g["files"].sort()
    for cid in idol_chars:
        for g in idol_chars[cid]["groups"].values():
            g["files"].sort()
    for cid in chat_chars:
        for g in chat_chars[cid]["groups"].values():
            g["files"].sort()
    for cid in phone_chars:
        for g in phone_chars[cid]["groups"].values():
            g["files"].sort()
    for uc in chat_groups_by_unit:
        for g in chat_groups_by_unit[uc]["groups"].values():
            g["files"].sort()
    for uc in episode_zero_units:
        episode_zero_units[uc]["episodes"].sort(key=lambda e: e["id"])

    # Build categories
    main_category = {
        "id": "main_story",
        "name": "主线剧情",
        "groups": sorted(
            [finalize(g) for g in main_groups.values()],
            key=lambda g: g["id"],
        ),
    }

    # Event category with metadata
    event_list = []
    for g in sorted(event_groups.values(), key=lambda g: g["id"]):
        eg = finalize(g)
        # Extract event number from group ID: 1_3_{number}_01
        parts = g["id"].split("_")
        event_num = None
        if len(parts) >= 3 and parts[0] == "1" and parts[1] == "3":
            try:
                event_num = int(parts[2])
            except ValueError:
                pass
        if event_num:
            eg["event_meta"] = get_event_meta(event_num)
        event_list.append(eg)

    event_category = {
        "id": "event",
        "name": "活动剧情",
        "groups": event_list,
    }

    idol_category = {
        "id": "idol",
        "name": "偶像个人",
        "characters": {},
    }
    for cid in sorted(idol_chars.keys()):
        char_name = characters.get(cid, cid)
        groups = [finalize(g) for g in idol_chars[cid]["groups"].values()]
        groups.sort(key=lambda g: g["id"])
        idol_category["characters"][cid] = {
            "name": char_name,
            "groups": groups,
        }

    # Chat (短信) category
    chat_category = {
        "id": "idol_chat",
        "name": "短信聊天",
        "individual": {},   # 8_1_x individual chat → by chara_id
        "groups": [],       # 8_2_x group chat → flat list by unit
    }
    for cid in sorted(chat_chars.keys()):
        if cid == "unknown":  # skip unclassified entries
            continue
        char_name = characters.get(cid, cid)
        groups = [finalize(g) for g in chat_chars[cid]["groups"].values()]
        groups.sort(key=lambda g: g["id"])
        chat_category["individual"][cid] = {
            "name": char_name,
            "groups": groups,
        }
    # Group chats (8_2_x) → flat list under "group_chats"
    for uc in sorted(chat_groups_by_unit.keys()):
        unit_name = UNIT_MAP.get(uc, uc)
        groups = [finalize(g) for g in chat_groups_by_unit[uc]["groups"].values()]
        groups.sort(key=lambda g: g["id"])
        chat_category["groups"].append({
            "unit_code": uc,
            "unit_name": unit_name,
            "groups": groups,
        })

    # Episode Zero category

    # Phone call category
    phone_category = {
        "id": "idol_phone",
        "name": "电话聊天",
        "individual": {},
    }
    for cid in sorted(phone_chars.keys()):
        if cid == "unknown":
            continue
        char_name = characters.get(cid, cid)
        groups = [finalize(g) for g in phone_chars[cid]["groups"].values()]
        groups.sort(key=lambda g: g["id"])
        phone_category["individual"][cid] = {
            "name": char_name,
            "groups": groups,
        }

    # Episode Zero category
    episode_zero_category = {
        "id": "episode_zero",
        "name": "第零话",
        "units": [],
    }
    for uc in sorted(episode_zero_units.keys()):
        u = episode_zero_units[uc]
        episodes = []
        for ep in u["episodes"]:
            episodes.append({
                "id": ep["id"],
                "title": derive_title(ep["_snip"], ep["id"]),
                "files": ep["files"],
            })
        episode_zero_category["units"].append({
            "unit_code": uc,
            "unit_name": u["unit_name"],
            "episodes": episodes,
        })

    extra_category = {
        "id": "extra",
        "name": "额外剧情",
        "groups": sorted(
            [finalize(g) for g in extra_groups.values()],
            key=lambda g: g["id"],
        ),
    }

    output = {
        "characters": dict(sorted(characters.items())),
        "categories": [main_category, event_category, idol_category, chat_category, phone_category, episode_zero_category, extra_category],
    }

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(INDEX_PATH) / 1024
    print(f"\nIndex: {INDEX_PATH} ({size_kb:.1f} KB)")
    print(f"  Characters: {len(characters)}")
    print(f"  Main story chapters: {len(main_groups)}")
    print(f"  Event groups: {len(event_groups)}")
    print(f"  Idol characters: {len(idol_chars)}")
    print(f"  Chat entries: {len(chat_chars)} individual + {len(chat_groups_by_unit)} groups")
    print(f"  Phone entries: {len(phone_chars)}")
    print(f"  Episode Zero units: {len(episode_zero_units)}")
    print(f"  Extra groups: {len(extra_groups)}")


if __name__ == "__main__":
    build_index()
