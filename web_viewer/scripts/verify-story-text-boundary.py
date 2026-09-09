"""Standalone text rules and backwards-compatible compiler API dispatch."""
import hashlib
import importlib.util
from pathlib import Path
import re
import sys

pipeline = Path(__file__).resolve().parents[2] / 'data_pipeline'
spec = importlib.util.spec_from_file_location('standalone_text_identity', pipeline / 'sidem_scenario/text_identity.py')
rules = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rules)
assert 'sidem_scenario.compiler' not in sys.modules

assert rules.normalize_source_text('\ufeffe\u0301\r\nx\ry') == 'é\nx\ny'
assert rules.source_text_hash('e\u0301') == 'sha256:' + hashlib.sha256('é'.encode()).hexdigest()
assert rules.canonical_source_file('././parts\\one.json') == 'parts/one.json'
for invalid in ['', '/tmp/a', 'C:\\a', '../a', 'parts//a', 'a/./b']:
    try:
        rules.canonical_source_file(invalid)
    except ValueError:
        pass
    else:
        raise AssertionError(f'accepted invalid source: {invalid!r}')
for name, actor, kind in [('', '001tom', 'none'), ('<P>', '001tom', 'producer'),
                          ('？？', '001tom', 'unknown'), ('冬馬', '001tom', 'idol'),
                          ('staff', 'npc', 'named')]:
    result = rules.speaker_identity(name, actor)
    assert result['kind'] == kind
    assert result['source_name'] == name
    assert result['entity_id'] == actor

sys.path.insert(0, str(pipeline))
from scenario_compiler import ScenarioCompiler
from sidem_scenario import text_identity

assert ScenarioCompiler.normalize_source_text is text_identity.normalize_source_text
assert ScenarioCompiler._speaker_identity is text_identity.speaker_identity
assert ScenarioCompiler._canonical_source_file is text_identity.canonical_source_file

class Customized(ScenarioCompiler):
    TEXT_TOKEN_PATTERN = re.compile(r'^custom:[a-z]+$')

    @staticmethod
    def normalize_source_text(text):
        return str(text).upper()

assert Customized._canonical_text_token('custom:part', 'part') == 'custom:part'
assert Customized.source_text_hash('abc') == 'sha256:' + hashlib.sha256(b'ABC').hexdigest()
assert ScenarioCompiler.source_text_hash('abc') != Customized.source_text_hash('abc')
print('Text boundary: standalone import, canonical paths, Unicode hash, speaker precedence and subclass dispatch passed')
