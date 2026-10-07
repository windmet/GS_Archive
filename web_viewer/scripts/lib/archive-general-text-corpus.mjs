import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Explicit metadata allowlist. Dialogue, story summaries and home cues are excluded.
export function archiveGeneralTextCorpus(root) {
  const rows = [];
  const load = file => JSON.parse(fs.readFileSync(path.join(root, 'public/data/masterdata', file), 'utf8'));
  const add = (kind, id, field, text) => {
    if (typeof text !== 'string' || !text.trim()) return;
    rows.push({kind, id: String(id), field, source: text,
      sourceHash: createHash('sha256').update(text).digest('hex')});
  };
  for (const row of load('card_index.json').cards) add('card', row.resource_id, 'title', row.title);
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
