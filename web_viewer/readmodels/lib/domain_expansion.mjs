import { assert, pick } from './common.mjs';
import { wikiSource, wikiEventRewards, eventMissionLabel } from './wiki_acquisition.mjs';
import { idolHonorIdentity, idolHonorBelongsTo, idolHonorOrder, chocolateHonorIdentity, chocolateHonorBelongsTo } from '../../src/presentation/HonorIdentity.mjs';

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
const sourceKeys = ['relation','eventId','eventKind','scope','totalPoint','upperRank','lowerRank','offsetPoint','intervalPoint','limitPoint','level','episodeId','sectionId','chapterRelation','amount','cardRarityId','idolId','idolType','sourceTable','sourceRowId','role','groupId','dayCount','sumFanAmount','sourceDomain'];

/** Cards.limitbreak_item_id is an explicit Items foreign key, not an untyped
 * Product ID or an image number. Keep this relation separate from rewards. */
export function projectCardLimitbreakMaterials(cards, items, collectionMedia, cardImages = {}) {
  assert(Array.isArray(cards) && Array.isArray(items), 'Missing card/material projection inputs');
  assert(new Set(cards.map(card => card.resource_id)).size === cards.length &&
    cards.every(card => typeof card.resource_id === 'string' && /^[a-z0-9_]+$/.test(card.resource_id)),
    'Ambiguous card material resource identity');
  assert(new Set(items.map(item => item.id)).size === items.length &&
    items.every(item => Number.isInteger(item.id) && item.id > 0 && item.key === `item:${item.id}`),
    'Item catalog typed identity mismatch');
  const byId = new Map(items.map(item => [item.id, item]));
  const materialContexts = {}, usageCardsByItem = {};
  for (const card of cards) {
    materialContexts[card.resource_id] = null;
    const id = card.limitbreak_item_id, embedded = card.limitbreak_item, entry = byId.get(id);
    if (!Number.isInteger(id) || id <= 0 || !entry || embedded?.id !== id ||
        typeof entry.resourceId !== 'string' || !entry.resourceId || embedded.resource_id !== entry.resourceId ||
        typeof entry.nameJa !== 'string' || !entry.nameJa.trim() || embedded.name !== entry.nameJa) continue;
    const binding = collectionMedia?.[entry.key]?.image;
    materialContexts[card.resource_id] = {
      key: entry.key, kind: 'item', id, nameJa: entry.nameJa,
      description: entry.descriptionText?.plain ?? entry.description ?? '',
      resourceId: entry.resourceId, referenceStatus: 'resolved-entity',
      image: binding ? pick(binding, ['url','status','sha256','bytes','width','height','runtimeVerified']) : null,
    };
    const image = cardImages[card.resource_id];
    (usageCardsByItem[entry.key] ||= []).push({
      ...pick(card, ['resource_id','card_id','character_id','rarity','title']),
      image: image ? pick(image, ['url','status']) : null,
      target: { view:'card_detail', card:card.resource_id },
    });
  }
  return { materialContexts, usageCardsByItem };
}

/** An event's BGM resource names its song (`bgm_<song_code>_inst`); a reprint reuses the original's.
 * Returns each event's songs and, per song, its events (premiere first, then reprints by start). */
export function projectEventSongs(eventRecords, songs) {
  assert(Array.isArray(eventRecords) && songs && typeof songs === 'object', 'Missing event/song projection inputs');
  const eventSongs = {}, songEvents = {};
  for (const record of eventRecords) {
    const view = record.view, match = /^bgm_([a-z0-9]{6})_inst$/.exec(view.media?.bgm?.resourceId || '');
    const song = match ? songs[match[1]] : null;
    assert(!match || song, `Event BGM names an unknown song: ${view.media.bgm.resourceId}`);
    eventSongs[record.id] = song ? [{ song_code:song.song_code, title:song.title, jacket_url:song.jacket_url || '',
      unit_name:song.performance_mapping?.confirmed_unit?.unit_name || '' }] : [];
    if (song) (songEvents[song.song_code] ||= []).push({ event_id:record.id, event_code:view.identity.eventCode,
      title:view.identity.title, kind:view.identity.kind, isReprint:!!view.identity.isReprint,
      startAt:view.period?.startAt ?? null, banner:view.media.banner ? pick(view.media.banner, ['url','status']) : null });
  }
  for (const [code, events] of Object.entries(songEvents)) {
    events.sort((a, b) => a.isReprint - b.isReprint || (a.startAt ?? 0) - (b.startAt ?? 0));
    assert(events.filter(event => !event.isReprint).length === 1, `Song ${code} needs exactly one premiere event`);
  }
  for (const song of Object.values(songs)) if (song.gameplay?.history?.historicalKind === 'event')
    assert(songEvents[song.song_code], `Event-premiered song has no event BGM: ${song.song_code}`);
  return { eventSongs, songEvents };
}

export function validateMediaPayload(payload, kind) {
  assert(payload?.schemaVersion === 1 && payload.kind === kind &&
    payload.source?.decodedPbSha256 === REVIEWED_DOMAIN_PB &&
    payload.source?.generatorVersion === 'gs-domain-media-v1', `Archive media source contract: ${kind}`);
  const inspect=value=>{
    if (!value || typeof value!=='object') return;
    for (const [key,child] of Object.entries(value)) {
      if (key==='url') assert(typeof child==='string' && /^\/assets\/(domain-images|bg|spines|voice|cards)\/[a-z0-9_./-]+$/i.test(child) && !child.split('/').includes('..'), 'Unsafe domain media URL');
      if (key==='sha256') assert(/^[a-f0-9]{64}$/.test(child), 'Invalid domain media digest');
      inspect(child);
    }
  };
  inspect(payload);
  return payload;
}

const safeMediaUrl = url => typeof url === 'string' && /^\/assets\/domain-images\/image\/(image_item|image_costume_icon)\/[a-z0-9_./-]+\.png$/i.test(url) && !url.split('/').includes('..');
const imageBinding = image => image?.status === 'verified-local-file'
  ? (assert(safeMediaUrl(image.url) && /^[a-f0-9]{64}$/.test(image.sha256), 'Unsafe collection image binding'), pick(image, ['url','status','sha256','bytes','width','height','runtimeVerified']))
  : { status: image?.status || 'file-not-found', runtimeVerified: false };

/** Currencies and resources (config/currency-catalog.v1.json): product types and the two memory items. */
export function validateCurrencyCatalog(payload) {
  assert(payload?.schemaVersion === 1 && payload.kind === 'gs-currency-catalog' &&
    payload.source?.decodedPbSha256 === REVIEWED_DOMAIN_PB && payload.source?.generatorVersion === 'gs-currency-catalog-v1',
    'Currency catalog source contract');
  const entries = payload.entries;
  assert(Array.isArray(entries) && entries.length > 0 && new Set(entries.map(e => e.key)).size === entries.length &&
    entries.every(e => /^[a-z-]+$/.test(e.id) && e.key === `currency:${e.id}` && (Number.isInteger(e.productType) !== /^item:\d+$/.test(e.itemKey || '')) &&
      typeof e.nameJa === 'string' && e.nameJa && Array.isArray(e.acquisition) && Array.isArray(e.usage)), 'Currency catalog identity');
  assert(new Set(entries.filter(e => e.productType).map(e => e.productType)).size === entries.filter(e => e.productType).length, 'Duplicate currency product type');
  return payload;
}

/** One costume model per entry, with the cards that wear it (scripts/generate-costume-catalog.py). */
export function validateCostumeCatalog(payload) {
  assert(payload?.schemaVersion === 1 && payload.kind === 'gs-costume-catalog' && payload.source?.generatorVersion === 'gs-costume-catalog-v1',
    'Costume catalog source contract');
  const entries = payload.entries;
  // idolCode is the wearer the StoryCostumes/LiveCostumes row names. It usually matches the model's prefix, but the
  // Aoi twins' story rows swap models (012yus wears 013kys_004_00 and back), so only the shape is checked here.
  assert(Array.isArray(entries) && entries.length > 0 && new Set(entries.map(e => e.key)).size === entries.length &&
    entries.every(e => /^[0-9]{3}[a-z]{3}_[0-9]{3}_[0-9]{2}$/.test(e.id) && e.key === `costume:${e.id}` && /^[0-9]{3}[a-z]{3}$/.test(e.idolCode) &&
      Array.isArray(e.cards) && Array.isArray(e.uses) && e.uses.length > 0), 'Costume catalog identity');
  return payload;
}

export function validateDomainPayload(payload, kind) {
  assert(payload?.schemaVersion === 1 && payload.kind === kind &&
    payload.source?.decodedPbSha256 === REVIEWED_DOMAIN_PB &&
    payload.source?.generatorVersion === 'gs-archive-domains-v1', `Archive-domain source contract: ${kind}`);
  return payload;
}

/** A PB stamp alone does not prove that a costume leaf used this dictionary. */
export function validatePhotoCostumes(payload, idolId, dictionary, dictionarySha256) {
  validateMediaPayload(payload, 'gs-photo-costumes');
  assert(/^[a-f0-9]{64}$/.test(dictionarySha256 || '') && payload.dictionarySha256 === dictionarySha256,
    'Photo costume dictionary digest mismatch');
  assert(payload.idolId === idolId && Array.isArray(payload.costumes) && payload.models && typeof payload.models === 'object',
    'Photo costume identity mismatch');
  const expected = new Map(Object.values(dictionary.by_model_resource_id)
    .filter(row => row.idol_numeric_id === idolId).map(row => [row.model_resource_id, row]));
  const actual = payload.costumes.map(row => row.modelId);
  assert(expected.size > 0 && actual.length === expected.size && new Set(actual).size === actual.length &&
    actual.every(id => expected.has(id)) && Object.keys(payload.models).length === expected.size &&
    Object.keys(payload.models).every(id => expected.has(id)), 'Photo costume dictionary coverage mismatch');
  for (const row of payload.costumes) {
    const source = expected.get(row.modelId), model = payload.models[row.modelId];
    assert(row.idolId === idolId && row.costumeId === source.costume_id &&
      row.nameJa === ((source.costume_name || '').trim() || source.model_resource_id) &&
      JSON.stringify(row.sourceTables) === JSON.stringify(source.source_tables), 'Photo costume dictionary row mismatch');
    assert(model && row.status === model.status && ['verified-local-files','model-files-missing','atlas-texture-missing'].includes(model.status),
      'Photo costume model status mismatch');
    if (model.status !== 'verified-local-files') continue;
    const prefix = `/assets/spines/${row.modelId}/`;
    assert(model.atlas?.url === `${prefix}comu.atlas` && model.skeleton?.url === `${prefix}comu.skel` &&
      Array.isArray(model.textures) && model.textures.length > 0 &&
      model.textures.every(texture => texture.status === 'verified-local-file' && texture.url?.startsWith(prefix)),
      'Photo costume model resource identity mismatch');
    assert(Array.isArray(model.animationNames) && model.animationNames.length > 0 &&
      model.animationNames.every(name => typeof name === 'string' && name.length > 0) &&
      new Set(model.animationNames).size === model.animationNames.length, 'Photo costume animation inventory mismatch');
  }
  return payload;
}

/** Offline joins only. Runtime consumers receive bounded, release-pinned leaves. */
export async function applyDomainExpansion(domains, data, readSource, { costumeDictionarySha256 }) {
  const collectionMedia=validateMediaPayload(data.domainCollectionMedia,'gs-collection-media').entries;
  const photoMedia=validateMediaPayload(data.domainPhotoMedia,'gs-photo-media').entries;
  const eventMedia=validateMediaPayload(data.domainEventMedia,'gs-event-media');
  const loginCampaigns=validateDomainPayload(data.domainLogin,'gs-login-campaign-catalog').entries;
  const currencies=validateCurrencyCatalog(data.domainCurrencies).entries;
  // A reward that is only a product type (Star Gems, Money) is shown as its currency entry.
  const currencyByType=new Map(currencies.filter(entry=>entry.productType).map(entry=>[entry.productType,entry]));
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
  const wikiRewards = wikiEventRewards(data.wikiAcquisition, data.eventExchange);
  const eventAcquisitions = {};
  const acquire = (resourceId, entry) => (eventAcquisitions[resourceId] ||= []).push(entry);
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
    const rewards=source.rewards.map(row=>{
      const target=domainProductTarget(row.product,data.domainCards,data.domainPhotoMaterials);
      const card=target?.view==='card_detail'?data.domainCards.find(card=>card.resource_id===target.card):null;
      const currency=row.product.kind==='scalar'?currencyByType.get(row.product.typeCode):null;
      const image=collectionMedia[row.product.entityKey]?.image || (target?.photoEntity?photoMedia[target.photoEntity]?.image:null) || (card?eventMedia.cardImages[card.resource_id]:null) ||
        (currency?.image.status==='verified-local-file'?currency.image:null);
      return {...row,product:{...row.product,target,...(currency?{currencyKey:currency.key}:{}),presentation:{name:row.product.nameJa || card?.title || row.product.typeNameJa,image:image?pick(image,['url','status','sha256']):null,target:target || (['item','honor'].includes(row.product.kind)&&row.product.referenceStatus==='resolved-entity'?{view:'collection_catalog',entity:row.product.entityKey}:null) ||
        (currency?{view:'collection_catalog',entity:currency.key}:null)}}};
    });
    const rewardCards=new Map();
    for(const row of rewards.filter(row=>row.product.kind==='card'&&row.product.target)){
      const card=data.domainCards.find(card=>card.resource_id===row.product.target.card);
      if(!rewardCards.has(card.resource_id))rewardCards.set(card.resource_id,{card_resource_id:card.resource_id,card_title:card.title,character_id:card.character_id,character_name:data.idolUnit.by_idol_code[card.character_id]?.display_name,rarity:card.rarity,image:row.product.presentation.image,methods:[]});
      rewardCards.get(card.resource_id).methods.push({key:row.key,kind:row.scope.startsWith('story')?'story':'point',label:row.scope.startsWith('story')?`剧情 ${row.episodeId} 阅读报酬${row.scope==='story-in-event-term'?'（活动期内）':''}`:`${row.totalPoint?.toLocaleString('zh-CN') ?? '未记录'} PT 获得卡片`});
    }
    for(const card of rewardCards.values()){
      const fragments=rewards.filter(row=>row.product.kind==='cardFragment'&&row.product.target?.card===card.card_resource_id);
      if(fragments.length)card.methods.push({key:`fragments-${card.card_resource_id}`,kind:'point',label:`${fragments[0].totalPoint?.toLocaleString('zh-CN')} PT 起，共 ${fragments.length} 次碎片报酬`});
    }
    // Wikiwiki's 限定報酬 list: the reward table must be part of it; the rest are mission or exchange cards.
    const wiki=wikiRewards.get(event.eventCode);
    let wikiCheck=null;
    if(wiki){
      const listed=new Set(wiki.row.cards.map(card=>card.resource_id));
      assert([...rewardCards.keys()].every(id=>listed.has(id)),`Reward table outside the wiki listing: ${event.eventCode}`);
      wikiCheck={source:wikiSource(data.wikiAcquisition,'past_events'),listedCards:listed.size};
      for(const entry of wiki.row.cards.filter(card=>card.mission)){
        const card=data.domainCards.find(card=>card.resource_id===entry.resource_id);
        assert(card&&!rewardCards.has(card.resource_id),`Unresolved wiki mission card: ${entry.resource_id}`);
        rewardCards.set(card.resource_id,{card_resource_id:card.resource_id,card_title:card.title,character_id:card.character_id,character_name:data.idolUnit.by_idol_code[card.character_id]?.display_name,rarity:card.rarity,
          image:eventMedia.cardImages[card.resource_id]?pick(eventMedia.cardImages[card.resource_id],['url','status','sha256']):null,
          methods:[{key:`wiki-mission:${card.resource_id}`,kind:'mission',label:eventMissionLabel(entry.mission.condition),condition:entry.mission.condition,term:entry.mission.term,source:wikiSource(data.wikiAcquisition,entry.source)}]});
      }
    }
    for(const card of rewardCards.values())acquire(card.card_resource_id,{event_id:id,event_code:event.eventCode,title:event.name,kind:event.eventKind,release_at:event.term?.openAt||0,
      methods:card.methods.map(method=>({kind:method.kind,label:method.kind==='story'?'活动剧情阅读报酬':method.label})),
      basis:card.methods.some(method=>method.kind==='mission')?'wiki':'masterdata',source:wikiCheck?.source||null});
    for(const card of wiki?.exchange?.cards||[])acquire(card.resourceId,{event_id:id,event_code:event.eventCode,title:event.name,kind:event.eventKind,release_at:event.term?.openAt||0,
      methods:[{kind:'exchange',label:`${card.cost.nameJa} × ${card.cost.amount} 兑换（限 ${card.exchangeLimit} 次）`}],basis:'wiki',source:pick(wiki.exchange.source,['title','url','checkedAt'])});
    const media=eventMedia.entries[`event:${event.id}`];assert(media,'Missing event media identity');
    const cast=base?.view.idols || [];
    return { id, summary:{ event_id:id, event_code:event.eventCode, title:event.name,
      release_at:event.term?.openAt || 0, event_scope:identity.event_scope,
      eventKind:event.eventKind, isReprint:event.storyChapterRelations.some(r => r.relation === 'reprint'),
      storyAvailable:!!identity.exists,image:pick(media.banner,['url','status']) }, view:{schemaVersion:2,
      identity:{id,eventCode:event.eventCode,title:event.name,kind:event.eventKind,isReprint:event.storyChapterRelations.some(r=>r.relation==='reprint'),scope:identity.event_scope,attribute:identity.attribute || null,eventDetailId:event.eventDetailId},
      period:{startAt:event.term?.openAt??null,endAt:event.term?.closeAt??null,displayEndAt:event.displayTerm?.closeAt??null,exchangeEndAt:event.exchangeTerm?.closeAt??null},media,
      story:{...(base?.view.story || {}),entry:{...identity,event_id:id},available:!!identity.exists}, episodes:base?.view.episodes || [], readingEntries:base?.view.readingEntries || [],
      cards:original?.view.cards || [], cast, units:base?.view.units || [],
      castReferences:base?.view.castReferences || [],
      relatedEvents:related.map(other => eventLink(other.id)),
        seasonalCampaign:seasonal.length?{id:seasonal[0].id,title:seasonal[0].view.campaign.name}:null,
      rewards:{cards:[...rewardCards.values()],wikiCheck,general:rewards,materials:source.items.map(link=>({...link,nameJa:data.domainItems.entries.find(item=>item.id===link.itemId)?.nameJa || String(link.itemId),image:pick(collectionMedia[`item:${link.itemId}`]?.image || {},['url','status'])}))},
      provenance:{eventId:event.id,detailTable:source.sourceTable,coverage:source.coverage,storyChapterRelations:event.storyChapterRelations} } };
  }));
  assert(legacy.every(record => domains.events.records.some(next => next.id === record.id)), 'Lost existing event routes');
  const { eventSongs, songEvents } = projectEventSongs(domains.events.records, data.songCatalog.songs);
  for (const record of domains.events.records) record.view.songs = eventSongs[record.id];

  const materialRelations = projectCardLimitbreakMaterials(data.domainCards,
    validateDomainPayload(data.domainItems, 'gs-item-catalog').entries, collectionMedia, eventMedia.cardImages);

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
        view:{ entry, media:collectionMedia[entry.key], sources:links, sourceCoverage:'partial-client-masterdata',
          ...(kind === 'item' ? { usageCards:materialRelations.usageCardsByItem[entry.key] || [] } : {}) } };
    }));
    domains[domain] = { searchable:true, packed:true, records };
  }
  const gashaLink=row=>({...pick(row,['gashaId','titleJa','url']),target:{view:'gasha_detail',gasha:row.gashaId}});
  domains.currencies = { searchable:true, packed:true, records:currencies.map(entry=>{
    const image=imageBinding(entry.image);
    if(entry.itemKey)assert(domains.items.records.some(record=>record.view.entry.key===entry.itemKey),`Currency names a missing item: ${entry.itemKey}`);
    return { id:entry.id, summary:{nameJa:entry.nameJa,resourceId:entry.resourceId,productType:entry.productType ?? null,itemKey:entry.itemKey ?? null,rewardCount:entry.rewardCount,image:pick(image,['url','status'])},
      view:{ entry:{key:entry.key,id:entry.id,nameJa:entry.nameJa,descriptionJa:entry.descriptionJa,resourceId:entry.resourceId,productType:entry.productType ?? null,itemKey:entry.itemKey ?? null},
        media:{image}, rewardCount:entry.rewardCount,
        acquisition:entry.acquisition.map(group=>({...pick(group,['source','count','totalAmount','levelRange']),
          ...(group.events?{events:group.events.map(row=>({...eventLink(row.eventId),count:row.count,totalAmount:row.totalAmount}))}:{})})),
        gashaSources:entry.gashaSources.map(group=>({...group,...(group.gashas?{gashas:group.gashas.map(gashaLink)}:{})})),
        usage:entry.usage.map(line=>({...line,...(line.gashas?{gashas:line.gashas.map(row=>({...gashaLink(row),...pick(row,['prices','steps','paidOnlyOffers','exchanges'])}))}:{})})),
        sourceCoverage:'client-masterdata-rewards-and-wiki-gasha-pages' } };
  }) };
  const costumeCatalog=validateCostumeCatalog(data.domainCostumes).entries;
  const cardsByResource=new Map(data.domainCards.map(card=>[card.resource_id,card]));
  domains.costumes = { searchable:true, packed:true, records:costumeCatalog.map(entry=>{
    const image=imageBinding(entry.image);
    // Tutorial copies share their resource id with the real card and are not published.
    const cards=entry.cards.filter(row=>cardsByResource.has(row.resourceId)).map(row=>{
      const card=cardsByResource.get(row.resourceId),art=eventMedia.cardImages[card.resource_id];
      return {...pick(card,['resource_id','card_id','character_id','rarity','title']),slots:row.slots,image:art?pick(art,['url','status']):null,target:{view:'card_detail',card:card.resource_id}};
    });
    return { id:entry.id, summary:{nameJa:entry.nameJa,idolCode:entry.idolCode,uses:entry.uses,cardCount:cards.length,releaseAt:entry.releaseAt ?? null,image:pick(image,['url','status'])},
      view:{ entry:pick(entry,['key','id','idolCode','idolId','nameJa','descriptionJa','releaseAt','costumeIds','uses','spineAvailable']), media:{image}, cards } };
  }) };
  validateDomainPayload(data.domainPhotoIndex, 'gs-photo-index');
  const materials = validateDomainPayload(data.domainPhotoMaterials, 'gs-photo-materials');
  const idolsById = new Map(Object.entries(data.idolUnit.by_idol_code).map(([code, idol]) => [idol.idol_id,{code,...idol}]));
  const photoRecords = await Promise.all(data.domainPhotoIndex.actorIds.map(async id => {
    const actor = validateDomainPayload(await readSource(`data/masterdata/domains/photo_idols/${id}.json`), 'gs-photo-idol');
    const media = validateMediaPayload(await readSource(`data/masterdata/domains/photo_media_idols/${id}.json`), 'gs-photo-media-actor');
    const costumes=validatePhotoCostumes(await readSource(`data/masterdata/domains/photo_costumes/${id}.json`),id,
      data.costumeDictionary,costumeDictionarySha256);
    assert(media.idolId === id, 'Photo media identity mismatch');
    assert([...actor.faces,...actor.poses].every(row=>media.entries[`${actor.faces.includes(row)?'faces':'poses'}:${row.id}`]?.preset?.label===row.animationName), 'Photo media label mismatch');
    const idol = idolsById.get(id); assert(idol && actor.idolId === id, 'Photo idol identity mismatch');
    return { id:String(id), summary:{ nameJa:idol.display_name, idolCode:idol.code }, view:{actor,costumes:costumes.costumes,media:{...media,models:{...media.models,...costumes.models}}} };
  }));
  domains.photos = { records:[{id:'materials',summary:{nameJa:'摄影素材'},view:{materials,index:data.domainPhotoIndex,media:photoMedia}},...photoRecords] };
  for(const person of photoRecords){
    const idol=domains.idols.records.find(row=>row.id===person.summary.idolCode);
    assert(idol,'Photo profile identity mismatch');
    idol.view.photo={idolId:person.view.actor.idolId,faceCount:person.view.actor.faces.length,poseCount:person.view.actor.poses.length,
      cueCount:person.view.media.voiceCues.length};
    // Two independent links: the idol's own honors decode from the honor id (担当, catchphrase, FES
    // achievements); event ranking honors name the idol in their ranking configuration.
    const honorLink=(honor,group,extra)=>({key:honor.view.entry.key,id:honor.view.entry.id,nameJa:honor.view.entry.nameJa,
      resourceId:honor.view.entry.resourceId,openAt:honor.view.entry.openAt,image:pick(honor.summary.image,['url','status']),group,...extra});
    const own=domains.honors.records.filter(honor=>idolHonorBelongsTo(honor.view.entry,person.summary.idolCode))
      .map(honor=>honorLink(honor,'idol',{kind:idolHonorIdentity(honor.view.entry).kind}))
      .sort((a,b)=>idolHonorOrder(a.kind)-idolHonorOrder(b.kind));
    const ranking=domains.honors.records.filter(honor=>honor.view.sources.some(source=>source.idolId===person.view.actor.idolId)).map(honor=>honorLink(honor,'ranking',{
      sources:honor.view.sources.filter(source=>source.idolId===person.view.actor.idolId).map(source=>pick(source,['idolId','scope','upperRank','lowerRank','event']))}));
    // VDCP chocolate honors have no ranking configuration; the id names idol, season and count, and
    // the season is that year's Valentine event, so they sit beside its ranking honors.
    const chocolate=domains.honors.records.filter(honor=>chocolateHonorBelongsTo(honor.view.entry,person.summary.idolCode)).map(honor=>{
      const {year,count,eventId}=chocolateHonorIdentity(honor.view.entry);
      return honorLink(honor,'ranking',{kind:'chocolate',sources:[{idolId:person.view.actor.idolId,scope:'chocolate',year,count,event:eventLink(eventId)}]});
    }).sort((a,b)=>a.id-b.id);
    assert(!own.some(honor=>ranking.some(row=>row.key===honor.key)),'An honor cannot be both an idol honor and a ranking honor');
    assert(!chocolate.some(honor=>ranking.some(row=>row.key===honor.key)),'A chocolate honor cannot also be a ranking honor');
    idol.view.honors=[...own,...ranking,...chocolate];
  }
  return { materialContexts: materialRelations.materialContexts, songEvents, eventAcquisitions };
}
