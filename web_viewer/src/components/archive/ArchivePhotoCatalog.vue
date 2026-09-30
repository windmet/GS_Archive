<template>
  <article class="domain-page" data-archive-scroll-container>
    <h2>摄影资料</h2>
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
    <p v-if="busy" role="status" class="domain-muted">正在读取摄影资料…</p>
    <p v-if="error" role="alert" class="domain-error">
      {{ error }}<button type="button" @click="load">重试</button>
    </p>
    <div v-if="!busy && rows.length" class="domain-layout">
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
                {{ idol.nameJa }}
              </option>
            </select>
          </label>
        </div>
        <p class="domain-count">{{ filtered.length }} 条资料</p>
        <div class="domain-list">
          <button
            v-for="row in visible"
            :key="row.id"
            type="button"
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
              <strong>{{
                row.nameJa || row.title || row.name || photoName(row)
              }}</strong>
              <small>{{
                row.resourceId || row.iconResourceId || "配置资料"
              }}</small>
            </span>
            <ChevronRight :size="16" />
          </button>
        </div>
        <p v-if="!filtered.length" class="domain-muted">没有匹配的资料。</p>
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
          <h3>{{ photoEntry.name || photoName(photoEntry) }}</h3>
          <button
            type="button"
            class="domain-action"
            @click="emit('open-studio', `${photoTab}:${photoEntry.id}`)"
          >
            <Camera :size="18" />在摄影工作台打开
          </button>
          <DomainMediaPreview
            v-if="photoTab !== 'filters' && !busy"
            :binding="photoBinding?.image"
            :effect-status="photoBinding?.effectStatus"
            :name="photoEntry.name || photoName(photoEntry)"
          />
          <p v-if="photoTab === 'filters'" class="domain-muted">
            原始 shader 参数尚未解析，此页仅展示滤镜名称与配置。
          </p>
          <p class="domain-description">
            {{
              photoEntry.description || "摄影脚本配置；图片展示对应的配置图标。"
            }}
          </p>
          <dl class="domain-meta">
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
          </dl>
          <div v-if="photoTab === 'spots'">
            <h3>关联场景</h3>
            <div class="domain-records">
              <div v-for="scene in scenesForSpot" :key="scene.id">
                {{ scene.name || `场景 ${scene.id}`
                }}<small
                  >{{ scene.backgroundResourceId
                  }}{{ scene.effectResourceId ? " · 效果尚未重建" : "" }}</small
                >
              </div>
            </div>
            <p v-if="!scenesForSpot.length" class="domain-muted">
              没有关联的场景配置。
            </p>
          </div>
          <div v-if="photoTab === 'poses' && !busy">
            <h3>语音试听</h3>
            <DomainVoicePreview
              :cues="poseCues"
              :bindings="actorMedia?.voiceCues"
            />
          </div>
        </section>
        <p v-else-if="!busy" class="domain-muted">选择资料查看详情。</p>
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
import DomainVoicePreview from "./DomainVoicePreview.vue";
import { DomainRepository } from "../../../readmodels/runtime/DomainRepository.mjs";
import "../../styles/archive-domains.css";
const props = defineProps({
  client: Object,
  bootstrap: Object,
  photoIdol: { type: String, default: "" },
  photoEntity: { type: String, default: "" },
  query: { type: String, default: "" },
});
const emit = defineEmits([
    "query",
    "photo-idol",
    "photo-entity",
    "open-studio",
  ]),
  repository = new DomainRepository(props.client, props.bootstrap);
const rows = shallowRef([]),
  materials = shallowRef(null),
  actor = shallowRef(null),
  actors = shallowRef([]),
  materialMedia = shallowRef(null),
  actorMedia = shallowRef(null),
  busy = ref(false),
  error = ref(""),
  page = ref(0),
  photoTab = ref("spots"),
  photoSelection = ref(""),
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
const photoRows = computed(() =>
  ["faces", "poses"].includes(photoTab.value)
    ? actor.value?.[photoTab.value] || []
    : materials.value?.[photoTab.value] || [],
);
const filtered = computed(() => {
  const q = props.query.trim().toLocaleLowerCase();
  return photoRows.value.filter(
    (row) =>
      !q ||
      String(
        (row.name || "") +
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
      photoRows.value.find((row) => String(row.id) === photoSelection.value) ||
      photoRows.value[0] ||
      null,
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
const poseCues = computed(() => [
  ...new Map(
    (actor.value?.poseVoices || [])
      .filter((cue) => cue.photoPoseId === photoEntry.value?.id)
      .map((cue) => [`${cue.cueSheetName}:${cue.cueName}`, cue]),
  ).values(),
]);
function photoName(row) {
  return `${photoTabs.find((tab) => tab.id === photoTab.value)?.label} ${row.id}`;
}
let controller = null,
  request = 0;
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
    error.value = "资料暂时无法读取，请重试。";
  }
}
onBeforeUnmount(() => {
  request++;
  controller?.abort();
});

async function load() {
  const { id, options } = begin();
  rows.value = [];
  try {
    const catalog = await repository.catalog("photos", options);
    if (id !== request) return;
    actors.value = catalog.filter((row) => row.id !== "materials");
    const selected = catalog.find((row) => row.id === actorId.value);
    if (!selected) throw Error("Unknown photo idol");
    const [material, person] = await Promise.all([
      repository.detail(
        "photos",
        catalog.find((row) => row.id === "materials"),
        options,
      ),
      repository.detail("photos", selected, options),
    ]);
    if (id !== request) return;
    rows.value = catalog;
    materials.value = material.materials;
    actor.value = person.actor;
    materialMedia.value = material.media;
    actorMedia.value = person.media;
    const position = filtered.value.findIndex(
      (row) => String(row.id) === photoSelection.value,
    );
    page.value = position >= 0 ? Math.floor(position / 25) : 0;
    await nextTick();
    if (
      id === request &&
      props.photoEntity &&
      window.matchMedia("(max-width:700px)").matches
    )
      detailElement.value?.scrollIntoView({ block: "start" });
  } catch (cause) {
    fail(cause, id, options);
  } finally {
    if (id === request) busy.value = false;
  }
}
async function select(row) {
  photoSelection.value = String(row.id);
  emit("photo-entity", `${photoTab.value}:${row.id}`);
  await nextTick();
  if (
    photoSelection.value === String(row.id) &&
    window.matchMedia("(max-width:700px)").matches
  )
    detailElement.value?.scrollIntoView({ block: "start" });
}
function applyPhotoSelection(key) {
  const [kind, id] = (key || "").split(":");
  if (photoTabs.some((tab) => tab.id === kind)) {
    photoTab.value = kind;
    photoSelection.value = id;
    const position = filtered.value.findIndex((row) => String(row.id) === id);
    page.value = position >= 0 ? Math.floor(position / 25) : 0;
  } else photoSelection.value = "";
}
function switchPhotoTab(tab) {
  photoTab.value = tab;
  page.value = 0;
  photoSelection.value = "";
  if (photoRows.value[0])
    emit("photo-entity", `${tab}:${photoRows.value[0].id}`);
}
watch(() => props.photoEntity, applyPhotoSelection, { immediate: true });
watch(() => props.photoIdol, load, { immediate: true });
watch(
  () => props.query,
  () => {
    page.value = 0;
  },
);
</script>
