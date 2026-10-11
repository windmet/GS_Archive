import { buildPortalDesktopOverview } from '../../src/presentation/ArchivePortalPresentation.js';
import { portalTimeline } from '../../src/presentation/PortalBento.js';
import { storyGateways, storyGatewayCount } from '../../src/presentation/StoryGateways.js';
import { eventResources, storyEventResources } from '../../src/data/eventResourceGraph.js';
import { assert } from './common.mjs';

const group = row => ['main','event'].includes(row.domain) ? row.domain :
  ['idol_story','card_scenarios','work','birthday'].includes(row.domain) ? 'personal' : 'other';
const counts = (rows, key) => rows.reduce((result, row) => {
  if (row[key]) result[row[key]] = (result[row[key]] || 0) + 1;
  return result;
}, {});

// Same pure selectors as the portal, executed once at generation, not on entry.
export function portalProjection({ bootstrap, rows, product, preferredIdol = null }) {
  const facets = { release: bootstrap.release, cards: Object.fromEntries(rows.cards.map(row => {
    const attribute = product.cards.find(card => card.resource_id === row.resource_id)?.gameplay?.attribute;
    assert(attribute && ({1:'Physical',2:'Intelligence',3:'Mental'})[attribute.id] === attribute.name,
      `Portal attribute source mismatch: ${row.resource_id}`);
    return [row.resource_id, { attribute: attribute.name, detailSha256: row.detail.sha256 }];
  })) };
  const idolRecord = product.extraDomains.idols.records.find(row => row.id === preferredIdol?.id);
  const source = buildPortalDesktopOverview({ bootstrap, cards: rows.cards, songs: rows.songs,
    stories: rows.stories.map(row => {
      const resource = row.domain === 'event' ? storyEventResources(row) : null;
      return resource?.storyFile === row.file ? {...row, image: resource.hero} : row;
    }), events: rows.events.map(row => ({...row, resources: eventResources(row)})),
    preferredIdol, preferredDetail: idolRecord ? {id:idolRecord.id,view:idolRecord.view} : null,
    eventDetails: product.extraDomains.events.records.map(row => ({id:row.id,view:row.view})),
    units: rows.units, cardFacets: facets, portraits: product.portalPortraits,
    stageManifest: product.portalStageManifest, storyCollections: rows.collections,
    gatewayCounts: {seasonalCount:product.storyCatalogView.seasonalCount,
      workCount:product.storyCatalogView.workCount,idolStoryCount:bootstrap.idols.length} });
  const full = source.collections;
  const storyCounts = {all:full.stories.length};
  for (const row of full.stories) storyCounts[group(row)] = (storyCounts[group(row)] || 0) + 1;
  const songCounts = {...counts(full.songs,'performanceKind'), all:full.songs.length};
  const gatewayCountsByAction = Object.fromEntries(storyGateways.map(gateway =>
    [gateway.id, storyGatewayCount(gateway, full.stories, source.gatewayCounts)]));
  // Preserve each visible category's preview, full counts travel separately.
  const stories = [...new Map(['all','main','event','personal','other'].flatMap(key =>
    full.stories.filter(row => key === 'all' || group(row) === key).slice(0,4)).map(row => [row.id,row])).values()];
  const songs = preferredIdol ? full.songs : [...new Map(['all','configurable_formation','fixed_unit','fixed_special_lineup'].flatMap(key =>
    full.songs.filter(row => key === 'all' || row.performanceKind === key).slice(0,key === 'configurable_formation' ? 5 : 4))
    .map(row => [row.id,row])).values()];
  // All-archive exploration is a bounded selection; an explicit draw loads its card pool.
  const cards = preferredIdol ? full.cards.slice(0,4) : bootstrap.idols.filter((_,i) => i % 3 === 0)
    .map(idol => full.cards.find(row => row.idolCode === idol.id && row.landscape)).filter(Boolean);
  const {cards:unusedCards,songs:unusedSongs,stories:unusedStories,events:unusedEvents,...metadata} = source;
  return {...metadata, collections:{cards,songs,stories,events:preferredIdol ? full.events : portalTimeline(full.events)},
    storyCounts, songCounts, gatewayCountsByAction,
    cardCounts:{total:full.cards.length,rarity:counts(full.cards,'rarity'),attribute:counts(full.cards,'attribute')},
    units:preferredIdol ? [] : source.units, eventYears:[], scopeId:preferredIdol?.id || '', projectionVersion:1};
}
