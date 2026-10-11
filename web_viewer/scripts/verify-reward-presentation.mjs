import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ReadModelClient} from '../readmodels/runtime/ReadModelClient.mjs';
import {DomainRepository} from '../readmodels/runtime/DomainRepository.mjs';
import {lookupCollectionEntry,createCollectionPreview} from '../readmodels/runtime/CollectionPreview.mjs';
import {rewardConditions,rewardCondition,rewardCollectionKey,rewardProductName,rewardProductLabel} from '../src/components/archive/DomainPresentation.mjs';

assert.deepEqual(rewardConditions({intervalPoint:100000,offsetPoint:0,limitPoint:1000000}),['每 100,000 PT','起点 0 PT','上限 1,000,000 PT']);
assert.equal(rewardCondition({upperRank:1,lowerRank:100,sectionId:2}),'第 1–100 名 · 阅读对应章节');
assert.deepEqual(rewardConditions({dayCount:0,sumFanAmount:2000}),['第 0 天','累计粉丝 2,000']);
assert.deepEqual(rewardConditions({relation:'event-material'}),['活动所用材料']);
assert.deepEqual(rewardConditions({}),['条件未完整收录']);
for(const kind of ['item','honor']) {
  const product={kind,referenceStatus:'resolved-entity',entityKey:`${kind}:42`};
  assert.equal(rewardCollectionKey(product),`${kind}:42`);
  assert.equal(rewardCollectionKey({...product,referenceStatus:'missing-entity'}),'');
  assert.equal(rewardCollectionKey({...product,entityKey:'card:42'}),'');
}
assert.equal(rewardCollectionKey({kind:'scalar',entityKey:'productType:2'}),'');
assert.equal(rewardProductName({typeNameJa:'スタージェム'}),'スタージェム');
assert.equal(rewardProductLabel({kind:'scalar',typeNameJa:'スタージェム'}),'スタージェム');

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const jobs=[];
const repo={catalog:async()=>[{id:1},{id:2}],detail:async(_domain,row,options)=>{const job=deferred();jobs.push({...job,row,signal:options.signal});return job.promise}};
const detail=id=>({entry:{id,key:`item:${id}`}});
let state;
const preview=createCollectionPreview(repo,value=>state=value);
const old=preview.open('item:1');await Promise.resolve();await Promise.resolve();
const current=preview.open('item:2');await Promise.resolve();await Promise.resolve();
assert.ok(jobs[0].signal.aborted);
jobs[1].resolve(detail(2));assert.equal(await current,true);
jobs[0].resolve(detail(1));assert.equal(await old,false);assert.equal(state.key,'item:2');assert.equal(state.detail.entry.id,2);
const closing=preview.open('item:1');await Promise.resolve();await Promise.resolve();preview.close();jobs[2].resolve(detail(1));assert.equal(await closing,false);assert.equal(state.detail,null);
assert.equal(await preview.open('item:999'),false);assert.ok(state.error);
const retry=preview.open('item:2');await Promise.resolve();await Promise.resolve();jobs[3].resolve(detail(2));assert.equal(await retry,true);assert.equal(state.error,'');
const disposal=preview.open('item:1');await Promise.resolve();await Promise.resolve();preview.dispose();jobs[4].resolve(detail(1));assert.equal(await disposal,false);assert.equal(await preview.open('item:2'),false);
await assert.rejects(lookupCollectionEntry({catalog:()=>{throw Error('should not load')}},'card:1'),/Invalid/);
await assert.rejects(lookupCollectionEntry({catalog:async()=>[{id:1}],detail:async()=>({entry:{id:1,key:'honor:1'}})},'item:1'),/mismatch/);

const models=process.argv[process.argv.indexOf('--models')+1];
if(process.argv.includes('--models')) {
  const root=path.resolve(models,'pages');
  const bootstrap=JSON.parse(await readFile(path.join(root,'_catalog/bootstrap.json'),'utf8'));
  const client=new ReadModelClient({release:bootstrap.release,fetchImpl:async url=>new Response(await readFile(path.join(root,new URL(url).pathname)),{status:200,headers:{'content-type':'application/json'}})});
  const real=new DomainRepository(client,bootstrap);
  const item=await lookupCollectionEntry(real,'item:10401');
  assert.equal(item.detail.entry.nameJa,'フィジカルバッジ');
  const honors=await real.catalog('honors');
  const honor=await lookupCollectionEntry(real,`honor:${honors[0].id}`);
  assert.equal(honor.detail.entry.nameJa,honors[0].nameJa);
  const events=await real.catalog('events');
  const event=await real.detail('events',events.find(row=>String(row.id)==='410014'));
  const rewards=(await Promise.all(event.rewards.generalPages.map(page=>client.load(page)))).flatMap(page=>page.rows);
  assert.equal(rewards.length,161);
  const first=rewards[0];assert.equal(first.totalPoint,100);assert.equal(first.product.amount,40);assert.equal(rewardProductName(first.product),'フィジカルバッジ');
  assert.equal(rewardCollectionKey(first.product),'item:10401');
  assert.ok(rewards.some(row=>row.scope==='ranking'));assert.ok(rewards.some(row=>row.scope==='repeated'));
  console.log(`Real pinned data: ${rewards.length} event rewards, badge and honor identity checked; release ${bootstrap.release}`);
  client.dispose();
}
console.log('Reward conditions, typed references, preview switch/close/disposal, retry and identity rejection passed');
