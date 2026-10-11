<template>
  <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" :viewBox="`0 ${from} 410 ${height}`" :width="width" :height="height">
    <defs><template v-for="n in held" :key="n.id"><clipPath v-for="(mesh,i) in n.bodyTriangles" :id="`${uid}-${n.id}-${i}`" :key="i"><polygon :points="mesh.points" /></clipPath></template></defs>
    <rect width="410" :y="from" :height="height" fill="#13212e" />
    <line v-for="x in geometry.lanes" :key="x" :x1="x" :x2="x" :y1="from" :y2="from+height" stroke="#35485a" />
    <g v-for="g in window.grid" :key="g.tick"><line x1="78" x2="352" :y1="g.y" :y2="g.y" stroke="#30475c" /><text x="8" :y="g.y+4" fill="#bccbd8" font-size="11">{{ g.tick }}</text></g>
    <g v-for="(t,i) in window.tempos" :key="i"><line x1="78" x2="352" :y1="t.y" :y2="t.y" stroke="#c9a755" stroke-dasharray="3 3" /><text x="358" :y="t.y+4" fill="#f3ce7b" font-size="10">{{ t.tempo }}</text></g>
    <g v-for="n in held" :key="`hold:${n.id}`" :data-note-path="n.id"><g v-for="(mesh,i) in n.bodyTriangles" :key="i" :clip-path="`url(#${uid}-${n.id}-${i})`"><image :href="noteRendering.skins[skin].hold_line.url" width="200" height="200" :transform="mesh.matrix" preserveAspectRatio="none" /></g></g>
    <line v-for="link in window.links" :key="link.tick" :data-simultaneous-tick="link.tick" :x1="link.x1" :x2="link.x2" :y1="link.y" :y2="link.y" stroke="#e9faf6" opacity=".65" />
    <g v-for="n in window.middleNodes" :key="n.id" :data-hold-middle="n.id"><ArchiveSongNoteGlyph role="middle" :skin="skin" :x="n.x" :y="n.y" :width="30" /></g>
    <g v-for="n in held" :key="`tail:${n.id}`" :data-note-tail="n.id"><ArchiveSongNoteGlyph :role="n.endRole" :skin="skin" :x="n.endX" :y="n.endY" :width="30" /></g>
    <g v-for="n in window.notes" :key="n.id" :data-note="n.id" :data-note-type="n.type"><ArchiveSongNoteGlyph :role="n.role" :skin="skin" :x="n.x" :y="n.y" :width="30" /></g>
  </svg>
</template>
<script setup>
import {computed,getCurrentInstance} from 'vue'
import {chartGeometryWindow} from '../../presentation/SongChartViewport.js'
import {noteRendering} from '../../presentation/SongNotePresentation.js'
import ArchiveSongNoteGlyph from './ArchiveSongNoteGlyph.vue'
const props=defineProps({geometry:Object,skin:String,from:Number,height:Number,width:{type:Number,default:410}})
const uid=`chart-slice-${getCurrentInstance().uid}`
const window=computed(()=>chartGeometryWindow(props.geometry,props.from,props.from+props.height))
const held=computed(()=>window.value.notes.filter(n=>n.held))
</script>
