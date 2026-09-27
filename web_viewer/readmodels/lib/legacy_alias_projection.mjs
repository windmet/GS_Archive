import { groupFileList } from '../../src/utils/IndexNormalizer.js';
import { buildScenarioMetaByFile, missingExtraFileEntries } from '../../src/data/storyFileMetadata.js';

function formatFileName(file) {
  return file.replace(/\.json$/, '').replace(/^[^_]+_[^_]+_scenario_/, '');
}

function fileTitle(meta, file) {
  const titles = meta?.titles?.filter(Boolean) || [];
  if (!titles.length) return formatFileName(file || meta?.resourceIds?.[0] || '');
  if (titles.length === 1) return titles[0];
  if (titles.every(title => /^エピソード\d+$/.test(String(title))))
    return `${titles[0]} - ${titles[titles.length - 1]}`;
  return titles.slice(0, 2).join(' / ') + (titles.length > 2 ? ` +${titles.length - 2}` : '');
}

function fileEntry(file, metadata) {
  const meta = metadata.get(file);
  if (!meta) return { file, title: formatFileName(file), subtitle: '', resourceId: file,
    missing: false, searchText: file };
  const resourceText = meta.resourceIds.length ? meta.resourceIds.join(', ') : file;
  const summary = meta.summary || {};
  const summaryParts = [];
  if (summary.voice_count) summaryParts.push(`${summary.voice_count} voices`);
  if (summary.lip_count) summaryParts.push(`${summary.lip_count} lips`);
  if (!summaryParts.length && summary.step_count) summaryParts.push(`${summary.step_count} steps`);
  const summaryText = summaryParts.join(' · ');
  const subtitle = summaryText ? `${resourceText} · ${summaryText}` : resourceText;
  const title = fileTitle(meta, file);
  return { file, title, subtitle, resourceId: meta.resourceIds[0] || file,
    missing: meta.exists === false, searchText: `${file} ${title} ${resourceText}` };
}

/** Route aliases for the public pre-catalog URLs. Preserve their source IDs and order. */
export function buildLegacyAliasRecords(compiledIndex, storyCatalog) {
  const metadata = buildScenarioMetaByFile(storyCatalog);
  const extraMissing = missingExtraFileEntries(storyCatalog);
  const groupRecords = [];
  const fileRecords = [];
  const seenFileIds = new Set();
  const addFiles = (categoryId, ownerId, group) => {
    const id = String(group.id);
    if (!id || seenFileIds.has(id)) throw new Error(`Duplicate legacy file route: ${id}`);
    seenFileIds.add(id);
    const files = groupFileList(group);
    const entries = files.map(file => fileEntry(file, metadata));
    if (categoryId === 'extra') {
      const existing = new Set(files);
      entries.push(...extraMissing.filter(entry => !existing.has(entry.file)));
    }
    fileRecords.push({ id, summary: { categoryId, ownerId, title: group.title || id,
      fileCount: files.length }, view: { group: { id, title: group.title || id }, entries,
      sourceRoute: { categoryId, ownerId, groupId: id } } });
    return { id, title: group.title || id, event_meta: group.event_meta || null,
      fileCount: files.length };
  };
  const addGroups = (categoryId, ownerId, title, groups) => {
    const id = ownerId ? `${categoryId}:${ownerId}` : categoryId;
    groupRecords.push({ id, summary: { categoryId, ownerId, title, groupCount: groups.length },
      view: { groups: groups.map(group => addFiles(categoryId, ownerId, group)) } });
  };
  const categories = new Map((compiledIndex.categories || []).map(category => [category.id, category]));
  for (const id of ['main_story', 'event', 'extra']) {
    const category = categories.get(id);
    if (category) addGroups(id, '', category.name || id, category.groups || []);
  }
  for (const id of ['idol', 'idol_chat', 'idol_phone']) {
    const category = categories.get(id);
    const entities = category?.characters || category?.individual || {};
    for (const [ownerId, entry] of Object.entries(entities))
      addGroups(id, ownerId, entry.name || ownerId, entry.groups || []);
  }
  const chat = categories.get('idol_chat');
  for (const unit of chat?.groups || [])
    addGroups('idol_chat', unit.unit_code, unit.unit_name || unit.unit_code, unit.groups || []);
  const zero = categories.get('episode_zero');
  const units = (zero?.units || []).map(unit => ({
    unit_code: unit.unit_code, unit_name: unit.unit_name,
    episodes: (unit.episodes || []).map(episode => addFiles('episode_zero', unit.unit_code, episode)),
  }));
  const episodeRecords = units.map(unit => ({ id: unit.unit_code,
    summary: { unit_code: unit.unit_code, unit_name: unit.unit_name, episodeCount: unit.episodes.length },
    view: { unit } }));
  const zeroRecords = [{ id: 'episode_zero', summary: { title: zero?.name || '第零话', unitCount: units.length },
    view: { units: units.map(unit => ({ unit_code: unit.unit_code,
      unit_name: unit.unit_name, episodeCount: unit.episodes.length })) } }];
  return { groupRecords, fileRecords, episodeRecords, zeroRecords };
}
