<template>
  <article class="domain-page photo-page" data-archive-scroll-container :aria-busy="busy">
    <p class="domain-intro">查阅摄影地点（含各时段场景）和偶像的表情、动作配置。</p>
    <nav ref="tabsElement" class="domain-tabs" aria-label="摄影分类">
      <button
        v-for="tab in visibleTabs"
        :key="tab.id"
        :data-archive-focus-id="`photo-tab:${tab.id}`"
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
      <section class="photo-directory" aria-label="资料目录">
        <div class="domain-tools">
          <label
            >搜索<input
              ref="searchElement"
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
        <nav v-if="photoTab === 'spots' && variants.length" class="photo-variants" aria-label="时段与天气">
          <button type="button" :aria-pressed="!variant" @click="setVariant('')">全部</button>
          <button v-for="entry in variants" :key="entry.id" type="button" :aria-pressed="variant === entry.id" @click="setVariant(entry.id)">{{ entry.label }} <small>{{ entry.count }}</small></button>
        </nav>
        <nav v-if="photoTab === 'stickers' && stickerGroups.length" class="photo-variants" aria-label="贴纸分类">
          <button type="button" :aria-pressed="!stickerGroup" @click="setStickerGroup('')">全部</button>
          <button v-for="entry in stickerGroups" :key="entry.id" type="button" :aria-pressed="stickerGroup === entry.id" @click="setStickerGroup(entry.id)">{{ entry.label }} <small>{{ entry.count }}</small></button>
        </nav>
        <p class="domain-count">{{ activeDataReady ? `${filtered.length} 条资料` : busy ? '正在读取…' : error ? '结果暂不可用' : '— 条资料' }}</p>
        <div ref="gridElement" class="photo-grid" :class="{ 'is-backgrounds': ['spots', 'scenes'].includes(photoTab), 'is-frames': photoTab === 'frames', 'is-filters': photoTab === 'filters' }">
          <button
            v-for="row in visible"
            :key="`${photoTab}:${row.id}`"
            type="button"
            :data-archive-focus-id="`photo:${photoTab}:${row.id}`"
            :aria-label="[photoName(row), sceneSpotName(row)].filter(Boolean).join(' · ')"
            :title="photoName(row)"
            :aria-pressed="detailOpen && String(row.id) === selectedId"
            aria-haspopup="dialog"
            @click="select(row)"
          >
            <span class="photo-card-art" :class="{ 'is-transparent': !['spots', 'scenes', 'filters'].includes(photoTab) }">
              <img
                v-if="
                  thumbnail(row) &&
                  !failedThumbnails.has(`${photoTab}:${row.id}`)
                "
                :src="thumbnail(row)"
                alt=""
                loading="lazy"
                decoding="async"
                @error="thumbnailFailed(row)"
              />
              <SlidersHorizontal v-else-if="photoTab === 'filters'" :size="26" aria-hidden="true" />
              <Camera v-else :size="26" aria-hidden="true" />
            </span>
            <span class="photo-card-copy">
              <strong>{{ photoName(row) }}</strong>
              <small v-if="photoTab === 'scenes'">{{ sceneSpotName(row) }}</small>
              <small v-else-if="photoTab === 'spots'">{{ spotVariantLine(row) }}</small>
            </span>
          </button>
        </div>
        <p v-if="activeDataReady && !filtered.length" class="domain-muted">没有匹配的资料。</p>
        <nav v-if="pages > 1" class="domain-pagination" aria-label="目录分页">
          <button type="button" :disabled="page === 0" @click="changePage(-1)">
            上一页
          </button>
          <span>{{ page + 1 }} / {{ pages }}</span>
          <button type="button" :disabled="page + 1 >= pages" @click="changePage(1)">
            下一页
          </button>
        </nav>
      </section>
      <p v-if="activeDataReady && photoSelection && !photoEntry" class="domain-muted">当前资料不在此目录中，请选择有效资料。</p>
      <ArchivePhotoDetailDialog
        v-if="photoEntry"
        :open="detailOpen"
        :kind="photoTab"
        :entry="photoEntry"
        :binding="photoBinding"
        :name="photoName(photoEntry)"
        :spot-name="sceneSpotName(photoEntry)"
        :description="photoDescription"
        :resource-description="resourceDescription"
        :initial-grant="initialGrant"
        :scenes="photoTab === 'spots' ? scenesForSpot : []"
        :active-scene="activeSceneId"
        :scene-media="materialMedia"
        @close="closeDetail"
        @open-studio="emit('open-studio', $event)"
        @scene="selectRelatedScene"
      />
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
import { Camera, SlidersHorizontal } from "@lucide/vue";
import ArchivePhotoDetailDialog from "./ArchivePhotoDetailDialog.vue";
import {archiveText, archiveSearchText, loadArchivePhotoNames} from './useArchivePhotoText.js';
import {studioPresetPresentation} from '../../presentation/studio-preset-labels.mjs';
import { PHOTO_STICKER_GROUPS, photoStickerGroup } from '../../presentation/photoStickerGroups.js';
import { photoBackgroundThumbnailUrl, photoSceneSpot, photoSpotScenes, photoSpotVariantKeys, photoSpotVariants } from '../../presentation/photoSpotScenes.js';
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
  detailOpen = ref(false),
  failedThumbnails = shallowRef(new Set());
const gridElement = ref(null), tabsElement = ref(null), searchElement = ref(null);
const photoTabs = [
  { id: "spots", label: "地点" },
  { id: "scenes", label: "场景" },
  { id: "faces", label: "表情" },
  { id: "poses", label: "动作" },
  { id: "stickers", label: "贴纸" },
  { id: "frames", label: "相框" },
  { id: "filters", label: "滤镜" },
];
// Scenes are the time-of-day variants of a spot, and every spot's own picture is one of them, so
// they are browsed inside their spot rather than as a second, overlapping tab. `scenes:<id>` still
// routes: it opens the owning spot with that scene selected.
const visibleTabs = photoTabs.filter((tab) => tab.id !== "scenes");
const sceneSelection = ref(""), variant = ref(""), stickerGroup = ref("");
const stickerGroups = computed(() => PHOTO_STICKER_GROUPS
  .map((group) => ({ ...group, count: (materials.value?.stickers || []).filter((row) => photoStickerGroup(row) === group.id).length }))
  .filter((group) => group.count));
function setStickerGroup(id) {
  interactionRevision++;
  stickerGroup.value = id;
  page.value = 0;
}
const spotScenes = (spot) => photoSpotScenes(materials.value, spot);
const spotVariantKeys = (spot) => photoSpotVariantKeys(materials.value, spot);
const variants = computed(() => photoSpotVariants(materials.value, (id) => archiveText("photo-scenes", id)));
function spotVariantLine(spot) {
  const scenes = spotScenes(spot);
  return scenes.length > 4 ? `${scenes.length} 个场景` : [...new Set(scenes.map((row) => archiveText("photo-scenes", row.name) || row.name))].join(" · ");
}
function setVariant(id) {
  interactionRevision++;
  variant.value = id;
  page.value = 0;
}
const sceneOwnerId = computed(() => {
  const spot = sceneSelection.value && photoSceneSpot(materials.value, sceneSelection.value);
  return spot ? String(spot.id) : "";
});
const effectiveSelection = computed(() => photoSelection.value || sceneOwnerId.value);
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
      (photoTab.value !== "spots" || !variant.value || spotVariantKeys(row).includes(variant.value)) &&
      (photoTab.value !== "stickers" || !stickerGroup.value || photoStickerGroup(row) === stickerGroup.value) && (!q ||
      String(
        archiveSearchText(`photo-${photoTab.value}`, row.name) + ' ' + photoName(row) + ' ' + sceneSpotName(row) + ' ' +
          (photoTab.value === 'scenes' ? archiveSearchText('photo-spots', spotForScene(row)?.name) : '') +
          (photoTab.value === 'spots' ? spotScenes(row).map((scene) => archiveSearchText('photo-scenes', scene.name)).join(' ') : '') +
          " " +
          row.id +
          " " +
          (row.resourceId || row.animationName || ""),
      )
        .toLocaleLowerCase()
        .includes(q)),
  );
});
const pages = computed(() => Math.ceil(filtered.value.length / 25)),
  visible = computed(() =>
    filtered.value.slice(page.value * 25, (page.value + 1) * 25),
  );
const photoEntry = computed(
    () =>
      effectiveSelection.value
        ? photoRows.value.find((row) => String(row.id) === effectiveSelection.value) || null
        : null,
  ),
  selectedId = computed(() => String(photoEntry.value?.id || ""));
function binding(row) {
  return (
    ["faces", "poses"].includes(photoTab.value)
      ? actorMedia.value?.entries
      : materialMedia.value
  )?.[`${photoTab.value}:${row.id}`];
}
// Spots and scenes show the game's background thumbnail; if one fails, the full picture is tried
// once before the placeholder icon.
const fullPictures = shallowRef(new Set());
function thumbnail(row) {
  const url = binding(row)?.image?.url, key = `${photoTab.value}:${row.id}`;
  return ["spots", "scenes"].includes(photoTab.value) && !fullPictures.value.has(key) ? photoBackgroundThumbnailUrl(url) : url;
}
function thumbnailFailed(row) {
  const key = `${photoTab.value}:${row.id}`;
  if (["spots", "scenes"].includes(photoTab.value) && !fullPictures.value.has(key)) fullPictures.value = new Set([...fullPictures.value, key]);
  else failedThumbnails.value = new Set([...failedThumbnails.value, key]);
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
const scenesForSpot = computed(() => photoSpotScenes(materials.value, photoEntry.value));
// The scene shown in a spot's dialog: the one asked for, else the spot's own picture.
const activeSceneId = computed(() => {
  const scenes = scenesForSpot.value;
  if (!scenes.length) return null;
  return (scenes.find((row) => String(row.id) === sceneSelection.value) ||
    scenes.find((row) => row.backgroundResourceId === photoEntry.value?.resourceId) || scenes[0]).id;
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
function spotForScene(row) {
  return photoTab.value === 'scenes' && row ? photoSceneSpot(materials.value, row.id) : null;
}
function sceneSpotName(row) {
  const spot = spotForScene(row);
  return spot ? archiveText('photo-spots', spot.name) : '';
}
// Automatic canonical selection keeps the tab in its route, without opening a dialog.
let quietSelectionKey = '';
function selectQuietly(key) {
  quietSelectionKey = key;
  emit('photo-entity', key);
}
let controller = null,
  request = 0,
  interactionRevision = 0;
let pendingCloseRevision = 0;
function begin() {
  interactionRevision++;
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
  interactionRevision++;
  request++;
  controller?.abort();
});

async function load() {
  loadArchivePhotoNames();
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
      selectQuietly(`${photoTab.value}:${photoSelection.value}`);
    }
    const position = filtered.value.findIndex(
      (row) => String(row.id) === effectiveSelection.value,
    );
    page.value = position >= 0 ? Math.floor(position / 25) : 0;
    busy.value = false;
    await nextTick();
    if(id === request && !options.signal.aborted)emit("ready");
  } catch (cause) {
    fail(cause, id, options);
  } finally {
    if (id === request) busy.value = false;
  }
}
function select(row) {
  if(!photoRows.value.some(entry => String(entry.id) === String(row.id)))return;
  interactionRevision++;
  quietSelectionKey = '';
  photoSelection.value = String(row.id);
  sceneSelection.value = "";
  detailOpen.value = true;
  emit("photo-entity", `${photoTab.value}:${row.id}`);
}
async function closeDetail() {
  const tab = photoTab.value, key = `photo:${tab}:${selectedId.value}`;
  const revision = ++interactionRevision;
  pendingCloseRevision = revision;
  quietSelectionKey = '';
  detailOpen.value = false;
  emit('photo-entity', '');
  await nextTick();
  if (revision !== interactionRevision || photoTab.value !== tab) return;
  const find = (element, focusId) => Array.from(element?.querySelectorAll('[data-archive-focus-id]') || [])
    .find(node => node.dataset.archiveFocusId === focusId && node.isConnected);
  const target = find(gridElement.value, key) || find(tabsElement.value, `photo-tab:${tab}`) || searchElement.value;
  if (target?.isConnected) target.focus({ preventScroll: true });
}
function selectRelatedScene(id) {
  if (photoTab.value !== 'spots' || !scenesForSpot.value.some(row => row.id === id)) return;
  quietSelectionKey = '';
  emit('photo-entity', `scenes:${id}`);
}
function applyPhotoSelection(key) {
  const quiet = quietSelectionKey === key;
  quietSelectionKey = '';
  const [rawKind, rawId] = (key || "").split(":");
  // A scene opens inside its spot; the spot is resolved from the materials (sceneOwnerId).
  const scene = rawKind === "scenes", kind = scene ? "spots" : rawKind, id = scene ? "" : rawId;
  const closeEcho = key === '' && pendingCloseRevision > 0 && pendingCloseRevision === interactionRevision;
  pendingCloseRevision = 0;
  if(!closeEcho && (kind !== photoTab.value || id !== photoSelection.value || (scene && rawId !== sceneSelection.value)))interactionRevision++;
  pendingTabSelection.value = false;
  if (visibleTabs.some((tab) => tab.id === kind)) {
    photoTab.value = kind;
    photoSelection.value = id;
    sceneSelection.value = scene ? rawId : "";
    detailOpen.value = !quiet;
    const position = filtered.value.findIndex((row) => String(row.id) === effectiveSelection.value);
    page.value = position >= 0 ? Math.floor(position / 25) : 0;
  } else { photoSelection.value = ""; sceneSelection.value = ""; detailOpen.value = false; }
}
function switchPhotoTab(tab) {
  if (photoTab.value === tab) return;
  interactionRevision++;
  detailOpen.value = false;
  photoTab.value = tab;
  page.value = 0;
  photoSelection.value = "";
  sceneSelection.value = "";
  pendingTabSelection.value = !photoRows.value[0];
  if (photoRows.value[0])
    selectQuietly(`${tab}:${photoRows.value[0].id}`);
}
function changePage(delta) {
  interactionRevision++;
  page.value = Math.max(0, Math.min(pages.value - 1, page.value + delta));
}
watch(() => props.photoEntity, applyPhotoSelection, { immediate: true });
watch(() => props.photoIdol, load, { immediate: true });
watch(
  () => props.query,
  () => {
    interactionRevision++;
    page.value = 0;
    if (!photoEntry.value) detailOpen.value = false;
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
.photo-variants{display:flex;flex-wrap:wrap;gap:var(--gs-space-2);margin:0 0 var(--gs-space-4);}
.photo-variants button{display:inline-flex;align-items:center;gap:6px;padding:0 var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-pill);background:var(--gs-surface);color:var(--gs-ink-2);cursor:pointer;white-space:nowrap;}
.photo-variants button small{color:var(--gs-ink-3);font-size:var(--gs-text-caption);font-weight:var(--gs-weight-regular);}
.photo-variants button[aria-pressed=true]{border-color:var(--gs-selected-line);background:var(--gs-selected-bg);color:var(--gs-selected-ink);}
.photo-variants button[aria-pressed=true] small{color:inherit;}
.photo-page .domain-count{margin-bottom:var(--gs-space-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-medium);}
.photo-directory{min-width:0;}
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;}
.photo-grid.is-backgrounds{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;}
.photo-grid.is-frames{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));}
.photo-grid.is-filters{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));}
.photo-grid>button{display:flex;flex-direction:column;align-items:stretch;align-self:start;gap:8px;min-width:0;min-height:44px;padding:0;border:0;border-radius:0;background:none;color:var(--gs-ink);text-align:left;cursor:pointer;}
.photo-grid>button[aria-pressed=true]{border-color:#258f7a;background:#edf8f3;}
.photo-grid>button:active{background:#edf8f3;}
.photo-card-art{display:grid;place-items:center;width:100%;aspect-ratio:1;background:#f2f7f7;border-radius:5px;color:#65838a;overflow:hidden;}
.photo-card-art.is-transparent{background:repeating-conic-gradient(#eff3f4 0% 25%,#fff 0% 50%) 50%/12px 12px;}
.photo-card-art img{display:block;width:100%;height:100%;object-fit:contain;}
.photo-grid.is-backgrounds>button{padding:0 0 10px;}
.photo-grid.is-backgrounds .photo-card-art{aspect-ratio:16/9;border-radius:8px 8px 0 0;}
.photo-grid.is-backgrounds .photo-card-copy{padding-inline:10px;}
.photo-grid.is-frames .photo-card-art{aspect-ratio:16/9;}
.photo-grid.is-filters .photo-card-art{height:56px;aspect-ratio:auto;background:#edf6f3;}
.photo-card-copy{min-width:0;}
.photo-card-copy strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:13px;line-height:1.55;font-weight:var(--gs-weight-semibold,600);overflow-wrap:anywhere;}
.photo-grid.is-backgrounds .photo-card-copy strong{font-size:14px;}
.photo-card-copy small{display:block;margin-top:3px;font-size:12px;line-height:1.5;color:#6b8389;overflow-wrap:anywhere;}
.photo-page .domain-pagination{gap:var(--gs-space-4);margin-top:var(--gs-space-5);font-size:var(--gs-text-ui);}
@media(hover:hover) and (pointer:fine){.photo-grid>button:hover{border-color:#84baad;background:#f5faf8;}}
@media(max-width:760px), (pointer:coarse){
 .photo-page .domain-tools input,.photo-page .domain-tools select{font-size:var(--gs-text-subtitle);}
}
@media(max-width:760px){.photo-variants{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:calc(-1 * var(--gs-space-4));padding-inline:var(--gs-space-4);}.photo-variants button{flex:none;}}
@media(max-width:760px){.photo-page .domain-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:6px;}.photo-page .domain-tabs button{flex:none;}.photo-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}.photo-grid>button{padding:6px;gap:6px;}.photo-grid.is-backgrounds,.photo-grid.is-frames{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}.photo-grid.is-filters{grid-template-columns:repeat(2,minmax(0,1fr));}.photo-card-copy strong{font-size:12px;}.photo-page .domain-tools{margin-bottom:12px;}}
@media(max-width:360px){.photo-grid:not(.is-backgrounds):not(.is-frames):not(.is-filters){grid-template-columns:repeat(3,minmax(0,1fr));}}
</style>
