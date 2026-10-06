import assert from 'node:assert/strict';
import { Container, Texture } from 'pixi.js';
import { StudioCompositionStage } from '../src/core/StudioCompositionStage.js';

// Switching backgrounds keeps the current picture on screen until the next one has loaded, then
// swaps in one step; asking again for the picture on screen cancels a load still in flight.
const stage = Object.create(StudioCompositionStage.prototype);
Object.assign(stage, { disposed: false, controllers: new Map(), images: new Map(), backgroundLayer: new Container(), frameLayer: new Container(), render() {} });
const pending = new Map();
stage.texture = (url, signal) => new Promise((resolve, reject) => {
  pending.set(url, () => resolve(new Texture(Texture.EMPTY.baseTexture)));
  signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
});
const tick = () => new Promise(resolve => setImmediate(resolve));
const showing = () => stage.images.get('background')?.signature;
const settle = async (url, promise) => { await tick(); pending.get(url)(); await promise; };

await settle('a.png', stage.setImages('background', [{ url: 'a.png' }]));
assert.equal(showing(), '["a.png"]');
assert.equal(stage.backgroundLayer.children.length, 1);

const toB = stage.setImages('background', [{ url: 'b.png' }]);
await tick();
assert.equal(showing(), '["a.png"]', 'The old background stays while the new one loads');
assert.equal(stage.backgroundLayer.children.length, 1, 'The canvas is never left without a background');
pending.get('b.png')(); await toB;
assert.equal(showing(), '["b.png"]');
assert.equal(stage.backgroundLayer.children.length, 1, 'The old sprite is removed in the same step the new one is added');

const toC = stage.setImages('background', [{ url: 'c.png' }]).catch(error => error);
await tick();
await stage.setImages('background', [{ url: 'b.png' }]);
const outcome = await Promise.race([toC, tick().then(() => 'still loading')]);
assert.equal(outcome?.name, 'AbortError', 'Going back to the picture on screen cancels the load in flight');
assert.equal(showing(), '["b.png"]');
assert.equal(stage.backgroundLayer.children.length, 1);

const failing = stage.setImages('background', [{}]).catch(error => error);
assert.match((await failing).message, /尚未绑定/);
assert.equal(showing(), '["b.png"]', 'A failed load leaves the current background in place');
console.log('Studio background swap: old picture kept while loading, one-step swap, A→B→A cancellation and failure keep the canvas filled');
