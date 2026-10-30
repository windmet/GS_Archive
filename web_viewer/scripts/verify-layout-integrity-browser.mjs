// A0 candidate collector. A run completing is not a full-site quality gate.
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
import {findChrome} from './lib/layout-chrome.mjs';
import {inspectLayout} from './lib/layout-probes.mjs';
const args=process.argv.slice(2),opt=(key,fallback)=>args.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)||fallback;
const base=opt('base','http://127.0.0.1:5198').replace(/\/$/,'');
const only=opt('only','').split(',').filter(Boolean),selfTest=args.includes('--self-test'),fixtureTest=args.includes('--fixture-test');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const root=opt('output','E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a0');mkdirSync(root,{recursive:true});
// Each invocation creates a new child, never reuses or overwrites a previous run.
const output=mkdtempSync(path.join(root,'run-'));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
writeFileSync(path.join(output,'manifest.json'),JSON.stringify({head,args,base,startedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(['./verify-layout-integrity-browser.mjs','./lib/layout-probes.mjs','./qa/layout-routes.json'].map(f=>[f,createHash('sha256').update(readFileSync(new URL(f,import.meta.url))).digest('hex')]))},null,2));
const registry=JSON.parse(readFileSync(new URL('./qa/layout-routes.json',import.meta.url),'utf8'));
const controls=['normal','outside','clipped','overlap','scroll','image','fixed','title','input','broken','delayed','unreachable','mutation','mutation-broken','mutation-restored','focus','timeout'];
const routes=fixtureTest?['Demo','Worst case','Empty','One','Dense'].map(id=>({id,url:'/scripts/qa/responsive.html?data='+encodeURIComponent(id),identity:{path:'/scripts/qa/responsive.html'},readySelector:'#qa',timeoutMs:5000})):selfTest?controls.map(id=>({id,url:'/scripts/qa/layout-negative.html?case='+ (id.startsWith('mutation')?'mutation':id==='timeout'?'delayed':id==='focus'?'fixed':id)+(id==='mutation-broken'?'&mutated=1':''),identity:{path:'/scripts/qa/layout-negative.html'},readySelector:'body[data-qa-ready=true]',timeoutMs:id==='timeout'?100:5000,horizontalExceptions:id==='scroll'?['#subject']:[],focusSelector:id==='focus'?'#covered':null,overlapPairs:[['#first','#second']]})):registry.filter(r=>!only.length||only.includes(r.id));
if(!routes.length)throw Error('No matching routes');
const windows=opt('windows',selfTest?'390x844':'320x720,390x844,1280x688').split(',').map(s=>s.split('x').map(Number));
assert.ok(windows.every(([w,h])=>Number.isInteger(w)&&w>0&&Number.isInteger(h)&&h>0),'Invalid windows');
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-box-on-line-'))
const port = 9500 + Math.floor(Math.random() * 400)
const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let socket
try {
  let targets
  for (let i = 0; i < 100 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
  assert.ok(targets?.length, 'the browser did not start')
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve))
  let runtimeErrors=[];
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text); if (message.id && pending.has(message.id)) { pending.get(message.id)(message.error ? {error:message.error} : message.result); pending.delete(message.id) } })
  const send = (method, params = {}) => new Promise((resolve,reject) => { const id = ++sequence; const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},15000); pending.set(id, value=>{clearTimeout(timer);if(value.error)reject(Error(JSON.stringify(value.error)));else resolve(value)}); socket.send(JSON.stringify({ id, method, params })) })
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  await send('Runtime.enable'); await send('Page.enable'); const environment=await send('Browser.getVersion')
  await send('Page.navigate', { url: base + '/?view=about' }); await sleep(2500)
  await evaluate(`localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:'001tom',preferredIdol:'001tom',portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})); localStorage.setItem('sidem:archive-sidebar', 'full'); true`)

  const results=[];
  const readyProbe = route => `(() => {const q=${JSON.stringify(route)};const e=document.querySelector(q.readySelector);const shown=e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;const text=(e?.innerText||'').trim();const images=[...(e?.querySelectorAll('img')||[])].filter(i=>i.getBoundingClientRect().width>0&&i.getBoundingClientRect().bottom>0&&i.getBoundingClientRect().top<innerHeight&&getComputedStyle(i).position!=='absolute');return {content:!q.requireContent||text.length>0||e?.tagName==='CANVAS',errorOverlay:Boolean(document.querySelector('vite-error-overlay')),identity:(q.identity.pathPattern?new RegExp(q.identity.pathPattern).test(location.pathname):location.pathname===q.identity.path)&&(!q.identity.titleRequired||Boolean(document.title.trim()))&&Object.entries(q.identity.query||{}).every(([k,v])=>new URL(location.href).searchParams.get(k)===v),selector:Boolean(shown),text:text.slice(0,100),loading:/^(正在|Loading)/i.test(text),fonts:document.fonts.status,imagesPending:images.filter(i=>!i.complete).length,brokenImages:images.filter(i=>i.complete&&!i.naturalWidth).length}})()`;
  const waitReady=async route=>{const start=Date.now();let detail,previous=null;while(Date.now()-start<route.timeoutMs){detail=await evaluate(readyProbe(route));const signature=JSON.stringify(detail);if(!detail?.errorOverlay&&detail?.identity&&detail.content&&detail.selector&&!detail.loading&&detail.fonts==='loaded'&&!detail.imagesPending&&!detail.brokenImages&&signature===previous)return {status:'READY',elapsedMs:Date.now()-start,detail};previous=signature;await sleep(100)}return {status:'INCONCLUSIVE',elapsedMs:Date.now()-start,detail,reason:'Identity/content/fonts/images readiness timeout'};};
  for(const [width,height] of windows){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    for(const route of routes){
      const record={routeId:route.id,requestedUrl:base+route.url,type:route.type||'negative-control',viewport:{width,height},browser:environment,head,testState:selfTest?'negative-control':route.stateDescription||'default-entry',measuredAt:new Date().toISOString(),status:'INCONCLUSIVE',url:null,title:null,detection:null,reason:null};
      try{
        runtimeErrors=[];await send('Page.navigate',{url:record.requestedUrl});
        if(route.precondition){const start=Date.now();let clicked=false;while(Date.now()-start<route.timeoutMs){clicked=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(route.precondition.click)});if(!e||!e.getBoundingClientRect().width)return false;e.click();return true})()`);if(clicked)break;await sleep(100)}if(!clicked)throw Error('Precondition control unavailable');}
        record.ready=await waitReady(route);record.runtimeErrors=[...runtimeErrors];if(runtimeErrors.length){record.ready.status='INCONCLUSIVE';record.ready.reason='Uncaught runtime error';}
        record.url=await evaluate('location.href');record.title=await evaluate('document.title');record.measuredAt=new Date().toISOString();
        if(route.focusSelector)await evaluate(`document.querySelector(${JSON.stringify(route.focusSelector)})?.focus()`);
        if(record.ready.status==='READY'){record.detection=await evaluate(`(${inspectLayout.toString()})(${JSON.stringify(route)})`);record.status='REVIEW_REQUIRED';record.reason='Ready; geometry candidates require human review, not a product PASS';}
        else record.reason=record.ready.reason;
      }catch(error){record.reason=error.message;record.ready ||= {status:'INCONCLUSIVE',reason:error.message};}
      try{const shot=await send('Page.captureScreenshot',{format:'png'});if(!shot.data)throw Error('Screenshot empty');record.screenshot=`${width}x${height}-${route.id}.png`;record.screenshotSha256=createHash('sha256').update(Buffer.from(shot.data,'base64')).digest('hex');writeFileSync(path.join(output,record.screenshot),Buffer.from(shot.data,'base64'),{flag:'wx'});}catch(error){record.status='INCONCLUSIVE';record.reason='Screenshot failure: '+error.message;}
      if(selfTest){const expected={outside:'viewport-overflow',clipped:'parent-clipping',overlap:'overlap',image:'image-distortion-candidate',fixed:'fixed-obscured',focus:'focus-obscured',title:'text-clipping-candidate',input:'small-input-risk',broken:'broken-image',unreachable:'unreachable-scroll-end','mutation-broken':'viewport-overflow'};
        // Broken required images prevent readiness on product routes, but controls must exercise the probe too.
        if(route.id==='broken')record.detection=await evaluate(`(${inspectLayout.toString()})({})`);
        const kinds=record.detection?.findings.map(f=>f.kind)||[];
        record.expected=expected[route.id]||null;
        record.testPassed=route.id==='timeout'?record.ready.status==='INCONCLUSIVE':expected[route.id]?kinds.includes(expected[route.id]):['normal','scroll','mutation','mutation-restored'].includes(route.id)?kinds.length===0:record.ready.status==='READY';
      }
      if(fixtureTest){record.componentCount=await evaluate("document.querySelectorAll('.archive-idol-reference').length");record.firstName=await evaluate("document.querySelector('.archive-idol-reference strong')?.textContent");record.testPassed=record.componentCount===({'Demo':3,'Worst case':49,'Empty':0,'One':1,'Dense':49}[route.id])&&record.ready.status==='READY';if(!record.testPassed)process.exitCode=1;}
      results.push(record);writeFileSync(path.join(output,'measurements.json'),JSON.stringify(results,null,2));console.log(route.id,record.ready?.status,selfTest?record.testPassed:record.status);
    }
  }
  const screenshots=results.filter(r=>r.screenshot);assert.equal(screenshots.length,results.length,'Missing screenshot');assert.equal(new Set(screenshots.map(r=>r.screenshot)).size,results.length);
  if(selfTest){writeFileSync(path.join(output,'self-test-summary.json'),JSON.stringify({passed:results.filter(r=>r.testPassed).length,total:results.length,results:results.map(r=>({id:r.routeId,passed:r.testPassed,expected:r.expected,kinds:r.detection?.findings.map(f=>f.kind)}))},null,2));if(results.some(r=>!r.testPassed))process.exitCode=1;}
  console.log('Evidence:',output);
}finally{socket?.close();chrome.kill();await sleep(300);try{rmSync(profile,{recursive:true,force:true})}catch{}}
