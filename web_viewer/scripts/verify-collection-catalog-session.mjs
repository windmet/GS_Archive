import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createCollectionCatalogSession} from '../readmodels/runtime/CollectionCatalogSession.mjs';
import {DomainRepository} from '../readmodels/runtime/DomainRepository.mjs';
import {ReadModelClient} from '../readmodels/runtime/ReadModelClient.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const rows=[{id:'1'},{id:'2'}];
const value=(type,id)=>({entry:{id,key:`${type}:${id}`}});
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
function fixture() {
  const catalogs=[],details=[],changes=[];
  const session=createCollectionCatalogSession({
    catalog:(domain,options)=>{const job=deferred();catalogs.push({...job,domain,signal:options.signal});return job.promise},
    detail:(domain,row,options)=>{const job=deferred();details.push({...job,domain,row,signal:options.signal});return job.promise},
  },state=>changes.push(state));
  return {session,catalogs,details,changes};
}
{
  const t=fixture(),first=t.session.open('items','item:1');
  assert.equal(t.session.state.catalogBusy,true);t.catalogs[0].resolve(rows);await flush();
  assert.equal(t.session.state.catalogBusy,false);assert.equal(t.session.state.detailBusy,true);assert.equal(t.session.state.rows,rows);
  t.details[0].resolve(value('item',1));assert.equal(await first,true);
  const old=t.session.open('items','item:2');assert.equal(t.catalogs.length,1);assert.equal(t.session.state.rows,rows);assert.equal(t.session.state.detail,null);
  await flush();const newer=t.session.open('items','item:1');await flush();assert.ok(t.details[1].signal.aborted);
  t.details[2].resolve(value('item',1));assert.equal(await newer,true);
  t.details[1].resolve(value('item',2));assert.equal(await old,false);assert.equal(t.session.state.detail.entry.key,'item:1');
  const failure=t.session.open('items','item:2');await flush();t.details[3].reject(Error('network'));assert.equal(await failure,false);
  assert.equal(t.session.state.errorScope,'detail');assert.equal(t.session.state.rows,rows);assert.equal(t.session.state.detail,null);
  const retry=t.session.open('items','item:2');await flush();assert.equal(t.catalogs.length,1);t.details[4].resolve(value('item',2));assert.equal(await retry,true);
  assert.equal(await t.session.open('items','item:999'),false);assert.equal(t.details.length,5);assert.equal(t.session.state.selectedId,'');assert.equal(t.session.state.detail,null);
  assert.equal(await t.session.open('items','honor:1'),false);assert.equal(t.details.length,5);
  const mismatch=t.session.open('items','item:1');await flush();t.details[5].resolve(value('honor',1));assert.equal(await mismatch,false);assert.equal(t.session.state.detail,null);
  const leaving=t.session.open('items','item:2');await flush();t.session.dispose();const count=t.changes.length;t.details[6].resolve(value('item',2));assert.equal(await leaving,false);assert.equal(t.changes.length,count);assert.equal(await t.session.open('items'),false);
}
{
  const t=fixture(),old=t.session.open('items','item:1'),next=t.session.open('honors','honor:2');
  t.catalogs[1].resolve(rows);await flush();t.details[0].resolve(value('honor',2));assert.equal(await next,true);
  t.catalogs[0].resolve(rows);assert.equal(await old,false);assert.equal(t.session.state.domain,'honors');assert.equal(t.details.length,1);
  const change=t.session.open('items','item:1');assert.equal(t.session.state.rows.length,0);
  const back=t.session.open('honors','honor:2');assert.equal(t.catalogs.length,4); // Invalidated old directory cannot be mistaken for the new one.
  t.catalogs[3].reject(Error('network'));assert.equal(await back,false);assert.equal(t.session.state.errorScope,'catalog');
  t.catalogs[2].resolve(rows);assert.equal(await change,false);
  const retry=t.session.open('honors');t.catalogs[4].resolve(rows);await flush();t.details[1].resolve(value('honor',1));assert.equal(await retry,true);
  const empty=t.session.open('items');t.catalogs[5].resolve([]);assert.equal(await empty,true);assert.equal(t.session.state.detailBusy,false);assert.equal(t.session.state.error,'');
}
if(process.argv.includes('--models')) {
  const root=path.resolve(process.argv[process.argv.indexOf('--models')+1],'pages');
  const bootstrap=JSON.parse(await readFile(path.join(root,'_catalog/bootstrap.json'),'utf8'));
  const requests=[];
  const client=new ReadModelClient({release:bootstrap.release,fetchImpl:async url=>{requests.push(new URL(url).pathname);return new Response(await readFile(path.join(root,new URL(url).pathname)),{headers:{'content-type':'application/json'}})}});
  const session=createCollectionCatalogSession(new DomainRepository(client,bootstrap),()=>{});
  assert.equal(await session.open('items','item:10401'),true);assert.equal(session.state.rows.length,535);assert.equal(session.state.detail.entry.nameJa,'フィジカルバッジ');
  const catalogs=requests.filter(url=>/\/items\/(index|pages)\//.test(url) || url.endsWith('/items/index.json')).length;
  assert.equal(await session.open('items','item:10701'),true);assert.equal(session.state.detail.entry.nameJa,'初級レッスンノート');
  assert.equal(requests.filter(url=>/\/items\/(index|pages)\//.test(url) || url.endsWith('/items/index.json')).length,catalogs);
  assert.equal(await session.open('honors','honor:30017340'),true);assert.equal(session.state.rows.length,1613);assert.equal(session.state.detail.entry.key,'honor:30017340');
  console.log(`Pinned data verified: 535 items, 1613 honors; same-domain selection reuses directory; ${bootstrap.release}`);
  session.dispose();client.dispose();
}
console.log('Collection session: separate loading/errors, directory retention, retry, stale catalog/detail rejection, typed identity and disposal passed');
