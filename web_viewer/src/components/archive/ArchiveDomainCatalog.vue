<template>
  <article class="domain-page" data-archive-scroll-container>
    <h2>{{ title }}</h2><p class="domain-intro">{{ intro }}</p>
    <nav v-if="mode==='collection_catalog'" class="domain-tabs" aria-label="藏品种类">
      <button type="button" :aria-pressed="kind==='items'" @click="switchKind('items')"><Box :size="18"/>道具</button>
      <button type="button" :aria-pressed="kind==='honors'" @click="switchKind('honors')"><Medal :size="18"/>称号</button>
    </nav>
    <nav v-if="mode==='photo_catalog'" class="domain-tabs" aria-label="摄影分类">
      <button v-for="tab in photoTabs" :key="tab.id" type="button" :aria-pressed="photoTab===tab.id" @click="switchPhotoTab(tab.id)">{{ tab.label }}</button>
    </nav>
    <p v-if="busy" role="status" class="domain-muted">正在读取{{ title }}…</p>
    <p v-if="error" role="alert" class="domain-error">{{ error }}<button type="button" @click="load">重试</button></p>
    <div v-if="!busy && rows.length" class="domain-layout">
      <section class="domain-panel" aria-label="资料目录">
        <div class="domain-tools">
          <label>搜索<input :value="query" placeholder="名称或编号" @input="emit('query',$event.target.value)"/></label>
          <label v-if="mode==='event_catalog'">活动形式<select v-model="eventKind"><option value="">全部</option><option v-for="(label,id) in eventKindLabels" :key="id" :value="id">{{ label }}</option></select></label>
          <label v-if="mode==='collection_catalog'">{{ kind==='items'?'用途分类':'称号类别' }}<select v-model="category"><option value="">全部</option><template v-if="kind==='items'"><option v-for="group in itemBrowseGroups" :key="group.key" :value="group.key">{{ group.label }}</option></template><template v-else><option v-for="type in types" :key="type" :value="String(type)">类别 {{ type }}</option></template></select></label>
          <label v-if="mode==='photo_catalog' && ['faces','poses'].includes(photoTab)">偶像<select :value="actorId" @change="emit('photo-idol',$event.target.value)"><option v-for="idol in actors" :key="idol.id" :value="idol.id">{{ idol.nameJa }}</option></select></label>
        </div>
        <p class="domain-count">{{ filtered.length }} 条资料</p>
        <div class="domain-list">
          <button v-for="row in visible" :key="row.id" type="button" :aria-pressed="String(row.id)===selectedId" @click="select(row)">
            <span class="domain-symbol"><img v-if="mode==='collection_catalog' && row.image?.url && !failedThumbnails.has(`${kind}:${row.id}`)" :src="row.image.url" alt="" loading="lazy" @error="failedThumbnails=new Set([...failedThumbnails,`${kind}:${row.id}`])"/><CalendarDays v-if="mode==='event_catalog'" :size="21"/><Camera v-else-if="mode==='photo_catalog'" :size="21"/><Medal v-else-if="kind==='honors' && (!row.image?.url || failedThumbnails.has(`${kind}:${row.id}`))" :size="21"/><Box v-else-if="!row.image?.url || failedThumbnails.has(`${kind}:${row.id}`)" :size="21"/></span>
            <span class="domain-list-copy"><strong>{{ row.nameJa || row.title || row.name || photoName(row) }}</strong><small v-if="mode==='event_catalog'">{{ eventKindLabels[row.eventKind] }} · {{ historicalDate(row.release_at) }}{{ row.isReprint?' · 复刻':'' }}</small><small v-else-if="mode==='collection_catalog'">{{ kind==='items'?'道具':'称号' }} · {{ row.id }}</small><small v-else>{{ row.resourceId || row.iconResourceId || '配置资料' }}</small></span><ChevronRight :size="16"/>
          </button>
        </div>
        <p v-if="!filtered.length" class="domain-muted">没有匹配的资料。</p>
        <nav v-if="pages>1" class="domain-pagination" aria-label="目录分页"><button type="button" :disabled="page===0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pages }}</span><button type="button" :disabled="page+1>=pages" @click="page++">下一页</button></nav>
      </section>
      <div class="domain-detail" ref="detailElement">
        <template v-if="mode==='collection_catalog' && detail?.entry">
          <section class="domain-panel">
            <div class="domain-detail-title"><Medal v-if="kind==='honors'"/><Box v-else/><h3>{{ detail.entry.nameJa }}</h3></div>
            <DomainMediaPreview :binding="detail.media?.image" :effect-status="detail.media?.effectStatus" :name="detail.entry.nameJa"/>
            <p class="domain-description">{{ detail.entry.descriptionText?.plain || '尚未收录说明。' }}</p>
            <dl class="domain-meta">
              <div><dt>种类</dt><dd>{{ kind==='items'?'道具':'称号' }} · 类别 {{ detail.entry.itemType ?? detail.entry.honorType }}</dd></div>
              <div v-if="detail.entry.term"><dt>历史配置期</dt><dd>{{ historicalDate(detail.entry.term.openAt) }} — {{ historicalDate(detail.entry.term.closeAt) }}</dd></div>
              <div v-if="kind==='items'"><dt>持有上限</dt><dd>{{ detail.entry.maxAmount===undefined?'未记录':number(detail.entry.maxAmount) }}</dd></div>
              <div v-if="detail.entry.hasPrefab"><dt>原始效果</dt><dd>原配置含 Prefab，当前展示静态图片。</dd></div>
            </dl>
            <p class="domain-muted">{{ kind==='honors'?'以下是已知来源，不代表完整的解锁条件。':'历史配置不代表当前可获得。用途分类为阅读整理标签；兑换商店和任务来源尚未完整收录。' }}</p>
          </section>
          <section class="domain-panel"><h3>已知来源与用途</h3><ArchiveRewardTable :rows="detail.sources" sources @open-event="emit('open-event',$event)"/></section>
        </template>
        <section v-else-if="mode==='event_catalog'" class="domain-panel">
          <h3>活动历史</h3><p class="domain-muted">收录 THEATER、315 CARNIVAL、TOUR 与季节活动。选择活动查看历史时间、剧情与已知奖励。</p>
          <p class="domain-muted">复刻与原活动分别保留，明确指向同一剧情章节。兑换商店明细与实时排行榜尚未收录。</p>
        </section>
        <section v-else-if="mode==='photo_catalog' && photoEntry" class="domain-panel">
          <h3>{{ photoEntry.name || photoName(photoEntry) }}</h3>
          <button type="button" class="domain-action" @click="emit('open-studio',`${photoTab}:${photoEntry.id}`)"><Camera :size="18"/>在摄影工作台打开</button>
          <DomainMediaPreview v-if="photoTab!=='filters' && !busy" :binding="photoBinding?.image" :effect-status="photoBinding?.effectStatus" :name="photoEntry.name || photoName(photoEntry)"/>
          <p v-if="photoTab==='filters'" class="domain-muted">原始 shader 参数尚未解析，此页仅展示滤镜名称与配置。</p>
          <p class="domain-description">{{ photoEntry.description || '摄影脚本配置；图片展示对应的配置图标。' }}</p>
          <dl class="domain-meta"><div><dt>配置编号</dt><dd>{{ photoEntry.id }}</dd></div><div><dt>资源名称</dt><dd>{{ photoEntry.resourceId || photoEntry.iconResourceId || '未记录' }}</dd></div>
            <div v-if="['faces','poses'].includes(photoTab)"><dt>脚本预设</dt><dd>{{ photoEntry.animationName }}</dd></div>
            <div v-if="photoEntry.scenarioResourceId"><dt>脚本资源</dt><dd>{{ photoEntry.scenarioResourceId }}</dd></div>
            <div v-if="photoBinding?.preset?.motion"><dt>脚本动作</dt><dd>{{ photoBinding.preset.motion }}</dd></div>
            <div v-if="photoBinding?.preset?.face"><dt>脚本表情</dt><dd>{{ photoBinding.preset.face }}</dd></div>
            <div v-if="photoBinding?.preset?.neck"><dt>颈部动作</dt><dd>{{ photoBinding.preset.neck }}</dd></div>
            <div v-if="initialGrant!==null"><dt>初始配置</dt><dd>{{ initialGrant?'属于客户端初始授予配置':'未在初始授予表中出现' }}</dd></div>
          </dl>
          <div v-if="photoTab==='spots'"><h3>关联场景</h3><div class="domain-records"><div v-for="scene in scenesForSpot" :key="scene.id">{{ scene.name || `场景 ${scene.id}` }}<small>{{ scene.backgroundResourceId }}{{ scene.effectResourceId?' · 效果尚未重建':'' }}</small></div></div><p v-if="!scenesForSpot.length" class="domain-muted">没有关联的场景配置。</p></div>
          <div v-if="photoTab==='poses' && !busy"><h3>语音试听</h3><DomainVoicePreview :cues="poseCues" :bindings="actorMedia?.voiceCues"/></div>
        </section>
        <p v-else-if="!busy" class="domain-muted">选择资料查看详情。</p>
      </div>
    </div>
  </article>
</template>
<script setup>
import {computed,nextTick,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
import {Box,Camera,CalendarDays,ChevronRight,Medal} from '@lucide/vue'
import {DomainRepository} from '../../../readmodels/runtime/DomainRepository.mjs'
import {eventKindLabels,historicalDate,number,itemBrowseGroups,itemBrowseGroup} from './DomainPresentation.mjs'
import ArchiveRewardTable from './ArchiveRewardTable.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import DomainVoicePreview from './DomainVoicePreview.vue'
import '../../styles/archive-domains.css'
const props=defineProps({mode:String,client:Object,bootstrap:Object,entity:{type:String,default:''},photoIdol:{type:String,default:''},photoEntity:{type:String,default:''},query:{type:String,default:''}})
const emit=defineEmits(['query','entity','photo-idol','photo-entity','open-studio','open-event'])
const repository=new DomainRepository(props.client,props.bootstrap)
const kind=ref(props.entity.startsWith('honor:')?'honors':'items'),rows=shallowRef([]),detail=shallowRef(null),materials=shallowRef(null),actor=shallowRef(null),actors=shallowRef([])
const busy=ref(false),error=ref(''),category=ref(''),eventKind=ref(''),page=ref(0),photoTab=ref('spots'),photoSelection=ref('')
const detailElement=ref(null)
const materialMedia=shallowRef(null),actorMedia=shallowRef(null),failedThumbnails=shallowRef(new Set())
const photoTabs=[{id:'spots',label:'地点'},{id:'scenes',label:'场景'},{id:'faces',label:'表情'},{id:'poses',label:'动作'},{id:'stickers',label:'贴纸'},{id:'frames',label:'相框'},{id:'filters',label:'滤镜'}]
const title=computed(()=>({event_catalog:'活动一览',collection_catalog:'藏品馆',photo_catalog:'摄影资料'})[props.mode])
const intro=computed(()=>({event_catalog:'查阅历次活动的剧情、奖励和关联藏品。',collection_catalog:'收录游戏内的道具与称号，查阅说明、已知来源和用途。',photo_catalog:'查阅摄影地点、场景和偶像的表情、动作配置。'})[props.mode])
const actorId=computed(()=>props.photoIdol || actors.value[0]?.id || '')
const photoRows=computed(()=>['faces','poses'].includes(photoTab.value)?actor.value?.[photoTab.value] || []:materials.value?.[photoTab.value] || [])
const sourceRows=computed(()=>props.mode==='photo_catalog'?photoRows.value:rows.value)
const types=computed(()=>[...new Set(rows.value.map(row=>kind.value==='items'?row.itemType:row.honorType))].sort((a,b)=>a-b))
const filtered=computed(()=>{const q=props.query.trim().toLocaleLowerCase();return sourceRows.value.filter(row=>(!q || `${row.nameJa || row.name || row.title || ''} ${row.name || ''} ${row.displayName || ''} ${row.id} ${row.resourceId || row.animationName || ''}`.toLocaleLowerCase().includes(q)) && (props.mode!=='collection_catalog' || !category.value || (kind.value==='items'?itemBrowseGroup(row.itemType).key===category.value:String(row.honorType)===category.value)) && (props.mode!=='event_catalog' || !eventKind.value || row.eventKind===eventKind.value))})
const pages=computed(()=>Math.ceil(filtered.value.length/25)),visible=computed(()=>filtered.value.slice(page.value*25,(page.value+1)*25))
const selectedId=computed(()=>props.mode==='photo_catalog'?String(photoEntry.value?.id || ''):String(detail.value?.entry?.id || ''))
const photoEntry=computed(()=>photoRows.value.find(row=>String(row.id)===photoSelection.value) || photoRows.value[0] || null)
const photoBinding=computed(()=>(['faces','poses'].includes(photoTab.value)?actorMedia.value?.entries:materialMedia.value)?.[`${photoTab.value}:${photoEntry.value?.id}`])
const initialGrant=computed(()=>{const field=({filters:'photoFilterId',stickers:'photoStickerId',spots:'photoSpotId',scenes:'photoSceneId',frames:'photoFrameId'})[photoTab.value];return field&&materials.value?.initialGrants?.[photoTab.value]?materials.value.initialGrants[photoTab.value].some(row=>row[field]===photoEntry.value?.id):null})
const scenesForSpot=computed(()=>{const ids=materials.value?.sceneIdsBySpotId?.[photoEntry.value?.id] || [];return (materials.value?.scenes || []).filter(row=>ids.includes(row.id))})
const poseCues=computed(()=>{const map=new Map();for (const cue of actor.value?.poseVoices || []) if (cue.photoPoseId===photoEntry.value?.id) map.set(`${cue.cueSheetName}:${cue.cueName}`,cue);return [...map.values()]})
function photoName(row){return `${({faces:'表情',poses:'动作',stickers:'贴纸',frames:'相框',filters:'滤镜',scenes:'场景',spots:'地点'})[photoTab.value]} ${row.id}`}
let controller=null,request=0,pendingKindSelection=''
async function load(){
  controller?.abort();controller=new AbortController();const id=++request,options={signal:controller.signal};busy.value=true;error.value='';detail.value=null;rows.value=[]
  try {
    const domain=props.mode==='event_catalog'?'events':props.mode==='photo_catalog'?'photos':kind.value
    const catalog=await repository.catalog(domain,options);if(id!==request)return
    rows.value=catalog
    if(domain==='photos'){
      actors.value=catalog.filter(row=>row.id!=='materials')
      const selected=catalog.find(row=>row.id===actorId.value)
      if(!selected)throw Error('Unknown photo idol')
      const [material,person]=await Promise.all([repository.detail(domain,catalog.find(row=>row.id==='materials'),options),repository.detail(domain,selected,options)])
      if(id!==request)return;materials.value=material.materials;actor.value=person.actor;materialMedia.value=material.media;actorMedia.value=person.media
      const position=filtered.value.findIndex(row=>String(row.id)===photoSelection.value);if(position>=0)page.value=Math.floor(position/25)
      if(props.photoEntity && window.matchMedia('(max-width:700px)').matches){await nextTick();if(id===request)detailElement.value?.scrollIntoView({block:'start'})}
    }else if(domain!=='events'){
      const selectedKey=props.entity.split(':');const compatible=(kind.value==='honors'?'honor':'item')===selectedKey[0]
      const selected=compatible&&selectedKey[1]?catalog.find(row=>row.id===selectedKey[1]):catalog[0]
      if(!selected)throw Error('Unknown collection entity')
      const value=await repository.detail(domain,selected,options);if(id!==request)return;detail.value=value
      if(pendingKindSelection===kind.value){pendingKindSelection='';emit('entity',`${kind.value==='honors'?'honor':'item'}:${selected.id}`)}
      const position=filtered.value.findIndex(row=>row.id===selected.id)
      if(position>=0)page.value=Math.floor(position/25)
      if(props.entity && window.matchMedia('(max-width:700px)').matches){await nextTick();if(id===request)detailElement.value?.scrollIntoView({block:'start'})}
    }
  }catch(cause){if(id!==request || options.signal.aborted)return;console.error('[ArchiveDomains]',cause);error.value='资料暂时无法读取，请重试。'}finally{if(id===request)busy.value=false}
}
async function select(row){
  if(props.mode==='event_catalog')emit('open-event',{event_id:row.id})
  else if(props.mode==='photo_catalog'){
    photoSelection.value=String(row.id);emit('photo-entity',`${photoTab.value}:${row.id}`);await nextTick()
    if(photoSelection.value===String(row.id) && window.matchMedia('(max-width:700px)').matches)detailElement.value?.scrollIntoView({block:'start'})
  }else emit('entity',`${kind.value==='honors'?'honor':'item'}:${row.id}`)
}
function applyPhotoSelection(key){const [kind,id]=(key || '').split(':');if(photoTabs.some(tab=>tab.id===kind)){photoTab.value=kind;photoSelection.value=id;const position=filtered.value.findIndex(row=>String(row.id)===id);page.value=position>=0?Math.floor(position/25):0}else photoSelection.value=''}
function switchPhotoTab(tab){photoTab.value=tab;page.value=0;photoSelection.value='';if(photoRows.value[0])emit('photo-entity',`${tab}:${photoRows.value[0].id}`)}
watch(()=>props.photoEntity,applyPhotoSelection,{immediate:true})
function switchKind(value){if(kind.value===value)return;emit('query','');pendingKindSelection=value;kind.value=value;category.value='';page.value=0}
watch(()=>[props.mode,props.entity,props.photoIdol],()=>{if(props.entity)kind.value=props.entity.startsWith('honor:')?'honors':'items';load()},{immediate:true})
watch(kind,load);watch(()=>[props.query,category.value,eventKind.value],()=>{page.value=0})
onBeforeUnmount(()=>{request++;controller?.abort()})
</script>
