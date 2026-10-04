import {ARCHIVE_USER_PREFERENCES_KEY,DEFAULT_ARCHIVE_USER_PREFERENCES,loadArchiveUserPreferences,normalizeArchiveUserPreferences} from './archiveUserPreferences.js'
import {ARCHIVE_HOME_PREFERENCES_KEY,DEFAULT_ARCHIVE_HOME_PREFERENCES,loadArchiveHomePreferences,normalizeArchiveHomePreferences} from './archiveHomePreferences.js'
import {TERMINAL_PREFERENCES_KEY,readTerminalPreferences,normalizeTerminalPreferences} from './terminal/terminalMedia.js'
import {PlayerPreferencesRepository,DEFAULT_PLAYER_PREFERENCES,normalizePlayerPreferences} from '../core/story-runtime/PlayerPreferencesRepository.js'
const PLAYER_KEY='sidem-story-player-preferences'
const entries=settings=>[[ARCHIVE_USER_PREFERENCES_KEY,settings.startup],[ARCHIVE_HOME_PREFERENCES_KEY,{version:2,preferences:settings.home}],[PLAYER_KEY,settings.player],[TERMINAL_PREFERENCES_KEY,settings.wallpaper]]
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
export function exportArchiveSettings(storage=globalThis.localStorage) {
  return {app:'sidem-archive-settings',version:1,exportedAt:new Date().toISOString(),settings:{startup:loadArchiveUserPreferences(storage).preferences,home:loadArchiveHomePreferences(storage),player:new PlayerPreferencesRepository({storage}).load(),wallpaper:readTerminalPreferences(storage)}}
}
export function defaultArchiveSettings() {
  return {startup:{...DEFAULT_ARCHIVE_USER_PREFERENCES},home:{...DEFAULT_ARCHIVE_HOME_PREFERENCES},player:structuredClone(DEFAULT_PLAYER_PREFERENCES),wallpaper:normalizeTerminalPreferences(null)}
}
export function validateArchiveSettingsBackup(value,idolCodes) {
  if(value?.app!=='sidem-archive-settings'||value.version!==1||!value.settings||JSON.stringify(Object.keys(value.settings).sort())!==JSON.stringify(['home','player','startup','wallpaper'])) throw Error('不是受支持的 SideM 设置文件。')
  const input=value.settings
  if(input.startup?.version!==3||input.player?.schema_version!==2||input.wallpaper?.version!==1||typeof input.home!=='object'||!input.home) throw Error('设置版本不匹配。')
  const normalized={startup:normalizeArchiveUserPreferences(input.startup),home:normalizeArchiveHomePreferences(input.home),player:normalizePlayerPreferences(input.player),wallpaper:normalizeTerminalPreferences(input.wallpaper)}
  if(stable(input)!==stable(normalized)) throw Error('文件含有无效或未知的设置值。')
  for(const id of [normalized.startup.preferredIdol,normalized.startup.startupIdol]) if(id&&!idolCodes.includes(id)) throw Error('文件中的偶像不在当前档案中。')
  if(normalized.player.producer_name.length>100||normalized.player.story_translation_locale!=='zh-CN') throw Error('姓名或剧情语言设置无效。')
  return normalized
}
// Validate everything before writing; restore the exact previous owned keys on a partial failure.
export function applyArchiveSettings(settings,storage=globalThis.localStorage) {
  const writes=entries(settings),previous=writes.map(([key])=>[key,storage.getItem(key)])
  try {for(const [key,value] of writes) storage.setItem(key,JSON.stringify(value))}
  catch(error){let rollbackFailed=false;for(const [key,value] of previous){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value)}catch{rollbackFailed=true}}throw Error(rollbackFailed?'保存失败，部分旧设置未能恢复，请保留备份。':'浏览器未能保存；原有设置已恢复。',{cause:error})}
}
