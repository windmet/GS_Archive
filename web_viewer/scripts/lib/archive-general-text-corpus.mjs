import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Explicit allowlist. Story dialogue and summaries are excluded. Card lines, home touch voices and
// call titles are character text read one line at a time: each carries its speaker (the card's idol)
// and they publish only to the lazily loaded card-lines shard.
export function archiveGeneralTextCorpus(root) {
  const rows = [];
  const load = file => JSON.parse(fs.readFileSync(path.join(root, 'public/data/masterdata', file), 'utf8'));
  const add = (kind, id, field, text, speaker = '', owner = '') => {
    if (typeof text !== 'string' || !text.trim()) return;
    rows.push({kind, id: String(id), field, source: text,
      sourceHash: createHash('sha256').update(text).digest('hex'), ...(speaker ? {speaker} : {}), ...(owner ? {owner} : {})});
  };
  const cards = load('card_index.json').cards;
  for (const row of cards) add('card', row.resource_id, 'title', row.title);
  for (const row of cards) {
    // extra is '0' on cards without one.
    for (const field of ['normal', 'awakened', 'extra'])
      if (row.texts?.[field]?.trim() !== '0') add('card-line', row.resource_id, field, row.texts?.[field], row.character_id);
    for (const cue of row.home_voice_cues || []) add('card-touch', `${row.resource_id}:${cue.cue}`, 'text', cue.preview?.text, row.character_id);
  }
  // Chats: personal and unit talks and random topics, from the tracked chat text index (the compiled
  // chats stay in the local corpus). References keep the conversation, step and speaker.
  const chats = JSON.parse(fs.readFileSync(path.join(root, 'translation/studio/source/chat-text-index.json'), 'utf8')).files;
  const idolCodes = new Map(load('idol_unit_dictionary.json').idols.map(idol => [idol.display_name.replace(/\s/g, ''), idol.idol_code]));
  for (const [file, chat] of Object.entries(chats)) {
    const owner = chat.owner.idol || chat.owner.unit || '';
    for (const row of chat.rows) {
      const id = `${file}:${String(row.step).padStart(4, '0')}${row.option === undefined ? '' : `:${row.option}`}`;
      const speaker = row.kind === 'line' ? idolCodes.get(row.speaker.replace(/\s/g, '')) || row.speaker : 'producer';
      if (row.kind === 'line') add('chat-line', id, 'text', row.source, speaker, owner);
      else add('chat-choice', id, row.kind === 'detail' ? 'detail' : 'text', row.source, speaker, owner);
    }
  }
  for (const call of Object.values(load('mobile_archive_index.json').scenarios))
    if (call.kind === 'idol_phone') add('call-title', call.scenario_id ?? call.id, 'title', call.title, call.idol_code);
  for (const row of load('costume_dictionary.json').costumes) {
    add('costume', row.model_resource_id, 'name', row.costume_name);
    add('costume', row.model_resource_id, 'description', row.description);
  }
  for (const kind of ['item', 'honor']) for (const row of load(`domains/${kind}_catalog.json`).entries) {
    add(kind, row.id, 'name', row.nameJa);
    add(kind, row.id, 'description', row.descriptionText?.plain);
  }
  for (const [id, row] of Object.entries(load('card_detail_index.json').skills_by_id)) {
    add('skill', id, 'name', row.name);
    add('skill-category', row.category?.id || id, 'name', row.category?.name);
    add('skill', id, 'description', row.description_template);
    for (const level of row.levels || []) add('skill', `${id}:${level.level}`, 'description', level.description);
  }
  for (const [id, row] of Object.entries(load('card_detail_index.json').center_skills_by_id)) {
    add('center-skill', id, 'name', row.name);
    add('center-skill', id, 'description', row.description);
    add('center-skill', id, 'name', row.category?.name);
  }
  for (const [group, items] of Object.entries(load('domains/photo_materials.json'))) {
    if (!['filters', 'stickers', 'spots', 'scenes', 'frames'].includes(group)) continue;
    for (const row of items) for (const field of ['name', 'description']) add(`photo-${group}`, row.id, field, row[field]);
  }
  // Profile fields: idol profile, unit introduction, the 通信 room status and work-story labels.
  const dictionary = load('idol_unit_dictionary.json');
  for (const idol of dictionary.idols) for (const field of ['hobby', 'specialty', 'former_job', 'birthplace']) add('idol-profile', idol.idol_code, field, idol[field]);
  for (const unit of dictionary.units) add('unit-profile', unit.unit_code, 'description', unit.description);
  for (const room of load('mobile_archive_index.json').rooms.personal) add('mobile-status', room.idol_code, 'text', room.profile_text);
  for (const idol of load('work_story_index.json').idols) {
    add('work', idol.work_type_id, 'type', idol.work_type_name);
    for (const story of idol.short_stories) add('work', story.id, 'title', story.title);
  }
  const backgrounds = load('background_catalog.json').backgrounds;
  for (const [key, row] of Object.entries(backgrounds)) {
    for (const name of row.names || []) add('background', row.resource_id || row.resourceId || key, 'name', name);
    for (const scene of row.picture_studio_scenes || []) add('background-variant', `${key}:${scene.id || scene.variant}`, 'name', scene.variant);
  }
  return rows;
}
