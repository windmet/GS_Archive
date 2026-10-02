<template>
  <section class="experiments" data-archive-scroll-container>
    <h2>实验室</h2><p>把视口留给谱面、构图与舞台。</p>
    <div class="experiment-list">
      <button type="button" @click="$emit('charts')"><Music :size="32" /><strong>谱面预览</strong><span>从歌曲选择谱面，全屏查看音符、调整速度并导出。</span></button>
      <button type="button" @click="$emit('photo')"><Camera :size="32" /><strong>摄影工作台</strong><span>组合人物与素材，保存或导出构图。</span></button>
      <button type="button" @click="$emit('stage')"><Sparkles :size="32" /><strong>舞台小人</strong><span>编成演出、查看动作与演唱切换。</span></button>
    </div>
  </section>
</template>
<script setup>
import { Camera, Music, Sparkles } from '@lucide/vue'
defineEmits(['charts','photo','stage'])
</script>
<style scoped>
.experiments { height: 100%; box-sizing: border-box; overflow: auto; padding: 32px; background: #f3f7f8; }
h2 { margin: 0; font-size: 26px; } p { line-height: 1.7; color: #5c7280; }
.experiment-list { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; max-width: 1080px; margin-top: 28px; }
button { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; padding: 24px; min-height: 210px; border: 1px solid #bcd4db; border-radius: 12px; background: white; color: #23606a; text-align: left; font: inherit; cursor: pointer; }
button:hover { border-color: #118a86; background: #eefaf8; } button:focus-visible { outline: 3px solid #007caa; outline-offset: 3px; }
strong { font-size: 20px; } span { color: #536d7a; line-height: 1.8; font-size: 14px; }
@media(max-width:850px) { .experiments { padding: 20px; } .experiment-list { grid-template-columns: 1fr; } button { min-height: 160px; gap: 12px; } }
</style>
