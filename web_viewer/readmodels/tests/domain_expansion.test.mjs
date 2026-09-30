import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCheckout } from '../lib/checkout_adapter.mjs';
import { validateDomainPayload, validateMediaPayload, REVIEWED_DOMAIN_PB } from '../lib/domain_expansion.mjs';

test('Domain gate rejects mixed snapshots and generator versions', () => {
  const source = {decodedPbSha256:REVIEWED_DOMAIN_PB,generatorVersion:'gs-archive-domains-v1'};
  const value = {schemaVersion:1,kind:'gs-item-catalog',source};
  assert.equal(validateDomainPayload(value, value.kind),value);
  for (const mutation of [{schemaVersion:2},{kind:'gs-honor-catalog'},{source:{...source,decodedPbSha256:'a'.repeat(64)}},{source:{...source,generatorVersion:'other'}}])
    assert.throws(() => validateDomainPayload({...value,...mutation},value.kind));
});

test('Media gate rejects external and traversing URLs and malformed digests',()=>{
  const source={decodedPbSha256:REVIEWED_DOMAIN_PB,generatorVersion:'gs-domain-media-v1'};
  const sample={schemaVersion:1,kind:'gs-photo-media',source,entries:{image:{url:'/assets/bg/bg1.png',sha256:'a'.repeat(64)}}};
  assert.equal(validateMediaPayload(sample,sample.kind),sample);
  for (const url of ['https://example.com/a.png','/assets/bg/../a.png','/data/secret.json','/assets/bg/%2e%2e/a.png'])
    assert.throws(()=>validateMediaPayload({...sample,entries:{image:{url}}},sample.kind));
  assert.throws(()=>validateMediaPayload({...sample,entries:{image:{sha256:'wrong'}}},sample.kind));
});

test('[local-corpus] domain projection preserves story identities, typed rewards and partial sources', async () => {
  const viewer = fileURLToPath(new URL('../..', import.meta.url));
  const {product,provenance} = await readCheckout(viewer,{dataRevision:'test',mediaEpoch:'test'});
  const domains = product.extraDomains;
  const manifest = JSON.parse(await fs.readFile(path.join(viewer,'public/data/archive_manifest.json'),'utf8'));
  assert.equal(domains.events.records.length,59);
  for (const event of manifest.unit_event_relations) {
    const projected = domains.events.records.find(r => r.id === String(event.event_id));
    assert.equal(projected.view.event.file,event.file);
    assert.equal(String(projected.view.supplement.event.eventCode),String(event.event_code));
  }
  const original = domains.events.records.find(r => r.id === '410001');
  const reprint = domains.events.records.find(r => r.id === 'event:10019');
  assert.notEqual(original.id,reprint.id);
  assert.equal(original.view.event.file,reprint.view.event.file);
  assert.equal(reprint.view.supplement.event.storyChapterRelations[0].chapterId,410001);
  assert.equal(reprint.summary.isReprint,true);
  assert.deepEqual(domains.events.records.filter(r=>r.summary.eventKind === 'collection').map(r=>r.view.supplement.sourceTable),Array(17).fill(118));
  assert.equal(domains.items.records.length,535);
  assert.equal(domains.honors.records.length,1613);
  assert.equal(domains.photos.records.length,50);
  assert.equal(domains.photos.records.find(r=>r.id === '1').view.actor.idolId,1);
  for (const domain of ['items','honors']) for (const record of domains[domain].records) {
    assert.equal(record.view.entry.key,`${domain === 'items' ? 'item' : 'honor'}:${record.id}`);
    assert.equal(record.view.sourceCoverage,'partial-client-masterdata');
    for (const link of record.view.sources.filter(link=>link.event))
      assert(domains.events.records.some(event=>event.id === link.event.event_id));
  }
  assert(Object.keys(provenance.sources).some(k=>k.includes('/entity_sources/item/')));
  assert(Object.keys(provenance.sources).some(k=>k.includes('/photo_idols/')));
  assert(!Object.keys(provenance.sources).some(k=>k.endsWith('reward_catalog.json')));
  const jelly=domains.items.records.find(r=>r.id==='10101').view;
  assert.equal(jelly.media.image.status,'verified-local-file');
  assert.equal(jelly.sources.find(r=>r.sourceTable===83).dayCount,2);
  assert(jelly.sources.find(r=>r.sourceTable===117).campaigns.some(c=>c.term.openAt>0));
  const actor=domains.photos.records.find(r=>r.id==='1').view;
  assert.equal(actor.media.entries['poses:10102'].preset.motion,'weight');
  assert.equal(actor.media.entries['faces:10102001'].preset.face,'face_joy');
  assert.equal(actor.media.models['001tom_002_00'].status,'verified-local-files');
  assert.equal(actor.media.voiceCues.length,5);
});
