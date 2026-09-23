"""Both CLI entry paths, package dependencies and default resource paths."""
import ast
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT.parent / 'data_pipeline'
sys.path.insert(0, str(PIPELINE))
import masterdata_extract as legacy
from sidem_masterdata.cli import build_parser, main
from sidem_masterdata.card_tables import extract_card_parameters, extract_card_voice_cues
from sidem_masterdata.diagnostics import build_table_scan, build_validation_report


def verify():
    assert legacy.main is main
    assert legacy.extract_card_parameters is extract_card_parameters
    assert legacy.extract_card_voice_cues is extract_card_voice_cues
    assert legacy.build_table_scan is build_table_scan
    defaults = build_parser().parse_args(['input.pb'])
    assert defaults.curated_card_voices == PIPELINE / 'curated/card_voice_transcripts.json'
    assert defaults.curated_gasha_titles == PIPELINE / 'curated/gasha_titles.json'
    assert defaults.input_state == 'xor'
    assert defaults.out_dir == Path('.analysis/masterdata')
    # Preserve wire offsets and the diagnostic sample rules on actual encoded rows.
    text = b'001tom_ssr01'
    payload = b'\x08\x01\x72' + bytes([len(text)]) + text
    records = [(1, 7, 9, 9 + len(payload), payload)]
    cards = extract_card_parameters(records)
    assert cards[0]['14'] == '001tom_ssr01' and cards[0]['_offset'] == 7
    assert cards[0]['_end'] == 9 + len(payload)
    scan = build_table_scan(records)
    assert scan[0]['matches']['card_resource'] == 1
    assert scan[0]['records'] == 1 and scan[0]['samples']['card_resource'] == ['001tom_ssr01']
    report = build_validation_report({'main_episodes': [{'6': '1_1_001_01'}]}, [], {}, set(), set())
    assert report['story_coverage']['main_episodes']['coverage'] == 0
    assert report['card_voice_cue_coverage']['coverage'] is None
    # No package module may import the compatibility entry point back into the dependency graph.
    for path in (PIPELINE / 'sidem_masterdata').glob('*.py'):
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or '').endswith('masterdata_extract'), path
            elif isinstance(node, ast.Import):
                assert all(not item.name.endswith('masterdata_extract') for item in node.names), path
    shim = ast.parse((PIPELINE / 'masterdata_extract.py').read_text(encoding='utf-8'))
    assert not any(isinstance(node, (ast.FunctionDef, ast.ClassDef)) for node in shim.body)
    entrypoints = [[sys.executable, str(PIPELINE / 'masterdata_extract.py')],
                   [sys.executable, '-m', 'data_pipeline.sidem_masterdata']]
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        source = root / 'empty.pb'
        source.write_bytes(b'')
        snapshots = []
        for i, command in enumerate(entrypoints):
            help_result = subprocess.run(command + ['--help'], cwd=ROOT.parent, capture_output=True, text=True)
            assert help_result.returncode == 0, help_result.stderr
            assert '--work-story-only' in help_result.stdout
            out = root / str(i)
            result = subprocess.run(command + [str(source), '--input-state', 'decoded',
                '--out-dir', str(out), '--music-catalog-only'], cwd=ROOT.parent, capture_output=True, text=True)
            assert result.returncode == 0, result.stderr
            snapshots.append({path.name: path.read_bytes() for path in out.iterdir()})
            assert set(snapshots[-1]) == {'client_master_data.xor_DefaultPassPhrase.pb', 'music_catalog.json'}
            assert json.loads(snapshots[-1]['music_catalog.json'])['songs'] == {}
        assert snapshots[0] == snapshots[1]
    print('Masterdata entrypoint: direct/package CLI, defaults, compatibility exports, raw offsets and acyclic imports passed')


if __name__ == '__main__':
    verify()
