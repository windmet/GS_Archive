<template>
  <div ref="scroll" class="chart-scroll" :class="{'chart-columns':folded}" tabindex="0" role="region" :aria-label="`${title} 长轨谱面`" @wheel.passive="manualScroll" @pointerdown="startPointer" @pointerup="finishPointer" @pointercancel="pointer=null" @keydown="manualKey" @scroll.passive="queueViewport">
    <div ref="drawing" class="chart-drawing" :style="{width:`${pixelWidth}px`,height:`${drawingHeight}px`}" :data-chart-layout="folded?'columns':'continuous'" :data-mounted-segments="segments.length">
      <template v-if="folded">
        <div v-for="index in segments" :key="index" class="chart-column" :data-chart-column="index" :style="{left:`${index*panelWidth}px`,width:`${panelWidth}px`}">
          <div class="column-label">{{ index+1 }} · {{ formatChartTime(columns[index].fromSeconds) }}–{{ formatChartTime(columns[index].toSeconds) }}</div>
          <ArchiveSongChartSlice v-memo="[geometry,skin,index,scale,panelWidth]" :geometry="geometry" :skin="skin" :from="columns[index].startY-20" :height="columns[index].height+40" :width="panelWidth" />
          <span v-if="activeColumn===index" class="chart-cursor" :style="{top:`${52+cursorY-columns[index].startY}px`}" data-chart-cursor />
        </div>
      </template>
      <template v-else>
        <ArchiveSongChartSlice v-for="tile in segments" :key="tile.id" v-memo="[geometry,skin,tile.id,scale,pixelWidth]" class="chart-tile" :style="{top:`${tile.from}px`}" :geometry="geometry" :skin="skin" :from="tile.from" :height="tile.height" :width="pixelWidth" />
        <span class="chart-cursor" :style="{top:`${cursorY}px`}" data-chart-cursor />
      </template>
    </div>
  </div>
  <p class="chart-reading-note">{{ folded?'从左向右，每栏从上往下。':'从上往下阅读。' }} 点击定位；黄色线为当前位置。</p>
</template>
<script setup>
import {computed,createVNode,markRaw,nextTick,onBeforeUnmount,onMounted,ref,render} from 'vue'
import {buildSongChartGeometry,buildSongChartColumns,songChartColumnAt} from '../../presentation/SongChartPresentation.js'
import {chartTileWindow,chartColumnWindow} from '../../presentation/SongChartViewport.js'
import {formatChartTime} from '../../presentation/SongChartTiming.js'
import ArchiveSongChartSlice from './ArchiveSongChartSlice.vue'
const props=defineProps({chart:Object,title:String,skin:String,scale:Number,cursor:Number,layout:{type:String,default:'auto'},follow:Boolean})
const emit=defineEmits(['seek'])
const scroll=ref(null),drawing=ref(null),viewportWidth=ref(410),top=ref(0),left=ref(0),visibleHeight=ref(768)
const geometry=computed(()=>markRaw(buildSongChartGeometry(props.chart,props.scale)))
const columns=computed(()=>buildSongChartColumns(props.chart,props.scale))
const folded=computed(()=>props.layout==='columns'||(props.layout==='auto'&&viewportWidth.value>=720))
const activeColumn=computed(()=>songChartColumnAt(columns.value,props.cursor))
const cursorY=computed(()=>42+props.cursor*props.scale/1000)
const panelWidth=computed(()=>viewportWidth.value/Math.max(1,Math.floor(viewportWidth.value/260)))
const drawingHeight=computed(()=>folded.value?Math.ceil(Math.max(...columns.value.map(c=>c.height))+80):geometry.value.height)
const pixelWidth=computed(()=>folded.value?columns.value.length*panelWidth.value:Math.min(410,viewportWidth.value))
const segments=computed(()=>folded.value?chartColumnWindow(columns.value.length,left.value,viewportWidth.value,panelWidth.value):chartTileWindow(drawingHeight.value,top.value,visibleHeight.value))
let resize,outer,viewportFrame=0,followFrame=0,manualUntil=0,pointer=null,disposed=false
function manualScroll(){manualUntil=Infinity}
function manualKey(event){if(['PageDown','PageUp','ArrowDown','ArrowUp'].includes(event.key))manualScroll()}
function measure(){
  viewportFrame=0
  if(!scroll.value||!drawing.value)return
  const box=drawing.value.getBoundingClientRect(),inside=scroll.value.getBoundingClientRect()
  const expanded=scroll.value.scrollHeight<=scroll.value.clientHeight+1
  const host=expanded&&outer?outer.getBoundingClientRect():inside
  top.value=Math.max(0,host.top-box.top)
  visibleHeight.value=Math.max(120,Math.min(innerHeight,host.height))
  left.value=scroll.value.scrollLeft
  const width=scroll.value.clientWidth
  if(Math.abs(width-viewportWidth.value)>1)viewportWidth.value=width
}
function queueViewport(){if(!viewportFrame)viewportFrame=requestAnimationFrame(measure)}
onMounted(()=>{
  outer=scroll.value.closest('[data-chart-scroll-host]')
  resize=new ResizeObserver(queueViewport);resize.observe(scroll.value)
  outer?.addEventListener('scroll',queueViewport,{passive:true})
  outer?.addEventListener('wheel',manualScroll,{passive:true})
  queueViewport()
})
onBeforeUnmount(()=>{disposed=true;resize?.disconnect();cancelAnimationFrame(viewportFrame);cancelAnimationFrame(followFrame);outer?.removeEventListener('scroll',queueViewport);outer?.removeEventListener('wheel',manualScroll)})
function scrollToTick(force=true){
  if(force)manualUntil=0
  if(!scroll.value||!drawing.value||(!force&&performance.now()<manualUntil))return
  if(folded.value){
    const x=activeColumn.value*panelWidth.value
    if(x<scroll.value.scrollLeft||x+panelWidth.value>scroll.value.scrollLeft+scroll.value.clientWidth)scroll.value.scrollLeft=x
  }
  const y=folded.value?52+cursorY.value-columns.value[activeColumn.value].startY:cursorY.value
  const expanded=outer&&scroll.value.scrollHeight<=scroll.value.clientHeight+1
  const host=expanded?outer:scroll.value
  const hostBox=host.getBoundingClientRect(),drawingBox=drawing.value.getBoundingClientRect()
  const visibleY=drawingBox.top+y-hostBox.top
  // Never repeatedly recenter a line which is already inside the reading window.
  if(force||visibleY<60||visibleY>host.clientHeight-130)host.scrollTop=Math.max(0,host.scrollTop+visibleY-100)
  queueViewport()
}
import {watch} from 'vue'
watch(()=>props.cursor,()=>{if(props.follow&&!followFrame)followFrame=requestAnimationFrame(()=>{followFrame=0;if(!disposed)scrollToTick(false)})})
watch(()=>props.follow,value=>{if(value)scrollToTick(true)})
watch([folded,()=>props.scale,()=>props.chart],async()=>{await nextTick();if(!disposed)queueViewport()})
function startPointer(event){pointer=drawing.value?.contains(event.target)?{x:event.clientX,y:event.clientY}:null;manualScroll()}
function finishPointer(event){
  if(!pointer||Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>8){pointer=null;return}
  pointer=null
  const rect=drawing.value.getBoundingClientRect()
  const index=folded.value?Math.min(columns.value.length-1,Math.max(0,Math.floor((event.clientX-rect.left)/panelWidth.value))):0
  const y=event.clientY-rect.top
  const sourceY=folded.value?y-52+columns.value[index].startY:y
  emit('seek',Math.max(0,Math.min(props.chart.maxTick,(sourceY-42)*1000/props.scale)))
}
function getSourceSvg(){
  const host=document.createElement('div')
  render(createVNode(ArchiveSongChartSlice,{geometry:geometry.value,skin:props.skin,from:0,height:geometry.value.height,width:410}),host)
  const svg=host.querySelector('svg').cloneNode(true)
  const line=document.createElementNS('http://www.w3.org/2000/svg','line')
  for(const [key,value] of Object.entries({x1:77,x2:353,y1:cursorY.value,y2:cursorY.value,stroke:'#fff1a2','stroke-width':2}))line.setAttribute(key,value)
  svg.append(line);render(null,host)
  return svg
}
function getSvg(){
  const svg=getSourceSvg()
  if(!folded.value)return svg
  const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs'),source=document.createElementNS(ns,'g')
  source.id='export-chart-source'
  for(const child of [...svg.children])source.append(child)
  defs.append(source);svg.append(defs)
  svg.setAttribute('viewBox',`0 0 ${columns.value.length*434} ${drawingHeight.value}`);svg.setAttribute('width',columns.value.length*434);svg.setAttribute('height',drawingHeight.value)
  for(const column of columns.value){
    const frame=document.createElementNS(ns,'svg');frame.setAttribute('x',column.index*434);frame.setAttribute('y',32);frame.setAttribute('width',410);frame.setAttribute('height',column.height+40);frame.setAttribute('viewBox',`0 ${column.startY-20} 410 ${column.height+40}`)
    const use=document.createElementNS(ns,'use');use.setAttribute('href','#export-chart-source');frame.append(use);svg.append(frame)
    const text=document.createElementNS(ns,'text');text.setAttribute('x',column.index*434+18);text.setAttribute('y',22);text.setAttribute('fill','#d7efee');text.textContent=`${column.index+1} · ${formatChartTime(column.fromSeconds)}–${formatChartTime(column.toSeconds)}`;svg.append(text)
  }
  return svg
}
function getSourceDimensions(){return {width:410,height:geometry.value.height}}
defineExpose({getSvg,getSourceSvg,getSourceDimensions,scrollToTick})
</script>
<style scoped>
.chart-scroll{height:620px;overflow:auto;background:#13212e;border:1px solid #35485a;border-radius:8px;overscroll-behavior:contain;overflow-anchor:none;touch-action:pan-x pan-y}
.chart-drawing{position:relative;margin:0 auto;cursor:crosshair;overflow:hidden}
.chart-columns .chart-drawing{margin:0}
.chart-tile,.chart-column{position:absolute;display:block;left:0}
.chart-column{top:0;border:1px solid #35485a;box-sizing:border-box}
.column-label{height:32px;line-height:32px;padding:0 12px;color:#d7efee;font-size:12px;white-space:nowrap}
.chart-cursor{position:absolute;left:18.8%;right:14%;height:2px;background:#fff1a2;pointer-events:none}
.chart-reading-note{margin:8px 0 0;font-size:.73rem;color:#617380;line-height:1.6}
.chart-scroll:focus-visible{outline:3px solid #1d938a;outline-offset:2px}
@media(max-width:560px){.chart-scroll{height:460px}}
</style>
