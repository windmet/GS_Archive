import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  createStudioDocument,
  validateStudioDocument,
  validateStudioSources,
  moveStudioObject,
} from "../src/core/StudioDocument.mjs";
import { studioReference } from "../src/core/StudioReferences.mjs";
import { readCheckout } from "../readmodels/lib/checkout_adapter.mjs";
import { serializeStudioDocument, parseStudioDocument, readStudioDocumentFile, STUDIO_DOCUMENT_FILE_MAX_BYTES } from "../src/core/StudioDocumentFile.mjs";
const { product } = await readCheckout(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  { dataRevision: "test", mediaEpoch: "test" },
);
const photos = product.extraDomains.photos.records,
  views = new Map(
    photos
      .filter((row) => row.id !== "materials")
      .map((row) => [row.id, row.view]),
  ),
  materials = photos.find((row) => row.id === "materials").view.materials;
for (const name of ["A", "B"]) {
  const doc = studioReference(name, views);
  validateStudioSources(doc, materials, views);
  const restored = validateStudioDocument(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(restored, doc);
  assert.equal(doc.actors.length, name === "A" ? 2 : 3);
  assert.equal(doc.stickers.length, 5);
  const fileText = serializeStudioDocument(doc);
  assert.deepEqual(parseStudioDocument(fileText), doc);
  assert.deepEqual(parseStudioDocument('\uFEFF' + fileText), doc, 'Accept UTF-8 BOM from desktop editors');
  assert.deepEqual(await readStudioDocumentFile(new File([fileText], 'composition.json')), doc);
  const legacy = structuredClone(doc);
  legacy.schemaVersion = 1;
  // A v1 extension must not silently opt the old coordinates into v2 sizing.
  legacy.actors.forEach(actor => actor.layoutBasis = 'source-bounds');
  const upgraded = parseStudioDocument(JSON.stringify(legacy));
  assert.equal(upgraded.schemaVersion, 2);
  assert(upgraded.actors.every(actor => actor.layoutBasis === 'pose-bounds'));
  assert.equal(upgraded.actors[0].x, legacy.actors[0].x);
  assert.deepEqual(parseStudioDocument(serializeStudioDocument(upgraded)), upgraded);
  const originalOrder = doc.actors.map((row) => row.instanceId);
  moveStudioObject(doc, "actors", originalOrder[0], 1);
  assert.notDeepEqual(
    doc.actors.map((row) => row.instanceId),
    originalOrder,
  );
  moveStudioObject(doc, "actors", originalOrder[0], -1);
  assert.deepEqual(
    doc.actors.map((row) => row.instanceId),
    originalOrder,
  );
  const first = { ...doc.stickers[0], instanceId: "copy" };
  doc.stickers.push(first);
  assert.equal(
    doc.stickers.filter((row) => row.stickerId === first.stickerId).length,
    2,
  );
  const serialized = JSON.stringify(doc);
  for (const mutate of [
    (d) => (d.actors[0].idolId = 49),
    (d) => (d.actors[0].modelId = "049eis_004_00"),
    (d) => (d.stickers[0].stickerId = 999999),
    (d) => (d.background.spotId = 1),
  ]) {
    const broken = JSON.parse(serialized);
    mutate(broken);
    assert.throws(() => validateStudioSources(broken, materials, views));
  }
  for (const mutate of [
    (d) => (d.actors[0].scale = Infinity),
    (d) => (d.actors[0].x = 3),
    (d) => (d.actors[0].layoutBasis = 'unknown'),
    (d) => (d.stickers[0].instanceId = d.actors[0].instanceId),
    (d) => (d.schemaVersion = 99),
    (d) => (d.actors[0].modelId = "../texture"),
  ]) {
    const broken = JSON.parse(serialized);
    mutate(broken);
    assert.throws(() => validateStudioDocument(broken));
  }
}
assert.throws(() => parseStudioDocument('{broken'), /有效的 JSON/);
assert.throws(() => parseStudioDocument('{"schemaVersion":99,"actors":[],"stickers":[]}'), /不支持/);
assert.throws(() => parseStudioDocument('雪'.repeat(STUDIO_DOCUMENT_FILE_MAX_BYTES / 2)), /过大/, 'Limit UTF-8 bytes, not JS character count');
await assert.rejects(readStudioDocumentFile({size:STUDIO_DOCUMENT_FILE_MAX_BYTES + 1, text(){throw Error('must not read oversized files')}}), /过大/);
assert.deepEqual(
  validateStudioDocument(createStudioDocument()),
  createStudioDocument(),
);
const stage = await fs.readFile(
  new URL("../src/core/StudioCompositionStage.js", import.meta.url),
  "utf8",
);
assert.doesNotMatch(stage,/this\.model\s*=/);
assert.match(stage,/this\.actorInstances\s*=\s*new Map\(\)/);
assert(stage.includes("extract.canvas()"));
assert.match(stage,/this\.outline\.visible\s*=\s*false/);
console.log(
  "Composition: source-bound A/B, independent and duplicate instances, z-order, bounded file/BOM round-trip, invalid/cross-idol rejection and bounded framebuffer export passed",
);
