"""Resolve voice references only from supplied per-part cue evidence."""
import re
from typing import Any


def relink_voices_from_raw_cues(
    scenario: dict[str, Any],
    audio_records: list[dict[str, Any]],
) -> dict[str, int]:
    cues_by_part = {
        str(record["part_id"]): set(record.get("cues") or [])
        for record in audio_records
    }
    all_cues = set().union(*cues_by_part.values()) if cues_by_part else set()
    stats = {"references": 0, "resolved": 0, "unresolved": 0, "ambiguous": 0}
    for step in scenario.get("steps") or []:
        dialogue = step.get("dialogue")
        voice = dialogue.get("voice") if isinstance(dialogue, dict) else None
        if not voice:
            continue
        stats["references"] += 1
        evidence = step.get("evidence") if isinstance(step.get("evidence"), dict) else {}
        part_id = str(evidence.get("source_part_id") or "")
        part_cues = cues_by_part.get(part_id, set())
        stem = str(voice)
        if stem.lower().endswith(".m4a"):
            stem = stem[:-4]

        candidates = []
        if stem in all_cues:
            candidates = [stem]
        else:
            candidates = sorted(cue for cue in part_cues if cue.endswith(stem))
        if not candidates:
            tail = re.search(r"([a-z]\d+)$", stem, flags=re.IGNORECASE)
            if tail:
                candidates = sorted(
                    cue for cue in part_cues if cue.endswith(tail.group(1))
                )

        if len(candidates) == 1:
            dialogue["voice"] = f"{candidates[0]}.m4a"
            stats["resolved"] += 1
        elif len(candidates) > 1:
            stats["ambiguous"] += 1
        else:
            stats["unresolved"] += 1
    return stats


