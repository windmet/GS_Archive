<template>
  <main v-if="manifest" class="status-screen">
    <section class="status-summary">
      <div>
        <span>ARCHIVE HEALTH</span>
        <h2>数据与资源状态</h2>
        <p>Schema {{ manifest.schema_version }} · 数据更新 {{ formatDate(manifest.data_updated_at) }}</p>
      </div>
      <button @click="emit('open-spine-lab')">
        <ScanSearch :size="19" />
        <span>Spine 实验室</span>
        <ChevronRight :size="17" />
      </button>
    </section>

    <section v-if="verification" class="verification-section" aria-labelledby="verification-title">
      <div class="section-heading">
        <div>
          <h3 id="verification-title">可播放性验证</h3>
          <p>全量解析场景，并核对播放器实际使用的语音与卡片关联。</p>
        </div>
        <span>{{ formatDateTime(verification.generated_at) }}</span>
      </div>
      <div class="verification-grid">
        <div v-for="item in verificationItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong :class="item.tone">{{ item.value }}</strong>
          <small>{{ item.detail }}</small>
        </div>
      </div>
      <p class="scope-note">
        规范场景 {{ formatCount(verification.scenarios?.canonical_files) }} 个；辅助/旧编译文件
        {{ formatCount(verification.scenarios?.auxiliary_files) }} 个另行统计，不影响当前播放器健康结论。
      </p>
    </section>

    <section class="coverage-section" aria-labelledby="coverage-title">
      <div class="section-heading">
        <h3 id="coverage-title">资料覆盖率</h3>
        <span>generated {{ formatDateTime(manifest.generated_at) }}</span>
      </div>
      <div class="coverage-list">
        <div v-for="item in coverageItems" :key="item.label" class="coverage-row">
          <span class="coverage-label">{{ item.label }}</span>
          <div class="coverage-track" aria-hidden="true"><span :style="{ width: `${item.percent}%` }"></span></div>
          <strong>{{ item.percent.toFixed(1) }}%</strong>
          <small>{{ formatCount(item.available) }} / {{ formatCount(item.total) }}</small>
        </div>
      </div>
    </section>

    <section class="inventory-section" aria-labelledby="inventory-title">
      <div class="section-heading"><h3 id="inventory-title">本地资产</h3></div>
      <dl class="inventory-grid">
        <div v-for="item in inventoryItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ formatCount(item.value) }}</dd>
        </div>
      </dl>
    </section>

    <section v-if="missingNormalIcons.length" class="missing-section" aria-labelledby="missing-title">
      <div class="section-heading">
        <h3 id="missing-title">缺少普通卡图</h3>
        <span>{{ formatCount(missingNormalIcons.length) }} cards</span>
      </div>
      <div class="missing-list">
        <code v-for="id in missingNormalIcons.slice(0, 36)" :key="id">{{ id }}</code>
        <span v-if="missingNormalIcons.length > 36">+{{ missingNormalIcons.length - 36 }}</span>
      </div>
    </section>

    <section v-if="missingVoiceSamples.length" class="missing-section" aria-labelledby="voice-missing-title">
      <div class="section-heading">
        <h3 id="voice-missing-title">待补齐的规范场景语音</h3>
        <span>{{ formatCount(verification.dialogue_voices?.missing) }} references</span>
      </div>
      <div class="voice-missing-list">
        <code v-for="entry in missingVoiceSamples" :key="`${entry.file}:${entry.step}`">
          {{ entry.file }} #{{ entry.step }} · {{ entry.raw }}
        </code>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight, ScanSearch } from '@lucide/vue'

const props = defineProps({
  manifest: { type: Object, default: null },
  verification: { type: Object, default: null },
})
const emit = defineEmits(['open-spine-lab'])

const verificationItems = computed(() => {
  const scenarios = props.verification?.scenarios || {}
  const voices = props.verification?.dialogue_voices || {}
  const homeVoices = props.verification?.card_home_voices || {}
  const cardScenarios = props.verification?.card_scenarios || {}
  const relations = props.verification?.card_relations || {}
  const cardDetails = props.verification?.card_details || {}
  const unitEvents = props.verification?.unit_event_relations || {}
  return [
    {
      label: '场景结构',
      value: scenarios.schema_failures || scenarios.parse_failures ? '需排查' : '通过',
      detail: `${formatCount(scenarios.valid_schema)} / ${formatCount(scenarios.total_files)} files`,
      tone: scenarios.schema_failures || scenarios.parse_failures ? 'warn' : 'ok',
    },
    {
      label: '剧情语音',
      value: `${(Number(voices.ratio || 0) * 100).toFixed(1)}%`,
      detail: `${formatCount(voices.available)} / ${formatCount(voices.references)} references`,
      tone: Number(voices.ratio || 0) >= 0.98 ? 'ok' : 'warn',
    },
    {
      label: '卡片首页语音',
      value: `${(Number(homeVoices.ratio || 0) * 100).toFixed(1)}%`,
      detail: `${formatCount(homeVoices.available)} / ${formatCount(homeVoices.references)} cues`,
      tone: Number(homeVoices.ratio || 0) === 1 ? 'ok' : 'warn',
    },
    {
      label: '卡片剧情',
      value: `${(Number(cardScenarios.ratio || 0) * 100).toFixed(1)}%`,
      detail: `${formatCount(cardScenarios.available)} / ${formatCount(cardScenarios.references)} links`,
      tone: Number(cardScenarios.ratio || 0) === 1 ? 'ok' : 'warn',
    },
    {
      label: '卡片关系',
      value: relations.release_series_failures || relations.event_card_relation_failures || relations.gasha_card_relation_failures ? '需排查' : '通过',
      detail: `${formatCount(relations.valid_event_card_relations)} event · ${formatCount(relations.valid_gasha_card_relations)} gasha · ${formatCount(relations.valid_release_series)} series`,
      tone: relations.release_series_failures || relations.event_card_relation_failures || relations.gasha_card_relation_failures ? 'warn' : 'ok',
    },
    {
      label: '卡片详情资料',
      value: cardDetails.failures || !cardDetails.reference_sample_valid ? '需排查' : '通过',
      detail: `${formatCount(cardDetails.valid)} / ${formatCount(cardDetails.total)} cards · 040ren sample`,
      tone: cardDetails.failures || !cardDetails.reference_sample_valid ? 'warn' : 'ok',
    },
    {
      label: '组合活动关系',
      value: unitEvents.failures ? '需排查' : '通过',
      detail: `${formatCount(unitEvents.valid)} / ${formatCount(unitEvents.total)} events`,
      tone: unitEvents.failures ? 'warn' : 'ok',
    },
  ]
})

const coverageItems = computed(() => {
  const coverage = props.manifest?.coverage || {}
  const unit = coverage.unit_membership || {}
  const rows = [
    ['剧情 master', coverage.story_master_records],
    ['卡片详情资料', { available: coverage.card_details?.cards, total: props.manifest?.counts?.cards, ratio: coverage.card_details?.cards / (props.manifest?.counts?.cards || 1) }],
    ['首页语音关联', coverage.card_home_voices],
    ['卡片剧情关联', coverage.card_scenarios],
    ['双态卡普通语音', { available: coverage.card_text_voices?.normal_available, total: coverage.card_text_voices?.normal_expected, ratio: coverage.card_text_voices?.normal_ratio }],
    ['特训卡面语音', { available: coverage.card_text_voices?.awakened_available, total: coverage.card_text_voices?.total_cards, ratio: coverage.card_text_voices?.awakened_ratio }],
    ['双态卡普通图', { available: coverage.card_icons?.normal_available, total: coverage.card_icons?.normal_expected, ratio: coverage.card_icons?.normal_ratio }],
    ['特训卡图', { available: coverage.card_icons?.awakened_available, total: coverage.card_icons?.total_cards, ratio: coverage.card_icons?.awakened_ratio }],
    ['双态卡普通卡面', { available: coverage.card_portraits?.normal_available, total: coverage.card_portraits?.normal_expected, ratio: coverage.card_portraits?.normal_available / (coverage.card_portraits?.normal_expected || 1) }],
    ['特训无框卡面', { available: coverage.card_portraits?.awakened_available, total: coverage.card_portraits?.total_cards, ratio: coverage.card_portraits?.awakened_available / (coverage.card_portraits?.total_cards || 1) }],
    ['单卡面系列', { available: coverage.card_modes?.single_state, total: coverage.card_modes?.total_cards || coverage.card_icons?.total_cards, ratio: coverage.card_modes?.single_state / (coverage.card_icons?.total_cards || 1) }],
    ['SSR 横图', { available: coverage.card_landscapes?.awakened_available, total: coverage.card_landscapes?.total_ssr_cards, ratio: coverage.card_landscapes?.awakened_available / (coverage.card_landscapes?.total_ssr_cards || 1) }],
    ['组合归属证据', { available: unit.resolved, total: (unit.resolved || 0) + (unit.unresolved || 0), ratio: unit.resolved / ((unit.resolved || 0) + (unit.unresolved || 0) || 1) }],
  ]
  return rows.map(([label, row]) => ({
    label,
    available: row?.available || 0,
    total: row?.total || 0,
    percent: Math.max(0, Math.min(100, Number(row?.ratio || 0) * 100)),
  }))
})

const inventoryItems = computed(() => {
  const counts = props.manifest?.counts || {}
  return [
    { label: 'Compiled JSON', value: counts.compiled_json_files },
    { label: '背景', value: counts.backgrounds },
    { label: 'Spine 模型', value: counts.spine_models },
    { label: '语音文件', value: counts.voice_files },
    { label: '卡片技能', value: props.manifest?.coverage?.card_details?.skills },
    { label: '中心效果', value: props.manifest?.coverage?.card_details?.center_skills },
    { label: '衣装资料', value: props.manifest?.coverage?.card_details?.costumes },
    { label: '演出语音关联', value: props.manifest?.coverage?.card_details?.operational_voices },
    { label: '卡片小剧情', value: props.manifest?.coverage?.card_relations?.cards_with_direct_story },
    { label: '活动关联卡', value: props.manifest?.coverage?.card_relations?.cards_with_event_relation },
    { label: '卡池关联卡', value: props.manifest?.coverage?.card_relations?.cards_with_gasha_relation },
    { label: '共通系列', value: counts.release_series },
    { label: '固定组合团活', value: props.manifest?.coverage?.unit_events?.fixed_unit_events },
    { label: '属性团曲', value: props.manifest?.coverage?.unit_events?.attribute_events },
    { label: '跨组合团活', value: props.manifest?.coverage?.unit_events?.mixed_unit_events },
  ]
})

const missingNormalIcons = computed(() => props.manifest?.coverage?.card_icons?.missing_normal || [])
const missingVoiceSamples = computed(() => props.verification?.dialogue_voices?.missing_samples?.slice(0, 24) || [])
const formatCount = value => Number(value || 0).toLocaleString('en-US')
const formatDate = value => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : 'unknown'
const formatDateTime = value => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'unknown'
</script>

<style scoped>
.status-screen { height: 100%; padding: 24px; overflow-y: auto; background: #f7f9fa; }
.status-summary { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 136px; padding: 24px 28px; border-bottom: 3px solid #2bb8ae; background: #17212b; color: #fff; }
.status-summary > div > span { color: #55cec5; font-size: 0.67rem; font-weight: 800; }
.status-summary h2 { margin: 7px 0 5px; font-size: 1.45rem; letter-spacing: 0; }
.status-summary p { margin: 0; color: #9eabb5; font-size: 0.7rem; }
.status-summary button { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 9px; min-width: 190px; min-height: 42px; padding: 0 13px; border: 1px solid #42515d; border-radius: 6px; background: #22303b; color: #fff; cursor: pointer; font: inherit; font-size: 0.76rem; }
.status-summary button:hover { border-color: #55c9c0; }
.verification-section, .coverage-section, .inventory-section, .missing-section { margin-top: 18px; padding: 20px; border: 1px solid #dfe4e8; background: #fff; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.section-heading h3 { margin: 0; font-size: 0.88rem; }
.section-heading p { margin: 4px 0 0; color: #7c8790; font-size: 0.68rem; }
.section-heading > span { color: #7c8790; font-size: 0.66rem; }
.verification-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); border-top: 1px solid #edf0f2; border-bottom: 1px solid #edf0f2; }
.verification-grid > div { display: flex; flex-direction: column; gap: 5px; min-width: 0; padding: 16px; border-left: 1px solid #edf0f2; }
.verification-grid > div:first-child { border-left: 0; }
.verification-grid span, .verification-grid small { color: #77828c; font-size: 0.67rem; }
.verification-grid strong { color: #27333c; font-size: 1.15rem; }
.verification-grid strong.ok { color: #138b73; }
.verification-grid strong.warn { color: #b26b18; }
.scope-note { margin: 12px 0 0; color: #68737c; font-size: 0.68rem; line-height: 1.6; }
.coverage-list { display: flex; flex-direction: column; }
.coverage-row { display: grid; grid-template-columns: 132px minmax(120px, 1fr) 58px 105px; align-items: center; gap: 12px; min-height: 44px; border-top: 1px solid #edf0f2; }
.coverage-row:first-child { border-top: 0; }
.coverage-label { font-size: 0.74rem; }
.coverage-track { height: 7px; overflow: hidden; border-radius: 4px; background: #e7ecef; }
.coverage-track span { display: block; height: 100%; border-radius: inherit; background: #25aaa0; }
.coverage-row strong { color: #26313a; font-size: 0.73rem; text-align: right; }
.coverage-row small { color: #7c8790; font-size: 0.67rem; text-align: right; }
.inventory-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin: 0; }
.inventory-grid div { padding: 8px 18px; border-left: 1px solid #e5e9ec; }
.inventory-grid div:first-child { padding-left: 0; border-left: 0; }
.inventory-grid dt { color: #7c8790; font-size: 0.67rem; }
.inventory-grid dd { margin: 5px 0 0; font-size: 1.12rem; font-weight: 750; }
.missing-list { display: flex; flex-wrap: wrap; gap: 6px; }
.missing-list code, .missing-list > span { padding: 4px 6px; border-radius: 4px; background: #f0f3f5; color: #59656e; font-size: 0.66rem; }
.voice-missing-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.voice-missing-list code { overflow: hidden; padding: 6px 8px; border-left: 2px solid #d7a15e; background: #f7f3ed; color: #6a5a48; font-size: 0.62rem; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 780px) {
  .verification-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .verification-grid > div { border-top: 1px solid #edf0f2; }
  .verification-grid > div:nth-child(-n + 2) { border-top: 0; }
  .verification-grid > div:nth-child(odd) { border-left: 0; }
}

@media (max-width: 680px) {
  .status-screen { padding: 12px; }
  .status-summary { align-items: stretch; flex-direction: column; padding: 20px; }
  .status-summary button { width: 100%; }
  .verification-section, .coverage-section, .inventory-section, .missing-section { margin-top: 10px; padding: 14px; }
  .coverage-row { grid-template-columns: minmax(0, 1fr) 58px; gap: 6px 10px; padding: 9px 0; }
  .coverage-track, .coverage-row small { grid-row: 2; }
  .inventory-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 0; }
  .inventory-grid div:nth-child(odd) { padding-left: 0; border-left: 0; }
  .voice-missing-list { grid-template-columns: 1fr; }
}
</style>
