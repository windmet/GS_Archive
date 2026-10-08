import { bindHomeNavigation, createHomeFixtureTransport } from './lib/home-navigation-harness.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {buildArchiveUrl,buildPortalReturnQuery,readPortalReturnRoute,readHomeReturnRoute} from '../src/core/archiveRoute.js'
import {createArchiveNavigationCoordinator} from '../src/core/ArchiveNavigationCoordinator.js'
const app = fs.readFileSync(new URL('../src/App.vue',import.meta.url),'utf8')

for (const outcome of ['loaded','superseded','failed']) {
  let finish
  const pending = new Promise(resolve => {finish=resolve})
  const portal = {view:'portal',portalScope:'005kao',portalQuery:'STARLIGHT',portalFrom:buildPortalReturnQuery({view:'home',homeIdol:'007kei',homeCue:'cue-kei',homeCostume:'costume-kei'})}
  const navigation = createArchiveNavigationCoordinator()
  const transport = createHomeFixtureTransport(['005kao', '007kei'])
  const context = {navigation,window:{location:{href:'http://localhost/'}},buildArchiveUrl,readPortalReturnRoute,
    userPreferences:{value:{startupIdol:'007kei',preferredIdol:'007kei',startupPage:'portal',homeMode:'card'}},
    validArchiveHomeIdols:{value:['005kao','007kei']},view:{value:'portal'},homeVisits:new Map([['005kao',{view:'home',homeIdol:'005kao',homeCue:'cue-kao',homeCostume:'costume-kao'}]]),
    currentArchiveRoute:()=>portal,pendingHomeNavigation:0,homeEntryStatus:{value:''},userPreferenceNotice:{value:''},
    portalFrom:{value:portal.portalFrom},detailSourceRoute:{value:''},homeSelectedId:{value:'007kei'},homeSelectedCue:{value:''},homeSelectedCostume:{value:''},homeFrom:{value:''},
    openIdolPicker:()=>assert.fail('existing idol must not fall back to picker'),
    archiveBootstrap: transport.bootstrap,
    readModelClient: { async load(descriptor, options) { await pending; if(outcome==='failed')throw Error('fixture offline'); return transport.client.load(descriptor, options) } },
    commitView:view=>{context.view.value=view},console:{error:()=>{}},
  }
  const visits = context.homeVisits
  const api = bindHomeNavigation(app, context)
  for (const [key, value] of visits) context.homeVisits.set(key, value)
  const originalPrefs=JSON.stringify(context.userPreferences.value)
  const opening=context.openGameHome('005kao')
  if(outcome==='superseded') navigation.invalidate()
  const originalError = console.error
  console.error = () => {}
  try { finish(); await opening } finally { console.error = originalError }
  assert.equal(JSON.stringify(context.userPreferences.value),originalPrefs,'a temporary visit never changes favorite, startup or renderer')
  assert.equal(context.view.value,outcome==='loaded'?'home':'portal')
  if(outcome==='loaded'){
    assert.equal(context.homeSelectedId.value,'005kao')
    assert.equal(context.homeSelectedCue.value,'cue-kao');assert.equal(context.homeSelectedCostume.value,'costume-kao')
    const returned = readHomeReturnRoute(context.homeFrom.value)
    assert.equal(returned.portalScope,'005kao');assert.equal(returned.portalQuery,'STARLIGHT')
  }
  if(outcome==='failed') assert.match(context.userPreferenceNotice.value,/重试/)
  api.stop()
}
console.log('Production Home visits: explicit owner, prior cue/costume, portal lens/search, preference isolation, failure and stale completion passed')
