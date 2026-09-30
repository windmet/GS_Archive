<template>
  <article class="domain-page studio-page" data-archive-scroll-container>
    <h2>摄影工作台</h2>
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
          <div ref="canvas" class="studio-canvas"></div>
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
            <button type="button" :disabled="!selected" @click="reset">
              <RotateCcw :size="17" />重置对象
            </button>
            <button
              type="button"
              class="studio-export"
              :disabled="busy || rendering || !!error || exporting"
              @click="exportPng"
            >
              <Download :size="17" />导出 PNG
            </button>
          </div>
          <p v-if="playing" role="status">
            正在预览动作；返回、保存或导出时会恢复所选定格。
          </p>
          <div class="studio-toolbar studio-document-toolbar">
            <button type="button" :disabled="busy || rendering" @click="save">
              <Save :size="16" />保存构图</button
            ><button
              type="button"
              :disabled="busy || rendering"
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
          <p v-if="exportStatus" role="status">{{ exportStatus }}</p>
          <details v-if="exportUrl" open class="studio-export-preview">
            <summary>
              导出预览 ·
              <a :href="exportUrl" download="sidem-composition.png">保存 PNG</a>
            </summary>
            <img :src="exportUrl" alt="导出的摄影画面" />
          </details>
        </section>
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
                  {{ spot.name }}
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
                  :alt="scene.name"
                  loading="lazy"
                /><span>{{ scene.name }}</span>
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
                @click="addActor(personToAdd)"
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
                :alt="face.iconResourceId"
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
                :aria-label="`添加贴纸 ${sticker.name}`"
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
                  sticker.name.replace("ステッカー ", "")
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
                  {{ frame.name }}
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
                  {{ filter.name }}
                </option>
              </select></label
            >
            <p class="studio-boundary">
              相框使用原始锚点，尺寸仍为网页近似；滤镜为网页近似，场景天气效果尚未重建。
            </p>
          </template>
        </section>
        <section v-if="selectedActor" class="domain-panel studio-voices">
          <h3>语音试听</h3>
          <DomainVoicePreview
            :key="selected.instanceId"
            :cues="poseCues"
            :bindings="selectedActor.media.voiceCues"
          />
        </section>
      </div>
      <aside class="domain-panel studio-controls" aria-label="画布对象与属性">
        <h3>画布对象</h3>
        <p class="studio-status">列表从后到前排列。可直接拖动画布中的对象。</p>
        <div class="studio-object-list">
          <div
            v-for="row in objects"
            :key="row.instanceId"
            class="studio-object-row"
            :class="{ 'is-selected': selectedId === row.instanceId }"
          >
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
              /><span>{{ objectName(row) }}</span>
            </button>
            <button
              type="button"
              :aria-label="`前移 ${objectName(row)}`"
              :disabled="atEdge(row, 1)"
              @click="move(row.instanceId, 1)"
            >
              <ArrowUp :size="15" /></button
            ><button
              type="button"
              :aria-label="`后移 ${objectName(row)}`"
              :disabled="atEdge(row, -1)"
              @click="move(row.instanceId, -1)"
            >
              <ArrowDown :size="15" /></button
            ><button
              type="button"
              :aria-label="`删除 ${objectName(row)}`"
              @click="remove(row.instanceId)"
            >
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
        <template v-if="selected">
          <h3 class="studio-selected-title">
            对象控制：{{ objectName(selected) }}
          </h3>
          <template v-if="selectedActor">
            <label class="studio-field"
              >服装<select v-model="selected.modelId">
                <option
                  v-for="costume in selectedActor.costumes"
                  :key="costume.modelId"
                  :value="costume.modelId"
                >
                  {{ costume.nameJa }}
                </option>
              </select></label
            >
            <label class="studio-field"
              >姿势<select v-model="selected.poseId">
                <option
                  v-for="pose in selectedActor.actor.poses"
                  :key="pose.id"
                  :value="pose.id"
                >
                  {{ poseName(selectedActor, pose) }}
                </option>
              </select></label
            >
            <label class="studio-field"
              >表情<select v-model="selected.faceId">
                <option
                  v-for="face in selectedActor.actor.faces"
                  :key="face.id"
                  :value="face.id"
                >
                  {{ face.iconResourceId }}
                </option>
              </select></label
            >
            <div class="studio-faces">
              <button
                v-for="face in faceSamples"
                :key="face.id"
                type="button"
                :aria-pressed="selected.faceId === face.id"
                :aria-label="`选择表情 ${face.iconResourceId}`"
                @click="selected.faceId = face.id"
              >
                <img
                  :src="
                    selectedActor.media.entries[`faces:${face.id}`]?.image?.url
                  "
                  :alt="face.iconResourceId"
                />
              </button>
            </div>
          </template>
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
          <label v-if="selectedActor" class="studio-field"
            >动作秒<input
              :value="selected.poseTime"
              @input="
                selected.poseTime =
                  $event.target.value === ''
                    ? null
                    : Number($event.target.value)
              "
              type="number"
              min="0"
              max="60"
              step=".05"
              placeholder="循环定格"
          /></label>
          <label v-if="selectedActor" class="studio-field"
            >表情秒<input
              v-model.number="selected.faceTime"
              type="number"
              min="0"
              max="60"
              step=".05"
          /></label>
          <details v-if="selectedActor" class="studio-source">
            <summary>预设来源</summary>
            <p>
              {{ selected.modelId }}<br />{{
                selectedActor.media.entries[`poses:${selected.poseId}`]?.preset
                  .label
              }}<br />{{
                selectedActor.media.entries[`faces:${selected.faceId}`]?.preset
                  .label
              }}
            </p>
            <p>
              摄影脚本映射动作与表情；其他服装使用同一偶像的实际动作兼容校验。
            </p>
          </details>
        </template>
        <p v-else class="studio-status">添加或选择一个画布对象。</p>
      </aside>
    </div>
  </article>
</template>
<script setup>
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import {
  Download,
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
} from "@lucide/vue";
import { useStudioComposition } from "./useStudioComposition.js";
import DomainVoicePreview from "./DomainVoicePreview.vue";
import "../../styles/archive-domains.css";
import "../../styles/picture-studio.css";
const props = defineProps({
  client: Object,
  bootstrap: Object,
  photoIdol: { type: String, default: "" },
  photoEntity: { type: String, default: "" },
});
const canvas = ref(null);
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
  playing,
  exportUrl,
  exportStatus,
  exporting,
  actorView,
  select,
  addActor,
  addSticker,
  remove,
  move,
  setSpot,
  reference,
  reset,
  togglePlayback,
  exportPng,
  save,
  restore,
  load,
  retry,
} = useStudioComposition(props, canvas);
const libraryTab = ref("stickers"),
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
      `${row.name} ${row.id}`
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
const poseCues = computed(() => [
  ...new Map(
    (selectedActor.value?.actor.poseVoices || [])
      .filter((cue) => cue.photoPoseId === selected.value?.poseId)
      .map((cue) => [`${cue.cueSheetName}:${cue.cueName}`, cue]),
  ).values(),
]);
const faceSamples = computed(() => {
  const faces = selectedActor.value?.actor.faces || [],
    chosen = faces.find((face) => face.id === selected.value?.faceId);
  return [
    ...new Map(
      [...faces.filter((face) => face !== chosen).slice(0, 2), chosen]
        .filter(Boolean)
        .map((face) => [face.id, face]),
    ).values(),
  ];
});
function poseName(view, row) {
  const preset = view.media.entries[`poses:${row.id}`].preset;
  return (
    [preset.motion, preset.neck].filter(Boolean).join(" + ") || String(row.id)
  );
}
function objectName(row) {
  return row.idolId
    ? actors.value.find((actor) => actor.id === String(row.idolId))?.nameJa ||
        String(row.idolId)
    : materials.value?.stickers
        .find((sticker) => sticker.id === row.stickerId)
        ?.name.replace("ステッカー ", "") || String(row.stickerId);
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
