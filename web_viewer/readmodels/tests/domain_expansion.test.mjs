import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCheckout } from '../lib/checkout_adapter.mjs';
import { validateDomainPayload, validateMediaPayload, validatePhotoCostumes, REVIEWED_DOMAIN_PB,domainProductTarget } from '../lib/domain_expansion.mjs';
import { sha256 } from '../lib/common.mjs';

test('[local-corpus] costume leaves reject stale dictionaries, omissions, duplicate and wrong model identities', async () => {
  const root = fileURLToPath(new URL('../../public/data/masterdata/', import.meta.url));
  const bytes = await fs.readFile(path.join(root, 'costume_dictionary.json'));
  const dictionary = JSON.parse(bytes), digest = sha256(bytes);
  let models = 0;
  for (let id = 1; id <= 49; id++) {
    const leaf = JSON.parse(await fs.readFile(path.join(root, 'domains/photo_costumes', `${id}.json`)));
    assert.equal(validatePhotoCostumes(leaf, id, dictionary, digest), leaf);
    models += leaf.costumes.length;
  }
  assert.equal(models, 690);
  const sample = JSON.parse(await fs.readFile(path.join(root, 'domains/photo_costumes/5.json')));
  // Numeric costume IDs overlap in the real source. Identity is model + owner,
  // so the valid base costume and SSR both remain present despite sharing ID.
  assert(sample.costumes.filter(row => row.costumeId === 205001).length > 1);
  for (const mutate of [
    leaf => leaf.dictionarySha256 = 'a'.repeat(64),
    leaf => leaf.costumes.pop(),
    leaf => leaf.costumes.push({ ...leaf.costumes[0] }),
    leaf => leaf.costumes[0].idolId = 4,
    leaf => leaf.costumes[0].costumeId = 1,
    leaf => leaf.costumes[0].nameJa = 'invented',
    leaf => leaf.costumes[0].sourceTables = [999],
    leaf => leaf.models.extra = leaf.models[leaf.costumes[0].modelId],
    leaf => leaf.models[leaf.costumes[0].modelId].skeleton.url = '/assets/spines/004ter_001_00/comu.skel',
    leaf => leaf.models[leaf.costumes[0].modelId].textures[0].url = '/assets/spines/004ter_001_00/comu.png',
    leaf => leaf.models[leaf.costumes[0].modelId].animationNames = ['hello', 'hello'],
    leaf => leaf.costumes[0].status = 'model-files-missing',
  ]) {
    const broken = structuredClone(sample);
    mutate(broken);
    assert.throws(() => validatePhotoCostumes(broken, 5, dictionary, digest));
  }
  const renamedDictionary = structuredClone(dictionary);
  renamedDictionary.by_model_resource_id[sample.costumes[0].modelId].costume_name = 'changed';
  assert.throws(() => validatePhotoCostumes(sample, 5, renamedDictionary, digest), /row mismatch/);
});

test('Reward targets require exact canonical cards and typed photo identities',()=>{
  const card={card_id:10,resource_id:'001tom_sr01'},cards=[card],materials={spots:[{id:10}]};
  const product={referenceStatus:'resolved-entity',kind:'card',productId:10};
  assert.deepEqual(domainProductTarget(product,cards,materials),{view:'card_detail',card:'001tom_sr01'});
  assert.deepEqual(domainProductTarget({...product,kind:'photoSpot'},cards,materials),{view:'photo_catalog',photoEntity:'spots:10'});
  assert.equal(domainProductTarget({...product,productId:11},cards,materials),null);
  assert.equal(domainProductTarget({...product,referenceStatus:'missing-entity'},cards,materials),null);
  assert.equal(domainProductTarget({...product,kind:'storyCostume'},cards,materials),null);
  assert.throws(()=>domainProductTarget(product,[card,card],materials),/Ambiguous/);
});

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
  for(const record of domains.events.records){
    const view=record.view;
    assert.equal(view.schemaVersion,2);assert.equal(view.identity.id,record.id);
    assert(!('masterEvent' in view));assert(!('supplement' in view));assert(!('event' in view));
    for(const role of ['banner','logo','background','resultBackground']){
      assert(view.media[role]);assert.equal(view.media[role].sourceField,({banner:'bannerResourceId',logo:'logoResourceId',background:'backgroundResourceId',resultBackground:'resultBgResourceId'})[role]);
    }
    for(const row of view.rewards.general.filter(row=>row.product.presentation.image?.url))assert.match(row.product.presentation.image.url,/^\/assets\//);
  }
  for (const event of manifest.unit_event_relations) {
    const projected = domains.events.records.find(r => r.id === String(event.event_id));
    assert.equal(projected.view.story.entry.file,event.file);
    assert.equal(String(projected.view.identity.eventCode),String(event.event_code));
  }
  const original = domains.events.records.find(r => r.id === '410001');
  const reprint = domains.events.records.find(r => r.id === 'event:10019');
  assert.notEqual(original.id,reprint.id);
  assert.equal(original.view.story.entry.file,reprint.view.story.entry.file);
  assert.equal(reprint.view.provenance.storyChapterRelations[0].chapterId,410001);
  assert.equal(reprint.summary.isReprint,true);
  assert.deepEqual(domains.events.records.filter(r=>r.summary.eventKind === 'collection').map(r=>r.view.provenance.detailTable),Array(17).fill(118));
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
  let ownTotal=0, chocolateTotal=0;
  for(const person of domains.photos.records.filter(row=>row.id!=='materials')){
    assert(person.view.costumes.length>1);
    for(const costume of person.view.costumes){
      assert.equal(costume.idolId,person.view.actor.idolId);
      assert.equal(person.view.media.models[costume.modelId].status,'verified-local-files');
      assert(person.view.media.models[costume.modelId].animationNames.includes('wait_loop'));
    }
    const profile=domains.idols.records.find(row=>row.id===person.summary.idolCode).view.photo;
    assert.equal(profile.idolId,person.view.actor.idolId);
    assert.equal(profile.faceCount,person.view.actor.faces.length);
    assert.equal(profile.poseCount,person.view.actor.poses.length);
    assert.equal(profile.cueCount,person.view.media.voiceCues.length);
    const honors=domains.idols.records.find(row=>row.id===person.summary.idolCode).view.honors;
    const ranking=honors.filter(honor=>honor.group==='ranking'&&honor.kind!=='chocolate'), own=honors.filter(honor=>honor.group==='idol');
    const chocolate=honors.filter(honor=>honor.kind==='chocolate');
    assert.equal(ranking.length,8);
    // Ten VDCP chocolate honors: five counts in each of the two Valentine seasons, filed under the
    // same events as that idol's VDCP ranking honors.
    assert.deepEqual(chocolate.map(honor=>`${honor.sources[0].year}:${honor.sources[0].count}`),
      [2022,2023].flatMap(year=>[100,500,1000,5000,8000].map(count=>`${year}:${count}`)));
    for(const honor of chocolate){
      assert.equal(honor.group,'ranking');
      assert(honor.nameJa.replace(/\s/g,'').includes(`${honor.sources[0].year}/VDCPの${person.summary.nameJa.replace(/\s/g,'')}の渡したチョコ数${honor.sources[0].count}個達成`));
      const sameEvent=ranking.filter(row=>row.sources[0].event.event_id===honor.sources[0].event.event_id);
      assert.equal(sameEvent.length,4,'chocolate honors share the event of the same season ranking honors');
      assert(sameEvent.every(row=>row.nameJa.startsWith(`${honor.sources[0].year}/VDCP`)));
    }
    chocolateTotal+=chocolate.length;
    for(const honor of ranking){
      const entry=domains.honors.records.find(row=>row.view.entry.key===honor.key);
      assert.equal(honor.nameJa,entry.view.entry.nameJa);
      assert(honor.sources.every(source=>source.idolId===profile.idolId && source.scope==='idol-ranking'));
    }
    // Every idol has a 担当 and a catchphrase honor; FES idols add their two achievements.
    assert.deepEqual(own.slice(0,2).map(honor=>honor.kind),['tantou','catchphrase']);
    assert([2,4].includes(own.length));
    for(const honor of own) assert.equal(String(honor.id).slice(1,3),person.summary.idolCode.slice(1,3));
    ownTotal+=own.length;
  }
  assert.equal(ownTotal,122,'all 122 idol honors reach exactly one idol');
  assert.equal(chocolateTotal,490,'all 490 chocolate honors reach exactly one idol');
  for(const domain of ['items','honors'])for(const row of domains[domain].records)assert.equal(row.summary.image.url,row.view.media.image.url);
  let linkedCards=0,linkedPhotos=0;
  for(const event of domains.events.records)for(const row of event.view.rewards.general){
    const target=row.product.target;if(!target)continue;
    if(target.view==='card_detail'){linkedCards++;assert(product.cards.some(card=>card.resource_id===target.card && Number(card.card_id)===row.product.productId))}
    else{linkedPhotos++;assert.match(target.photoEntity,/^(spots|scenes|stickers|frames|filters):\d+$/)}
  }
  assert(linkedCards>0);assert(linkedPhotos>0);
  const seasonal=domains.events.records.filter(row=>row.view.seasonalCampaign);assert.equal(seasonal.length,4);
  for(const event of seasonal){const campaign=domains.seasonal.records.find(row=>row.id===event.view.seasonalCampaign.id);assert.equal(String(campaign.view.campaign.event_code),event.view.identity.eventCode);assert.equal(campaign.view.campaign.campaign_detail_id,event.view.identity.eventDetailId)}
});
