<template>
  <section class="producer-settings" aria-labelledby="producer-settings-title" data-archive-scroll-container>
    <div class="settings-body">
      <header class="settings-head">
        <button type="button" class="settings-back" aria-label="返回来源页" @click="emit('cancel')"><ArrowLeft :size="20" /></button>
        <h1 id="producer-settings-title" ref="heading" tabindex="-1">制作人设置</h1>
      </header>
      <p v-if="notice || status" role="status" class="settings-notice">{{ status || notice }}</p>

      <section class="settings-group" aria-labelledby="settings-producer">
        <h2 id="settings-producer">制作人</h2>
        <div class="settings-row settings-favorite">
          <ArchiveIdolAvatar v-if="favorite" :idol-code="favorite.id" :size="48" :accent-color="favorite.color" decorative />
          <span v-else class="settings-favorite-empty" aria-hidden="true"><UserRound :size="24" /></span>
          <span class="settings-row-copy"><strong>{{ favorite ? displayName(favorite) : '尚未设置担当' }}</strong><small>{{ favorite?.unitName ? `我的担当 · ${favorite.unitName}` : '资料馆首页会围绕担当展开；临时浏览其他偶像不会改变它。' }}</small></span>
          <button type="button" class="settings-button" @click="favoriteOpen=true">{{ favorite ? '更换担当' : '选择担当' }}</button>
        </div>
        <label class="settings-row"><span class="settings-row-copy"><span>跟随担当配色</span><small>{{ favorite ? '选中、播放与进度改用担当色。' : '设置担当后可用。' }}</small></span><input type="checkbox" aria-label="跟随担当配色" :checked="preferences.stageLight === 'idol'" :disabled="!favorite" @change="emit('save-startup',{stageLight:$event.target.checked ? 'idol' : 'mint'})" /></label>
        <div class="settings-row settings-name"><ProducerNameSetting /></div>
      </section>

      <section class="settings-group" aria-labelledby="settings-startup">
        <h2 id="settings-startup">启动与显示</h2>
        <label class="settings-row"><span>默认启动页面</span><select aria-label="默认启动页面" :value="preferences.startupPage" @change="emit('save-startup',{startupPage:$event.target.value,onboardingComplete:true})"><option value="unset" disabled>尚未设置</option><option value="home">315 事务所 · 偶像主页</option><option value="portal">资料馆</option></select></label>
        <label class="settings-row"><span>主页展示方式</span><select aria-label="主页展示方式" :value="preferences.homeMode" @change="emit('save-startup',{homeMode:$event.target.value})"><option value="card">卡面主页</option><option value="spine">立绘主页</option></select></label>
        <label class="settings-row"><span>默认主页偶像</span><select aria-label="默认主页偶像" :value="preferences.startupIdol || ''" @change="emit('save-startup',{startupIdol:$event.target.value || null})"><option value="">打开时选择</option><option v-for="idol in idols" :key="idol.id" :value="idol.id">{{ displayName(idol) }}</option></select></label>
        <label class="settings-row"><span>资料馆默认视角</span><select aria-label="资料馆默认视角" :value="preferences.portalDefaultScope || 'favorite'" @change="emit('save-startup',{portalDefaultScope:$event.target.value})"><option value="favorite">我的担当档案</option><option value="all">全站档案大厅</option></select></label>
        <label class="settings-row"><span>资料语言</span><select aria-label="资料语言" :value="uiLocale" @change="saveArchiveLocale($event.target.value)"><option value="zh-CN">中文译文</option><option value="ja-JP">日本語原文</option></select></label>
        <label class="settings-row"><span>剧情正文</span><select aria-label="剧情正文" :value="player.story_content_mode" @change="savePlayer({story_content_mode:$event.target.value})"><option value="original">原文</option><option value="translation">中文译文</option><option value="bilingual">双语</option></select></label>
        <p class="settings-note">首页人物与担当分开保存。资料语言只影响界面与资料，剧情正文单独设置。</p>
      </section>

      <section class="settings-group" aria-labelledby="settings-sound">
        <h2 id="settings-sound">声音</h2>
        <label class="settings-row"><span>主页自动语音</span><input type="checkbox" aria-label="主页自动语音" :checked="home.autoVoice" @change="home=saveArchiveHomePreferences({...home,autoVoice:$event.target.checked})" /></label>
        <label class="settings-row"><span>主音量</span><span class="volume-control"><input type="range" aria-label="主音量" min="0" max="1" step="0.01" :value="player.volumes.master" @input="savePlayer({volumes:{master:Number($event.target.value)}})" /><output>{{ Math.round(player.volumes.master*100) }}%</output></span></label>
        <label class="settings-row"><span>剧情 BGM</span><span class="volume-control"><input type="range" aria-label="剧情 BGM 音量" min="0" max="1" step="0.01" :value="player.volumes.bgm" @input="savePlayer({volumes:{bgm:Number($event.target.value)}})" /><output>{{ Math.round(player.volumes.bgm*100) }}%</output></span></label>
        <label class="settings-row"><span>语音</span><span class="volume-control"><input type="range" aria-label="语音音量" min="0" max="1" step="0.01" :value="player.volumes.voice" @input="savePlayer({volumes:{voice:Number($event.target.value)}})" /><output>{{ Math.round(player.volumes.voice*100) }}%</output></span></label>
        <p class="settings-note">主音量用于剧情、主页语音和歌曲单曲／谱面试听；主页自动语音仍需浏览器允许播放。</p>
      </section>

      <section class="settings-group" aria-labelledby="settings-backup">
        <h2 id="settings-backup">本地备份</h2>
        <p class="settings-note">设置只保存在当前浏览器。配置文件包含姓名、担当、启动与显示、主页、声音和壁纸偏好，换设备后可导入恢复；不包含游戏资源、阅读进度或收藏。</p>
        <div class="settings-actions">
          <button type="button" class="settings-button" @click="download"><Download :size="16" />导出配置</button>
          <label class="settings-button import-control"><Upload :size="16" />导入配置<input type="file" accept=".json,application/json" aria-label="导入配置文件" @change="readImport" /></label>
          <button class="settings-button settings-reset" type="button" @click="resetOpen=true">重置本站偏好</button>
        </div>
      </section>
    </div>
    <ArchiveTerminalDialog :open="favoriteOpen" title="选择担当" title-id="settings-favorite-title" @close="favoriteOpen=false"><ArchiveIdolPickerPanel :idols="preferredIdols" :idol-name="idolName" :idol-search="idolSearch" :model-value="preferences.preferredIdol || ''" @update:model-value="emit('save-preferred',$event);favoriteOpen=false" /><button type="button" class="settings-text-button" @click="emit('save-preferred','');favoriteOpen=false">暂不设置担当</button></ArchiveTerminalDialog>
    <ArchiveTerminalDialog :open="Boolean(pendingImport)" title="恢复配置" title-id="settings-import-title" @close="pendingImport=null"><p>将恢复姓名、担当、启动、主页、语言、声音与壁纸偏好，替换当前对应设置。</p><p>制作人：{{ pendingImport?.player.producer_name || '未设置' }} · 担当：{{ displayName(preferredIdols.find(row=>row.id===pendingImport?.startup.preferredIdol)) || '未设置' }}</p><button class="settings-button settings-primary" type="button" @click="restore(pendingImport)">确认恢复</button></ArchiveTerminalDialog>
    <ArchiveTerminalDialog :open="resetOpen" title="重置本站偏好" title-id="settings-reset-title" @close="resetOpen=false"><p>姓名、担当、启动、语言、声音、主页和壁纸偏好将恢复默认。阅读进度、收藏和缓存不受影响。</p><button class="settings-button settings-primary" type="button" @click="restore(defaultArchiveSettings())">确认重置偏好</button></ArchiveTerminalDialog>
  </section>
</template>
<script setup>
import {computed,onMounted,ref} from 'vue'
import {ArrowLeft,Download,Upload,UserRound} from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ProducerNameSetting from './ProducerNameSetting.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import {producerName,saveArchiveLocale,uiLocale,setStoryLanguagePreferences} from '../../utils/LanguageStore.js'
import {loadArchiveHomePreferences,saveArchiveHomePreferences} from '../../data/archiveHomePreferences.js'
import {PlayerPreferencesRepository} from '../../core/story-runtime/PlayerPreferencesRepository.js'
import {applyArchiveSettings,defaultArchiveSettings,exportArchiveSettings,validateArchiveSettingsBackup} from '../../data/archiveSettingsBackup.js'
import {useTerminalWallpaper} from '../../data/terminal/useTerminalWallpaper.js'
const props=defineProps({preferences:{type:Object,required:true},idols:{type:Array,default:()=>[]},preferredIdols:{type:Array,default:()=>[]},idolName:{type:Function,default:()=>''},idolSearch:{type:Function,default:()=>''},notice:String})
const emit=defineEmits(['cancel','save-startup','save-preferred','settings-applied'])
const heading=ref(null),favoriteOpen=ref(false),resetOpen=ref(false),pendingImport=ref(null),status=ref(''),home=ref(loadArchiveHomePreferences()),repository=new PlayerPreferencesRepository(),player=ref(repository.load()),wallpaper=useTerminalWallpaper()
const favorite=computed(()=>props.preferredIdols.find(row=>row.id===props.preferences.preferredIdol))
const displayName=idol=>idol?(props.idolName(idol.id)||idol.name):''
function savePlayer(patch){player.value=repository.update(patch);setStoryLanguagePreferences(player.value)}
function download(){try{const url=URL.createObjectURL(new Blob([JSON.stringify(exportArchiveSettings(),null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='sidem-producer-settings.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.value='已请求下载配置文件。'}catch{status.value='无法导出配置，请检查浏览器存储权限。'}}
async function readImport(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;try{if(file.size>65536)throw Error('配置文件不能超过 64 KiB。');pendingImport.value=validateArchiveSettingsBackup(JSON.parse(await file.text()),props.preferredIdols.map(row=>row.id));status.value=''}catch(error){status.value=error.message||'无法读取配置文件。'}}
function restore(settings){try{applyArchiveSettings(settings);player.value=repository.load();home.value=loadArchiveHomePreferences();setStoryLanguagePreferences(player.value);wallpaper.refreshPreferences();emit('settings-applied');pendingImport.value=null;resetOpen.value=false;status.value='设置已保存到此浏览器。'}catch(error){status.value=error.message;pendingImport.value=null;resetOpen.value=false}}
onMounted(()=>heading.value?.focus({preventScroll:true}))
</script>
<style scoped>
/* Producer settings: an ordinary archive page. Group headings, then hairline rows of label and control. */
.producer-settings { height: 100%; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); container: producer-settings / inline-size; }
.settings-body { max-width: 760px; margin: 0 auto; padding: var(--gs-space-8) var(--gs-space-7) var(--gs-space-section); box-sizing: border-box; }
.settings-head { display: flex; align-items: center; gap: var(--gs-space-3); }
.settings-head h1 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); outline: none; }
.settings-back { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); margin-left: calc(-1 * var(--gs-space-3)); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); cursor: pointer; }
.settings-notice { margin: var(--gs-space-5) 0 0; padding-left: var(--gs-space-4); border-left: 2px solid var(--gs-mint); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.settings-group { margin-top: var(--gs-space-9); }
.settings-group h2 { margin: 0; padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.settings-row { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 320px); align-items: center; gap: var(--gs-space-5); min-height: 56px; padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); }
.settings-row select { width: 100%; min-width: 0; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.settings-row input[type=checkbox] { justify-self: end; width: 20px; height: 20px; margin: 0; accent-color: var(--gs-mint-ink); }
.settings-row input[type=range] { flex: 1; min-width: 0; accent-color: var(--gs-mint-ink); }
.volume-control { display: flex; align-items: center; gap: var(--gs-space-3); }
.volume-control output { min-width: 40px; color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-ui); font-variant-numeric: tabular-nums; text-align: right; }
.settings-favorite { grid-template-columns: auto minmax(0, 1fr) auto; }
.settings-favorite-empty { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--gs-line); color: var(--gs-ink-3); }
.settings-row-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.settings-row-copy strong { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.settings-row-copy small, .settings-note { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.7; }
.settings-note { margin: var(--gs-space-3) 0 0; }
.settings-name { display: block; padding-block: var(--gs-space-4); }
.settings-name :deep(.producer-setting) { padding: 0; border: 0; background: none; color: var(--gs-ink); }
.settings-name :deep(input) { min-height: var(--gs-control-touch); border-color: var(--gs-line); border-radius: var(--gs-radius-field); font-size: var(--gs-text-subtitle); }
.settings-name :deep(.producer-preview) { padding: var(--gs-space-2) 0 var(--gs-space-2) var(--gs-space-4); border-left: 2px solid var(--gs-mint); border-radius: 0; background: none; }
.settings-actions { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); margin-top: var(--gs-space-4); }
.settings-button { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-5); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; white-space: nowrap; }
.settings-primary { border-color: var(--gs-action-bg); background: var(--gs-action-bg); color: var(--gs-action-ink); }
.settings-reset { margin-left: auto; border-color: transparent; background: none; color: var(--gs-critical); }
.import-control input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
.settings-text-button { min-height: var(--gs-control-touch); margin-top: var(--gs-space-4); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; cursor: pointer; }
.producer-settings :is(button, select, input):focus-visible, .import-control:focus-within { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@container producer-settings (max-width: 560px) {
  .settings-body { padding: var(--gs-space-5) var(--gs-space-5) var(--gs-space-8); }
  .settings-head h1 { font-size: var(--gs-text-section); }
  .settings-group { margin-top: var(--gs-space-8); }
  .settings-row { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-2); }
  .settings-row:has(> input[type=checkbox]) { grid-template-columns: minmax(0, 1fr) auto; }
  .settings-row select { min-height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .settings-favorite { grid-template-columns: auto minmax(0, 1fr); }
  .settings-favorite .settings-button { grid-column: 1 / -1; }
  .settings-button { min-height: var(--gs-control-touch); }
  .settings-reset { margin-left: 0; }
}
</style>
