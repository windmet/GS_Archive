"""Extract useful records from SideM Growing Stars client_master_data.

The iOS cache file is XOR-obfuscated with the repeating ASCII phrase
``DefaultPassPhrase``. The decoded payload is a protobuf stream where each
top-level field number behaves like a table id.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

if __package__:
    from .story_catalog import build_story_catalog
    from .sidem_masterdata.provenance import source
    from .sidem_masterdata.cli import main
    from .sidem_masterdata.patterns import PATTERNS
    from .sidem_masterdata.card_tables import extract_card_parameters, extract_card_voice_cues
    from .sidem_masterdata.diagnostics import build_table_scan, build_validation_report, build_archive_summary, build_card_probe
    from .sidem_masterdata.adapters import build_event_index, build_work_story_index, build_background_catalog, build_card_detail_index
    from .sidem_masterdata.output_io import write_json_outputs, FULL_PUBLIC_OUTPUTS
    from .sidem_masterdata.backgrounds import build_background_catalog as project_background_catalog
    from .sidem_masterdata.resource_inputs import (load_json_file, load_spine_ids, load_prefab_models, collect_compiled_stems, summarize_compiled_scenario, collect_compiled_summaries, collect_card_home_voice_previews, collect_voice_stems, collect_background_stems)
    from .sidem_masterdata.gasha import extract_gasha_announcements, build_gasha_index
    from .sidem_masterdata.events import extract_event_tables, build_event_index as project_event_index
    from .sidem_masterdata.cards import canonical_cards, build_card_index
    from .sidem_masterdata.card_voices import OPERATIONAL_VOICE_SUFFIXES, classify_card_operational_voices
    from .sidem_masterdata.card_details import split_card_index, extract_card_details_in_place
    from .sidem_masterdata.card_gameplay import (IDOL_TYPE_NAMES, build_card_parameter, render_skill_description, build_card_reference_maps, build_card_gameplay, build_card_costume_relations)
    from .sidem_masterdata.story_tables import extract_scenario_titles
    from .sidem_masterdata.birthday import build_birthday_semantic_catalog
    from .sidem_masterdata.story_index import build_story_master_index
    from .sidem_masterdata.work import build_work_story_index as project_work_story_index, work_story_files
    from .sidem_masterdata.compiled_inputs import load_scenario_payloads
    from .sidem_masterdata.story_resources import (normalize_compiled_resource, compiled_exists, compiled_filename, enrich_resource_row, normalize_release_condition, normalize_term)
    from .sidem_masterdata.episodes import (build_idol_episode_index)
    from .sidem_masterdata.mobile import (build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index)
    from .sidem_masterdata.seasonal import (build_seasonal_communication_index, build_seasonal_campaign_index)
    from .sidem_masterdata.music import build_music_catalog
    from .sidem_masterdata.movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
    from .sidem_masterdata.identities import (maybe_resource_id, idol_id_from_resource, build_idol_unit_dictionary, build_speaker_dictionary, build_costume_dictionary, build_face_dictionary)
else:
    from story_catalog import build_story_catalog
    from sidem_masterdata.provenance import source
    from sidem_masterdata.cli import main
    from sidem_masterdata.patterns import PATTERNS
    from sidem_masterdata.card_tables import extract_card_parameters, extract_card_voice_cues
    from sidem_masterdata.diagnostics import build_table_scan, build_validation_report, build_archive_summary, build_card_probe
    from sidem_masterdata.adapters import build_event_index, build_work_story_index, build_background_catalog, build_card_detail_index
    from sidem_masterdata.output_io import write_json_outputs, FULL_PUBLIC_OUTPUTS
    from sidem_masterdata.backgrounds import build_background_catalog as project_background_catalog
    from sidem_masterdata.resource_inputs import (load_json_file, load_spine_ids, load_prefab_models, collect_compiled_stems, summarize_compiled_scenario, collect_compiled_summaries, collect_card_home_voice_previews, collect_voice_stems, collect_background_stems)
    from sidem_masterdata.gasha import extract_gasha_announcements, build_gasha_index
    from sidem_masterdata.events import extract_event_tables, build_event_index as project_event_index
    from sidem_masterdata.cards import canonical_cards, build_card_index
    from sidem_masterdata.card_voices import OPERATIONAL_VOICE_SUFFIXES, classify_card_operational_voices
    from sidem_masterdata.card_details import split_card_index, extract_card_details_in_place
    from sidem_masterdata.card_gameplay import (IDOL_TYPE_NAMES, build_card_parameter, render_skill_description, build_card_reference_maps, build_card_gameplay, build_card_costume_relations)
    from sidem_masterdata.story_tables import extract_scenario_titles
    from sidem_masterdata.birthday import build_birthday_semantic_catalog
    from sidem_masterdata.story_index import build_story_master_index
    from sidem_masterdata.work import build_work_story_index as project_work_story_index, work_story_files
    from sidem_masterdata.compiled_inputs import load_scenario_payloads
    from sidem_masterdata.story_resources import (normalize_compiled_resource, compiled_exists, compiled_filename, enrich_resource_row, normalize_release_condition, normalize_term)
    from sidem_masterdata.episodes import (build_idol_episode_index)
    from sidem_masterdata.mobile import (build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index)
    from sidem_masterdata.seasonal import (build_seasonal_communication_index, build_seasonal_campaign_index)
    from sidem_masterdata.music import build_music_catalog
    from sidem_masterdata.movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
    from sidem_masterdata.identities import (maybe_resource_id, idol_id_from_resource, build_idol_unit_dictionary, build_speaker_dictionary, build_costume_dictionary, build_face_dictionary)


# Preserve imports used by existing tooling while new wire consumers use the package.
if __package__:
    from .sidem_masterdata import (DEFAULT_KEY, read_varint, xor_decode, decode_masterdata_input,
                                  iter_top_records, decode_string, parse_message,
                                  length_delimited_field_bytes, extract_table_rows)
else:
    from sidem_masterdata import (DEFAULT_KEY, read_varint, xor_decode, decode_masterdata_input,
                                 iter_top_records, decode_string, parse_message,
                                 length_delimited_field_bytes, extract_table_rows)


if __name__ == "__main__":
    main()
