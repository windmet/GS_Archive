"""Heuristic labels used by the legacy wire inspection and card extractor."""
import re

PATTERNS = {
    "card_resource": re.compile(r"\b\d{3}[a-z]{3}_(?:n|r|sr|ssr)\d+\b"),
    "costume_or_card": re.compile(r"\b\d{3}[a-z]{3}_\d{3}_\d{2}\b"),
    "scenario_resource": re.compile(r"\b[1259]_[0-9]_[0-9]{3}_[0-9]{2}(?:_[0-9a-z]+)?\b"),
    "asset": re.compile(r"\b(?:bg\d{3}|bgm_|card_|live_|skill_movie_|song3_|system_)"),
    "timecode": re.compile(r"\b\d{2}:\d{2}:\d{2}\b"),
    "jp_text": re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]"),
}
