import fs from 'node:fs';
import path from 'node:path';
import {archiveGeneralTextCorpus} from './lib/archive-general-text-corpus.mjs';

const root = process.cwd();
const rows = archiveGeneralTextCorpus(root);
const directory = path.join(root, '.analysis/archive-general-localization');
fs.mkdirSync(directory, {recursive: true});
fs.writeFileSync(path.join(directory, 'corpus.json'), JSON.stringify(rows, null, 2) + '\n');
const groups = {};
for (const row of rows) (groups[row.kind] ||= new Map()).set(row.source, row);
for (const [kind, values] of Object.entries(groups)) {
  fs.writeFileSync(path.join(directory, `${kind}.json`), JSON.stringify([...values.values()], null, 2) + '\n');
}
console.log(JSON.stringify({rows: rows.length, unique: Object.fromEntries(Object.entries(groups).map(([kind, values]) => [kind, values.size])), output: directory}, null, 2));
