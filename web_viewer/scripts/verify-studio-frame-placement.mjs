import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { BaseTexture, Texture, Container } from 'pixi.js';
import { StudioCompositionStage } from '../src/core/StudioCompositionStage.js';
import { studioFramePlacement } from '../src/core/StudioFramePlacement.mjs';

const media = JSON.parse(await fs.readFile('public/data/masterdata/domains/photo_media.json', 'utf8'));
const native = JSON.parse(await fs.readFile('src/core/studio-native-frame-anchors.json', 'utf8'));
assert.equal(native.source.unityVersion, '2020.3.34f1');
assert.equal(native.roots.length, 5);
for (const root of native.roots)
  for (const name of ['LeftFrame', 'RightFrame'])
    for (const [field, value] of Object.entries(native.placements[name]))
      assert.deepEqual(root.frames[name][field], value, 'All recovered source frame roots agree');
const stage = Object.create(StudioCompositionStage.prototype);
Object.assign(stage, {
  disposed: false, controllers: new Map(), images: new Map(),
  backgroundLayer: new Container(), frameLayer: new Container(),
  async texture(_url) {
    // Real Pixi display geometry, no GPU upload or replacement image decoding.
    const binding = this.requested.find(b => b.url === _url);
    return new Texture(new BaseTexture(null, { width: binding.width, height: binding.height }));
  },
});
let count = 0;
for (const [key, frame] of Object.entries(media.entries).filter(([key]) => key.startsWith('frames:'))) {
  assert.equal(frame.layers.length, 2, `${key} must keep both source layers`);
  assert(frame.layers.every(row => row.status === 'verified-local-file'));
  stage.requested = frame.layers;
  await stage.setImages('frame', frame.layers);
  const [upper, lower] = stage.images.get('frame').loaded.map(row => row.sprite.getBounds());
  assert.equal(upper.x + upper.width, 1280, `${key} first layer reaches the right edge`);
  assert.equal(upper.y, 0, `${key} first layer reaches the top edge`);
  assert.equal(lower.x, 0, `${key} second layer reaches the left edge`);
  assert.equal(lower.y + lower.height, 720, `${key} second layer reaches the bottom edge`);
  assert.equal(stage.frameLayer.children.length, 2, 'Changing frames releases the previous display objects');
  count++;
}
assert.equal(count, 26);
await stage.setImages('frame', []);
assert.equal(stage.frameLayer.children.length, 0);
assert.throws(() => studioFramePlacement(2, 1280, 720));
assert.throws(() => studioFramePlacement(0, 0, 720));
console.log(`Studio frames: five consistent native roots, ${count} real two-layer bindings and upper-right/lower-left Pixi geometry passed; runtime sizing remains approximate`);
