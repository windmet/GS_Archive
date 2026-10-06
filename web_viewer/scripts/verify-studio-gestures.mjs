import assert from 'node:assert/strict';
import { Sprite, Texture, Point } from 'pixi.js';
import { MeshAttachment, RegionAttachment } from '@pixi-spine/runtime-3.8';
import { StudioGestures, studioTransformAround, studioTransformPatch, studioSelectionControls, studioSnapMove } from '../src/core/StudioGestures.mjs';
import { bindStudioCanvasInput } from '../src/core/StudioCanvasInput.mjs';
import { studioSkeletonContains, studioStickerContains } from '../src/core/StudioHitTest.js';
import { StudioCompositionStage } from '../src/core/StudioCompositionStage.js';

const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const row = () => ({ instanceId: 'a', x: .5, y: 2, scale: 2.1, rotation: 0 });
const fixture = () => {
  let value = row();
  const gestures = new StudioGestures({ getRow: id => id === 'a' ? value : null,
    onTransform: (id, patch) => { assert.equal(id, 'a'); value = { ...value, ...patch }; } });
  return { gestures, get: () => value };
};
assert.deepEqual(studioTransformPatch({ x: -2, y: 4, scale: 8, rotation: 90, bogus: 4, foo: NaN }),
  { x: -1, y: 3, scale: 5, rotation: 90 });
// An actor's feet may be below the canvas. Pinching about the visible fingers
// must preserve the transformed screen point, including when size saturates.
for (const factor of [.5, 2, 20]) {
  const original = row(), center = { x: 600, y: 300 };
  const result = studioTransformAround(original, center, center, factor, 30);
  const effective = result.scale / original.scale, angle = Math.PI / 6;
  near(result.x * 1280, center.x + effective * ((original.x * 1280 - center.x) * Math.cos(angle) - (original.y * 720 - center.y) * Math.sin(angle)));
  const expectedY = center.y + effective * ((original.x * 1280 - center.x) * Math.sin(angle) + (original.y * 720 - center.y) * Math.cos(angle));
  near(result.y * 720, Math.max(-720, Math.min(2160, expectedY)));
}
{
  const { gestures: g, get } = fixture();
  g.down(1, { x: 400, y: 200 }, { id: 'a', mode: 'move' });
  g.move(1, { x: 464, y: 272 }); near(get().x, .55); near(get().y, 2.1);
  g.down(2, { x: 664, y: 272 }, { id: 'other', mode: 'move' });
  assert.equal(g.id, 'a', 'Second finger cannot select another overlapping actor');
  assert.equal(g.down(3, { x: 900, y: 200 }, { id: 'a' }), false);
  g.move(2, { x: 464, y: 472 }); near(get().rotation, 90);
  const beforeRelease = { ...get() }; g.up(2);
  g.move(1, { x: 496, y: 308 }); near(get().x, beforeRelease.x + .025); near(get().y, beforeRelease.y + .05);
  g.cancel(true); assert.deepEqual(get(), row(), 'Esc restores the whole gesture, not just its last pinch segment');
}
{
  const { gestures: g, get } = fixture();
  g.down(1, { x: 500, y: 300 }, { id: 'a', mode: 'blank' });
  g.move(1, { x: 505, y: 305 }); assert.deepEqual(get(), row(), 'A blank single touch does not move the selected object');
  g.down(2, { x: 505, y: 305 }, null);
  g.move(2, { x: 506, y: 305 }); assert.deepEqual(get(), row(), 'Coincident fingers must not divide by zero');
  g.move(2, { x: 550, y: 305 }); assert.deepEqual(get(), row(), 'Start a finite baseline after the fingers separate');
  g.move(2, { x: 595, y: 305 }); near(get().scale, 4.2);
}
{
  const { gestures: g, get } = fixture();
  const center = { x: 640, y: 360 };
  g.down(1, { x: 740, y: 360 }, { id: 'a', mode: 'rotate', center });
  g.move(1, { x: 640, y: 460 }); near(get().rotation, 90);
  g.up(1); g.down(2, { x: 740, y: 360 }, { id: 'a', mode: 'scale', center });
  g.move(2, { x: 840, y: 360 }); near(get().scale, 4.2);
}
near(studioTransformAround({ ...row(), rotation: 175 }, { x: 640, y: 720 }, { x: 640, y: 720 }, 1, 10).rotation, -175);
for (const width of [350, 1323]) {
  for (const bounds of [{ x: -100, y: 20, width: 800, height: 2000 }, { x: 10, y: 2, width: 25, height: 3 }]) {
    const controls = studioSelectionControls(bounds, width);
    assert(controls.rotate.y >= 0 && controls.scale.y <= 720);
    assert(controls.scale.y - controls.rotate.y >= 44 * controls.unit - .0001);
    near(controls.radius / controls.unit, 22);
  }
}

// Use actual attachment classes, deformation and transparent sticker pixels.
const bone = { active: true, matrix: { a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 100 } };
const region = new RegionAttachment('region'); region.offset.set([-20, -20, -20, 20, 20, 20, 20, -20]);
let attachment = region;
const slot = { bone, color: { a: 1 }, deform: [], getAttachment: () => attachment };
const skeleton = { drawOrder: [slot] };
assert(studioSkeletonContains(skeleton, { x: 100, y: 100 }));
assert(!studioSkeletonContains(skeleton, { x: 10, y: 100 }));
slot.color.a = 0; assert(!studioSkeletonContains(skeleton, { x: 100, y: 100 })); slot.color.a = 1;
const mesh = new MeshAttachment('mesh'); mesh.worldVerticesLength = 8; mesh.vertices = [-20,-20,20,-20,20,20,-20,20]; mesh.triangles = [0,1,2,0,2,3]; attachment = mesh;
assert(studioSkeletonContains(skeleton, { x: 100, y: 100 }));
slot.deform = [10,-20,50,-20,50,20,10,20];
assert(!studioSkeletonContains(skeleton, { x: 100, y: 100 }));
assert(studioSkeletonContains(skeleton, { x: 130, y: 100 }));
const sprite = new Sprite(Texture.EMPTY); sprite.position.set(10,10);
const alpha = new Uint8Array(4 * 4 * 4); alpha[(1 * 4 + 1) * 4 + 3] = 255;
const sticker = { sprite, texture: { width: 4, height: 4 }, alpha };
assert(studioStickerContains(sticker, new Point(9,9)));
assert(!studioStickerContains(sticker, new Point(10,10)));
sprite.destroy();

// Real native event bindings with a scaled, offset canvas and pointer capture.
class Canvas extends EventTarget {
  style = {}; capture = new Set(); focus() {}
  getBoundingClientRect() { return { left: 100, top: 50, width: 640, height: 360 }; }
  setPointerCapture(id) { this.capture.add(id); }
  hasPointerCapture(id) { return this.capture.has(id); }
  releasePointerCapture(id) { this.capture.delete(id); }
}
const canvas = new Canvas(), blur = new EventTarget();
const stage = Object.create(StudioCompositionStage.prototype);
stage.app = { view: canvas };
stage.selectedId = 'a'; stage.actorInstances = new Map(); stage.stickerInstances = new Map();
const display = new Sprite(Texture.EMPTY);
stage.stickerInstances.set('a', { row: row(), sprite: display });
stage.render = () => {}; stage.onTransform = () => {};
stage.onSelect = id => { stage.selectedId = id; };
let intents = 0;
stage.pointerIntent = () => { intents++; return { id: 'a', mode: 'move' }; };
stage.selectionControls = () => ({ center: { x: 640, y: 360 } });
stage.gestures = new StudioGestures({ getRow: id => stage.row(id), onTransform: (id, patch) => stage.applyInteractiveTransform(id, patch) });
const input = bindStudioCanvasInput(canvas, stage, blur);
const send = (type, values) => { const event = new Event(type, { cancelable: true }); Object.assign(event, { button: 0, pointerType: 'touch', ...values }); canvas.dispatchEvent(event); return event; };
send('pointerdown', { pointerId: 1, clientX: 300, clientY: 150 });
send('pointermove', { pointerId: 1, clientX: 332, clientY: 186 }); near(stage.row('a').x, .55); near(stage.row('a').y, 2.1);
send('keydown', { key: 'ArrowRight' }); near(stage.row('a').x, .55);
send('pointerdown', { pointerId: 2, clientX: 432, clientY: 186 }); assert.equal(intents, 1);
send('pointermove', { pointerId: 2, clientX: 332, clientY: 286 }); near(stage.row('a').rotation, 90);
send('pointercancel', { pointerId: 2 }); assert.deepEqual([...canvas.capture], [1]);
blur.dispatchEvent(new Event('blur')); assert.equal(canvas.capture.size, 0); assert.equal(stage.gestures.points.size, 0);
const wheel = send('wheel', { clientX: 320, clientY: 200, deltaY: -50, deltaMode: 0 }); assert(wheel.defaultPrevented); assert(stage.row('a').scale > 2.1);
send('wheel', { clientX: 320, clientY: 200, deltaY: 100, deltaMode: 0, shiftKey: true }); near(stage.row('a').rotation, 95);
send('keydown', { key: ']' }); near(stage.row('a').rotation, 100);
// Portrait phones present the horizontal workspace rotated clockwise. The
// pointer mapper must invert that transform rather than swap just the sizes.
canvas.parentElement = { dataset: { studioRotation: '90' } };
canvas.getBoundingClientRect = () => ({ left: 100, top: 50, right: 460, width: 360, height: 640 });
const beforeRotated = { ...stage.row('a') };
send('pointerdown', { pointerId: 8, clientX: 280, clientY: 370 });
send('pointermove', { pointerId: 8, clientX: 262, clientY: 402 });
near(stage.row('a').x, beforeRotated.x + .05); near(stage.row('a').y, beforeRotated.y + .05);
send('keydown', { key: 'Escape' }); assert.deepEqual(stage.row('a'), beforeRotated);
assert.equal(canvas.capture.size, 0);
send('pointerdown', { pointerId: 9, clientX: 280, clientY: 370 });
blur.dispatchEvent(new Event('resize')); assert.equal(canvas.capture.size, 0);
assert.equal(stage.gestures.points.size, 0, 'Device rotation cancels contacts in the old coordinate system');
const final = { ...stage.row('a') }; input.dispose(); send('wheel', { clientX: 320, clientY: 200, deltaY: -100, deltaMode: 0 }); assert.deepEqual(stage.row('a'), final);
// Empty canvas: a clean tap clears the selection; a drag, a pinch starting there, or a cancelled
// contact keeps it.
{
  delete canvas.parentElement;
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, width: 640, height: 360 });
  stage.pointerIntent = () => (stage.selectedId ? { id: stage.selectedId, mode: 'blank' } : null);
  const blank = bindStudioCanvasInput(canvas, stage, blur);
  const reset = () => { stage.selectedId = 'a'; };
  send('pointerdown', { pointerId: 20, clientX: 120, clientY: 60 }); send('pointermove', { pointerId: 20, clientX: 121, clientY: 61 }); send('pointerup', { pointerId: 20 });
  assert.equal(stage.selectedId, '', 'A tap on empty canvas hides the selection frame');
  reset(); send('pointerdown', { pointerId: 21, clientX: 120, clientY: 60 }); send('pointermove', { pointerId: 21, clientX: 180, clientY: 90 }); send('pointerup', { pointerId: 21 });
  assert.equal(stage.selectedId, 'a', 'A drag across empty canvas keeps the selection');
  reset(); send('pointerdown', { pointerId: 22, clientX: 120, clientY: 60 }); send('pointerdown', { pointerId: 23, clientX: 300, clientY: 200 });
  send('pointerup', { pointerId: 22 }); send('pointerup', { pointerId: 23 });
  assert.equal(stage.selectedId, 'a', 'A pinch that starts on empty canvas keeps the selection');
  reset(); send('pointerdown', { pointerId: 24, clientX: 120, clientY: 60 }); send('pointercancel', { pointerId: 24 });
  assert.equal(stage.selectedId, 'a', 'A cancelled contact is not a tap');
  blank.dispose(); reset();
}
display.destroy();
// New editor gestures: every visible corner scales, locked/hidden rows reject
// pointer and keyboard transforms, and Shift snaps the actual angle.
{
  const { gestures: g, get } = fixture();
  const center = { x: 640, y: 360 };
  g.down(1, { x: 740, y: 360 }, { id: 'a', mode: 'rotate', center });
  g.move(1, { x: 738, y: 382 }, { shiftKey: true }); near(get().rotation, 15);
  g.cancel(true); assert.deepEqual(get(), row());
  // Rotation locks to 0/90/180/270 within 5° when snapping is on; off, or Shift's 15° steps, win.
  const at = deg => ({ x: 640 + 100 * Math.cos(deg * Math.PI / 180), y: 360 + 100 * Math.sin(deg * Math.PI / 180) });
  g.down(1, at(0), { id: 'a', mode: 'rotate', center });
  g.move(1, at(88), { snap: true }); near(get().rotation, 90); assert.equal(g.rotationSnapped, true, '88° locks to 90°');
  g.move(1, at(80), { snap: true }); near(get().rotation, 80); assert.equal(g.rotationSnapped, false, '80° is outside the snap band');
  g.move(1, at(88), { snap: false }); near(get().rotation, 88); assert.equal(g.rotationSnapped, false, 'Snap off keeps the exact angle');
  g.move(1, at(-3), { snap: true }); near(get().rotation, 0);
  g.move(1, at(88), { snap: true, shiftKey: true }); near(get().rotation, 90);
  g.move(1, at(97), { snap: true, shiftKey: true }); near(get().rotation, 90, 'Shift steps by 15°, not to the 90° lock');
  g.cancel(true); assert.deepEqual(get(), row());
  for (const state of ['locked', 'hidden']) {
    const blocked = new StudioGestures({ getRow: () => ({ ...row(), [state]: true }), onTransform: () => assert.fail('Protected layer changed') });
    assert.equal(blocked.down(1, center, { id: 'a' }), false);
  }
}
{
  const r = { x: .5, y: .97 }, bounds = { x: 540, y: 600, width: 200, height: 98.4 };
  const snapped = studioSnapMove(r, { x: .503, y: .973 }, bounds, 6);
  near(snapped.patch.x, .5); near(snapped.patch.y, .97); assert.equal(snapped.guides.length, 2);
  assert.equal(studioSnapMove(r, { x: .55, y: 1.02 }, bounds, 6).guides.length, 0);
  assert.equal(studioSnapMove(r, { y: .973 }, bounds, 6, false).guides.some(g => g.value === 720 * .97), false, 'Sticker has no foot anchor');
}
{
  const stage = Object.create(StudioCompositionStage.prototype);
  stage.selectedId = 'a'; stage.selectedRow = () => ({ ...row(), locked: false });
  const controls = studioSelectionControls({ x: 300, y: 100, width: 500, height: 500 }, 1280);
  stage.selectionControls = () => controls; stage.hitTest = () => '';
  for (const corner of controls.corners) assert.equal(stage.pointerIntent(corner).mode, 'scale');
  assert.equal(stage.pointerIntent({ x: 290, y: 90 }).mode, 'rotate');
  assert.equal(stage.pointerIntent({ x: 400, y: 300 }).mode, 'move', 'Transparent selected-box interior is draggable');
  stage.selectedRow = () => ({ ...row(), locked: true });
  assert.equal(stage.pointerIntent(controls.corners[0]).mode, 'blank');
  // Phone (390 css px): the rotate handle lies inside the top-right corner's touch circle. A tap on
  // the rotate handle must rotate, a tap on the corner must scale — normal size and zoomed past the edge.
  stage.selectedRow = () => ({ ...row(), locked: false });
  for (const bounds of [{ x: 500, y: 150, width: 260, height: 520 }, { x: 300, y: -200, width: 1200, height: 1100 }]) {
    const phone = studioSelectionControls(bounds, 390);
    stage.selectionControls = () => phone;
    assert.equal(stage.pointerIntent(phone.rotate, 'touch').mode, 'rotate', 'Touching the rotate handle rotates');
    assert.equal(stage.pointerIntent(phone.corners[1], 'touch').mode, 'scale', 'Touching the corner still scales');
  }
}
console.log('Studio gestures: native capture/disposal, CSS coordinate mapping, drag→pinch→drag continuity, midpoint-preserving scale/rotation, limits, cancellation, handles, wheel/keyboard and attachment/alpha hit tests passed; physical touch still requires device acceptance');
