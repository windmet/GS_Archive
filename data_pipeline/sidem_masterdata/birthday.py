"""Birthday subject, edition and announcement relationships."""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any
from .wire import parse_message
from .provenance import source


def build_birthday_semantic_catalog(
    story_tables: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    chapter_rows = {
        row.get("1"): row
        for row in story_tables.get("birthday_chapters", [])
        if isinstance(row.get("1"), int)
    }
    section_rows = {
        row.get("1"): row
        for row in story_tables.get("birthday_sections", [])
        if isinstance(row.get("1"), int)
    }
    character_rows = {
        row.get("1"): row
        for row in story_tables.get("birthday_characters", [])
        if isinstance(row.get("1"), int)
    }

    announcements = []
    announcements_by_subject: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in story_tables.get("birthday_announcements", []):
        subject_id = row.get("2")
        if not isinstance(subject_id, int) and isinstance(row.get("8"), str):
            try:
                image_reference = parse_message(bytes.fromhex(row["8"]))
                subject_id = image_reference.get("2")
            except (ValueError, EOFError):
                subject_id = None
        text = row.get("4") if isinstance(row.get("4"), str) else ""
        date_match = re.search(r"(\d{1,2})月(\d{1,2})日", text)
        announcement = {
            "id": row.get("1"),
            "subject_numeric_id": subject_id,
            "edition": 2 if isinstance(row.get("1"), int) and row["1"] >= 50 else 1,
            "romanized_name": row.get("3") if isinstance(row.get("3"), str) else "",
            "text": text,
            "month": int(date_match.group(1)) if date_match else None,
            "day": int(date_match.group(2)) if date_match else None,
            "image_reference": row.get("8") if isinstance(row.get("8"), str) else "",
            "_source": source(86, {
                "id": 1,
                "subject_numeric_id": 2,
                "romanized_name": 3,
                "text": 4,
                "image_reference": 8,
            }, row.get("_offset")),
        }
        announcements.append(announcement)
        if isinstance(subject_id, int):
            announcements_by_subject[subject_id].append(announcement)

    normalized_chapters = []
    for row in sorted(chapter_rows.values(), key=lambda item: item.get("1") or 0):
        normalized_chapters.append({
            "id": row.get("1"),
            "series_number": row.get("2"),
            "title": row.get("3") if isinstance(row.get("3"), str) else "",
            "target": "producer" if row.get("7") == 1 else "idol",
            "_source": source(76, {
                "id": 1,
                "series_number": 2,
                "title": 3,
                "target": 7,
            }, row.get("_offset")),
        })

    normalized_sections = []
    for row in sorted(section_rows.values(), key=lambda item: item.get("1") or 0):
        normalized_sections.append({
            "id": row.get("1"),
            "chapter_id": row.get("2"),
            "title": row.get("3") if isinstance(row.get("3"), str) else "",
            "_source": source(77, {
                "id": 1,
                "chapter_id": 2,
                "title": 3,
            }, row.get("_offset")),
        })

    by_episode_id: dict[str, dict[str, Any]] = {}
    missing_section_ids = []
    missing_chapter_ids = []
    missing_character_ids = []
    unassigned_episode_ids = []
    for episode in story_tables.get("birthday_episodes", []):
        episode_id = episode.get("1")
        section_id = episode.get("2")
        section = section_rows.get(section_id, {})
        chapter_id = section.get("2")
        chapter = chapter_rows.get(chapter_id, {})
        character = character_rows.get(episode_id, {})
        subject_id = character.get("2")
        if not section:
            missing_section_ids.append(episode_id)
        if not chapter:
            missing_chapter_ids.append(episode_id)
        if not character:
            missing_character_ids.append(episode_id)
        elif not isinstance(subject_id, int):
            unassigned_episode_ids.append(episode_id)
        semantics = {
            "episode_id": episode_id,
            "section_id": section_id,
            "section_title": section.get("3") if isinstance(section.get("3"), str) else "",
            "chapter_id": chapter_id,
            "chapter_title": chapter.get("3") if isinstance(chapter.get("3"), str) else "",
            "series_number": chapter.get("2"),
            "target": "producer" if chapter.get("7") == 1 else "idol",
            "subject_numeric_id": subject_id,
            "scheduled_at": episode.get("4"),
            "announcement_ids": [
                announcement["id"]
                for announcement in announcements_by_subject.get(subject_id, [])
            ],
            "sources": {
                "chapter": source(76, {"id": 1, "series_number": 2, "title": 3, "target": 7}, chapter.get("_offset")),
                "section": source(77, {"id": 1, "chapter_id": 2, "title": 3}, section.get("_offset")),
                "episode": source(78, {"id": 1, "section_id": 2, "scheduled_at": 4, "resource_id": 5}, episode.get("_offset")),
                "character": source(80, {"episode_id": 1, "subject_numeric_id": 2}, character.get("_offset")),
            },
        }
        if isinstance(episode_id, int):
            by_episode_id[str(episode_id)] = semantics

    return {
        "schema_version": 1,
        "authority": {
            "chapter": "client masterdata table 76 BirthdayStoryChapterData",
            "section": "client masterdata table 77 BirthdayStorySectionData",
            "episode": "client masterdata table 78 BirthdayStoryEpisodeData",
            "subject": "client masterdata table 80 BirthdayStoryCharacterSetData",
            "announcement": "client masterdata table 86",
        },
        "chapters": normalized_chapters,
        "sections": normalized_sections,
        "announcements": announcements,
        "by_episode_id": by_episode_id,
        "meta": {
            "chapter_count": len(normalized_chapters),
            "section_count": len(normalized_sections),
            "episode_count": len(by_episode_id),
            "announcement_count": len(announcements),
            "missing_section_ids": missing_section_ids,
            "missing_chapter_ids": missing_chapter_ids,
            "missing_character_ids": missing_character_ids,
            "unassigned_episode_ids": unassigned_episode_ids,
        },
    }
