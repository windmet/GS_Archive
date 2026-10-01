<template>
  <div ref="studioShell" class="studio-shell" :class="{ 'is-focused': focused }">
  <article class="domain-page studio-page" :class="{ 'is-focused': focused, 'has-drawer': focused && menuOpen }" data-archive-scroll-container>
    <header class="studio-focus-bar">
      <button v-if="standalone" type="button" title="返回打开摄影工作台的页面" aria-label="返回来源页" @click="emit('back')"><ArrowLeft :size="18" />返回</button>
      <button v-else-if="focused" type="button" @click="leaveFocus">退出专注编辑</button>
      <button v-if="!focused" type="button" @click="enterFocus">专注编辑</button>
      <span v-if="focused">摄影工作台 · {{ selected ? objectName(selected) : '点选对象后拖动' }}</span>
      <button v-if="focused" type="button" :disabled="!canUndoDelete" aria-label="撤销删除" title="恢复最近删除的图层" @click="undoDelete"><Undo2 :size="18" /></button>
      <button v-if="focused" type="button" :aria-expanded="menuOpen" title="素材、图层与所选对象的编辑菜单" @click="menuOpen = !menuOpen"><PanelRight :size="18" />菜单</button>
      <button v-if="focused" type="button" :disabled="busy || rendering || documentLoading || !!error || exporting" title="生成无选框的 PNG 图片" @click="exportAndShow"><Download :size="18" />导出</button>
      <button v-if="focused" ref="menuButton" type="button" :aria-expanded="menuOpen && drawerTab === 'files'" aria-controls="studio-focus-menu" title="保存构图、导出图片及全屏设置" aria-label="保存与导出" @click="openDrawer('files')"><Save :size="18" /></button>
    </header>
    <div v-if="focused" class="studio-selection-bar" aria-label="当前图层操作">
      <button type="button" class="studio-edit-selection" :disabled="!selected" :aria-label="selected ? `编辑 ${objectName(selected)}` : '未选择图层'" title="打开所选图层的编辑面板" @click="openDrawer('edit')"><span><strong>{{ selected ? objectName(selected) : '未选择图层' }}</strong><small>{{ selected ? '编辑 ' + (selected.idolId ? '人物' : '贴纸') : '添加素材' }}</small></span><Pencil :size="16" /></button>
      <button type="button" :disabled="!selected || selected.locked || selected.hidden" aria-label="缩小所选图层" title="缩小所选图层" @click="adjustSelected(1 / 1.1)"><Minus :size="18" /></button>
      <button type="button" :disabled="!selected || selected.locked || selected.hidden" aria-label="放大所选图层" title="放大所选图层" @click="adjustSelected(1.1)"><Plus :size="18" /></button>
      <button type="button" :disabled="!selected" aria-label="删除所选图层" title="删除所选图层，可撤销这次删除" class="studio-delete studio-labeled-action" @click="remove(selectedId)"><Trash2 :size="16" />删除</button>
    </div>
    <aside id="studio-focus-menu" ref="drawerHost" v-show="focused && menuOpen" class="studio-focus-drawer" :data-tab="drawerTab" aria-label="摄影工作台菜单">
      <div class="studio-drawer-heading"><strong>摄影菜单</strong><button type="button" @click="closeMenu">收起菜单</button></div>
      <nav aria-label="摄影菜单分区" class="studio-drawer-tabs">
        <button v-for="tab in drawerTabs" :key="tab.id" type="button" :aria-pressed="drawerTab === tab.id" @click="drawerTab = tab.id">{{ tab.label }}</button>
      </nav>
      <div v-show="drawerTab === 'materials'" ref="materialsHost"></div>
      <div v-show="drawerTab === 'objects' || drawerTab === 'edit'"><div ref="controlsHost"></div></div>
      <div v-show="drawerTab === 'files'">
        <div class="studio-fullscreen-actions"><button v-if="!immersive.active.value" type="button" :disabled="immersive.pending.value" @click="immersive.enter(studioShell)"><Maximize :size="18" />横屏全屏</button><button v-else type="button" @click="immersive.leave()"><Minimize :size="18" />退出全屏</button></div>
        <div ref="toolsHost"></div>
      </div>
    </aside>
    <h2>摄影工作台</h2>
    <p v-if="immersive.notice.value" role="status">{{ immersive.notice.value === 'rotate' ? '可继续竖屏编辑，或自行旋转设备。' : '浏览器暂不支持全屏，可继续当前编辑。' }}</p>
    <p v-if="busy" role="status">正在读取摄影资料…</p>
    <p v-if="error" role="alert" class="domain-error">
      {{ error
      }}<button type="button" @click="materials ? retry() : load()">
        重试
      </button>
    </p>
    <div class="studio-layout">
      <div class="studio-preview-column">
        <section class="domain-panel studio-canvas-panel" aria-label="摄影预览">
          <div ref="canvas" class="studio-canvas" data-studio-rotation="0"></div>
          <details class="studio-canvas-help"><summary><CircleHelp :size="15" />操作提示</summary><p>拖动所选对象移动；四角缩放，圆柄旋转；双指缩放、旋转。</p><p>滚轮调整对象大小，Shift＋滚轮旋转。方向键微调，＋/− 调整大小，[ / ] 旋转；Esc 取消拖动。</p></details>
          <output v-if="interaction && (interaction.mode === 'rotate' || interaction.aligned)" class="studio-interaction-feedback">{{ interaction.mode === 'rotate' ? `${interaction.rotation}°` : '已对齐' }}</output>
          <Teleport :to="toolsHost || 'body'" :disabled="!focused || !toolsHost">
          <div class="studio-session-tools">
          <div v-if="selected && !focused" class="studio-quick-tools" aria-label="所选对象快捷操作">
            <span>{{ objectName(selected) }}</span>
            <button type="button" aria-label="缩小所选对象" title="缩小" @click="adjustSelected(1 / 1.1)">−</button>
            <button type="button" aria-label="放大所选对象" title="放大" @click="adjustSelected(1.1)">＋</button>
            <button type="button" aria-label="逆时针旋转所选对象" title="左转 5°" @click="adjustSelected(1, -5)">↶</button>
            <button type="button" aria-label="顺时针旋转所选对象" title="右转 5°" @click="adjustSelected(1, 5)">↷</button>
          </div>
          <p role="status" class="studio-status">
            {{ rendering ? "正在更新构图…" : status }}
          </p>
          <div class="studio-toolbar">
            <button
              type="button"
              :disabled="busy || rendering"
              @click="togglePlayback"
            >
              <Pause v-if="playing" :size="17" /><Play v-else :size="17" />{{
                playing ? "返回定格" : "预览动作"
              }}
            </button>
            <button type="button" :disabled="!selected || selected.locked" @click="reset">
              <RotateCcw :size="17" />重置对象
            </button>
            <button
              v-if="!focused"
              type="button"
              class="studio-export"
              :disabled="busy || rendering || documentLoading || !!error || exporting"
              @click="exportPng"
            >
              <Download :size="17" />导出 PNG
            </button>
          </div>
          <p v-if="playing" role="status">
            正在预览动作；返回、保存或导出时会恢复所选定格。
          </p>
          <div class="studio-toolbar studio-document-toolbar">
            <button type="button" :disabled="busy || rendering || documentLoading" @click="save">
              <Save :size="16" />保存构图</button
            ><button
              type="button"
              :disabled="busy || rendering || documentLoading"
              @click="restore"
            >
              <FolderOpen :size="16" />载入构图
            </button>
            <button type="button" :disabled="busy" @click="reference('A')">
              <Image :size="16" />参考构图 A</button
            ><button type="button" :disabled="busy" @click="reference('B')">
              <Image :size="16" />参考构图 B
            </button>
          </div>
          <details class="studio-document-files">
            <summary>构图文件</summary>
            <p>文件保留素材选择、位置和定格，可在下次载入后继续编辑。照片请使用「导出 PNG」。</p>
            <div class="studio-toolbar">
              <button type="button" :disabled="busy || rendering || documentLoading" @click="exportDocument">
                <Download :size="16" />生成构图文件
              </button>
              <button type="button" :disabled="busy || documentLoading" @click="fileInput.click()">
                <FolderOpen :size="16" />从文件载入
              </button>
              <button type="button" :disabled="busy || rendering || documentLoading" @click="copyDocument">
                <Copy :size="16" />复制构图内容
              </button>
              <input ref="fileInput" type="file" accept=".json,application/json" aria-label="选择构图文件" hidden @change="onDocumentFile" />
              <a v-if="documentUrl" :href="documentUrl" download="sidem-composition.json">保存构图文件</a>
            </div>
          </details>
          <p v-if="documentLoading" role="status">正在读取构图文件及素材…</p>
          <p v-if="documentStatus" role="status">{{ documentStatus }}</p>
          <p v-if="documentError" role="alert" class="domain-error">{{ documentError }}</p>
          <p v-if="exportStatus" role="status">{{ exportStatus }}</p>
          <details v-if="exportUrl" open class="studio-export-preview">
            <summary>
              导出预览 ·
              <a :href="exportUrl" download="sidem-composition.png">保存 PNG</a>
            </summary>
            <img :src="exportUrl" alt="导出的摄影画面" />
          </details>
          </div>
          </Teleport>
        </section>
        <Teleport :to="materialsHost || 'body'" :disabled="!focused || !materialsHost">
        <section
          v-if="materials"
          class="domain-panel studio-library"
          aria-label="摄影素材库"
        >
          <nav class="studio-library-tabs" aria-label="摄影素材种类">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              :aria-pressed="libraryTab === tab.id"
              @click="
                libraryTab = tab.id;
                materialPage = 0;
              "
            >
              {{ tab.label }}
            </button>
          </nav>
          <template v-if="libraryTab === 'background'">
            <label class="studio-field"
              >地点<select
                :value="draft.background.spotId"
                @change="setSpot($event.target.value)"
              >
                <option
                  v-for="spot in materials.spots"
                  :key="spot.id"
                  :value="spot.id"
                >
                  {{ materialName('spots', spot) }}
                </option>
              </select></label
            >
            <label class="studio-field"
              >背景缩放<input
                v-model.number="draft.background.zoom"
                type="number"
                min="1"
                max="3"
                step=".05"
            /></label>
            <div class="studio-backgrounds">
              <button
                v-for="scene in scenes"
                :key="scene.id"
                type="button"
                :aria-pressed="draft.background.sceneId === scene.id"
                @click="draft.background.sceneId = scene.id"
              >
                <img
                  v-if="media[`scenes:${scene.id}`]?.image?.url"
                  :src="media[`scenes:${scene.id}`].image.url"
                  :alt="materialName('scenes', scene)"
                  loading="lazy"
                /><span>{{ materialName('scenes', scene) }}</span>
              </button>
            </div>
          </template>
          <template v-else-if="libraryTab === 'actors'">
            <div class="studio-add-person">
              <label class="studio-field"
                >人物<select v-model="personToAdd">
                  <option
                    v-for="actor in actors"
                    :key="actor.id"
                    :value="actor.id"
                  >
                    {{ actor.nameJa }}
                  </option>
                </select></label
              ><button
                type="button"
                :disabled="busy || personBusy || draft.actors.length >= 6"
                @click="addPersonAndEdit"
              >
                <Plus :size="18" />添加人物
              </button>
            </div>
            <p class="studio-status">
              {{
                personBusy
                  ? "正在读取人物资料…"
                  : "可添加同一偶像的多个实例，每张构图最多 6 人。"
              }}
            </p>
            <div v-if="libraryPerson" class="studio-faces">
              <img
                v-for="face in libraryPerson.actor.faces.slice(0, 3)"
                :key="face.id"
                :src="
                  libraryPerson.media.entries[`faces:${face.id}`]?.image?.url
                "
                :alt="faceName(libraryPerson, face)"
              />
            </div>
          </template>
          <template v-else-if="libraryTab === 'stickers'">
            <label class="studio-search"
              ><Search :size="17" /><input
                v-model="stickerSearch"
                aria-label="搜索贴纸"
                placeholder="搜索贴纸…"
                @input="materialPage = 0"
            /></label>
            <div class="studio-sticker-grid">
              <button
                v-for="sticker in visibleStickers"
                :key="sticker.id"
                type="button"
                :aria-label="`添加贴纸 ${materialName('stickers',sticker)}`"
                :disabled="draft.stickers.length >= 32"
                @click="addSticker(sticker.id)"
              >
                <img
                  v-if="
                    media[`stickers:${sticker.id}`]?.image?.url &&
                    !failedThumbnails.has(sticker.id)
                  "
                  :src="media[`stickers:${sticker.id}`].image.url"
                  alt=""
                  loading="lazy"
                  @error="
                    failedThumbnails = new Set([
                      ...failedThumbnails,
                      sticker.id,
                    ])
                  "
                /><ImageOff v-else :size="24" /><span>{{
                  materialName('stickers',sticker)
                }}</span>
              </button>
            </div>
            <p v-if="!filteredStickers.length" class="studio-status">
              没有匹配的贴纸。
            </p>
            <nav
              v-if="filteredStickers.length > 16"
              class="domain-pagination"
              aria-label="贴纸素材分页"
            >
              <button :disabled="materialPage === 0" @click="materialPage--">
                上一页</button
              ><span
                >{{ materialPage + 1 }} /
                {{ Math.ceil(filteredStickers.length / 16) }}</span
              ><button
                :disabled="(materialPage + 1) * 16 >= filteredStickers.length"
                @click="materialPage++"
              >
                下一页
              </button>
            </nav>
          </template>
          <template v-else>
            <label class="studio-field"
              >相框<select v-model="draft.frameId">
                <option :value="null">无</option>
                <option
                  v-for="frame in materials.frames"
                  :key="frame.id"
                  :value="frame.id"
                >
                  {{ materialName('frames', frame) }}
                </option>
              </select></label
            >
            <label class="studio-field"
              >滤镜<select v-model="draft.filterId">
                <option :value="null">无</option>
                <option
                  v-for="filter in materials.filters"
                  :key="filter.id"
                  :value="filter.id"
                >
                  {{ materialName('filters', filter) }}
                </option>
              </select></label
            >
            <p class="studio-boundary">
              相框使用原始锚点，尺寸仍为网页近似；滤镜为网页近似，场景天气效果尚未重建。
            </p>
          </template>
        </section>
        </Teleport>
      </div>
      <Teleport :to="controlsHost || 'body'" :disabled="!focused || !controlsHost">
      <aside class="domain-panel studio-controls" aria-label="画布对象与属性">
        <section v-show="!focused || drawerTab === 'objects'" class="studio-object-picker" aria-label="图层列表">
        <h3 class="studio-layer-heading"><Layers :size="18" />图层 <span>{{ objects.length }}</span></h3>
        <p class="studio-status">上方在前。人物和贴纸分别调整顺序。</p>
        <div class="studio-object-list">
          <div v-if="draft.frameId" class="studio-background-layer"><Image :size="18" /><span>画框 · 最前景</span><small>在画面效果中更换</small></div>
          <template v-for="group in layerGroups" :key="group.kind">
          <h4 v-if="group.rows.length" class="studio-layer-group">{{ group.label }}</h4>
          <div
            v-for="(row, index) in group.rows"
            :key="row.instanceId"
            class="studio-object-row"
            :data-studio-layer="row.instanceId"
            :class="{ 'is-selected': selectedId === row.instanceId, 'is-hidden': row.hidden, 'is-drop-target': layerDrag.targetId === row.instanceId }"
          >
            <button type="button" class="studio-layer-grip" :aria-label="`拖拽排序 ${objectName(row)}`" title="拖动重排；方向键上下调整" @pointerdown="startLayerDrag($event, row)" @keydown.up.prevent="move(row.instanceId, 1)" @keydown.down.prevent="move(row.instanceId, -1)"><GripVertical :size="15" /></button>
            <button
              type="button"
              class="studio-object-select"
              :aria-pressed="selectedId === row.instanceId"
              :aria-label="`选择对象 ${objectName(row)}`"
              @click="select(row.instanceId)"
            >
              <img
                v-if="objectThumbnail(row)"
                :src="objectThumbnail(row)"
                alt=""
              /><User v-else-if="row.idolId" :size="20" /><Sticker
                v-else
                :size="20"
              /><span>{{ objectName(row) }}</span><small class="studio-layer-number">{{ group.rows.length - index }}</small>
            </button>
            <button type="button" :aria-label="`${row.locked ? '解锁' : '锁定'} ${objectName(row)}`" :aria-pressed="!!row.locked" :title="row.locked ? '解锁后可在画布调整' : '防止画布误选与移动'" @click="toggleLayer(row.instanceId, 'locked')"><Lock v-if="row.locked" :size="15" /><Unlock v-else :size="15" /></button>
            <button type="button" :aria-label="`${row.hidden ? '显示' : '隐藏'} ${objectName(row)}`" :aria-pressed="!!row.hidden" title="临时显示或隐藏，保留图层" @click="toggleLayer(row.instanceId, 'hidden')"><EyeOff v-if="row.hidden" :size="15" /><Eye v-else :size="15" /></button>
            <button
              type="button"
              :aria-label="`删除 ${objectName(row)}`" title="删除图层，可撤销" class="studio-delete"
              @click="remove(row.instanceId)"
            >
              <Trash2 :size="15" />
            </button>
          </div>
          </template>
          <p v-if="!objects.length" class="studio-layer-empty">画布还没有人物或贴纸。点击「素材」添加。</p>
          <div class="studio-background-layer"><Image :size="18" /><span>背景</span><small>在素材中更换</small></div>
        </div>
        <button v-if="!focused" type="button" class="studio-undo-delete" :disabled="!canUndoDelete" @click="undoDelete"><Undo2 :size="17" />撤销删除</button>
        </section>
        <section v-if="selected" v-show="!focused || drawerTab === 'edit'" class="studio-layer-editor" aria-label="编辑所选图层">
          <h3 class="studio-selected-title">
            图层属性：{{ objectName(selected) }}
          </h3>
          <p v-if="selected.locked" class="studio-status"><Lock :size="13" />图层已锁定。<button type="button" @click="toggleLayer(selectedId, 'locked')">解锁编辑</button></p>
          <fieldset class="studio-editable-properties" :disabled="!!selected.locked">
          <template v-if="selectedActor">
            <label class="studio-field"
              >服装<select v-model="selected.modelId">
                <option
                  v-for="costume in selectedActor.costumes"
                  :key="costume.modelId"
                  :value="costume.modelId"
                >
                  {{ archiveText('costume', costume.nameJa) }}
                </option>
              </select></label
            >
            <div class="studio-framing" aria-label="人物景别">
              <button v-for="frame in framingPresets" :key="frame.label" type="button" :aria-pressed="selected.scale === frame.scale && selected.y === frame.y" :title="frame.hint" @click="Object.assign(selected, { scale: frame.scale, y: frame.y })">{{ frame.label }}</button>
            </div>
            <nav class="studio-variant-tabs" aria-label="人物差分种类">
              <button v-for="variant in variantTabs" :key="variant.id" type="button" :aria-pressed="variantTab === variant.id" @click="variantTab = variant.id">{{ variant.label }} <small>{{ selectedActor.actor[variant.id].length }}</small></button>
            </nav>
            <p class="studio-current-variant">{{ variantTab === 'faces' ? '表情' : '动作' }}：{{ variantName(selectedActor, variantTab, currentVariant) }}</p>
            <div class="studio-variant-grid" :aria-label="variantTab === 'faces' ? '表情差分' : '动作差分'">
              <button v-for="variant in selectedActor.actor[variantTab]" :key="variant.id" type="button" :aria-pressed="currentVariant.id === variant.id" :aria-label="`选择${variantTab === 'faces' ? '表情' : '动作'} ${variantName(selectedActor, variantTab, variant)}`" :title="variantTitle(selectedActor, variantTab, variant)" @click="selected[variantTab === 'faces' ? 'faceId' : 'poseId'] = variant.id">
                <img v-if="selectedActor.media.entries[`${variantTab}:${variant.id}`]?.image?.url" :src="selectedActor.media.entries[`${variantTab}:${variant.id}`].image.url" alt="" loading="lazy" />
                <ImageOff v-else :size="24" />
                <span>{{ variantName(selectedActor, variantTab, variant) }}</span><small>{{ studioPresetPresentation(selectedActor, variantTab, variant).number }}</small>
              </button>
            </div>
          </template>
          <div class="studio-order-tools" aria-label="所选图层叠放顺序"><button type="button" :disabled="atEdge(selected, 1)" title="在同类图层中向前移动一层" @click="move(selectedId, 1)"><ArrowUp :size="16" />前移</button><button type="button" :disabled="atEdge(selected, -1)" title="在同类图层中向后移动一层" @click="move(selectedId, -1)"><ArrowDown :size="16" />后移</button></div>
          <details class="studio-fine-adjust"><summary>位置与大小微调</summary>
          <label
            v-for="field in transformFields"
            :key="field.key"
            class="studio-transform"
            >{{ field.label
            }}<input
              v-model.number="selected[field.key]"
              type="range"
              :aria-label="`${field.label}滑块`"
              :min="field.min"
              :max="field.max"
              :step="field.step" /><input
              v-model.number="selected[field.key]"
              type="number"
              :aria-label="`${field.label}数值`"
              :min="field.min"
              :max="field.max"
              :step="field.step"
          /></label>
          </details>
          </fieldset>
          <details v-if="selectedActor" class="studio-source">
            <summary>预设来源</summary>
            <p>
              {{ selected.modelId }}<br />{{
                selectedActor.media.entries[`poses:${selected.poseId}`]?.preset
                  .label
              }}<br />{{
                selectedActor.media.entries[`faces:${selected.faceId}`]?.preset
                  .label
              }}<br />动作：{{ variantTitle(selectedActor, 'poses', selectedActor.actor.poses.find(row => row.id === selected.poseId)) }}<br />表情：{{ variantTitle(selectedActor, 'faces', selectedActor.actor.faces.find(row => row.id === selected.faceId)) }}
            </p>
            <p>
              摄影脚本映射动作与表情；其他服装使用同一偶像的实际动作兼容校验。
            </p>
          </details>
        </section>
        <p v-else-if="!focused || drawerTab === 'edit'" class="studio-status">添加或选择一个画布对象。</p>
      </aside>
      </Teleport>
    </div>
  </article>
  </div>
</template>
<script setup>
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import {
  Download,
  Copy,
  Pause,
  Play,
  RotateCcw,
  Save,
  FolderOpen,
  Image,
  ImageOff,
  Plus,
  Search,
  User,
  Sticker,
  ArrowUp,
  ArrowDown,
  Trash2,
  ArrowLeft, Layers, Minus, Undo2, Maximize, Minimize, Pencil, PanelRight, CircleHelp, GripVertical, Eye, EyeOff, Lock, Unlock,
} from "@lucide/vue";
import { useStudioComposition } from "./useStudioComposition.js";
import { usePlayerImmersiveMode } from '../../composables/usePlayerImmersiveMode.js';
import { studioPresetPresentation } from '../../presentation/studio-preset-labels.mjs';
import {archiveText, archiveSearchText} from './useArchivePhotoText.js';
import "../../styles/archive-domains.css";
import "../../styles/picture-studio.css";
const emit = defineEmits(['back']);
const props = defineProps({
  standalone: Boolean,
  client: Object,
  bootstrap: Object,
  photoIdol: { type: String, default: "" },
  photoEntity: { type: String, default: "" },
});
const canvas = ref(null), fileInput = ref(null);
const studioShell = ref(null), drawerHost = ref(null), menuButton = ref(null);
const materialsHost = ref(null), controlsHost = ref(null), toolsHost = ref(null);
const focused = ref(props.standalone);
const menuOpen = ref(props.standalone && window.innerWidth > 900), drawerTab = ref('edit');
const drawerTabs = [{ id: 'materials', label: '素材' }, { id: 'objects', label: '图层' }, { id: 'edit', label: '编辑' }, { id: 'files', label: '保存' }];
const variantTab = ref('faces');
const variantTabs = [{ id: 'poses', label: '动作' }, { id: 'faces', label: '表情' }];
const framingPresets = [
  { label: '远景', scale: .7, y: .97, hint: '缩小人物，保留更多环境' },
  { label: '中景', scale: 1.15, y: 1.1, hint: '拉近人物，突出上半身' },
  { label: '近景', scale: 1.8, y: 1.68, hint: '放大人物，突出脸部；可继续拖动微调' },
];
const immersive = usePlayerImmersiveMode();
watch(drawerTab, async () => { await nextTick(); if (drawerHost.value) drawerHost.value.scrollTop = 0; });
function enterFocus() { focused.value = true; menuOpen.value = false; }
function leaveFocus() { focused.value = false; menuOpen.value = false; void immersive.leave(); }
function closeMenu() { menuOpen.value = false; menuButton.value?.focus(); }
function openDrawer(tab) { menuOpen.value = !(menuOpen.value && drawerTab.value === tab); drawerTab.value = tab; }
function escapeStudio(event) {
  if (event.key !== 'Escape') return;
  if (menuOpen.value) { closeMenu(); event.preventDefault(); }
}
window.addEventListener('keydown', escapeStudio);
onScopeDispose(() => window.removeEventListener('keydown', escapeStudio));
const {
  draft,
  actors,
  materials,
  media,
  views,
  busy,
  rendering,
  error,
  status,
  selectedId,
  selected,
  selectedActor,
  interaction,
  playing,
  exportUrl,
  exportStatus,
  exporting,
  documentError,
  documentStatus,
  documentUrl,
  documentLoading,
  actorView,
  select,
  addActor,
  addSticker,
  adjustSelected,
  cancelInteraction,
  remove,
  canUndoDelete,
  undoDelete,
  move,
  reorder,
  toggleLayer,
  setSpot,
  reference,
  reset,
  togglePlayback,
  exportPng,
  save,
  restore,
  exportDocument,
  copyDocument,
  importDocument,
  load,
  retry,
} = useStudioComposition(props, canvas);
watch(focused, cancelInteraction);
function onDocumentFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  void importDocument(file);
}
function exportAndShow() { drawerTab.value = 'files'; menuOpen.value = true; void exportPng(); }
const libraryTab = ref("actors"),
  stickerSearch = ref(""),
  materialPage = ref(0),
  personToAdd = ref(props.photoIdol || "1"),
  libraryPerson = shallowRef(null),
  personBusy = ref(false),
  failedThumbnails = shallowRef(new Set());
const tabs = [
  { id: "background", label: "背景" },
  { id: "actors", label: "人物" },
  { id: "stickers", label: "贴纸" },
  { id: "effects", label: "画面效果" },
];
const transformFields = [
  { key: "x", label: "水平位置 X", min: -1, max: 2, step: 0.01 },
  { key: "y", label: "垂直位置 Y", min: -1, max: 3, step: 0.01 },
  { key: "scale", label: "大小", min: 0.1, max: 5, step: 0.05 },
  { key: "rotation", label: "旋转", min: -180, max: 180, step: 1 },
];
const scenes = computed(
  () =>
    materials.value?.scenes.filter((row) =>
      materials.value.sceneIdsBySpotId[draft.value.background.spotId]?.includes(
        row.id,
      ),
    ) || [],
);
const filteredStickers = computed(
  () =>
    materials.value?.stickers.filter((row) =>
      `${archiveSearchText('photo-stickers', row.name)} ${row.id}`
        .toLocaleLowerCase()
        .includes(stickerSearch.value.trim().toLocaleLowerCase()),
    ) || [],
);
const visibleStickers = computed(() =>
  filteredStickers.value.slice(
    materialPage.value * 16,
    (materialPage.value + 1) * 16,
  ),
);
const objects = computed(() => [
  ...draft.value.actors,
  ...draft.value.stickers,
]);
const layerGroups = computed(() => [
  { kind: 'stickers', label: '贴纸 · 前景', rows: [...draft.value.stickers].reverse() },
  { kind: 'actors', label: '人物', rows: [...draft.value.actors].reverse() },
]);
const layerDrag = ref({ id: '', targetId: '' });
let finishLayerDrag = null;
function startLayerDrag(event, row) {
  if (event.button !== 0) return;
  finishLayerDrag?.(false);
  const handle = event.currentTarget, pointerId = event.pointerId;
  event.preventDefault();
  handle.setPointerCapture(pointerId);
  layerDrag.value = { id: row.instanceId, targetId: '' };
  const pointerMove = moveEvent => {
    if (moveEvent.pointerId !== pointerId) return;
    const targetId = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-studio-layer]')?.dataset.studioLayer;
    const target = objects.value.find(candidate => candidate.instanceId === targetId);
    layerDrag.value.targetId = target && !!target.idolId === !!row.idolId ? targetId : '';
    const list = handle.closest('.studio-object-list'), rect = list.getBoundingClientRect();
    if (moveEvent.clientY < rect.top + 24) list.scrollTop -= 12;
    if (moveEvent.clientY > rect.bottom - 24) list.scrollTop += 12;
  };
  const finish = commit => {
    handle.removeEventListener('pointermove', pointerMove);
    handle.removeEventListener('pointerup', pointerUp);
    handle.removeEventListener('pointercancel', pointerCancel);
    handle.removeEventListener('lostpointercapture', pointerCancel);
    window.removeEventListener('blur', pointerCancel);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    if (commit && layerDrag.value.targetId) reorder(row.instanceId, layerDrag.value.targetId);
    layerDrag.value = { id: '', targetId: '' };
    finishLayerDrag = null;
  };
  const pointerUp = upEvent => { if (upEvent.pointerId === pointerId) finish(true); };
  const pointerCancel = () => finish(false);
  finishLayerDrag = finish;
  handle.addEventListener('pointermove', pointerMove);
  handle.addEventListener('pointerup', pointerUp);
  handle.addEventListener('pointercancel', pointerCancel);
  handle.addEventListener('lostpointercapture', pointerCancel);
  window.addEventListener('blur', pointerCancel);
}
onScopeDispose(() => finishLayerDrag?.(false));
watch([selectedId, drawerTab, menuOpen], () => finishLayerDrag?.(false));
watch(selectedId, async () => {
  await nextTick();
  if (drawerTab.value === 'objects' && menuOpen.value)
    controlsHost.value?.querySelector('.studio-object-row.is-selected')?.scrollIntoView({ block: 'nearest' });
});
const currentVariant = computed(() => selectedActor.value?.actor[variantTab.value].find(row => row.id === selected.value?.[variantTab.value === 'faces' ? 'faceId' : 'poseId']));
function variantName(view, kind, row) { return row ? studioPresetPresentation(view, kind, row).label : '未选择'; }
function faceName(view, row) { return variantName(view, 'faces', row); }
function materialName(kind, row) { return archiveText(`photo-${kind}`, row?.name).replace('ステッカー ', ''); }
function variantTitle(view, kind, row) {
  if (!row) return '';
  const value = studioPresetPresentation(view, kind, row);
  return `${value.label} · ${value.number} · ${value.source || row.iconResourceId}`;
}
async function addPersonAndEdit() {
  const before = selectedId.value;
  await addActor(personToAdd.value);
  if (selectedId.value !== before) { drawerTab.value = 'edit'; variantTab.value = 'faces'; }
}
function objectName(row) {
  return row.idolId
    ? actors.value.find((actor) => actor.id === String(row.idolId))?.nameJa ||
        String(row.idolId)
    : materialName('stickers',materials.value?.stickers.find(sticker => sticker.id === row.stickerId)) || String(row.stickerId);
}
function objectThumbnail(row) {
  return row.idolId
    ? views.value.get(String(row.idolId))?.media.entries[`faces:${row.faceId}`]
        ?.image?.url
    : media.value?.[`stickers:${row.stickerId}`]?.image?.url;
}
function atEdge(row, direction) {
  const rows = row.idolId ? draft.value.actors : draft.value.stickers,
    index = rows.findIndex((object) => object.instanceId === row.instanceId);
  return index + direction < 0 || index + direction >= rows.length;
}
let personRequest = 0;
async function previewPerson() {
  if (busy.value || libraryTab.value !== "actors") return;
  const id = ++personRequest;
  personBusy.value = true;
  try {
    const value = await actorView(personToAdd.value);
    if (id === personRequest) libraryPerson.value = value;
  } catch (cause) {
    if (id === personRequest) error.value = cause.message;
  } finally {
    if (id === personRequest) personBusy.value = false;
  }
}
watch([personToAdd, libraryTab, busy], previewPerson);
onMounted(load);
</script>
