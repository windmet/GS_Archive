import fs from 'node:fs/promises';
import { assert } from '../lib/common.mjs';
assert(process.argv[2], 'Usage: node tools/check_cutover_routes.mjs <completed routes.json>');
const original=JSON.parse(await fs.readFile(new URL('../contracts/routes.json',import.meta.url),'utf8'));
const actual=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
assert(Array.isArray(actual.routes),'Missing routes array');
const expected=new Set(original.routes.map(r=>r.view)),seen=new Set();
for(const route of actual.routes){assert(expected.has(route.view)&&!seen.has(route.view),`Unknown/duplicate route: ${route.view}`);seen.add(route.view);
 assert(route.migrated===true && route.parityPassed===true,`Unfinished route: ${route.view}`);
 assert(Array.isArray(route.deviceEvidence)&&route.deviceEvidence.length>0,`Missing evidence: ${route.view}`);
}
assert(expected.size===seen.size,'Some existing routes disappeared');
console.log(JSON.stringify({routes:seen.size,scope:'checklist structure only; reviewer must inspect the referenced evidence'},null,2));
