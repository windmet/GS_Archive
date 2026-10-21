import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {stageMeasurementPages,stageSceneReady,buildColdObserver,median,measurementFailures,createColdNetworkTracker,rejectMixedBuilds} from './lib/cold-load-metrics.mjs'
const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/stage-choreography-shards.json',import.meta.url),'utf8'))
function fixture(quality='full') {
  const attrs={'data-song-id':'drvalv_live_effect','data-stage-ready':'true','data-active-positions':'1,2,3,4,5','data-loaded-positions':'5,4,3,2,1'}
  for(const name of ['data-object-layers-enabled','data-lighting-enabled','data-beam-effects-enabled'])attrs[name]=String(quality==='full')
  const canvas={width:1280,height:720},stage={getAttribute:key=>attrs[key]??null,querySelector:selector=>selector==='canvas'?canvas:null}
  const document={body:{},querySelector:selector=>selector==='.chibi-stage[data-song-id]'?stage:null}
  return {document,attrs,canvas}
}
for(const quality of ['full','lite']) {
  const pages=stageMeasurementPages(quality)
  assert.equal(Object.keys(pages).length,4)
  for(const page of Object.values(pages)) {
    const query=new URL(page.url,'https://example.test').searchParams
    assert(catalog.index.songs.some(song=>song.id===query.get('stage') && song.songCode===query.get('song')),'Measured route must identify a real arrangement')
    const f=fixture(quality);f.attrs['data-song-id']=page.stage.id
    assert.equal(vm.runInNewContext(page.entity,{document:f.document}),true)
    let preference
    vm.runInNewContext(page.setup,{localStorage:{setItem:(key,value)=>{assert.equal(key,'gs-stage-viewing');preference=JSON.parse(value)}}})
    assert.deepEqual(preference,{quality,frameRate:'auto',remember:true})
    f.attrs['data-stage-ready']='false';assert(!stageSceneReady(f.document,page.stage))
    f.attrs['data-stage-ready']='true';f.attrs['data-loaded-positions']='1,2';assert(!stageSceneReady(f.document,page.stage))
    f.attrs['data-loaded-positions']='1,2,3,4,5';f.canvas.width=0;assert(!stageSceneReady(f.document,page.stage))
    f.canvas.width=1280;f.attrs['data-song-id']='other';assert(!stageSceneReady(f.document,page.stage))
  }
}
assert.throws(()=>stageMeasurementPages('auto'),/quality/)
{
  // Execute the injected observer itself: an attribute-only readiness update
  // must produce a mark; content loss/recovery remains tracked.
  const page=stageMeasurementPages()['stage-drive'],f=fixture()
  f.attrs['data-stage-ready']='false'
  let clock=10,notify,observerOptions
  const context={window:{},document:f.document,localStorage:{setItem(){}},performance:{now:()=>clock},
    PerformanceObserver:class {observe(){}},MutationObserver:class {constructor(fn){notify=fn}observe(_target,options){observerOptions=options}}}
  vm.runInNewContext(buildColdObserver(page.entity,page.setup),context)
  assert.equal(context.window.__gsPerf.entity,null)
  assert.equal(observerOptions.attributes,true)
  assert(observerOptions.attributeFilter.includes('data-stage-ready'))
  assert(observerOptions.attributeFilter.includes('data-loaded-positions'))
  clock=20;f.attrs['data-stage-ready']='true';notify()
  assert.equal(context.window.__gsPerf.entity,20)
  clock=30;f.attrs['data-stage-ready']='false';notify()
  clock=55;f.attrs['data-stage-ready']='true';notify()
  assert.equal(context.window.__gsPerf.entity,20)
  assert.equal(context.window.__gsPerf.gaps,1);assert.equal(context.window.__gsPerf.gapMs,25)
}

assert.equal(median([null,undefined,NaN,Infinity]),null)
assert.equal(median([5,1,9]),5);assert.equal(median([5,1]),1)
{
  const results=['index-a.js','index-b.js'].map(file=>({valid:true,failures:[],release:'same',entry:[{file}]}))
  assert.equal(rejectMixedBuilds(results).length,2)
  assert(results.every(result=>!result.valid && result.failures.includes('mixed-build-or-release')))
  assert.equal(rejectMixedBuilds([{valid:true,failures:[],release:'same',entry:[{file:'index-a.js'}]},{valid:true,failures:[],release:'same',entry:[{file:'index-a.js'}]}]).length,1)
}
const good={entity:100,entityPresent:true,timedOut:false,failed:0,errors:[],release:'a'.repeat(64)}
assert.deepEqual(measurementFailures(good,'a'.repeat(64)),[])
for(const [change,reason] of [[{entity:null},'entity-not-ready'],[{entity:NaN},'entity-not-ready'],[{entityPresent:false},'entity-lost'],
  [{timedOut:true},'timeout'],[{failed:1},'resource-failure'],[{errors:['boom']},'runtime-error'],[{release:'b'.repeat(64)},'release-mismatch']])
  assert(measurementFailures({...good,...change},'a'.repeat(64)).includes(reason))
{
  let wall=0
  const network=createColdNetworkTracker(()=>wall)
  assert.equal(network.atEntity(123),null)
  const send=(name,params)=>{wall++;network.event('Network.'+name,params)}
  send('requestWillBeSent',{requestId:'a',timestamp:10,wallTime:1010,request:{url:'https://example.test/redirect'},type:'Document'})
  send('requestWillBeSent',{requestId:'a',timestamp:11,wallTime:1011,request:{url:'https://example.test/'},redirectResponse:{status:302,encodedDataLength:15},type:'Document'})
  assert.equal(network.requests.length,2);assert.equal(network.inflight,1)
  send('responseReceived',{requestId:'a',response:{status:200},type:'Document'})
  send('dataReceived',{requestId:'a',timestamp:12,encodedDataLength:50})
  assert.deepEqual(network.atEntity(1012500),{requests:2,bytes:65})
  send('loadingFinished',{requestId:'a',timestamp:13,encodedDataLength:80})
  assert.equal(network.inflight,0);assert.equal(network.requests.reduce((n,r)=>n+r.bytes,0),95)
  assert.deepEqual(network.atEntity(1012500),{requests:2,bytes:65},'Later completion must not inflate pre-entity transfer')
  assert.deepEqual(network.atEntity(1013500),{requests:2,bytes:95})
  send('requestWillBeSent',{requestId:'b',timestamp:14,wallTime:1014,request:{url:'https://example.test/missing'}})
  send('loadingFailed',{requestId:'b',timestamp:15,errorText:'net::ERR_FAILED'})
  assert.equal(network.requests.at(-1).failed,true);assert.equal(network.requests.at(-1).status,0)
  assert.equal(network.inflight,0);assert.equal(network.lastNetwork,wall)
  send('loadingFinished',{requestId:'untracked',timestamp:16,encodedDataLength:50})
  assert.equal(network.inflight,0)
}
{
  const runner=fs.readFileSync(new URL('measure-portal-cold-load.mjs',import.meta.url),'utf8')
  const summaryCode=runner.slice(runner.indexOf('const summary = pages.map'),runner.indexOf('const fmt ='))+'\nsummary'
  const sample={...good,page:'stage-drive',valid:true,byType:{script:{bytes:100}},bytes:1000,requests:4,entry:[],atEntity:{requests:2,bytes:300}}
  const bad={...sample,valid:false,entity:1,timedOut:true,failed:1,errors:['resource error']}
  const summary=vm.runInNewContext(summaryCode,{pages:['stage-drive','empty'],PAGES:{'stage-drive':{url:'/'},empty:{url:'/empty'}},
    results:[sample,bad,{page:'stage-drive',valid:false,error:'runner'}],median})
  assert.equal(summary[0].entity,100);assert.equal(summary[0].runs,1);assert.equal(summary[0].attempts,3)
  assert.equal(summary[0].invalid,2);assert.equal(summary[0].timedOut,1);assert.equal(summary[0].failedRequests,1)
  assert.equal(summary[0].errors[0],'resource error');assert.equal(summary[0].bytesAtEntity,300)
  assert.equal(summary[1].entity,null);assert.equal(summary[1].kib,null)
  for(const args of [['invalid-label/'],['valid-label','--runs=0'],['valid-label','--pages=unknown']]) {
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('measure-portal-cold-load.mjs',import.meta.url)),...args],{encoding:'utf8'})
    assert.notEqual(result.status,0);assert.match(result.stderr,/Invalid report label|runs must|Unknown or duplicate page/)
  }
}
console.log('Cold-load metrics: real stage routes/quality/readiness, attribute-only marks, redirect/partial transfer timing and invalid sample guards passed')
