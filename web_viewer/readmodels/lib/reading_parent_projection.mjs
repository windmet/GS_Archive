// Canonical parent of each Reading document: the page that owns it, expressed as route fields.
// Parents are inverted from the owner read-model records the checkout adapter already builds
// (their `readingEntries` use the same file matching the app relies on), never guessed from names.
// A document with no owner of its own domain gets `null`; callers report coverage instead of failing.

const FALLBACK_DOMAINS = new Set(['main', 'unit_story', 'birthday', 'extra']);

// A reprint shares its story file with the first run. The canonical owner is the first run
// (isReprint false), then the earliest start, then the lowest id, so the choice is reproducible.
function eventOrder(a, b) {
  return (a.reprint - b.reprint) || (a.startAt - b.startAt) || String(a.id).localeCompare(String(b.id));
}

export function buildReadingParents({ events = [], collections = [], idolStories = [], work = [], seasonal = [], stories = [] }) {
  // document_id -> candidates, per owner kind.
  const owned = { event: new Map(), collection: new Map(), 'idol-story': new Map(), work: new Map(), seasonal: new Map(), story: new Map() };
  const add = (kind, documentId, candidate) => {
    const list = owned[kind].get(documentId) || [];
    list.push(candidate);
    owned[kind].set(documentId, list);
  };

  for (const record of events) {
    const identity = record.view?.identity || {};
    const candidate = { id: record.id, reprint: identity.isReprint ? 1 : 0, startAt: record.view?.period?.startAt ?? Infinity,
      route: { view: 'event_detail', event: String(record.id) } };
    for (const entry of record.view?.readingEntries || []) add('event', entry.document_id, candidate);
  }
  for (const record of collections) {
    const collection = record.view?.collection;
    if (!collection) continue;
    const candidate = { domain: collection.domain, route: { view: 'story_collection', storyType: collection.domain, storySection: String(collection.sectionId) } };
    for (const entry of record.view?.readingEntries || []) add('collection', entry.document_id, candidate);
  }
  for (const record of idolStories) {
    const page = record.view?.page;
    if (!page) continue;
    for (const section of page.sections || []) {
      for (const episode of section.episodes || []) {
        add('idol-story', episode.resource_id, { route: { view: 'idol_story_archive', idol: page.idol_code,
          storySection: String(section.id), episode: String(episode.id) } });
      }
    }
  }
  for (const record of work) {
    const idol = record.view?.idol;
    if (!idol) continue;
    const bySource = new Map();
    for (const [mode, rows] of [['stories', idol.short_stories], ['lines', idol.scene_lines]]) {
      for (const row of rows || []) if (row.compiled_file && !bySource.has(row.compiled_file)) bySource.set(row.compiled_file, mode);
    }
    for (const entry of record.view?.readingEntries || []) {
      const mode = bySource.get(entry.source_file) ?? bySource.get(entry.parent_file);
      if (mode) add('work', entry.document_id, { route: { view: 'work_archive', storyType: 'work', idol: idol.idol_code, story: entry.source_file, workMode: mode } });
    }
  }
  for (const record of seasonal) {
    const campaign = record.view?.campaign;
    if (!campaign) continue;
    const bySource = new Map();
    for (const episode of campaign.introduction || []) if (episode.compiled_file) bySource.set(episode.compiled_file, 'common');
    for (const participant of campaign.participants || []) {
      for (const episode of participant.episodes || []) if (episode.compiled_file) bySource.set(episode.compiled_file, participant.participant_code);
    }
    for (const entry of record.view?.readingEntries || []) {
      // A segment (episodes/..._a.json) belongs to the participant episode its parent file names.
      const idol = bySource.get(entry.source_file) ?? bySource.get(entry.parent_file);
      if (idol) add('seasonal', entry.document_id, { route: { view: 'seasonal_campaign', storyType: 'seasonal_campaign', storySection: String(campaign.id), idol } });
    }
  }
  for (const story of stories) {
    for (const entry of story.readingEntries || []) add('story', entry.document_id, { route: { view: 'story_detail', story: story.id } });
  }

  const DOMAIN_OWNER = { event: 'event', work: 'work', idol_story: 'idol-story', seasonal: 'seasonal' };
  const pick = (kind, documentId, entryDomain) => {
    const list = owned[kind].get(documentId);
    if (!list?.length) return null;
    if (kind === 'event') return [...list].sort(eventOrder)[0];
    if (kind === 'collection') return list.find(item => item.domain === entryDomain) || null;
    return list[0];
  };

  return function parentFor(entry) {
    const kind = DOMAIN_OWNER[entry.domain];
    if (kind) {
      const found = pick(kind, entry.document_id, entry.domain);
      return found ? { route: found.route, source: kind } : null;
    }
    if (FALLBACK_DOMAINS.has(entry.domain)) {
      const found = pick('collection', entry.document_id, entry.domain);
      if (found) return { route: found.route, source: 'collection' };
    }
    const story = pick('story', entry.document_id);
    return story ? { route: story.route, source: 'story' } : null;
  };
}
