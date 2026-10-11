import assert from 'node:assert/strict'
import {exportArchiveSettings,defaultArchiveSettings,validateArchiveSettingsBackup,applyArchiveSettings} from '../src/data/archiveSettingsBackup.js'
import {ARCHIVE_USER_PREFERENCES_KEY} from '../src/data/archiveUserPreferences.js'
import {ARCHIVE_HOME_PREFERENCES_KEY} from '../src/data/archiveHomePreferences.js'
import {PlayerPreferencesRepository} from '../src/core/story-runtime/PlayerPreferencesRepository.js'
import {StoryAudioSession} from '../src/core/story-runtime/StoryAudioSession.js'
const values=new Map([['unrelated','preserved'],['sidem-story-read-history','progress']])
const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
const settings=defaultArchiveSettings()
settings.startup.preferredIdol='040ren';settings.startup.startupIdol='007kei';settings.startup.portalDefaultScope='all';settings.startup.startupPage='portal';settings.startup.onboardingComplete=true
settings.player.producer_name='验收制作人';settings.player.volumes.master=.23;settings.player.volumes.voice=.4;settings.home.autoVoice=true;settings.wallpaper.wallpaperKey='040ren_ssr01:p'
applyArchiveSettings(settings,storage)
const backup=exportArchiveSettings(storage),restore=validateArchiveSettingsBackup(JSON.parse(JSON.stringify(backup)),['040ren','007kei'])
assert.deepEqual(restore,settings)
applyArchiveSettings(defaultArchiveSettings(),storage)
assert.equal(values.get('unrelated'),'preserved');assert.equal(values.get('sidem-story-read-history'),'progress')
applyArchiveSettings(restore,storage)
assert.equal(new PlayerPreferencesRepository({storage}).load().producer_name,'验收制作人')
assert.equal(JSON.parse(values.get(ARCHIVE_HOME_PREFERENCES_KEY)).preferences.autoVoice,true)
for(const mutate of [v=>v.version=2,v=>v.settings.startup.preferredIdol='999zzz',v=>v.settings.player.volumes.master=4,v=>v.settings.player.volumes.voice='0.4',v=>v.settings.home.extra=true,v=>v.settings.player.producer_name='a'.repeat(101),v=>v.settings.home.autoVoice='yes']){
 const invalid=structuredClone(backup);mutate(invalid);assert.throws(()=>validateArchiveSettingsBackup(invalid,['040ren','007kei']))
}
const previous=new Map(values);let writes=0
const faulty={...storage,setItem:(key,value)=>{if(++writes===2)throw Error('quota');storage.setItem(key,value)}}
assert.throws(()=>applyArchiveSettings(defaultArchiveSettings(),faulty),/原有设置已恢复/)
assert.deepEqual(values,previous,'partial failure must restore exact bytes and keep unrelated data')
assert.throws(()=>applyArchiveSettings(settings,{getItem:()=>{throw Error('denied')}}))
const repo=new PlayerPreferencesRepository({storage}),volumes=repo.load().volumes
const audio=new StoryAudioSession({masterVolume:volumes.master,busVolumes:volumes})
assert.equal(audio._masterVolume,.23);assert.equal(audio._busVolumes.voice,.4)
assert.equal(JSON.parse(values.get(ARCHIVE_USER_PREFERENCES_KEY)).portalDefaultScope,'all')
console.log('Settings backup: owned-key roundtrip, defaults, hostile values, partial-write rollback, storage denial, audio gains passed')
