import assert from 'node:assert/strict'
import { createStudioDocument, studioObject, moveStudioObject, STUDIO_LIMITS } from '../src/core/StudioDocument.mjs'
import { removeStudioLayer, canRestoreStudioLayer, restoreStudioLayer, reorderStudioLayer } from '../src/core/StudioLayerEditing.mjs'
import { validateStudioDocument } from '../src/core/StudioDocument.mjs'

const doc = createStudioDocument()
doc.actors = [{ instanceId: 'touma', x: .4 }, { instanceId: 'shota', x: .6 }]
doc.stickers = [{ instanceId: 'jupiter', x: .5 }]
const deletion = removeStudioLayer(doc, 'touma')
assert.equal(studioObject(doc, 'touma'), null)
doc.actors[0].x = .8
assert.equal(restoreStudioLayer(doc, deletion), true)
assert.deepEqual(doc.actors.map(row => row.instanceId), ['touma', 'shota'])
assert.equal(doc.actors[1].x, .8, 'Undo deletion must preserve later edits to other layers')
assert.equal(canRestoreStudioLayer(doc, deletion), false, 'No duplicate instances')
moveStudioObject(doc, 'actors', 'touma', 1)
assert.deepEqual(doc.actors.map(row => row.instanceId), ['shota', 'touma'])
assert.deepEqual(doc.stickers.map(row => row.instanceId), ['jupiter'])
const stickerDeletion = removeStudioLayer(doc, 'jupiter')
assert.equal(restoreStudioLayer(createStudioDocument(), stickerDeletion), false, 'Never restore into another imported/loaded composition')
doc.stickers = Array.from({ length: STUDIO_LIMITS.stickers }, (_, index) => ({ instanceId: `sticker-${index}` }))
assert.equal(canRestoreStudioLayer(doc, stickerDeletion), false, 'Respect instance limits')
assert.equal(removeStudioLayer(doc, 'missing'), null)
const empty = createStudioDocument()
empty.actors = [{ instanceId: 'default-touma' }]
const defaultDeletion = removeStudioLayer(empty, 'default-touma')
assert.equal(empty.actors.length, 0)
assert.equal(restoreStudioLayer(empty, defaultDeletion), true)
const order = createStudioDocument()
order.actors = ['a', 'b', 'c'].map(instanceId => ({ instanceId }))
order.stickers = [{ instanceId: 'sticker' }]
assert.equal(reorderStudioLayer(order, 'a', 'c'), true)
assert.deepEqual(order.actors.map(r => r.instanceId), ['b', 'c', 'a'])
assert.equal(reorderStudioLayer(order, 'a', 'sticker'), false)
assert.equal(reorderStudioLayer(order, 'a', 'a'), false)
const persisted = createStudioDocument()
persisted.stickers = [{instanceId:'sticker', stickerId:1, x:.5,y:.3,scale:1,rotation:0,locked:true,hidden:true}]
assert.deepEqual(validateStudioDocument(JSON.parse(JSON.stringify(persisted))), persisted)
persisted.stickers[0].hidden = 'yes'
assert.throws(() => validateStudioDocument(persisted), /图层状态/)
console.log('Layer editing: default actor deletion, exact order restore, later-edit preservation, group order, duplicate/limit and cross-document guards passed')
