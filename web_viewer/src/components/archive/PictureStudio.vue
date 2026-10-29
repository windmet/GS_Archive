<template>
  <div ref="studioShell" class="studio-shell">
  <!-- One layout, 素材 | 画布 | 检查器. The native studio splits 撮影 (place, people) from デコ (stickers, frame,
       filter) and edits people in fixed slots; here both stages share one canvas and every layer is free to move.
       Narrower than 1100px the two side panes share one column, switched by 素材 | 检查器; under 720px that column
       sits below the picture. -->
  <article class="studio-page" :data-pane="pane" data-archive-scroll-container>
    <header class="studio-bar">
      <button v-if="standalone" class="studio-bar-icon" type="button" title="返回打开摄影工作台的页面" aria-label="返回来源页" @click="emit('back')"><ArrowLeft :size="20" /></button>
      <span class="studio-bar-title"><strong>摄影工作台</strong><small>{{ barSubtitle }}</small></span>
      <button class="studio-bar-icon" type="button" :disabled="!canUndoDelete" aria-label="撤销删除" title="恢复最近删除的图层" @click="undoDelete"><Undo2 :size="20" /></button>
      <button class="studio-bar-icon" type="button" :disabled="busy || rendering || documentLoading || !!error || exporting" aria-label="导出图片" title="生成无选框的 PNG 图片" @click="exportAndShow"><Download :size="20" /></button>
      <button ref="filesButton" class="studio-bar-icon" type="button" :aria-expanded="filesOpen" aria-controls="studio-files" title="保存构图、导出图片及全屏设置" aria-label="保存与导出" @click="filesOpen = !filesOpen"><Save :size="18" /></button>
      <ArchiveLanguageSwitch class="studio-header-language" on-dark />
    </header>

    <div class="studio-notices">
      <p v-if="immersive.notice.value" role="status">{{ immersive.notice.value === 'rotate' ? '可继续竖屏编辑，或自行旋转设备。' : '浏览器暂不支持全屏，可继续当前编辑。' }}</p>
      <p v-if="busy" role="status">正在读取摄影资料…</p>
      <p v-if="error" role="alert" class="domain-error">{{ error }}<button type="button" @click="materials ? retry() : load()">重试</button></p>
    </div>

    <div class="studio-pane-switch"><GsSegmented v-model="pane" :options="paneOptions" aria-label="摄影工作台面板" /></div>

    <!-- 素材: the native order, 撮影 first (地点, 人物), then デコ (贴纸, 相框, 滤镜). A click adds to the picture. -->
    <section class="studio-pane studio-materials" aria-label="摄影素材库">
      <nav class="studio-material-tabs" aria-label="摄影素材种类">
        <template v-for="group in materialGroups" :key="group.id">
          <span v-if="group.id === 'deco'" class="studio-tab-rule" aria-hidden="true"></span>
          <button v-for="tab in group.tabs" :key="tab.id" type="button" :aria-pressed="libraryTab === tab.id" :title="`${group.label} · ${tab.label}`" @click="libraryTab = tab.id">{{ tab.label }}<small v-if="tab.count">{{ tab.count }}</small></button>
        </template>
      </nav>
      <div ref="materialsBody" class="studio-pane-body">
        <template v-if="materials">
          <template v-if="libraryTab === 'spots'">
            <label class="studio-search"><Search :size="17" /><input v-model="spotSearch" type="search" aria-label="搜索地点" placeholder="搜索地点或时段…" /></label>
            <div v-if="spotVariants.length" class="studio-chips" role="group" aria-label="按时段与天气筛选">
              <button type="button" :aria-pressed="!spotVariant" @click="spotVariant = ''">全部</button>
              <button v-for="entry in spotVariants" :key="entry.id" type="button" :aria-pressed="spotVariant === entry.id" @click="spotVariant = entry.id">{{ entry.label }}</button>
            </div>
            <div class="studio-spot-grid" :style="{ '--studio-spot-columns': spotColumns }">
              <template v-for="item in spotGridItems" :key="item.key">
                <button v-if="item.spot" type="button" class="studio-spot" :aria-pressed="draft.background.spotId === item.spot.id" @click="chooseSpot(item.spot)">
                  <span class="studio-spot-art"><img v-if="media[`spots:${item.spot.id}`]?.image?.url" :src="thumbnail(media[`spots:${item.spot.id}`].image.url)" alt="" loading="lazy" decoding="async" @error="fullPicture($event, media[`spots:${item.spot.id}`].image.url)" /><ImageOff v-else :size="20" /></span>
                  <span>{{ materialName('spots', item.spot) }}</span>
                </button>
                <div v-else class="studio-spot-scenes" role="group" :aria-label="`${currentSpotName}的场景`">
                  <span>{{ currentSpotName }} · {{ scenes.length }} 个场景</span>
                  <div class="studio-chips">
                    <button v-for="scene in scenes" :key="scene.id" type="button" :aria-pressed="draft.background.sceneId === scene.id" @click="draft.background.sceneId = scene.id">{{ materialName('scenes', scene) }}</button>
                  </div>
                </div>
              </template>
            </div>
            <p v-if="!filteredSpots.length" class="studio-status">没有匹配的地点。</p>
          </template>
          <template v-else-if="libraryTab === 'actors'">
            <p class="studio-status" role="status">{{ personBusy ? '正在读取人物资料…' : `点头像加入画面；同一位可以加多次。画面中 ${draft.actors.length} / ${STUDIO_LIMITS.actors} 人` }}</p>
            <ArchiveIdolPickerPanel class="studio-idol-picker" :idols="pickerIdols" :idol-name="idolName" :idol-search="idolSearch" :counts="actorCounts" :disabled="busy || personBusy || draft.actors.length >= STUDIO_LIMITS.actors" model-value="" @update:model-value="addPerson" />
          </template>
          <template v-else-if="libraryTab === 'stickers'">
            <label class="studio-search"><Search :size="17" /><input v-model="stickerSearch" type="search" aria-label="搜索贴纸" placeholder="搜索贴纸…" /></label>
            <div class="studio-chips" role="group" aria-label="贴纸分类">
              <button type="button" :aria-pressed="!stickerGroup" @click="stickerGroup = ''">全部 <small>{{ materials.stickers.length }}</small></button>
              <button v-for="group in stickerGroups" :key="group.id" type="button" :aria-pressed="stickerGroup === group.id" @click="stickerGroup = group.id">{{ group.label }} <small>{{ group.count }}</small></button>
            </div>
            <p class="studio-status">画面中 {{ draft.stickers.length }} / {{ STUDIO_LIMITS.stickers }} 张</p>
            <section v-for="section in stickerSections" :key="section.id" class="studio-material-section" :aria-label="section.label">
              <h4 class="studio-material-heading">{{ section.label }}</h4>
              <div class="studio-sticker-grid">
                <button
                  v-for="sticker in section.rows"
                  :key="sticker.id"
                  type="button"
                  :title="materialName('stickers', sticker)"
                  :aria-label="`添加贴纸 ${materialName('stickers', sticker)}${stickerCounts[sticker.id] ? `（画面中 ${stickerCounts[sticker.id]}）` : ''}`"
                  :disabled="draft.stickers.length >= STUDIO_LIMITS.stickers"
                  @click="addRecentSticker(sticker.id)"
                >
                  <img v-if="media[`stickers:${sticker.id}`]?.image?.url && !failedThumbnails.has(sticker.id)" :src="media[`stickers:${sticker.id}`].image.url" alt="" loading="lazy" decoding="async" @error="failedThumbnails = new Set([...failedThumbnails, sticker.id])" /><ImageOff v-else :size="24" />
                  <small v-if="stickerCounts[sticker.id]" class="studio-material-count" aria-hidden="true">{{ stickerCounts[sticker.id] }}</small>
                </button>
              </div>
            </section>
            <p v-if="!stickerSections.length" class="studio-status">没有匹配的贴纸。</p>
          </template>
          <template v-else-if="libraryTab === 'frames'">
            <div class="studio-preview-grid" role="group" aria-label="相框">
              <button type="button" :aria-pressed="!draft.frameId" @click="draft.frameId = null"><span class="studio-preview-art is-empty">无</span><span>不加相框</span></button>
              <button v-for="frame in frameRows" :key="frame.id" type="button" :aria-pressed="draft.frameId === frame.id" @click="draft.frameId = frame.id">
                <span class="studio-preview-art"><img v-if="media[`frames:${frame.id}`]?.image?.url" :src="media[`frames:${frame.id}`].image.url" alt="" loading="lazy" decoding="async" /><ImageOff v-else :size="20" /></span><span>{{ frame.label }}</span>
              </button>
            </div>
            <p class="studio-boundary">相框使用原始锚点，尺寸仍为网页近似。</p>
          </template>
          <template v-else>
            <div class="studio-preview-grid" role="group" aria-label="滤镜">
              <button type="button" :aria-pressed="!draft.filterId" @click="draft.filterId = null"><span class="studio-preview-art"><img v-if="sceneImage" :src="thumbnail(sceneImage)" alt="" loading="lazy" decoding="async" @error="fullPicture($event, sceneImage)" /></span><span>原图</span></button>
              <button v-for="filter in materials.filters" :key="filter.id" type="button" :aria-pressed="draft.filterId === filter.id" @click="draft.filterId = filter.id">
                <span class="studio-preview-art"><img v-if="sceneImage" :src="thumbnail(sceneImage)" alt="" loading="lazy" decoding="async" :style="{ filter: studioFilterCss(filter.resourceId) }" @error="fullPicture($event, sceneImage)" /></span><span>{{ materialName('filters', filter) }}</span>
              </button>
            </div>
            <p class="studio-boundary">滤镜为网页近似，预览用当前场景；场景天气效果尚未重建。</p>
          </template>
        </template>
      </div>
    </section>

    <!-- 画布 on the dark stage; under it one bar: the selection's quick tools, then how the picture is viewed. -->
    <section class="studio-stage" aria-label="摄影预览">
      <div class="studio-stage-frame">
        <div ref="canvas" class="studio-canvas" data-studio-rotation="0"></div>
        <output v-if="interaction && (interaction.mode === 'rotate' || interaction.aligned || interaction.snapped)" class="studio-interaction-feedback">{{ interaction.mode === 'rotate' || interaction.snapped ? `${interaction.rotation}°${interaction.snapped ? ' · 已吸附' : ''}` : '已对齐' }}</output>
        <output v-else-if="slowRender" class="studio-interaction-feedback" role="status">正在载入素材…</output>
      </div>
      <div class="studio-canvas-bar">
        <div class="studio-canvas-selection" aria-label="当前图层操作">
          <button type="button" class="studio-selection-name" :disabled="!selected" :aria-label="selected ? `编辑 ${objectName(selected)}` : '未选择图层'" title="在检查器中编辑所选图层" @click="pane = 'inspector'"><span><strong>{{ selected ? objectName(selected) : '未选择图层' }}</strong><small>{{ selected ? (selected.idolId ? '人物' : '贴纸') : '点选画面中的对象' }}</small></span><ChevronRight class="studio-selection-chevron" :size="16" aria-hidden="true" /></button>
          <button type="button" :disabled="!selected || selected.locked || selected.hidden" aria-label="缩小所选图层" title="缩小" @click="adjustSelected(1 / 1.1)"><Minus :size="18" /></button>
          <button type="button" :disabled="!selected || selected.locked || selected.hidden" aria-label="放大所选图层" title="放大" @click="adjustSelected(1.1)"><Plus :size="18" /></button>
          <button type="button" class="hint-pointer" :disabled="!selected || selected.locked || selected.hidden" aria-label="逆时针旋转所选图层" title="左转 5°" @click="adjustSelected(1, -5)"><RotateCcw :size="17" /></button>
          <button type="button" class="hint-pointer" :disabled="!selected || selected.locked || selected.hidden" aria-label="顺时针旋转所选图层" title="右转 5°" @click="adjustSelected(1, 5)"><RotateCw :size="17" /></button>
          <button type="button" class="studio-delete" :disabled="!selected" aria-label="删除所选图层" title="删除所选图层，可撤销这次删除" @click="remove(selectedId)"><Trash2 :size="17" /></button>
        </div>
        <div class="studio-canvas-view">
          <button type="button" class="studio-play" :aria-pressed="playing" :disabled="busy || rendering" :title="playing ? '返回定格；保存或导出时也会恢复所选定格' : '播放人物的动作'" @click="togglePlayback"><Pause v-if="playing" :size="16" /><Play v-else :size="16" />{{ playing ? '返回定格' : '预览动作' }}</button>
          <label class="studio-snap-toggle"><GsSwitch v-model="snapOn" aria-label="吸附" on-dark />吸附</label>
          <GsInfo label="画布操作：说明"><span class="hint-touch">点一下选中，拖动移动；拖四角缩放，拖圆柄旋转；两指捏合同时缩放和旋转。吸附：对齐线与 0°/90°。</span><span class="hint-pointer">拖动移动，四角缩放，圆柄旋转；滚轮缩放，Shift＋滚轮旋转；方向键微调，＋/− 大小，[ / ] 旋转。按住 Alt 临时关闭吸附。</span></GsInfo>
        </div>
        <p role="status" class="studio-stage-status">{{ rendering ? '正在更新构图…' : playing ? '正在预览动作' : status }}</p>
      </div>
    </section>

    <!-- 检查器: the layers (front first), then whatever is selected — a person, a sticker, or the background. -->
    <aside class="studio-pane studio-inspector" aria-label="检查器">
      <div ref="inspectorBody" class="studio-pane-body">
        <section class="studio-object-picker" aria-label="图层列表">
          <h3 class="studio-layer-heading"><Layers :size="17" />图层<span>{{ objects.length }}</span></h3>
          <div class="studio-object-list">
            <div v-if="draft.frameId" class="studio-background-layer"><Image :size="17" /><span>相框 · 最前景</span><small>在「相框」中更换</small></div>
            <template v-for="group in layerGroups" :key="group.kind">
            <h4 v-if="group.rows.length" class="studio-layer-group">{{ group.label }}</h4>
            <div
              v-for="(row, index) in group.rows"
              :key="row.instanceId"
              class="studio-object-row"
              :data-studio-layer="row.instanceId"
              :class="{ 'is-selected': selectedId === row.instanceId, 'is-hidden': row.hidden, 'is-drop-target': layerDrag.targetId === row.instanceId }"
            >
              <button type="button" class="studio-layer-grip" :aria-label="`拖拽排序 ${objectName(row)}`" title="拖动重排；方向键上下调整" @pointerdown="startLayerDrag($event, row)" @keydown.up.prevent="move(row.instanceId, 1)" @keydown.down.prevent="move(row.instanceId, -1)"><GripVertical :size="15" /></button>
              <button type="button" class="studio-object-select" :aria-pressed="selectedId === row.instanceId" :aria-label="`选择对象 ${objectName(row)}`" @click="select(row.instanceId)">
                <img v-if="objectThumbnail(row)" :src="objectThumbnail(row)" alt="" /><User v-else-if="row.idolId" :size="20" /><Sticker v-else :size="20" /><span>{{ objectName(row) }}</span><small class="studio-layer-number">{{ group.rows.length - index }}</small>
              </button>
              <button type="button" :aria-label="`${row.locked ? '解锁' : '锁定'} ${objectName(row)}`" :aria-pressed="!!row.locked" :title="row.locked ? '解锁后可在画布调整' : '防止画布误选与移动'" @click="toggleLayer(row.instanceId, 'locked')"><Lock v-if="row.locked" :size="15" /><Unlock v-else :size="15" /></button>
              <button type="button" :aria-label="`${row.hidden ? '显示' : '隐藏'} ${objectName(row)}`" :aria-pressed="!!row.hidden" title="临时显示或隐藏，保留图层" @click="toggleLayer(row.instanceId, 'hidden')"><EyeOff v-if="row.hidden" :size="15" /><Eye v-else :size="15" /></button>
            </div>
            </template>
            <p v-if="!objects.length" class="studio-layer-empty">画布还没有人物或贴纸。在「人物」「贴纸」中添加。</p>
            <button type="button" class="studio-background-layer is-button" :aria-pressed="inspectingBackground" @click="inspectBackground"><Image :size="17" /><span>背景 · {{ currentSceneName }}</span><ChevronRight :size="15" aria-hidden="true" /></button>
          </div>
        </section>

        <section v-if="selected" class="studio-layer-editor" aria-label="编辑所选图层">
          <h3 class="studio-selected-title">{{ objectName(selected) }}<small>{{ selected.idolId ? '人物' : '贴纸' }}</small></h3>
          <p v-if="selected.locked" class="studio-status"><Lock :size="13" />图层已锁定。<button type="button" class="studio-text-action" @click="toggleLayer(selectedId, 'locked')">解锁编辑</button></p>
          <fieldset class="studio-editable-properties" :disabled="!!selected.locked">
          <template v-if="selectedActor">
            <!-- The native slot editor's tabs, in its order: 服装 · 表情 · 动作. -->
            <nav class="studio-variant-tabs" aria-label="人物差分种类">
              <button v-for="variant in variantTabs" :key="variant.id" type="button" :aria-pressed="variantTab === variant.id" @click="variantTab = variant.id">{{ variant.label }} <small>{{ variant.id === 'costumes' ? selectedActor.costumes.length : selectedActor.actor[variant.id].length }}</small></button>
            </nav>
            <template v-if="variantTab === 'costumes'">
              <CostumeCategoryFilter v-model="costumeCategory" :costumes="selectedActor.costumes" label="摄影服装类别" />
              <div class="studio-costume-list" role="group" aria-label="摄影服装">
                <button v-if="filteredCostumes.pinned" type="button" aria-pressed="true" @click="selected.modelId = filteredCostumes.pinned.modelId">{{ photoCostumeLabel(filteredCostumes.pinned) }}<small>当前 · 分类外</small></button>
                <button v-for="costume in filteredCostumes.rows" :key="costume.modelId" type="button" :aria-pressed="selected.modelId === costume.modelId" @click="selected.modelId = costume.modelId">{{ photoCostumeLabel(costume) }}<Check v-if="selected.modelId === costume.modelId" :size="16" aria-hidden="true" /></button>
              </div>
            </template>
            <template v-else>
              <p class="studio-current-variant">{{ variantTab === 'faces' ? '表情' : '动作' }}：{{ variantName(selectedActor, variantTab, currentVariant) }}</p>
              <div class="studio-variant-grid" :aria-label="variantTab === 'faces' ? '表情差分' : '动作差分'">
                <button v-for="variant in selectedActor.actor[variantTab]" :key="variant.id" type="button" :aria-pressed="currentVariant?.id === variant.id" :aria-label="`选择${variantTab === 'faces' ? '表情' : '动作'} ${variantName(selectedActor, variantTab, variant)}`" :title="variantTitle(selectedActor, variantTab, variant)" @click="selected[variantTab === 'faces' ? 'faceId' : 'poseId'] = variant.id">
                  <img v-if="selectedActor.media.entries[`${variantTab}:${variant.id}`]?.image?.url" :src="selectedActor.media.entries[`${variantTab}:${variant.id}`].image.url" alt="" loading="lazy" />
                  <ImageOff v-else :size="24" />
                  <span>{{ variantName(selectedActor, variantTab, variant) }}</span><small>{{ studioPresetPresentation(selectedActor, variantTab, variant).number }}</small>
                </button>
              </div>
            </template>
            <div class="studio-prop-row"><span>景别</span><div class="studio-framing" aria-label="人物景别">
              <button v-for="frame in framingPresets" :key="frame.label" type="button" :aria-pressed="selected.scale === frame.scale && selected.y === frame.y" :title="frame.hint" @click="Object.assign(selected, { scale: frame.scale, y: frame.y })">{{ frame.label }}</button>
            </div></div>
          </template>
          <div class="studio-prop-row"><span>叠放</span><div class="studio-order-tools" aria-label="所选图层叠放顺序"><button type="button" :disabled="atEdge(selected, 1)" title="在同类图层中向前移动一层" @click="move(selectedId, 1)"><ArrowUp :size="16" />前移</button><button type="button" :disabled="atEdge(selected, -1)" title="在同类图层中向后移动一层" @click="move(selectedId, -1)"><ArrowDown :size="16" />后移</button></div></div>
          <details class="studio-fine-adjust"><summary>位置与大小微调</summary>
          <label v-for="field in transformFields" :key="field.key" class="studio-transform">{{ field.label }}<input v-model.number="selected[field.key]" type="range" :aria-label="`${field.label}滑块`" :min="field.min" :max="field.max" :step="field.step" /><input v-model.number="selected[field.key]" type="number" :aria-label="`${field.label}数值`" :min="field.min" :max="field.max" :step="field.step" /></label>
          </details>
          </fieldset>
          <div class="studio-editor-actions"><button type="button" :disabled="selected.locked" @click="reset"><RotateCcw :size="16" />重置对象</button><button type="button" class="studio-delete" @click="remove(selectedId)"><Trash2 :size="16" />删除</button></div>
          <details v-if="selectedActor" class="studio-source">
            <summary>预设来源</summary>
            <p>{{ selected.modelId }}<br />{{ selectedActor.media.entries[`poses:${selected.poseId}`]?.preset.label }}<br />{{ selectedActor.media.entries[`faces:${selected.faceId}`]?.preset.label }}<br />动作：{{ variantTitle(selectedActor, 'poses', selectedActor.actor.poses.find(row => row.id === selected.poseId)) }}<br />表情：{{ variantTitle(selectedActor, 'faces', selectedActor.actor.faces.find(row => row.id === selected.faceId)) }}</p>
            <p>摄影脚本映射动作与表情；其他服装使用同一偶像的实际动作兼容校验。</p>
          </details>
        </section>

        <!-- The background as a layer: its scene and zoom; the place itself is chosen in 素材 · 地点. -->
        <section v-else-if="inspectingBackground && materials" class="studio-layer-editor" aria-label="编辑背景">
          <h3 class="studio-selected-title">{{ currentSpotName || '背景' }}<small>背景</small></h3>
          <div v-if="scenes.length > 1" class="studio-prop-stack"><span>场景</span><div class="studio-chips">
            <button v-for="scene in scenes" :key="scene.id" type="button" :aria-pressed="draft.background.sceneId === scene.id" @click="draft.background.sceneId = scene.id">{{ materialName('scenes', scene) }}</button>
          </div></div>
          <label class="studio-zoom">背景缩放<span><input type="range" min="1" max="3" step=".05" aria-label="背景缩放" :value="draft.background.zoom ?? 1" @input="draft.background.zoom = Number($event.target.value)" /><output>{{ Math.round((draft.background.zoom ?? 1) * 100) }}%</output></span></label>
          <button type="button" class="studio-text-action" @click="showMaterials('spots')">更换地点 ›</button>
        </section>
        <p v-else class="studio-status studio-inspector-empty">点选画面或图层里的对象来编辑；点「背景」调整场景和缩放。</p>
      </div>
    </aside>

    <!-- 保存与导出: a panel over the right edge (a bottom sheet on phones), opened from the bar. -->
    <section v-if="filesOpen" id="studio-files" class="studio-files" aria-label="保存与导出" @keydown.esc.stop="closeFiles">
      <div class="studio-files-heading"><strong>保存与导出</strong><button type="button" class="studio-text-action" @click="closeFiles">收起</button></div>
      <div class="studio-pane-body">
        <div class="studio-files-group">
          <button type="button" class="studio-primary" :disabled="busy || rendering || documentLoading || !!error || exporting" @click="exportPng"><Download :size="17" />导出 PNG</button>
          <p v-if="exportStatus" role="status" class="studio-status">{{ exportStatus }}</p>
          <details v-if="exportUrl" open class="studio-export-preview">
            <summary>导出预览 · <a :href="exportUrl" download="sidem-composition.png">保存 PNG</a></summary>
            <img :src="exportUrl" alt="导出的摄影画面" />
          </details>
        </div>
        <div class="studio-files-group">
          <h4>构图</h4>
          <div class="studio-files-actions">
            <button type="button" :disabled="busy || rendering || documentLoading" @click="save"><Save :size="16" />保存构图</button>
            <button type="button" :disabled="busy || rendering || documentLoading" @click="restore"><FolderOpen :size="16" />载入构图</button>
            <button type="button" :disabled="busy" @click="reference('A')"><Image :size="16" />参考构图 A</button>
            <button type="button" :disabled="busy" @click="reference('B')"><Image :size="16" />参考构图 B</button>
          </div>
          <details class="studio-document-files">
            <summary>构图文件</summary>
            <p>文件保留素材选择、位置和定格，可在下次载入后继续编辑。照片请使用「导出 PNG」。</p>
            <div class="studio-files-actions">
              <button type="button" :disabled="busy || rendering || documentLoading" @click="exportDocument"><Download :size="16" />生成构图文件</button>
              <button type="button" :disabled="busy || documentLoading" @click="fileInput.click()"><FolderOpen :size="16" />从文件载入</button>
              <button type="button" :disabled="busy || rendering || documentLoading" @click="copyDocument"><Copy :size="16" />复制构图内容</button>
              <input ref="fileInput" type="file" accept=".json,application/json" aria-label="选择构图文件" hidden @change="onDocumentFile" />
              <a v-if="documentUrl" :href="documentUrl" download="sidem-composition.json">保存构图文件</a>
            </div>
          </details>
          <p v-if="documentLoading" role="status" class="studio-status">正在读取构图文件及素材…</p>
          <p v-if="documentStatus" role="status" class="studio-status">{{ documentStatus }}</p>
          <p v-if="documentError" role="alert" class="domain-error">{{ documentError }}</p>
        </div>
        <div class="studio-files-group">
          <h4>画面</h4>
          <div class="studio-files-actions"><button v-if="!immersive.active.value" type="button" :disabled="immersive.pending.value" @click="immersive.enter(studioShell)"><Maximize :size="16" />横屏全屏</button><button v-else type="button" @click="immersive.leave()"><Minimize :size="16" />退出全屏</button></div>
        </div>
      </div>
    </section>
  </article>
  </div>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import CostumeCategoryFilter from './CostumeCategoryFilter.vue'
import GsSwitch from '../gs/GsSwitch.vue'
import GsSegmented from '../gs/GsSegmented.vue'
import GsInfo from '../gs/GsInfo.vue'
import {costumeFilterView} from '../../presentation/CostumeCategories.js'
import {storyCostumeLabel} from '../../presentation/costumeSeries.js'
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import {
  Download,
  Copy,
  Pause,
  Play,
  RotateCcw,
  Save,
  FolderOpen,
  Image,
  ImageOff,
  Plus,
  Search,
  User,
  Sticker,
  ArrowUp,
  ArrowDown,
  Trash2,
  ArrowLeft, Layers, Minus, Undo2, Maximize, Minimize, GripVertical, Eye, EyeOff, Lock, Unlock, RotateCw, ChevronRight, Check,
} from "@lucide/vue";
import { useStudioComposition } from "./useStudioComposition.js";
import { usePlayerImmersiveMode } from '../../composables/usePlayerImmersiveMode.js';
import { studioPresetPresentation } from '../../presentation/studio-preset-labels.mjs';
import {archiveText, archiveSearchText, loadArchivePhotoNames} from './useArchivePhotoText.js';
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue';
import { PHOTO_STICKER_GROUPS, photoStickerGroup } from '../../presentation/photoStickerGroups.js';
import { photoBackgroundThumbnailUrl as thumbnail, photoSpotScene, photoSpotScenes, photoSpotVariantKeys, photoSpotVariants } from '../../presentation/photoSpotScenes.js';
import { STUDIO_LIMITS } from '../../core/StudioDocument.mjs';
import { studioFilterCss } from '../../core/PictureStudioPolicy.mjs';
import "../../styles/archive-domains.css";
import "../../styles/picture-studio.css";
const emit = defineEmits(['back']);
const props = defineProps({
  standalone: Boolean,
  client: Object,
  bootstrap: Object,
  photoIdol: { type: String, default: "" },
  photoEntity: { type: String, default: "" },
  restoreOnOpen: Boolean,
  // Opened from 「从背景开始」: narrow screens show 素材 · 地点 first even when an idol is given.
  openMaterials: Boolean,
  idolName: { type: Function, default: () => "" },
  idolSearch: { type: Function, default: () => "" },
});
const canvas = ref(null), fileInput = ref(null);
const studioShell = ref(null), filesButton = ref(null), materialsBody = ref(null), inspectorBody = ref(null);
// Narrow screens show one side pane at a time. A picture starts from its place (素材 · 地点), unless the studio was
// opened with an idol, who is then already selected for editing.
const pane = ref(props.photoIdol && !props.openMaterials ? 'inspector' : 'materials');
const paneOptions = [{ value: 'materials', label: '素材' }, { value: 'inspector', label: '检查器' }];
const filesOpen = ref(false);
const variantTab = ref('faces');
const variantTabs = [{ id: 'costumes', label: '服装' }, { id: 'faces', label: '表情' }, { id: 'poses', label: '动作' }];
const framingPresets = [
  { label: '远景', scale: .7, y: .97, hint: '缩小人物，保留更多环境' },
  { label: '中景', scale: 1.15, y: 1.1, hint: '拉近人物，突出上半身' },
  { label: '近景', scale: 1.8, y: 1.68, hint: '放大人物，突出脸部；可继续拖动微调' },
];
const immersive = usePlayerImmersiveMode();
function closeFiles() { filesOpen.value = false; filesButton.value?.focus(); }
function escapeStudio(event) {
  if (event.key !== 'Escape') return;
  if (filesOpen.value) { closeFiles(); event.preventDefault(); }
}
window.addEventListener('keydown', escapeStudio);
onScopeDispose(() => window.removeEventListener('keydown', escapeStudio));
const {
  draft,
  actors,
  materials,
  media,
  views,
  busy,
  rendering,
  error,
  status,
  selectedId,
  selected,
  selectedActor,
  interaction,
  playing,
  exportUrl,
  exportStatus,
  exporting,
  documentError,
  documentStatus,
  documentUrl,
  documentLoading,
  actorView,
  select,
  addActor,
  addSticker,
  adjustSelected,
  cancelInteraction,
  setSnapPreference,
  remove,
  canUndoDelete,
  undoDelete,
  move,
  reorder,
  toggleLayer,
  setSpot,
  reference,
  reset,
  togglePlayback,
  exportPng,
  save,
  restore,
  exportDocument,
  copyDocument,
  importDocument,
  load,
  retry,
} = useStudioComposition(props, canvas);
// 继续上次的构图: the entry page asks for the saved composition; it loads once the studio's own first load is done.
let restoreAsked = props.restoreOnOpen;
watch(busy, (now, before) => { if (before && !now && restoreAsked) { restoreAsked = false; void restore(); } });
function photoCostumeLabel(costume) {
  const name = costume.nameJa === costume.modelId ? storyCostumeLabel(costume.modelId) || costume.nameJa : costume.nameJa;
  return archiveText('costume', name);
}
const costumeCategory = ref('');
const filteredCostumes = computed(() => costumeFilterView(selectedActor.value?.costumes || [], costumeCategory.value, selected.value?.modelId));
watch(() => selected.value?.instanceId, () => { costumeCategory.value = ''; });
// Snapping is a per-viewer convenience, remembered in this browser only.
const SNAP_KEY = 'gs-studio-snap';
const snapOn = ref((() => { try { return localStorage.getItem(SNAP_KEY) !== 'off'; } catch { return true; } })());
watch(snapOn, on => { setSnapPreference(on); try { localStorage.setItem(SNAP_KEY, on ? 'on' : 'off'); } catch { /* convenience only */ } }, { immediate: true });
// The canvas keeps the current picture while new material loads; a load that takes noticeably long
// says so, a quick one does not flash a message.
const slowRender = ref(false);
let slowRenderTimer = 0;
watch(rendering, value => {
  clearTimeout(slowRenderTimer);
  if (value) slowRenderTimer = setTimeout(() => { slowRender.value = true; }, 300);
  else slowRender.value = false;
});
onScopeDispose(() => clearTimeout(slowRenderTimer));
function onDocumentFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  void importDocument(file);
}
function exportAndShow() { filesOpen.value = true; void exportPng(); }
const libraryTab = ref("spots"),
  stickerSearch = ref(""),
  stickerGroup = ref(""),
  spotSearch = ref(""),
  spotVariant = ref(""),
  personBusy = ref(false),
  failedThumbnails = shallowRef(new Set());
const materialTabs = [
  { id: "spots", label: "地点" },
  { id: "actors", label: "人物" },
  { id: "stickers", label: "贴纸" },
  { id: "frames", label: "相框" },
  { id: "filters", label: "滤镜" },
];
// The native studio's two stages: 撮影 (地点, 人物) and デコ (贴纸, 相框, 滤镜); counts show what is in the picture.
const materialGroups = computed(() => [
  { id: "shoot", label: "拍摄", tabs: materialTabs.slice(0, 2) },
  { id: "deco", label: "装饰", tabs: materialTabs.slice(2) },
].map((group) => ({ ...group, tabs: group.tabs.map((tab) => ({
  ...tab,
  count: tab.id === "actors" ? `${draft.value.actors.length}/${STUDIO_LIMITS.actors}`
    : tab.id === "stickers" ? `${draft.value.stickers.length}/${STUDIO_LIMITS.stickers}` : "",
})) })));
function showMaterials(id) { libraryTab.value = id; pane.value = 'materials'; }
watch(libraryTab, async () => { await nextTick(); if (materialsBody.value) materialsBody.value.scrollTop = 0; });
// The background is inspected like a layer; choosing it clears the object selection, choosing an object clears it.
const inspectingBackground = ref(false);
function inspectBackground() { select(''); inspectingBackground.value = true; pane.value = 'inspector'; }
watch(selectedId, (id) => { if (id) inspectingBackground.value = false; });
// A tap on the canvas opens its object in the inspector on narrow screens; adding from 素材 stays in 素材,
// so several people or stickers can be added in a row.
const narrow = window.matchMedia('(max-width: 1099px)');
let adding = false;
watch(selectedId, (id) => { if (id && !adding && narrow.matches) pane.value = 'inspector'; }, { flush: 'sync' });
const transformFields = [
  { key: "x", label: "水平位置 X", min: -1, max: 2, step: 0.01 },
  { key: "y", label: "垂直位置 Y", min: -1, max: 3, step: 0.01 },
  { key: "scale", label: "大小", min: 0.1, max: 5, step: 0.05 },
  { key: "rotation", label: "旋转", min: -180, max: 180, step: 1 },
];
const currentSpot = computed(() => materials.value?.spots.find((row) => row.id === draft.value.background.spotId) || null);
const currentSpotName = computed(() => materialName("spots", currentSpot.value));
const scenes = computed(() => photoSpotScenes(materials.value, currentSpot.value));
const currentSceneName = computed(() => { const scene = scenes.value.find((row) => row.id === draft.value.background.sceneId); return scenes.value.length > 1 && scene ? `${currentSpotName.value} · ${materialName('scenes', scene)}` : currentSpotName.value; });
const barSubtitle = computed(() => selected.value ? objectName(selected.value) : currentSpot.value ? currentSceneName.value : '点选对象后拖动');
// A thumbnail that fails to load is replaced once by the full picture.
function fullPicture(event, url) { if (event.target.src !== new URL(url, location.href).href) event.target.src = url; }
const sceneImage = computed(() => media.value?.[`scenes:${draft.value.background.sceneId}`]?.image?.url || media.value?.[`spots:${draft.value.background.spotId}`]?.image?.url || "");
const spotVariants = computed(() => photoSpotVariants(materials.value, (id) => archiveText("photo-scenes", id)));
const filteredSpots = computed(() => {
  const q = spotSearch.value.trim().toLocaleLowerCase();
  return (materials.value?.spots || []).filter((spot) =>
    (!spotVariant.value || photoSpotVariantKeys(materials.value, spot).includes(spotVariant.value)) &&
    (!q || `${archiveSearchText("photo-spots", spot.name)} ${photoSpotScenes(materials.value, spot).map((scene) => archiveSearchText("photo-scenes", scene.name)).join(" ")} ${spot.id}`
      .toLocaleLowerCase().includes(q)));
});
// The chosen spot's scenes open on the row below it; a chosen spot outside the filter shows them first.
const spotColumns = 2;
const spotGridItems = computed(() => {
  const rows = filteredSpots.value, items = rows.map((spot) => ({ key: `spot:${spot.id}`, spot }));
  if (!currentSpot.value || !scenes.value.length) return items;
  const index = rows.indexOf(currentSpot.value), columns = spotColumns;
  const at = index < 0 ? 0 : Math.min(rows.length, (Math.floor(index / columns) + 1) * columns);
  items.splice(at, 0, { key: "scenes" });
  return items;
});
function chooseSpot(spot) {
  if (draft.value.background.spotId !== spot.id) setSpot(spot.id);
  const scene = spotVariant.value && photoSpotScene(materials.value, spot, spotVariant.value);
  if (scene) draft.value.background.sceneId = scene.id;
}
// People: the archive's one idol picker, limited to idols with studio data; a click adds one.
const pickerIdols = computed(() => {
  const codes = new Set(actors.value.map((row) => row.idolCode));
  const idols = (props.bootstrap?.idols || []).filter((idol) => codes.has(idol.id));
  return idols.length ? idols : actors.value.map((row) => ({ id: row.idolCode || row.id, name: row.nameJa }));
});
const actorCounts = computed(() => {
  const counts = {};
  for (const row of draft.value.actors) {
    const code = actors.value.find((actor) => actor.id === String(row.idolId))?.idolCode;
    if (code) counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
});
async function addPerson(code) {
  const row = actors.value.find((actor) => actor.idolCode === code || actor.id === code);
  if (!row || personBusy.value) return;
  personBusy.value = true;
  adding = true;
  try { await addActor(row.id); } finally { personBusy.value = false; adding = false; }
}
// Stickers: browsed by group (photoStickerGroups.js), with the ones this viewer used last on top.
const RECENT_STICKERS_KEY = "gs-studio-recent-stickers", RECENT_STICKER_LIMIT = 8;
const recentStickerIds = ref(readRecentStickers());
function readRecentStickers() {
  try { const value = JSON.parse(localStorage.getItem(RECENT_STICKERS_KEY) || "[]"); return Array.isArray(value) ? value.map(Number).filter(Number.isInteger) : []; }
  catch { return []; }
}
function addRecentSticker(id) {
  adding = true;
  try { addSticker(id); } finally { adding = false; }
  recentStickerIds.value = [Number(id), ...recentStickerIds.value.filter((row) => row !== Number(id))].slice(0, RECENT_STICKER_LIMIT);
  try { localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(recentStickerIds.value)); } catch { /* per-viewer convenience only */ }
}
const stickerCounts = computed(() => {
  const counts = {};
  for (const row of draft.value.stickers) counts[row.stickerId] = (counts[row.stickerId] || 0) + 1;
  return counts;
});
const filteredStickers = computed(() => {
  const q = stickerSearch.value.trim().toLocaleLowerCase();
  return (materials.value?.stickers || []).filter((row) =>
    (!stickerGroup.value || photoStickerGroup(row) === stickerGroup.value) &&
    (!q || `${archiveSearchText("photo-stickers", row.name)} ${row.id}`.toLocaleLowerCase().includes(q)));
});
const stickerGroups = computed(() => PHOTO_STICKER_GROUPS
  .map((group) => ({ ...group, count: (materials.value?.stickers || []).filter((row) => photoStickerGroup(row) === group.id).length }))
  .filter((group) => group.count));
const stickerSections = computed(() => {
  const rows = filteredStickers.value;
  const sections = PHOTO_STICKER_GROUPS
    .map((group) => ({ id: group.id, label: group.label, rows: rows.filter((row) => photoStickerGroup(row) === group.id) }))
    .filter((section) => section.rows.length);
  if (stickerGroup.value || stickerSearch.value.trim()) return sections;
  const recent = recentStickerIds.value.map((id) => materials.value?.stickers.find((row) => row.id === id)).filter(Boolean);
  return recent.length ? [{ id: "recent", label: "最近用过", rows: recent }, ...sections] : sections;
});
// Two frames share each of two names (they differ in colour); the later one gets a number.
const frameRows = computed(() => {
  const seen = new Map();
  return (materials.value?.frames || []).map((frame) => {
    const name = materialName("frames", frame), count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    return { ...frame, label: count > 1 ? `${name} ${count}` : name };
  });
});
const objects = computed(() => [
  ...draft.value.actors,
  ...draft.value.stickers,
]);
const layerGroups = computed(() => [
  { kind: 'stickers', label: '贴纸 · 前景', rows: [...draft.value.stickers].reverse() },
  { kind: 'actors', label: '人物', rows: [...draft.value.actors].reverse() },
]);
const layerDrag = ref({ id: '', targetId: '' });
let finishLayerDrag = null;
function startLayerDrag(event, row) {
  if (event.button !== 0) return;
  finishLayerDrag?.(false);
  const handle = event.currentTarget, pointerId = event.pointerId;
  event.preventDefault();
  handle.setPointerCapture(pointerId);
  layerDrag.value = { id: row.instanceId, targetId: '' };
  const pointerMove = moveEvent => {
    if (moveEvent.pointerId !== pointerId) return;
    const targetId = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-studio-layer]')?.dataset.studioLayer;
    const target = objects.value.find(candidate => candidate.instanceId === targetId);
    layerDrag.value.targetId = target && !!target.idolId === !!row.idolId ? targetId : '';
    const list = handle.closest('.studio-object-list'), rect = list.getBoundingClientRect();
    if (moveEvent.clientY < rect.top + 24) list.scrollTop -= 12;
    if (moveEvent.clientY > rect.bottom - 24) list.scrollTop += 12;
  };
  const finish = commit => {
    handle.removeEventListener('pointermove', pointerMove);
    handle.removeEventListener('pointerup', pointerUp);
    handle.removeEventListener('pointercancel', pointerCancel);
    handle.removeEventListener('lostpointercapture', pointerCancel);
    window.removeEventListener('blur', pointerCancel);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    if (commit && layerDrag.value.targetId) reorder(row.instanceId, layerDrag.value.targetId);
    layerDrag.value = { id: '', targetId: '' };
    finishLayerDrag = null;
  };
  const pointerUp = upEvent => { if (upEvent.pointerId === pointerId) finish(true); };
  const pointerCancel = () => finish(false);
  finishLayerDrag = finish;
  handle.addEventListener('pointermove', pointerMove);
  handle.addEventListener('pointerup', pointerUp);
  handle.addEventListener('pointercancel', pointerCancel);
  handle.addEventListener('lostpointercapture', pointerCancel);
  window.addEventListener('blur', pointerCancel);
}
onScopeDispose(() => finishLayerDrag?.(false));
watch([selectedId, pane], () => finishLayerDrag?.(false));
watch(selectedId, async () => {
  await nextTick();
  inspectorBody.value?.querySelector('.studio-object-row.is-selected')?.scrollIntoView({ block: 'nearest' });
});
const currentVariant = computed(() => variantTab.value === 'costumes' ? null : selectedActor.value?.actor[variantTab.value].find(row => row.id === selected.value?.[variantTab.value === 'faces' ? 'faceId' : 'poseId']));
function variantName(view, kind, row) { return row ? studioPresetPresentation(view, kind, row).label : '未选择'; }
function materialName(kind, row) { return archiveText(`photo-${kind}`, row?.name).replace('ステッカー ', ''); }
function variantTitle(view, kind, row) {
  if (!row) return '';
  const value = studioPresetPresentation(view, kind, row);
  return `${value.label} · ${value.number} · ${value.source || row.iconResourceId}`;
}
function objectName(row) {
  const actor = row.idolId && actors.value.find((entry) => entry.id === String(row.idolId));
  return row.idolId
    ? (actor && (props.idolName(actor.idolCode, actor.nameJa) || actor.nameJa)) || String(row.idolId)
    : materialName('stickers',materials.value?.stickers.find(sticker => sticker.id === row.stickerId)) || String(row.stickerId);
}
function objectThumbnail(row) {
  return row.idolId
    ? views.value.get(String(row.idolId))?.media.entries[`faces:${row.faceId}`]
        ?.image?.url
    : media.value?.[`stickers:${row.stickerId}`]?.image?.url;
}
function atEdge(row, direction) {
  const rows = row.idolId ? draft.value.actors : draft.value.stickers,
    index = rows.findIndex((object) => object.instanceId === row.instanceId);
  return index + direction < 0 || index + direction >= rows.length;
}
onMounted(() => { loadArchivePhotoNames(); return load(); });
</script>
