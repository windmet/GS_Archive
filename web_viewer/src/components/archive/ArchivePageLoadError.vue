<template>
  <section class="archive-page-load-error" role="alert">
    <h2>页面暂时无法打开</h2>
    <p>页面资源未能加载。请检查网络后重新加载，或通过资料馆导航继续浏览。</p>
    <button type="button" @click="reload">重新加载此页</button>
  </section>
</template>
<script setup>
// Failed module imports may remain in the browser's module map. Reloading keeps
// the exact route and preferences, and permits a fresh request for that module.
function reload() { window.location.reload(); }
</script>
<style scoped>
.archive-page-load-error { margin:24px 0;padding:24px;border:1px solid var(--gs-line);border-radius:12px;background:#ffffffed;color:var(--gs-ink); }
.archive-page-load-error h2 { margin:0 0 12px;font-size:20px; }
.archive-page-load-error p { margin:0 0 16px;line-height:1.7; }
.archive-page-load-error button { padding:10px 16px;min-height:44px;border:1px solid var(--gs-selected-line);border-radius:8px;background:var(--gs-mint-wash);color:var(--gs-mint-ink);font:inherit;cursor:pointer; }
.archive-page-load-error button:focus-visible { outline:3px solid var(--gs-mint);outline-offset:3px; }
</style>
