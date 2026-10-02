import assert from 'node:assert/strict'
import { floatingOverlayPosition as place } from '../src/presentation/FloatingOverlayPosition.mjs'

const viewport = { width: 1280, height: 620 }
assert.equal(place({ left: 570, top: 473, bottom: 594 }, { width: 260, height: 136 }, viewport).above, true)
assert.equal(place({ left: 24, top: 100, bottom: 150 }, { width: 260, height: 136 }, viewport).top, 158)
for (const view of [viewport, { width: 390, height: 844 }, { left: 100, top: 70, width: 280, height: 400 }]) {
  for (const anchor of [
    { left: 0, top: 0, bottom: 30 },
    { left: view.width - 10, top: view.height - 20, bottom: view.height },
    { left: 150, top: 200, bottom: 280 },
  ]) {
    for (const size of [{ width: 260, height: 136 }, { width: 900, height: 1600 }]) {
      const result = place(anchor, size, view)
      assert.ok(result.left >= (view.left || 0) + 8)
      assert.ok(result.top >= (view.top || 0) + 8)
      assert.ok(result.left + result.width <= (view.left || 0) + view.width - 8)
      assert.ok(result.top + result.height <= (view.top || 0) + view.height - 8)
    }
  }
}
console.log('Floating overlay: bottom flip, right-edge clamp, narrow and zoomed viewport bounds passed.')
