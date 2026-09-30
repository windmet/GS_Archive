<template>
  <article class="domain-page" data-archive-scroll-container>
    <h2>活动一览</h2>
    <p class="domain-intro">查阅历次活动的剧情、奖励和关联藏品。</p>
    <p v-if="busy" role="status" class="domain-muted">正在读取活动一览…</p>
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
            >活动形式<select v-model="eventKind">
              <option value="">全部</option>
              <option
                v-for="(label, id) in eventKindLabels"
                :key="id"
                :value="id"
              >
                {{ label }}
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
            :aria-pressed="false"
            @click="select(row)"
          >
            <span class="domain-symbol">
              <CalendarDays :size="21" />
            </span>
            <span class="domain-list-copy">
              <strong>{{ row.nameJa || row.title || row.name }}</strong>
              <small
                >{{ eventKindLabels[row.eventKind] }} ·
                {{ historicalDate(row.release_at)
                }}{{ row.isReprint ? " · 复刻" : "" }}</small
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
      <div class="domain-detail">
        <section class="domain-panel">
          <h3>活动历史</h3>
          <p class="domain-muted">
            收录 THEATER、315 CARNIVAL、TOUR
            与季节活动。选择活动查看历史时间、剧情与已知奖励。
          </p>
          <p class="domain-muted">
            复刻与原活动分别保留，明确指向同一剧情章节。兑换商店明细与实时排行榜尚未收录。
          </p>
        </section>
      </div>
    </div>
  </article>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { CalendarDays, ChevronRight } from "@lucide/vue";
import { eventKindLabels, historicalDate } from "./DomainPresentation.mjs";
import { DomainRepository } from "../../../readmodels/runtime/DomainRepository.mjs";
import "../../styles/archive-domains.css";
const props = defineProps({
  client: Object,
  bootstrap: Object,
  query: { type: String, default: "" },
});
const emit = defineEmits(["query", "open-event"]),
  repository = new DomainRepository(props.client, props.bootstrap);
const rows = shallowRef([]),
  busy = ref(false),
  error = ref(""),
  page = ref(0),
  eventKind = ref("");
const filtered = computed(() => {
  const q = props.query.trim().toLocaleLowerCase();
  return rows.value.filter(
    (row) =>
      (!q ||
        String(row.title + " " + row.id)
          .toLocaleLowerCase()
          .includes(q)) &&
      (!eventKind.value || row.eventKind === eventKind.value),
  );
});
const pages = computed(() => Math.ceil(filtered.value.length / 25)),
  visible = computed(() =>
    filtered.value.slice(page.value * 25, (page.value + 1) * 25),
  );
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
    const value = await repository.catalog("events", options);
    if (id === request) rows.value = value;
  } catch (cause) {
    fail(cause, id, options);
  } finally {
    if (id === request) busy.value = false;
  }
}
function select(row) {
  emit("open-event", { event_id: row.id });
}
watch(
  () => [props.query, eventKind.value],
  () => {
    page.value = 0;
  },
);
load();
</script>
