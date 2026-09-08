"""Masterdata generation orchestration; no dependency on the legacy entry script."""
from __future__ import annotations

from argparse import Namespace

if __package__ == "sidem_masterdata":
    from story_catalog import build_story_catalog
else:
    from ..story_catalog import build_story_catalog
from .output_io import write_json_outputs, FULL_PUBLIC_OUTPUTS
from .resource_inputs import load_json_file, load_spine_ids, load_prefab_models, collect_compiled_stems, collect_compiled_summaries, collect_card_home_voice_previews, collect_voice_stems
from .gasha import extract_gasha_announcements, build_gasha_index
from .events import extract_event_tables, build_event_index as project_event_index
from .cards import build_card_index
from .card_details import split_card_index
from .story_tables import extract_scenario_titles
from .birthday import build_birthday_semantic_catalog
from .story_index import build_story_master_index
from .episodes import build_idol_episode_index
from .mobile import build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index
from .seasonal import build_seasonal_communication_index, build_seasonal_campaign_index
from .music import build_music_catalog
from .movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
from .identities import build_idol_unit_dictionary, build_speaker_dictionary, build_costume_dictionary, build_face_dictionary
from .card_tables import extract_card_parameters, extract_card_voice_cues
from .diagnostics import build_table_scan, build_validation_report, build_archive_summary, build_card_probe
from .adapters import build_work_story_index, build_background_catalog
from .wire import decode_masterdata_input, iter_top_records, extract_table_rows


def run(args: Namespace) -> None:
    args.out_dir.mkdir(parents=True, exist_ok=True)
    decoded = decode_masterdata_input(args.input.read_bytes(), args.input_state)
    decoded_path = args.out_dir / "client_master_data.xor_DefaultPassPhrase.pb"
    decoded_path.write_bytes(decoded)

    records = list(iter_top_records(decoded))
    compiled_stems = collect_compiled_stems(args.compiled_dir)
    compiled_summaries = collect_compiled_summaries(args.compiled_dir)
    if args.birthday_semantic_only:
        birthday_tables = extract_scenario_titles(records)
        birthday_semantic_index = build_birthday_semantic_catalog(birthday_tables)
        filename = "birthday_story_semantic_index.json"
        write_json_outputs({filename: birthday_semantic_index}, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {birthday_semantic_index.get('meta', {})}")
        return
    if args.movie_announce_only:
        movie_tables = extract_table_rows(records, {175})
        movie_announce_index = build_movie_announce_index(movie_tables)
        filename = "movie_announce_index.json"
        write_json_outputs({filename: movie_announce_index}, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {movie_announce_index['meta']}")
        return
    if args.card_skill_movie_only:
        card_tables = extract_table_rows(records, {1})
        card_skill_movie_index = build_card_skill_movie_index(card_tables)
        filename = "card_skill_movie_index.json"
        write_json_outputs({filename: card_skill_movie_index}, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {card_skill_movie_index['meta']}")
        return
    if args.song_movie_only:
        song_tables = extract_table_rows(records, {46})
        song_movie_index = build_song_movie_index(song_tables)
        filename = "song_movie_index.json"
        write_json_outputs({filename: song_movie_index}, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {song_movie_index['meta']}")
        return
    if args.music_catalog_only:
        music_tables = extract_table_rows(records, {46, 112, 133})
        music_catalog = build_music_catalog(music_tables)
        filename = "music_catalog.json"
        write_json_outputs({filename: music_catalog}, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {music_catalog['meta']}")
        return
    if args.idol_communication_only:
        communication_tables = extract_table_rows(
            records,
            {
                2, 7, 8, 9, 20, 21, 23, 24, 32, 34, 36, 43, 44, 63, 68,
                94, 96, 98, 103, 104, 105, 106, 180,
            },
        )
        communication_idols = build_idol_unit_dictionary(communication_tables)
        selected_outputs = {
            "idol_episode_index.json": build_idol_episode_index(
                communication_tables, compiled_stems, compiled_summaries, communication_idols
            ),
            "mobile_archive_index.json": build_mobile_archive_index(
                communication_tables, compiled_stems, compiled_summaries, communication_idols
            ),
            "home_interaction_index.json": build_home_interaction_index(
                communication_tables, compiled_stems, compiled_summaries
            ),
        }
        write_json_outputs(selected_outputs, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        for filename, data in selected_outputs.items():
            print(f"{filename}: {data.get('meta', {})}")
        return
    if args.seasonal_campaign_only:
        seasonal_tables = extract_table_rows(
            records,
            {2, 20, 21, 100, 112, 146, 147, 148, 149, 150, 153, 159, 162, 165, 168},
        )
        seasonal_idols = build_idol_unit_dictionary(seasonal_tables)
        seasonal_speakers = build_speaker_dictionary(seasonal_tables, seasonal_idols)
        seasonal_campaign_index = build_seasonal_campaign_index(
            seasonal_tables,
            compiled_stems,
            compiled_summaries,
            seasonal_idols,
            seasonal_speakers,
        )
        filename = "seasonal_campaign_index.json"
        write_json_outputs({filename: seasonal_campaign_index}, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {len(seasonal_campaign_index['campaigns'])} campaigns")
        return
    if args.work_story_only:
        work_tables = extract_table_rows(records, {2, 20, 21, 53, 54, 55, 107, 108, 110})
        work_idols = build_idol_unit_dictionary(work_tables)
        work_backgrounds = build_background_catalog(work_tables, args.bg_dir)
        work_story_index = build_work_story_index(
            work_tables,
            args.compiled_dir,
            compiled_stems,
            compiled_summaries,
            work_idols,
            work_backgrounds,
        )
        filename = "work_story_index.json"
        write_json_outputs({filename: work_story_index}, args.out_dir, args.public_out_dir)
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {len(work_story_index['idols'])} idols")
        return
    voice_stems = collect_voice_stems(args.voice_dir)
    spine_ids = load_spine_ids(args.spines_index)
    prefab_models = load_prefab_models(args.prefab_meta)
    curated_card_voices = load_json_file(args.curated_card_voices) or {}
    curated_gasha_titles = load_json_file(args.curated_gasha_titles) or {}
    card_parameters = extract_card_parameters(records)
    story_tables = extract_scenario_titles(records)
    gasha_announcement_index = extract_gasha_announcements(records)
    card_voice_cues = extract_card_voice_cues(records)
    card_home_voice_previews = collect_card_home_voice_previews(
        card_voice_cues,
        args.compiled_dir,
        compiled_stems,
    )
    catalog_tables = extract_table_rows(
        records,
        {
            2, 7, 8, 9, 16, 20, 21, 23, 24, 27, 28, 29, 32, 34, 36, 40, 43, 44,
            46, 53, 54, 55, 63, 68, 90, 94, 96, 98, 100, 101, 103, 104,
            75, 105, 106, 107, 108, 110, 112, 130, 133, 146, 147, 148, 149, 150,
            153, 159, 162, 165, 168, 175, 176, 180,
        },
    )
    idol_unit_dictionary = build_idol_unit_dictionary(catalog_tables)
    speaker_dictionary = build_speaker_dictionary(catalog_tables, idol_unit_dictionary)
    costume_dictionary = build_costume_dictionary(catalog_tables, idol_unit_dictionary, spine_ids, prefab_models)
    idol_episode_index = build_idol_episode_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
    )
    mobile_archive_index = build_mobile_archive_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
    )
    home_interaction_index = build_home_interaction_index(catalog_tables, compiled_stems, compiled_summaries)
    short_adv_profile_index = build_short_adv_profile_index(catalog_tables, compiled_stems, compiled_summaries)
    seasonal_communication_index = build_seasonal_communication_index(catalog_tables, compiled_stems, compiled_summaries)
    seasonal_campaign_index = build_seasonal_campaign_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
        speaker_dictionary,
    )
    background_catalog = build_background_catalog(catalog_tables, args.bg_dir)
    work_story_index = build_work_story_index(
        catalog_tables,
        args.compiled_dir,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
        background_catalog,
    )
    music_catalog = build_music_catalog(catalog_tables)
    movie_announce_index = build_movie_announce_index(catalog_tables)
    card_skill_movie_index = build_card_skill_movie_index(catalog_tables)
    song_movie_index = build_song_movie_index(catalog_tables)
    face_dictionary = build_face_dictionary(catalog_tables)
    story_master_index = build_story_master_index(story_tables, compiled_stems, compiled_summaries)
    birthday_story_semantic_index = build_birthday_semantic_catalog(story_tables)
    card_index = build_card_index(
        card_parameters,
        card_voice_cues,
        card_home_voice_previews,
        story_tables,
        catalog_tables,
        voice_stems,
        compiled_stems,
        compiled_summaries,
        curated_card_voices,
    )
    card_index, card_detail_index = split_card_index(card_index)
    gasha_index = build_gasha_index(gasha_announcement_index, card_index, curated_gasha_titles)
    event_index = project_event_index(extract_event_tables(records), story_tables, card_index)
    validation_report = build_validation_report(
        story_tables,
        card_voice_cues,
        card_home_voice_previews,
        compiled_stems,
        voice_stems,
    )
    outputs = {
        "story_catalog.json": build_story_catalog(story_master_index),
        "masterdata_table_scan.json": build_table_scan(records),
        "card_parameter_field1_extract.json": card_parameters,
        "story_related_tables_extract.json": story_tables,
        "card_voice_cue_field91_extract.json": card_voice_cues,
        "card_home_voice_preview_extract.json": card_home_voice_previews,
        "story_master_index.json": story_master_index,
        "birthday_story_semantic_index.json": birthday_story_semantic_index,
        "gasha_announcement_index.json": gasha_announcement_index,
        "gasha_index.json": gasha_index,
        "event_index.json": event_index,
        "card_index.json": card_index,
        "card_detail_index.json": card_detail_index,
        "idol_unit_dictionary.json": idol_unit_dictionary,
        "speaker_dictionary.json": speaker_dictionary,
        "costume_dictionary.json": costume_dictionary,
        "idol_episode_index.json": idol_episode_index,
        "mobile_archive_index.json": mobile_archive_index,
        "home_interaction_index.json": home_interaction_index,
        "short_adv_profile_index.json": short_adv_profile_index,
        "seasonal_communication_index.json": seasonal_communication_index,
        "seasonal_campaign_index.json": seasonal_campaign_index,
        "work_story_index.json": work_story_index,
        "background_catalog.json": background_catalog,
        "music_catalog.json": music_catalog,
        "movie_announce_index.json": movie_announce_index,
        "card_skill_movie_index.json": card_skill_movie_index,
        "song_movie_index.json": song_movie_index,
        "face_dictionary.json": face_dictionary,
        "masterdata_validation_report.json": validation_report,
        "archive_summary.json": build_archive_summary(
            story_master_index,
            card_index,
            validation_report,
        ),
        "040ren_ssr03_probe.json": build_card_probe(card_index, "040ren_ssr03"),
    }
    write_json_outputs(outputs, args.out_dir, args.public_out_dir, FULL_PUBLIC_OUTPUTS)

    print(f"decoded: {decoded_path}")
    for filename, data in outputs.items():
        if isinstance(data, list):
            count = len(data)
        elif isinstance(data, dict):
            count = len(data)
        else:
            count = 1
        print(f"{filename}: {count} records")
