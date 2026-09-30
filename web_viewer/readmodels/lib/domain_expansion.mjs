import { assert, pick } from './common.mjs';

export const REVIEWED_DOMAIN_PB = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1';
const photoProductKinds={photoFilter:'filters',photoSticker:'stickers',photoSpot:'spots',photoScene:'scenes',photoFrame:'frames'};
export function domainProductTarget(product,cards,materials){
  if(product?.referenceStatus!=='resolved-entity')return null;
  if(['card','cardFragment'].includes(product.kind)){
    const matches=cards.filter(card=>Number(card.card_id)===product.productId);
    assert(matches.length<=1,'Ambiguous reward card identity');
    return matches.length===1 ? {view:'card_detail',card:matches[0].resource_id} : null;
  }
  const kind=photoProductKinds[product.kind];
  if(kind && materials[kind]?.some(row=>row.id===product.productId))return {view:'photo_catalog',photoEntity:`${kind}:${product.productId}`};
  return null;
}
const sourceKeys = ['relation','eventId','eventKind','scope','totalPoint','upperRank','lowerRank','offsetPoint','intervalPoint','limitPoint','level','episodeId','sectionId','chapterRelation','amount','cardRarityId','idolType','sourceTable','sourceRowId','role','groupId','dayCount','sumFanAmount','sourceDomain'];

export function validateMediaPayload(payload, kind) {
  assert(payload?.schemaVersion === 1 && payload.kind === kind &&
    payload.source?.decodedPbSha256 === REVIEWED_DOMAIN_PB &&
    payload.source?.generatorVersion === 'gs-domain-media-v1', `Archive media source contract: ${kind}`);
  const inspect=value=>{
    if (!value || typeof value!=='object') return;
    for (const [key,child] of Object.entries(value)) {
      if (key==='url') assert(typeof child==='string' && /^\/assets\/(domain-images|bg|spines|voice)\/[a-z0-9_./-]+$/i.test(child) && !child.split('/').includes('..'), 'Unsafe domain media URL');
      if (key==='sha256') assert(/^[a-f0-9]{64}$/.test(child), 'Invalid domain media digest');
      inspect(child);
    }
  };
  inspect(payload);
  return payload;
}

export function validateDomainPayload(payload, kind) {
  assert(payload?.schemaVersion === 1 && payload.kind === kind &&
    payload.source?.decodedPbSha256 === REVIEWED_DOMAIN_PB &&
    payload.source?.generatorVersion === 'gs-archive-domains-v1', `Archive-domain source contract: ${kind}`);
  return payload;
}

/** Offline joins only. Runtime consumers receive bounded, release-pinned leaves. */
export async function applyDomainExpansion(domains, data, readSource) {
  const collectionMedia=validateMediaPayload(data.domainCollectionMedia,'gs-collection-media').entries;
  const photoMedia=validateMediaPayload(data.domainPhotoMedia,'gs-photo-media').entries;
  const loginCampaigns=validateDomainPayload(data.domainLogin,'gs-login-campaign-catalog').entries;
  const events = validateDomainPayload(data.domainEvents, 'gs-event-supplement-index').entries;
  assert(Array.isArray(events) && new Set(events.map(e => e.eventCode)).size === events.length, 'Duplicate event codes');
  const legacy = domains.events.records;
  const legacyByCode = new Map(legacy.map(record => [String(record.view.event.event_code), record]));
  const legacyByChapter = new Map(legacy.map(record => [String(record.id), record]));
  const routeId = event => legacyByCode.get(event.eventCode)?.id || `event:${event.eventCode}`;
  const byCode = new Map(events.map(event => [String(event.id), event]));
  const eventLink = id => {
    const event = byCode.get(String(id));
    assert(event, `Unresolved historical event: ${id}`);
    return { event_id: String(routeId(event)), event_code: event.eventCode, title: event.name };
  };
  domains.events.records = await Promise.all(events.map(async event => {
    const source = validateDomainPayload(await readSource(`data/masterdata/domains/event_details/${event.detailKey}.json`), 'gs-event-detail-supplement');
    assert(String(source.eventId) === String(event.id), 'Event supplement identity mismatch');
    const original = legacyByCode.get(event.eventCode);
    const chapter = event.storyChapterRelations.map(r => legacyByChapter.get(String(r.chapterId))).find(Boolean);
    const base = original || chapter;
    const id = String(routeId(event));
    const identity = original?.view.event || { event_id:id, event_code:event.eventCode, title:event.name,
      release_at:event.term?.openAt || 0, event_scope:'historical', file:chapter?.view.event.file || '',
      exists:!!chapter?.view.event.exists, classification_source:'client-masterdata' };
    const related = events.filter(other => other.id !== event.id && (
      other.storyChapterRelations.some(r => event.storyChapterRelations.some(s => r.chapterId === s.chapterId)) ||
      source.relatedValentineEventIds?.includes(other.id)));
    const seasonal=domains.seasonal.records.filter(row=>String(row.view.campaign.event_code)===event.eventCode);
    assert(seasonal.length<=1,'Ambiguous seasonal event identity');
    if(seasonal.length)assert(seasonal[0].view.campaign.campaign_detail_id===event.eventDetailId,'Seasonal event detail identity mismatch');
    return { id, summary:{ event_id:id, event_code:event.eventCode, title:event.name,
      release_at:event.term?.openAt || 0, event_scope:identity.event_scope,
      eventKind:event.eventKind, isReprint:event.storyChapterRelations.some(r => r.relation === 'reprint'),
      storyAvailable:!!identity.exists }, view:{ event:{...identity,event_id:id},
      masterEvent:data.eventIndex.by_code?.[event.eventCode] || null,
      story:base?.view.story || null, episodes:base?.view.episodes || [], readingEntries:base?.view.readingEntries || [],
      cards:original?.view.cards || [], idols:base?.view.idols || [], units:base?.view.units || [],
      castReferences:base?.view.castReferences || [],
      supplement:{ event, ...source, relatedEvents:related.map(other => eventLink(other.id)),
        seasonalCampaign:seasonal.length?{id:seasonal[0].id,title:seasonal[0].view.campaign.name}:null,
        rewards:source.rewards.map(row=>({...row,product:{...row.product,target:domainProductTarget(row.product,data.domainCards,data.domainPhotoMaterials)}})),
        items:source.items.map(link => ({...link,
          nameJa:data.domainItems.entries.find(item => item.id === link.itemId)?.nameJa || String(link.itemId)})) } } };
  }));
  assert(legacy.every(record => domains.events.records.some(next => next.id === record.id)), 'Lost existing event routes');

  for (const [domain, key, kind] of [['items','domainItems','item'],['honors','domainHonors','honor']]) {
    const catalog = validateDomainPayload(data[key], `gs-${kind}-catalog`).entries;
    assert(Array.isArray(catalog) && new Set(catalog.map(r => r.id)).size === catalog.length, 'Duplicate collection identity');
    const records = await Promise.all(catalog.map(async entry => {
      let sources = { links:[], rewards:[] };
      // Source leaves are generated only for referenced entities; an absent leaf is
      // meaningful partial coverage, never a fabricated acquisition condition.
      const relative = `data/masterdata/domains/entity_sources/${kind}/${entry.id}.json`;
      try { sources = validateDomainPayload(await readSource(relative), 'gs-entity-sources'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      assert(!sources.entityKey || sources.entityKey === entry.key, 'Collection source identity mismatch');
      const rewards = new Map(sources.rewards.map(r => [r.key,r]));
      const links = sources.links.map(link => {
        const reward = rewards.get(link.rewardKey);
        return { ...pick({...reward,...link}, sourceKeys),
          ...(reward ? {amount:reward.product.amount} : {}),
          ...((reward?.sourceTable ?? link.sourceTable) === 117 ? {campaigns:loginCampaigns.filter(campaign=>campaign.campaignLoginBonusProductGroupId===(reward?.groupId ?? link.groupId)).map(campaign=>pick(campaign,['id','type','term']))} : {}),
          ...(link.eventId ? {event:eventLink(link.eventId)} : {}) };
      });
      assert(collectionMedia[entry.key], `Missing collection media binding: ${entry.key}`);
      return { id:String(entry.id), summary:{...pick(entry,['nameJa','name','displayName','itemType','honorType','effectType','resourceId','hasPrefab']),image:pick(collectionMedia[entry.key].image,['url','status'])},
        view:{ entry, media:collectionMedia[entry.key], sources:links, sourceCoverage:'partial-client-masterdata' } };
    }));
    domains[domain] = { searchable:true, packed:true, records };
  }
  validateDomainPayload(data.domainPhotoIndex, 'gs-photo-index');
  const materials = validateDomainPayload(data.domainPhotoMaterials, 'gs-photo-materials');
  const idolsById = new Map(Object.entries(data.idolUnit.by_idol_code).map(([code, idol]) => [idol.idol_id,{code,...idol}]));
  const photoRecords = await Promise.all(data.domainPhotoIndex.actorIds.map(async id => {
    const actor = validateDomainPayload(await readSource(`data/masterdata/domains/photo_idols/${id}.json`), 'gs-photo-idol');
    const media = validateMediaPayload(await readSource(`data/masterdata/domains/photo_media_idols/${id}.json`), 'gs-photo-media-actor');
    assert(media.idolId === id, 'Photo media identity mismatch');
    assert([...actor.faces,...actor.poses].every(row=>media.entries[`${actor.faces.includes(row)?'faces':'poses'}:${row.id}`]?.preset?.label===row.animationName), 'Photo media label mismatch');
    const idol = idolsById.get(id); assert(idol && actor.idolId === id, 'Photo idol identity mismatch');
    return { id:String(id), summary:{ nameJa:idol.display_name, idolCode:idol.code }, view:{actor,media} };
  }));
  domains.photos = { records:[{id:'materials',summary:{nameJa:'摄影素材'},view:{materials,index:data.domainPhotoIndex,media:photoMedia}},...photoRecords] };
  for(const person of photoRecords){
    const idol=domains.idols.records.find(row=>row.id===person.summary.idolCode);
    assert(idol,'Photo profile identity mismatch');
    idol.view.photo={idolId:person.view.actor.idolId,faceCount:person.view.actor.faces.length,poseCount:person.view.actor.poses.length,
      cueCount:person.view.media.voiceCues.length};
  }
}
