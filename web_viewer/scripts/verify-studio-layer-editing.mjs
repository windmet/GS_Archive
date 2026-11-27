import assert from 'node:assert/strict'
import { createStudioDocument, studioObject, moveStudioObject, STUDIO_LIMITS } from '../src/core/StudioDocument.mjs'
import { removeStudioLayer, canRestoreStudioLayer, restoreStudioLayer, reorderStudioLayer, duplicateStudioLayer, centerStudioLayer, resetStudioLayerRotation } from '../src/core/StudioLayerEditing.mjs'
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
const dupDoc = createStudioDocument()
dupDoc.actors = [{ instanceId: 'a1', idolId: 1, x: 0.4, y: 0.97, scale: 1, rotation: 15, locked: true }, { instanceId: 'a2', idolId: 2, x: 0.88, y: 0.97, scale: 1, rotation: 0 }]
dupDoc.stickers = [{ instanceId: 's1', stickerId: 1, x: 0.3, y: 0.2, scale: 0.8, rotation: -12, locked: true }]
const actorCopy = duplicateStudioLayer(dupDoc, 'a1', 'a1-copy')
assert.equal(actorCopy?.instanceId, 'a1-copy')
assert.equal(actorCopy?.locked, undefined)
assert.equal(actorCopy?.x, 0.46)
assert.deepEqual(dupDoc.actors.map(r => r.instanceId), ['a1', 'a1-copy', 'a2'])
const edgeCopy = duplicateStudioLayer(dupDoc, 'a2', 'a2-copy')
assert.equal(edgeCopy?.x, 0.82)
assert.equal(duplicateStudioLayer(dupDoc, 'a2', 'a2-copy'), null, 'Duplicate instanceId must be rejected')
const stickerCopy = duplicateStudioLayer(dupDoc, 's1', 's1-copy')
assert.equal(stickerCopy?.locked, undefined)
assert.equal(centerStudioLayer(dupDoc.actors[0]), false, 'Locked layer cannot be centered')
assert.equal(resetStudioLayerRotation(dupDoc.actors[0]), false, 'Locked layer rotation cannot be reset')
assert.equal(centerStudioLayer(actorCopy), true)
assert.equal(actorCopy.x, 0.5)
assert.equal(actorCopy.y, 0.97, 'Actor center preserves vertical framing height')
assert.equal(resetStudioLayerRotation(actorCopy), true)
assert.equal(actorCopy.rotation, 0)
assert.equal(centerStudioLayer(stickerCopy), true)
assert.equal(stickerCopy.x, 0.5)
assert.equal(stickerCopy.y, 0.5, 'Sticker center centers both X and Y')
dupDoc.actors = Array.from({ length: STUDIO_LIMITS.actors }, (_, index) => ({ instanceId: `cap-${index}`, x: 0.5 }))
assert.equal(duplicateStudioLayer(dupDoc, 'cap-0', 'cap-over'), null, 'Duplicate respects actor limit')
console.log('Layer editing: default actor deletion, exact order restore, later-edit preservation, group order, duplicate/center/reset, duplicate/limit and cross-document guards passed')
