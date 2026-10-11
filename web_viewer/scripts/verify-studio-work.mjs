import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as vue from 'vue';
import * as documents from '../src/core/StudioDocument.mjs';
import * as changes from '../src/core/StudioDocumentChanges.mjs';
import * as policy from '../src/core/PictureStudioPolicy.mjs';
import * as files from '../src/core/StudioDocumentFile.mjs';
import * as gestures from '../src/core/StudioGestures.mjs';
import * as layers from '../src/core/StudioLayerEditing.mjs';
import * as references from '../src/core/StudioReferences.mjs';
import { createStudioRenderLoop } from '../src/core/StudioRenderLoop.mjs';
import { StudioCompositionStage } from '../src/core/StudioCompositionStage.js';

// Controlled scheduling and real composable/watchers. No GPU or device claim.
const frames = new Map(), ticks = new Set();
let serial = 0, renders = 0, updates = 0, running = false;
const loop = createStudioRenderLoop({
  app: { start() { running = true; }, stop() { running = false; },
    ticker: { deltaMS: 1000, add(fn) { ticks.add(fn); }, remove(fn) { ticks.delete(fn); } } },
  draw() { renders++; }, animate(delta) { assert.equal(delta, .05); updates++; },
  requestFrame(fn) { frames.set(++serial, fn); return serial; }, cancelFrame(id) { frames.delete(id); },
});
const flushFrame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
for (let i = 0; i < 120; i++) { loop.invalidate(); [...ticks].forEach(fn => fn()); }
assert.equal(frames.size, 1); assert(!running); assert.equal(updates, 0);
flushFrame(); assert.equal(renders, 1);
for (let i = 0; i < 120; i++) [...ticks].forEach(fn => fn());
assert.equal(updates, 0); assert.equal(renders, 1);
loop.setPlaying(true); assert(running); assert.equal(frames.size, 0);
[...ticks].forEach(fn => fn()); assert.equal(updates, 1);
loop.setHidden(true); assert(!running); [...ticks].forEach(fn => fn()); assert.equal(updates, 1);
loop.setPlaying(false); loop.setHidden(false); flushFrame(); assert(!running); assert.equal(renders, 2);
loop.setPlaying(true); loop.setHidden(true); loop.setHidden(false); assert(running);
loop.setPlaying(false); const late = [...frames.values()][0]; loop.dispose(); late();
assert.equal(frames.size, 0); assert.equal(ticks.size, 0); assert.equal(renders, 2); assert(!running);

// A direct saved-frame edit must settle the skeleton even without an idle ticker.
const stage = Object.create(StudioCompositionStage.prototype);
let frameUpdates = 0;
stage.playing = false; stage.render = () => {}; stage.applyFrame = () => {};
stage.updateModel = () => frameUpdates++;
stage.actorInstances = new Map([['a', { baseScale: 1, row: { poseTime: .1, faceTime: 0 },
  spine: { scale: { set() {} }, position: { set() {} } } }]]);
stage.setActorTransform('a', { poseTime: .2, faceTime: 0, x: .5, y: .8, scale: 1, rotation: 0 });
assert.equal(frameUpdates, 1);
stage.setActorTransform('a', { ...stage.row('a'), x: .7 }); assert.equal(frameUpdates, 1);
stage.setActorTransform('a', { ...stage.row('a'), faceTime: .5 }); assert.equal(frameUpdates, 2);

const preset = (modelId, label) => ({ status: 'script-bound-runtime-pending', modelId, label });
const actorView = id => {
  const modelId = `${String(id).padStart(3, '0')}ter_001_00`;
  return { actor: { poses: [{ id: 1 }, { id: 2 }], faces: [{ id: 1 }] }, costumes: [{ modelId }],
    media: { models: { [modelId]: { status: 'verified-local-files' } },
      entries: { 'poses:1': { preset: preset(modelId, 'one') }, 'poses:2': { preset: preset(modelId, 'two') }, 'faces:1': { preset: preset(modelId, 'face') } } } };
};
const materialView = { materials: { spots: [{ id: 1 }], sceneIdsBySpotId: { 1: [1] }, stickers: [{ id: 1 }], frames: [], filters: [] },
  media: { 'scenes:1': { image: { url: '/scene' } }, 'stickers:1': { full: { url: '/sticker' } } } };
const hooks = [], counts = { actors: 0, images: 0, order: 0, transforms: 0, poses: 0 };
let fakeStage;
class FakeStage {
  constructor() { fakeStage = this; this.app = { view: { dataset: {} } }; this.controllers = new Map(); this.actorInstances = new Map(); this.stickerInstances = new Map(); }
  async addActor(row, _binding, pose, face) { counts.actors++; this.controllers.set('actor:' + row.instanceId, {}); this.actorInstances.set(row.instanceId, { modelId: row.modelId, row, presetKey: JSON.stringify([pose.label, face.label, row.poseTime == null]) }); }
  async addSticker(row) { this.controllers.set('sticker:' + row.instanceId, {}); this.stickerInstances.set(row.instanceId, { stickerId: row.stickerId, row }); }
  destroyActor(id) { this.controllers.delete('actor:' + id); this.actorInstances.delete(id); }
  removeSticker(id) { this.controllers.delete('sticker:' + id); this.stickerInstances.delete(id); }
  setActorTransform(id, row) { counts.transforms++; this.actorInstances.get(id).row = row; }
  setStickerTransform(id, row) { counts.transforms++; this.stickerInstances.get(id).row = row; }
  setActorPose(id, pose, face) { counts.poses++; const model = this.actorInstances.get(id); model.presetKey = JSON.stringify([pose.label, face.label, model.row.poseTime == null]); }
  async setImages() { counts.images++; }
  setBackgroundZoom() {} setOrder() { counts.order++; } setWebFilter() {} select() {} setPlaying() {} destroy() {}
  input = { cancel() {} };
}
class Repository {
  async catalog() { return [{ id: '1' }, { id: '2' }, { id: 'materials' }]; }
  async detail(_domain, row) { return row.id === 'materials' ? materialView : actorView(Number(row.id)); }
}
const dependencies = {
  vue: { computed: vue.computed, ref: vue.ref, shallowRef: vue.shallowRef, watch: vue.watch, onBeforeUnmount(fn) { hooks.push(fn); } },
  '../../../readmodels/runtime/DomainRepository.mjs': { DomainRepository: Repository },
  '../../core/StudioDocument.mjs': documents,
  '../../core/StudioCompositionStage.js': { StudioCompositionStage: FakeStage },
  '../../core/StudioDocumentChanges.mjs': changes,
  '../../core/PictureStudioPolicy.mjs': policy,
  '../../core/StudioDocumentFile.mjs': files,
  '../../core/StudioGestures.mjs': gestures,
  '../../core/StudioLayerEditing.mjs': layers,
  '../../core/StudioReferences.mjs': references,
};
const context = vm.createContext({ console, AbortController, URL, Blob, Date, performance });
const source = await fs.readFile(new URL('../src/components/archive/useStudioComposition.js', import.meta.url), 'utf8');
const module = new vm.SourceTextModule(source, { context });
await module.link(key => { assert(dependencies[key], `Unexpected dependency ${key}`); const value = dependencies[key];
  return new vm.SyntheticModule(Object.keys(value), function() { for (const name of Object.keys(value)) this.setExport(name, value[name]); }, { context }); });
await module.evaluate();
const settle = async () => { for (let i = 0; i < 30; i++) { await vue.nextTick(); await Promise.resolve(); } };
const state = module.namespace.useStudioComposition({ photoIdol: '1', photoEntity: '', client: {}, bootstrap: {} }, { value: {} });
await state.load(); await settle(); assert.equal(state.error.value, '');
await state.addActor('2'); await settle(); state.addSticker(1); await settle();
const id = state.draft.value.actors[0].instanceId;
const before = { ...counts };
for (let i = 0; i < 100; i++) { state.draft.value.actors[0].x = .3 + i / 1000; await settle(); }
assert.equal(counts.actors, before.actors); assert.equal(counts.images, before.images); assert.equal(counts.order, before.order); assert.equal(counts.poses, before.poses);
assert.equal(counts.transforms - before.transforms, 100, 'Only the changed actor needs a transform');
assert.equal(fakeStage.actorInstances.get(id).row.x, .399);
state.draft.value.actors[0].poseTime = .3; await settle(); assert(counts.poses > before.poses, 'Null to explicit frame rebuilds the preset');
const afterPreset = counts.poses, afterImages = counts.images;
state.draft.value.actors[0].poseTime = .4; await settle(); assert.equal(counts.poses, afterPreset); assert.equal(counts.images, afterImages);
state.draft.value.actors[0].poseId = 2; await settle(); assert.equal(counts.poses, afterPreset + 1);
state.toggleLayer(id, 'hidden'); await settle(); assert(fakeStage.actorInstances.get(id).row.hidden);
state.toggleLayer(id, 'hidden'); await settle(); assert(!fakeStage.actorInstances.get(id).row.hidden);
state.move(id, 1); await settle(); assert(counts.order > before.order);
state.remove(id); await settle(); assert(!fakeStage.actorInstances.has(id)); state.undoDelete(); await settle(); assert(fakeStage.actorInstances.has(id));
// Invalid source identity must still take the full validation path and reject.
state.draft.value.actors[0].modelId = '049eis_004_00'; await settle(); assert.match(state.error.value, /不匹配/);
hooks.forEach(fn => fn());
console.log('Studio work: idle/coalesced render, hidden/preview/dispose scheduling, saved-frame settlement, real Vue 100-edit fast path and source identity rejection passed');
