"""Mixed-success batch execution must be distinguishable from success."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'data_pipeline'))
from sidem_scenario.cli import compile_directory

with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    inputs = root / 'input'
    inputs.mkdir()
    (inputs / 'broken.json').write_text('{', encoding='utf-8')
    (inputs / 'valid.json').write_text(json.dumps({'Command': []}), encoding='utf-8')
    env = {key: value for key, value in os.environ.items() if key != 'PYTHONPATH'}
    env.update(PYTHONIOENCODING='utf-8', SIDEM_LIPSYNC_ROOT=str(root/'lip'),
               SIDEM_ADV_BACKGROUND_ROOT=str(root/'bg'), SIDEM_AUDIO_ROOT=str(root/'audio'))
    for index, entry in enumerate(([str(ROOT/'data_pipeline/scenario_compiler.py')],
                                   ['-m', 'data_pipeline.sidem_scenario'])):
        output = root / f'output-{index}'
        run = subprocess.run([sys.executable, *entry, '--batch', str(inputs), str(output)],
                             cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8')
        assert run.returncode == 1, f'partial failure reported success: {run.stdout}'
        assert (output/'valid_compiled.json').is_file()
        assert not (output/'broken_compiled.json').exists()
        assert 'broken.json' in run.stdout
        missing = subprocess.run([sys.executable, *entry, '--batch', str(root/'missing'), str(output)],
                                 cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8')
        assert missing.returncode != 0
    result = compile_directory(str(inputs), str(root/'api'))
    assert result['compiled'] == 1
    assert len(result['failures']) == 1
    assert result['failures'][0]['path'].endswith('broken.json')
    (inputs/'broken.json').unlink()
    result = compile_directory(str(inputs), str(root/'success'))
    assert result == {'compiled': 1, 'failures': []}
    success = subprocess.run([sys.executable, '-m', 'data_pipeline.sidem_scenario', '--batch',
                              str(inputs), str(root/'cli-success')], cwd=ROOT, env=env,
                             capture_output=True, text=True, encoding='utf-8')
    assert success.returncode == 0
    def inaccessible(path, onerror):
        onerror(PermissionError(13, 'fixture denied', str(inputs/'locked')))
        return iter(())
    with patch('sidem_scenario.cli.os.walk', inaccessible):
        result = compile_directory(str(inputs), str(root/'walk-error'))
    assert result['compiled'] == 0 and len(result['failures']) == 1
    assert result['failures'][0]['path'].endswith('locked')
print('Scenario batch: partial failure exits nonzero, successful files retained, missing root rejected and structured result passed')
