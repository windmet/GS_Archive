<template>
  <article class="domain-page" data-archive-scroll-container>
    <h2>藏品馆</h2>
    <p class="domain-intro">
      收录游戏内的道具与称号，查阅说明、已知来源和用途。
    </p>
    <nav class="domain-tabs" aria-label="藏品种类">
      <button
        type="button"
        :aria-pressed="kind === 'items'"
        @click="switchKind('items')"
      >
        <Box :size="18" />道具
      </button>
      <button
        type="button"
        :aria-pressed="kind === 'honors'"
        @click="switchKind('honors')"
      >
        <Medal :size="18" />称号
      </button>
    </nav>
    <p v-if="busy" role="status" class="domain-muted">正在读取藏品馆…</p>
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
          <label
            >{{ kind === "items" ? "用途分类" : "称号类别"
            }}<select v-model="category">
              <option value="">全部</option>
              <template v-if="kind === 'items'">
                <option
                  v-for="group in itemBrowseGroups"
                  :key="group.key"
                  :value="group.key"
                >
                  {{ group.label }}
                </option>
              </template>
              <template v-else>
                <option v-for="type in types" :key="type" :value="String(type)">
                  类别 {{ type }}
                </option>
              </template>
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
                  row.image?.url && !failedThumbnails.has(`${kind}:${row.id}`)
                "
                :src="row.image.url"
                alt=""
                loading="lazy"
                @error="
                  failedThumbnails = new Set([
                    ...failedThumbnails,
                    `${kind}:${row.id}`,
                  ])
                "
              />
              <Medal
                v-if="
                  kind === 'honors' &&
                  (!row.image?.url || failedThumbnails.has(`${kind}:${row.id}`))
                "
                :size="21"
              />
              <Box
                v-else-if="
                  !row.image?.url || failedThumbnails.has(`${kind}:${row.id}`)
                "
                :size="21"
              />
            </span>
            <span class="domain-list-copy">
              <strong>{{ row.nameJa || row.title || row.name }}</strong>
              <small
                >{{ kind === "items" ? "道具" : "称号" }} · {{ row.id }}</small
              >
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
        <template v-if="detail?.entry">
          <CollectionEntryDetails :detail="detail" :kind="kind" />
          <section class="domain-panel">
            <h3>已知来源与用途</h3>
            <ArchiveRewardTable
              :rows="detail.sources"
              sources
              @open-event="emit('open-event', $event)"
            />
          </section>
        </template>
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
import { Box, ChevronRight, Medal } from "@lucide/vue";
import {
  itemBrowseGroups,
  itemBrowseGroup,
} from "./DomainPresentation.mjs";
import ArchiveRewardTable from "./ArchiveRewardTable.vue";
import CollectionEntryDetails from "./CollectionEntryDetails.vue";
import { DomainRepository } from "../../../readmodels/runtime/DomainRepository.mjs";
import "../../styles/archive-domains.css";
const props = defineProps({
  client: Object,
  bootstrap: Object,
  entity: { type: String, default: "" },
  query: { type: String, default: "" },
});
const emit = defineEmits(["query", "entity", "open-event"]),
  repository = new DomainRepository(props.client, props.bootstrap);
const kind = ref(props.entity.startsWith("honor:") ? "honors" : "items"),
  rows = shallowRef([]),
  detail = shallowRef(null),
  busy = ref(false),
  error = ref(""),
  page = ref(0),
  category = ref(""),
  detailElement = ref(null),
  failedThumbnails = shallowRef(new Set());
const types = computed(() =>
  [...new Set(rows.value.map((row) => row.honorType))].sort((a, b) => a - b),
);
const filtered = computed(() => {
  const q = props.query.trim().toLocaleLowerCase();
  return rows.value.filter(
    (row) =>
      (!q ||
        String(row.nameJa + " " + row.id)
          .toLocaleLowerCase()
          .includes(q)) &&
      (!category.value ||
        (kind.value === "items"
          ? itemBrowseGroup(row.itemType).key === category.value
          : String(row.honorType) === category.value)),
  );
});
const pages = computed(() => Math.ceil(filtered.value.length / 25)),
  visible = computed(() =>
    filtered.value.slice(page.value * 25, (page.value + 1) * 25),
  ),
  selectedId = computed(() => String(detail.value?.entry?.id || ""));
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

let pendingKindSelection = "";
async function load() {
  const { id, options } = begin();
  rows.value = [];
  detail.value = null;
  try {
    const catalog = await repository.catalog(kind.value, options);
    if (id !== request) return;
    rows.value = catalog;
    const [type, key] = props.entity.split(":"),
      compatible = type === (kind.value === "honors" ? "honor" : "item"),
      selected =
        compatible && key ? catalog.find((row) => row.id === key) : catalog[0];
    if (!selected) throw Error("Unknown collection entity");
    const value = await repository.detail(kind.value, selected, options);
    if (id !== request) return;
    detail.value = value;
    if (pendingKindSelection === kind.value) {
      pendingKindSelection = "";
      emit(
        "entity",
        `${kind.value === "honors" ? "honor" : "item"}:${selected.id}`,
      );
    }
    const position = filtered.value.findIndex((row) => row.id === selected.id);
    page.value = position >= 0 ? Math.floor(position / 25) : 0;
    await nextTick();
    if (
      id === request &&
      props.entity &&
      window.matchMedia("(max-width:700px)").matches
    )
      detailElement.value?.scrollIntoView({ block: "start" });
  } catch (cause) {
    fail(cause, id, options);
  } finally {
    if (id === request) busy.value = false;
  }
}
function select(row) {
  emit("entity", `${kind.value === "honors" ? "honor" : "item"}:${row.id}`);
}
function switchKind(value) {
  if (kind.value === value) return;
  emit("query", "");
  pendingKindSelection = value;
  kind.value = value;
  category.value = "";
  page.value = 0;
  load();
}
watch(
  () => props.entity,
  () => {
    if (props.entity)
      kind.value = props.entity.startsWith("honor:") ? "honors" : "items";
    load();
  },
  { immediate: true },
);
watch(
  () => [props.query, category.value],
  () => {
    page.value = 0;
  },
);
</script>
