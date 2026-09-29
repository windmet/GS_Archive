"""Select original-source listening candidates; no encoding or release decision."""
import hashlib
import json
from pathlib import Path
import re


def main():
    root = Path(__file__).resolve().parent.parent
    folder = root / '.analysis/voice-compression'
    audit = json.loads((folder / 'source-cues.json').read_text(encoding='utf-8'))
    index_bytes = (root / 'public/data/compiled/voice_index.json').read_bytes()
    if audit['index_sha256'] != hashlib.sha256(index_bytes).hexdigest():
        raise ValueError('Voice index changed; rerun source cue audit')
    if audit['issues'] or audit['failures'] or audit['matched_files'] != audit['indexed_files']:
        raise ValueError('Complete cue identity audit required')
    idols = sorted({match.group(1) for p in (root / 'public/data/idolsetting/mouth').glob('*.json')
                    if (match := re.fullmatch(r'idol_mouth_stg_(\d{3}[a-z]{3})', p.stem))})
    if not idols:
        raise ValueError('No idol identities found')
    selected, coverage, unrepresented = {}, {}, []

    def include(entry, reason):
        if entry['file'] not in selected:
            selected[entry['file']] = {**entry, 'selection_reasons': [], 'listening_tags': [],
                                       'listening_status': 'pending'}
        selected[entry['file']]['selection_reasons'].append(reason)

    for idol in idols:
        group = sorted([e for e in audit['entries'] if idol in Path(e['acb']).parts],
                       key=lambda e: (e['duration_seconds'], e['file']))
        if not group:
            unrepresented.append(idol)
            continue
        if len(group) < 3:
            raise ValueError(f'Insufficient cues for {idol}')
        coverage[idol] = len(group)
        for reason, entry in [('shortest', group[0]), ('median-duration', group[len(group) // 2]),
                              ('longest', group[-1])]:
            include(entry, f'{idol}:{reason}')
    for entry in audit['entries']:
        if entry['channels'] > 1:
            include(entry, 'all-multichannel-exceptions')
    if not 100 <= len(selected) <= 200:
        raise ValueError('Candidate count must remain within the requested 100-200 range')
    plan = {'kind': 'voice-listening-candidate-plan', 'source_index_sha256': audit['index_sha256'],
            'voice_root': audit['voice_root'], 'files': len(selected), 'idol_groups': coverage,
            'mouth_identities_without_voice_group': unrepresented,
            'codecs_to_compare': ['AAC-LC 64k', 'AAC-LC 72k'],
            'scope': 'Duration extremes, median, idol path coverage, and all stereo exceptions; '
                     'semantic difficult-case coverage and listening acceptance remain unverified',
            'required_listening_tags': ['ordinary', 'low-pitch', 'high-pitch', 'shouting', 'whisper/breathy',
                                        'laughter', 'crying', 'long-tail', 'fast-speech', 'noise', 'reverb',
                                        'stereo', 'very-short', 'very-long'],
            'entries': sorted(selected.values(), key=lambda e: e['file'])}
    output = folder / 'listening-plan.json'
    output.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(selected)} candidates from {len(coverage)} idol paths; all multichannel cues included. '
          f'{len(unrepresented)} mouth identities have no indexed voice path. {output}')


if __name__ == '__main__':
    main()
