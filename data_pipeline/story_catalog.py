"""Named story catalog projection from the decoded story-master intermediate.

Wire field interpretation belongs here. Presentation overlays and localized
domain labels belong to consumers. This does not compile or publish scenarios.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path

DOMAINS = ("main", "event", "unit_story", "idol_story", "card_scenarios", "work", "birthday", "extra")


def source_digest(data):
    encoded = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def display_title(row):
    raw = row.get("3") or row.get("9")
    if isinstance(raw, str) and raw and not re.fullmatch(r"\d+", raw.strip()):
        return raw
    title = (row.get("compiled_summary") or {}).get("title")
    if title:
        return title
    return str(raw) if raw is not None else ""


def release_number(value):
    # Several old families put resource IDs in field 5, not timestamps.
    # JSON null explicitly represents that unknown/non-numeric release value.
    try:
        if isinstance(value, str):
            value = value.strip()
            if "_" in value:
                return None
            if re.fullmatch(r"0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+", value):
                return int(value, 0)
        number = float(value or 0)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def build_file_metadata(data):
    """File-list metadata, separate from catalog titles containing parent names."""
    entries = {}
    for domain in DOMAINS:
        rows = data.get(domain, []) if domain in ("card_scenarios", "work", "birthday") else (data.get(domain) or {}).get("episodes", [])
        for row in rows or []:
            file = row.get("compiled_file")
            resource = row.get("resource_id")
            if not file and not resource:
                continue
            key = file or f"missing:{resource}"
            if key not in entries:
                entries[key] = {"key": key, "resourceIds": [], "titles": [], "exists": row.get("compiled_exists") is not False}
                if "compiled_file" in row:
                    entries[key]["file"] = file
            entry = entries[key]
            if resource and resource not in entry["resourceIds"]:
                entry["resourceIds"].append(resource)
            title = display_title(row)
            if title and title not in entry["titles"]:
                entry["titles"].append(title)
            if "summary" not in entry and row.get("compiled_summary") is not None:
                # The file list needs counts only, not another copy of scene assets.
                entry["summary"] = {name: row["compiled_summary"][name]
                                    for name in ("voice_count", "lip_count", "step_count")
                                    if name in row["compiled_summary"]}
            if row.get("compiled_exists") is False:
                entry["exists"] = False
    missing_extra = []
    for row in (data.get("extra") or {}).get("episodes", []):
        if row.get("compiled_exists") is False:
            resource = row.get("resource_id") or row.get("5")
            missing_extra.append({"resourceId": resource, "title": row.get("3") or resource})
    return {"entries": list(entries.values()), "missingExtra": missing_extra}


def build_story_catalog(data):
    def rows(domain, kind):
        return (data.get(domain) or {}).get(kind, [])

    def by_id(items):
        return {str(row.get("1")): row for row in items}

    groups = {domain: by_id(rows(domain, "groups")) for domain in ("main", "event", "unit_story", "extra")}
    chapters = {domain: by_id(rows(domain, "chapters")) for domain in ("main", "unit_story", "idol_story")}
    entries = {}
    for domain in DOMAINS:
        domain_rows = data.get(domain, []) if domain in ("card_scenarios", "work", "birthday") else rows(domain, "episodes")
        for row in domain_rows or []:
            resource = row.get("resource_id") or (row.get("5") if isinstance(row.get("5"), str) else "")
            file = row.get("compiled_file") or ""
            if not file and not resource:
                continue
            key = file or f"missing:{domain}:{resource}"
            summary = row.get("compiled_summary")
            info = summary or {}
            chapter = chapters.get(domain, {}).get(str(row.get("2")), {})
            group_key = chapter.get("2") if domain in ("main", "unit_story") else row.get("2")
            group = groups.get(domain, {}).get(str(group_key), {})
            title = info.get("title") or display_title(row)
            episode_label = section_id = section_label = ""
            release = release_number(row.get("5"))
            parents = []
            if domain in ("main", "unit_story", "idol_story"):
                title = chapter.get("9") or ""
                if domain == "unit_story":
                    title = title.strip()
                title = title or info.get("title") or ""
                episode_label = chapter.get("3") or ""
                release = release_number(chapter.get("5"))
                parents = [chapter.get("9"), chapter.get("3")]
                if domain == "main":
                    section_id = str(group.get("1") or "")
                    section_label = group.get("2") or ""
                elif domain == "unit_story":
                    section_id = str(group.get("2") or "")
                    section_label = group.get("3") or ""
                    parents.insert(0, group.get("3"))
                else:
                    section_id = next((c for c in info.get("characters", []) if re.fullmatch(r"\d{3}[a-z0-9]{3}", c, re.I)), "")
            elif domain == "event":
                title = group.get("9") or info.get("title") or ""
                episode_label = info.get("title") or ""
                section_id = str(group.get("4") or group.get("1") or "")
                release = release_number(group.get("10"))
                parents = [group.get("9"), group.get("3")]
            elif domain == "extra":
                parents = [group.get("3"), group.get("9")]

            if key not in entries:
                entries[key] = {
                    "id": key, "file": file, "domain": domain,
                    "exists": row.get("compiled_exists") is not False and bool(file),
                    "resourceIds": [], "titles": [], "characters": [],
                    "summary": summary, "rowCount": 0,
                    "unitId": str(group.get("2")) if domain == "unit_story" and group else "",
                    "unitName": (group.get("3") or "") if domain == "unit_story" else "",
                    "officialTitle": title, "episodeLabel": episode_label,
                    "sectionId": section_id, "sectionLabel": section_label,
                    "releaseAt": release,
                }
            entry = entries[key]
            if resource and resource not in entry["resourceIds"]:
                entry["resourceIds"].append(resource)
            raw_title = display_title(row)
            if raw_title and raw_title not in entry["titles"]:
                entry["titles"].append(raw_title)
            for parent in parents:
                if isinstance(parent, str) and parent and parent not in entry["titles"]:
                    entry["titles"].append(parent)
            if info.get("title") and info["title"] not in entry["titles"]:
                entry["titles"].insert(0, info["title"])
            for character in info.get("characters", []):
                if character and character not in entry["characters"]:
                    entry["characters"].append(character)
            if entry["summary"] is None and summary is not None:
                entry["summary"] = summary
            if row.get("compiled_exists") is False or not file:
                entry["exists"] = False
            entry["rowCount"] += 1
    return {"schema_version": 1, "source_digest": source_digest(data), "entries": list(entries.values()),
            "fileMetadata": build_file_metadata(data)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = build_story_catalog(json.loads(args.input.read_text(encoding="utf-8")))
    encoded = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)


if __name__ == "__main__":
    main()
