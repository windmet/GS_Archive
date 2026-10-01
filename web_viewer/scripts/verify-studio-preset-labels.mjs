import assert from 'node:assert/strict';
import { readCheckout } from '../readmodels/lib/checkout_adapter.mjs';
import { studioPresetPresentation, STUDIO_PRESET_LABELS } from '../src/presentation/studio-preset-labels.mjs';

const { product } = await readCheckout(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), { dataRevision: 'test', mediaEpoch: 'test' });
const records = product.extraDomains.photos.records.filter(row => row.id !== 'materials');
let faces = 0, poses = 0;
assert.equal(records.length, 49);
for (const { view } of records) {
  const original = JSON.stringify(view);
  for (const kind of ['faces', 'poses']) {
    for (const row of view.actor[kind]) {
      const presentation = studioPresetPresentation(view, kind, row);
      assert.equal(presentation.known, true, `${kind} source token missing: ${presentation.source}`);
      assert.match(presentation.label, /[\u4e00-\u9fff]/);
      assert.match(presentation.number, /^\d{2}$/);
      assert.equal(studioPresetPresentation({ ...view, actor: { ...view.actor, [kind]: [...view.actor[kind]].reverse() } }, kind, row).number, presentation.number);
      if (kind === 'faces') faces++; else poses++;
    }
  }
  assert.equal(JSON.stringify(view), original, 'Labels cannot mutate source identity or media');
}
const synthetic = { actor: { faces: [{ id: 10 }, { id: 20 }] }, media: { entries: {
  'faces:10': { preset: { face: 'face_future' } },
  'faces:20': { preset: { face: 'face_joy_evolution' } },
} } };
assert.equal(studioPresetPresentation(synthetic, 'faces', { id: 10 }).label, '表情 01');
assert.equal(studioPresetPresentation(synthetic, 'faces', { id: 10 }).source, 'future');
assert.equal(studioPresetPresentation(synthetic, 'faces', { id: 10 }).known, false);
assert.equal(studioPresetPresentation(synthetic, 'faces', { id: 20 }).label, '喜悦 · 变化版');
assert.equal(STUDIO_PRESET_LABELS.faces.swet, '冒汗', 'Retain the original swet source spelling');
console.log(`Studio Chinese preset labels: ${records.length} idols, ${faces} faces, ${poses} poses; stable numbering, unknown fallback and source immutability passed`);
