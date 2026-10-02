<template>
  <section class="resource-audit" aria-label="当前资源审计">
    <div class="audit-top"><div><h2>数据与资源状态</h2><p>目录与文件核对：{{ date(audit.auditedAt) }}</p></div><span>当前来源快照</span></div>
    <p>{{ audit.scope }}。</p>
    <dl class="resource-counts"><div v-for="row in audit.counts" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.count.toLocaleString() }}</dd></div></dl>
    <div class="storage-summary"><div><strong>本地素材</strong><p>{{ audit.localAssets.files.toLocaleString() }} 个文件 · {{ size(audit.localAssets.bytes) }}</p><small>这是原始与转换资源的本地文件总量，不能与 R2 容量直接比较。</small></div><div v-if="audit.storage"><strong>R2 测试资源桶</strong><p>{{ size(audit.storage.bytes) }} / {{ size(audit.storage.limitBytes) }} · {{ audit.storage.belowLimit?'低于容量上限':'达到容量上限' }}</p><small>实时清单核对于 {{ date(audit.storage.checkedAt) }}；之后的远端改动需重新核对。</small></div><div v-else><strong>R2</strong><p>尚无当前远端清单核对记录。</p></div></div>
    <p>谱面文件完整性：{{ audit.chartIntegrity.files - audit.chartIntegrity.missing - audit.chartIntegrity.changed }} / {{ audit.chartIntegrity.files }} 与当前清单大小和哈希一致；缺文件 {{ audit.chartIntegrity.missing }}，内容变化 {{ audit.chartIntegrity.changed }}。</p>
    <details><summary>素材分类与审计来源</summary><table><caption>本地素材分类</caption><thead><tr><th>资源目录</th><th>文件数</th><th>大小</th></tr></thead><tbody><tr v-for="(row,key) in audit.localAssets.groups" :key="key"><td>{{ key }}</td><td>{{ row.files.toLocaleString() }}</td><td>{{ size(row.bytes) }}</td></tr></tbody></table><p>语言审计与当前资源清单在每次代码构建前重新生成；数据来源变更会更新快照，不把重新构建时间当作资料实装日期。</p><p v-if="audit.localAssets.unavailable.length">{{ audit.localAssets.unavailable.length }} 个目录或链接未遍历，未计入完整性结论。</p><ul><li v-for="source in audit.sources" :key="source.file"><code>{{ source.file }}</code></li></ul><code>来源指纹 {{ audit.sourceDigest }}</code></details>
    <p class="resource-boundary">7 月的旧覆盖率与可播放性结果已收进下方历史快照。当前审计统计目录与文件，不延续旧快照的“全量通过”结论。音频播放、图像解码与真机表现仍需对应测试。</p>
  </section>
</template>
<script setup>
import audit from '../../../config/resource-audit.json'
const date=value=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
const size=value=>`${(value/1e9).toFixed(2)} GB`
</script>
<style scoped>
.resource-audit{padding:22px;border:1px solid #d5e5e9;border-radius:12px;background:#fff;color:#294854;font-size:13px;line-height:1.6}.audit-top{display:flex;justify-content:space-between;align-items:center;gap:12px}.audit-top h2{margin:0;font-size:22px}.audit-top span{font-size:12px;color:#157e71;background:#edf8f5;padding:4px 8px;border-radius:6px}.resource-audit p{color:#617b88}.resource-counts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:20px 0}.resource-counts>div{padding:10px;background:#f3f8fa;border-radius:8px}.resource-counts dt{color:#69808c}.resource-counts dd{margin:4px 0 0;font-weight:700;font-size:22px}.storage-summary{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 0;border-top:1px solid #dfebed}.storage-summary p{margin:4px 0}.storage-summary small{color:#7e9199}.resource-audit summary{cursor:pointer;padding:10px 0;color:#177d71}.resource-audit table{width:100%;border-collapse:collapse;text-align:left}.resource-audit th,.resource-audit td{padding:6px;border-bottom:1px solid #e2ecee}.resource-audit code{font-size:11px;overflow-wrap:anywhere}.resource-boundary{font-size:12px;background:#faf6ed;padding:10px;border-radius:6px}@media(max-width:700px){.resource-audit{padding:14px}.storage-summary{grid-template-columns:1fr}.audit-top{align-items:start}.audit-top span{flex:none}.resource-counts{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
