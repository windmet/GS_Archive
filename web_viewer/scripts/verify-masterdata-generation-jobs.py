"""Independent generation jobs and lazy job-local resource ownership."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata.generation_inputs import GenerationInputs
from sidem_masterdata import generation_inputs as resource_owner
from sidem_masterdata.generation_jobs import SELECTED_JOBS, generate_full
from sidem_masterdata import iter_top_records


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus(data):
    records = list(iter_top_records(data))
    return {name: job(GenerationInputs(records)) for name, job in SELECTED_JOBS.items()}


def verify():
    independent = ('birthday_semantic', 'movie_announce', 'card_skill_movie', 'song_movie', 'music_catalog')
    with patch.object(resource_owner, 'collect_compiled_stems', side_effect=AssertionError('unnecessary compiled scan')), \
         patch.object(resource_owner, 'collect_compiled_summaries', side_effect=AssertionError('unnecessary summary scan')):
        for name in independent:
            inputs = GenerationInputs([], compiled_dir=Path('unavailable-compiled-directory'))
            assert SELECTED_JOBS[name](inputs)
            assert 'compiled_stems' not in inputs.__dict__
            assert 'compiled_summaries' not in inputs.__dict__
    with patch.object(resource_owner, 'collect_compiled_stems', side_effect=[{'one'}, {'two'}]) as stems, \
         patch.object(resource_owner, 'collect_compiled_summaries', side_effect=[{'one': {}}, {'two': {}}]) as summaries:
        first = GenerationInputs([])
        second = GenerationInputs([])
        assert first.compiled_stems == first.compiled_stems == {'one'}
        assert first.compiled_summaries == first.compiled_summaries == {'one': {}}
        assert stems.call_count == summaries.call_count == 1
        assert second.compiled_stems == {'two'} and second.compiled_summaries == {'two': {}}
        assert stems.call_count == summaries.call_count == 2
    for job in [*SELECTED_JOBS.values(), generate_full]:
        inputs = GenerationInputs([])
        saved = copy.deepcopy(inputs.records)
        with patch.object(Path, 'write_text', side_effect=AssertionError('job wrote JSON')), \
             patch.object(Path, 'write_bytes', side_effect=AssertionError('job wrote bytes')), \
             patch.object(Path, 'mkdir', side_effect=AssertionError('job made output directory')):
            result = job(inputs)
        assert isinstance(result, dict) and result
        assert inputs.records == saved
    assert len(SELECTED_JOBS) == 8


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        data = args.decoded_masterdata.read_bytes()
        result = corpus(data)
        actual = {'input_sha256': hashlib.sha256(data).hexdigest(),
                  'hashes': {key: digest(value) for key, value in result.items()}}
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/generation-jobs-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({name: list(outputs) for name, outputs in result.items()}))
    print('Masterdata jobs: standalone outputs, no writes, lazy reads, cache isolation and mode coverage passed')


if __name__ == '__main__':
    main()
