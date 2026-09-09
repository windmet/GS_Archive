"""Compare packaged compiler output with the pre-migration compiler baseline."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT.parent / 'data_pipeline'
sys.path.insert(0, str(PIPELINE))
from scenario_compiler import ScenarioCompiler, ScenarioState, compile_directory
from sidem_scenario import ScenarioCompiler as PackageCompiler, ScenarioState as PackageState
from sidem_scenario.authoritative import compile_authoritative_scenario
from authoritative_scenario import compile_authoritative_scenario as legacy_projection

FIXTURES = [
    'step9-missing-target-timing-raw.json',
    'timing-pending-fade-target-raw.json',
    'timing-visible-target-extension-raw.json',
    'timing-authored-long-choreography-raw.json',
]

def digest(data):
    return hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def outputs(compiler, empty_root):
    compiler.LIPSYNC_ROOT = str(empty_root / 'lip')
    compiler.ADV_BACKGROUND_ROOT = str(empty_root / 'bg')
    compiler.AUDIO_ROOT = str(empty_root / 'audio')
    compiler._LIPSYNC_BASENAME_INDEX = None
    compiler._ADV_BACKGROUND_INDEX = None
    results, raw = {}, []
    for name in FIXTURES:
        path = ROOT / 'fixtures' / 'story-runtime' / name
        data = json.loads(path.read_text(encoding='utf-8-sig'))
        raw.append(data)
        source = {'raw_path': f'fixtures/story-runtime/{name}', 'raw_hash': 'sha256:' + hashlib.sha256(path.read_bytes()).hexdigest()}
        for contract in ('compatibility', 'authoritative'):
            result = compiler(data, 'fixture', 'fixture', name).compile(output_contract=contract, source=source)
            results[f'{name}:{contract}'] = digest(result)
    for contract in ('compatibility', 'authoritative'):
        result = compiler.compile_group(raw, 'fixture_group', part_ids=[f'part_{i}' for i in range(len(raw))], source_files=FIXTURES, output_contract=contract, source={'raw_path': 'fixtures/story-runtime', 'raw_hash': 'sha256:' + digest(raw)})
        results[f'group:{contract}'] = digest(result)
    return results

def main():
    baseline = json.loads((ROOT / 'fixtures' / 'story-runtime' / 'scenario-package-baseline.json').read_text())
    assert ScenarioCompiler is PackageCompiler and ScenarioState is PackageState
    assert legacy_projection is compile_authoritative_scenario
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        assert outputs(ScenarioCompiler, root) == baseline['hashes'], 'compiler output/provenance changed'
        # Root-package import must compile strict output with no top-level
        # data_pipeline path injected. Test in a fresh process, not this one.
        code = '''
import json, sys
from pathlib import Path
from data_pipeline.sidem_scenario import ScenarioCompiler, LocalScenarioResources
from data_pipeline.sidem_scenario.authoritative import compile_authoritative_scenario
from data_pipeline.authoritative_scenario import compile_authoritative_scenario as old
assert old is compile_authoritative_scenario
root = Path(sys.argv[1])
raw = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8-sig'))
resources = LocalScenarioResources(lipsync_root=root/'lip', background_root=root/'bg', audio_root=root/'audio')
result = ScenarioCompiler(raw, 'fixture', resources=resources).compile(
    output_contract='authoritative', source={'raw_path': 'fixture.json', 'raw_hash': 'sha256:' + '0'*64})
assert 'authoritative_scenario' not in sys.modules
print(json.dumps(result))
'''
        clean_env = {key: value for key, value in os.environ.items() if key != 'PYTHONPATH'}
        run = subprocess.run([sys.executable, '-c', code, str(root), str(ROOT/'fixtures/story-runtime'/FIXTURES[0])],
                             cwd=ROOT.parent, env=clean_env, capture_output=True, text=True, encoding='utf-8', check=True)
        raw_root = json.loads((ROOT/'fixtures/story-runtime'/FIXTURES[0]).read_text(encoding='utf-8-sig'))
        expected_root = ScenarioCompiler(raw_root, 'fixture').compile(output_contract='authoritative',
            source={'raw_path': 'fixture.json', 'raw_hash': 'sha256:' + '0'*64})
        assert json.loads(run.stdout) == expected_root
        # Existing class-level file helpers and both CLI names remain usable.
        source = ROOT / 'fixtures' / 'story-runtime' / FIXTURES[0]
        raw = ScenarioCompiler.load_json(str(source))
        input_path = root / 'input' / 'scenario_fixture.json'
        ScenarioCompiler.save_json(raw, str(input_path))
        expected = ScenarioCompiler.compile_file(str(input_path))
        env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONPATH': str(PIPELINE),
               'SIDEM_LIPSYNC_ROOT': str(root / 'lip'), 'SIDEM_ADV_BACKGROUND_ROOT': str(root / 'bg'), 'SIDEM_AUDIO_ROOT': str(root / 'audio')}
        for command in ([str(PIPELINE / 'scenario_compiler.py')], ['-m', 'sidem_scenario.cli']):
            run = subprocess.run([sys.executable, *command, str(input_path)], env=env, capture_output=True, text=True, encoding='utf-8', check=True)
            assert json.loads(run.stdout) == expected
            missing = subprocess.run([sys.executable, *command], env=env, capture_output=True, text=True, encoding='utf-8')
            assert missing.returncode == 1 and 'Usage:' in missing.stdout
        compile_directory(str(input_path.parent), str(root / 'batch'))
        assert ScenarioCompiler.load_json(str(root / 'batch' / 'scenario_fixture_compiled.json')) == expected
    print('Scenario package: 10 frozen output/provenance hashes, API identity, file helpers, legacy/package CLI and isolated batch passed')

if __name__ == '__main__':
    main()
