<template>
  <article class="domain-page photo-page" data-archive-scroll-container :aria-busy="busy">
    <p class="domain-intro">查阅摄影地点、场景和偶像的表情、动作配置。</p>
    <nav class="domain-tabs" aria-label="摄影分类">
      <button
        v-for="tab in photoTabs"
        :key="tab.id"
        type="button"
        :aria-pressed="photoTab === tab.id"
        @click="switchPhotoTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>
    <p v-if="busy" role="status" class="domain-muted">正在读取{{ loadingActorName ? `${loadingActorName}的` : '' }}摄影资料…</p>
    <p v-if="error" role="alert" class="domain-error">
      {{ error }}<button type="button" @click="load">重试</button>
    </p>
    <div class="domain-layout">
      <section class="domain-panel" aria-label="资料目录">
        <div class="domain-tools">
          <label
            >搜索<input
              :value="query"
              placeholder="名称或编号"
              @input="emit('query', $event.target.value)"
            />
          </label>
          <label v-if="['faces', 'poses'].includes(photoTab)"
            >偶像<select
              :value="actorId"
              @change="emit('photo-idol', $event.target.value)"
            >
              <option v-for="idol in actors" :key="idol.id" :value="idol.id">
                {{ displayIdolName(idol.idolCode) || idol.nameJa }}
              </option>
            </select>
          </label>
        </div>
        <p class="domain-count">{{ activeDataReady ? `${filtered.length} 条资料` : busy ? '正在读取…' : error ? '结果暂不可用' : '— 条资料' }}</p>
        <div class="domain-list">
          <button
            v-for="row in visible"
            :key="row.id"
            type="button"
            :data-archive-focus-id="`photo:${photoTab}:${row.id}`"
            :aria-pressed="String(row.id) === selectedId"
            @click="select(row)"
          >
            <span class="domain-symbol">
              <img
                v-if="
                  thumbnail(row) &&
                  !failedThumbnails.has(`${photoTab}:${row.id}`)
                "
                :src="thumbnail(row)"
                alt=""
                loading="lazy"
                @error="
                  failedThumbnails = new Set([
                    ...failedThumbnails,
                    `${photoTab}:${row.id}`,
                  ])
                "
              />
              <Camera v-else :size="21" />
            </span>
            <span class="domain-list-copy">
              <strong>{{ photoName(row) }}</strong>
              <small>{{ photoTabs.find(tab => tab.id === photoTab)?.label }}</small>
            </span>
            <ChevronRight :size="16" />
          </button>
        </div>
        <p v-if="activeDataReady && !filtered.length" class="domain-muted">没有匹配的资料。</p>
        <nav v-if="pages > 1" class="domain-pagination" aria-label="目录分页">
          <button type="button" :disabled="page === 0" @click="page--">
            上一页
          </button>
          <span>{{ page + 1 }} / {{ pages }}</span>
          <button type="button" :disabled="page + 1 >= pages" @click="page++">
            下一页
          </button>
        </nav>
      </section>
      <div class="domain-detail" ref="detailElement">
        <section v-if="photoEntry" class="domain-panel">
          <h3>{{ photoName(photoEntry) }}</h3>
          <button
            type="button"
            class="domain-action"
            :data-archive-focus-id="`photo-studio:${photoTab}:${photoEntry.id}`"
            @click="emit('open-studio', `${photoTab}:${photoEntry.id}`)"
          >
            <Camera :size="18" />在摄影工作台打开
          </button>
          <DomainMediaPreview
            v-if="photoTab !== 'filters'"
            :binding="photoBinding?.image"
            :effect-status="photoBinding?.effectStatus"
            :name="photoName(photoEntry)"
          />
          <p v-if="photoTab === 'filters'" class="domain-muted">
            原始 shader 参数尚未解析，此页仅展示滤镜名称与配置。
          </p>
          <p class="domain-description">
            {{
              photoDescription || "查看对应场景或预设。"
            }}
          </p>
          <details><summary>来源与资源</summary><dl class="domain-meta">
            <div v-if="resourceDescription"><dt>原始说明</dt><dd>{{ photoEntry.description }}</dd></div>
            <div>
              <dt>配置编号</dt>
              <dd>{{ photoEntry.id }}</dd>
            </div>
            <div>
              <dt>资源名称</dt>
              <dd>
                {{
                  photoEntry.resourceId || photoEntry.iconResourceId || "未记录"
                }}
              </dd>
            </div>
            <div v-if="['faces', 'poses'].includes(photoTab)">
              <dt>脚本预设</dt>
              <dd>{{ photoEntry.animationName }}</dd>
            </div>
            <div v-if="photoEntry.scenarioResourceId">
              <dt>脚本资源</dt>
              <dd>{{ photoEntry.scenarioResourceId }}</dd>
            </div>
            <div v-if="photoBinding?.preset?.motion">
              <dt>脚本动作</dt>
              <dd>{{ photoBinding.preset.motion }}</dd>
            </div>
            <div v-if="photoBinding?.preset?.face">
              <dt>脚本表情</dt>
              <dd>{{ photoBinding.preset.face }}</dd>
            </div>
            <div v-if="photoBinding?.preset?.neck">
              <dt>颈部动作</dt>
              <dd>{{ photoBinding.preset.neck }}</dd>
            </div>
            <div v-if="initialGrant !== null">
              <dt>初始配置</dt>
              <dd>
                {{
                  initialGrant
                    ? "属于客户端初始授予配置"
                    : "未在初始授予表中出现"
                }}
              </dd>
            </div>
          </dl></details>
          <div v-if="photoTab === 'spots'">
            <h3>关联场景</h3>
            <div class="domain-records">
              <div v-for="scene in scenesForSpot" :key="scene.id">
                {{ archiveText('photo-scenes', scene.name) || `场景 ${scene.id}`
                }}<small
                  >{{ scene.effectResourceId ? "含场景效果" : "背景场景" }}</small
                >
              </div>
            </div>
            <p v-if="!scenesForSpot.length" class="domain-muted">
              没有关联的场景配置。
            </p>
          </div>
        </section>
        <p v-else-if="activeDataReady" class="domain-muted">{{ photoSelection ? '当前资料不在此目录中，请选择有效资料。' : '选择资料查看详情。' }}</p>
      </div>
    </div>
  </article>
</template>
<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { Camera, ChevronRight } from "@lucide/vue";
import DomainMediaPreview from "./DomainMediaPreview.vue";
import {archiveText, archiveSearchText} from './useArchivePhotoText.js';
import {studioPresetPresentation} from '../../presentation/studio-preset-labels.mjs';
import {isArchiveResourceDescription} from '../../presentation/ArchiveGeneralTextCore.mjs';
import { DomainRepository } from "../../../readmodels/runtime/DomainRepository.mjs";
import "../../styles/archive-domains.css";
const props = defineProps({
  client: Object,
  bootstrap: Object,
  photoIdol: { type: String, default: "" },
  photoEntity: { type: String, default: "" },
  query: { type: String, default: "" },
  displayIdolName: { type: Function, default: () => "" },
});
const emit = defineEmits([
    "query",
    "photo-idol",
    "photo-entity",
    "open-studio",
    "ready",
  ]),
  repository = new DomainRepository(props.client, props.bootstrap);
const materials = shallowRef(null),
  actor = shallowRef(null),
  actors = shallowRef([]),
  materialMedia = shallowRef(null),
  actorMedia = shallowRef(null),
  busy = ref(false),
  loadingActorId = ref(""),
  error = ref(""),
  page = ref(0),
  photoTab = ref("spots"),
  photoSelection = ref(""),
  pendingTabSelection = ref(false),
  detailElement = ref(null),
  failedThumbnails = shallowRef(new Set());
const photoTabs = [
  { id: "spots", label: "地点" },
  { id: "scenes", label: "场景" },
  { id: "faces", label: "表情" },
  { id: "poses", label: "动作" },
  { id: "stickers", label: "贴纸" },
  { id: "frames", label: "相框" },
  { id: "filters", label: "滤镜" },
];
const actorId = computed(() => props.photoIdol || actors.value[0]?.id || "");
const loadingActorName = computed(() => {
  const entry = actors.value.find(row => row.id === loadingActorId.value);
  return entry ? props.displayIdolName(entry.idolCode) || entry.nameJa : loadingActorId.value ? `偶像 ${loadingActorId.value}` : '';
});
const actorDataReady = computed(() =>
  actor.value && actorMedia.value && String(actor.value.idolId) === actorId.value && String(actorMedia.value.idolId) === actorId.value,
);
// Shared materials survive reloads; actor presets require the current actor identity.
const activeDataReady = computed(() =>
  ["faces", "poses"].includes(photoTab.value) ? Boolean(actorDataReady.value) : Boolean(materials.value),
);
const photoRows = computed(() =>
  ["faces", "poses"].includes(photoTab.value)
    ? actorDataReady.value ? actor.value[photoTab.value] || [] : []
    : materials.value?.[photoTab.value] || [],
);
const filtered = computed(() => {
  const q = props.query.trim().toLocaleLowerCase();
  return photoRows.value.filter(
    (row) =>
      !q ||
      String(
        archiveSearchText(`photo-${photoTab.value}`, row.name) + ' ' + photoName(row) +
          " " +
          row.id +
          " " +
          (row.resourceId || row.animationName || ""),
      )
        .toLocaleLowerCase()
        .includes(q),
  );
});
const pages = computed(() => Math.ceil(filtered.value.length / 25)),
  visible = computed(() =>
    filtered.value.slice(page.value * 25, (page.value + 1) * 25),
  );
const photoEntry = computed(
    () =>
      photoSelection.value
        ? photoRows.value.find((row) => String(row.id) === photoSelection.value) || null
        : photoRows.value[0] || null,
  ),
  selectedId = computed(() => String(photoEntry.value?.id || ""));
function binding(row) {
  return (
    ["faces", "poses"].includes(photoTab.value)
      ? actorMedia.value?.entries
      : materialMedia.value
  )?.[`${photoTab.value}:${row.id}`];
}
function thumbnail(row) {
  return binding(row)?.image?.url;
}
const photoBinding = computed(() =>
  photoEntry.value ? binding(photoEntry.value) : null,
);
const resourceDescription = computed(()=>isArchiveResourceDescription(`photo-${photoTab.value}`,photoEntry.value?.description));
const photoDescription = computed(()=>resourceDescription.value ? '' : archiveText(`photo-${photoTab.value}`,photoEntry.value?.description,'description'));
const initialGrant = computed(() => {
  const field = {
    filters: "photoFilterId",
    stickers: "photoStickerId",
    spots: "photoSpotId",
    scenes: "photoSceneId",
    frames: "photoFrameId",
  }[photoTab.value];
  return field && materials.value?.initialGrants?.[photoTab.value]
    ? materials.value.initialGrants[photoTab.value].some(
        (row) => row[field] === photoEntry.value?.id,
      )
    : null;
});
const scenesForSpot = computed(() => {
  const ids = materials.value?.sceneIdsBySpotId?.[photoEntry.value?.id] || [];
  return (materials.value?.scenes || []).filter((row) => ids.includes(row.id));
});
function photoName(row) {
  if (['faces','poses'].includes(photoTab.value)) {
    const value = studioPresetPresentation({actor: actor.value, media: actorMedia.value}, photoTab.value, row);
    return `${value.label} · ${value.number}`;
  }
  const source = row.nameJa || row.title || row.name;
  if (source) return archiveText(`photo-${photoTab.value}`, source);
  return `${photoTabs.find((tab) => tab.id === photoTab.value)?.label} ${row.id}`;
}
let controller = null,
  request = 0,
  interactionRevision = 0;
function begin() {
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  return { id: ++request, options: { signal: controller.signal } };
}
function fail(cause, id, options) {
  if (id === request && !options.signal.aborted) {
    console.error("[ArchiveDomains]", cause);
    error.value = `${loadingActorName.value ? `${loadingActorName.value}的` : ''}摄影资料暂时无法读取，请重试。`;
  }
}
onBeforeUnmount(() => {
  request++;
  controller?.abort();
});

async function load() {
  const requestedPhotoEntity = props.photoEntity;
  const requestedInteraction = interactionRevision;
  loadingActorId.value = props.photoIdol || actors.value[0]?.id || "";
  const { id, options } = begin();
  try {
    const catalog = await repository.catalog("photos", options);
    if (id !== request || options.signal.aborted) return;
    actors.value = catalog.filter((row) => row.id !== "materials");
    const selected = catalog.find((row) => row.id === actorId.value);
    if (!selected) throw Error("Unknown photo idol");
    loadingActorId.value = selected.id;
    const [material, person] = await Promise.all([
      repository.detail(
        "photos",
        catalog.find((row) => row.id === "materials"),
        options,
      ),
      repository.detail("photos", selected, options),
    ]);
    if (id !== request || options.signal.aborted) return;
    materials.value = material.materials;
    actor.value = person.actor;
    materialMedia.value = material.media;
    actorMedia.value = person.media;
    if (
      ["faces", "poses"].includes(photoTab.value) &&
      (!props.photoEntity || pendingTabSelection.value) &&
      photoRows.value[0]
    ) {
      photoSelection.value = String(photoRows.value[0].id);
      pendingTabSelection.value = false;
      emit("photo-entity", `${photoTab.value}:${photoSelection.value}`);
    }
    const position = filtered.value.findIndex(
      (row) => String(row.id) === photoSelection.value,
    );
    page.value = position >= 0 ? Math.floor(position / 25) : 0;
    busy.value = false;
    await nextTick();
    if (
      id === request &&
      !options.signal.aborted &&
      requestedInteraction === interactionRevision &&
      requestedPhotoEntity &&
      props.photoEntity === requestedPhotoEntity &&
      photoEntry.value &&
      `${photoTab.value}:${photoEntry.value.id}` === requestedPhotoEntity &&
      window.matchMedia("(max-width:700px)").matches
    )
      detailElement.value?.scrollIntoView({ block: "start" });
    if(id === request && !options.signal.aborted)emit("ready");
  } catch (cause) {
    fail(cause, id, options);
  } finally {
    if (id === request) busy.value = false;
  }
}
async function select(row) {
  if(!photoRows.value.some(entry => String(entry.id) === String(row.id)))return;
  const tab = photoTab.value, person = actorId.value, revision = ++interactionRevision;
  photoSelection.value = String(row.id);
  emit("photo-entity", `${photoTab.value}:${row.id}`);
  await nextTick();
  if (
    revision === interactionRevision && photoTab.value === tab &&
    (!["faces","poses"].includes(tab) || actorId.value === person) &&
    photoEntry.value && String(photoEntry.value.id) === String(row.id) &&
    window.matchMedia("(max-width:700px)").matches
  )
    detailElement.value?.scrollIntoView({ block: "start" });
}
function applyPhotoSelection(key) {
  const [kind, id] = (key || "").split(":");
  if(kind !== photoTab.value || id !== photoSelection.value)interactionRevision++;
  pendingTabSelection.value = false;
  if (photoTabs.some((tab) => tab.id === kind)) {
    photoTab.value = kind;
    photoSelection.value = id;
    const position = filtered.value.findIndex((row) => String(row.id) === id);
    page.value = position >= 0 ? Math.floor(position / 25) : 0;
  } else photoSelection.value = "";
}
function switchPhotoTab(tab) {
  interactionRevision++;
  photoTab.value = tab;
  page.value = 0;
  photoSelection.value = "";
  pendingTabSelection.value = !photoRows.value[0];
  if (photoRows.value[0])
    emit("photo-entity", `${tab}:${photoRows.value[0].id}`);
}
watch(() => props.photoEntity, applyPhotoSelection, { immediate: true });
watch(() => props.photoIdol, load, { immediate: true });
watch(
  () => props.query,
  () => {
    interactionRevision++;
    page.value = 0;
  },
);
</script>
<style scoped>
.photo-page{font-family:var(--gs-font-directory);font-size:var(--gs-text-body);font-weight:var(--gs-weight-regular);min-width:0;}
.photo-page .domain-intro{margin-bottom:var(--gs-space-6);}
.photo-page button,.photo-page input,.photo-page select{font:inherit;min-height:var(--gs-control-touch);font-size:var(--gs-text-ui);}
.photo-page button{font-weight:var(--gs-weight-semibold);}
.photo-page .domain-tabs{gap:var(--gs-space-3);margin-bottom:var(--gs-space-5);}
.photo-page .domain-tabs button{gap:var(--gs-space-3);border-radius:var(--gs-radius-field);}
.photo-page .domain-tools{gap:var(--gs-space-4);margin-bottom:var(--gs-space-5);}
.photo-page .domain-tools label{min-width:0;flex:1 1 140px;gap:var(--gs-space-2);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);}
.photo-page .domain-tools input,.photo-page .domain-tools select{padding:var(--gs-space-3) var(--gs-space-4);border-radius:var(--gs-radius-field);font-weight:var(--gs-weight-regular);}
.photo-page .domain-count{margin-bottom:var(--gs-space-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-medium);}
.photo-page .domain-list>button{gap:var(--gs-space-4);border-radius:var(--gs-radius-control);}
.photo-page .domain-list>button:hover{background:#fff;}
.photo-page .domain-list>button[aria-pressed=true]{background:#e5f6f1;}
.photo-page .domain-list>button:active:not([aria-pressed=true]){background:#f1faf7;}
.photo-page .domain-list strong{font-size:var(--gs-text-body);font-weight:var(--gs-weight-semibold);}
.photo-page .domain-list small{margin-top:var(--gs-space-2);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular);}
.photo-page .domain-pagination{gap:var(--gs-space-4);margin-top:var(--gs-space-5);font-size:var(--gs-text-ui);}
.photo-page .domain-detail h3{font-size:var(--gs-text-section);font-weight:var(--gs-weight-bold);}
.photo-page .domain-detail>.domain-panel>h3:first-child{font-size:var(--gs-text-title);overflow-wrap:anywhere;}
.photo-page .domain-detail details>summary{font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);cursor:pointer;}
.photo-page .domain-meta{font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular);}
.photo-page .domain-action{gap:var(--gs-space-3);border-radius:var(--gs-radius-field);}
@media(hover:hover) and (pointer:fine){.photo-page .domain-list>button:hover:not([aria-pressed=true]){background:#f1faf7;}}
@media(max-width:760px), (pointer:coarse){
 .photo-page .domain-tools input,.photo-page .domain-tools select{font-size:var(--gs-text-subtitle);}
 .photo-page .domain-detail details>summary{min-height:var(--gs-control-touch);padding-block:var(--gs-space-4);}
}
</style>
