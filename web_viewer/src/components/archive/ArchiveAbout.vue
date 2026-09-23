<template>
  <article class="archive-about" aria-labelledby="about-name">
    <div class="about-inner">
      <header class="about-intro">
        <p class="eyebrow">BEHIND THE ARCHIVE</p>
        <div class="about-identity">
          <span class="about-monogram" aria-hidden="true">風</span>
          <div><p class="about-kicker">关于我</p><h2 id="about-name">windmet <span>/ 遇风之期</span></h2></div>
        </div>
        <p class="about-lead">windmet = 风期，新人 P 一枚。</p>
        <p class="about-copy">社交苦手，更喜欢和大家在评论区交流。</p>
        <ul class="about-tags" aria-label="担当与喜好">
          <li>漣担当</li><li>虎牙道箱推</li><li>好感 想乐 / saki / 四季</li>
        </ul>
      </header>

      <section class="about-section" aria-labelledby="about-links">
        <h3 id="about-links">在这些地方找到我 <span>01</span></h3>
        <div class="about-links">
          <a href="https://github.com/windmet" target="_blank" rel="noopener noreferrer">
            <FolderOpen :size="23" aria-hidden="true" /><div><strong>GitHub 个人主页</strong><span>@windmet</span></div><ArrowUpRight :size="18" aria-hidden="true" />
          </a>
          <a href="https://space.bilibili.com/114080132" target="_blank" rel="noopener noreferrer">
            <Tv :size="23" aria-hidden="true" /><div><strong>B 站主页</strong><span>遇风之期 · 在评论区见</span></div><ArrowUpRight :size="18" aria-hidden="true" />
          </a>
        </div>
        <p class="about-hint">外部链接会在新标签页打开。</p>
      </section>

      <section class="about-project" aria-labelledby="about-project-title">
        <div><p class="eyebrow">SIDEM ARCHIVE</p><h3 id="about-project-title">让这份资料馆慢慢变好。</h3>
          <p>有 bug，欢迎在 GitHub Issues 或视频评论区直接提出，我会尽快修复！</p>
          <p>建站不易，欢迎来 GitHub 给项目点个 ⭐</p>
        </div>
        <div class="about-actions">
          <a class="project-link" href="https://github.com/windmet/GS_Archive" target="_blank" rel="noopener noreferrer"><Star :size="18" aria-hidden="true" />项目仓库<ArrowUpRight :size="16" aria-hidden="true" /></a>
          <a href="https://github.com/windmet/GS_Archive/issues" target="_blank" rel="noopener noreferrer"><MessageCircle :size="18" aria-hidden="true" />反馈问题<ArrowUpRight :size="16" aria-hidden="true" /></a>
        </div>
      </section>

      <section class="about-thanks" aria-labelledby="about-thanks-title">
        <Heart :size="24" aria-hidden="true" />
        <div><h3 id="about-thanks-title">特别鸣谢</h3><p>感谢 <strong>shiogi P</strong> 提供安装包！</p></div>
      </section>
      <footer>windmet / 遇风之期 <span>SideM Archive</span></footer>
    </div>
  </article>
</template>

<script setup>
import { ArrowUpRight, FolderOpen, Heart, MessageCircle, Star, Tv } from '@lucide/vue'
</script>

<style scoped>
.archive-about { height: 100%; overflow-y: auto; overscroll-behavior: contain; color: #203a43; background: #f7faf9; }
.about-inner { max-width: 920px; margin: 0 auto; padding: 52px 40px 30px; box-sizing: border-box; }
.eyebrow { margin: 0 0 25px; color: #477d7b; font-size: 11px; font-weight: 700; letter-spacing: .18em; }
.about-identity { display: flex; align-items: center; gap: 24px; }
.about-monogram { display: grid; place-items: center; flex: 0 0 82px; height: 82px; border-radius: 24px 24px 24px 6px; background: #ddefe7; color: #327a70; font-size: 42px; font-family: serif; }
.about-kicker { margin: 0 0 8px; color: #657c80; font-size: 13px; }
h2 { margin: 0; font-size: clamp(24px, 3vw, 34px); line-height: 1.35; letter-spacing: -.03em; }
h2 span { display: inline-block; color: #527573; font-weight: 500; font-size: .65em; letter-spacing: 0; }
.about-lead { margin: 28px 0 8px; font-size: 20px; line-height: 1.7; }
.about-copy { margin: 0; color: #52676e; line-height: 1.8; }
.about-tags { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 21px 0 0; padding: 0; }
.about-tags li { padding: 7px 12px; border: 1px solid #d4e4df; border-radius: 8px; color: #48645f; font-size: 12px; }
.about-section { margin-top: 42px; }
h3 { margin: 0; font-size: 17px; line-height: 1.6; }
.about-section h3 { display: flex; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid #dce5e1; }
h3 span { color: #7e9691; font-size: 12px; font-weight: 400; }
.about-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
a { color: inherit; text-decoration: none; }
.about-links a { display: flex; align-items: center; gap: 14px; padding: 20px; border: 1px solid #dce5e1; border-radius: 12px; background: #fff; }
.about-links a div { flex: 1; min-width: 0; }
.about-links strong { display: block; font-size: 14px; }
.about-links span { display: block; margin-top: 6px; color: #697d81; font-size: 12px; line-height: 1.5; }
.about-links svg { flex-shrink: 0; }
.about-hint { font-size: 11px; color: #687c7e; margin: 10px 0 0; }
.about-project { margin-top: 34px; padding: 28px; border-radius: 14px; background: #e9f2ee; }
.about-project .eyebrow { margin-bottom: 10px; }
.about-project h3 { font-size: 22px; }
.about-project p:not(.eyebrow) { font-size: 14px; line-height: 1.9; margin: 12px 0 0; }
.about-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
.about-actions a { display: inline-flex; gap: 9px; align-items: center; min-height: 44px; padding: 0 15px; border: 1px solid #b7cfca; border-radius: 8px; font-size: 13px; }
.about-actions .project-link { background: #275f59; border-color: #275f59; color: #fff; }
a:hover { text-decoration: underline; text-underline-offset: 4px; }
a:focus-visible { outline: 3px solid #18897e; outline-offset: 4px; }
.about-thanks { display: flex; gap: 15px; padding: 30px 0; align-items: flex-start; }
.about-thanks svg { color: #658d7f; margin-top: 3px; flex-shrink: 0; }
.about-thanks p { margin: 8px 0 0; font-size: 14px; line-height: 1.7; color: #52676e; }
footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding-top: 20px; border-top: 1px solid #dce5e1; color: #687c7e; font-size: 11px; }
@media (max-width: 600px) {
  .about-inner { padding: 28px 20px 24px; }
  .about-identity { align-items: flex-start; gap: 16px; }
  .about-monogram { flex-basis: 62px; height: 62px; font-size: 33px; border-radius: 18px 18px 18px 4px; }
  h2 span { display: block; margin-top: 4px; }
  .about-lead { font-size: 18px; }
  .about-copy { font-size: 14px; }
  .about-links { grid-template-columns: 1fr; }
  .about-section { margin-top: 30px; }
  .about-project { padding: 22px 18px; }
  .about-project h3 { font-size: 20px; }
}
</style>

