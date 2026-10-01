<template>
  <article class="domain-page collection-page" data-archive-scroll-container>
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
    <p v-if="catalogBusy" role="status" class="domain-muted">正在读取藏品目录…</p>
    <p v-if="errorScope === 'catalog'" role="alert" class="domain-error">
      {{ error }}<button type="button" @click="load">重试</button>
    </p>
    <div v-if="rows.length" class="collection-layout" :class="{'has-detail':detailOpen && !mobile}">
      <section class="collection-directory" aria-label="资料目录">
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
        <div class="collection-cards" :class="{'is-honors':kind === 'honors'}">
          <button
            v-for="row in visible"
            :key="row.id"
            type="button"
            :aria-pressed="String(row.id) === selectedId"
            @click="select(row)"
          >
            <span class="collection-card-art">
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
            <span class="collection-card-copy">
              <strong>{{ row.nameJa || row.title || row.name }}</strong>
              <small
                >{{ kind === "items" ? "道具" : "称号" }} · {{ row.id }}</small
              >
            </span>
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
      <CollectionDetailPanel v-if="detailOpen" :detail="detail" :kind="kind" :busy="catalogBusy || detailBusy" :error="errorScope === 'detail' ? error : ''" :modal="mobile" @close="detailOpen=false" @retry="load" @open-event="emit('open-event',$event)" />
  </div>
  </article>
</template>
<script setup>
import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { Box, Medal } from "@lucide/vue";
import {
  itemBrowseGroups,
  itemBrowseGroup,
} from "./DomainPresentation.mjs";
import CollectionDetailPanel from "./CollectionDetailPanel.vue";
import "../../styles/archive-collection.css";
import { DomainRepository } from "../../../readmodels/runtime/DomainRepository.mjs";
import { createCollectionCatalogSession } from "../../../readmodels/runtime/CollectionCatalogSession.mjs";
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
  catalogBusy = ref(false),
  detailBusy = ref(false),
  selectedId = ref(""),
  error = ref(""),
  errorScope = ref(""),
  page = ref(0),
  category = ref(""),
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
  visible = computed(() => filtered.value.slice(page.value * 25, (page.value + 1) * 25));
const session = createCollectionCatalogSession(repository, state => {
  rows.value = state.rows;
  detail.value = state.detail;
  selectedId.value = state.selectedId;
  catalogBusy.value = state.catalogBusy;
  detailBusy.value = state.detailBusy;
  error.value = state.error;
  errorScope.value = state.errorScope;
});
const mediaQuery=window.matchMedia("(max-width:700px)");
const mobile=ref(mediaQuery.matches),detailOpen=ref(!mobile.value || Boolean(props.entity));
const resize=()=>{mobile.value=mediaQuery.matches};
mediaQuery.addEventListener('change',resize);
onBeforeUnmount(() => { session.dispose();mediaQuery.removeEventListener('change',resize); });
let pendingKindSelection = "", skipAutoOpenKey = "";
async function load() {
  const requestedKind = kind.value;
  const type = requestedKind === "honors" ? "honor" : "item";
  const key = props.entity.startsWith(`${type}:`) ? props.entity : "";
  if (!await session.open(requestedKind, key)) return;
  const value = detail.value;
  if (!value) return;
  if (pendingKindSelection === requestedKind) {
    pendingKindSelection = "";
    skipAutoOpenKey = value.entry.key;
    emit("entity", value.entry.key);
  }
  const position = filtered.value.findIndex(row => String(row.id) === String(value.entry.id));
  page.value = position >= 0 ? Math.floor(position / 25) : 0;

}
function select(row) {
  detailOpen.value=true;
  emit("entity", `${kind.value === "honors" ? "honor" : "item"}:${row.id}`);
}
function switchKind(value) {
  if (kind.value === value) return;
  emit("query", "");
  pendingKindSelection = value;
  detailOpen.value=!mobile.value;
  kind.value = value;
  category.value = "";
  page.value = 0;
  load();
}
watch(
  () => props.entity,
  () => {
    if (props.entity) {
      if (props.entity !== skipAutoOpenKey) detailOpen.value=true;
      skipAutoOpenKey="";
      const nextKind = props.entity.startsWith("honor:") ? "honors" : "items";
      if (nextKind !== kind.value) { category.value = ""; page.value = 0; }
      kind.value = nextKind;
    }
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
