"""Temporary CLI output parity and explicit public projection boundaries."""
import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import masterdata_extract as legacy
from sidem_masterdata.output_io import FULL_PUBLIC_OUTPUTS, write_json_outputs

MODES = [[], ['--birthday-semantic-only'], ['--movie-announce-only'], ['--card-skill-movie-only'],
         ['--song-movie-only'], ['--music-catalog-only'], ['--idol-communication-only'],
         ['--seasonal-campaign-only'], ['--work-story-only'],
         ['--music-catalog-only', '--birthday-semantic-only']]


def snapshot(directory):
    return {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.iterdir())}


def cli_outputs(main=legacy.main):
    result = {}
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        source = root / 'empty-masterdata.pb'
        source.write_bytes(b'')
        curated = root / 'curated.json'
        curated.write_text('{}', encoding='utf-8')
        for mode_number, flags in enumerate(MODES):
            for publish in (False, True):
                target = root / f'{mode_number}-{publish}'
                analysis = target / 'analysis'
                public = target / 'public'
                argv = ['masterdata_extract.py', str(source), '--input-state', 'decoded',
                        '--out-dir', str(analysis), '--curated-card-voices', str(curated),
                        '--curated-gasha-titles', str(curated), *flags]
                if publish:
                    argv.extend(['--public-out-dir', str(public)])
                stdout = io.StringIO()
                with patch.object(sys, 'argv', argv), contextlib.redirect_stdout(stdout):
                    main()
                result[f'{mode_number}-{publish}'] = {
                    'analysis': snapshot(analysis),
                    'public': snapshot(public) if publish else {},
                    'stdout': stdout.getvalue().replace(str(analysis), '<analysis>'),
                }
                if not publish:
                    assert not public.exists()
                else:
                    assert 'client_master_data.xor_DefaultPassPhrase.pb' not in result[f'{mode_number}-{publish}']['public']
    return result


def verify():
    assert legacy.write_json_outputs is write_json_outputs
    assert 'card_index.json' in FULL_PUBLIC_OUTPUTS
    assert 'story_related_tables_extract.json' not in FULL_PUBLIC_OUTPUTS
    assert 'archive_summary.json' not in FULL_PUBLIC_OUTPUTS
    assert 'birthday_story_semantic_index.json' not in FULL_PUBLIC_OUTPUTS  # Historical full-mode scope preserved.
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        local = root / 'analysis'
        public = root / 'public'
        local.mkdir()
        outputs = {'public.json': {'title': '日本語', 'zero': 0}, 'private.json': [1, 2]}
        saved = copy.deepcopy(outputs)
        write_json_outputs(outputs, local, public, ['public.json'])
        assert outputs == saved
        assert set(snapshot(public)) == {'public.json'}
        assert (local / 'public.json').read_bytes() == (public / 'public.json').read_bytes()
        assert (local / 'public.json').read_text(encoding='utf-8') == json.dumps(outputs['public.json'], ensure_ascii=False, indent=2)
        # Existing unrelated files survive; a later selected mode only overwrites its own filenames.
        (public / 'unrelated.txt').write_text('keep', encoding='utf-8')
        write_json_outputs({'selected.json': {}}, local, public)
        assert (public / 'unrelated.txt').read_text() == 'keep'
        assert (public / 'public.json').exists()
    expected = json.loads((ROOT / 'fixtures/masterdata-wire/output-io-baseline.json').read_text())
    actual = cli_outputs()
    assert actual == expected['outputs']
    assert set(actual['0-True']['public']) == set(FULL_PUBLIC_OUTPUTS)
    assert set(actual['1-True']['public']) == {'birthday_story_semantic_index.json'}
    assert len(actual['6-True']['public']) == 3
    assert actual['9-True']['public'] == actual['1-True']['public']
    print('Masterdata output IO: 20 temporary CLI runs, exact bytes/stdout, selective publication, mode priority and unrelated files passed')


if __name__ == '__main__':
    verify()
