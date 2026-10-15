#!/usr/bin/env python3
"""Re-classify card operational voices in card_detail_index.json with the curated transcripts.

The full masterdata generation (data_pipeline/sidem_masterdata) is what normally writes card details; it
needs the whole compiled corpus. This step reuses its classifier on the published detail index, keeping
each cue's masterdata text and offset, so data_pipeline/curated/card_voice_transcripts.json reaches the
archive without a full regeneration, and a later full run produces the same rows.

  python scripts/apply-curated-card-voices.py [--check]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "data_pipeline"))
from sidem_masterdata.card_voices import classify_card_operational_voices  # noqa: E402

DATA = ROOT / "public" / "data" / "masterdata"
CURATED = ROOT.parent / "data_pipeline" / "curated" / "card_voice_transcripts.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail when the detail index is not up to date")
    args = parser.parse_args()
    curated = json.loads(CURATED.read_text(encoding="utf-8")).get("cards", {})
    path = DATA / "card_detail_index.json"
    details = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for resource_id, detail in details["cards_by_resource_id"].items():
        rows = detail.get("operational_voice_cues") or []
        if not rows:
            continue
        scout = next((row for row in rows if row["cue"].endswith("_02_00") and row["text_source"] == "masterdata"), None)
        card = {"36": scout["text"], "_offset": scout["_source"]["offset"]} if scout else {}
        if scout is None:
            # A scout line that curated text replaced kept the masterdata placeholder "0".
            original = next((row for row in rows if row["cue"].endswith("_02_00")), None)
            if original and original.get("text_source") == "curated":
                card = {"36": "0"}
        # Every operational cue is <voice_base>_NN_NN.
        fresh = classify_card_operational_voices(card, resource_id, rows[0]["cue"][:-6], {row["cue"] for row in rows}, curated)
        if [row["cue"] for row in fresh] != [row["cue"] for row in rows]:
            raise SystemExit(f"{resource_id}: cue set changed")
        # A curated row has no masterdata offset to keep; the placeholder's offset is restored on a full run.
        for row, old in zip(fresh, rows):
            if row["text_source"] == "masterdata" and "_source" in old:
                row["_source"] = old["_source"]
        if fresh != rows:
            detail["operational_voice_cues"] = fresh
            changed += 1
    sources = [row["text_source"] for detail in details["cards_by_resource_id"].values() for row in detail.get("operational_voice_cues") or []]
    summary = {source: sources.count(source) for source in sorted(set(sources))}
    if args.check:
        if changed:
            raise SystemExit(f"card_detail_index.json is stale for {changed} cards; run scripts/apply-curated-card-voices.py")
        print(f"Curated card voices: detail index up to date {summary}")
        return
    path.write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Curated card voices: {changed} cards updated {summary}")


if __name__ == "__main__":
    main()
