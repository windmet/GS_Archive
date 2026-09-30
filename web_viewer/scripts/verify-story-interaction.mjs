import assert from 'node:assert/strict'
import { trapDialogKey } from '../src/components/player/dialogFocus.js'
const ownerDocument = { activeElement: null }
const items = Array.from({ length: 3 }, () => ({ getClientRects: () => [1], focus() { ownerDocument.activeElement = this } }))
const panel = { ownerDocument, querySelectorAll: () => items }
let closed = 0, prevented = 0
const event = (key, shiftKey = false) => ({ key, shiftKey, preventDefault: () => prevented++ })
ownerDocument.activeElement = items[2]
trapDialogKey(event('Tab'), panel, () => closed++)
assert.equal(ownerDocument.activeElement, items[0])
trapDialogKey(event('Tab', true), panel, () => closed++)
assert.equal(ownerDocument.activeElement, items[2])
for (const key of ['a', 's', 'ArrowRight', ' ']) trapDialogKey(event(key), panel, () => closed++)
assert.equal(prevented, 2, 'ordinary input/select keys keep their browser defaults')
trapDialogKey(event('Escape'), panel, () => closed++)
assert.equal(closed, 1)
assert.equal(prevented, 3)
console.log('Interaction: modal Tab boundaries, Escape close, input default behavior passed')
