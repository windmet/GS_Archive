"""Verify the five-group identity-only pilot's exact prepublish rollback bytes."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
archive = ROOT / 'docs/GS_STORY_TEXT_IDENTITY_PILOT_BACKUP_20260929.zip'
releases = sorted((ROOT / 'public/data/publication/releases').glob('2026-09-29-story-text-identity-backfill-*.json'))
expected = {}
for release in releases:
    data = json.loads(release.read_text(encoding='utf-8'))
    for entry in data['entries']:
        for artifact in entry['previous_state']['artifacts']:
            member = artifact['path'].removeprefix('web_viewer/')
            if member in expected:
                raise ValueError(f'duplicate previous artifact: {member}')
            expected[member] = artifact

with ZipFile(archive) as package:
    bad = package.testzip()
    if bad:
        raise ValueError(f'corrupt ZIP member: {bad}')
    names = {name for name in package.namelist() if not name.endswith('/')}
    if names != set(expected):
        raise ValueError(f'ZIP membership drift: missing={set(expected) - names}, extra={names - set(expected)}')
    for member, artifact in expected.items():
        raw = package.read(member)
        if len(raw) != artifact['bytes'] or hashlib.sha256(raw).hexdigest() != artifact['sha256']:
            raise ValueError(f'previous byte mismatch: {member}')

if len(expected) != 51:
    raise ValueError(f'expected 51 pilot artifacts, found {len(expected)}')
print('Identity-only pilot exact rollback ZIP verified: 51 previous compiled artifacts')
