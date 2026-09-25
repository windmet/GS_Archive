import { ArtifactWriter, assert, entityKey, pick, stripEvidence, jsonBytes } from './common.mjs';

/** Pure-projection output consumes existing checkout selectors; it never reinterprets RAW commands. */
export async function writeReadModels(root, release, product, provenance = {}) {
  const writer = new ArtifactWriter(root, release);
  const domains = {}; const coverage = {};
  const detailIds = new Set();
  const detail = async (domain, id, data, kind = `${domain}.detail`) => {
    assert(id !== undefined && id !== null && String(id), `Missing ${domain} id`);
    const name = `${domain}/detail/${entityKey(id)}.json`;
    assert(!detailIds.has(name), `Duplicate/colliding ${domain} identity: ${id}`); detailIds.add(name);
    return writer.emit(name, kind, { id: String(id), ...data });
  };
  async function directory(domain, rows, { searchRows = null, meta = {} } = {}) {
    const pages = await writer.pages(`${domain}/catalog`, `${domain}.page`, rows);
    const searchPages = searchRows ? await writer.pages(`${domain}/search`, `${domain}.search`, searchRows) : [];
    domains[domain] = await writer.emit(`${domain}/index.json`, `${domain}.index`,
      { count: rows.length, pages, searchCount: searchRows?.length || 0, searchPages, ...meta }, { maxRaw: 128 * 1024 });
    coverage[domain] = { rows: rows.length, pages: pages.length, searchPages: searchPages.length };
  }

  // Home: same availability and source cue ordering as buildArchiveHomeState.
  const idolRows = [];
  for (const home of product.home) {
    assert(home.id && Array.isArray(home.cues) && home.cues.length, 'Home availability must come from actual home cues');
    const cuePages = await writer.pages(`home/cues/${entityKey(home.id)}`, 'home.cues', stripEvidence(home.cues), { maxRows: 16 });
    const cueIndex = [];
    let cursor = 0;
    // Reconstruct exact page membership using writer output, not a guessed 16-row split.
    const fs = await import('node:fs/promises'); const path = await import('node:path');
    for (const descriptor of cuePages) {
      const body = JSON.parse(await fs.readFile(path.join(root, 'pages', descriptor.url.slice(1)), 'utf8'));
      for (const cue of body.data.rows) { cueIndex.push({ ...pick(cue, ['id', 'cue', 'cardId', 'cardTitle', 'rarity', 'modelId']), page: descriptor }); cursor++; }
    }
    assert(cursor === home.cues.length, 'Lost home cue');
    const profile = stripEvidence(Object.fromEntries(Object.entries(home).filter(([key]) => key !== 'cues')));
    const descriptor = await detail('home', home.id, { profile, cueIndex, first: cuePages[0] });
    idolRows.push({ ...pick(home, ['id', 'name', 'kana', 'unitId', 'unitCode', 'unitName', 'color']), home_available: true, detail: descriptor });
  }
  domains.home = await writer.emit('home/index.json', 'home.index', {
    idols: idolRows, stats: product.homeStats || [], highlights: stripEvidence(product.homeHighlights || []),
  }, { maxRaw: 128 * 1024 });
  coverage.home = { idols: idolRows.length, cues: product.home.reduce((n, h) => n + h.cues.length, 0) };

  const cardRows = [], cardSearch = [];
  for (const card of product.cards) {
    const id = card.resource_id;
    const context = product.cardContext?.[id] || {};
    const descriptor = await detail('cards', id, { card: stripEvidence(card), ...stripEvidence(context) });
    const row = { ...pick(card, ['resource_id','card_id','character_id','rarity','ordinal','title','title_full','release_at','single_state']), id,
      has_story: !!card.scenario_entries?.length, has_home_voice: !!card.home_voice_cues?.length,
      scenario_count: card.scenario_entries?.length || 0, home_voice_count: card.home_voice_cues?.length || 0,
      release_series_id: card.release_series?.series_id || null,
      // Consumers must use these explicit booleans, not ask for the old entire index.
      has_event_relation: !!context.eventRelation, has_gasha_relation: !!context.gashaRelation,
      has_release_series: !!card.release_series, asset_status: context.assetStatus || null, ownerReference:context.ownerReference || null, detail: descriptor };
    cardRows.push(row);
    cardSearch.push({ ...pick(row, ['id','resource_id','character_id','rarity','title','title_full','release_at','single_state','has_story','has_home_voice','scenario_count','home_voice_count','release_series_id','has_event_relation','has_gasha_relation','has_release_series','asset_status']), detail: descriptor });
  }
  await directory('cards', cardRows, { searchRows: cardSearch });

  const storyRows = [], storySearch = [];
  for (const story of product.stories) {
    const descriptor = await detail('stories', story.id, { story: stripEvidence(story) });
    const row = { ...pick(story, ['id','file','title','subtitle','domain','domainLabel','exists','releaseAt','unitId','unitName','sectionId','sectionLabel','episodeLabel','resourceId','playableStartIndex','playableStepCount','eventScope','eventScopeLabel','rewardCardIds']), detail: descriptor };
    storyRows.push(row);
    storySearch.push({ ...pick(row, ['id','file','title','subtitle','domain','exists','unitId','sectionId']),
      resourceIds: story.resourceIds || [], characters: story.characters || [], detail: descriptor });
  }
  await directory('stories', storyRows, { searchRows: storySearch });

  const songRows = [];
  for (const song of product.songs) {
    const descriptor = await detail('songs', song.song_code, { song: stripEvidence(song), view:product.songViews?.[song.song_code]||null,
      playback: product.playback?.[song.song_code] || null,
      experimental: product.experimental?.[song.song_code] || null });
    if (song.variant_kind !== 'primary') continue;
    songRows.push({ ...pick(song, ['song_code','title','kana','credits','song_id','audio_form','jacket_url','variant_kind']),
      movies: (song.movies || []).map(m => pick(m, ['kind'])),
      variants: (song.variants || []).map(v => pick(v, ['song_code','title','archive_status'])), detail: descriptor });
  }
  songRows.sort((a, b) => (a.song_id || 0) - (b.song_id || 0));
  await directory('songs', songRows, { searchRows: songRows, meta: { summary: product.songSummary || {} } });

  const gashaRows = [];
  for (const gasha of product.gashas) {
    const descriptor = await detail('gashas', gasha.id, { gasha: stripEvidence(gasha) });
    if (product.gashaCatalogIds && !product.gashaCatalogIds.includes(String(gasha.id))) continue;
    gashaRows.push({ ...pick(gasha, ['id','code','primary_code','display_name','category','banner_url','start_at','end_at','phase','is_reprint','related_pickup_count']),
      // Search and catalog card counts belong to the directory; full evidence stays in detail.
      derived_pickup_cards:(gasha.derived_pickup_cards || []).map(card=>pick(card,['card_resource_id','card_title','character_id','rarity'])),
      related_pickup_cards:(gasha.related_pickup_cards || []).map(card=>pick(card,['card_resource_id','card_title','character_id','rarity'])),
      detail: descriptor });
  }
  await directory('gashas', gashaRows, { searchRows: gashaRows, meta: { summary: product.gashaSummary || {} } });

  // Other route products are generated by explicit adapters. Generic whole-index forwarding is forbidden.
  for (const [domain, value] of Object.entries(product.extraDomains || {})) {
    assert(/^[a-z-]+$/.test(domain) && !Object.hasOwn(domains, domain), `Invalid extra domain: ${domain}`);
    const rows = [];
    for (const record of value.records) {
      const descriptor = await detail(domain, record.id, { view: stripEvidence(record.view) });
      rows.push({ id: String(record.id), ...record.summary, detail: descriptor });
    }
    await directory(domain, rows, { searchRows: value.searchable ? rows : null });
  }

  const bootstrap = {
    schema_version: 1, release, read_model_version: 1,
    // Home eligibility is preserved; general directory users are not filtered out.
    idols: product.identities.map(profile => ({ ...pick(profile, ['id','name','kana','unitId','unitCode','unitName','color']),
      home_available: idolRows.some(row => row.id === profile.id) })),
    counts: { canonical_cards: cardRows.length, catalog_story_entries: storyRows.length, primary_songs: songRows.length,
      home_available_idols: idolRows.length, primary_gashas: gashaRows.length },
    domains,
    // These are source release contracts, NOT a fabricated claim that media is versioned by this read-model digest.
    legacy: { data_revision: provenance.dataRevision || null, media_epoch: provenance.mediaEpoch || null },
  };
  assert(jsonBytes(bootstrap).length <= 64 * 1024, 'Bootstrap must fit 64 KiB decoded; never embed domain-wide descriptors');
  const fs = await import('node:fs/promises'); const path = await import('node:path');
  await fs.mkdir(path.join(root, 'pages', '_catalog'), { recursive: true });
  await fs.writeFile(path.join(root, 'pages', '_catalog', 'bootstrap.json'), jsonBytes(bootstrap), { flag: 'wx' });
  await fs.writeFile(path.join(root, 'bootstrap.inline.json'), jsonBytes(bootstrap), { flag: 'wx' });
  const report = { schema_version: 1, release, verification: 'artifact-only; not a deployed UI', coverage,
    bootstrapDecodedBytes: jsonBytes(bootstrap).length, artifactFiles: writer.records.length,
    allReadModelDecodedBytes: writer.records.reduce((n, r) => n + r.bytes, 0),
    gzipEstimatesAreNotMeasuredTransfer: true, source: provenance, artifacts: writer.records };
  await fs.writeFile(path.join(root, 'artifact-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { bootstrap, report };
}
