import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const routes=JSON.parse(read('scripts/qa/layout-routes.json'));
const original=read('scripts/verify-box-on-line-browser.mjs').split('const ROUTES = [')[1].split('const WINDOWS')[0];
const seeds=[...original.matchAll(/\['([^']+)',\s*'([^']+)'/g)].map(m=>[m[1],m[2]]);
assert.equal(seeds.length,30);assert.equal(routes.length,35);assert.equal(new Set(routes.map(r=>r.id)).size,35);
for(const [id,url] of seeds)assert.ok(routes.some(r=>r.id===id&&r.url===url),id);
for(const r of routes)for(const key of ['id','url','type','identity','readySelector','precondition','horizontalExceptions','timeoutMs'])assert.ok(key in r,`${r.id}: ${key}`);
const html=read('scripts/qa/responsive.html');for(const m of ['Demo','Worst case','Empty','One','Dense'])assert.ok(html.includes(m));assert.ok(html.includes('import.meta.env.DEV'));
const files=[];function scan(dir){for(const item of readdirSync(dir)){const p=path.join(dir,item);if(statSync(p).isDirectory())scan(p);else if(/\.(js|mjs|vue|html)$/.test(p))files.push(p)}}scan(fileURLToPath(new URL('../src',import.meta.url)));
for(const f of files)assert.ok(!/scripts\/qa\//.test(readFileSync(f,'utf8')),f);
const vite=read('vite.config.js');assert.ok(!/rollupOptions\s*:\s*\{[\s\S]*input\s*:/.test(vite),'Review custom build entries');
const candidate=process.argv.find(a=>a.startsWith('--candidate='))?.slice(12)||'E:/Web_build/GS_Archive_Domain_Work/rm-release-20261030b';
const fixture=JSON.parse(read('scripts/fixtures/responsive-real-extremes.json'));
let checked=0;for(const values of Object.values(fixture.fields))for(const row of values){const file=path.resolve(candidate,'pages',row.source);const doc=JSON.parse(readFileSync(file,'utf8'));const actual=row.pointer.split('/').slice(1).reduce((v,k)=>v[k],doc);assert.equal(actual,row.value);checked++;}
console.log(`A0 contracts: ${routes.length} routes, all 30 seeds retained; ${checked} real fixture values verified; QA entries excluded from production source graph (static check).`);

const evidence=process.argv.find(a=>a.startsWith('--evidence='))?.slice(11);
if(evidence){const records=JSON.parse(readFileSync(path.join(evidence,'measurements.json'),'utf8'));const names=new Set();for(const r of records){assert.ok(r.screenshot);assert.ok(!names.has(r.screenshot));names.add(r.screenshot);const png=readFileSync(path.join(evidence,r.screenshot));assert.equal(createHash('sha256').update(png).digest('hex'),r.screenshotSha256);for(const key of ['routeId','url','title','viewport','browser','testState','ready','measuredAt','reason'])assert.ok(key in r,key);}assert.equal(readdirSync(evidence).filter(n=>n.endsWith('.png')).length,records.length);console.log('Evidence 1:1 and SHA256 verified:',records.length);}
