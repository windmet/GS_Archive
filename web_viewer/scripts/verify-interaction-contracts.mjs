import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildInteractionInventory} from './lib/interaction-source-inventory.mjs';
const load=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const routes=load('scripts/qa/layout-routes.json'), scenarios=load('scripts/qa/interaction-scenarios.json'),inventory=load('scripts/qa/interaction-source-inventory.json');
assert.equal(new Set(scenarios.flows.map(f=>f.id)).size,scenarios.flows.length);
let steps=0;for(const f of scenarios.flows){assert.ok(routes.some(r=>r.id===f.pageId),f.id);assert.ok(f.component);for(const s of f.steps){steps++;assert.ok(s.label);assert.ok(s.expect||s.change);if(s.expect){assert.notEqual(s.expect,'true','No unconditional state PASS');new Function('return ('+s.expect+')')}if(s.change)new Function('return ('+s.change+')');}}
// The inventory must equal the template scan the generator writes from, so an added, removed or moved binding
// fails until `node scripts/generate-interaction-source-inventory.mjs` refreshes it (status is carried over).
const fresh=buildInteractionInventory(fileURLToPath(new URL('..',import.meta.url)),inventory),rowKey=r=>r.file+':'+r.line+' '+r.event+'="'+r.handler+'"';
const listed=new Set(inventory.map(rowKey)),scanned=new Set(fresh.map(rowKey));
assert.deepEqual([...listed].filter(k=>!scanned.has(k)).map(k=>'- '+k).concat([...scanned].filter(k=>!listed.has(k)).map(k=>'+ '+k)),[],'interaction-source-inventory.json is stale; run node scripts/generate-interaction-source-inventory.mjs');
assert.deepEqual(inventory,fresh,'interaction-source-inventory.json is stale; run node scripts/generate-interaction-source-inventory.mjs');
for(const f of scenarios.flows)for(const s of f.steps)for(const ref of s.sourceRefs||[]){const lines=readFileSync(new URL('../'+ref.file,import.meta.url),'utf8').split(/\r?\n/);assert.ok((lines[ref.line-1]||'').includes(ref.event+'="'+ref.handler+'"'),f.id+' cites '+ref.file+':'+ref.line);}
const root=process.argv.find(a=>a.startsWith('--evidence='))?.slice(11);let captures=0;
if(root){const records=JSON.parse(readFileSync(path.join(root,'transitions.json'),'utf8'));for(const r of records)for(const stage of ['before','after'])if(r[stage]){const shot=r[stage];assert.equal(path.basename(shot.screenshot),shot.screenshot);const bytes=readFileSync(path.join(root,shot.screenshot));assert.equal(createHash('sha256').update(bytes).digest('hex'),shot.sha256);captures++;}assert.equal(readdirSync(root).filter(n=>n.endsWith('.png')).length,captures);}
console.log(`Interaction contracts: ${scenarios.flows.length} flows / ${steps} steps; ${inventory.length} source event bindings verified; ${captures} screenshot hashes checked.`);

if(process.argv.includes('--all-index')){const index=load('scripts/qa/interaction-results-20261030.json');let count=0;const cache=new Map();for(const row of index.records){if(!cache.has(row.evidence))cache.set(row.evidence,JSON.parse(readFileSync(row.evidence,'utf8')));const record=cache.get(row.evidence).find(r=>r.flow===row.flow&&r.label===row.label&&r.time===row.time);assert.ok(record);for(const stage of ['before','after']){assert.ok(record[stage],row.flow+' '+row.label);const shot=record[stage];const bytes=readFileSync(path.join(path.dirname(row.evidence),shot.screenshot));assert.equal(createHash('sha256').update(bytes).digest('hex'),shot.sha256);count++;}}console.log('Current evidence index:',index.records.length,'transitions;',count,'before/after hashes verified');}
