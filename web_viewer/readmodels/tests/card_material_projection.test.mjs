import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCardMap, mergeCardDetail } from '../../src/data/archiveSelectors.js';
import { projectCardLimitbreakMaterials } from '../lib/domain_expansion.mjs';
import { readCheckout } from '../lib/checkout_adapter.mjs';
import { jsonBytes, pick } from '../lib/common.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../../public/${name}`, import.meta.url), 'utf8'));
const cardDetails = read('data/masterdata/card_detail_index.json');
const cards = [...buildCardMap(read('data/masterdata/card_index.json')).values()]
  .map(card => mergeCardDetail(card, cardDetails));
const items = read('data/masterdata/domains/item_catalog.json').entries;
const collectionMedia = read('data/masterdata/domains/collection_media.json').entries;
const cardImages = read('data/masterdata/domains/event_media.json').cardImages;
const expectedUsage = { 'item:10501':49, 'item:10502':85, 'item:10503':399, 'item:10504':112, 'item:10505':12 };
const clone = value => JSON.parse(JSON.stringify(value));

test('[local-corpus] explicit card Items foreign keys form both directions without image inference', () => {
  const before = JSON.stringify({ cards, items, collectionMedia, cardImages });
  const { materialContexts, usageCardsByItem } = projectCardLimitbreakMaterials(cards, items, collectionMedia, cardImages);
  assert.equal(cards.length, 826);
  assert.equal(Object.keys(materialContexts).length, 826);
  assert.equal(Object.values(materialContexts).filter(Boolean).length, 657);
  assert.equal(Object.values(materialContexts).filter(value => value === null).length, 169);
  assert.deepEqual(Object.fromEntries(Object.entries(usageCardsByItem).map(([key, rows]) => [key, rows.length])), expectedUsage);
  const linked = [];
  for (const card of cards) {
    const material = materialContexts[card.resource_id];
    if (!card.limitbreak_item) {
      assert.equal(material, null);
      assert.ok(!Number.isInteger(card.limitbreak_item_id) || card.limitbreak_item_id <= 0);
      continue;
    }
    const entry = items.find(item => item.id === card.limitbreak_item_id);
    assert.equal(material.key, entry.key);
    assert.equal(material.kind, 'item');
    assert.equal(material.id, card.limitbreak_item.id);
    assert.equal(material.nameJa, entry.nameJa);
    assert.equal(material.description, entry.descriptionText.plain);
    assert.equal(material.resourceId, card.limitbreak_item.resource_id);
    assert.equal(material.referenceStatus, 'resolved-entity');
    assert.deepEqual(material.image, collectionMedia[entry.key].image, 'use the source-bound typed item image');
    assert.equal('amount' in material, false, 'an Items foreign key is not a Product amount record');
    assert.equal('typeCode' in material, false, 'itemType is not promoted to Product.typeCode');
    const usage = usageCardsByItem[entry.key].find(row => row.resource_id === card.resource_id);
    assert.deepEqual(pick(usage, ['resource_id','card_id','character_id','rarity','title']),
      pick(card, ['resource_id','card_id','character_id','rarity','title']));
    assert.deepEqual(usage.target, { view:'card_detail', card:card.resource_id });
    assert.deepEqual(usage.image, pick(cardImages[card.resource_id], ['url','status']), 'use the source-bound card icon');
    linked.push(usage.resource_id);
  }
  assert.equal(new Set(linked).size, 657);
  assert.equal(materialContexts['040ren_ssr03'].key, 'item:10505');
  assert.equal(materialContexts['001tom_ssr01'].key, 'item:10504');
  assert.equal(materialContexts['001tom_r01'].key, 'item:10502');
  assert.equal(materialContexts['040ren_sr06'], null);
  assert.equal(materialContexts['037jir_sr06'], null);
  assert.equal(JSON.stringify({ cards, items, collectionMedia, cardImages }), before, 'source inputs remain immutable');
});

test('labeled foreign-key and typed-domain conflicts remain unresolved, not guessed', () => {
  const original = cards.find(card => card.resource_id === '040ren_ssr03');
  const rejected = card => {
    const result = projectCardLimitbreakMaterials([card], items, collectionMedia, cardImages);
    assert.equal(result.materialContexts[card.resource_id], null);
    assert.deepEqual(result.usageCardsByItem, {});
  };
  for (const change of [
    card => { card.limitbreak_item_id = 0; },
    card => { card.limitbreak_item_id = null; },
    card => { card.limitbreak_item_id = '10505'; },
    card => { card.limitbreak_item_id = 999999; },
    card => { card.limitbreak_item = null; },
    card => { card.limitbreak_item.id = 10504; },
    card => { card.limitbreak_item.resource_id = 'coincident-other-image'; },
    card => { card.limitbreak_item.name = 'Different source name'; },
  ]) {
    const changed = clone(original); change(changed); rejected(changed);
  }
  // Same numeric ID in another domain must never pass as Items identity.
  const wrongDomain = items.map(item => item.id === 10505 ? { ...item, key:'honor:10505' } : item);
  assert.throws(() => projectCardLimitbreakMaterials([original], wrongDomain, collectionMedia, cardImages), /typed identity/);
  assert.throws(() => projectCardLimitbreakMaterials([original, clone(original)], items, collectionMedia, cardImages), /Ambiguous card/);
  assert.throws(() => projectCardLimitbreakMaterials([original], [...items, items[0]], collectionMedia, cardImages), /typed identity/);
  const withoutImage = projectCardLimitbreakMaterials([original], items, {}, {});
  assert.equal(withoutImage.materialContexts[original.resource_id].key, 'item:10505', 'missing media does not invalidate a proved foreign key');
  assert.equal(withoutImage.materialContexts[original.resource_id].image, null);
  assert.equal(withoutImage.usageCardsByItem['item:10505'][0].image, null);
});

test('[local-corpus] actual checkout producer carries card context and bounded item usage leaves', async () => {
  const viewer = fileURLToPath(new URL('../..', import.meta.url));
  const { product } = await readCheckout(viewer, { dataRevision:'test', mediaEpoch:'test' });
  const projected = projectCardLimitbreakMaterials(cards, items, collectionMedia, cardImages);
  let nullMaterials = 0, linkedMaterials = 0, biggest = 0;
  for (const card of product.cards) {
    const material = product.cardContext[card.resource_id].limitbreakMaterial;
    assert.deepEqual(material, projected.materialContexts[card.resource_id]);
    if (material === null) nullMaterials++; else linkedMaterials++;
  }
  assert.equal(nullMaterials, 169);
  assert.equal(linkedMaterials, 657);
  for (const record of product.extraDomains.items.records) {
    assert.deepEqual(record.view.usageCards, projected.usageCardsByItem[record.view.entry.key] || []);
    const size = jsonBytes({ id:String(record.id), view:record.view }).length;
    assert.ok(size <= 192 * 1024 - 1024, `${record.view.entry.key}: keep each packed item row within the actual writer budget`);
    biggest = Math.max(biggest, size);
  }
  for (const record of product.extraDomains.honors.records) assert.equal('usageCards' in record.view, false);
  console.log(`Actual producer: ${linkedMaterials} typed materials, ${nullMaterials} explicit empty contexts, 5 usage lists; largest item record ${biggest} bytes. No generated artifacts or Browser/media claim.`);
});
