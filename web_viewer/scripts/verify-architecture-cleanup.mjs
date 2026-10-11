import assert from 'node:assert/strict'
import {effectScope,ref,nextTick} from 'vue'
import {createBoundedTextTransport} from '../src/utils/BoundedTextTransport.js'
import {EntityTranslationRepository,hashEntitySourceText} from '../src/localization/story/EntityTranslationRepository.js'
import {createStoryLocalization} from '../src/localization/story/StoryLocalizationContext.js'
import {createArchiveNavigationCoordinator} from '../src/core/ArchiveNavigationCoordinator.js'
import {createPortalRepository,portalDisplayOverview} from '../src/data/PortalRepository.js'
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const response=text=>({ok:true,status:200,text:async()=>text})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
let cases=0
{
  const body=deferred(),transport=createBoundedTextTransport({timeoutMs:20,fetchImpl:async()=>({ok:true,text:()=>body.promise})})
  await assert.rejects(transport.load('body'),error=>error.name==='TimeoutError');assert.equal(transport.stats().flights,0)
  body.resolve('late');await tick();assert.equal(transport.stats().entries,0);cases++
}
{
  const gate=deferred(),controller=new AbortController()
  const transport=createBoundedTextTransport({fetchImpl:()=>gate.promise})
  const a=transport.load('shared',{signal:controller.signal}),b=transport.load('shared')
  const result=Promise.allSettled([a,b]);controller.abort();gate.resolve(response('valid'))
  const settled=await result;assert.equal(settled[0].status,'rejected');assert.equal(settled[1].value,'valid');cases++
}
{
  let calls=0;const old=deferred(),transport=createBoundedTextTransport({fetchImpl:()=>++calls===1?old.promise:response('new')})
  const pending=assert.rejects(transport.load('revision'),/abort|cancel/i)
  transport.invalidate('revision');assert.equal(await transport.load('revision'),'new')
  old.resolve(response('old'));await pending;await tick();assert.equal(await transport.load('revision'),'new');cases++
}
{
  const transport=createBoundedTextTransport({maxBytes:8,cacheBytes:12,maxEntries:2,fetchImpl:async key=>response(key)})
  await assert.rejects(transport.load('oversized'),/budget/)
  for(const key of ['first','second','third'])await transport.load(key)
  assert.ok(transport.stats().bytes<=12 && transport.stats().entries<=2);transport.clear();assert.equal(transport.stats().bytes,0);cases++
}
{
  const overlay={schema_version:1,entity_type:'idol',locale:'zh-CN',entries:{a:{source_hash:await hashEntitySourceText('source'),name:'valid',status:'reviewed'}}}
  let calls=0;const repo=new EntityTranslationRepository({fetchImpl:async()=>{calls++;return response(JSON.stringify(overlay))}})
  const valid=await repo.loadEntity({entityType:'idol',locale:'zh-CN',sourceNames:{a:'source'}})
  const stale=await repo.loadEntity({entityType:'idol',locale:'zh-CN',sourceNames:{a:'changed'}})
  assert.equal(calls,1)
  assert.equal(repo.getEntry({entityType:'idol',entityId:'a',locale:'zh-CN',overlay:valid}).name,'valid')
  assert.equal(repo.getEntry({entityType:'idol',entityId:'a',locale:'zh-CN',overlay:stale}),null);cases++
}
{
  const scope=effectScope(),preferences=ref({story_content_mode:'original',story_translation_locale:'zh-CN'}),gate=deferred()
  let requests=0
  const context=scope.run(()=>createStoryLocalization({compiledData:ref({scenario_id:'test',steps:[{dialogue:{speaker_identity:{kind:'npc',entity_type:'npc',entity_id:'test',source_name:'source'}}}]}),storyPreferences:preferences,
    repository:{loadScenario:async()=>{requests++;return {entries:{}}},getDiagnostics:()=>({code:'translation_ready'}),invalidate(){}},
    entityRepository:{loadEntity:()=>gate.promise,getEntry:()=>null,getDiagnostics:()=>null,invalidate(){}}}))
  await nextTick();assert.equal(requests,0)
  preferences.value={...preferences.value,story_content_mode:'translation'};await nextTick();await tick()
  assert.equal(context.loading.value,false);assert.equal(context.diagnostics.value.code,'translation_ready')
  scope.stop();gate.resolve({entries:{}});await tick();assert.deepEqual(context.entityDiagnostics.value,[]);cases++
}
{
  const coordinator=createArchiveNavigationCoordinator();coordinator.invalidate();const a=coordinator.getLoadOptions().signal
  coordinator.invalidate();const b=coordinator.getLoadOptions().signal
  assert.ok(a.aborted && !b.aborted);coordinator.dispose();assert.ok(b.aborted);cases++
}
{
  const calls=[],index={scopes:{all:{sha256:'hash',kind:'portal.scope'}}}
  const data={id:'all',overview:{projectionVersion:1,scopeId:'',footprints:[1,2,3,4],units:[],collections:{cards:[],songs:[],stories:[],events:[]},cardCounts:{total:826}}}
  const repository=createPortalRepository({bootstrap:{domains:{portal:{kind:'portal.index'}}},client:{load:async(descriptor,options)=>{calls.push(descriptor.kind);const result=descriptor.kind==='portal.index'?index:data;options.validate?.(result);return result}}})
  assert.equal(portalDisplayOverview((await repository.loadScope()).overview).cardCounts.total,826)
  assert.deepEqual(calls,['portal.index','portal.scope']);data.id='wrong';await assert.rejects(repository.loadScope(),/identity/);cases++
}
console.log(`Architecture cleanup: ${cases} fault/ownership/source-view contracts passed; injected-fetch and Vue scope tests, no Browser/performance claim`)
