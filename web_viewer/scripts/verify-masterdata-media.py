"""Media domain rules and optional complete output comparison to pre-split code."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'data_pipeline'))
from sidem_masterdata import extract_table_rows, iter_top_records
from sidem_masterdata.music import build_music_catalog
from sidem_masterdata.movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
import masterdata_extract as legacy

BUILDERS = [build_music_catalog, build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index]
API = SimpleNamespace(**{function.__name__: function for function in BUILDERS})

def outputs(tables, api=API):
    return {function.__name__: getattr(api, function.__name__)(tables) for function in BUILDERS}

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def rejects(function, tables, message):
    try:
        function(tables)
    except ValueError as error:
        assert message in str(error)
    else:
        raise AssertionError(f'{function.__name__} accepted conflicting evidence')

def verify():
    for function in BUILDERS:
        assert getattr(legacy, function.__name__) is function
    song = {'1': 1, '4': 'song', '5': 'first title', '7': {'1': 2, '2': 1}, '30': 2, '24': 0, '_offset': 10}
    tables = {
        46: [song, {**song, '1': 2, '5': 'later title', '30': 1, '31': 2, '_offset': 20},
             {'1': 3, '4': 'special', '7': {'1': 3, '2': 999}, '38': 4102412400},
             {'1': 4, '4': 'live', '38': 1}],
        112: [{'1': 1, '2': 'event title', '14': 'shared'}],
        133: [{'1': 9, '2': 3, '3': 'shared', '4': 'bank', '5': 'shared', '6': 'selector', '_offset': 30}],
        175: [{'1': 1, '6': 'announcement', '5': {'1': 100, '2': 200}, '_offset': 40}],
        1: [{'1': 1, '14': 'shared-card', '31': 1}, {'1': 2, '14': 'shared-card', '31': 1}, {'1': 3, '14': 'disabled', '31': 0}],
    }
    before = copy.deepcopy(tables)
    result = outputs(tables)
    assert tables == before
    music = result['build_music_catalog']
    assert music['songs']['song']['performer_idol_ids'] == [1, 2]
    assert music['songs']['song']['title'] == 'first title'
    assert music['songs']['song']['_source']['offset'] == 20
    assert music['songs']['special']['unit_mapping']['status'] == 'unresolved_special_selector'
    assert music['bgm']['shared']['table_133_roles'] == ['source_selector', 'seasonal_base_cue']
    assert music['bgm']['shared']['title'] == 'event title'
    assert result['build_card_skill_movie_index']['meta']['shared_resource_count'] == 1
    movies = result['build_song_movie_index']
    assert [(item['kind'], item['resource_id']) for item in movies['song_movies']] == [('3dmv', 'song'), ('mvlive', 'live')]
    assert movies['meta']['shared_resource_count'] == 1
    assert result['build_movie_announce_index']['movie_announces'][0]['term'] == {'start_at': 100, 'end_at': 200}
    rejects(build_music_catalog, {46: [song, {**song, '7': {'1': 2, '2': 9}}]}, 'conflicting')
    rejects(build_movie_announce_index, {175: [{'1': 1, '6': 'a'}, {'1': 1, '6': 'b'}]}, 'duplicate')
    rejects(build_movie_announce_index, {175: [{'1': 1, '6': 'a'}, {'1': 2, '6': 'a'}]}, 'duplicate')
    rejects(build_card_skill_movie_index, {1: [tables[1][0], tables[1][0]]}, 'duplicate')
    rejects(build_song_movie_index, {46: [song, song]}, 'duplicate')
    assert all(not value.get('meta', {}).get('resource_count') for value in outputs({}).values())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        data = args.decoded_masterdata.read_bytes()
        tables = extract_table_rows(list(iter_top_records(data)), {1, 46, 112, 133, 175})
        result = outputs(tables)
        actual = {'input_sha256': hashlib.sha256(data).hexdigest(), 'hashes': {key: digest(value) for key, value in result.items()}}
        expected = json.loads((ROOT/'fixtures/masterdata-wire/media-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({key: value['meta'] for key, value in result.items()}))
    print('Masterdata media: input isolation, performers, selector roles, movie predicates, resource sharing and conflicting evidence passed')

if __name__ == '__main__':
    main()
