import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { normalizeTerminalPreferences, readTerminalPreferences, writeTerminalPreferences, validateTerminalManifest, loadTerminalManifest, resolveHomeBackground } from '../../src/data/terminal/terminalMedia.js'
import { loadArchiveHomePreferences, saveArchiveHomePreferences, ARCHIVE_HOME_PREFERENCES_KEY } from '../../src/data/archiveHomePreferences.js'
import { resolveArchiveStartup } from '../../src/core/archiveStartup.js'
import { ARCHIVE_NAVIGATION } from '../../src/core/archiveRoute.js'
let checks = 0
function test(name, fn) { fn(); checks++; console.log(`PASS ${name}`) }
const mem = () => { const data = new Map(); return { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) } }
const record = { id: '040ren_ssr03:base', resourceId: '040ren_ssr03', variant: 'base', variantLabel: '卡面 A', rarity: 'SSR', label: 'sample',
 portrait: {url:'/assets/card-art/portrait/image_card_portrait_hide_040ren_ssr03.png', width: 720, height: 900},
 landscape: {url:'/assets/card-art/landscape/image_card_landscape_040ren_ssr03.png', width:1600,height:900} }
const menu = e => ({schemaVersion:1,kind:'wallpapers',entries:e})
test('SSR complete same-version pair accepted', () => assert.equal(validateTerminalManifest(menu([record]),'wallpapers').entries.length,1))
for (const [name, mutate] of [
 ['SR rejection', x => { x.rarity = 'SR' }],
 ['missing portrait rejection', x => {delete x.portrait}],
 ['same ID different variant rejection', x => {x.variant = 'p'}],
 ['wrong orientation rejection', x => {x.landscape.width = 200}],
 ['remote URL rejection', x => {x.portrait.url='https://example.com/art.png'}],
 ['candidate path rejection', x => {x.portrait.url='/assets/card-candidate/test/art.png'}],
 ['traversal rejection', x => {x.landscape.url='/assets/card-art/../art.png'}],
]) test(name, () => { const r=structuredClone(record);mutate(r);assert.throws(()=>validateTerminalManifest(menu([r]),'wallpapers')) })
test('duplicate rejection', () => assert.throws(()=>validateTerminalManifest(menu([record,record]),'wallpapers')))
test('scene publication contract',()=>assert.throws(()=>validateTerminalManifest({schemaVersion:1,kind:'backgrounds',entries:[{id:'bg001',label:'x',url:'/assets/bg/bg001.png',published:false}]},'backgrounds')))
test('storage accepts only valid version/key',()=>{assert.equal(normalizeTerminalPreferences({version:99,wallpaperKey:record.id}).wallpaperKey,'');assert.equal(normalizeTerminalPreferences({version:1,wallpaperKey:'javascript:a'}).wallpaperKey,'')})
test('storage round trip',()=>{const s=mem();assert.ok(writeTerminalPreferences(record.id,s).persisted);assert.equal(readTerminalPreferences(s).wallpaperKey,record.id)})
test('denied storage keeps session result',()=>assert.equal(writeTerminalPreferences(record.id,{setItem(){throw Error('denied')}}).preferences.wallpaperKey,record.id))
test('denied global getter cannot throw',()=>{const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('denied')}});try{assert.equal(readTerminalPreferences().wallpaperKey,'');assert.equal(writeTerminalPreferences(record.id).persisted,false)}finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage}})
test('night v1 migrates all non-theme preferences',()=>{const s=mem();s.setItem(ARCHIVE_HOME_PREFERENCES_KEY,JSON.stringify({version:1,preferences:{theme:'night',background:'bg047_arena_out_03',dialogueOrder:'random',autoVoice:true,focusMode:true,interfaceOpacity:76}}));const p=loadArchiveHomePreferences(s);assert.deepEqual(p,{background:'bg047_arena_out_03',dialogueOrder:'random',autoVoice:true,focusMode:true,interfaceOpacity:76});const saved=JSON.parse(s.getItem(ARCHIVE_HOME_PREFERENCES_KEY));assert.equal(saved.version,2);assert.ok(!('theme' in saved.preferences))})
test('migration survives denied writes',()=>{const p=loadArchiveHomePreferences({getItem:()=>JSON.stringify({version:1,preferences:{theme:'night',background:'bg001',autoVoice:true}}),setItem(){throw Error('denied')}});assert.equal(p.background,'bg001');assert.equal(p.autoVoice,true);assert.ok(!('theme' in p))})
test('unknown version returns safe defaults',()=>assert.equal(loadArchiveHomePreferences({getItem:()=>'{"version":99}'}).background,'cue'))
test('save discards reintroduced theme',()=>assert.ok(!('theme' in saveArchiveHomePreferences({theme:'night'},mem()))))
test('pinned background does not follow actor/cue',()=>{const entries=[{id:'bg058_photostudio_in_01'}];for(const fallback of ['bg001_315pro_in_01','bg017_school_in_01'])assert.equal(resolveHomeBackground(entries[0].id,entries,fallback),entries[0].id)})
test('pending catalogue does not erase pinned ID',()=>assert.equal(resolveHomeBackground('bg058_photostudio_in_01',[],'bg001',false),'bg058_photostudio_in_01'))
test('missing scene falls back, does not mutate preference',()=>{const pref='bg058_photostudio_in_01';assert.equal(resolveHomeBackground(pref,[],'bg001',true),'bg001');assert.equal(pref,'bg058_photostudio_in_01')})
test('cue mode explicitly follows source',()=>assert.equal(resolveHomeBackground('cue',[{id:'bg058'}],'bg001'),'bg001'))
test('startup light still portal; explicit route wins',()=>{assert.equal(resolveArchiveStartup('/',{startupMode:'light'}).route.view,'portal');assert.equal(resolveArchiveStartup('/?view=home&home_idol=040ren',{startupMode:'light'},['040ren']).route.homeIdol,'040ren')})
test('eight canonical navigation sections unchanged',()=>assert.equal(ARCHIVE_NAVIGATION.length,8))
let calls=0
const fetcher=async()=>{calls++;return{ok:true,text:async()=>JSON.stringify(menu([record]))}}
await Promise.all([loadTerminalManifest('wallpapers',{retry:true,fetcher}),loadTerminalManifest('wallpapers',{fetcher})]);assert.equal(calls,1);checks++;console.log('PASS catalogue single flight')
await assert.rejects(()=>loadTerminalManifest('backgrounds',{retry:true,fetcher:async()=>({ok:false,status:503})}));
const recovered=await loadTerminalManifest('backgrounds',{fetcher:async()=>({ok:true,text:async()=>JSON.stringify({schemaVersion:1,kind:'backgrounds',entries:[]})})});assert.equal(recovered.entries.length,0);checks++;console.log('PASS failure/retry cache recovery')
const home=readFileSync(new URL('../../src/components/archive/ArchiveImmersiveHome.vue',import.meta.url),'utf8')
const shell=readFileSync(new URL('../../src/components/archive/ArchiveShell.vue',import.meta.url),'utf8')
test('single background owner retained; no CSS scene writer',()=>{assert.ok(home.includes(':manage-background="true"'));assert.ok(home.includes('bg: selectedBackground.value'));assert.ok(!home.includes('backgroundImage:'));assert.ok(!home.includes('availableBackgrounds'));assert.ok(!home.split("<script setup>")[1].includes("preferences.background = 'cue'"))})
test('night controls, class and selectors removed',()=>{assert.ok(!/preferences\.theme|theme-night|settings-theme|夜间/.test(home));assert.ok(!/data-archive-home-theme="night"/.test(shell))})
test('Spine stage not rekeyed on background',()=>{const tag=home.match(/<SpineStage[^]*?\/>/)[0];assert.ok(!tag.includes(':key='))})
test('native Home settings dialog and cleanup',()=>{assert.ok(home.includes('<dialog ref="sceneSettingsRef"'));assert.ok(home.includes('sceneSettingsRef.value?.close()'))})
for (const name of ['ArchivePortalLauncher.vue','ArchiveWelcome.vue']) {
 const source=readFileSync(new URL(`../../src/components/archive/${name}`,import.meta.url),'utf8')
 test(`${name} no heavy runtime import`,()=>assert.ok(!/import[^\n]*(SpineStage|StoryAudio|Pixi|ArchiveImmersiveHome)/.test(source)))
}
// Syntax check SFC scripts with Node only. This is NOT a Vue compiler/template build.
const componentDir=new URL('../../src/components/archive/',import.meta.url)
const names=['ArchivePortalLauncher.vue','ArchiveWelcome.vue','ArchiveImmersiveHome.vue',...readdirSync(new URL('terminal/',componentDir)).filter(x=>x.endsWith('.vue')).map(x=>'terminal/'+x)]
for (const name of names) {
 const source=readFileSync(new URL(name,componentDir),'utf8'),script=source.match(/<script setup>([^]*?)<\/script>/)?.[1]
 assert.ok(script, name)
 const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'})
 assert.equal(result.status,0,`${name}: ${result.stderr}`);checks++
}
console.log(JSON.stringify({checks, status:'pass', scope:'pure JS contracts, source guards, SFC script syntax; not Vue compile or real-device QA'}))
