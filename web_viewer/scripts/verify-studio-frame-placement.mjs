import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { BaseTexture, Texture, Container } from 'pixi.js';
import { StudioCompositionStage } from '../src/core/StudioCompositionStage.js';
import { studioFramePlacement, studioFrameSprite } from '../src/core/StudioFramePlacement.mjs';
import sprites from '../src/core/studio-native-frame-sprites.json' with { type: 'json' };

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
let count = 0, trimmed = 0;
for (const [key, frame] of Object.entries(media.entries).filter(([key]) => key.startsWith('frames:'))) {
  assert.equal(frame.layers.length, 2, `${key} must keep both source layers`);
  assert(frame.layers.every(row => row.status === 'verified-local-file'));
  stage.requested = frame.layers;
  await stage.setImages('frame', frame.layers);
  // Native SetNativeSize: each part's display rect is its Sprite rect at scale 1, pinned to its corner.
  const parts = stage.images.get('frame').loaded.map(row => row.sprite);
  parts.forEach((sprite, index) => {
    const name = frame.layers[index].url.match(/image_picturestudio_frame_\d{4}_0[12]/)[0],
      native = sprites.sprites[name];
    assert(native, `${key} layer ${index} has a native sprite rect`);
    assert.equal(sprite.scale.x, 1, `${key} layer ${index} is drawn at native size`);
    assert.deepEqual([sprite.width, sprite.height], [native.width, native.height], `${key} layer ${index} keeps its native rect`);
    const left = sprite.x - sprite.anchor.x * native.width, top = sprite.y - sprite.anchor.y * native.height;
    if (index === 0) assert.deepEqual([left + native.width, top], [1280, 0], `${key} first layer is pinned top-right`);
    else assert.deepEqual([left, top + native.height], [0, 720], `${key} second layer is pinned bottom-left`);
    // getBounds reports the whole orig rect; the drawn quad is vertexData. A packed file's pixels land where the native rect has them, not at the corner.
    sprite.getBounds(); // refreshes the world transform
    sprite.calculateVertices();
    const [qx, qy] = sprite.vertexData, file = frame.layers[index],
      inner = file.width === native.width && file.height === native.height ? { x: 0, y: 0 } : native.packed;
    assert(Math.abs(qx - (left + inner.x)) < 1e-3 && Math.abs(qy - (top + inner.y)) < 1e-3,
      `${key} layer ${index} pixels sit at the native offset`);
    if (inner !== native.packed) return;
    trimmed++;
  });
  assert.equal(stage.frameLayer.children.length, 2, 'Changing frames releases the previous display objects');
  count++;
}
assert.equal(count, 26);
assert.equal(trimmed, 9, 'The nine archived packed-region files are re-offset');
assert.throws(() => studioFrameSprite('/x/image_picturestudio_frame_0024_02.png', 100, 100));
assert.throws(() => studioFrameSprite('/x/unknown.png', 10, 10));
await stage.setImages('frame', []);
assert.equal(stage.frameLayer.children.length, 0);
assert.throws(() => studioFramePlacement(2, 1280, 720));
assert.throws(() => studioFramePlacement(0, 0, 720));
console.log(`Studio frames: five consistent native roots, ${count} real two-layer bindings and upper-right/lower-left native-size Pixi geometry passed (${trimmed} packed files re-offset)`);
