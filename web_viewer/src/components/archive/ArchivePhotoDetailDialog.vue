<template>
  <ArchiveTerminalDialog class="photo-detail-dialog" :open="open" :title="name" :title-id="titleId" @close="emit('close')">
    <p v-if="spotName" class="photo-detail-context">{{ spotName }}</p>
    <DomainMediaPreview v-if="kind !== 'filters'" class="photo-detail-preview" :class="{ 'is-background': ['spots', 'scenes'].includes(kind), 'is-transparent': !['spots', 'scenes'].includes(kind) }" :binding="previewBinding" :name="name" />
    <p v-if="kind === 'filters'" class="domain-muted">原始滤镜参数尚未解析；摄影工作台提供网页近似效果。</p>
    <p v-if="activeBinding?.effectStatus === 'effect-not-rendered'" class="domain-muted">当前仅展示背景图，场景效果尚未重建。</p>
    <p class="domain-description">{{ description || '查看对应场景或预设。' }}</p>
    <button type="button" class="domain-action" :data-archive-focus-id="`photo-studio:${studioKey}`" @click="emit('open-studio', studioKey)"><Camera :size="18" aria-hidden="true" />在摄影工作台打开</button>
    <section v-if="kind === 'spots' && scenes.length > 1" class="photo-related-scenes" aria-label="场景">
      <h3>场景 <small>{{ scenes.length }}</small></h3>
      <div class="photo-scene-grid">
        <button v-for="scene in scenes" :key="scene.id" type="button" :aria-label="`切换到场景 ${sceneName(scene)}`" :aria-pressed="scene.id === activeScene" @click="emit('scene', scene.id)">
          <span class="photo-scene-art"><img v-if="sceneMedia?.[`scenes:${scene.id}`]?.image?.url && !failedScenes.has(scene.id)" :src="sceneMedia[`scenes:${scene.id}`].image.url" alt="" loading="lazy" decoding="async" @error="failedScenes.add(scene.id)" /><ImageOff v-else :size="24" aria-hidden="true" /></span>
          <strong>{{ sceneName(scene) }}</strong>
        </button>
      </div>
    </section>
    <section v-if="kind === 'frames' && frameLayers.length" class="photo-frame-layers" aria-label="原始相框图层">
      <h3>原始相框图层</h3>
      <div><DomainMediaPreview v-for="(layer, index) in frameLayers" :key="`${entry.id}:${index}`" class="is-transparent" :binding="layer" :name="`${name} · 图层 ${index + 1}`" /></div>
    </section>
    <details class="photo-detail-source">
      <summary>来源与资源</summary>
      <dl class="domain-meta">
        <div v-if="resourceDescription"><dt>原始说明</dt><dd>{{ entry.description }}</dd></div>
        <div><dt>配置编号</dt><dd>{{ entry.id }}</dd></div>
        <div><dt>资源名称</dt><dd>{{ entry.backgroundResourceId || entry.resourceId || entry.iconResourceId || '未记录' }}</dd></div>
        <div v-if="entry.animationName"><dt>脚本预设</dt><dd>{{ entry.animationName }}</dd></div>
        <div v-if="entry.scenarioResourceId"><dt>脚本资源</dt><dd>{{ entry.scenarioResourceId }}</dd></div>
        <div v-if="entry.effectResourceId"><dt>场景效果</dt><dd>{{ entry.effectResourceId }}</dd></div>
        <div v-if="binding?.preset?.motion"><dt>脚本动作</dt><dd>{{ binding.preset.motion }}</dd></div>
        <div v-if="binding?.preset?.face"><dt>脚本表情</dt><dd>{{ binding.preset.face }}</dd></div>
        <div v-if="binding?.preset?.neck"><dt>颈部动作</dt><dd>{{ binding.preset.neck }}</dd></div>
        <div v-if="initialGrant !== null"><dt>初始配置</dt><dd>{{ initialGrant ? '属于客户端初始授予配置' : '未在初始授予表中出现' }}</dd></div>
      </dl>
    </details>
  </ArchiveTerminalDialog>
</template>
<script setup>
import { computed, getCurrentInstance, ref } from 'vue';
import { Camera, ImageOff } from '@lucide/vue';
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue';
import DomainMediaPreview from './DomainMediaPreview.vue';
import { archiveText } from './useArchivePhotoText.js';
const props = defineProps({
  open: Boolean, kind: String, entry: { type: Object, required: true }, binding: Object,
  name: String, spotName: String, description: String, resourceDescription: Boolean,
  initialGrant: { default: null }, scenes: { type: Array, default: () => [] }, sceneMedia: Object,
  activeScene: { type: Number, default: null },
});
const emit = defineEmits(['close', 'open-studio', 'scene']);
const titleId = `photo-detail-title-${getCurrentInstance().uid}`;
const failedScenes = ref(new Set());
// A spot shows whichever of its scenes is selected, and opens that scene in the studio.
const sceneKey = computed(() => props.kind === 'spots' && props.activeScene != null ? `scenes:${props.activeScene}` : '');
const activeBinding = computed(() => (sceneKey.value && props.sceneMedia?.[sceneKey.value]) || props.binding);
const studioKey = computed(() => sceneKey.value || `${props.kind}:${props.entry.id}`);
const previewBinding = computed(() => props.kind === 'stickers' && activeBinding.value?.full?.url ? activeBinding.value.full : activeBinding.value?.image);
const frameLayers = computed(() => Array.isArray(props.binding?.layers) ? props.binding.layers : []);
const baseSceneName = scene => archiveText('photo-scenes', scene.name) || `场景 ${scene.id}`;
// A spot can carry two scenes of the same name (two 日中 backgrounds); number the repeats.
const sceneNames = computed(() => {
  const seen = new Map()
  return new Map(props.scenes.map(scene => {
    const base = baseSceneName(scene), count = (seen.get(base) || 0) + 1
    seen.set(base, count)
    return [scene.id, count > 1 ? `${base} ${count}` : base]
  }))
});
const sceneName = scene => sceneNames.value.get(scene.id) || baseSceneName(scene);
</script>
<style scoped>
.photo-detail-dialog { width:min(760px,calc(100% - 32px));max-width:calc(100% - 32px);max-height:calc(100dvh - 32px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));padding:0;border:1px solid var(--gs-line);border-radius:12px;background:var(--gs-surface);color:var(--gs-ink);font-family:var(--gs-font-directory);font-size:var(--gs-text-body,14px); }
.photo-detail-dialog[open] { display:flex;flex-direction:column; }
.photo-detail-dialog::backdrop { background:#152b4373; }
.photo-detail-dialog :deep(.terminal-dialog-header) { display:flex;align-items:center;gap:12px;flex:none;padding:12px 16px;border-bottom:1px solid var(--gs-line);background:var(--gs-surface); }
.photo-detail-dialog :deep(.terminal-dialog-header h2) { flex:1;min-width:0;margin:0;font-size:20px;line-height:1.5;overflow-wrap:anywhere; }
.photo-detail-dialog :deep(.terminal-icon-button) { display:grid;place-items:center;flex:none;width:44px;min-height:44px;padding:0;border:1px solid var(--gs-line);border-radius:8px;background:var(--gs-surface);color:var(--gs-mint-ink);cursor:pointer; }
.photo-detail-dialog :deep(.terminal-dialog-body) { min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px; }
.photo-detail-dialog :deep(button:focus-visible),.photo-detail-source summary:focus-visible { outline:3px solid var(--gs-mint);outline-offset:2px; }
.photo-detail-context { margin:0 0 10px;color:var(--gs-ink-3);font-size:13px;line-height:1.6; }
.photo-detail-preview { padding:12px; }
.photo-detail-preview.is-background { display:grid;place-items:center;aspect-ratio:16/9;padding:0; }
.photo-detail-preview.is-background :deep(img) { width:100%;height:100%;min-height:0;max-height:none;object-fit:contain; }
.photo-detail-dialog .is-transparent { background:repeating-conic-gradient(var(--gs-line) 0% 25%,var(--gs-surface) 0% 50%) 50%/16px 16px;border-color:var(--gs-line); }
.photo-detail-preview.is-transparent :deep(img) { min-height:0;max-height:320px;object-fit:contain; }
.photo-detail-dialog .domain-description { margin:12px 0; }
.photo-detail-dialog .domain-action { min-height:44px;margin-bottom:12px;font:inherit;cursor:pointer; }
.photo-related-scenes,.photo-frame-layers { margin:16px 0; }
.photo-related-scenes h3,.photo-frame-layers h3 { margin:0 0 10px;font-size:16px; }
.photo-scene-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px; }
.photo-scene-grid button { display:grid;align-content:start;gap:7px;padding:0 0 8px;min-width:0;border:1px solid var(--gs-line);border-radius:8px;background:var(--gs-surface);color:var(--gs-ink);text-align:left;cursor:pointer; }
.photo-scene-art { display:grid;place-items:center;width:100%;aspect-ratio:16/9;background:var(--gs-line);border-radius:7px 7px 0 0;overflow:hidden;color:var(--gs-ink-3); }
.photo-scene-art img { display:block;width:100%;height:100%;object-fit:contain; }
.photo-scene-grid strong { padding:0 8px;font-size:13px;line-height:1.5;overflow-wrap:anywhere; }
.photo-scene-grid button[aria-pressed=true] { border-color:var(--gs-selected-line);background:var(--gs-selected-bg);color:var(--gs-selected-ink); }
.photo-related-scenes h3 small { margin-left:var(--gs-space-2);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.photo-frame-layers > div { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
.photo-frame-layers :deep(.domain-media-preview) { margin:0; }
.photo-frame-layers :deep(img) { min-height:0;max-height:260px;object-fit:contain; }
.photo-detail-source { margin-top:12px;color:var(--gs-ink-3); }
.photo-detail-source summary { min-height:44px;padding:10px 0;font-size:13px;cursor:pointer; }
.photo-detail-source .domain-meta { margin:0 0 8px; }
@media(hover:hover) and (pointer:fine){.photo-scene-grid button:hover{border-color:var(--gs-selected-line);background:var(--gs-mint-wash);}}
@media(max-width:760px){.photo-detail-dialog{width:calc(100% - 16px);max-width:calc(100% - 16px);max-height:calc(100dvh - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));}.photo-detail-dialog :deep(.terminal-dialog-header),.photo-detail-dialog :deep(.terminal-dialog-body){padding:12px;}.photo-detail-dialog :deep(.terminal-dialog-header h2){font-size:18px;}.photo-scene-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}}
</style>
