import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateHomeProfile } from '../runtime/hydrateHomeProfile.mjs';

test('Home hydration preserves duplicate cue IDs and source order', () => {
  const page = { url: '/home/cues/1' };
  const detail = {
    profile: { id: 'idol' },
    cueIndex: [{ id: 'same', page }, { id: 'same', page }, { id: 'other', page }],
  };
  const rows = [
    { id: 'same', cue: 'first', previewStep: { state: 'ready' } },
    { id: 'same', cue: 'second', previewStep: { state: 'ready' } },
    { id: 'other', cue: 'third', previewStep: { state: 'ready' } },
  ];
  const result = hydrateHomeProfile(detail, [page], [{ rows }]);
  assert.deepEqual(result.cues.map(cue => cue.cue), ['first', 'second', 'third']);
  assert.equal(rows.length, 3);
  assert.throws(() => hydrateHomeProfile(detail, [page], [{ rows: rows.slice(1) }]), /incomplete/);
});
