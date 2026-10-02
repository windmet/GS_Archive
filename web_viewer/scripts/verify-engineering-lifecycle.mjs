// Adapted from user-provided Engineering Audit 71c26533 controlled tests; current source is always the subject.
/** Controlled tests of real fetched functions. NOT a browser/heap benchmark.
 * Node >=22: node --experimental-vm-modules tests/lifecycle-repros.mjs
 * --repo /path/to/GS_Archive tests local source, never writes it.
 */
import fs from 'node:fs';
import {withLoadDeadline} from '../src/core/AsyncLoadBoundary.js';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const repo=args.includes('--repo')?path.resolve(args[args.indexOf('--repo')+1]):path.resolve(root,'..');
const output=args.includes('--out')?path.resolve(args[args.indexOf('--out')+1]):null;
const gitBlob=b=>crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function invariant(value,message){if(!value)throw Error(message)}
function vueShim(hooks){return {ref:value=>({value}),computed:fn=>({get value(){return fn()}}),watch:()=>()=>{},onBeforeUnmount:fn=>hooks.push(fn)}}
async function evaluate(source,dependencies,globals={}){
 const context=vm.createContext({console,DOMException,AbortController,Float32Array,Uint8Array,ArrayBuffer,performance,setTimeout,clearTimeout,...globals});
 const module=new vm.SourceTextModule(source,{context});
 await module.link(async key=>{
  if(!Object.hasOwn(dependencies,key))throw Error(`Unexpected import ${key}`);
  const exports=dependencies[key];
  return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context});
 });
 await module.evaluate();return module.namespace;
}
async function audioFixture(source,{running=false,singers=['a']}={}){
 const hooks=[],nodes=[],gains=[],waits=[],frames=new Map(),owners=new Set();let serial=0;
 const ctx={state:running?'running':'suspended',currentTime:0,destination:{},closed:0,
  createGain(){const index=gains.length+1;if(this.failGainAt===index)throw Error('injected gain creation failure');const n={disconnected:false,gain:{value:1,setValueAtTime(){}},connect(){return this},disconnect(){this.disconnected=true}};gains.push(n);return n},
  createBufferSource(){const n={id:nodes.length+1,started:false,stopped:false,disconnected:false,playbackRate:{value:1},connect(target){return target},disconnect(){this.disconnected=true},start(at,offset){if(ctx.failStartAt===this.id)throw Error('injected start failure');this.started=true;this.at=at;this.offset=offset},stop(){this.stopped=true}};nodes.push(n);return n},
  decodeAudioData:async()=>({duration:120,numberOfChannels:2,length:5292000}),
  resume(){const d=deferred();waits.push(d);return d.promise.then(()=>{this.state='running'})},
  close(){this.state='closed';this.closed++;return Promise.resolve()},
 };
 const deps={'../core/AsyncLoadBoundary.js':{withLoadDeadline},'vue':vueShim(hooks),'../utils/musicAudioSession.js':{claimMusicAudioSession:o=>owners.add(o),releaseMusicAudioSession:o=>owners.delete(o)}};
 const ns=await evaluate(source,deps,{fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}),requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial},cancelAnimationFrame:id=>frames.delete(id)});
 const session=ns.useSongPerformanceSession({contextFactory:()=>ctx,resumeTimeoutMs:20});
 await session.configure({experiment:{backing:{url:'/backing'},solo_tracks:Object.fromEntries([...new Set(singers)].map(id=>[id,{vocal:{url:'/vocal/'+id}}]))},events:[],performerLineup:singers,continuous:true});
 invariant(session.ready.value,'Fixture configure failed');
 return {ctx,session,nodes,gains,waits,frames,owners,async cleanup(){hooks.forEach(fn=>fn());for(const w of waits)w.resolve();await flush()}};
}
const audioCases={
 'audio-permanent-resume-timeout':async f=>{const p=f.session.play();invariant(await p===false,'Pending resume did not time out');invariant(!f.session.starting.value&&!f.owners.size,'Timed-out start retained owner');f.waits[0].resolve();await flush();invariant(!f.nodes.length,'Late native resume restarted audio')},
 'audio-dispose-inspection':async f=>{invariant(f.session.inspect().decodedPcmBytes>0,'PCM accounting missing');f.ctx.close=()=>Promise.reject(Error('injected close failure'));f.session.dispose();await flush();const state=f.session.inspect();invariant(state.disposed&&!state.activeSources&&!state.runningFrames&&!state.decodedPcmBytes&&state.closeError,'Dispose/close failure accounting invalid');invariant(await f.session.play()===false,'Disposed session restarted')},
 'audio-normal-cleanup':async f=>{f.ctx.state='running';invariant(await f.session.play(),'play failed');f.session.pause();invariant(f.nodes.every(n=>n.stopped&&n.disconnected),'source not released');invariant(!f.frames.size&&!f.owners.size,'frame/category lease remains')},
 'audio-pause-during-resume':async f=>{const p=f.session.play();invariant(f.waits.length===1,'resume was not invoked synchronously');f.session.pause();f.waits[0].resolve();await p;invariant(!f.session.playing.value&&f.nodes.length===0,'Late resume started playback after pause')},
 'audio-double-start':async f=>{f.ctx.state='running';await Promise.all([f.session.play(),f.session.play()]);invariant(f.nodes.filter(n=>n.started).length===2,`Expected 2 nodes (backing+solo), got ${f.nodes.filter(n=>n.started).length}`)},
 'audio-double-start-stop-all':async f=>{f.ctx.state='running';await Promise.all([f.session.play(),f.session.play()]);f.session.pause();invariant(f.nodes.every(n=>!n.started||n.stopped),'First concurrently started graph escaped pause cleanup')},
 'audio-late-reject-keeps-new-owner':async f=>{const a=f.session.play();f.session.pause();const b=f.session.play();invariant(f.waits.length===2,'Expected two independent native resumes');f.waits[1].resolve();await b;f.waits[0].reject(Error('late denied'));await a;invariant(f.session.playing.value&&f.owners.size===1&&!f.session.error.value,'Stale resume rejection changed newer playback ownership/error')},
 'audio-release-during-resume':async f=>{const p=f.session.play();f.session.release();f.waits[0].resolve();await p;invariant(!f.session.playing.value&&!f.nodes.length&&!f.session.ready.value,'Release failed to fence pending play')},
 'audio-seek-cancels-pending-start':async f=>{const p=f.session.play();f.session.seek(30);f.waits[0].resolve();await p;invariant(!f.session.playing.value&&f.nodes.length===0&&f.session.currentTime.value===30,'Seek while stopped allowed stale play to start')},
 'audio-partial-start-rollback':async f=>{f.ctx.state='running';f.ctx.failStartAt=2;invariant(await f.session.play()===false,'Expected injected start failure');invariant(f.nodes.every(n=>n.stopped&&n.disconnected),'Locally allocated graph was not rolled back after start threw')},
 'audio-partial-allocation-rollback':async f=>{f.ctx.state='running';f.ctx.failGainAt=4;await f.session.play();invariant(f.nodes.every(n=>n.stopped&&n.disconnected),'Node allocated before failing createGain escaped cleanup')},
 'audio-unmount-during-resume':async f=>{const p=f.session.play();await f.cleanup();await p;invariant(f.ctx.closed===1&&!f.nodes.length&&!f.owners.size,'Unmount resurrected audio')},
 'audio-unique-singer-gates':async f=>{f.ctx.state='running';await f.session.configure({experiment:{backing:{url:'/b'},solo_tracks:{a:{vocal:{url:'/a'}},b:{vocal:{url:'/b'}}}},events:[],performerLineup:['a','a','b','','b'],continuous:true});await f.session.play();invariant(f.nodes.length===3,'Repeated singer allocated duplicate tracks')},
};
async function imageFixture(source,options={}){
 const images=[],timers=new Map();let next=0,released=0;
 const base={valid:!!options.valid,destroyed:false,on(){},off(){},destroy(){released++;this.destroyed=true}};
 const image={removeAttribute(){},naturalWidth:64,naturalHeight:64};images.push(image);
 const ns=await evaluate(source,{'./PlayerTrace.js':{tracePlayer(){}},'pixi.js':{ALPHA_MODES:{PMA:1}},'./AsyncLoadBoundary.js':{createLoadTimeout:(label)=>Error(label)}});
 const controller=new AbortController();
 const p=ns.loadImageTexture('/owned.png',{createImage:()=>image,createBaseTexture:()=>base,createTexture:()=>{if(options.textureThrows)throw Error('injected texture creation error');return {baseTexture:base}},releaseFailedBase:options.shared?undefined:b=>b.destroy(),signal:controller.signal,setTimer:fn=>{timers.set(++next,fn);return next},clearTimer:id=>timers.delete(id),allowFallback:false});
 p.catch(()=>{});
 return {base,image,p,controller,timers,get released(){return released}};
}
const imageCases={
 'texture-private-abort':async f=>{f.image.onload();f.controller.abort();await f.p.catch(()=>{});invariant(f.released===1,'Private BaseTexture created before abort was not destroyed')},
 'texture-private-timeout':async f=>{f.image.onload();[...f.timers.values()].at(-1)();await f.p.catch(()=>{});invariant(f.released===1,'Private BaseTexture timed out without cleanup')},
 'texture-factory-throw':async f=>{f.base.valid=true;f.image.onload();await f.p.catch(()=>{});invariant(f.released===1,'createTexture failure abandoned its owned base')},
 'texture-shared-abort-untouched':async f=>{f.image.onload();f.controller.abort();await f.p.catch(()=>{});invariant(f.released===0,'Destroyed a shared base')},
 'texture-success-transfers-owner':async f=>{f.base.valid=true;f.image.onload();await f.p;f.controller.abort();invariant(f.released===0,'Destroyed successfully transferred texture')},
 'texture-abort-before-base':async f=>{f.controller.abort();await f.p.catch(()=>{});invariant(f.released===0,'Cleanup invoked without an allocation')},
 'texture-single-cleanup':async f=>{f.image.onload();f.controller.abort();f.controller.abort();await f.p.catch(()=>{});invariant(f.released===1&&f.timers.size===0,'Private base cleanup not exactly once')},
};
const files={audio:'web_viewer/src/composables/useSongPerformanceSession.js',image:'web_viewer/src/core/loadImageTexture.js'};
const names={audio:'useSongPerformanceSession.js',image:'loadImageTexture.js'};
const expectedBaseline=new Set(['audio-pause-during-resume','audio-double-start','audio-double-start-stop-all','audio-late-reject-keeps-new-owner','audio-seek-cancels-pending-start','audio-partial-start-rollback','audio-partial-allocation-rollback','texture-private-abort','texture-private-timeout','texture-factory-throw','texture-single-cleanup']);
const reports=[];
for(const variant of repo?['local-repo']:['baseline','candidate']){
 const sources=Object.fromEntries(Object.keys(files).map(k=>[k,fs.readFileSync(repo?path.join(repo,files[k]):path.join(root,variant==='baseline'?'fixtures':'proposals',names[k]),'utf8')]));
 const results=[];
 for(const [id,test]of Object.entries(audioCases)){const f=await audioFixture(sources.audio);try{await test(f);results.push({id,pass:true})}catch(e){results.push({id,pass:false,message:e.message})}finally{if(f.ctx.closed===0)await f.cleanup()}}
 for(const [id,test]of Object.entries(imageCases)){const f=await imageFixture(sources.image,{shared:id.includes('shared'),textureThrows:id==='texture-factory-throw'});try{await test(f);results.push({id,pass:true})}catch(e){results.push({id,pass:false,message:e.message})}}
 const summary={variant,sourceHashes:Object.fromEntries(Object.entries(sources).map(([k,v])=>[files[k],gitBlob(Buffer.from(v))])),tests:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};reports.push(summary);
 console.log(`${variant}: ${summary.passed}/${summary.tests} invariant checks passed`);for(const result of results.filter(r=>!r.pass))console.log(`  FAIL ${result.id}: ${result.message}`);
}
const ok=repo?reports[0].failed===0:reports[1].failed===0&&reports[0].results.every(r=>r.pass===!expectedBaseline.has(r.id));
const record={kind:'controlled-real-source-lifecycle-tests',node:process.version,baselineCommit:'71c2653335f6dfd75b41e06c092f5a6716538590',browser:false,heapMeasured:false,vueLifecycle:'controlled stub (unmount callbacks are explicitly invoked)',result:ok?'PASS_CURRENT_SOURCE':'FAIL_CURRENT_SOURCE',reports};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n')}
process.exitCode=ok?0:1;
