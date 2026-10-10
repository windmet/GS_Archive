import { assert } from './common.mjs';
import { seasonalCampaignOrder } from '../../shared/reading/ReadingCatalog.js';

// The seasonal page reads Valentine / White Day as one ledger: every participant's episodes in all
// four campaigns side by side, with the shared openings as their own row. Per-campaign details keep
// the full source evidence; the ledger carries only what the page lists, plus each episode's reading
// document so titles bind to their translations and the Reader opens on the right segment.
export function buildSeasonalLedger(seasonalIndex, readingEntries) {
  const campaigns = seasonalCampaignOrder(seasonalIndex?.campaigns || []);
  assert(campaigns.length, 'Seasonal ledger needs campaigns');
  const ready = readingEntries.filter(entry => entry.domain === 'seasonal' && entry.status === 'ready');
  const documentFor = episode => {
    const matches = ready.filter(entry => entry.document_id === episode.resource_id ||
      (entry.source_file === episode.compiled_file && entry.parent_file === episode.compiled_file));
    assert(matches.length <= 1, `Ambiguous seasonal reading document: ${episode.resource_id}`);
    return matches[0] ? { document_id: matches[0].document_id, sha256: matches[0].sha256 } : null;
  };
  const episodeView = episode => ({ id: episode.id, title: episode.title || '', episode_no: episode.episode_no ?? null,
    level: episode.required_valentine_level ?? null, compiled_file: episode.compiled_file || null,
    // compiled_summary describes the whole file, which 2022's two parts share, so none of it is per episode.
    playable: episode.compiled_exists === true, reading: documentFor(episode) });
  const participants = new Map();
  for (const campaign of campaigns) {
    for (const participant of campaign.participants || []) {
      const key = `${participant.participant_type}:${participant.participant_code}`;
      const row = participants.get(key) || { participant_type: participant.participant_type,
        participant_code: participant.participant_code, display_name: participant.display_name, episodes: {} };
      assert(!row.episodes[campaign.id], `Duplicate seasonal participant: ${key} in ${campaign.id}`);
      row.episodes[campaign.id] = (participant.episodes || []).map(episodeView);
      participants.set(key, row);
    }
  }
  return {
    campaigns: campaigns.map(campaign => ({ id: campaign.id, year: campaign.year, season: campaign.season,
      name: campaign.name, term: campaign.term || null, introduction: (campaign.introduction || []).map(episodeView) })),
    participants: [...participants.values()],
  };
}
