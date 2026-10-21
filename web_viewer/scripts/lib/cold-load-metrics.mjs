// Shared by the measurement runner and source tests. Scene readiness is the
// existing DOM contract; it does not mean motions/audio have finished preloading.
export function stageSceneReady(document,{id,quality}) {
  const stage=document.querySelector('.chibi-stage[data-song-id]')
  if(!stage || stage.getAttribute('data-song-id')!==id || stage.getAttribute('data-stage-ready')!=='true')return false
  const positions=name=>(stage.getAttribute(name)||'').split(',').filter(Boolean).sort().join(',')
  if(!positions('data-active-positions') || positions('data-active-positions')!==positions('data-loaded-positions'))return false
  for(const name of ['data-object-layers-enabled','data-lighting-enabled','data-beam-effects-enabled'])
    if(stage.getAttribute(name)!==String(quality==='full'))return false
  const canvas=stage.querySelector('canvas')
  return Boolean(canvas && canvas.width>0 && canvas.height>0)
}
export function stageMeasurementPages(quality='full') {
  if(!['full','lite'].includes(quality))throw Error('Unknown stage quality')
  return Object.fromEntries([['drive','drvalv'],['hnd','hndmkh'],['tbt','tibeti'],['flash','flslgt']].map(([name,code])=>{
    const stage={id:`${code}_live_effect`,quality}
    return [`stage-${name}`,{url:`/?view=chibi_stage&song=${code}&stage=${stage.id}`,
      entity:`(${stageSceneReady.toString()})(document,${JSON.stringify(stage)})`,stage,
      setup:`localStorage.setItem('gs-stage-viewing',JSON.stringify({quality:${JSON.stringify(quality)},frameRate:'auto',remember:true}))`}]
  }))
}
export const median=values=>{
  const sorted=values.filter(value=>typeof value==='number' && Number.isFinite(value)).sort((a,b)=>a-b)
  return sorted.length?sorted[Math.floor((sorted.length-1)/2)]:null
}
export function measurementFailures(result,expectedRelease='') {
  const failures=[]
  if(result.error)failures.push('runner-error')
  if(!Number.isFinite(result.entity) || result.entity<0 || result.entity===null)failures.push('entity-not-ready')
  if(result.entityPresent===false)failures.push('entity-lost')
  if(result.timedOut)failures.push('timeout')
  if(result.failed>0)failures.push('resource-failure')
  if(result.errors?.length)failures.push('runtime-error')
  if(expectedRelease && result.release!==expectedRelease)failures.push('release-mismatch')
  return failures
}

export function rejectMixedBuilds(results) {
  const valid=results.filter(result=>result.valid)
  const identities=[...new Set(valid.map(result=>JSON.stringify({release:result.release||'',entry:[...new Set((result.entry||[]).map(row=>row.file))].sort()})))]
  if(identities.length>1)for(const result of valid){result.valid=false;result.failures.push('mixed-build-or-release')}
  return identities.map(value=>JSON.parse(value))
}

// Keep redirect hops separate and count loadingFailed, including status=0.
// CDP timestamps use one monotonic clock. requestWillBeSent.wallTime supplies
// its epoch offset, allowing byte events to be compared with the DOM entity mark.
export function createColdNetworkTracker(now=()=>Date.now()) {
  const requests=[],active=new Map()
  let lastNetwork=now(),epochOffset=null
  const changed=()=>{lastNetwork=now()}
  const end=(row,p)=>{
    if(p.encodedDataLength>row.bytes)row.samples.push({at:p.timestamp,bytes:p.encodedDataLength-row.bytes})
    row.bytes=Math.max(row.bytes,p.encodedDataLength||0)
    row.finishedAt=p.timestamp
  }
  return {
    requests,
    get inflight(){return active.size},
    get lastNetwork(){return lastNetwork},
    event(method,p) {
      if(method==='Network.requestWillBeSent') {
        changed()
        if(epochOffset===null && Number.isFinite(p.wallTime) && Number.isFinite(p.timestamp))epochOffset=p.wallTime-p.timestamp
        if(p.redirectResponse && active.has(p.requestId)) {
          const previous=active.get(p.requestId);previous.status=p.redirectResponse.status
          end(previous,{...p,encodedDataLength:p.redirectResponse.encodedDataLength||0})
        }
        const row={url:p.request.url,type:p.type||'Other',startedAt:p.timestamp,status:0,bytes:0,samples:[],failed:false}
        requests.push(row);active.set(p.requestId,row)
      } else if(method==='Network.responseReceived' && active.has(p.requestId)) {
        const row=active.get(p.requestId);row.status=p.response.status;row.type=p.type||row.type
      } else if(method==='Network.dataReceived' && active.has(p.requestId)) {
        changed();const row=active.get(p.requestId),bytes=Math.max(0,p.encodedDataLength||0)
        row.bytes+=bytes;row.samples.push({at:p.timestamp,bytes})
      } else if(['Network.loadingFinished','Network.loadingFailed'].includes(method) && active.has(p.requestId)) {
        changed();const row=active.get(p.requestId)
        if(method==='Network.loadingFailed'){row.failed=true;row.failure=p.errorText||'Network.loadingFailed';row.finishedAt=p.timestamp}
        else end(row,p)
        active.delete(p.requestId)
      }
    },
    atEntity(epochMs) {
      if(epochOffset===null || !Number.isFinite(epochMs))return null
      const at=epochMs/1000-epochOffset,rows=requests.filter(row=>row.startedAt<=at)
      return {requests:rows.length,bytes:rows.reduce((sum,row)=>sum+row.samples.filter(sample=>sample.at<=at).reduce((n,sample)=>n+sample.bytes,0),0)}
    },
  }
}

export const buildColdObserver = (entity,setup='') => `(() => {
  const perf = window.__gsPerf = { fcp: null, lcp: null, lcpTag: '', cls: 0, longTasks: 0, longTaskMs: 0, entity: null }
  try {
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') perf.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
    new PerformanceObserver(list => { for (const e of list.getEntries()) { perf.lcp = e.startTime; perf.lcpTag = (e.element?.tagName || '') + (e.url ? ' ' + e.url.split('/').pop() : '') } }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) perf.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver(list => { for (const e of list.getEntries()) { perf.longTasks++; perf.longTaskMs += e.duration } }).observe({ type: 'longtask', buffered: true })
  } catch {}
  try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({ version: 3, startupPage: 'portal', homeMode: 'spine', startupIdol: null, preferredIdol: null, portalDefaultScope: 'favorite', stageLight: 'mint', onboardingComplete: true })) } catch {}
  try { ${setup} } catch {}
  const test = () => { try { return ${entity} } catch { return false } }
  // After the content first appears, keep watching: a prerendered page that the app clears and re-renders
  // shows up as a content gap (gapMs, from losing the content until it is back).
  let shown = false, lostAt = 0
  perf.gapMs = 0; perf.gaps = 0
  const mark = () => {
    if (!document.body) return
    const now = test()
    if (now && !shown) { shown = true; if (perf.entity === null) perf.entity = performance.now(); else { perf.gapMs += performance.now() - lostAt; perf.restored = performance.now() } }
    else if (!now && shown) { shown = false; lostAt = performance.now(); perf.gaps++ }
  }
  const observer = new MutationObserver(mark)
  // Observe from the first parsed node: module scripts run before DOMContentLoaded and may replace prerendered content.
  observer.observe(document, { childList: true, subtree: true, characterData: true, attributes:true,
    attributeFilter:['data-stage-ready','data-song-id','data-active-positions','data-loaded-positions','data-object-layers-enabled','data-lighting-enabled','data-beam-effects-enabled','width','height'] })
  mark()
})()`
