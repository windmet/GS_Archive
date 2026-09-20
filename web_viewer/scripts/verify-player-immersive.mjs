import assert from 'node:assert/strict'
import { createPlayerImmersiveMode, claimMobileViewingOffer } from '../src/composables/usePlayerImmersiveMode.js'
import { PlayerPreferencesRepository } from '../src/core/story-runtime/PlayerPreferencesRepository.js'
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
function setup({ unsupported = false, rejectFullscreen = false, rejectLock = false, lockMissing = false, delayedFullscreen = null, delayedLock = null } = {}) {
  let listener, exits = 0, locks = 0, unlocks = 0, requests = 0
  const doc = { fullscreenEnabled: !unsupported, fullscreenElement: null,
    addEventListener: (_, cb) => { listener = cb }, removeEventListener: () => { listener = null },
    exitFullscreen: async () => { exits++; doc.fullscreenElement = null; listener?.() },
  }
  const root = { requestFullscreen: async options => {
    requests++; assert.deepEqual(options, { navigationUI: 'hide' })
    if (rejectFullscreen) throw Error('not allowed')
    if (delayedFullscreen) await delayedFullscreen.promise
    doc.fullscreenElement = root; listener?.()
  } }
  const orientation = { unlock: () => { unlocks++ } }
  if (!lockMissing) orientation.lock = async value => { locks++; assert.equal(value, 'landscape'); if (rejectLock) throw Error('unsupported'); if (delayedLock) await delayedLock.promise }
  const mode = createPlayerImmersiveMode({ document: doc, orientation })
  return { doc, root, mode, systemExit: () => { doc.fullscreenElement = null; listener?.() }, counts: () => ({requests, exits, locks, unlocks}), listening: () => Boolean(listener) }
}
{
 const t=setup(); const result=t.mode.enter(t.root)
 assert.equal(t.counts().requests,1,'fullscreen request starts inside the click call')
 assert.equal(await result,true); assert.equal(t.mode.state.active,true)
 t.systemExit(); assert.equal(t.mode.state.active,false); assert.equal(t.counts().unlocks,1)
 await t.mode.dispose(); assert.equal(t.listening(),false)
}
for (const options of [{unsupported:true},{rejectFullscreen:true},{lockMissing:true},{rejectLock:true}]) {
 const t=setup(options); await t.mode.enter(t.root)
 assert.equal(t.mode.state.active,true,'API failure does not prevent manual landscape viewing')
 assert.ok(t.mode.state.notice); assert.equal(t.mode.state.pending,false)
 await t.mode.leave(); assert.equal(t.mode.state.active,false)
 if (options.unsupported || options.rejectFullscreen) assert.equal(t.counts().locks,0)
}
{
 const gate=deferred(), t=setup({delayedFullscreen:gate})
 const entering=t.mode.enter(t.root); await t.mode.dispose(); gate.resolve(); await entering
 assert.equal(t.doc.fullscreenElement,null); assert.equal(t.counts().locks,0)
}
{
 const gate=deferred(),t=setup({delayedLock:gate}); const entering=t.mode.enter(t.root)
 await Promise.resolve(); await Promise.resolve(); t.systemExit(); gate.resolve(); await entering
 assert.equal(t.mode.state.active,false); assert.equal(t.counts().unlocks,1)
}
{
 const t=setup(); const other={}; t.doc.fullscreenElement=other
 assert.equal(await t.mode.enter(t.root),false); await t.mode.dispose()
 assert.equal(t.doc.fullscreenElement,other); assert.equal(t.counts().exits,0); assert.equal(t.counts().unlocks,0)
}
{
 const store=new Map(),repo=new PlayerPreferencesRepository({storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}})
 assert.equal(repo.load().story_mobile_view_mode,'ask')
 repo.update({story_mobile_view_mode:'portrait', story_content_mode:'bilingual'})
 assert.equal(repo.load().story_mobile_view_mode,'portrait'); assert.equal(repo.load().story_content_mode,'bilingual')
 repo.update({story_mobile_view_mode:'landscape'}); assert.equal(repo.load().story_mobile_view_mode,'landscape')
 repo.update({story_mobile_view_mode:'invalid'}); assert.equal(repo.load().story_mobile_view_mode,'ask')
 const denied=new PlayerPreferencesRepository({storage:{getItem(){throw Error()},setItem(){throw Error()}}})
 assert.equal(denied.update({story_mobile_view_mode:'portrait'}).story_mobile_view_mode,'portrait')
 assert.equal(claimMobileViewingOffer(),true); assert.equal(claimMobileViewingOffer(),false)
}
console.log('Immersive viewing: synchronous gesture, denied/unsupported APIs, system exit, pending unmount/lock, foreign fullscreen, preferences and one-time offer passed')
