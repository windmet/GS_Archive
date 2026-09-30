<template>
  <article class="domain-page studio-page" data-archive-scroll-container>
    <div class="studio-heading"><h2>摄影工作台</h2><span>实验</span></div>
    <p class="domain-intro">在喜欢的场景中调整偶像的姿势与表情，保存自己的纪念画面。</p>
    <p v-if="dataBusy" role="status">正在读取摄影资料…</p>
    <p v-if="error" role="alert" class="domain-error">{{ error }}<button type="button" @click="retry">重试</button></p>
    <div class="studio-layout">
      <div class="studio-preview-column">
      <section class="domain-panel studio-canvas-panel" aria-label="摄影预览">
        <div ref="canvas" class="studio-canvas"></div>
        <p class="studio-status" role="status">{{ modelBusy?'正在载入模型…':modelStatus }}{{ imageBusy?' · 正在读取场景或素材…':'' }}</p>
        <p v-if="imageError" role="alert" class="domain-muted">{{ imageError }}<button type="button" @click="refreshImages">重试素材</button></p>
        <div class="studio-toolbar"><button type="button" :disabled="!modelReady" @click="togglePlayback"><Pause v-if="playing" :size="18"/><Play v-else :size="18"/>{{ playing?'暂停动作':'播放动作' }}</button><button type="button" :disabled="!modelReady" @click="resetComposition"><RotateCcw :size="18"/>重置构图</button><small>1280 × 720</small><button type="button" class="studio-export" :disabled="!canExport || exporting" @click="exportPng"><Download :size="18"/>{{ exporting?'正在导出…':'导出 PNG' }}</button></div>
        <p v-if="exportStatus" role="status" class="domain-muted">{{ exportStatus }}</p>
        <details v-if="exportUrl" open class="studio-export-preview"><summary>导出预览 · <a :href="exportUrl" :download="exportFilename">保存 PNG</a></summary><img :src="exportUrl" alt="导出的摄影画面"/></details>
      </section>
    <section v-if="actor && !modelBusy" class="domain-panel studio-voices"><h3>语音试听</h3><DomainVoicePreview :cues="poseCues" :bindings="actorMedia?.voiceCues"/></section>
      </div>
      <section class="domain-panel studio-controls" aria-label="摄影设置">
        <label>偶像<select :value="actorId" :disabled="dataBusy" @change="emit('photo-idol',$event.target.value)"><option v-for="person in actors" :key="person.id" :value="person.id">{{ person.nameJa }}</option></select></label>
        <label>地点<select v-model="spotId" :disabled="dataBusy"><option v-for="spot in materials?.spots" :key="spot.id" :value="String(spot.id)">{{ spot.name }}</option></select></label>
        <label>场景<select v-model="sceneId" :disabled="dataBusy"><option v-for="scene in scenes" :key="scene.id" :value="String(scene.id)">{{ scene.name }}</option></select></label>
        <label>姿势<select v-model="poseId" :disabled="modelBusy || !actor"><option v-for="pose in actor?.poses" :key="pose.id" :value="String(pose.id)">{{ poseName(pose) }}</option></select></label>
        <label>表情<select v-model="faceId" :disabled="modelBusy || !actor"><option v-for="face in actor?.faces" :key="face.id" :value="String(face.id)">{{ face.iconResourceId }}</option></select></label>
        <div class="studio-faces"><button v-for="face in faceSamples" :key="face.id" type="button" :aria-pressed="String(face.id)===faceId" :aria-label="`选择表情 ${face.iconResourceId}`" :disabled="modelBusy" @click="faceId=String(face.id)"><img v-if="!failedIcons.has(face.id)" :src="actorMedia.entries[`faces:${face.id}`].image.url" :alt="`表情 ${face.iconResourceId}`" @error="failedIcons=new Set([...failedIcons,face.id])"/><span v-else>{{ face.iconResourceId }}</span></button></div>
        <label class="studio-slider">缩放<input v-model.number="zoom" type="range" min="0.6" max="1.6" step="0.05" :disabled="!modelReady"/><output>{{ Math.round(zoom*100) }}%</output></label>
        <label class="studio-slider">横向位置<input v-model.number="offset" type="range" min="-0.35" max="0.35" step="0.01" :disabled="!modelReady"/><output>{{ Math.round(offset*100) }}%</output></label>
        <details open class="studio-materials"><summary>素材</summary><label>贴纸<select v-model="stickerId" :disabled="dataBusy"><option value="">无</option><option v-for="sticker in materials?.stickers" :key="sticker.id" :value="String(sticker.id)">{{ sticker.name }}</option></select></label><label>相框<select v-model="frameId" :disabled="dataBusy"><option value="">无</option><option v-for="frame in materials?.frames" :key="frame.id" :value="String(frame.id)">{{ frame.name }}</option></select></label><label>滤镜<select v-model="filterId" :disabled="!modelReady"><option value="">无</option><option v-for="filter in materials?.filters" :key="filter.id" :value="String(filter.id)">{{ filter.name }}</option></select></label></details>
        <p class="studio-boundary">{{ selectedScene?.effectResourceId?'场景效果尚未重建。 ':'' }}相框采用网页角落排布；滤镜为网页近似。</p>
        <details class="studio-source"><summary>预设来源</summary><p>模型 {{ modelId || '未载入' }}<br/>姿势 {{ selectedPose?.label }}<br/>表情 {{ selectedFace?.label }}</p><p>服装由原摄影脚本指定；构图和素材排布由此工作台调整。</p></details>
      </section>
    </div>

  </article>
</template>
<script setup>
import {computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue'
import {Download,Pause,Play,RotateCcw} from '@lucide/vue'
import {DomainRepository} from '../../../readmodels/runtime/DomainRepository.mjs'
import {PictureStudioStage} from '../../core/PictureStudioStage.js'
import {verifiedStudioPreset} from '../../core/PictureStudioPolicy.mjs'
import DomainVoicePreview from './DomainVoicePreview.vue'
import '../../styles/archive-domains.css'
import '../../styles/picture-studio.css'
const props=defineProps({client:Object,bootstrap:Object,photoIdol:{type:String,default:''},photoEntity:{type:String,default:''}})
const emit=defineEmits(['photo-idol'])
const repository=new DomainRepository(props.client,props.bootstrap)
const canvas=ref(null),actors=shallowRef([]),materials=shallowRef(null),materialMedia=shallowRef(null),actor=shallowRef(null),actorMedia=shallowRef(null)
const dataBusy=ref(true),modelBusy=ref(false),modelReady=ref(false),error=ref(''),imageError=ref(''),modelStatus=ref('请选择摄影资料'),playing=ref(false)
const poseId=ref(''),faceId=ref(''),spotId=ref(''),sceneId=ref(''),stickerId=ref(''),frameId=ref(''),filterId=ref(''),zoom=ref(1),offset=ref(0)
const exporting=ref(false),exportStatus=ref(''),imageBusy=ref(false)
const failedIcons=shallowRef(new Set())
const exportUrl=ref(''),exportFilename=ref('')
let exportRequest=0
function clearExport(){exportRequest++;if(exportUrl.value)URL.revokeObjectURL(exportUrl.value);exportUrl.value='';exportStatus.value=''}
let stage=null,controller=null,request=0,imageRequest=0,disposed=false
const actorId=computed(()=>props.photoIdol || actors.value[0]?.id || '')
const selectedPose=computed(()=>actorMedia.value?.entries[`poses:${poseId.value}`]?.preset)
const selectedFace=computed(()=>actorMedia.value?.entries[`faces:${faceId.value}`]?.preset)
const modelId=computed(()=>selectedPose.value?.modelId || '')
const scenes=computed(()=>{const ids=materials.value?.sceneIdsBySpotId?.[spotId.value] || [];return materials.value?.scenes.filter(scene=>ids.includes(scene.id)) || []})
const selectedScene=computed(()=>scenes.value.find(scene=>String(scene.id)===sceneId.value))
const faceSamples=computed(()=>{const selected=actor.value?.faces.find(face=>String(face.id)===faceId.value);return [...new Map([...(actor.value?.faces.filter(face=>face!==selected).slice(0,2)||[]),selected].filter(Boolean).map(face=>[face.id,face])).values()].slice(0,3)})
const poseCues=computed(()=>[...new Map((actor.value?.poseVoices||[]).filter(cue=>String(cue.photoPoseId)===poseId.value).map(cue=>[`${cue.cueSheetName}:${cue.cueName}`,cue])).values()])
const canExport=computed(()=>modelReady.value && !modelBusy.value && !imageBusy.value && !imageError.value && !error.value)
function poseName(row){const preset=actorMedia.value?.entries[`poses:${row.id}`]?.preset;return [preset?.motion,preset?.neck].filter(Boolean).join(' + ') || `姿势 ${row.iconResourceId}`}
function presets(){return [verifiedStudioPreset(actorMedia.value,'poses',poseId.value,modelId.value),verifiedStudioPreset(actorMedia.value,'faces',faceId.value,modelId.value)]}
function applyPreset(){if(modelBusy.value || !stage?.model)return;try{const plan=stage.applyPreset(...presets());modelReady.value=true;error.value='';modelStatus.value=`模型已载入 · ${plan.motion} · ${plan.face}${plan.neck?' · '+plan.neck:''}`}catch(cause){modelReady.value=false;error.value=cause.message}}
async function loadActor(){
  if(!stage || !materials.value || !actors.value.length || disposed)return
  controller?.abort();controller=new AbortController();const id=++request;modelBusy.value=true;modelReady.value=false;error.value='';stage.cancelModel();clearExport()
  try{
    const person=actors.value.find(row=>row.id===actorId.value);if(!person)throw Error('偶像不在摄影目录中')
    const value=await repository.detail('photos',person,{signal:controller.signal});if(id!==request)return
    actor.value=value.actor;actorMedia.value=value.media;failedIcons.value=new Set();poseId.value=String(value.actor.poses[0].id);faceId.value=String(value.actor.faces[0].id)
    const [kind,seed]=props.photoEntity.split(':')
    if(['faces','poses'].includes(kind)){if(!value.actor[kind].some(row=>String(row.id)===seed))throw Error('选中的摄影预设不属于此偶像');if(kind==='faces')faceId.value=seed;else poseId.value=seed}
    zoom.value=1;offset.value=0;playing.value=false;stage.setPlaying(false);stage.compose(1,0)
    await stage.loadModel(modelId.value,value.media.models[modelId.value],...presets());if(id!==request)return
    modelBusy.value=false;applyPreset();stage.setWebFilter(materials.value.filters.find(filter=>String(filter.id)===filterId.value)?.resourceId || '')
  }catch(cause){if(id===request && !disposed && !controller.signal.aborted){error.value=`模型暂时无法展示：${cause.message}`;modelStatus.value='模型展示失败'}}finally{if(id===request)modelBusy.value=false}
}
async function refreshImages(){
  if(!stage || !materials.value || disposed)return
  const id=++imageRequest;imageBusy.value=true;imageError.value='';clearExport()
  const source=materialMedia.value
  const settled=await Promise.allSettled([
    stage.setImages('background',selectedScene.value?[source?.[`scenes:${selectedScene.value.id}`]?.image]:[]),
    stage.setImages('sticker',stickerId.value?[source?.[`stickers:${stickerId.value}`]?.full]:[]),
    stage.setImages('frame',frameId.value?(source?.[`frames:${frameId.value}`]?.layers || [undefined]):[])])
  if(id!==imageRequest || disposed)return
  const failed=settled.find(result=>result.status==='rejected')
  if(failed)imageError.value=`场景或素材暂时无法读取：${failed.reason.message}`
  imageBusy.value=false
}
function togglePlayback(){clearExport();playing.value=!playing.value;stage.setPlaying(playing.value)}
function resetComposition(){zoom.value=1;offset.value=0;stage.compose(1,0)}
async function exportPng(){
  if(!canExport.value || exporting.value)return
  exporting.value=true;clearExport()
  const id=request,version=exportRequest,filename=`sidem-photo-${actorId.value}-${sceneId.value}-${poseId.value}.png`
  try{const blob=await stage.exportPng();if(disposed || id!==request || version!==exportRequest)return;exportUrl.value=URL.createObjectURL(blob);exportFilename.value=filename;exportStatus.value='PNG 已生成 · 1280 × 720'}catch(cause){if(!disposed && id===request && version===exportRequest)exportStatus.value=`导出失败：${cause.message}`}finally{exporting.value=false}
}
watch(()=>props.photoIdol,loadActor)
watch([poseId,faceId],()=>{clearExport();applyPreset()})
watch([zoom,offset],()=>{clearExport();stage?.compose(zoom.value,offset.value)})
watch(spotId,()=>{sceneId.value=String(scenes.value[0]?.id || '')})
watch([sceneId,stickerId,frameId],refreshImages)
watch(filterId,()=>{clearExport();if(!stage)return;try{stage.setWebFilter(materials.value?.filters.find(filter=>String(filter.id)===filterId.value)?.resourceId || '')}catch(cause){error.value=cause.message}})
function retry(){return materials.value?loadActor():loadBase()}
async function loadBase(){
  controller=new AbortController()
  dataBusy.value=true;error.value=''
  try{
    stage ||= new PictureStudioStage(canvas.value)
    const catalog=await repository.catalog('photos',{signal:controller.signal});if(disposed)return
    actors.value=catalog.filter(row=>row.id!=='materials')
    const value=await repository.detail('photos',catalog.find(row=>row.id==='materials'),{signal:controller.signal});if(disposed)return
    materials.value=value.materials;materialMedia.value=value.media;spotId.value=String(value.materials.spots[0].id)
    const [kind,seed]=props.photoEntity.split(':')
    if(kind && !['faces','poses'].includes(kind)){if(!value.materials[kind]?.some(row=>String(row.id)===seed))throw Error('选中的摄影素材不在目录中');if(kind==='spots')spotId.value=seed;else if(kind==='scenes'){const spot=Object.entries(value.materials.sceneIdsBySpotId).find(([,ids])=>ids.some(id=>String(id)===seed));if(!spot)throw Error('场景没有地点关联');spotId.value=spot[0];await nextTick();sceneId.value=seed}else ({stickers:stickerId,frames:frameId,filters:filterId})[kind].value=seed}
    dataBusy.value=false;await nextTick();await Promise.all([loadActor(),refreshImages()])
  }catch(cause){if(!disposed){materials.value=null;materialMedia.value=null;dataBusy.value=false;error.value=`摄影资料无法载入：${cause.message}`}}
}
onMounted(loadBase)
onBeforeUnmount(()=>{disposed=true;request++;imageRequest++;controller?.abort();clearExport();stage?.destroy()})
</script>
