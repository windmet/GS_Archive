"""Candidate resource configuration is explicit, portable, and shared with serving."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import archive_paths
from sidem_scenario import LocalScenarioResources

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    config = root / 'config.json'
    payload = {'schema_version': 1, 'archive_root': '.', 'raw_root': 'raw',
               'legacy_root': 'legacy', 'inventory_root': 'inventory', 'workspace_root': 'work',
               'derived_root': 'derived', 'publish_root': 'public'}
    config.write_text(json.dumps(payload), encoding='utf-8')
    sources = archive_paths.load_archive_sources(config)
    resources = LocalScenarioResources.from_archive_sources(sources, environment={})
    assert Path(resources.LIPSYNC_ROOT) == root/'legacy/scripts/lipsyncdata/adxlip'
    assert Path(resources.ADV_BACKGROUND_ROOT) == root/'legacy/scripts/advbackground/json'
    assert Path(resources.AUDIO_ROOT) == root/'legacy/GS_Res/Audio'
    overrides = {key: str(root/key) for key in ('SIDEM_LIPSYNC_ROOT', 'SIDEM_ADV_BACKGROUND_ROOT', 'SIDEM_AUDIO_ROOT')}
    changed = LocalScenarioResources.from_archive_sources(sources, environment=overrides)
    assert changed.LIPSYNC_ROOT == overrides['SIDEM_LIPSYNC_ROOT']
    assert changed.ADV_BACKGROUND_ROOT == overrides['SIDEM_ADV_BACKGROUND_ROOT']
    assert changed.AUDIO_ROOT == overrides['SIDEM_AUDIO_ROOT']
    # Cross-language source configuration must resolve the same served lip/audio roots.
    js = "import{loadArchiveAssetRoots}from'./scripts/lib/archive-assets.mjs';console.log(JSON.stringify(loadArchiveAssetRoots()))"
    clean_env = {key: value for key, value in os.environ.items() if not key.startswith('SIDEM_')}
    env = {**clean_env, 'SIDEM_ARCHIVE_SOURCES_CONFIG': str(config), 'PYTHONIOENCODING': 'utf-8'}
    served = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js], cwd=ROOT, env=env, text=True))
    assert Path(served['lipsync']) == Path(resources.LIPSYNC_ROOT)
    assert Path(served['audio']) == Path(resources.AUDIO_ROOT)
    # Prove a real candidate command consumes --sources-config and its resources.
    background = Path(resources.ADV_BACKGROUND_ROOT)/'advbg_data_fixture.json'
    background.parent.mkdir(parents=True)
    background.write_text(json.dumps({'imageId': 'bg_fixture', 'bgmCueName': 'fixture_music'}))
    music = Path(resources.AUDIO_ROOT)/'bgm/fixture_music.ogg'
    music.parent.mkdir(parents=True)
    music.write_bytes(b'existence-only fixture')
    raw = root/'scenario_fixture.json'
    raw.write_text(json.dumps({'Command': [
        {'Type': 'image_bg', 'Values': ['bg_fixture']},
        {'Type': 'text', 'Values': ['speaker', 'text', '047shu', '']},
    ]}))
    command = [sys.executable, str(ROOT/'scripts/compile-story-migration-candidate.py'),
               '--raw-file', str(raw), '--group-id', 'fixture', '--voice-index', '',
               '--sources-config', str(config), '--output-dir', str(root/'candidate')]
    subprocess.run(command, env={**env, 'SIDEM_ARCHIVE_SOURCES_CONFIG': str(root/'absent.json')}, check=True, capture_output=True)
    result = json.loads((root/'candidate/fixture.json').read_text(encoding='utf-8'))
    assert result['steps'][0]['state']['bgm'] == 'fixture_music'
    assert result['source']['raw_hash'].startswith('sha256:')
    # Explicit missing config is an error; no silent fallback and no candidate output.
    bad = command.copy()
    bad[bad.index('--sources-config') + 1] = str(root/'absent.json')
    bad[bad.index('--output-dir') + 1] = str(root/'bad-candidate')
    assert subprocess.run(bad, env=env, capture_output=True).returncode != 0
    assert not (root/'bad-candidate').exists()
    payload['legacy_root'] = None
    config.write_text(json.dumps(payload))
    fallback = LocalScenarioResources.from_archive_sources(archive_paths.load_archive_sources(config), environment={})
    assert Path(fallback.LIPSYNC_ROOT) == root/'sources/legacy_curated/scripts/lipsyncdata/adxlip'
    with patch.dict(os.environ, {}, clear=True), patch.object(archive_paths, 'DEFAULT_LOCAL_CONFIG', root/'missing-local.json'):
        defaults = LocalScenarioResources.from_archive_sources(archive_paths.load_archive_sources())
        assert Path(defaults.AUDIO_ROOT) == archive_paths.REPO_ROOT/'sources/legacy_curated/GS_Res/Audio'
print('Scenario source config: configured/overridden/default roots, JS serving parity, actual candidate CLI and missing-config failure passed')
