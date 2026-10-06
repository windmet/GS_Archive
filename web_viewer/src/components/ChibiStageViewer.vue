<template>
  <div
    ref="stageRoot"
    class="chibi-stage"
    :class="{ 'is-pure': pureMode }"
    :data-stage-ready="stageReady"
    :data-song-id="selectedSong?.id || ''"
    :data-stage-kind="isSpecialSingle ? 'special_single' : 'choreography_candidate'"
    :data-active-positions="activePositions.join(',')"
    :data-loaded-positions="loadedPositions.join(',')"
    :data-current-singers="currentSingerPositions.join(',')"
    :data-current-performer-singers="currentSingerPerformerSlots.join(',')"
    :data-stage-vocal-enabled="stageVocalEnabled"
    :data-stage-vocal-ready="stageVocalReady"
    :data-stage-vocal-slots="stageVocalLoadedIdolCodes.length"
    :data-stage-vocal-clock="stageVocalEnabled ? 'audio-context-scheduled' : 'media-element'"
    :data-stage-vocal-mode="stageVocalMode"
    :data-stage-handoff="handoffLineup ? 'lineup' : ''"
    :data-vocal-setting="selectedSong?.vocalSetting?.mode || ''"
    :data-position-tween-ms="POSITION_TWEEN_MS"
    :data-stage-base-zoom="STAGE_BASE_ZOOM"
    :data-stage-view-scale="stageViewScale.toFixed(3)"
    :data-stage-environment-scale="environmentScale.toFixed(3)"
    :data-ground-registration="chibiGroundRegistration(selectedSong?.songCode).id"
    :data-derived-group-events="derivedGroupEventCount"
    :data-camera-event-time="currentCameraState.eventTime"
    :data-camera-zoom="currentCameraState.zoom.toFixed(4)"
    :data-camera-x="currentCameraState.x.toFixed(2)"
    :data-camera-y="currentCameraState.y.toFixed(2)"
    :data-camera-rotation="currentCameraState.rotation.toFixed(2)"
    :data-camera-focus-position="currentCameraState.stagePosition || ''"
    :data-camera-enabled="cameraEnabled"
    :data-static-stage-enabled="staticStageEnabled"
    :data-backmonitor-enabled="backmonitorEnabled"
    :data-image-layers-enabled="imageLayersEnabled"
    :data-object-layers-enabled="objectLayersEnabled"
    :data-lighting-enabled="lightingEnabled"
    :data-spotlight-background-alpha="spotlightBackgroundAlpha.toFixed(3)"
    :data-pinspotlight-mask-count="pinspotlightMaskCount"
    :data-beam-effects-enabled="beamEffectsEnabled"
    :data-characters-enabled="charactersEnabled && !isSpecialSingle"
    :data-character-shadows-enabled="characterShadowsEnabled"
    :data-character-shadow-source="stageEffectIndex?.characterShadow?.status || 'native-resource-unavailable'"
    :data-lyrics-enabled="lyricsEnabled"
    :data-backmonitor-movie="currentBackmonitorState.movie || ''"
    :data-backmonitor-event-time="currentBackmonitorState.eventTime"
    :data-backmonitor-transition="currentBackmonitorState.transition || ''"
    :data-backmonitor-transition-active="backmonitorTransitionActive"
    data-backmonitor-transition-mode="alpha-overlay"
    :data-backmonitor-ready="backmonitorReady"
    :data-backmonitor-raw-value6="currentBackmonitorState.rawValue6"
    :data-backmonitor-raw-value7="currentBackmonitorState.rawValue7"
    data-backmonitor-value7-status="sort-order-candidate-not-movie-alpha"
    data-backmonitor-logo-status="take-ending-native-mesh-reference-projection"
    :data-backmonitor-logo-angle="backmonitorLogoAngle"
    :data-backmonitor-logo-alpha="backmonitorLogoAlpha"
    :data-new-suspensionlight-ids="visibleSuspensionlightIds.join(',')"
    :data-old-suspensionlight-ids="visibleOldSuspensionlightIds.join(',')"
    data-old-suspensionlight-status="native-sidelight-curves-reference-director-projection"
    data-new-suspensionlight-status="partial-native-texture-reference-normal-show"
    :data-backmonitor-registration="backmonitorRegistration(selectedSong?.songCode).id"
    :data-image-layer-count="visibleImageLayerCount"
    :data-image-layer-assets="visibleImageLayerAssets.join(',')"
    :data-image-layer-depths="visibleImageLayerDepths.join(',')"
    :data-image-object-count="visibleImageObjectCount"
    :data-image-object-assets="visibleImageObjectAssets.join(',')"
    :data-object-layer-count="visibleObjectLayerCount"
    :data-object-layer-assets="visibleObjectLayerAssets.join(',')"
    :data-object-layer-unsupported="unsupportedObjectLayerAssets.join(',')"
    :data-particle-layer-frames="particleLayerFrames"
    :data-floor-particle-state="floorParticleState"
    :data-spotlight-count="visibleSpotlightCount"
    :data-stagelight-count="visibleStagelightCount"
    :data-stagelight-colors="appliedStagelightColors"
    data-stagelight-animation="reference-preview-not-native-tween-equivalence"
    :data-spotlight-ids="visibleSpotlightIds.join(',')"
    :data-spotlight-unresolved-ids="unresolvedSpotlightIds.join(',')"
    :data-spotlight-renderer="stageEffectIndex?.spotlight ? 'native-sprites' : 'resources-unavailable'"
    :data-laserlight-count="visibleLaserlightCount"
    :data-laserlight-ids="visibleLaserlightIds.join(',')"
    :data-laser-particle-count="visibleLaserParticleCount"
    :data-laser-particle-origins="laserParticleOrigins"
    data-laser-particle-status="native-texture-burst-curves-reference-director-projection"
    :data-pinspotlight-count="visiblePinspotlightCount"
    :data-pinspotlight-ids="visiblePinspotlightIds.join(',')"
    :data-stage-background-ready="stageBackgroundReady"
    :data-stage-background-song="stageBackgroundSongId"
    :data-current-lyric="currentLyric?.text || ''"
    :data-lip-sync-ready="lipSyncReady"
    :data-lip-sync-file="selectedSong?.lipSync?.file || ''"
    :data-lip-sync-frames="lipSyncFrameCount"
    :data-screen-color="currentWholeScreenColor.color"
    :data-screen-color-alpha="currentWholeScreenColor.alpha.toFixed(4)"
    :data-screen-color-layers="visibleColorPlanes.map(state => `${state.id}:${state.depth}:${state.alpha.toFixed(4)}`).join(',')"
    data-foot-light-status="command-uniform-mapping-unresolved"
    :data-foot-light-height="currentFootLighting.height"
    :data-foot-light-rate="currentFootLighting.rate"
    :data-body-colors="appliedBodyColors"
    :data-image-colors="appliedImageColors"
    :data-background-component-count="backgroundComponentCount"
    :data-background-tint-conflict="backgroundTintConflict"
  >
    <header class="stage-header">
      <ArchiveBackAction class="stage-back-button" :label="backLabel" icon-only @back="emit('back')" />
      <div class="header-divider" aria-hidden="true"></div>
      <div class="stage-header-title">
        <h1><span class="stage-title-full">{{ isSpecialSingle ? '社长特别演出 · 单人 2D' : '舞台小人 · 多人舞台' }}</span><span class="stage-title-compact">{{ isSpecialSingle ? '特别演出' : '舞台小人' }}</span></h1>
        <p>{{ isSpecialSingle ? '社长剪影与舞台对象按原脚本切换' : '选择歌曲与编队，观看舞台演出' }}</p>
      </div>
      <ArchiveLanguageSwitch on-dark />
      <button class="stage-icon-action" type="button" aria-label="快捷键与操作帮助" @click="helpOpen = true"><CircleHelp :size="19" /></button>
      <button class="stage-icon-action" type="button" aria-label="打开高级设置" @click="inspectorOpen = true"><Settings2 :size="19" /></button>
    </header>

    <main class="stage-workspace">
      <section class="performance-shell" :aria-label="isSpecialSingle ? '社长特别演出预览' : '多人舞台预览'">
        <div class="performance-viewport">
        <div class="performance-hud">
          <div class="performance-identity"><strong :title="selectedSong ? songOptionLabel(selectedSong) : ''">{{ selectedSong ? songOptionLabel(selectedSong) : '—' }}</strong><small>{{ isSpecialSingle ? '社长特别演出' : `${loadedPositions.length}/${activePositions.length} 人就绪` }}</small></div>
          <div class="performance-actions">
            <button class="stage-icon-action" type="button" aria-label="导出舞台截图" title="PNG · 不含界面与歌词" :disabled="!stageReady || snapshotBusy" @click="exportStageSnapshot"><Camera :size="19" /></button>
            <button class="stage-icon-action" type="button" aria-label="进入纯净模式" title="纯净模式 · H" @click="togglePureMode"><EyeOff :size="19" /></button>
            <button class="stage-icon-action" type="button" :aria-label="fullscreenActive ? '退出全屏' : '进入全屏'" :disabled="fullscreenPending" @click="toggleFullscreen"><Minimize v-if="fullscreenActive" :size="19" /><Maximize v-else :size="19" /></button>
          </div>
        </div>

        <div class="screen-fit-region">
        <div class="stage-ambient" aria-hidden="true" :style="stageAmbientImage ? { backgroundImage: `url(${JSON.stringify(stageAmbientImage)})` } : {}"></div>
        <div class="performance-screen">
        <div v-if="!hasAuthoredStage" class="stage-backdrop" aria-hidden="true"></div>
        <div v-if="!hasAuthoredStage" class="stage-floor" aria-hidden="true"></div>
        <div ref="canvasRef" class="stage-canvas"></div>

        <div v-if="currentLyric && lyricsEnabled" class="stage-lyric" aria-live="polite">
          {{ currentLyric.text }}
        </div>

        <div v-if="booting" class="stage-state stage-state--loading">
          <GsLoadingIndicator :message="statusText" tone="dark" />
        </div>
        <div v-else-if="errorText" class="stage-state error-state">
          <CircleAlert :size="28" />
          <strong>{{ isSpecialSingle ? '社长特别演出暂时无法加载' : '多人舞台暂时无法加载' }}</strong>
          <span>{{ errorText }}</span>
        </div>
        </div>
        </div>
        </div>

        <p v-if="!isSpecialSingle" class="rail-summary">当前编排 {{ activePositions.length }} 人 · {{ activePositions.join('、') }} 号位</p>
        <div v-if="!isSpecialSingle" class="position-rail" aria-label="舞台站位状态">
          <button
            v-for="position in allPositions"
            :key="position"
            class="position-marker"
            type="button"
            :disabled="!activePositions.includes(position)"
            :aria-label="activePositions.includes(position) ? `编辑 ${position} 号位 · ${stageIdolName(characterForSlot(slotByPosition(position))) || '空位'}` : `${position} 号位休息`"
            :aria-pressed="editingSlot?.position === position"
            :style="stageIdolStyle(characterForSlot(slotByPosition(position)))"
            @click="selectedPosition = position; panelTab = 'lineup'; costumeNotice = ''"
            :class="{
              active: activePositions.includes(position),
              loaded: loadedPositions.includes(position),
              singing: currentSingerPositions.includes(position),
              selected: editingSlot?.position === position,
            }"
            :data-position="position"
            :data-lineup-position="position"
            :data-runtime-ready="Boolean(runtimeForPosition(position))"
            :data-motion="slotByPosition(position)?.currentMotion || ''"
            :data-motion-source="slotByPosition(position)?.currentMotionSource || ''"
            :data-position-scale="positionDebugState(position).scale"
            :data-position-tween-progress="positionDebugState(position).progress"
            :data-position-x="positionDebugState(position).x"
            :data-position-y="positionDebugState(position).y"
            :data-shadow-x="runtimes.get(position)?.groundShadow?.x?.toFixed(2) || ''"
            :data-shadow-y="runtimes.get(position)?.groundShadow?.y?.toFixed(2) || ''"
            :data-shadow-width="runtimes.get(position)?.groundShadow?.width?.toFixed(2) || ''"
          >
            <ArchiveIdolAvatar :idol-code="activePositions.includes(position) ? slotByPosition(position)?.characterId || '' : ''" :accent-color="activePositions.includes(position) ? stageIdolColor(characterForSlot(slotByPosition(position))) : ''" :size="40" decorative :fallback-text="String(position)" />
            <span v-if="!activePositions.includes(position)" class="rest-position" aria-hidden="true">{{ position }} 号位<small>休息</small></span>
            <span v-if="activePositions.includes(position)" class="position-caption">{{ position }} <span v-if="currentSingerPositions.includes(position)" class="singing-status" role="img" aria-label="当前段演唱"><Mic2 :size="12" aria-hidden="true" /><span class="singing-label">演唱</span></span></span>
            <small v-if="activePositions.includes(position)">{{ stageIdolName(characterForSlot(slotByPosition(position))) || '空位' }}</small>
          </button>
        </div>

        <div class="transport" :class="{ disabled: !stageTransportReady || preloading }">
          <button type="button" aria-label="回到开头" @click="resetStage">
            <RotateCcw :size="19" />
          </button>
          <button
            class="primary-transport"
            type="button"
            :aria-label="stageStarting ? '取消舞台准备' : isSpecialSingle ? (playing ? '暂停社长特别演出' : '播放社长特别演出') : (playing ? '暂停多人编排' : '播放多人编排')"
            :title="stageStarting ? '取消舞台准备' : null"
            :disabled="!stageStarting && (!stageTransportReady || preloading)"
            @click="toggleStage"
          >
            <Pause v-if="playing || stageStarting" :size="22" fill="currentColor" />
            <Play v-else :size="22" fill="currentColor" />
          </button>
          <div class="transport-copy">
            <strong aria-live="polite" aria-atomic="true">{{ preloading ? `正在预载动作 ${preloadProgress}%` : (isSpecialSingle ? (playing ? '社长特别演出播放中' : '社长特别演出已暂停') : (playing ? '多人编排播放中' : '多人编排已暂停')) }}</strong>
            <small>{{ formatTime(stageTime) }} / {{ formatTime(stageDuration) }}</small>
          </div>
          <input
            v-model.number="stageTime"
            :aria-label="isSpecialSingle ? '社长特别演出时间轴' : '多人舞台时间轴'"
            type="range"
            min="0"
            :max="stageDuration"
            step="100"
            @change="seekStage"
          />
        </div>
      </section>

      <aside class="stage-inspector" :aria-label="isSpecialSingle ? '社长特别演出控制台' : '多人舞台控制台'">
        <nav class="mobile-panel-tabs" aria-label="舞台控制分类">
          <button type="button" :disabled="isSpecialSingle" :aria-pressed="panelTab === 'lineup' && !isSpecialSingle" :aria-controls="`${inspectorTitleId}-lineup`" @click="panelTab = 'lineup'">编队</button>
          <button type="button" :aria-pressed="panelTab === 'song' || (isSpecialSingle && panelTab === 'lineup')" :aria-controls="`${inspectorTitleId}-song`" @click="panelTab = 'song'">曲目</button>
          <button type="button" :aria-pressed="panelTab === 'viewing'" :aria-controls="`${inspectorTitleId}-viewing`" @click="panelTab = 'viewing'">画面</button>
        </nav>
        <div class="inspector-scroll" :class="{ 'is-song-panel': panelTab === 'song' || (isSpecialSingle && panelTab === 'lineup') }">
          <section v-show="panelTab === 'song' || (isSpecialSingle && panelTab === 'lineup')" :id="`${inspectorTitleId}-song`" class="control-section panel-section song-section">
            <ChibiSongPicker :songs="songs" :song-directory="songDirectory" :selected-song-id="selectedSongId" :disabled="booting" @select-song="selectStageScript">
              <template #current-actions><button v-if="stageVocalAvailable" class="stage-audio-action" type="button" :class="{ enabled: stageVocalEnabled }" aria-label="演唱音源设置" :title="stageVocalEnabled ? stageVocalToggleLabel : '原曲音源 · 可切换编成声部'" @click="vocalSettingsOpen = true"><Music2 :size="18" /></button></template>
            </ChibiSongPicker>
          </section>

          <section v-if="!isSpecialSingle" v-show="panelTab === 'lineup'" :id="`${inspectorTitleId}-lineup`" class="control-section panel-section lineup-section">
            <div class="section-heading">
              <div>
                <h2>演出编队</h2>
              </div>
              <UsersRound :size="18" />
            </div>

            <div class="lineup-actions"><button type="button" :disabled="!originalStageLineup || booting" @click="applyOriginalLineup">原曲成员</button><button type="button" :disabled="booting" @click="randomizeLineup"><Shuffle :size="15" />随机编队</button></div>
            <small class="lineup-note">{{ !originalStageLineup ? '点击舞台下方头像选择出演成员' : originalSlotOrdered ? '原曲成员按原曲站位排列，可调整' : '原曲站位未收录，暂按偶像编号排列，可调整' }}</small>
            <div v-if="editingSlot" class="slot-editor">
              <button class="idol-change-action" type="button" :disabled="booting || editingSlot.loading || !activePositions.includes(editingSlot.position)" :aria-label="`替换 ${editingSlot.position} 号位偶像`" @click="pickerPosition = editingSlot.position">
                <ArchiveIdolAvatar :idol-code="editingSlot.characterId" :accent-color="stageIdolColor(characterForSlot(editingSlot))" :size="44" decorative />
                <span class="slot-editor-copy"><small>{{ editingSlot.position }} 号位 · {{ editingSlot.loading ? '加载中' : currentSingerPositions.includes(editingSlot.position) ? '正在演唱' : '出演' }}</small><strong>{{ stageIdolName(characterForSlot(editingSlot)) || '空位' }}</strong></span><ChevronDown :size="17" />
              </button>
              <label class="costume-control"><span>衣装</span><select v-model="editingSlot.costumeId" :aria-label="`${editingSlot.position}号位服装`" :disabled="booting || editingSlot.loading || !activePositions.includes(editingSlot.position)" @change="costumeNotice = ''; loadSlot(editingSlot)"><option v-for="costume in costumesForSlot(editingSlot)" :key="costume.id" :value="costume.id">{{ stageCostumeLabel(costume) }}</option></select></label>
            </div>
            <button v-if="editingSlot" class="costume-sync-action" type="button" :disabled="booting || editingSlot.loading || !costumeSyncPlan" :aria-label="`将${stageCostumeLabel(costumeForSlot(editingSlot))}应用到出演成员`" @click="syncEditingCostume">应用到出演成员</button>
            <div v-if="sharedQuickCostumes.length" class="common-costume-actions"><h3>共通套服</h3><div class="uniform-quick-actions"><button v-for="costume in sharedQuickCostumes" :key="costume.id" type="button" :disabled="booting" @click="applySharedCostume(costume.id)">{{ stageCostumeLabel(costume) }}</button></div></div>
            <p v-if="costumeNotice" class="costume-notice" role="status">{{ costumeNotice }}</p>
          </section>

          <section v-show="panelTab === 'viewing'" :id="`${inspectorTitleId}-viewing`" class="control-section panel-section viewing-section" aria-label="观看设置">
            <div class="viewing-toggles">
            <label class="camera-toggle"><input v-model="cameraEnabled" type="checkbox" @change="applyCameraTransform" /><span>演出镜头</span></label>
            <label class="camera-toggle"><input v-model="lyricsEnabled" type="checkbox" /><span>显示歌词</span></label>
            </div>
            <label class="range-control viewing-range"><span>倍速</span><input v-model.number="playbackSpeed" aria-label="播放倍速" type="range" min="0.5" max="2" step="0.05" @input="applyPlaybackSpeed" /><output>{{ playbackSpeed.toFixed(2) }}×</output></label>
            <label class="range-control viewing-range"><span>视图</span><input v-model.number="stageViewScale" aria-label="整体视图缩放" type="range" min="0.5" max="1.5" step="0.01" @input="applyCameraTransform" /><output>{{ stageViewScale.toFixed(2) }}×</output></label>
            <div class="viewing-actions"><button type="button" @click="togglePureMode"><EyeOff :size="16" />纯净观看</button><button type="button" @click="inspectorOpen = true"><Settings2 :size="16" />高级设置</button></div>
          </section>
          <ArchiveErrorNote v-if="audioError" class="audio-error">{{ audioError }}</ArchiveErrorNote>
          <p v-if="panelNotice || fullscreenNoticeText" class="panel-notice" role="status">{{ panelNotice || fullscreenNoticeText }} <a v-if="snapshotUrl" :href="snapshotUrl" :download="snapshotFilename">保存 PNG</a></p>
        </div>
      </aside>
    </main>

    <ChibiIdolPicker :open="pickerPosition !== null" :position="pickerPosition || 0" :characters="characters" :idol-directory="idolDirectory" :selected-idol-code="slotByPosition(pickerPosition)?.characterId || ''" :idol-name="idolName" :idol-search="idolSearch" @close="pickerPosition = null" @select="selectStageIdol" />
    <ArchiveTerminalDialog class="stage-dev-dialog" :open="inspectorOpen" title="高级设置" :title-id="inspectorTitleId" @close="inspectorOpen = false">
          <div class="inspector-tools"><button class="lab-link" type="button" @click="emit('open-lab')">单人实验室</button><button class="rebuild-button" type="button" :disabled="booting" @click="rebuildStage"><RefreshCw :size="16" />重新加载编队</button></div>

          <section class="control-section playback-section">
            <div class="section-heading">
              <div>
                <h2>播放参数</h2>
                <span>{{ isSpecialSingle ? '歌曲与 2D 舞台对象共用同一时钟' : '歌曲、动作、口型共用同一时钟' }}</span>
              </div>
            </div>
            <fieldset class="layer-debug-controls">
              <legend>显示图层</legend>
              <label>
                <input v-model="staticStageEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>静态舞台</span>
              </label>
              <label>
                <input v-model="backmonitorEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>背景屏幕</span>
              </label>
              <label>
                <input v-model="imageLayersEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>图片布景</span>
              </label>
              <label>
                <input v-model="objectLayersEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>舞台物件</span>
              </label>
              <label>
                <input v-model="lightingEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>灯光染色</span>
              </label>
              <label>
                <input v-model="beamEffectsEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>光束灯效</span>
              </label>
              <label v-if="!isSpecialSingle">
                <input v-model="charactersEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>舞台人物</span>
              </label>
              <label v-if="!isSpecialSingle">
                <input v-model="characterShadowsEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>人物阴影</span>
              </label>
            </fieldset>
            <label class="range-control environment-scale-control">
              <span>环境</span>
              <input
                v-model.number="environmentScale"
                aria-label="舞台环境缩放"
                type="range"
                min="0.9"
                max="1.3"
                step="0.005"
                @input="resizeStage"
              />
              <output>{{ environmentScale.toFixed(3) }}×</output>
            </label>
          </section>
          <details v-if="MAINTAINER" class="control-section runtime-details">
            <summary>引擎运行时数据</summary>
            <dl class="runtime-summary">
              <div><dt>演出主体</dt><dd>{{ isSpecialSingle ? '社长单人剪影' : (activePositions.join(' / ') || '—') }}</dd></div>
              <div><dt>当前演唱</dt><dd>{{ isSpecialSingle ? '社长' : currentSingerLabel }}</dd></div>
              <div><dt>动作预载</dt><dd>{{ isSpecialSingle ? '2D 对象按需载入' : (preloading ? `${preloadProgress}%` : (songMotionsReady ? '已完成' : '播放时载入')) }}</dd></div>
              <div><dt>音频时钟</dt><dd>{{ stageVocalEnabled ? (stageVocalReady ? '实验伴奏' : '实验声部加载中') : (audioReady ? '官方混音' : '等待加载') }}</dd></div>
              <div v-if="!isSpecialSingle"><dt>位置过渡</dt><dd>{{ POSITION_TWEEN_MS }}ms 平滑插值</dd></div>
              <div><dt>动作组补位</dt><dd>{{ derivedGroupEventCount }} 处</dd></div>
              <div><dt>当前镜头</dt><dd>{{ currentCameraLabel }}</dd></div>
              <div><dt>舞台屏幕</dt><dd>{{ currentBackmonitorLabel }}</dd></div>
              <div><dt>图片布景</dt><dd>{{ visibleImageLayerCount }} 层</dd></div>
              <div><dt>舞台对象</dt><dd>{{ visibleObjectLayerCount }} 组</dd></div>
              <div v-if="stageVfxCoverage?.floorParticleStatus !== 'not_loaded' && stageVfxCoverage?.floorParticleStatus"><dt>地面动态</dt><dd>原生渐变与遮罩 · 投影及随机种子仍在核对</dd></div>
              <div v-if="stageEffectIndex?.stagelightSongs?.[selectedSong?.songCode]"><dt>固定舞台灯</dt><dd>{{ visibleStagelightCount }} 组 · 原生灯位与配色，闪烁曲线仍在核对</dd></div>
              <div v-if="stageVfxCoverage?.stagelightUnimplementedCommands"><dt>待补灯效</dt><dd>{{ stageVfxCoverage.stagelightUnimplementedCommands }} 条原始指令 · 含未解析颜色模式或指令版本</dd></div>
              <div><dt>静态舞台</dt><dd>{{ stageBackgroundReady ? '已载入' : '无/等待' }}</dd></div>
              <div><dt>当前歌词</dt><dd>{{ currentLyric?.text || '—' }}</dd></div>
            </dl>
            <p class="technical-note">均衡归一化与居中声像是浏览器近似，不代表游戏官方混音参数。</p>
          </details>
          <section v-if="MAINTAINER" class="control-section statistics-section">
            <div class="song-facts">
              <span>{{ selectedSong?.events.length || 0 }} 条动作</span>
              <span>{{ selectedSong?.singerEvents.length || 0 }} 次演唱切换</span>
              <span>{{ selectedSong?.cameraEvents?.length || 0 }} 条镜头</span>
              <span>{{ selectedSong?.backmonitorEvents?.length || 0 }} 条屏幕</span>
              <span>{{ selectedSong?.imageLayerEvents?.length || 0 }} 条布景</span>
              <span>{{ selectedSong?.lyricEvents?.length || 0 }} 条歌词</span>
              <span>{{ selectedVocalSettingFact }}</span>
            </div>
              <small v-if="isSoloChoreography">
                RAW 三个 Solo 候选均为中心一人演出；solo 与 solo_single 脚本相同，solo_multi 仅确认存在舞台效果差异，名称不作为声轨机制结论。
              </small>
            <div v-if="stageVfxCoverage" class="vfx-coverage">
              <h3>效果覆盖 · 来源统计</h3>
              <p>镜头 {{ stageVfxCoverage.sourceEvents.camera }} 条；屏幕 {{ stageVfxCoverage.sourceEvents.backmonitor }} 条、图片布景 {{ stageVfxCoverage.sourceEvents.imageLayer }} 条已登记。</p>
              <p v-if="stageVfxCoverage.sourceEvents.imageObject">图片对象 {{ stageVfxCoverage.sourceEvents.imageObject }} 条已接线，组合 Logo 使用独立资源和出现／退场时间。</p>
              <p v-if="stageVfxCoverage.sourceEvents.newSuspensionlight">新悬灯 {{ stageVfxCoverage.sourceEvents.newSuspensionlight }} 条原始指令；基础显示使用原生贴图，{{ stageVfxCoverage.newSuspensionlightUnimplementedCommands }} 条旋转／颜色／渐变控制仍待接入。当前可见 {{ visibleSuspensionlightIds.length }} 束。</p>
              <p v-if="stageVfxCoverage.backmonitorLogoRequests" class="vfx-coverage-gap">背屏标志有 {{ stageVfxCoverage.backmonitorLogoRequests }} 次候选出现指令；Take 结尾与 DRIVE A LIVE 已接旋转标志，其他运行时换图仍待核对。</p>
              <p>人物染色、聚光与激光共 {{ stageVfxApproximateCount }} 条，当前采用浏览器近似绘制，尚未对原片逐帧核对。</p>
              <p v-if="stageVfxCoverage.sourceEvents.wholeScreenColorLayer">多层舞台染色 {{ stageVfxCoverage.sourceEvents.wholeScreenColorLayer }} 条已接线，深度合成仍待原片核对。</p>
              <p v-if="stageVfxCoverage.unresolvedColorPlanes.length" class="vfx-coverage-gap">{{ stageVfxCoverage.unresolvedColorPlanes.length }} 条染色指令缺少层编号，暂未应用。</p>
              <p v-if="stageVfxCoverage.unresolvedImageColors.length" class="vfx-coverage-gap">{{ stageVfxCoverage.unresolvedImageColors.length }} 条布景染色指令的原始参数异常，暂未应用。</p>
              <p v-if="backgroundTintConflict" class="vfx-coverage-gap">当前资源包缺少独立背景组件，无法应用各层不同的染色。</p>
              <p>静态对象素材 {{ stageVfxCoverage.objectSprites.length }} 种已接线；粒子试点 {{ stageVfxCoverage.objectParticlePilots.length }} 种已接线，{{ stageVfxCoverage.objectParticleUnimplemented.length }} 种尚未完整实现。</p>
              <p v-if="stageVfxCoverage.objectParticlePartial.length">其中 {{ stageVfxCoverage.objectParticlePartial.length }} 种只接入了部分粒子，剩余子效果仍待复刻。</p>
              <p v-if="stageVfxCoverage.objectMissing.length || stageVfxCoverage.objectOther.length || stageVfxCoverage.missingMedia.length" class="vfx-coverage-gap">另有 {{ stageVfxCoverage.objectMissing.length + stageVfxCoverage.objectOther.length + stageVfxCoverage.missingMedia.length }} 种对象或媒体缺少本地可用实现。</p>
              <details v-if="stageVfxCoverage.objectParticleUnimplemented.length || stageVfxCoverage.objectMissing.length || stageVfxCoverage.objectOther.length">
                <summary>查看未支持的对象素材</summary>
                <code>{{ [...stageVfxCoverage.objectParticleUnimplemented, ...stageVfxCoverage.objectMissing, ...stageVfxCoverage.objectOther].join('、') }}</code>
              </details>
            </div>

          </section>
    </ArchiveTerminalDialog>
    <ArchiveTerminalDialog class="stage-dev-dialog stage-audio-dialog" :open="vocalSettingsOpen" title="演唱音源" :title-id="vocalTitleId" @close="vocalSettingsOpen = false">
            <fieldset v-if="stageVocalAvailable" class="stage-vocal-controls">
              <legend>{{ stageVocalLegend }}</legend>
              <label class="camera-toggle">
                <input v-model="stageVocalEnabled" type="checkbox" @change="handleStageVocalToggle" />
                <span>{{ stageVocalToggleLabel }}</span>
              </label>
              <details v-if="stageVocalEnabled" class="mix-details"><summary>声部与伴奏音量</summary>
                <label class="range-control">
                  <span>声部</span>
                  <input v-model.number="stageVocalBusGain" type="range" min="0" max="1" step="0.05" @input="syncStageVocalMix" />
                  <output>{{ stageVocalBusGain.toFixed(2) }}</output>
                </label>
                <label class="range-control">
                  <span>伴奏</span>
                  <input v-model.number="stageVocalBackingGain" type="range" min="0" max="1" step="0.05" @input="syncStageVocalMix" />
                  <output>{{ stageVocalBackingGain.toFixed(2) }}</output>
                </label>
                <small>{{ stageVocalReady ? stageVocalReadyLabel : stageVocalLoadingLabel }}</small>
              </details>
              <small v-if="handoffLineup">歌曲页编成 · 刷新后恢复默认编队</small>
            </fieldset>
    </ArchiveTerminalDialog>
    <ArchiveTerminalDialog class="stage-dev-dialog stage-help-dialog" :open="helpOpen" title="观看与操作" :title-id="helpTitleId" @close="helpOpen = false">
      <p>选择演出曲目，点击头像槽位编辑偶像与衣装。原曲成员使用已收录名单，按当前脚本槽位排列。</p>
      <dl class="shortcut-list"><div><dt><kbd>Space</kbd></dt><dd>播放 / 暂停</dd></div><div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>前后跳转 5 秒</dd></div><div><dt><kbd>H</kbd></dt><dd>显示 / 隐藏界面；隐藏时把鼠标移到画面顶端可截图、全屏或恢复界面</dd></div><div><dt><kbd>F</kbd></dt><dd>进入 / 退出全屏</dd></div></dl>
      <p>截图保存当前舞台画面，不包含操作界面与歌词。快捷键在编辑输入框或打开弹窗时停用。</p>
    </ArchiveTerminalDialog>
    <!-- Pure mode keeps its controls in a strip along the top edge: hidden while the pointer is on the
         stage, shown when it reaches the top or a key moves focus there. -->
    <div v-if="pureMode" class="pure-peek">
      <button class="stage-icon-action" type="button" aria-label="导出舞台截图" title="PNG · 不含界面与歌词" :disabled="!stageReady || snapshotBusy" @click="exportStageSnapshot"><Camera :size="19" /></button>
      <button class="stage-icon-action" type="button" :aria-label="fullscreenActive ? '退出全屏' : '进入全屏'" :disabled="fullscreenPending" @click="toggleFullscreen"><Minimize v-if="fullscreenActive" :size="19" /><Maximize v-else :size="19" /></button>
      <button ref="pureExitButton" class="pure-exit" type="button" @click="togglePureMode">显示控制 <kbd>H</kbd></button>
    </div>
  </div>
</template>

<script setup>
import ArchiveLanguageSwitch from './archive/ArchiveLanguageSwitch.vue'
import ArchiveIdolAvatar from './archive/ArchiveIdolAvatar.vue'
import ArchiveErrorNote from './archive/ArchiveErrorNote.vue'
import ArchiveTerminalDialog from './archive/terminal/ArchiveTerminalDialog.vue'
import { isMaintainerMode } from '../core/maintainerMode.js'
import ChibiIdolPicker from './ChibiIdolPicker.vue'
import ChibiSongPicker from './ChibiSongPicker.vue'
import { normalizeIdolAccentColor } from '../presentation/idolAccentColor.js'
import { buildOriginalStageLineup, planStageCostumeSync, universalStageCostumes, stageCostumeLabel as sourceStageCostumeLabel } from '../presentation/ChibiPanelPresentation.js'
import { archiveText } from './archive/useArchiveCostumeText.js'
import { usePlayerImmersiveMode } from '../composables/usePlayerImmersiveMode.js'
import { createPlaybackIntent } from '../core/PlaybackIntent.js'
import { colorLayersAt } from '../core/chibiColorLayers.js'
import { bodyColorsAt, multiplyBodyTint } from '../core/chibiBodyColors.js'
import { imageColorsAt, compositeImageTint } from '../core/chibiImageColors.js'
import GsLoadingIndicator from './GsLoadingIndicator.vue'
import { computed, customRef, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, shallowReactive, useId } from 'vue'
import * as PIXI from 'pixi.js'
import {
  CircleAlert,
  CircleHelp,
  Camera,
  ChevronDown,
  EyeOff,
  Maximize,
  Minimize,
  Settings2,
  Shuffle,
  LoaderCircle,
  Mic2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  UsersRound,
} from '@lucide/vue'
import ArchiveBackAction from './archive/ArchiveBackAction.vue'
import { withLoadDeadline } from '../core/AsyncLoadBoundary.js'
import {
  LIVE_CHIBI_BASE,
  applyLiveChibiLipSync,
  createLiveChibi,
  destroyLiveChibi,
  fetchLiveChibiBackmonitorIndex,
  fetchLiveChibiChoreography,
  fetchLiveChibiImageLayerIndex,
  fetchLiveChibiImageObjectIndex,
  fetchLiveChibiObjectLayerIndex,
  fetchLiveChibiLipSync,
  fetchLiveChibiManifest,
  fetchLiveChibiMusicIndex,
  fetchLiveChibiStageBackgroundIndex,
  fetchLiveChibiStageEffectIndex,
  injectLiveChibiMotion,
  playLiveChibiMotion,
  seekLiveChibiMotion,
} from '../utils/liveChibiSpine.js'
import { getSongUrl } from '../utils/AssetResolver.js'
import { fetchSongTimelineManifest } from '../utils/songPerformanceData.js'
import { resolveSongStageHandoff } from '../core/songStageHandoff.js'
import { buildStageVfxCoverage } from '../core/stageVfxCoverage.js'
import { sampleSpotlightBackground } from '../core/chibiSpotlightBackground.js'
import { footLightingAt, syncFootLighting, releaseFootLighting } from '../core/chibiFootLighting.js'
import { stagelightStatesAt, sampleStagelight, createStagelightRuntime, applyNativeLampColor } from '../core/chibiStagelights.js'
import { newSuspensionlightsAt, suspensionlightLayout } from '../core/chibiSuspensionlights.js'
import { oldSuspensionlightsAt, oldSuspensionlightLayout } from '../core/chibiOldSuspensionlights.js'
import { sampleBackmonitorLogo, createBackmonitorLogoMesh, updateBackmonitorLogoMesh, destroyBackmonitorLogoMesh } from '../core/chibiBackmonitorLogo.js'
import { sampleLaserParticles, laserParticleLayout } from '../core/chibiLaserParticles.js'
import { sampleSpotbeamParticles, spotbeamParticleScale } from '../core/chibiSpotbeamParticles.js'
import { createPinspotlightSprites, destroyPinspotlightSprites, pinspotlightModelForAsset } from '../core/chibiPinspotlightSprites.js'
import { chibiGroundRegistration, projectChibiGround, resolveChibiPlacement } from '../core/chibiStageCoordinates.js'
import { characterShadowLayout, installCharacterShadowFollower } from '../core/chibiCharacterShadow.js'
import { createSpotlightSpriteStore } from '../core/chibiSpotlightSprites.js'
import { backmonitorRegistration, projectChibiBackmonitor, chibiBackmonitorStateAt } from '../core/chibiBackmonitorCoordinates.js'
import { imageObjectsAt, imageObjectLayout } from '../core/chibiImageObjects.js'
import { loadChibiParticleLayer, updateChibiParticleLayer } from '../utils/chibiParticleLayers.js'
import { loadChibiFloor, updateChibiFloor } from '../core/chibiFloorParticles.js'
import { useSongPerformanceSession } from '../composables/useSongPerformanceSession.js'

const emit = defineEmits(['back', 'open-lab', 'target-change'])
const props = defineProps({
  audioExperiments: {
    type: Object,
    default: () => ({}),
  },
  stageTargetId: { type: String, default: '' },
  stageSongCode: { type: String, default: '' },
  stageHandoff: { type: Object, default: null },
  backLabel: { type: String, default: '返回资料馆' },
  idolDirectory: { type: Array, default: () => [] },
  songDirectory: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' },
  idolSearch: { type: Function, default: () => '' },
  originalPerformers: { type: Array, default: () => [] },
  originalSlotOrdered: { type: Boolean, default: false },
})
const stageRoot = ref(null), selectedPosition = ref(3), pickerPosition = ref(null)
const panelTab = ref('lineup')
const MAINTAINER = isMaintainerMode()
const inspectorOpen = ref(false), helpOpen = ref(false), vocalSettingsOpen = ref(false), pureMode = ref(false), pureExitButton = ref(null)
const inspectorTitleId = useId(), helpTitleId = useId(), vocalTitleId = useId()
const costumeNotice = ref(''), panelNotice = ref(''), snapshotBusy = ref(false)
const { active: fullscreenActive, pending: fullscreenPending, notice: fullscreenNotice, enter: enterFullscreen, leave: leaveFullscreen } = usePlayerImmersiveMode()
const fullscreenNoticeText = computed(() => fullscreenNotice.value === 'rotate' ? '可横置设备观看舞台。' : fullscreenNotice.value ? '当前浏览器未能进入全屏，可使用纯净模式观看。' : '')
const snapshotUrl = ref(''), snapshotFilename = ref('')
let pureReturnFocus = null, shortcutSeeking = false
const canvasRef = ref(null)
const manifest = shallowRef(null)
const choreography = shallowRef(null)
const lipSyncReady = ref(false)
const lipSyncFrameCount = ref(0)
const musicIndex = shallowRef(null)
const backmonitorIndex = shallowRef(null)
const imageLayerIndex = shallowRef(null)
const imageObjectIndex = shallowRef(null)
const visibleImageObjectCount = ref(0)
const visibleImageObjectAssets = ref([])
const objectLayerIndex = shallowRef(null)
const stageBackgroundIndex = shallowRef(null)
const stageEffectIndex = shallowRef(null)
const selectedSongId = ref('')
const lineup = ref([])
const booting = ref(true)
const preloading = ref(false)
const preloadProgress = ref(0)
const songMotionsReady = ref(false)
const statusText = ref('正在读取多人舞台资源…')
const errorText = ref('')
const audioReady = ref(false)
const audioError = ref('')
const stageVocalEnabled = ref(false)
const handoffLineup = ref(null)
const stageVocalSession = useSongPerformanceSession()
const stageVocalReady = stageVocalSession.ready
const stageVocalBusGain = stageVocalSession.vocalGain
const stageVocalBackingGain = stageVocalSession.backingGain
const stageVocalLoadedIdolCodes = stageVocalSession.loadedIdolCodes
// Renderer reads the exact frame clock; Vue publishes at 10 Hz while playing.
const stageTime = customRef((track,trigger)=> {
  let time=0,lastPublished=0
  return {get(){track();return time},set(value){
    time=value; const now=performance.now()
    if (!playing.value || now-lastPublished >= 100) {lastPublished=now;trigger()}
  }}
})
const frameValue = read => customRef(() => ({get:read,set(){}}))
const playbackSpeed = ref(1)
const playing = ref(false)
const cameraEnabled = ref(true)
const staticStageEnabled = ref(true)
const backmonitorEnabled = ref(true)
const imageLayersEnabled = ref(true)
const objectLayersEnabled = ref(true)
const lightingEnabled = ref(true)
const beamEffectsEnabled = ref(true)
const charactersEnabled = ref(true)
const characterShadowsEnabled = ref(true)
const lyricsEnabled = ref(true)
const backmonitorReady = ref(false)
const backmonitorTransitionActive = ref(false)
const visibleImageLayerCount = ref(0)
const visibleImageLayerAssets = ref([])
const visibleImageLayerDepths = ref([])
const visibleObjectLayerCount = ref(0)
const visibleObjectLayerAssets = ref([])
const unsupportedObjectLayerAssets = ref([])
const particleLayerFrames = ref('')
const floorParticleState = ref('')
const visibleSpotlightCount = ref(0)
const visibleSpotlightIds = ref([])
const unresolvedSpotlightIds = ref([])
const visibleLaserlightCount = ref(0)
const visibleLaserlightIds = ref([])
const visibleLaserParticleCount = ref(0)
const laserParticleOrigins = ref('')
const visiblePinspotlightCount = ref(0)
const visiblePinspotlightIds = ref([])
const stageBackgroundReady = ref(false)
const allPositions = [1, 2, 3, 4, 5]
const POSITION_TWEEN_MS = 350
// Authored Camera zoom is the baseline; do not add a presentation magnification.
const STAGE_BASE_ZOOM = 1
// Debug multiplier for the complete camera container. Unlike environmentScale,
// this keeps stage art, characters, monitor, shadows and effects registered.
const stageViewScale = ref(1)
// Stage art, monitor movies and fixed effects share an unexpanded environment
// plane. Keep the optional inspection control separate from source camera zoom.
const environmentScale = ref(1)
const CHARACTER_DEPTH_BASE = 2000
const CHARACTER_DEPTH_Y_FACTOR = 0.5
const CHARACTER_STAGE_SCALE = 0.58

let app = null
let cameraContainer = null
let backmonitorContainer = null
let backmonitorSprite = null
let backmonitorVideo = null
let backmonitorTexture = null
let backmonitorMovie = ''
let backmonitorTransitionSprite = null
let backmonitorTransitionVideo = null
let backmonitorTransitionAlphaVideo = null
let backmonitorTransitionTexture = null
let backmonitorTransitionAlphaTexture = null
let backmonitorTransitionFilter = null
let backmonitorTransition = ''
let backmonitorTransitionColorReady = false
let backmonitorTransitionAlphaReady = false
let imageLayerSongId = ''
let imageLayerSequence = 0
const imageLayerRuntimes = new Map()
const imageLayerLoads = new Map()
let objectLayerSongId = ''
let objectLayerSequence = 0
const objectLayerRuntimes = new Map()
const objectLayerLoads = new Map()
const spotlightSprites = createSpotlightSpriteStore({
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: createSpotlightRuntime,
  destroyRuntime: runtime => {
    runtime.container.removeFromParent()
    runtime.container.destroy({ children: true })
  },
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncSpotlights(),
  onError: error => console.warn('Native Spotlight textures could not be loaded', error),
})
const spotlightRuntimes = spotlightSprites.runtimes
const visibleStagelightCount = ref(0)
const appliedStagelightColors = ref('')
const stagelightSprites = createSpotlightSpriteStore({
  layerCount: null,
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: (id, layers, textures) => markRaw(createStagelightRuntime(PIXI, cameraContainer, layers, textures)),
  destroyRuntime: runtime => {
    runtime.container.removeFromParent(); runtime.container.destroy({ children: true })
    for (const texture of runtime.frameTextures) texture.destroy(false)
  },
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncStagelights(),
  onError: error => console.warn('Native stage lamp textures could not be loaded', error),
})
let stagelightSongId = ''
const visibleSuspensionlightIds = ref([])
let suspensionTrackKey = ''
let suspensionTrack = null
let suspensionAbort = null
const suspensionSprites = createSpotlightSpriteStore({
  layerCount: 1,
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: (id, layers, textures) => {
    const sprite = markRaw(new PIXI.Sprite(textures[0]))
    sprite.anchor.set(layers[0].anchorX, layers[0].anchorY)
    sprite.blendMode = PIXI.BLEND_MODES.ADD
    cameraContainer.addChild(sprite)
    return markRaw({ sprite })
  },
  destroyRuntime: runtime => { runtime.sprite.removeFromParent(); runtime.sprite.destroy() },
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncSuspensionlights(),
  onError: error => console.warn('[ChibiStage] suspension texture load failed', error),
})
const spotlightBackgroundAlpha = ref(0)
const visibleOldSuspensionlightIds = ref([])
const backmonitorLogoAngle = ref('')
const backmonitorLogoAlpha = ref(0)
const backmonitorLogoSprites = createSpotlightSpriteStore({
  layerCount: 1,
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: (id, layers, textures) => markRaw(createBackmonitorLogoMesh(PIXI,backmonitorContainer,textures[0])),
  destroyRuntime: destroyBackmonitorLogoMesh,
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncBackmonitor(true),
  onError: error => console.warn('[ChibiStage] backmonitor logo texture load failed',error),
})
let oldSuspensionTrackKey = ''
let oldSuspensionTrack = null
let oldSuspensionAbort = null
const oldSuspensionSprites = createSpotlightSpriteStore({
  layerCount: 1,
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: (id, layers, textures) => {
    const sprite = markRaw(new PIXI.Sprite(textures[0]))
    sprite.anchor.set(layers[0].anchorX, layers[0].anchorY)
    sprite.blendMode = PIXI.BLEND_MODES.ADD
    cameraContainer.addChild(sprite)
    return markRaw({ sprite })
  },
  destroyRuntime: runtime => { runtime.sprite.removeFromParent(); runtime.sprite.destroy() },
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncOldSuspensionlights(),
  onError: error => console.warn('[ChibiStage] old sidelight texture load failed', error),
})
const pinspotlightMaskCount = ref(0)
const spotlightBackgroundSprites = createSpotlightSpriteStore({
  layerCount: 1,
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: (id, layers, textures) => {
    const layer = layers[0]
    const sprite = markRaw(new PIXI.Sprite(textures[0]))
    sprite.anchor.set(layer.anchorX, layer.anchorY)
    sprite.blendMode = PIXI.BLEND_MODES.NORMAL
    sprite.zIndex = layer.sortingOrder
    sprite.visible = false
    cameraContainer.addChild(sprite)
    return markRaw({ sprite, layer })
  },
  destroyRuntime: runtime => { runtime.sprite.removeFromParent(); runtime.sprite.destroy() },
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncSpotlightBackground(),
  onError: error => console.warn('Native Spotlight background could not be loaded', error),
})
const laserlightRuntimes = new Map()
let laserParticleSongId = ''
const laserParticleSprites = createSpotlightSpriteStore({
  layerCount: 1,
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: (id, layers, textures) => {
    const container = markRaw(new PIXI.Container())
    cameraContainer.addChild(container)
    const texture = textures[0]
    const frames = layers[0].frames === 2 ? [0,1].map(frame => markRaw(new PIXI.Texture(
      texture.baseTexture, new PIXI.Rectangle(frame * 512,0,512,512)))) : null
    return markRaw({ container, sprites: [], texture, frames })
  },
  destroyRuntime: runtime => {
    runtime.container.removeFromParent(); runtime.container.destroy({ children: true })
    for (const texture of runtime.frames || []) texture.destroy(false)
  },
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncLaserlights(),
  onError: error => console.warn('[ChibiStage] native laser texture load failed', error),
})
const pinspotlightSprites = createSpotlightSpriteStore({
  loadTexture: file => loadImageLayerTexture(file),
  createRuntime: (id, layers, textures) => markRaw(createPinspotlightSprites(PIXI, cameraContainer, id, layers, textures)),
  destroyRuntime: destroyPinspotlightSprites,
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncPinspotlights().catch(error => console.warn('[ChibiStage] pinspotlight ready sync failed', error)),
  onError: error => console.warn('Native Pinspotlight textures could not be loaded', error),
})
const pinspotlightRuntimes = pinspotlightSprites.runtimes
const stageBackgroundSongId = ref('')
let stageBackgroundSequence = 0
let stageBackgroundSprite = null
let stageBackgroundTexture = null
const stageBackgroundParts = new Map()
const appliedImageColors = ref('')
const backgroundComponentCount = ref(0)
const backgroundTintConflict = ref(false)
let wholeScreenColorOverlay = null
const colorPlaneOverlays = new Map()
let characterShadowTexture = null
let characterShadowLoad = null
let resizeObserver = null
let animationFrame = 0
let playbackStartedAt = 0
let playbackStartOffset = 0
let songAudio = null
let lipSyncCurve = null
let lipSyncSequence = 0
let stageBuildSequence = 0
const runtimes = shallowReactive(new Map())
const eventIndices = new Map()

const characters = computed(() => manifest.value?.characters || [])
const songs = computed(() => choreography.value?.songs || [])
const selectedSong = computed(() => songs.value.find(song => song.id === selectedSongId.value) || null)
const isSpecialSingle = computed(() => selectedSong.value?.songCode === 'drv999')
const stageVfxCoverage = computed(() => buildStageVfxCoverage(selectedSong.value, {
  backmonitor: backmonitorIndex.value,
  imageLayers: imageLayerIndex.value,
  imageObjects: imageObjectIndex.value,
  objectLayers: objectLayerIndex.value,
  stageEffects: stageEffectIndex.value,
  stageBackgrounds: stageBackgroundIndex.value,
}))
const stageVfxApproximateCount = computed(() => {
  const events = stageVfxCoverage.value?.sourceEvents
  return events ? events.characterLight + events.bodyColor + events.spotlight + events.pinspotlight + events.laserlight : 0
})
const activePositions = computed(() => {
  if (isSpecialSingle.value) return []
  const positions = selectedSong.value?.positions || []
  return handoffLineup.value && selectedSong.value?.id === props.stageHandoff?.choreographyId
    ? positions.filter(position => handoffLineup.value[position - 1])
    : positions
})
const activeSlots = computed(() => lineup.value.filter(slot => activePositions.value.includes(slot.position)))
const loadedPositions = computed(() => activePositions.value.filter(position => runtimes.has(position)))
const editingSlot = computed(() => activeSlots.value.find(slot => slot.position === selectedPosition.value) || activeSlots.value[0] || null)
const originalStageLineup = computed(() => buildOriginalStageLineup(selectedSong.value, props.originalPerformers, characters.value, props.idolDirectory, { slotOrdered: props.originalSlotOrdered }))
const sharedQuickCostumes = computed(() => universalStageCostumes(characters.value, props.idolDirectory))
const costumeSyncPlan = computed(() => editingSlot.value ? planStageCostumeSync(
  lineup.value, characters.value, activePositions.value, editingSlot.value.characterId, editingSlot.value.costumeId,
) : null)
const stageAmbientImage = computed(() => {
  const file = stageBackgroundIndex.value?.songs?.[selectedSong.value?.songCode]?.file
  return file && staticStageEnabled.value ? `${LIVE_CHIBI_BASE}/${file}` : ''
})
const stageReady = computed(() => Boolean(selectedSong.value)
  && !errorText.value
  && (isSpecialSingle.value || (activePositions.value.length > 0
    && loadedPositions.value.length === activePositions.value.length))
  && !booting.value)
const stageTransportReady = computed(() => stageReady.value
  && (!stageVocalEnabled.value || stageVocalReady.value))
const selectedSongAudio = computed(() => selectedSong.value
  ? musicIndex.value?.songs?.[selectedSong.value.id] || null
  : null)
const selectedStageVocalExperiment = computed(() => {
  const entry = selectedSong.value?.songCode
    ? props.audioExperiments?.[selectedSong.value.songCode]
    : null
  return entry?.stage_vocal?.mode === 'parallel-performer-slots' ? entry : null
})
const isSoloChoreography = computed(() => /^solo(?:_|$)/.test(selectedSong.value?.variant || ''))
const isOfficialFormationSetting = computed(() => (
  selectedSong.value?.vocalSetting?.mode === 'formation-or-all-stars'
))
const stageVocalMode = computed(() => isSoloChoreography.value ? 'center-solo' : 'switch-singer')
const stageVocalAvailable = computed(() => Boolean(
  selectedStageVocalExperiment.value
  && (isSoloChoreography.value
    ? activePositions.value.length === 1
    : (handoffLineup.value || activePositions.value.length === selectedStageVocalExperiment.value.stage_vocal.slot_count)),
))
const stageVocalFactLabel = computed(() => isSoloChoreography.value ? 'Center 实验音频' : '编成偶像实验音频')
const stageVocalLegend = computed(() => isSoloChoreography.value ? 'Center 声部实验' : '编成偶像声部实验')
const stageVocalToggleLabel = computed(() => isSoloChoreography.value
  ? 'Center：中心偶像声部＋伴奏'
  : handoffLineup.value ? '当前编成：声部＋伴奏'
  : (isOfficialFormationSetting.value
    ? '编成偶像：五人声部＋伴奏'
    : '按编组位与 SwitchSinger 切换'))
const stageVocalReadyLabel = computed(() => isSoloChoreography.value
  ? '统一音频时钟与中心 Solo 声部已就绪'
  : handoffLineup.value ? `统一音频时钟与 ${stageVocalLoadedIdolCodes.value.length} 条去重声部已就绪`
  : '统一音频时钟与五个编组位声部已就绪')
const stageVocalLoadingLabel = computed(() => isSoloChoreography.value
  ? '正在预解码中心 Solo 声部…'
  : '正在预解码五个声部…')
const selectedVocalSettingFact = computed(() => {
  if (stageVocalEnabled.value) return stageVocalFactLabel.value
  if (selectedSong.value?.vocalSetting?.mode === 'formation-or-all-stars') {
    return '315 ALL STARS 完整混音候选'
  }
  if (selectedSong.value?.vocalSetting?.label) return selectedSong.value.vocalSetting.label
  return selectedSongAudio.value ? '官方混音音频' : '无音频'
})
const stageDuration = computed(() => Math.max(
  selectedSong.value?.duration || 0,
  selectedSong.value?.lipSync?.duration || 0,
  selectedSongAudio.value?.duration || 0,
  (selectedStageVocalExperiment.value?.backing?.metadata?.duration_seconds || 0) * 1000,
))
const motionCatalog = computed(() => new Map(
  (choreography.value?.motionCatalog || []).map(motion => [motion.id, motion]),
))
const currentSingerEvent = frameValue(() => [...(selectedSong.value?.singerEvents || [])]
  .reverse()
  .find(event => event.time <= stageTime.value))
const currentSingerPositions = frameValue(() => (
  currentSingerEvent.value?.stagePositions
  || currentSingerEvent.value?.singers
  || []
).filter(position => activePositions.value.includes(position)))
const currentSingerPerformerSlots = frameValue(() => (
  currentSingerEvent.value?.performerSlots
  || currentSingerEvent.value?.singers
  || []
))
const currentSingerLabel = computed(() => currentSingerPositions.value.length
  ? currentSingerPositions.value.map(position => `${position}号位`).join('、')
  : '无人')
const performanceEventsByPosition = computed(() => {
  const timelines = new Map(allPositions.map(position => [position, []]))
  const song = selectedSong.value
  if (!song) return timelines

  for (const position of activePositions.value) {
    const scripted = (song.events || [])
      .filter(event => (event.stagePosition ?? event.position) === position)
      .map(event => ({ ...event, source: 'script' }))
    const timeline = [...scripted]
    for (let index = 0; index < scripted.length; index += 1) {
      const event = scripted[index]
      const pauseTime = Number(event.pauseTime)
      if (!Number.isFinite(pauseTime) || pauseTime <= 0 || pauseTime >= 999999) continue
      const dueTime = Number(event.time) + pauseTime
      const nextTime = Number(scripted[index + 1]?.time ?? song.duration ?? dueTime)
      if (dueTime >= nextTime) continue
      const group = activeMotionGroupAt(dueTime)
      const motion = weightedGroupMotion(group, dueTime, position)
      if (!motion) continue
      timeline.push({
        ...event,
        time: dueTime,
        motion: motion.motion,
        speed: 1000,
        mode: 2,
        pauseTime: 999999,
        motionGroup: group,
        source: 'group',
      })
    }
    timelines.set(position, timeline.sort((a, b) => a.time - b.time || (a.source === 'script' ? -1 : 1)))
  }
  return timelines
})
const derivedGroupEventCount = computed(() => [...performanceEventsByPosition.value.values()]
  .flat()
  .filter(event => event.source === 'group').length)
const currentCameraState = frameValue(() => cameraStateAt(stageTime.value))
const currentBackmonitorState = frameValue(() => backmonitorStateAt(stageTime.value))
const hasAuthoredStage = computed(() => Boolean(stageBackgroundIndex.value?.songs?.[selectedSong.value?.songCode]))
const currentBackmonitorLabel = computed(() => currentBackmonitorState.value.movie
  ? currentBackmonitorState.value.movie.replace('live_backmonitor_movie_', '')
  : '无')
const currentLyric = computed(() => lyricAt(stageTime.value))
const currentWholeScreenColor = frameValue(() => wholeScreenColorAt(stageTime.value))
const currentColorPlanes = frameValue(() => colorLayersAt(selectedSong.value?.wholeScreenColorLayerEvents, stageTime.value))
const visibleColorPlanes = computed(() => lightingEnabled.value
  ? [...currentColorPlanes.value.values()].filter(state => state.alpha > 0.001) : [])
const currentFootLighting = frameValue(() => footLightingAt(selectedSong.value?.characterLightEvents,stageTime.value))
const currentBodyColors = frameValue(() => bodyColorsAt(selectedSong.value?.bodyColorEvents, stageTime.value))
const currentImageColors = frameValue(() => imageColorsAt(selectedSong.value?.imageColorEvents, stageTime.value))
const appliedBodyColors = ref('')
const currentCameraLabel = computed(() => {
  if (!cameraEnabled.value) return `${stageViewScale.value.toFixed(2)}× · 总览 · 0.0°`
  const camera = currentCameraState.value
  const focus = camera.stagePosition ? `${camera.stagePosition}号位` : '自由'
  const composedZoom = camera.zoom * STAGE_BASE_ZOOM * stageViewScale.value
  return `${composedZoom.toFixed(2)}× · ${focus} · ${camera.rotation.toFixed(1)}°`
})

let stageDisposed = false
const lifetime = new AbortController()
const slotOwners = new Map()
const stageStarting = ref(false)
const stageIntent = createPlaybackIntent(() => `${selectedSong.value?.id || ''}:${stageBuildSequence}`)
const stageAudioOwners = new Map()
onMounted(async () => {
  window.addEventListener('keydown', handleStageShortcut)
  await nextTick()
  if (stageDisposed) return
  try {
    if (props.stageTargetId || props.stageSongCode) {
      const timelineManifest = await fetchSongTimelineManifest()
      if (stageDisposed) return
      const target = timelineManifest.songs[props.stageSongCode]?.find(entry => entry.id === props.stageTargetId)
      if (!target) {
        booting.value = false
        errorText.value = '所选歌曲的舞台版本不存在或暂不可用。'
        return
      }
    }
    createPixiApp()
    manifest.value = await fetchLiveChibiManifest({signal:lifetime.signal})
    if (stageDisposed) return
    choreography.value = await fetchLiveChibiChoreography(manifest.value.choreography.index,{signal:lifetime.signal})
    if (stageDisposed) return
    musicIndex.value = await fetchLiveChibiMusicIndex({signal:lifetime.signal})
    if (stageDisposed) return
    initializeLineup()
    selectedSongId.value = props.stageTargetId
      ? (songs.value.find(song => song.id === props.stageTargetId && song.songCode === props.stageSongCode)?.id || '')
      : (songs.value.find(song => song.id === 'drvalv_live_effect')?.id || songs.value[0]?.id || '')
    if (!selectedSongId.value) {
      booting.value = false
      errorText.value = '所选歌曲的舞台版本与本地编舞资源不一致。'
      return
    }
    const resolvedHandoff = resolveSongStageHandoff(props.stageHandoff, selectedSong.value, characters.value)
    if (resolvedHandoff) {
      handoffLineup.value = resolvedHandoff.stageLineup
      for (const slot of lineup.value) {
        const idolCode = resolvedHandoff.stageLineup[slot.position - 1]
        if (!idolCode) {
          slot.characterId = ''
          slot.costumeId = ''
          continue
        }
        const character = characters.value.find(entry => entry.id === idolCode)
        slot.characterId = idolCode
        slot.costumeId = character.defaultCostume || character.costumes?.[0]?.id || ''
      }
      stageVocalBusGain.value = resolvedHandoff.vocalGain
      stageVocalBackingGain.value = resolvedHandoff.backingGain
      stageVocalEnabled.value = stageVocalAvailable.value
    }
    const optionalOptions={signal:lifetime.signal}
    const install=(target,value,sync)=> {
      if(stageDisposed || !value)return
      target.value=value
      if(sync)void sync().then(()=> {if(!stageDisposed && !playing.value)app?.render()}).catch(error=> {if(!stageDisposed)console.warn('[ChibiStage] optional visual unavailable',error)})
    }
    const visualJobs=[
      [backmonitorIndex,fetchLiveChibiBackmonitorIndex,async()=>syncBackmonitor(true)],
      [imageLayerIndex,fetchLiveChibiImageLayerIndex,syncImageLayers],
      [imageObjectIndex,fetchLiveChibiImageObjectIndex,syncImageLayers],
      [objectLayerIndex,options=>fetchLiveChibiObjectLayerIndex({...options,onOptional:value=>install(objectLayerIndex,value,syncObjectLayers)}),syncObjectLayers],
      [stageBackgroundIndex,options=>fetchLiveChibiStageBackgroundIndex({...options,onOptional:value=>install(stageBackgroundIndex,value,syncStageBackground)}),syncStageBackground],
      [stageEffectIndex,fetchLiveChibiStageEffectIndex,async()=> {await Promise.allSettled([...runtimes.values()].map(attachStageShadow));applyStageLighting()}],
    ].map(async ([target,load,sync])=> {
      try {install(target,await load(optionalOptions),sync)}
      catch(error) {if(!stageDisposed)console.warn('[ChibiStage] optional index unavailable',error)}
    })
    // The president's silhouette is an authored object, required for that stage.
    if(isSpecialSingle.value)await visualJobs[3]
    await Promise.all([loadSongLipSync(), loadSongAudio(), stageVocalEnabled.value ? loadStageVocalAudio() : Promise.resolve()])
    if (stageDisposed) return
    await rebuildStage()
  } catch (error) {
    if (stageDisposed) return
    booting.value = false
    errorText.value = error.message
    console.error('[ChibiStage] initialization failed', error)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleStageShortcut)
  if (snapshotUrl.value) URL.revokeObjectURL(snapshotUrl.value)
  stageDisposed = true
  lifetime.abort()
  for(const owner of slotOwners.values())owner.abort()
  slotOwners.clear()
  stageIntent.dispose()
  stageBuildSequence += 1
  lipSyncSequence += 1
  stopStage()
  resizeObserver?.disconnect()
  releaseAudio()
  releaseStageVocalAudio()
  releaseBackmonitor()
  releaseImageLayers()
  releaseObjectLayers()
  releaseSpotlights()
  stagelightSprites.release()
  suspensionSprites.release()
  suspensionAbort?.abort()
  oldSuspensionSprites.release()
  oldSuspensionAbort?.abort()
  releaseLaserlights()
  releasePinspotlights()
  releaseStageBackground()
  for (const plane of colorPlaneOverlays.values()) plane.destroy()
  colorPlaneOverlays.clear()
  for (const runtime of runtimes.values()) destroyStageRuntime(runtime)
  runtimes.clear()
  characterShadowTexture?.destroy(true)
  characterShadowTexture = null
  characterShadowLoad = null
  app?.destroy(true)
  app = null
  cameraContainer = null
  backmonitorContainer = null
})

function initializeLineup() {
  lineup.value = allPositions.map((position, index) => {
    const character = characters.value[index % Math.max(characters.value.length, 1)]
    return {
      position,
      characterId: character?.id || '',
      costumeId: character?.defaultCostume || character?.costumes?.[0]?.id || '',
      loading: false,
      loadSequence: 0,
      motionSequence: 0,
      currentMotion: null,
      currentMotionSource: '',
    }
  })
}

function createPixiApp() {
  const host = canvasRef.value
  if (!host) return
  app = markRaw(new PIXI.Application({
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  }))
  app.stop() // One owned RAF drives rendering; paused stages have no Pixi ticker.
  app.stage.sortableChildren = true
  cameraContainer = markRaw(new PIXI.Container())
  cameraContainer.sortableChildren = true
  backmonitorContainer = markRaw(new PIXI.Container())
  backmonitorContainer.sortableChildren = true
  // Backmonitor movies are projected through transparent cut-outs in the
  // authored stage art.  Keep the video below the static stage composite so
  // the opaque clockwork/floor pixels act as the original Unity mask.
  backmonitorContainer.zIndex = -30000
  cameraContainer.addChild(backmonitorContainer)
  app.stage.addChild(cameraContainer)
  host.appendChild(app.view)
  resizeObserver = new ResizeObserver(() => resizeStage())
  resizeObserver.observe(host)
}

function slotByPosition(position) {
  return lineup.value.find(slot => slot.position === position) || null
}

function runtimeForPosition(position) {
  return runtimes.get(position) || null
}

function characterForSlot(slot) {
  if (!slot) return null
  return characters.value.find(character => character.id === slot.characterId) || null
}

function stageIdolName(character) {
  return character ? props.idolName(character.id, character.name) || character.name || '' : ''
}
function stageIdolColor(character) {
  return normalizeIdolAccentColor(props.idolDirectory.find(idol => idol.id === character?.id)?.color) || '#82969e'
}
function stageIdolStyle(character) {
  return { '--idol-accent': stageIdolColor(character) }
}
function stageCostumeLabel(costume) { return archiveText('costume', sourceStageCostumeLabel(costume)) }
async function selectStageIdol(id) {
  const slot = slotByPosition(pickerPosition.value)
  pickerPosition.value = null
  if (!slot || booting.value || !activePositions.value.includes(slot.position) || !characters.value.some(character => character.id === id) || slot.characterId === id) return
  slot.characterId = id
  await handleCharacterChange(slot)
}
async function applyStageLineup(nextLineup) {
  if (booting.value || isSpecialSingle.value || !selectedSong.value || !nextLineup) return
  costumeNotice.value = ''
  const songId = selectedSong.value.id
  const reloadVocals = stageVocalEnabled.value
  stopStage(true)
  if (reloadVocals) releaseStageVocalAudio()
  handoffLineup.value = null
  for (const slot of lineup.value) {
    const id = nextLineup[slot.position - 1]
    if (!id) continue
    const character = characters.value.find(item => item.id === id)
    if (!character) return
    slot.characterId = id
    slot.costumeId = character.defaultCostume || character.costumes?.[0]?.id || ''
  }
  await rebuildStage()
  if (!stageDisposed && selectedSong.value?.id === songId && reloadVocals) await loadStageVocalAudio()
}
async function applyOriginalLineup() {
  await applyStageLineup(originalStageLineup.value)
}
async function randomizeLineup() {
  const candidates = [...characters.value]
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[candidates[index], candidates[other]] = [candidates[other], candidates[index]]
  }
  const nextLineup = Array(5).fill('')
  ;(selectedSong.value?.positions || []).forEach((position, index) => { nextLineup[position - 1] = candidates[index]?.id || '' })
  await applyStageLineup(nextLineup)
}
async function syncEditingCostume() {
  if (booting.value || editingSlot.value?.loading || !costumeSyncPlan.value) return
  const plan = costumeSyncPlan.value
  const songId = selectedSong.value?.id
  for (const assignment of plan.matched) {
    const slot = slotByPosition(assignment.position)
    if (slot?.characterId !== assignment.idolCode) return
  }
  for (const assignment of plan.matched) slotByPosition(assignment.position).costumeId = assignment.costumeId
  await rebuildStage()
  if (stageDisposed || selectedSong.value?.id !== songId) return
  const names = plan.unmatched.map(item => stageIdolName(characters.value.find(character => character.id === item.idolCode)) || item.idolCode)
  costumeNotice.value = `已为 ${plan.matched.length} 位出演成员应用衣装` + (names.length ? `；${names.join('、')}无此衣装，保留原样。` : '。')
}
async function applySharedCostume(id) {
  const costume = sharedQuickCostumes.value.find(item => item.id === id)
  if (booting.value || !costume || activeSlots.value.some(slot => !costume.costumeIdsByIdol?.[slot.characterId])) return
  const songId = selectedSong.value?.id
  for (const slot of activeSlots.value) slot.costumeId = costume.costumeIdsByIdol[slot.characterId]
  await rebuildStage()
  if (!stageDisposed && selectedSong.value?.id === songId) costumeNotice.value = `已为 ${activeSlots.value.length} 位出演成员换为${stageCostumeLabel(costume)}。`
}
async function togglePureMode() {
  if (!pureMode.value) {
    pureReturnFocus = document.activeElement
    inspectorOpen.value = false
    helpOpen.value = false
    vocalSettingsOpen.value = false
    pickerPosition.value = null
  }
  pureMode.value = !pureMode.value
  await nextTick()
  if (pureMode.value) pureExitButton.value?.focus({ preventScroll: true })
  else if (pureReturnFocus?.isConnected) { pureReturnFocus.focus({ preventScroll: true }); pureReturnFocus = null }
}
async function toggleFullscreen() {
  if (fullscreenActive.value) await leaveFullscreen()
  else await enterFullscreen(stageRoot.value)
}
async function exportStageSnapshot() {
  if (!app || !stageReady.value || snapshotBusy.value) return
  snapshotBusy.value = true
  panelNotice.value = ''
  const filename = `smgs-${selectedSong.value.songCode}-${Math.round(stageTime.value)}.png`
  try {
    // Repaint and read the same renderer viewport; extracting app.stage would
    // instead include off-screen object bounds and change the exported frame.
    app.renderer.render(app.stage)
    const canvas = app.renderer.extract.canvas()
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('empty-snapshot')), 'image/png'))
    if (stageDisposed) return
    if (snapshotUrl.value) URL.revokeObjectURL(snapshotUrl.value)
    const url = URL.createObjectURL(blob)
    snapshotUrl.value = url
    snapshotFilename.value = filename
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    panelNotice.value = `舞台截图已准备 · ${canvas.width} × ${canvas.height}`
  } catch {
    if (!stageDisposed) panelNotice.value = '当前画面暂时无法导出，请等待舞台加载完成后重试。'
  } finally {
    snapshotBusy.value = false
  }
}
function handleStageShortcut(event) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return
  const target = event.target
  if (target?.closest?.('input, select, textarea, [contenteditable="true"]')) return
  const key = event.key.toLowerCase()
  // Preserve native Space activation on focused controls in the regular UI.
  if (key === ' ' && target?.closest?.('button') && !pureMode.value) return
  if (key === 'h' || (key === 'escape' && pureMode.value)) { event.preventDefault(); void togglePureMode() }
  else if (key === 'f') { event.preventDefault(); void toggleFullscreen() }
  else if (key === ' ' && (stageStarting.value || (stageTransportReady.value && !preloading.value))) { event.preventDefault(); void toggleStage() }
  else if (['arrowleft', 'arrowright'].includes(key) && stageTransportReady.value && !preloading.value && !shortcutSeeking) {
    event.preventDefault()
    stageTime.value = Math.max(0, Math.min(stageDuration.value, stageTime.value + (key === 'arrowleft' ? -5000 : 5000)))
    shortcutSeeking = true
    seekStage().catch(() => { panelNotice.value = '舞台跳转未完成，请重试。' }).finally(() => { shortcutSeeking = false })
  }
}

function costumesForSlot(slot) {
  return characterForSlot(slot)?.costumes || []
}

function costumeForSlot(slot) {
  return costumesForSlot(slot).find(costume => costume.id === slot.costumeId) || null
}

function songOptionLabel(song) {
  const fallback = song?.title || song?.id || ''
  const setting = song?.vocalSetting
  const soloVersion = { solo: 'Solo', solo_multi: 'Solo Multi', solo_single: 'Solo Single' }[song?.variant] || song?.variant
  if (!setting) {
    if (!/^solo(?:_|$)/.test(song?.variant || '')) return fallback
    return `${song.title} · 中心一人（${soloVersion}）`
  }
  const suffix = song.variant ? ` · ${song.variant}` : ''
  const baseTitle = suffix && fallback.endsWith(suffix)
    ? fallback.slice(0, -suffix.length)
    : fallback
  if (setting.mode === 'formation-or-all-stars') {
    return `${baseTitle} · 编成偶像 / 315 ALL STARS`
  }
  if (setting.mode === 'unit') return `${baseTitle} · ${setting.label}`
  if (setting.mode === 'center') return `${baseTitle} · 中心一人（${soloVersion}）`
  return fallback
}

function ensureCharacterShadowTexture() {
  if (characterShadowTexture) return Promise.resolve(characterShadowTexture)
  if (!characterShadowLoad) {
    const profile = stageEffectIndex.value?.characterShadow
    const relativePath = stageEffectIndex.value?.assets?.[profile?.asset]?.file
    if (!relativePath) return Promise.resolve(null)
    const pending = loadImageLayerTexture(relativePath).then(texture => {
      if(stageDisposed || !app) {texture.destroy(true);return null}
      characterShadowTexture = texture
      return texture
    }).catch(error=> {if(characterShadowLoad===pending)characterShadowLoad=null; throw error})
    characterShadowLoad=pending
  }
  return characterShadowLoad
}

async function attachStageShadow(runtime) {
  if(runtime.groundShadow)return
  const texture=await ensureCharacterShadowTexture()
  if(!texture || stageDisposed || runtimes.get(runtime.stagePosition)!==runtime || !cameraContainer || runtime.groundShadow)return
  const shadow=runtime.groundShadow=markRaw(new PIXI.Sprite(texture));shadow.anchor.set(0.5);shadow.alpha=1
  cameraContainer.addChild(shadow)
  runtime.releaseShadowFollower=installCharacterShadowFollower(runtime.spine,()=>syncCharacterShadow(runtime))
  syncCharacterShadow(runtime);if(!playing.value)app?.render()
}

function destroyStageRuntime(runtime) {
  releaseFootLighting(runtime)
  runtime?.releaseShadowFollower?.()
  runtime?.groundShadow?.removeFromParent()
  runtime?.groundShadow?.destroy()
  destroyLiveChibi(runtime)
}

async function handleCharacterChange(slot) {
  const reloadStageVocals = stageVocalEnabled.value
  if (reloadStageVocals) stopStage(true)
  if (handoffLineup.value) handoffLineup.value[slot.position - 1] = slot.characterId
  const character = characterForSlot(slot)
  slot.costumeId = character?.defaultCostume || character?.costumes?.[0]?.id || ''
  await loadSlot(slot)
  if (reloadStageVocals) await loadStageVocalAudio()
}

async function loadSlot(slot) {
  if (playing.value || stageStarting.value) stopStage()
  if (!app || !activePositions.value.includes(slot.position)) return
  const character = characterForSlot(slot)
  const costume = costumeForSlot(slot)
  if (!character || !costume) return

  slotOwners.get(slot.position)?.abort()
  const owner=new AbortController();slotOwners.set(slot.position,owner)
  const sequence = ++slot.loadSequence
  slot.motionSequence += 1
  slot.loading = true
  songMotionsReady.value = false
  const oldRuntime = runtimes.get(slot.position)
  if (oldRuntime) {
    runtimes.delete(slot.position)
    destroyStageRuntime(oldRuntime)
  }

  try {
    const runtime = await createLiveChibi(character,costume,{signal:owner.signal,isCurrent:()=>!stageDisposed && sequence===slot.loadSequence && Boolean(app)})
    if (sequence !== slot.loadSequence || !app) {
      destroyLiveChibi(runtime)
      return
    }
    const stageRuntime = markRaw({
      ...runtime,
      groundShadow:null,
      loadedMotions: new Map(),
      preloadedSongs: new Set(),
      characterId: character.id,
      costumeId: costume.id,
      stagePosition: slot.position,
    })
    runtimes.set(slot.position, stageRuntime)
    void attachStageShadow(stageRuntime).catch(error=> {if(!stageDisposed)console.warn('[ChibiStage] optional shadow unavailable',error)})
    cameraContainer.addChild(stageRuntime.spine)
    slot.loading = false
    resizeStage()
    await syncSlotAtTime(slot, stageTime.value, true)
    applyCurrentLipSync()
    applyStageLighting()
  } catch (error) {
    if (stageDisposed || owner.signal.aborted || sequence !== slot.loadSequence) return
    slot.loading = false
    errorText.value = `${slot.position}号位加载失败：${error.message}`
    console.error('[ChibiStage] slot load failed', slot.position, error)
  }
}

async function rebuildStage() {
  const buildSequence = ++stageBuildSequence
  stopStage()
  booting.value = true
  errorText.value = ''
  songMotionsReady.value = false
  statusText.value = isSpecialSingle.value
    ? '正在准备社长特别演出…'
    : `正在构建 ${activePositions.value.length} 人编队…`

  for (const position of allPositions) {
    const runtime = runtimes.get(position)
    if (runtime) runtime.spine.visible = activePositions.value.includes(position)
  }
  try {
    await Promise.all(activeSlots.value.map(slot => loadSlot(slot)))
    if (buildSequence !== stageBuildSequence) return
    resizeStage()
    await seekStage()
    if (buildSequence !== stageBuildSequence) return
    ensureSpecialStageVisual()
    booting.value = false
  } catch (error) {
    if (buildSequence !== stageBuildSequence) return
    booting.value = false
    errorText.value = error.message
  }
}

function ensureSpecialStageVisual() {
  if (isSpecialSingle.value && ![...objectLayerRuntimes.keys()]
    .some(asset => asset.startsWith('fx_in_drv999_ap_syacho-'))) {
    throw new Error('社长单人剪影素材未能载入。')
  }
}

function sourceSlotForStagePosition(position) {
  return selectedSong.value?.stagePositionMap
    ?.find(item => item.stagePosition === position)?.performerSlot || position
}

function eventsForPosition(position) {
  return performanceEventsByPosition.value.get(position) || []
}

function activeMotionGroupAt(milliseconds) {
  return [...(selectedSong.value?.motionGroupChanges || [])]
    .reverse()
    .find(event => Number(event.time) <= milliseconds)?.group ?? null
}

function weightedGroupMotion(group, milliseconds, position) {
  if (group === null) return null
  const pool = (selectedSong.value?.motionGroupEvents || [])
    .filter(event => event.group === group && Number(event.time) <= milliseconds && Number(event.weight) > 0)
  const totalWeight = pool.reduce((sum, event) => sum + Number(event.weight), 0)
  if (!pool.length || totalWeight <= 0) return null
  const seedText = `${selectedSong.value.id}:${position}:${milliseconds}:${group}`
  let hash = 2166136261
  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  let selection = (hash >>> 0) % totalWeight
  for (const event of pool) {
    selection -= Number(event.weight)
    if (selection < 0) return event
  }
  return pool[pool.length - 1]
}

function positionStateForStage(position, milliseconds) {
  const sourceSlot = sourceSlotForStagePosition(position)
  const events = (selectedSong.value?.positionEvents || [])
    .filter(event => event.position === sourceSlot)
  if (!events.length) return null
  const currentIndex = Math.max(0, events.findLastIndex(event => event.time <= milliseconds))
  const current = events[currentIndex]
  const previous = events[currentIndex - 1]
  if (!previous || milliseconds >= Number(current.time) + POSITION_TWEEN_MS) {
    return { ...current, tweenProgress: 1 }
  }
  const rawProgress = Math.max(0, Math.min(1, (milliseconds - Number(current.time)) / POSITION_TWEEN_MS))
  const progress = rawProgress * rawProgress * (3 - 2 * rawProgress)
  const interpolate = key => Number(previous[key]) + (Number(current[key]) - Number(previous[key])) * progress
  return {
    ...current,
    x: interpolate('x'),
    y: interpolate('y'),
    scale: interpolate('scale'),
    tweenProgress: rawProgress,
  }
}

function positionDebugState(position) {
  const state = positionStateForStage(position, stageTime.value)
  const coordinates = layoutCoordinatesForStage(position, stageTime.value)
  return {
    x: coordinates.x,
    y: coordinates.y,
    scale: state ? Number(state.scale).toFixed(2) : '',
    progress: state ? Number(state.tweenProgress ?? 1).toFixed(3) : '',
  }
}

function layoutCoordinatesForStage(position, milliseconds, motionEvent = null) {
  const positionState = positionStateForStage(position, milliseconds)
  const event = motionEvent || [...eventsForPosition(position)]
    .reverse()
    .find(item => Number(item.time) <= milliseconds)
  const fallbackX = [-460, -230, 0, 230, 460][position - 1]
  return resolveChibiPlacement(positionState, event, fallbackX)
}

function sampleCameraTween(tween, milliseconds) {
  if (!tween) return 0
  if (tween.duration <= 1 || milliseconds >= tween.start + tween.duration) return tween.to
  const raw = Math.max(0, Math.min(1, (milliseconds - tween.start) / tween.duration))
  const eased = 1 - ((1 - raw) ** 3)
  return tween.from + (tween.to - tween.from) * eased
}

function cameraStateAt(milliseconds) {
  const state = {
    zoom: 1,
    x: 0,
    y: 360,
    rotation: 0,
    focusSlot: null,
    stagePosition: null,
    eventTime: '',
  }
  let zoomTween = null
  let xTween = null
  let yTween = null
  let rotationTween = null

  for (const event of (selectedSong.value?.cameraEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    state.zoom = zoomTween ? sampleCameraTween(zoomTween, eventTime) : state.zoom
    state.x = xTween ? sampleCameraTween(xTween, eventTime) : state.x
    state.y = yTween ? sampleCameraTween(yTween, eventTime) : state.y
    state.rotation = rotationTween ? sampleCameraTween(rotationTween, eventTime) : state.rotation

    if (event.reset) {
      // Camera's authored erase command restores the wide shot. Cancel the
      // previous focus/tweens so later shots start from this reset, even on seek.
      const duration = Math.max(0, Number(event.resetDuration) || 0)
      zoomTween = { from: state.zoom, to: 1, start: eventTime, duration }
      xTween = { from: state.x, to: 0, start: eventTime, duration }
      yTween = { from: state.y, to: 360, start: eventTime, duration }
      rotationTween = { from: state.rotation, to: 0, start: eventTime, duration }
      state.focusSlot = null
      state.stagePosition = null
      state.eventTime = eventTime
      continue
    }

    if (event.focusSlot !== null && event.focusSlot !== undefined) {
      state.focusSlot = Number(event.focusSlot) > 0 ? Number(event.focusSlot) : null
      state.stagePosition = state.focusSlot
        ? (event.stagePosition || selectedSong.value?.stagePositionMap
          ?.find(item => item.performerSlot === state.focusSlot)?.stagePosition || null)
        : null
    }
    if (event.zoom !== null && event.zoom !== undefined) {
      zoomTween = {
        from: state.zoom,
        to: Number(event.zoom) / 1000,
        start: eventTime,
        duration: Math.max(0, Number(event.zoomDuration) || 0),
      }
    }
    if (event.x !== null || event.y !== null || event.focusSlot !== null) {
      const focusX = state.stagePosition
        ? layoutCoordinatesForStage(state.stagePosition, eventTime).x
        : 0
      const targetX = state.stagePosition
        ? focusX + Number(event.x ?? 0)
        : Number(event.x ?? state.x)
      // The source uses a character-root coordinate system when focusSlot is set;
      // its Y=0 and free-camera Y=360 both represent the visual stage centre.
      const targetY = state.stagePosition ? 360 : Number(event.y ?? state.y)
      const duration = Math.max(0, Number(event.moveDuration) || 0)
      xTween = { from: state.x, to: targetX, start: eventTime, duration }
      yTween = { from: state.y, to: targetY, start: eventTime, duration }
    }
    if (event.rotation !== null && event.rotation !== undefined) {
      rotationTween = {
        from: state.rotation,
        to: Number(event.rotation),
        start: eventTime,
        duration: Math.max(0, Number(event.rotationDuration) || 0),
      }
    }
    state.eventTime = eventTime
  }

  state.zoom = zoomTween ? sampleCameraTween(zoomTween, milliseconds) : state.zoom
  state.x = xTween ? sampleCameraTween(xTween, milliseconds) : state.x
  state.y = yTween ? sampleCameraTween(yTween, milliseconds) : state.y
  state.rotation = rotationTween ? sampleCameraTween(rotationTween, milliseconds) : state.rotation
  return state
}

function backmonitorStateAt(milliseconds) {
  return chibiBackmonitorStateAt(selectedSong.value?.backmonitorEvents, milliseconds)
}

function parseHexColor(value, fallback = 0xffffff) {
  const match = String(value || '').match(/^#?([0-9a-f]{6})/i)
  return match ? Number.parseInt(match[1], 16) : fallback
}

function mixRgb(from, to, progress) {
  const amount = Math.max(0, Math.min(1, progress))
  const channel = shift => Math.round(
    ((from >> shift) & 0xff) + (((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * amount,
  )
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

function sampleColorTransition(transition, milliseconds) {
  if (!transition) return null
  const progress = transition.duration <= 0
    ? 1
    : Math.max(0, Math.min(1, (milliseconds - transition.start) / transition.duration))
  return {
    color: mixRgb(transition.from.color, transition.to.color, progress),
    alpha: transition.from.alpha + (transition.to.alpha - transition.from.alpha) * progress,
    depth: transition.to.depth,
    eventTime: transition.start,
  }
}

function colorTrackAt(events, milliseconds, initial, targetForEvent) {
  let state = { ...initial }
  let transition = null
  for (const event of events || []) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    if (transition) state = sampleColorTransition(transition, eventTime)
    const target = targetForEvent(event, state)
    transition = {
      from: state,
      to: target,
      start: eventTime,
      duration: Math.max(0, Number(event.duration) || 0),
    }
    state = sampleColorTransition(transition, eventTime)
  }
  return transition ? sampleColorTransition(transition, milliseconds) : state
}

function wholeScreenColorAt(milliseconds) {
  return colorTrackAt(
    selectedSong.value?.wholeScreenColorEvents,
    milliseconds,
    { color: 0x000000, alpha: 0, depth: 1750, eventTime: '' },
    (event, state) => ({
      color: event.hide ? state.color : parseHexColor(event.color, state.color),
      alpha: event.hide ? 0 : Math.max(0, Math.min(1, Number(event.opacity) / 1000)),
      depth: Number(event.depth ?? state.depth),
    }),
  )
}

function lyricAt(milliseconds) {
  const events = selectedSong.value?.lyricEvents || []
  const event = [...events].reverse().find(item => Number(item.time) <= milliseconds)
  if (!event || milliseconds >= Number(event.time) + Number(event.duration || 0)) return null
  return event
}

function layoutStageBackground() {
  if (!app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const sprite of [stageBackgroundSprite, ...[...stageBackgroundParts.values()].map(part => part.sprite), wholeScreenColorOverlay, ...colorPlaneOverlays.values()]) {
    if (!sprite) continue
    sprite.position.set(width * 0.5, height * 0.5)
    sprite.scale.set(viewportScale * environmentScale.value)
  }
  if (stageBackgroundSprite) stageBackgroundSprite.visible = staticStageEnabled.value
  for (const part of stageBackgroundParts.values()) part.sprite.visible = staticStageEnabled.value
}

function releaseStageBackground() {
  spotlightBackgroundSprites.release()
  spotlightBackgroundAlpha.value = 0
  pinspotlightMaskCount.value = 0
  stageBackgroundSequence += 1
  stageBackgroundSprite?.removeFromParent()
  stageBackgroundSprite?.destroy()
  stageBackgroundTexture?.destroy(true)
  stageBackgroundSprite = null
  stageBackgroundTexture = null
  for (const part of stageBackgroundParts.values()) {
    part.sprite.removeFromParent()
    part.sprite.destroy()
    part.texture.destroy(true)
  }
  stageBackgroundParts.clear()
  backgroundComponentCount.value = 0
  backgroundTintConflict.value = false
  stageBackgroundSongId.value = ''
  stageBackgroundReady.value = false
}

async function syncStageBackground() {
  if (!cameraContainer || !selectedSong.value || !stageBackgroundIndex.value) return
  const songCode = selectedSong.value.songCode
  if (stageBackgroundSongId.value === songCode && (stageBackgroundSprite || stageBackgroundParts.size)) {
    layoutStageBackground()
    return
  }
  releaseStageBackground()
  stageBackgroundSongId.value = songCode
  const entry = stageBackgroundIndex.value.songs?.[songCode]
  if (!entry) return
  const sequence = stageBackgroundSequence
  const components = stageBackgroundIndex.value.components
  const componentLayers = components?.songs?.[songCode]?.layers
  if (componentLayers?.length && componentLayers.join(',') === entry.layers.join(',')
      && componentLayers.every(asset => components.assets?.[asset])) {
    const results = await Promise.allSettled(componentLayers.map(async asset => ({
      asset, texture: await loadImageLayerTexture(components.assets[asset].file),
    })))
    const loaded = results.filter(result => result.status === 'fulfilled').map(result => result.value)
    if (sequence !== stageBackgroundSequence || selectedSong.value?.songCode !== songCode) {
      for (const part of loaded) part.texture.destroy(true)
      return
    }
    if (loaded.length === componentLayers.length) {
      for (const [index, part] of loaded.entries()) {
        const sprite = markRaw(new PIXI.Sprite(part.texture))
        sprite.anchor.set(0.5)
        sprite.zIndex = -20000 + index
        sprite.visible = staticStageEnabled.value
        cameraContainer.addChild(sprite)
        stageBackgroundParts.set(part.asset, { texture: part.texture, sprite })
      }
      backgroundComponentCount.value = loaded.length
      stageBackgroundReady.value = true
      layoutStageBackground()
      applyImageColors()
      return
    }
    for (const part of loaded) part.texture.destroy(true)
    console.warn('[ChibiStage] background component load failed; using original composite')
  }
  const texture = await loadImageLayerTexture(entry.file)
  if (sequence !== stageBackgroundSequence || selectedSong.value?.songCode !== songCode) {
    texture.destroy(true)
    return
  }
  stageBackgroundTexture = texture
  stageBackgroundSprite = markRaw(new PIXI.Sprite(texture))
  stageBackgroundSprite.anchor.set(0.5)
  stageBackgroundSprite.zIndex = -20000
  stageBackgroundSprite.visible = staticStageEnabled.value
  cameraContainer.addChild(stageBackgroundSprite)
  stageBackgroundReady.value = true
  layoutStageBackground()
  applyImageColors()
}

function applyImageColors() {
  const colors = lightingEnabled.value ? currentImageColors.value : new Map()
  const applied = new Map()
  backgroundTintConflict.value = false
  if (stageBackgroundSprite) {
    const entry = stageBackgroundIndex.value?.songs?.[selectedSong.value?.songCode]
    const tint = compositeImageTint(entry?.layers, colors)
    stageBackgroundSprite.tint = tint.color
    backgroundTintConflict.value = !tint.uniform
    if (tint.uniform) for (const layer of tint.layers) applied.set(layer.asset, tint.color)
  }
  for (const [asset, part] of stageBackgroundParts) {
    part.sprite.tint = colors.get(asset) ?? 0xffffff
    applied.set(asset, part.sprite.tint)
  }
  for (const runtime of imageLayerRuntimes.values()) {
    runtime.sprite.tint = colors.get(runtime.state.asset) ?? 0xffffff
    if (runtime.sprite.visible) applied.set(runtime.state.asset, runtime.sprite.tint)
  }
  appliedImageColors.value = [...applied].sort(([a], [b]) => a.localeCompare(b))
    .map(([asset, tint]) => `${asset}:#${tint.toString(16).padStart(6, '0')}`).join(',')
}

function ensureWholeScreenColorOverlay() {
  if (wholeScreenColorOverlay || !cameraContainer) return
  wholeScreenColorOverlay = markRaw(new PIXI.Graphics())
  wholeScreenColorOverlay.beginFill(0xffffff)
  wholeScreenColorOverlay.drawRect(-950, -530, 1900, 1060)
  wholeScreenColorOverlay.endFill()
  wholeScreenColorOverlay.visible = false
  cameraContainer.addChild(wholeScreenColorOverlay)
  layoutStageBackground()
}

function applyStageLighting() {
  syncStagelights()
  syncSuspensionlights()
  syncOldSuspensionlights()
  syncSpotlightBackground()
  ensureWholeScreenColorOverlay()
  applyImageColors()
  // Independent color planes share the authored camera/depth space.
  // Sampling rebuilds state on seek; no second clock or previous-song state.
  const planes = currentColorPlanes.value
  for (const [id, overlay] of colorPlaneOverlays) {
    if (planes.has(id)) continue
    overlay.removeFromParent()
    overlay.destroy()
    colorPlaneOverlays.delete(id)
  }
  if (cameraContainer) for (const [id, state] of planes) {
    let overlay = colorPlaneOverlays.get(id)
    if (!overlay) {
      overlay = markRaw(new PIXI.Graphics())
      overlay.beginFill(0xffffff).drawRect(-950, -530, 1900, 1060).endFill()
      cameraContainer.addChild(overlay)
      colorPlaneOverlays.set(id, overlay)
      layoutStageBackground()
    }
    overlay.tint = state.color
    overlay.alpha = state.alpha
    overlay.zIndex = state.depth
    overlay.visible = lightingEnabled.value && state.alpha > 0.001
  }
  if (!lightingEnabled.value) {
    if (wholeScreenColorOverlay) wholeScreenColorOverlay.visible = false
    for (const runtime of runtimes.values()) {
      runtime.spine.tint = 0xffffff
      syncFootLighting(PIXI,runtime,{rgb:[0,0,0],height:0},false)
    }
    if (!playing.value || inspectorOpen.value) appliedBodyColors.value = ''
    return
  }
  const screen = currentWholeScreenColor.value
  if (wholeScreenColorOverlay) {
    wholeScreenColorOverlay.tint = screen.color
    wholeScreenColorOverlay.alpha = screen.alpha
    wholeScreenColorOverlay.zIndex = screen.depth
    wholeScreenColorOverlay.visible = screen.alpha > 0.001
  }
  // Foot_Color is a local height replacement gradient. It must never dim
  // the entire face/body; body tint remains a separate addressed command.
  const character = { color: 0xffffff }
  const foot = currentFootLighting.value
  const spotlightStates = [...spotlightStatesAt(stageTime.value).values()]
    .filter(state => state.alpha > 0.001 && state.beamColor)
  const spotlightPositions = new Set(
    spotlightStates
      .filter(state => state.stagePosition)
      .map(state => Number(state.stagePosition)),
  )
  const spotlightEnvironment = spotlightStates.findLast?.(state => state.environmentColor)
    || [...spotlightStates].reverse().find(state => state.environmentColor)
  const spotlightDim = spotlightEnvironment
    ? Math.max(0, Math.min(1, Number(spotlightEnvironment.environmentOpacity || 0) / 1000))
    : 0
  const spotlightDimColor = parseHexColor(spotlightEnvironment?.environmentColor, 0x221d23)
  const pinspotlightStates = [...pinspotlightStatesAt(stageTime.value).values()]
    .filter(state => state.alpha > 0.001 && state.asset)
  const pinspotlightPositions = new Set(pinspotlightStates
    .filter(state => state.stagePosition)
    .map(state => Number(state.stagePosition)))
  const pinspotlightEnvironment = pinspotlightStates.findLast?.(state => state.environmentColor)
    || [...pinspotlightStates].reverse().find(state => state.environmentColor)
  const pinspotlightDim = pinspotlightEnvironment
    ? Math.max(0, Math.min(1, Number(pinspotlightEnvironment.environmentOpacity || 0) / 1000))
    : 0
  const pinspotlightDimColor = parseHexColor(
    pinspotlightEnvironment?.environmentColor,
    0x221d23,
  )
  for (const [position, runtime] of runtimes) {
    // A targeted performer is lit independently from the environment wash.
    // Mixing back toward white reproduces that separation without making the
    // Spine itself translucent beneath the foreground beam sprite.
    if (pinspotlightPositions.size > 0) {
      runtime.spine.tint = pinspotlightPositions.has(position)
        ? mixRgb(character.color, 0xffffff, 0.5)
        : mixRgb(character.color, pinspotlightDimColor, pinspotlightDim)
    } else {
      runtime.spine.tint = spotlightPositions.has(position)
        ? mixRgb(character.color, 0xffffff, 0.5)
        : spotlightPositions.size > 0
          ? mixRgb(character.color, spotlightDimColor, spotlightDim)
          : character.color
    }
    runtime.spine.tint = multiplyBodyTint(runtime.spine.tint, currentBodyColors.value.get(position))
    syncFootLighting(PIXI,runtime,foot,true)
  }
  if (!playing.value || inspectorOpen.value) appliedBodyColors.value = [...runtimes].filter(([position]) => activePositions.value.includes(position))
    .map(([position, runtime]) =>
    `${position}:#${runtime.spine.tint.toString(16).padStart(6, '0')}`).join(',')
}

function syncSpotlightBackground() {
  spotlightBackgroundAlpha.value = 0
  pinspotlightMaskCount.value = 0
  const existing = spotlightBackgroundSprites.runtimes.get('background')
  if (existing) existing.sprite.visible = false
  if (!app || !cameraContainer) return
  const pins = pinspotlightStatesAt(stageTime.value)
  const state = sampleSpotlightBackground(spotlightStatesAt(stageTime.value), pins, lightingEnabled.value)
  if (!state || state.alpha <= 0.001) return
  const activePins = [...pins.values()].filter(pin => pin.alpha > 0.001 && pin.asset)
  const filters = []
  const model = stageEffectIndex.value?.pinspotlight
  // Never publish a solid background while the required native masks load.
  for (const pin of activePins) {
    const desired = pinspotlightModelForAsset(model, stageEffectIndex.value?.assets, pin.asset)
    if (!desired) return
    const mask = pinspotlightRuntimes.get(`${pin.id}:${desired.layers[0].asset}`)
    if (!mask?.maskSprite.visible) return
    const order = stageEffectIndex.value?.spotlightBackground?.layers[0]?.sortingOrder ?? 1900
    if (order >= model.sortingInterval[0] && order <= model.sortingInterval[1]) filters.push(mask.filter)
  }
  const runtime = spotlightBackgroundSprites.ensure('background',
    stageEffectIndex.value?.spotlightBackground, stageEffectIndex.value?.assets)
  if (!runtime) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const fit = Math.min(width / 1280, height / 720) * environmentScale.value
  runtime.sprite.position.set(width * 0.5, height * 0.5)
  runtime.sprite.scale.set(runtime.layer.scaleX * fit, runtime.layer.scaleY * fit)
  runtime.sprite.tint = parseHexColor(state.color, 0x221d23)
  runtime.sprite.alpha = state.alpha
  runtime.sprite.filters = filters.length ? filters : null
  runtime.sprite.filterArea = new PIXI.Rectangle(0, 0, width, height)
  runtime.sprite.visible = true
  spotlightBackgroundAlpha.value = state.alpha
  pinspotlightMaskCount.value = filters.length
}

function spotlightStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.spotlightEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = states.get(event.id)
    if (event.hide) {
      if (!previous) continue
      states.set(event.id, {
        ...previous,
        fadeStart: eventTime,
        fadeDuration: Math.max(0, Number(event.duration) || 0),
      })
      continue
    }
    states.set(event.id, {
      ...event,
      alpha: 1,
      fadeStart: null,
      fadeDuration: 0,
    })
  }
  for (const state of states.values()) {
    if (state.fadeStart === null) continue
    state.alpha = state.fadeDuration <= 0
      ? 0
      : Math.max(0, 1 - (milliseconds - state.fadeStart) / state.fadeDuration)
  }
  return states
}

function createSpotlightRuntime(id, layers, textures) {
  const container = markRaw(new PIXI.Container())
  const sprites = layers.map((layer, index) => {
    const sprite = markRaw(new PIXI.Sprite(textures[index]))
    sprite.anchor.set(layer.anchorX, layer.anchorY)
    sprite.position.set(layer.x, layer.y)
    sprite.scale.set(layer.scaleX, layer.scaleY)
    sprite.blendMode = PIXI.BLEND_MODES.ADD
    container.addChild(sprite)
    return sprite
  })
  cameraContainer.addChild(container)
  return markRaw({ id, container, sprites })
}

function spotlightTargetAt(state, milliseconds) {
  const position = Number(state.stagePosition)
  // A zero/unbound target has no resolved performer position. The CSV does
  // not provide the free Y coordinate previously invented here as 180.
  // Keep its environment state, but do not draw a phantom pool at centre stage.
  if (!Number.isInteger(position) || position <= 0) return null
  const target = layoutCoordinatesForStage(position, milliseconds)
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return null
  return target
}

function syncSpotlights() {
  if (!app || !cameraContainer) return
  const states = spotlightStatesAt(stageTime.value)
  const active = beamEffectsEnabled.value
    ? [...states.values()].filter(state => state.alpha > 0.001 && state.beamColor)
    : []
  unresolvedSpotlightIds.value = []
  visibleSpotlightIds.value = []
  for (const runtime of spotlightRuntimes.values()) runtime.container.visible = false
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const state of active) {
    const target = spotlightTargetAt(state, stageTime.value)
    if (!target) {
      unresolvedSpotlightIds.value.push(state.id)
      continue
    }
    const runtime = spotlightSprites.ensure(state.id, stageEffectIndex.value?.spotlight, stageEffectIndex.value?.assets)
    if (!runtime) continue
    const { x: targetX, y: targetY } = projectChibiGround(selectedSong.value?.songCode, target, width, height)
    runtime.container.position.set(targetX, targetY)
    runtime.container.scale.set(viewportScale)
    runtime.container.zIndex = Number(state.depth) || 1800
    runtime.container.alpha = Math.max(0, Math.min(1, state.alpha))
    runtime.container.visible = true
    visibleSpotlightIds.value.push(state.id)
    for (const sprite of runtime.sprites) sprite.tint = parseHexColor(state.beamColor, 0xffffff)
  }
  visibleSpotlightIds.value.sort((a, b) => a - b)
  unresolvedSpotlightIds.value.sort((a, b) => a - b)
  visibleSpotlightCount.value = visibleSpotlightIds.value.length
}

function syncStagelights() {
  if (!app || !cameraContainer) return
  const code = selectedSong.value?.songCode || ''
  if (stagelightSongId !== code) {
    stagelightSprites.release()
    stagelightSongId = code
  }
  visibleStagelightCount.value = 0
  appliedStagelightColors.value = ''
  for (const runtime of stagelightSprites.runtimes.values()) runtime.container.visible = false
  if (!lightingEnabled.value) return
  const track = stageEffectIndex.value?.stagelightSongs?.[code]
  if (!track) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const fit = Math.min(width / 1280, height / 720) * environmentScale.value
  const colors = []
  for (const state of stagelightStatesAt(track.events, stageTime.value).values()) {
    const model = stageEffectIndex.value.stagelights?.[state.asset]
    if (!model || state.previewSupported === false || (state.hideTime !== undefined && stageTime.value >= state.hideTime + (state.fadeDuration || 1))) continue
    // Asset belongs in the runtime key: reused lamp IDs must not reuse another prefab.
    const runtime = stagelightSprites.ensure(`${code}:${state.id}:${state.asset}`, model, stageEffectIndex.value.assets)
    if (!runtime) continue
    runtime.container.position.set(width * .5, height * .5)
    runtime.container.scale.set(fit)
    runtime.container.zIndex = state.depth ?? 1600
    runtime.container.visible = true
    for (const [index, sprite] of runtime.sprites.entries()) {
      const lamp = applyNativeLampColor(sampleStagelight(state, stageTime.value, index, runtime.sprites.length),model.layers[index])
      sprite.tint = lamp.color
      sprite.alpha = lamp.alpha
    }
    visibleStagelightCount.value += 1
    colors.push(`${state.id}:#${runtime.sprites[0].tint.toString(16).padStart(6, '0')}`)
  }
  appliedStagelightColors.value = colors.join(',')
}

function syncSuspensionlights() {
  if (!app || !cameraContainer) return
  const songId = selectedSong.value?.id || ''
  const descriptor = stageEffectIndex.value?.newSuspensionlightSongs?.[songId]
  const key = `${songId}:${descriptor?.file || ''}`
  if (suspensionTrackKey !== key) {
    suspensionSprites.release()
    suspensionAbort?.abort()
    suspensionTrack = null
    suspensionTrackKey = key
    if (descriptor?.file) {
      const abort = new AbortController()
      suspensionAbort = abort
      fetch(`${LIVE_CHIBI_BASE}/${descriptor.file}`, { signal: abort.signal })
        .then(response => {
          if (!response.ok) throw new Error(`Suspension track HTTP ${response.status}`)
          return response.json()
        }).then(track => {
          if (stageDisposed || abort.signal.aborted || suspensionTrackKey !== key) return
          suspensionTrack = track
          syncSuspensionlights()
        }).catch(error => {
          if (!abort.signal.aborted) console.warn('[ChibiStage] suspension track load failed', error)
        })
    }
  }
  visibleSuspensionlightIds.value = []
  for (const runtime of suspensionSprites.runtimes.values()) runtime.sprite.visible = false
  if (!beamEffectsEnabled.value) return
  const track = suspensionTrack
  const model = stageEffectIndex.value?.newSuspensionlight
  if (!track || !model) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  for (const state of newSuspensionlightsAt(track.events, stageTime.value)) {
    if (state.alpha <= .001 || state.asset !== model.layers[0].asset) continue
    const runtime = suspensionSprites.ensure(`${songId}:${state.id}`, model, stageEffectIndex.value.assets)
    if (!runtime) continue
    const layout = suspensionlightLayout(state, width, height, environmentScale.value)
    runtime.sprite.position.set(layout.x, layout.y)
    runtime.sprite.scale.set(layout.scaleX, layout.scaleY)
    runtime.sprite.rotation = layout.rotation
    runtime.sprite.alpha = state.alpha
    runtime.sprite.tint = parseHexColor(state.color)
    runtime.sprite.zIndex = state.depth
    runtime.sprite.visible = true
    visibleSuspensionlightIds.value.push(state.id)
  }
  visibleSuspensionlightIds.value.sort((a, b) => a - b)
}

function syncOldSuspensionlights() {
  if (!app || !cameraContainer) return
  const songId = selectedSong.value?.id || ''
  const descriptor = stageEffectIndex.value?.oldSuspensionlightSongs?.[songId]
  const key = `${songId}:${descriptor?.previewEnabled ? descriptor.file : ''}`
  if (oldSuspensionTrackKey !== key) {
    oldSuspensionSprites.release()
    oldSuspensionAbort?.abort()
    oldSuspensionTrack = null
    oldSuspensionTrackKey = key
    if (descriptor?.previewEnabled && descriptor.file) {
      const abort = new AbortController()
      oldSuspensionAbort = abort
      fetch(`${LIVE_CHIBI_BASE}/${descriptor.file}`, { signal: abort.signal })
        .then(response => {
          if (!response.ok) throw new Error(`Old sidelight track HTTP ${response.status}`)
          return response.json()
        }).then(track => {
          if (stageDisposed || abort.signal.aborted || oldSuspensionTrackKey !== key) return
          oldSuspensionTrack = track
          syncOldSuspensionlights()
        }).catch(error => {
          if (!abort.signal.aborted) console.warn('[ChibiStage] old sidelight track load failed', error)
        })
    }
  }
  visibleOldSuspensionlightIds.value = []
  for (const runtime of oldSuspensionSprites.runtimes.values()) runtime.sprite.visible = false
  if (!beamEffectsEnabled.value || !oldSuspensionTrack) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  for (const state of oldSuspensionlightsAt(oldSuspensionTrack.events, stageTime.value,
    stageEffectIndex.value?.oldSuspensionlight,descriptor)) {
    if (state.alpha <= .001) continue
    const runtime = oldSuspensionSprites.ensure(`${songId}:${state.key}`,state.model,stageEffectIndex.value.assets)
    if (!runtime) continue
    const layout = oldSuspensionlightLayout(state,width,height,environmentScale.value)
    runtime.sprite.position.set(layout.x,layout.y)
    runtime.sprite.scale.set(layout.scaleX,layout.scaleY)
    runtime.sprite.rotation = layout.rotation
    runtime.sprite.alpha = state.alpha
    runtime.sprite.tint = parseHexColor(state.color)
    runtime.sprite.zIndex = state.depth
    runtime.sprite.visible = true
    visibleOldSuspensionlightIds.value.push(state.key)
  }
}

function releaseSpotlights() {
  spotlightSprites.release()
  visibleSpotlightCount.value = 0
  visibleSpotlightIds.value = []
  unresolvedSpotlightIds.value = []
}

function laserlightStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.laserlightEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = states.get(event.id)
    if (event.hide) {
      if (!previous) continue
      states.set(event.id, {
        ...previous,
        fadeStart: eventTime,
        fadeDuration: Math.max(0, Number(event.duration) || 0),
      })
      continue
    }
    const next = { ...(previous || {}) }
    for (const [key, value] of Object.entries(event)) {
      if (value !== null && value !== undefined && value !== '') next[key] = value
    }
    states.set(event.id, {
      ...next,
      alpha: 1,
      eventTime,
      fadeStart: null,
      fadeDuration: 0,
    })
  }
  for (const state of states.values()) {
    if (state.fadeStart === null) continue
    state.alpha = state.fadeDuration <= 0
      ? 0
      : Math.max(0, 1 - (milliseconds - state.fadeStart) / state.fadeDuration)
  }
  return states
}

function laserSweepAngle(state, milliseconds) {
  const base = Number(state.angle) || 0
  const period = Math.max(1, Number(state.sweepDuration) || 1000)
  const phase = Math.max(0, milliseconds - Number(state.eventTime || state.time || 0)) / period
  const direction = state.direction === 'left' ? -1 : 1
  const style = Number(state.style) || 7
  if (style === 6) return base + direction * phase * 360
  const amplitudes = { 1: 8, 3: 10, 4: 10, 5: 14, 7: 20, 8: 42, 9: 42 }
  const cycle = (phase + (style === 9 ? 1 : 0)) % 2
  const triangle = cycle <= 1 ? cycle : 2 - cycle
  let angle = base + direction * (amplitudes[style] || 20) * triangle
  // The source comments call style 3 "カクカクのやつ": the fixture turns
  // in discrete steps rather than interpolating continuously.
  if (style === 3) angle = Math.round(angle / 5) * 5
  return angle
}

function createLaserlightRuntime(id) {
  const graphics = markRaw(new PIXI.Graphics())
  graphics.blendMode = PIXI.BLEND_MODES.ADD
  cameraContainer.addChild(graphics)
  const runtime = markRaw({ id, graphics })
  laserlightRuntimes.set(id, runtime)
  return runtime
}

function laserBeamOffsets(style) {
  // data.unity3d / LiveObjectLaserlight stores nine prefab references.
  // The dominant style 3 prefab contains four particle systems at
  // 0 / +20 / -20 / 0 degrees. Style 7 contains paired forward/reverse
  // systems. Preserve those authored beam groups instead of reducing every
  // CSV event to one line.
  if (style === 1) return [0, 5, -5]
  if (style === 3 || style === 4) return [0, 20, -20, 0]
  if (style === 5 || style === 6) return [0.5, 1.5, 179.5, 178.5]
  if (style === 7) return [0, 180, 0, 180]
  return [0]
}

function drawLaserlight(runtime, state, viewportScale) {
  const graphics = runtime.graphics
  const length = Math.max(1, Number(state.length) || 900)
    * viewportScale * environmentScale.value
  const width = Math.max(0.2, (Number(state.width) || 1000) / 1000)
  const color = parseHexColor(state.color, 0xffffff)
  const style = Number(state.style) || 7
  const intensity = style === 9 ? 0.55 : 1
  const offsets = laserBeamOffsets(style)
  const duplicateAttenuation = offsets.length >= 4 ? 0.72 : 1
  graphics.clear()
  const drawPass = (lineWidth, lineColor, alpha) => {
    graphics.lineStyle(lineWidth, lineColor, alpha * intensity * duplicateAttenuation)
    for (const offset of offsets) {
      const radians = offset * Math.PI / 180
      graphics.moveTo(0, 0)
      graphics.lineTo(Math.cos(radians) * length, Math.sin(radians) * length)
    }
  }
  drawPass(18 * width * viewportScale, color, 0.08)
  drawPass(7 * width * viewportScale, color, 0.24)
  drawPass(1.25 * width * viewportScale, 0xffffff, 0.82)
}

function syncLaserlights() {
  if (!app || !cameraContainer) return
  const songId = selectedSong.value?.id || ''
  if (laserParticleSongId !== songId) {
    laserParticleSprites.release()
    laserParticleSongId = songId
  }
  const states = laserlightStatesAt(stageTime.value)
  const active = beamEffectsEnabled.value
    ? [...states.values()].filter(state => (
      state.alpha > 0.001 && state.style && state.color
    ))
    : []
  visibleLaserlightCount.value = active.length
  visibleLaserlightIds.value = active.map(state => state.id).sort((a, b) => a - b)
  for (const [id, runtime] of laserlightRuntimes) {
    runtime.graphics.visible = false
  }
  for (const runtime of laserParticleSprites.runtimes.values()) runtime.container.visible = false
  visibleLaserParticleCount.value = 0
  const origins = []
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const state of active) {
    const native = stageEffectIndex.value?.laserlight?.styles?.[state.style]
      || stageEffectIndex.value?.spotbeam?.styles?.[state.style]
      || stageEffectIndex.value?.turnlaser?.styles?.[state.style]
    if (native) {
      const spotbeam = native.kind === 'spotbeam'
      const runtime = laserParticleSprites.ensure(`${songId}:${state.id}:${state.style}`,
        { layers: [{ asset: native.systems[0].asset, frames: spotbeam ? 2 : 1 }] }, stageEffectIndex.value.assets)
      if (!runtime) continue
      const layout = laserParticleLayout(state,width,height,environmentScale.value)
      const particles = (spotbeam ? sampleSpotbeamParticles : sampleLaserParticles)(native,state,stageTime.value)
      runtime.container.position.set(layout.x,layout.y)
      const scale = spotbeam ? spotbeamParticleScale(state) : { x: 1, y: 1 }
      runtime.container.scale.set(scale.x,scale.y)
      runtime.container.rotation = spotbeam ? -Number(state.angle)*Math.PI/180 : 0
      runtime.container.zIndex = Number(state.depth) || 1650
      runtime.container.visible = true
      for (let i = 0; i < Math.max(particles.length,runtime.sprites.length); i++) {
        const sample = particles[i]
        let sprite = runtime.sprites[i]
        if (!sprite && sample) {
          sprite = markRaw(new PIXI.Sprite(runtime.texture))
          sprite.blendMode = PIXI.BLEND_MODES.ADD
          runtime.container.addChild(sprite)
          runtime.sprites.push(sprite)
        }
        if (!sprite) continue
        sprite.visible = Boolean(sample && sample.alpha > .001)
        if (!sample) continue
        if (spotbeam) sprite.texture = runtime.frames[sample.frame]
        sprite.position.set((sample.x || 0) * layout.fit,(sample.y || 0) * layout.fit)
        sprite.anchor.set(sample.anchorX,sample.anchorY)
        sprite.width = sample.width * layout.fit
        sprite.height = sample.length * layout.fit
        sprite.rotation = sample.rotation
        sprite.alpha = sample.alpha
        sprite.tint = sample.color
        if (sprite.visible) visibleLaserParticleCount.value++
      }
      origins.push(`${state.id}:${layout.x.toFixed(1)},${layout.y.toFixed(1)}`)
      continue
    }
    const runtime = laserlightRuntimes.get(state.id) || createLaserlightRuntime(state.id)
    drawLaserlight(runtime, state, viewportScale)
    runtime.graphics.position.set(
      width * 0.5 - Number(state.x) * viewportScale * environmentScale.value,
      height * 0.5 + (360 - Number(state.y)) * viewportScale * environmentScale.value,
    )
    // Laserlight's effect-space X axis is opposite the character/ObjectLayer
    // stage axis. Unity's Y-up angle then maps to the screen by negating it:
    // 280/260 degree top fixtures point down and inward, while 110/70 degree
    // floor fixtures point up and outward.
    runtime.graphics.rotation = -laserSweepAngle(state, stageTime.value) * Math.PI / 180
    runtime.graphics.zIndex = Number(state.depth) || 1650
    runtime.graphics.alpha = Math.max(0, Math.min(1, Number(state.alpha) || 0))
    runtime.graphics.visible = true
  }
  laserParticleOrigins.value = origins.join(';')
}

function releaseLaserlights() {
  laserParticleSprites.release()
  visibleLaserParticleCount.value = 0
  laserParticleOrigins.value = ''
  for (const runtime of laserlightRuntimes.values()) {
    runtime.graphics.removeFromParent()
    runtime.graphics.destroy()
  }
  laserlightRuntimes.clear()
  visibleLaserlightCount.value = 0
  visibleLaserlightIds.value = []
}

function samplePinspotlightState(state, milliseconds) {
  if (!state) return null
  const duration = Math.max(0, Number(state.tweenDuration) || 0)
  const progress = duration <= 0
    ? 1
    : Math.max(0, Math.min(1, (milliseconds - state.tweenStart) / duration))
  const result = {
    ...state,
    x: state.fromX + (state.toX - state.fromX) * progress,
    y: state.fromY + (state.toY - state.fromY) * progress,
  }
  if (state.fadeStart !== null) {
    result.alpha = state.fadeDuration <= 0
      ? 0
      : Math.max(0, 1 - (milliseconds - state.fadeStart) / state.fadeDuration)
  }
  return result
}

function pinspotlightStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.pinspotlightEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = samplePinspotlightState(states.get(event.id), eventTime)
    if (event.hide) {
      if (!previous) continue
      states.set(event.id, {
        ...previous,
        fadeStart: eventTime,
        fadeDuration: Math.max(0, Number(event.duration) || 0),
      })
      continue
    }
    const next = { ...(previous || {}) }
    for (const [key, value] of Object.entries(event)) {
      if (value !== null && value !== undefined && value !== '') next[key] = value
    }
    const fromX = Number(previous?.x ?? event.x ?? 0)
    const fromY = Number(previous?.y ?? event.y ?? 0)
    states.set(event.id, {
      ...next,
      alpha: 1,
      tweenStart: eventTime,
      tweenDuration: Math.max(0, Number(event.duration) || 0),
      fromX,
      fromY,
      toX: Number(event.x ?? fromX),
      toY: Number(event.y ?? fromY),
      fadeStart: null,
      fadeDuration: 0,
    })
  }
  for (const [id, state] of states) {
    states.set(id, samplePinspotlightState(state, milliseconds))
  }
  return states
}

async function syncPinspotlights() {
  if (!app || !cameraContainer) return
  const states = pinspotlightStatesAt(stageTime.value)
  visiblePinspotlightCount.value = 0
  visiblePinspotlightIds.value = []
  for (const runtime of pinspotlightRuntimes.values()) {
    runtime.sprite.visible = false
    runtime.maskSprite.visible = false
  }
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const state of states.values()) {
    if (state.alpha <= 0.001 || !state.asset || (!lightingEnabled.value && !beamEffectsEnabled.value)) continue
    const model = pinspotlightModelForAsset(stageEffectIndex.value?.pinspotlight, stageEffectIndex.value?.assets, state.asset)
    if (!model) continue
    const key = `${state.id}:${model.layers[0].asset}`
    const runtime = pinspotlightSprites.ensure(key, model, stageEffectIndex.value?.assets)
    if (!runtime) continue
    let x, y, scale
    if (state.stagePosition) {
      const target = layoutCoordinatesForStage(Number(state.stagePosition), stageTime.value)
      const ground = projectChibiGround(selectedSong.value?.songCode, target, width, height)
      x = ground.x
      y = ground.y - 135 * viewportScale
      scale = viewportScale * 0.62
    } else {
      x = width * 0.5 + Number(state.x || 0) * viewportScale * environmentScale.value
      y = height * 0.5 + (360 - Number(state.y || 0)) * viewportScale * environmentScale.value
      scale = viewportScale * environmentScale.value * 0.7
    }
    for (const sprite of [runtime.maskSprite, runtime.sprite]) {
      sprite.position.set(x, y)
      sprite.scale.set(scale)
      sprite.alpha = Math.max(0, Math.min(1, state.alpha))
      sprite.zIndex = (Number(state.depth) || 1850) + 1
    }
    // Missing colour keeps the serialized flash default; masks stay black.
    runtime.sprite.tint = parseHexColor(state.beamColor, model.layers[1].initialColor)
    runtime.maskSprite.visible = lightingEnabled.value
    runtime.sprite.visible = beamEffectsEnabled.value
    if (runtime.sprite.visible) visiblePinspotlightIds.value.push(state.id)
  }
  visiblePinspotlightIds.value.sort((a, b) => a - b)
  visiblePinspotlightCount.value = visiblePinspotlightIds.value.length
  syncSpotlightBackground()
}

function releasePinspotlights() {
  const background = spotlightBackgroundSprites.runtimes.get('background')
  if (background) background.sprite.filters = null
  pinspotlightSprites.release()
  pinspotlightMaskCount.value = 0
  visiblePinspotlightCount.value = 0
  visiblePinspotlightIds.value = []
}

function imageLayerStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.imageLayerEvents || [])) {
    if (Number(event.time) > milliseconds) break
    const previous = states.get(event.asset) || {
      asset: event.asset,
      depth: 0,
      layerType: event.layerType,
      visible: false,
    }
    states.set(event.asset, {
      ...previous,
      depth: event.depth ?? previous.depth,
      layerType: event.layerType || previous.layerType,
      visible: !event.hide,
      eventTime: Number(event.time),
    })
  }
  for (const [id, state] of imageObjectsAt(imageObjectIndex.value?.songs?.[selectedSong.value?.id]?.events, milliseconds)) {
    states.set(`imageObject:${id}:${state.asset}`, {
      ...state, imageObject: true, visible: state.alpha > 0,
    })
  }
  return states
}

function loadImageLayerTexture(relativePath, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    let timer
    const fail = () => {
      clearTimeout(timer)
      image.onload = image.onerror = null
      image.src = ''
      reject(new Error(`舞台图片加载失败：${relativePath}`))
    }
    image.onload = () => {
      clearTimeout(timer)
      resolve(new PIXI.Texture(new PIXI.BaseTexture(image)))
    }
    image.onerror = fail
    if (timeoutMs) timer = setTimeout(fail, timeoutMs)
    image.src = `${LIVE_CHIBI_BASE}/${relativePath}`
  })
}

function layoutImageLayers() {
  if (!app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const runtime of imageLayerRuntimes.values()) {
    if (runtime.state?.imageObject) {
      const layout = imageObjectLayout(runtime.state, width, height, environmentScale.value)
      runtime.sprite.position.set(layout.x, layout.y)
      runtime.sprite.scale.set(layout.scaleX, layout.scaleY)
      runtime.sprite.rotation = layout.rotation
      continue
    }
    runtime.sprite.position.set(width * 0.5, height * 0.5)
    runtime.sprite.scale.set(viewportScale * environmentScale.value)
  }
}

function releaseImageLayers() {
  imageLayerSequence += 1
  for (const load of imageLayerLoads.values()) {
    load.then(texture => texture.destroy(true)).catch(() => {})
  }
  imageLayerLoads.clear()
  for (const runtime of imageLayerRuntimes.values()) {
    runtime.sprite.removeFromParent()
    runtime.sprite.destroy()
    runtime.texture.destroy(true)
  }
  imageLayerRuntimes.clear()
  imageLayerSongId = ''
  visibleImageLayerCount.value = 0
  visibleImageLayerAssets.value = []
  visibleImageLayerDepths.value = []
  visibleImageObjectCount.value = 0
  visibleImageObjectAssets.value = []
}

async function syncImageLayers() {
  if (!cameraContainer || !selectedSong.value || (!imageLayerIndex.value && !imageObjectIndex.value)) return
  if (imageLayerSongId !== selectedSong.value.id) {
    releaseImageLayers()
    imageLayerSongId = selectedSong.value.id
  }
  const sequence = imageLayerSequence
  const states = imageLayerStatesAt(stageTime.value)
  const visibleStates = imageLayersEnabled.value
    ? [...states].filter(([, state]) => state.visible)
    : []
  const layers = visibleStates.map(([, state]) => state).filter(state => !state.imageObject)
  visibleImageLayerCount.value = layers.length
  visibleImageLayerAssets.value = layers.map(state => state.asset).sort()
  visibleImageLayerDepths.value = layers
    .map(state => `${state.asset}:${state.depth}`)
    .sort()

  for (const [key, runtime] of imageLayerRuntimes) {
    const state = states.get(key)
    runtime.sprite.visible = imageLayersEnabled.value && Boolean(state?.visible)
    if (state) {
      runtime.state = state
      runtime.sprite.zIndex = Number(state.depth) || 0
      runtime.sprite.alpha = state.imageObject ? state.alpha : 1
    }
  }

  await Promise.all(visibleStates.map(async ([key, state]) => {
    let runtime = imageLayerRuntimes.get(key)
    if (!runtime) {
      const entry = (state.imageObject ? imageObjectIndex.value : imageLayerIndex.value)?.assets?.[state.asset]
      if (!entry) {
        console.warn('[ChibiStage] missing image-layer asset', state.asset)
        return
      }
      let load = imageLayerLoads.get(key)
      if (!load) {
        load = loadImageLayerTexture(entry.file, 15000)
        imageLayerLoads.set(key, load)
      }
      const texture = await load
      const ownsLoad = imageLayerLoads.get(key) === load
      if (ownsLoad) imageLayerLoads.delete(key)
      if (sequence !== imageLayerSequence || imageLayerSongId !== selectedSong.value?.id) {
        if (ownsLoad) texture.destroy(true)
        return
      }
      runtime = imageLayerRuntimes.get(key)
      if (!runtime) {
        const sprite = markRaw(new PIXI.Sprite(texture))
        sprite.anchor.set(entry.pivot?.x ?? 0.5, 1 - (entry.pivot?.y ?? 0.5))
        cameraContainer.addChild(sprite)
        runtime = { texture, sprite, state }
        imageLayerRuntimes.set(key, runtime)
      }
    }
    const current = imageLayerStatesAt(stageTime.value).get(key)
    runtime.sprite.visible = imageLayersEnabled.value && Boolean(current?.visible)
    runtime.sprite.zIndex = Number(current?.depth) || 0
    runtime.sprite.alpha = current?.imageObject ? current.alpha : 1
    if (current) runtime.state = current
  }))
  const painted = [...imageLayerRuntimes.values()].filter(runtime => runtime.state?.imageObject && runtime.sprite.visible)
  visibleImageObjectCount.value = painted.length
  visibleImageObjectAssets.value = painted.map(runtime => runtime.state.asset).sort()
  layoutImageLayers()
  applyImageColors()
}

function sampleObjectLayerAlpha(state, milliseconds) {
  const duration = Number(state.tweenDuration) || 0
  if (duration <= 1 || milliseconds >= state.tweenStart + duration) return state.tweenTo
  const progress = Math.max(0, Math.min(1, (milliseconds - state.tweenStart) / duration))
  return state.tweenFrom + (state.tweenTo - state.tweenFrom) * progress
}

function objectLayerStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.objectLayerEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = states.get(event.asset) || {
      asset: event.asset,
      x: 0,
      y: 360,
      scale: 1000,
      depth: 0,
      tweenStart: eventTime,
      tweenDuration: 1,
      tweenFrom: 0,
      tweenTo: 0,
    }
    const alphaAtEvent = sampleObjectLayerAlpha(previous, eventTime)
    states.set(event.asset, {
      ...previous,
      x: event.x ?? previous.x,
      y: event.y ?? previous.y,
      scale: event.scale ?? previous.scale,
      depth: event.depth ?? previous.depth,
      tweenStart: eventTime,
      tweenDuration: Math.max(1, Number(event.duration) || 1),
      tweenFrom: alphaAtEvent,
      tweenTo: event.hide ? 0 : 1,
      eventTime,
      activatedAt: event.hide ? (previous.activatedAt ?? eventTime) : eventTime,
    })
  }
  for (const state of states.values()) state.alpha = sampleObjectLayerAlpha(state, milliseconds)
  return states
}

async function loadObjectLayerRuntime(entry) {
  if (entry.floorAnimation) {
    return { ...await loadChibiFloor(PIXI, entry.floorAnimation,
      path => loadImageLayerTexture(path, 10000)), entry }
  }
  if (entry.particleAnimation) {
    return { ...await loadChibiParticleLayer(entry.particleAnimation,
      path => loadImageLayerTexture(path, 10000)), entry }
  }
  const textures = await Promise.all(entry.textures.map(async metadata => ({
    metadata,
    texture: await loadImageLayerTexture(metadata.file),
  })))
  const textureById = new Map(textures.map(item => [item.metadata.id, item]))
  const container = markRaw(new PIXI.Container())
  container.sortableChildren = true
  for (const instance of entry.instances) {
    const item = textureById.get(instance.texture)
    if (!item) continue
    const sprite = markRaw(new PIXI.Sprite(item.texture))
    sprite.name = instance.name
    sprite.anchor.set(item.metadata.pivot?.x ?? 0.5, item.metadata.pivot?.y ?? 0.5)
    sprite.position.set(Number(instance.x) || 0, Number(instance.y) || 0)
    const pixelsToStage = 100 / (Number(item.metadata.pixelsPerUnit) || 100)
    sprite.scale.set(
      (Number(instance.scaleX) || 1) * pixelsToStage,
      (Number(instance.scaleY) || 1) * pixelsToStage,
    )
    sprite.rotation = (Number(instance.rotation) || 0) * Math.PI / 180
    sprite.skew.set((Number(instance.skewX) || 0) * Math.PI / 180, 0)
    sprite.tint = Number(instance.tint) || 0xffffff
    sprite.alpha = Number.isFinite(Number(instance.alpha)) ? Number(instance.alpha) : 1
    sprite.blendMode = instance.blendMode === 'add' ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL
    sprite.zIndex = Number(instance.sortingOrder) || 0
    container.addChild(sprite)
  }
  return { container, textures: textures.map(item => item.texture), entry }
}

function destroyObjectLayerRuntime(runtime) {
  if (!runtime || runtime.destroyed) return
  runtime.destroyed = true
  runtime?.container?.removeFromParent()
  runtime?.container?.destroy({ children: true })
  for (const texture of (runtime?.frameTextures || [])) texture.destroy(false)
  for (const texture of (runtime?.textures || [])) texture.destroy(true)
}

function layoutObjectLayers(states = objectLayerStatesAt(stageTime.value)) {
  if (!app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const [asset, runtime] of objectLayerRuntimes) {
    const state = states.get(asset)
    if (!state) continue
    runtime.container.position.set(
      width * 0.5 + Number(state.x) * viewportScale * environmentScale.value,
      height * 0.5 + (360 - Number(state.y)) * viewportScale * environmentScale.value,
    )
    runtime.container.scale.set(
      viewportScale * environmentScale.value * Number(state.scale) / 1000,
    )
    runtime.container.zIndex = Number(state.depth) || 0
    runtime.container.alpha = Math.max(0, Math.min(1, Number(state.alpha) || 0))
    runtime.container.visible = objectLayersEnabled.value && runtime.container.alpha > 0.001
    if (runtime.particles) updateChibiParticleLayer(runtime, stageTime.value, state.activatedAt)
    if (runtime.floorEmitters) updateChibiFloor(runtime, stageTime.value, state.activatedAt)
  }
  if (!playing.value || inspectorOpen.value) floorParticleState.value = [...objectLayerRuntimes.values()].filter(r => r.floorEmitters && r.container.visible)
    .map(r => r.floorSignature).join(',')
  if (!playing.value || inspectorOpen.value) particleLayerFrames.value = [...objectLayerRuntimes.entries()]
    .filter(([, runtime]) => runtime.particles && runtime.container.visible)
    .map(([asset, runtime]) => `${asset}:${runtime.particleFrames.join('/')}`).sort().join(',')
}

function releaseObjectLayers() {
  objectLayerSequence += 1
  for (const load of objectLayerLoads.values()) {
    load.then(destroyObjectLayerRuntime).catch(() => {})
  }
  objectLayerLoads.clear()
  for (const runtime of objectLayerRuntimes.values()) destroyObjectLayerRuntime(runtime)
  objectLayerRuntimes.clear()
  objectLayerSongId = ''
  visibleObjectLayerCount.value = 0
  visibleObjectLayerAssets.value = []
  unsupportedObjectLayerAssets.value = []
  if (!playing.value || inspectorOpen.value) particleLayerFrames.value = ''
  if (!playing.value || inspectorOpen.value) floorParticleState.value = ''
}

async function syncObjectLayers() {
  if (!cameraContainer || !selectedSong.value || !objectLayerIndex.value) return
  if (objectLayerSongId !== selectedSong.value.id) {
    releaseObjectLayers()
    objectLayerSongId = selectedSong.value.id
  }
  const sequence = objectLayerSequence
  const states = objectLayerStatesAt(stageTime.value)
  const activeStates = objectLayersEnabled.value
    ? [...states.values()].filter(state => state.alpha > 0.001)
    : []
  const supportedStates = []
  const unsupportedStates = []
  for (const state of activeStates) {
    const entry = objectLayerIndex.value.assets?.[state.asset]
    if (entry?.kind === 'sprite' || entry?.kind === 'mixed' || entry?.particleAnimation || entry?.floorAnimation) supportedStates.push(state)
    else unsupportedStates.push(state)
  }
  visibleObjectLayerCount.value = supportedStates.length
  visibleObjectLayerAssets.value = supportedStates.map(state => state.asset).sort()
  unsupportedObjectLayerAssets.value = unsupportedStates.map(state => state.asset).sort()

  for (const [asset, runtime] of objectLayerRuntimes) {
    const state = states.get(asset)
    runtime.container.visible = objectLayersEnabled.value && Boolean(state && state.alpha > 0.001)
  }

  await Promise.all(supportedStates.map(async state => {
    let runtime = objectLayerRuntimes.get(state.asset)
    if (!runtime) {
      const entry = objectLayerIndex.value.assets[state.asset]
      let load = objectLayerLoads.get(state.asset)
      if (!load) {
        load = loadObjectLayerRuntime(entry)
        objectLayerLoads.set(state.asset, load)
      }
      try {
        runtime = await load
      } catch (error) {
        if (objectLayerLoads.get(state.asset) === load) objectLayerLoads.delete(state.asset)
        throw error
      }
      const ownsLoad = objectLayerLoads.get(state.asset) === load
      if (ownsLoad) objectLayerLoads.delete(state.asset)
      if (sequence !== objectLayerSequence || objectLayerSongId !== selectedSong.value?.id) {
        if (ownsLoad) destroyObjectLayerRuntime(runtime)
        return
      }
      if (!objectLayerRuntimes.has(state.asset)) {
        objectLayerRuntimes.set(state.asset, runtime)
        cameraContainer.addChild(runtime.container)
      } else if (ownsLoad) {
        destroyObjectLayerRuntime(runtime)
      }
    }
  }))
  layoutObjectLayers(objectLayerStatesAt(stageTime.value))
}

function ensureBackmonitor() {
  if (backmonitorVideo || !backmonitorContainer) return
  const video = document.createElement('video')
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.addEventListener('loadedmetadata', () => {
    if (backmonitorVideo !== video) return
    backmonitorReady.value = true
    syncBackmonitor(true)
  })
  video.addEventListener('error', () => {
    if (backmonitorVideo !== video || !backmonitorMovie || !video.getAttribute('src')) return
    backmonitorReady.value = false
    console.warn('[ChibiStage] backmonitor video failed', backmonitorMovie)
  })
  backmonitorVideo = video
  const resource = markRaw(new PIXI.VideoResource(video, { autoPlay: false }))
  backmonitorTexture = markRaw(new PIXI.Texture(new PIXI.BaseTexture(resource)))
  backmonitorSprite = markRaw(new PIXI.Sprite(backmonitorTexture))
  backmonitorSprite.anchor.set(0.5)
  backmonitorSprite.zIndex = -10000
  backmonitorContainer.addChild(backmonitorSprite)
}

function ensureBackmonitorTransition() {
  if (backmonitorTransitionVideo || !backmonitorContainer) return
  const colorVideo = document.createElement('video')
  const alphaVideo = document.createElement('video')
  for (const video of [colorVideo, alphaVideo]) {
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
  }
  colorVideo.addEventListener('loadedmetadata', () => {
    if (backmonitorTransitionVideo !== colorVideo) return
    backmonitorTransitionColorReady = true
    syncBackmonitor(true)
  })
  alphaVideo.addEventListener('loadedmetadata', () => {
    if (backmonitorTransitionAlphaVideo !== alphaVideo) return
    backmonitorTransitionAlphaReady = true
    syncBackmonitor(true)
  })
  const handleError = () => {
    if (
      !backmonitorTransition
      || !colorVideo.getAttribute('src')
      || !alphaVideo.getAttribute('src')
    ) return
    backmonitorTransitionActive.value = false
    if (backmonitorTransitionSprite) backmonitorTransitionSprite.visible = false
    console.warn('[ChibiStage] backmonitor transition failed', backmonitorTransition)
  }
  colorVideo.addEventListener('error', handleError)
  alphaVideo.addEventListener('error', handleError)
  backmonitorTransitionVideo = colorVideo
  backmonitorTransitionAlphaVideo = alphaVideo
  const colorResource = markRaw(new PIXI.VideoResource(colorVideo, { autoPlay: false }))
  const alphaResource = markRaw(new PIXI.VideoResource(alphaVideo, { autoPlay: false }))
  backmonitorTransitionTexture = markRaw(new PIXI.Texture(new PIXI.BaseTexture(colorResource)))
  backmonitorTransitionAlphaTexture = markRaw(new PIXI.Texture(new PIXI.BaseTexture(alphaResource)))
  backmonitorTransitionFilter = markRaw(new PIXI.Filter(undefined, `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform sampler2D uAlphaTexture;
    void main(void) {
      vec4 color = texture2D(uSampler, vTextureCoord);
      float mask = texture2D(uAlphaTexture, vTextureCoord).r;
      gl_FragColor = color * mask;
    }
  `, {
    uAlphaTexture: backmonitorTransitionAlphaTexture,
  }))
  backmonitorTransitionSprite = markRaw(new PIXI.Sprite(backmonitorTransitionTexture))
  backmonitorTransitionSprite.anchor.set(0.5)
  backmonitorTransitionSprite.zIndex = -9999
  backmonitorTransitionSprite.filters = [backmonitorTransitionFilter]
  backmonitorTransitionSprite.visible = false
  backmonitorContainer.addChild(backmonitorTransitionSprite)
}

function layoutBackmonitor(state) {
  if (!backmonitorSprite || !app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const projected = projectChibiBackmonitor(selectedSong.value?.songCode, state, width, height, environmentScale.value)
  backmonitorSprite.position.set(projected.x, projected.y)
  backmonitorSprite.scale.set(projected.scale)
  backmonitorSprite.rotation = 0
  backmonitorSprite.alpha = 1
  backmonitorSprite.visible = backmonitorEnabled.value && Boolean(state.movie) && state.y < 4000
  if (backmonitorTransitionSprite) {
    backmonitorTransitionSprite.position.copyFrom(backmonitorSprite.position)
    backmonitorTransitionSprite.scale.copyFrom(backmonitorSprite.scale)
    backmonitorTransitionSprite.rotation = backmonitorSprite.rotation
    backmonitorTransitionSprite.alpha = backmonitorSprite.alpha
  }
  syncBackmonitorLogo(state,projected)
}

function syncBackmonitorLogo(state,projected) {
  backmonitorLogoAngle.value = ''
  for (const runtime of backmonitorLogoSprites.runtimes.values()) runtime.mesh.visible = false
  const model = stageEffectIndex.value?.backmonitorLogo
  const sample = sampleBackmonitorLogo(selectedSong.value?.songCode,state,stageTime.value,model,selectedSong.value?.backmonitorEvents)
  backmonitorLogoAlpha.value = sample?.alpha || 0
  if (!backmonitorEnabled.value || !sample || !backmonitorContainer) return
  const runtime = backmonitorLogoSprites.ensure('backmonitor-logo',model,stageEffectIndex.value.assets)
  if (!runtime) return
  updateBackmonitorLogoMesh(runtime,model,sample,projected)
  backmonitorLogoAngle.value = sample.angle.toFixed(2)
}

function pauseBackmonitorTransition() {
  backmonitorTransitionVideo?.pause()
  backmonitorTransitionAlphaVideo?.pause()
  backmonitorTransitionActive.value = false
  if (backmonitorTransitionSprite) backmonitorTransitionSprite.visible = false
}

function syncBackmonitorTransition(state, forceSeek = false) {
  const asset = state.transition
    ? backmonitorIndex.value?.transitions?.[state.transition]
    : null
  if (!asset) {
    pauseBackmonitorTransition()
    return
  }
  ensureBackmonitorTransition()
  if (backmonitorTransition !== state.transition) {
    backmonitorTransition = state.transition
    backmonitorTransitionColorReady = false
    backmonitorTransitionAlphaReady = false
    backmonitorTransitionVideo.src = `${LIVE_CHIBI_BASE}/${asset.colorFile}`
    backmonitorTransitionAlphaVideo.src = `${LIVE_CHIBI_BASE}/${asset.alphaFile}`
    backmonitorTransitionVideo.load()
    backmonitorTransitionAlphaVideo.load()
    return
  }
  if (!backmonitorTransitionColorReady || !backmonitorTransitionAlphaReady) return
  const duration = Math.min(
    Number(asset.color?.duration) || 0,
    Number(asset.alpha?.duration) || 0,
  ) / 1000
  const elapsed = Math.max(0, stageTime.value - state.transitionTime) / 1000
  if (duration <= 0 || elapsed >= duration) {
    pauseBackmonitorTransition()
    return
  }
  backmonitorTransitionActive.value = true
  backmonitorTransitionSprite.visible = backmonitorEnabled.value
  for (const video of [backmonitorTransitionVideo, backmonitorTransitionAlphaVideo]) {
    if (forceSeek || Math.abs(video.currentTime - elapsed) > 0.06) video.currentTime = elapsed
    video.playbackRate = playbackSpeed.value
    if (playing.value && video.paused) video.play().catch(() => {})
  }
}

function syncBackmonitor(forceSeek = false) {
  const state = currentBackmonitorState.value
  if (!state.movie || !backmonitorIndex.value?.assets?.[state.movie]) {
    backmonitorLogoAngle.value = ''
    for (const runtime of backmonitorLogoSprites.runtimes.values()) runtime.mesh.visible = false
    if (backmonitorSprite) backmonitorSprite.visible = false
    pauseBackmonitorTransition()
    return
  }
  ensureBackmonitor()
  layoutBackmonitor(state)
  syncBackmonitorTransition(state, forceSeek)
  const asset = backmonitorIndex.value.assets[state.movie]
  if (backmonitorMovie !== state.movie) {
    backmonitorMovie = state.movie
    backmonitorReady.value = false
    backmonitorVideo.src = `${LIVE_CHIBI_BASE}/${asset.file}`
    backmonitorVideo.load()
    return
  }
  if (!backmonitorReady.value || !Number.isFinite(backmonitorVideo.duration)) return
  const elapsed = Math.max(0, stageTime.value - state.movieTime) / 1000
  const desiredTime = elapsed % backmonitorVideo.duration
  if (forceSeek || Math.abs(backmonitorVideo.currentTime - desiredTime) > 0.18) {
    backmonitorVideo.currentTime = desiredTime
  }
  backmonitorVideo.playbackRate = playbackSpeed.value
  if (playing.value && backmonitorVideo.paused) backmonitorVideo.play().catch(() => {})
}

function releaseBackmonitor() {
  backmonitorLogoSprites.release()
  backmonitorLogoAngle.value = ''
  backmonitorVideo?.pause()
  pauseBackmonitorTransition()
  backmonitorMovie = ''
  backmonitorTransition = ''
  if (backmonitorVideo) {
    backmonitorVideo.removeAttribute('src')
    backmonitorVideo.load()
  }
  backmonitorSprite?.removeFromParent()
  backmonitorSprite?.destroy()
  backmonitorTexture?.destroy(true)
  for (const video of [backmonitorTransitionVideo, backmonitorTransitionAlphaVideo]) {
    if (!video) continue
    video.removeAttribute('src')
    video.load()
  }
  backmonitorTransitionSprite?.removeFromParent()
  backmonitorTransitionSprite?.destroy()
  backmonitorTransitionTexture?.destroy(true)
  backmonitorTransitionAlphaTexture?.destroy(true)
  backmonitorTransitionFilter?.destroy()
  backmonitorVideo = null
  backmonitorTexture = null
  backmonitorSprite = null
  backmonitorTransitionSprite = null
  backmonitorTransitionVideo = null
  backmonitorTransitionAlphaVideo = null
  backmonitorTransitionTexture = null
  backmonitorTransitionAlphaTexture = null
  backmonitorTransitionFilter = null
  backmonitorTransitionColorReady = false
  backmonitorTransitionAlphaReady = false
  backmonitorReady.value = false
  backmonitorTransitionActive.value = false
}

function applyCameraTransform() {
  if (!cameraContainer || !app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  if (!cameraEnabled.value) {
    // Scale a camera-disabled overview around the visible canvas centre.
    // Scaling from (0, 0) would make zooming also look like a coordinate shift.
    cameraContainer.position.set(width * 0.5, height * 0.5)
    cameraContainer.pivot.set(width * 0.5, height * 0.5)
    cameraContainer.scale.set(stageViewScale.value)
    cameraContainer.rotation = 0
    return
  }
  const viewportScale = Math.min(width / 1280, height / 720)
  const camera = currentCameraState.value
  cameraContainer.position.set(width * 0.5, height * 0.5)
  cameraContainer.pivot.set(
    width * 0.5 + camera.x * viewportScale,
    // Authored Camera y is up-positive; Pixi's screen-space y is down-positive.
    height * 0.5 - (camera.y - 360) * viewportScale,
  )
  cameraContainer.scale.set(camera.zoom * STAGE_BASE_ZOOM * stageViewScale.value)
  cameraContainer.rotation = -camera.rotation * Math.PI / 180
}

function applyLayerDebugVisibility() {
  if (stageBackgroundSprite) stageBackgroundSprite.visible = staticStageEnabled.value
  for (const part of stageBackgroundParts.values()) part.sprite.visible = staticStageEnabled.value
  if (backmonitorContainer) backmonitorContainer.visible = backmonitorEnabled.value
  for (const [position, runtime] of runtimes) {
    runtime.spine.visible = charactersEnabled.value
      && activePositions.value.includes(position)
      && layoutCoordinatesForStage(position, stageTime.value).y < 4000
    if (runtime.groundShadow) {
      runtime.groundShadow.visible = charactersEnabled.value
        && characterShadowsEnabled.value
        && runtime.spine.visible
    }
  }
  syncSpotlights()
  syncLaserlights()
  syncPinspotlights().catch(error => console.warn('[ChibiStage] pinspotlight debug sync failed', error))
  applyStageLighting()
  syncBackmonitor(true)
  syncImageLayers().catch(error => console.warn('[ChibiStage] image-layer debug sync failed', error))
  syncObjectLayers().catch(error => console.warn('[ChibiStage] object-layer debug sync failed', error))
  if (app && !playing.value && !stageDisposed) app.render()
}

function syncCharacterShadow(runtime) {
  const shadow = runtime.groundShadow
  if (!shadow) return
  const layout = characterShadowLayout(runtime.spine, stageEffectIndex.value?.characterShadow)
  shadow.visible = Boolean(layout) && charactersEnabled.value && characterShadowsEnabled.value && runtime.spine.visible
  if (!layout) return
  shadow.position.set(layout.x, layout.y)
  shadow.scale.set(layout.scaleX, layout.scaleY)
  shadow.zIndex = runtime.spine.zIndex - 1
  // Spine evaluates its pose during Pixi's transform pass, after the earlier
  // shadow sibling. Refresh that sibling before rendering to avoid frame lag.
  if (shadow.parent) shadow.updateTransform()
}

function layoutRuntime(position, motionEvent = null) {
  const runtime = runtimes.get(position)
  if (!runtime || !app || !canvasRef.value) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const coordinates = layoutCoordinatesForStage(position, stageTime.value, motionEvent)
  const { x, y, scale: sourceScale, positionState } = coordinates
  const viewportScale = Math.min(width / 1280, height / 720)
  const character = characters.value.find(item => item.id === runtime.characterId)
  const characterScale = Number(character?.previewScale) || 0.28
  const viewportFit = Math.min(1, height / 620)
  const ground = projectChibiGround(selectedSong.value?.songCode, coordinates, width, height)
  runtime.spine.x = ground.x
  // Live CSV Y is a depth coordinate: smaller values stand closer to the
  // camera (and therefore lower on screen). Legacy starts the centre member
  // at Y=170 and the side members at Y=190, matching the official stagger.
  runtime.spine.y = ground.y
  // Unity keeps the chibi prefab scale stable across solo, duo and ensemble
  // lives. Formation coordinates and the authored camera provide the framing;
  // scaling characters by active member count made three-person stages about
  // 24% larger than the already calibrated five-person reference.
  runtime.spine.scale.set(characterScale * CHARACTER_STAGE_SCALE * viewportFit * sourceScale / 1700)
  runtime.spine.visible = charactersEnabled.value && activePositions.value.includes(position) && y < 4000
  // Unity reserves the 1200-1900 band for environment washes, beams and
  // image/object layers. Characters occupy their own band around 2000; Y only
  // orders performers against one another. The previous x10 mapping pushed a
  // rear-platform performer down to z=900, causing authored light planes at
  // z=1500 to cut across the body.
  runtime.spine.zIndex = CHARACTER_DEPTH_BASE
    + Math.round((360 - y) * CHARACTER_DEPTH_Y_FACTOR)
    + position
  syncCharacterShadow(runtime)
  runtime.positionTweenProgress = positionState?.tweenProgress ?? 1
}

function resizeStage() {
  if (!app || !canvasRef.value) return
  const width = Math.max(1, canvasRef.value.clientWidth)
  const height = Math.max(1, canvasRef.value.clientHeight)
  app.renderer.resize(width, height)
  for (const position of activePositions.value) {
    const event = eventsForPosition(position)
      .findLast?.(item => item.time <= stageTime.value)
      || [...eventsForPosition(position)].reverse().find(item => item.time <= stageTime.value)
    layoutRuntime(position, event)
  }
  applyCameraTransform()
  layoutStageBackground()
  syncSpotlights()
  syncLaserlights()
  syncPinspotlights().catch(error => console.warn('[ChibiStage] pinspotlight sync failed', error))
  applyStageLighting()
  syncBackmonitor(true)
  syncImageLayers().catch(error => console.warn('[ChibiStage] image-layer sync failed', error))
  syncObjectLayers().catch(error => console.warn('[ChibiStage] object-layer sync failed', error))
  if(!playing.value)app?.render()
}

async function selectStageScript(id) {
  if (booting.value || id === selectedSongId.value || !songs.value.some(song => song.id === id)) return
  costumeNotice.value = ''
  selectedSongId.value = id
  await handleSongChange()
}

async function handleSongChange() {
  const buildSequence = ++stageBuildSequence
  if (selectedSong.value) emit('target-change', {
    songCode: selectedSong.value.songCode,
    choreographyId: selectedSong.value.id,
  })
  stopStage(true)
  booting.value = true
  statusText.value = isSpecialSingle.value ? '正在准备社长特别演出…' : '正在切换舞台编排…'
  handoffLineup.value = null
  for (const slot of lineup.value) {
    if (slot.characterId) continue
    const character = characters.value[(slot.position - 1) % characters.value.length]
    slot.characterId = character?.id || ''
    slot.costumeId = character?.defaultCostume || character?.costumes?.[0]?.id || ''
  }
  stageVocalEnabled.value = false
  releaseStageVocalAudio()
  songMotionsReady.value = false
  errorText.value = ''
  try {
    await Promise.all([loadSongLipSync(), loadSongAudio()])
    if (buildSequence !== stageBuildSequence) return
    for (const position of allPositions) {
      const runtime = runtimes.get(position)
      if (runtime) runtime.spine.visible = activePositions.value.includes(position)
    }
    const missingSlots = activeSlots.value.filter(slot => !runtimes.has(slot.position))
    if (missingSlots.length) {
      statusText.value = `正在补齐 ${missingSlots.length} 个舞台站位…`
      await Promise.all(missingSlots.map(slot => loadSlot(slot)))
    }
    if (buildSequence !== stageBuildSequence) return
    resizeStage()
    await seekStage()
    if (buildSequence !== stageBuildSequence) return
    ensureSpecialStageVisual()
  } catch (error) {
    if (buildSequence === stageBuildSequence) errorText.value = error.message || String(error)
  } finally {
    if (buildSequence === stageBuildSequence) booting.value = false
  }
}

function releaseAudio() {
  if (!songAudio) return
  songAudio.pause()
  songAudio.removeAttribute('src')
  songAudio.load()
  songAudio = null
}

function stagePositionForPerformerSlot(performerSlot) {
  return selectedSong.value?.stagePositionMap
    ?.find(item => item.performerSlot === performerSlot)?.stagePosition || performerSlot
}

function releaseStageVocalAudio() {
  stageVocalSession.release()
}

async function loadStageVocalAudio() {
  releaseStageVocalAudio()
  if (!stageVocalEnabled.value || !stageVocalAvailable.value) return
  const experiment = selectedStageVocalExperiment.value
  const slotCount = experiment.stage_vocal.slot_count
  try {
    const performerSlots = isSoloChoreography.value
      ? (selectedSong.value?.onStagePerformerSlots || [1])
      : Array.from({ length: slotCount }, (_, index) => index + 1)
    const performerLineup = Array(slotCount).fill('')
    for (const performerSlot of performerSlots) {
      const stagePosition = stagePositionForPerformerSlot(performerSlot)
      const idolCode = handoffLineup.value
        ? handoffLineup.value[stagePosition - 1]
        : slotByPosition(stagePosition)?.characterId
      if (!idolCode && handoffLineup.value) continue
      const vocal = experiment.solo_tracks?.[idolCode]?.vocal
      if (!vocal?.url) throw new Error(`${stagePosition}号位偶像缺少 ${experiment.song_code} 声部`)
      performerLineup[performerSlot - 1] = idolCode
    }
    stageVocalSession.setPlaybackRate(playbackSpeed.value)
    await stageVocalSession.configure({
      experiment,
      events: isSoloChoreography.value ? [] : (selectedSong.value?.singerEvents || []),
      performerLineup,
      continuous: isSoloChoreography.value,
    })
    if (!stageVocalEnabled.value) return
    audioError.value = stageVocalSession.error.value
    if (!stageVocalSession.ready.value) stageVocalEnabled.value = false
  } catch (error) {
    releaseStageVocalAudio()
    audioError.value = error.message
    stageVocalEnabled.value = false
  }
}

async function handleStageVocalToggle() {
  stopStage(true)
  audioError.value = ''
  if (stageVocalEnabled.value) await loadStageVocalAudio()
  else releaseStageVocalAudio()
  await seekStage()
}

function syncStageVocalMix() {
  // Gain refs are watched by the shared AudioContext session. Singer gates are
  // scheduled on its audio clock rather than being updated by animation frames.
}

function stagePlaybackAudios() {
  if (stageVocalEnabled.value && stageVocalReady.value) return []
  return songAudio ? [songAudio] : []
}

function stageClockAudio() {
  return stageVocalEnabled.value && stageVocalReady.value ? null : songAudio
}

function syncStagePlaybackTime(seconds) {
  if (stageVocalEnabled.value && stageVocalReady.value) {
    stageVocalSession.seek(seconds)
    return
  }
  for (const audio of stagePlaybackAudios()) {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(seconds, audio.duration)
  }
}

async function loadSongAudio() {
  releaseAudio()
  audioReady.value = false
  audioError.value = ''
  const audioEntry = selectedSongAudio.value
  if (!audioEntry) return
  const audio = new Audio(getSongUrl(
    audioEntry.songCode,
    `${LIVE_CHIBI_BASE}/${audioEntry.file}`,
  ))
  audio.preload = 'auto'
  audio.playbackRate = playbackSpeed.value
  audio.addEventListener('loadedmetadata', () => {
    if (songAudio === audio) audioReady.value = true
  })
  audio.addEventListener('error', () => {
    if (songAudio !== audio) return
    audioReady.value = false
    audioError.value = '歌曲音频加载失败'
  })
  songAudio = audio
  audio.load()
}

async function loadSongLipSync() {
  const song = selectedSong.value
  const sequence = ++lipSyncSequence
  lipSyncCurve = null
  lipSyncReady.value = false
  lipSyncFrameCount.value = 0
  applyCurrentLipSync()
  if (!song?.lipSync?.file) return
  try {
    const curve = await fetchLiveChibiLipSync(song.lipSync.file)
    if (sequence !== lipSyncSequence || selectedSong.value?.id !== song.id) return
    lipSyncCurve = curve
    lipSyncReady.value = true
    lipSyncFrameCount.value = Array.isArray(curve?.values) ? curve.values.length : 0
    applyCurrentLipSync()
  } catch (error) {
    if (sequence === lipSyncSequence) console.warn('[ChibiStage] lip-sync load failed', error)
  }
}

function applyCurrentLipSync() {
  for (const position of activePositions.value) {
    applyLiveChibiLipSync(
      runtimes.get(position),
      lipSyncCurve,
      stageTime.value,
      currentSingerPositions.value.includes(position),
    )
  }
}

async function preloadSongMotions(intent) {
  if (!intent.current()) return false
  if (!selectedSong.value || !stageReady.value) return false
  const songId = selectedSong.value.id
  const targets = activeSlots.value
    .map(slot => ({ slot, runtime: runtimes.get(slot.position) }))
    .filter(item => item.runtime && !item.runtime.preloadedSongs.has(songId))
  if (!targets.length) {
    songMotionsReady.value = true
    return true
  }

  const motions = selectedSong.value.motionIds.map(id => motionCatalog.value.get(id)).filter(Boolean)
  const total = Math.max(1, targets.length * motions.length)
  let completed = 0
  preloading.value = true
  preloadProgress.value = 0
  audioError.value = ''
  const owner = new AbortController()
  const cancel = () => owner.abort()
  intent.signal?.addEventListener('abort',cancel,{once:true})
  if (intent.signal?.aborted) cancel()
  try {
    const jobs=motions.flatMap(motion=>targets.map(({runtime})=>({runtime,motion})))
    const worker=async()=> {
      while(intent.current() && !owner.signal.aborted && jobs.length) {
        const {runtime,motion}=jobs.shift()
        await injectLiveChibiMotion(runtime,motion,{signal:owner.signal,isCurrent:()=>intent.current() && !owner.signal.aborted && runtimes.get(runtime.stagePosition)===runtime})
        if(!intent.current())return
        completed++;preloadProgress.value=Math.round(completed/total*100)
      }
    }
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},worker))
    if(intent.current())for(const {runtime} of targets)if(runtimes.get(runtime.stagePosition)===runtime)runtime.preloadedSongs.add(songId)
    if (!intent.current()) return false
    songMotionsReady.value = true
    return true
  } catch (error) {
    owner.abort()
    if (!intent.current()) return false
    audioError.value = `舞台动作预载失败：${error.message}`
    console.error('[ChibiStage] motion preload failed', error)
    return false
  } finally {
    intent.signal?.removeEventListener('abort',cancel)
    if (intent.current()) preloading.value = false
  }
}

async function playSlotEvent(slot, event, { reset = false, seekTime = null } = {}) {
  const runtime = runtimes.get(slot.position)
  const motion = motionCatalog.value.get(event.motion)
  if (!runtime || !motion) return
  const sequence = ++slot.motionSequence
  const revision = stageIntent.revision()
  const current = () => !stageDisposed && revision === stageIntent.revision() && sequence === slot.motionSequence && runtimes.get(slot.position) === runtime
  const animationNames = await injectLiveChibiMotion(runtime, motion, { isCurrent: current, signal:lifetime.signal })
  if (!current()) return
  slot.currentMotion = motion.id
  slot.currentMotionSource = event.source || 'script'
  const speedScale = (Number(event.speed) || 1000) / 1000
  runtime.currentMotionEvent = event
  runtime.motionSpeedScale = speedScale
  playLiveChibiMotion(runtime, animationNames, { mode: event.mode, reset })
  if (seekTime !== null && seekTime > event.time) {
    seekLiveChibiMotion(runtime, (seekTime - event.time) / 1000 * speedScale)
  }
  runtime.spine.state.timeScale = playing.value ? playbackSpeed.value * speedScale : 0
  layoutRuntime(slot.position, event)
}

async function syncSlotAtTime(slot, milliseconds, reset = true) {
  const events = eventsForPosition(slot.position)
  const index = events.findLastIndex(item => item.time <= milliseconds)
  if (index < 0) {
    layoutRuntime(slot.position)
    return
  }
  const runtime = runtimes.get(slot.position)
  const revision = stageIntent.revision()
  const loadSequence = slot.loadSequence
  // A paused seek inside a cross-fade needs the outgoing pose too. Rebuild
  // only the recent mixing chain and its predecessor, not the whole song.
  const mixMilliseconds = Math.max(0, Number(runtime?.spine.stateData.defaultMix) || 0) * 1000
  let start = index
  if (reset) {
    while (start > 0 && events[start].mode !== 3
      && events[start].time > milliseconds - mixMilliseconds) start -= 1
  }
  for (let cursor = start; cursor <= index; cursor += 1) {
    if (stageIntent.revision() !== revision || slot.loadSequence !== loadSequence
      || runtimes.get(slot.position) !== runtime) return
    await playSlotEvent(slot, events[cursor], {
      reset: cursor === start ? reset : false,
      seekTime: cursor === index ? milliseconds : events[cursor + 1].time,
    })
  }
}

async function seekStage() {
  stopStage()
  syncStagePlaybackTime(stageTime.value / 1000)
  await Promise.all(activeSlots.value.map(slot => syncSlotAtTime(slot, stageTime.value, true)))
  resetEventIndices()
  applyCurrentLipSync()
  syncStageVocalMix()
  await syncStageBackground()
  syncSpotlights()
  syncLaserlights()
  await syncPinspotlights()
  applyStageLighting()
  applyCameraTransform()
  syncBackmonitor(true)
  await syncImageLayers()
  await syncObjectLayers()
  app?.render()
}

function resetEventIndices() {
  eventIndices.clear()
  for (const position of activePositions.value) {
    const events = eventsForPosition(position)
    const index = events.findIndex(event => event.time > stageTime.value)
    eventIndices.set(position, index < 0 ? events.length : index)
  }
}

async function toggleStage() {
  if (playing.value || stageStarting.value) {
    stopStage()
    return
  }
  const intent = stageIntent.begin()
  const runtimeSnapshot = [...runtimes.entries()]
  const current = () => intent.current() && !stageDisposed && runtimeSnapshot.every(([position,runtime]) => runtimes.get(position) === runtime)
  stageStarting.value = true
  try {
  // Keep resume inside the original tap, before motion/resource awaits.
  if (stageVocalEnabled.value && stageVocalReady.value && !await stageVocalSession.unlock()) {
    if (current()) audioError.value = stageVocalSession.error.value
    return
  }
  if (!current()) return
  if (!await preloadSongMotions(intent)) { if (current()) stageVocalSession.pause(); return }
  if (!current()) return
  if (stageTime.value >= stageDuration.value) stageTime.value = 0
  await Promise.all(activeSlots.value.map(slot => syncSlotAtTime(slot, stageTime.value, true)))
  if (!current()) return
  resetEventIndices()
  playbackStartOffset = stageTime.value
  playbackStartedAt = performance.now()
  if (stageVocalEnabled.value && stageVocalReady.value) {
    stageVocalSession.seek(stageTime.value / 1000)
    if (!await stageVocalSession.play()) {
      if (current()) audioError.value = stageVocalSession.error.value
      return
    }
    if (!current()) return
    audioError.value = ''
  } else {
    const playbackAudios = stagePlaybackAudios()
    if (playbackAudios.length) {
      syncStagePlaybackTime(stageTime.value / 1000)
      playbackAudios.forEach(audio => { audio.playbackRate = playbackSpeed.value })
      try {
        await withLoadDeadline(() => Promise.all(playbackAudios.map(audio => {
          stageAudioOwners.set(audio,intent)
          return Promise.resolve(audio.play()).then(() => {
            if (!current() && stageAudioOwners.get(audio) === intent) { audio.pause(); stageAudioOwners.delete(audio) }
          })
        })), { signal:intent.signal, timeoutMs:8000, label:'stage-audio-play' })
        if (!current()) return
        audioError.value = ''
      } catch (error) {
        if (!current()) return
        stopStage()
        audioError.value = `歌曲音频无法播放：${error.message}`
        return
      }
    }
  }
  playing.value = true
  syncMotionPlaybackSpeed()
  syncBackmonitor(true)
  if(app)app.ticker.lastTime=performance.now()
  animationFrame = requestAnimationFrame(updateStage)
  } catch (error) {
    if (current()) { stopStage(); audioError.value = `舞台无法开始：${error.message || error}` }
  } finally { if (intent.current()) stageStarting.value = false }
}

function updateStage(now) {
  if (!playing.value || !selectedSong.value) return
  const clockAudio = stageClockAudio()
  stageTime.value = Math.min(
    stageDuration.value,
    stageVocalEnabled.value && stageVocalReady.value
      ? stageVocalSession.currentTime.value * 1000
      : clockAudio && !clockAudio.paused
      ? clockAudio.currentTime * 1000
      : playbackStartOffset + (now - playbackStartedAt) * playbackSpeed.value,
  )
  if (!stageTransportReady.value) return
  for (const slot of activeSlots.value) {
    const events = eventsForPosition(slot.position)
    let index = eventIndices.get(slot.position) || 0
    while (index < events.length && events[index].time <= stageTime.value) {
      void playSlotEvent(slot, events[index]).catch(error=> {if(!stageDisposed)console.warn('[ChibiStage] motion event failed',error)})
      index += 1
    }
    eventIndices.set(slot.position, index)
    layoutRuntime(slot.position, runtimes.get(slot.position)?.currentMotionEvent)
  }
  applyCameraTransform()
  syncSpotlights()
  syncLaserlights()
  syncPinspotlights().catch(error => console.warn('[ChibiStage] pinspotlight sync failed', error))
  applyStageLighting()
  syncBackmonitor()
  syncImageLayers().catch(error => console.warn('[ChibiStage] image-layer sync failed', error))
  syncObjectLayers().catch(error => console.warn('[ChibiStage] object-layer sync failed', error))
  applyCurrentLipSync()
  if (stageTime.value >= stageDuration.value) {
    stopStage()
    return
  }
  app?.ticker.update(now)
  animationFrame = requestAnimationFrame(updateStage)
}

function stopStage(reset = false) {
  stageIntent.cancel()
  stageStarting.value = false
  preloading.value = false
  const wasPlaying = playing.value
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
  playing.value = false
  syncMotionPlaybackSpeed()
  stageVocalSession.pause()
  if (wasPlaying && stageVocalEnabled.value && stageVocalReady.value) {
    stageTime.value = stageVocalSession.currentTime.value * 1000
  }
  stagePlaybackAudios().forEach(audio => audio.pause())
  backmonitorVideo?.pause()
  backmonitorTransitionVideo?.pause()
  backmonitorTransitionAlphaVideo?.pause()
  if (reset) {
    stageTime.value = 0
    syncStagePlaybackTime(0)
  }
}

async function resetStage() {
  stopStage(true)
  await seekStage()
}

function applyPlaybackSpeed() {
  if (stageStarting.value) stopStage()
  stageVocalSession.setPlaybackRate(playbackSpeed.value)
  stagePlaybackAudios().forEach(audio => { audio.playbackRate = playbackSpeed.value })
  if (backmonitorVideo) backmonitorVideo.playbackRate = playbackSpeed.value
  if (backmonitorTransitionVideo) backmonitorTransitionVideo.playbackRate = playbackSpeed.value
  if (backmonitorTransitionAlphaVideo) backmonitorTransitionAlphaVideo.playbackRate = playbackSpeed.value
  syncMotionPlaybackSpeed()
}

function syncMotionPlaybackSpeed() {
  for (const position of activePositions.value) {
    const runtime = runtimes.get(position)
    if (runtime) {
      runtime.spine.state.timeScale = playing.value
        ? playbackSpeed.value * (runtime.motionSpeedScale || 1)
        : 0
    }
  }
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
</script>

<style scoped>
.chibi-stage {
  /* Tool shell: dark stage ground, chrome top bar, white panel (see GS_UI_CONSTITUTION). */
  --ink: #0b1424;
  --panel: var(--gs-surface);
  --line: var(--gs-line);
  --text: var(--gs-ink);
  --muted: var(--gs-ink-3);
  --accent: var(--gs-mint);
  --stage-safe-top: var(--gs-safe-top, env(safe-area-inset-top, 0px));
  --stage-safe-right: var(--gs-safe-right, env(safe-area-inset-right, 0px));
  --stage-safe-bottom: var(--gs-safe-bottom, env(safe-area-inset-bottom, 0px));
  --stage-safe-left: var(--gs-safe-left, env(safe-area-inset-left, 0px));
  --stage-header-height: calc(60px + var(--stage-safe-top));
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  height: 100svh;
  min-height: 0;
  overflow: hidden;
  overscroll-behavior: none;
  color: var(--text);
  background: var(--ink);
  font-family: var(--gs-font-body);
}

.stage-header {
  position: relative;
  z-index: 5;
  top: 0;
  height: var(--stage-header-height);
  min-height: var(--stage-header-height);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: var(--stage-safe-top) max(12px, var(--stage-safe-right)) 0 max(12px, var(--stage-safe-left));
  box-sizing: border-box;
  color: var(--gs-chrome-ink);
  background: var(--gs-chrome);
}
.stage-header h1 { margin: 0; color: var(--gs-surface); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.stage-title-compact { display: none; }
.stage-header p { margin: 2px 0 0; color: var(--gs-chrome-ink); font-size: var(--gs-text-meta); }
.stage-back-button { --archive-back-ink: var(--gs-chrome-ink); --archive-back-hover: var(--gs-chrome-hover); border-radius: var(--gs-radius-control); }
.header-divider { width: 1px; height: 28px; background: var(--gs-chrome-hover); }
.lab-link { min-height: 44px; margin-left: 8px; padding: 0 13px; color: #236d67; background: #edf8f4; border: 1px solid #c6ddda; border-radius: 7px; font: 650 11px/1 inherit; cursor: pointer; }

.stage-workspace { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 0; align-items: stretch; width: 100%; min-width: 0; min-height: 0; margin: 0; padding: 0 var(--stage-safe-right) var(--stage-safe-bottom) var(--stage-safe-left); box-sizing: border-box; overflow: hidden; }
.performance-shell { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; border: 0; border-radius: 0; background: var(--ink); box-sizing: border-box; }
.performance-viewport { position: relative; display: flex; flex: 1 1 0; flex-direction: column; width: 100%; min-width: 0; min-height: 0; container-type: size; }
.screen-fit-region { position: relative; isolation: isolate; display: grid; flex: 1 1 0; place-items: center; width: 100%; min-width: 0; min-height: 0; overflow: hidden; container-type: size; background: var(--ink); }
.stage-ambient { display: none; position: absolute; z-index: -1; inset: -28px; background-size: cover; background-position: center; filter: blur(28px) saturate(.65); opacity: .55; pointer-events: none; }
/* The existing canvas host stays mounted; its observer sees the fitted 16:9 screen. */
.performance-screen { position: relative; width: min(100cqw, calc(100cqh * 16 / 9)); min-width: 0; aspect-ratio: 16 / 9; overflow: hidden; flex: none; container-type: inline-size; }
.stage-backdrop { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(5, 12, 23, 0.16), rgba(5, 12, 23, 0.04) 55%, rgba(2, 8, 16, 0.62)), url('/assets/bg/bg086_dancestudio_in_01.png') center / cover no-repeat; filter: saturate(0.82) brightness(0.7); transform: scale(1.015); }
.stage-floor { position: absolute; z-index: 1; left: 6%; right: 6%; bottom: 7%; height: 30%; border: 1px solid rgba(104, 180, 245, 0.2); border-radius: 50%; background: radial-gradient(ellipse at center, rgba(67, 163, 241, 0.16), rgba(20, 70, 115, 0.05) 52%, transparent 72%); transform: perspective(500px) rotateX(62deg); transform-origin: center bottom; }
.chibi-stage[data-static-stage-enabled="false"] .stage-backdrop,
.chibi-stage[data-static-stage-enabled="false"] .stage-floor { visibility: hidden; }
.stage-canvas { position: absolute; z-index: 2; inset: 0; }
.stage-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }
.performance-screen::after { content: ""; position: absolute; z-index: 2; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 47%, transparent 28%, rgba(2, 7, 14, 0.34) 100%); }

.performance-hud { display: flex; flex: none; align-items: center; gap: 12px; padding: 6px 12px; width: 100%; min-height: 56px; box-sizing: border-box; color: var(--gs-chrome-ink); background: var(--ink); }
.performance-identity { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.performance-hud strong { overflow-wrap: anywhere; }
.performance-actions { display: flex; flex: 0 0 auto; gap: 4px; }
.performance-hud strong { color: var(--gs-surface); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.performance-hud small { color: var(--gs-chrome-ink); font-size: var(--gs-text-meta); }

.stage-lyric {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: 3%;
  width: 94%;
  padding: 0;
  color: #fff;
  /* cqw follows the actual letterboxed canvas, including short landscape screens. */
  font-size: clamp(8px, 2cqw, 24px);
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-wrap: balance;
  text-align: center;
  -webkit-font-smoothing: antialiased;
  -webkit-text-stroke: 0.07em rgba(0, 0, 0, 0.96);
  paint-order: stroke fill;
  text-shadow: 0 0.06em 0.12em rgba(0, 0, 0, 0.9);
  transform: translateX(-50%);
  pointer-events: none;
}

.rail-summary { flex: none; width: 100%; margin: 0; padding: 4px 12px 0; box-sizing: border-box; color: var(--gs-chrome-ink); font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
.position-rail { flex: none; width: 100%; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding: 6px 8px; box-sizing: border-box; }
.position-marker { min-width: 0; min-height: 44px; display: grid; align-content: start; justify-items: center; gap: 3px; padding: 4px; border: 1px solid transparent; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-chrome-ink); cursor: pointer; }
.position-marker .position-caption { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2px 4px; max-width: 100%; min-height: 16px; font-size: 11px; line-height: 1.4; }
.position-marker small { max-width: 100%; color: var(--gs-surface); font-size: var(--gs-text-meta); line-height: 1.4; overflow-wrap: anywhere; }
.position-marker.selected { border-color: var(--gs-mint); background: var(--gs-chrome-hover); }
.position-marker.singing { background: var(--gs-chrome-hover); }
.position-marker.singing .position-caption { color: var(--gs-surface); }
.position-marker:disabled { align-content: center; color: var(--muted); background: transparent; cursor: default; }
.position-marker:disabled small { color: var(--gs-chrome-ink); }
.rest-position { display: none; }
.singing-status { display: inline-flex; align-items: center; gap: 3px; color: var(--gs-mint); }
.singing-label { display: none; font-size: var(--gs-text-caption); }

.stage-state { position: absolute; z-index: 6; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #cbd9e7; background: rgba(5, 13, 23, 0.58); backdrop-filter: blur(5px); }
.loading-icon { animation: spin 1s linear infinite; }
.error-state { color: #ffc2c2; text-align: center; }
.error-state span { max-width: 420px; color: #b3c1cf; }
@keyframes spin { to { transform: rotate(360deg); } }

.transport { flex: none; width: calc(100% - 24px); min-height: 68px; display: grid; grid-template-columns: 44px 48px minmax(110px, auto) minmax(0, 1fr); gap: 12px; align-items: center; margin: 0 12px 12px; padding: 8px 16px; box-sizing: border-box; border-radius: var(--gs-radius-panel); color: var(--gs-ink); background: var(--gs-surface); box-shadow: var(--gs-shadow-float); }
.transport.disabled { opacity: 0.62; }
.transport button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; color: var(--gs-ink); background: var(--gs-surface); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); cursor: pointer; }
.transport .primary-transport { width: 48px; height: 48px; border-radius: 50%; border-color: var(--gs-play-bg); background: var(--gs-play-bg); color: var(--gs-play-ink); }
.transport button:disabled { cursor: wait; }
.transport-copy { display: grid; gap: 5px; }
.transport-copy strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.transport-copy small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.transport input { width: 100%; min-width: 0; min-height: 44px; margin: 0; accent-color: var(--accent); }

.stage-inspector { display: flex; flex-direction: column; min-width: 0; min-height: 0; height: 100%; overflow: hidden; border: 0; border-radius: 0; background: var(--gs-surface); }
.inspector-scroll { flex: 1 1 0; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; }
.mobile-panel-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); flex: none; gap: 0; padding: 0 12px; border-bottom: 1px solid var(--line); background: var(--gs-surface); }
.mobile-panel-tabs button { min-width: 0; min-height: 48px; padding: 0 8px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; color: var(--gs-ink-3); background: transparent; font-size: var(--gs-text-body); cursor: pointer; }
.mobile-panel-tabs button[aria-pressed="true"] { color: var(--gs-ink); border-bottom-color: var(--gs-selected-line); font-weight: var(--gs-weight-semibold); }
.inspector-scroll.is-song-panel { display: flex; flex-direction: column; overflow: hidden; }
.song-section { flex: 1; height: 100%; min-height: 0; }
.control-section { min-width: 0; padding: 12px 20px; box-sizing: border-box; border-bottom: 1px solid var(--line); }
.control-section:last-child { border-right: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 24px; margin-bottom: 8px; color: var(--gs-ink-3); }
.section-heading > div { display: grid; gap: 4px; }
.section-heading h2 { margin: 0; color: var(--gs-ink); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.section-heading h2 small { margin-left: 4px; color: var(--muted); font-size: 12px; font-weight: 400; }
.section-heading span { color: var(--muted); font-size: 12px; }
select { width: 100%; min-width: 0; height: 44px; padding: 0 12px; color: var(--gs-ink); background: var(--gs-surface); border: 1px solid var(--line); border-radius: var(--gs-radius-field); font-family: inherit; font-size: var(--gs-text-ui); }
select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.song-facts { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
.song-facts span { padding: 5px 7px; color: #587678; background: #edf5f2; border-radius: 5px; font-size: 12px; }
.stage-audio-action { display: inline-grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; padding: 0; border: 1px solid var(--line); border-radius: var(--gs-radius-control); color: var(--gs-ink-2); background: var(--gs-surface); cursor: pointer; }
.stage-audio-action.enabled { border-color: var(--gs-mint); color: var(--gs-ink); background: var(--gs-mint-wash); }
.stage-audio-dialog { max-width: 400px; }
.stage-vocal-controls { display: grid; gap: 4px; margin: 8px 0 0; padding: 0; border: 0; }
.stage-vocal-controls legend { padding: 0; color: var(--muted); font-size: 12px; }
.stage-vocal-controls small { color: var(--muted); font-size: 12px; line-height: 1.5; }
.vfx-coverage { display: grid; gap: 6px; margin-top: 14px; padding: 10px 12px; border: 1px solid rgba(232, 179, 99, .32); border-radius: 9px; background: rgba(100, 68, 33, .14); }
.vfx-coverage h3, .vfx-coverage p { margin: 0; }
.vfx-coverage h3 { color: #79562b; font-size: 12px; }
.vfx-coverage p, .vfx-coverage summary, .vfx-coverage code { color: #586a71; font-size: 12px; line-height: 1.55; }
.vfx-coverage .vfx-coverage-gap { color: #994a20; }
.vfx-coverage summary { cursor: pointer; }
.vfx-coverage code { display: block; overflow-wrap: anywhere; margin-top: 5px; }

.lineup-section { display: grid; gap: 8px; }
.lineup-section .section-heading { margin-bottom: 0; }
.singing-icon { color: var(--idol-accent, #258e81); }
.rebuild-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; margin-top: 3px; color: #236d67; background: #edf8f4; border: 1px solid #c6ddda; border-radius: 8px; font: 650 11px/1 inherit; cursor: pointer; }

.playback-section { display: grid; gap: 13px; }
.range-control { display: grid; grid-template-columns: 36px minmax(0, 1fr) 48px; gap: 9px; align-items: center; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.range-control input { width: 100%; accent-color: var(--accent); }
.range-control output { color: var(--gs-ink); text-align: right; font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.camera-toggle { display: flex; min-height: 44px; gap: 8px; align-items: center; color: var(--gs-ink); font-size: var(--gs-text-ui); }
.camera-toggle input { margin: 0; accent-color: var(--accent); }
.layer-debug-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin: 12px 0 0; padding: 11px 12px 12px; border: 1px solid rgba(111, 174, 229, 0.22); border-radius: 10px; }
.layer-debug-controls legend { padding: 0 5px; color: #38796f; font-size: 10px; letter-spacing: 0.08em; }
.layer-debug-controls label { display: flex; gap: 7px; align-items: center; min-width: 0; min-height: 44px; color: #45616a; font-size: 11px; }
.layer-debug-controls input { margin: 0; accent-color: var(--accent); }
.runtime-summary { display: grid; gap: 8px; margin: 0; }
.runtime-details > summary { min-height: 44px; display: list-item; align-content: center; color: #365860; font-size: 13px; line-height: 1.6; cursor: pointer; }
.runtime-details .runtime-summary { margin-top: 8px; }
.runtime-summary div { display: grid; grid-template-columns: 70px 1fr; gap: 10px; font-size: 10px; }
.runtime-summary dt { color: var(--muted); }
.runtime-summary dd { margin: 0; color: #365860; }
.audio-error { font-size: var(--gs-text-meta); }

.stage-header-title { flex: 1; min-width: 0; }
.stage-icon-action { display: inline-grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; padding: 0; color: var(--gs-chrome-ink); border: 0; border-radius: var(--gs-radius-control); background: transparent; cursor: pointer; }
.stage-icon-action:disabled { opacity: .4; cursor: default; }
.chibi-stage button:focus-visible, .chibi-stage summary:focus-visible, .chibi-stage input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chibi-stage button { font-family: inherit; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.chibi-stage button:not(:disabled):active { background-color: var(--gs-mint-wash); }
.chibi-stage .stage-icon-action:not(:disabled):active, .chibi-stage .position-marker:not(:disabled):active { background-color: var(--gs-chrome-hover); }
.mix-details > summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: #3f7772; font-size: 12px; }
.mix-details .range-control { min-height: 44px; }
.lineup-actions { display: flex; gap: 8px; }
.lineup-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font-size: var(--gs-text-ui); cursor: pointer; }
.lineup-actions button:disabled { opacity: .4; cursor: default; }
.lineup-note { color: var(--muted); font-size: 12px; line-height: 1.5; }
.slot-editor { display: grid; gap: 8px; min-width: 0; }
.idol-change-action { display: flex; width: 100%; align-items: center; gap: 12px; min-height: 60px; padding: 8px 0; color: var(--text); background: transparent; border: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); border-radius: 0; cursor: pointer; text-align: left; }
.slot-editor-copy { display: grid; gap: 4px; flex: 1; min-width: 0; }
.idol-change-action strong { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.idol-change-action small { font-size: 12px; color: var(--muted); }
.costume-control { display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.costume-sync-action { justify-self: start; min-height: 44px; padding: 0 8px; border: 0; border-radius: var(--gs-radius-control); color: var(--gs-mint-ink); background: transparent; cursor: pointer; font-size: var(--gs-text-ui); text-decoration: none; }
.costume-sync-action:disabled { opacity: .4; cursor: default; }
.common-costume-actions { padding-top: 8px; border-top: 1px solid var(--line); }
.common-costume-actions h3 { margin: 0 0 8px; color: var(--gs-ink); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.uniform-quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.uniform-quick-actions button { min-width: 0; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--gs-radius-pill); color: var(--gs-ink-2); background: var(--gs-surface); cursor: pointer; font-size: var(--gs-text-ui); }
.uniform-quick-actions button:disabled { opacity: .4; cursor: default; }
.costume-notice { margin: 0; color: var(--gs-ink-2); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.viewing-section { display: grid; gap: 4px; }
.viewing-toggles, .viewing-actions { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.viewing-range { min-height: 44px; font-size: 12px; }
.viewing-range input { min-height: 44px; margin: 0; }
.viewing-actions { gap: 8px; }
.viewing-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 12px; color: var(--gs-ink); background: var(--gs-surface); border: 1px solid var(--line); border-radius: var(--gs-radius-control); cursor: pointer; font-size: var(--gs-text-ui); }
.panel-notice, .audio-error { padding: 0 12px; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.panel-notice a { display: inline-flex; align-items: center; min-height: 44px; color: var(--gs-mint-ink); text-underline-offset: 3px; }
.stage-dev-dialog { width: min(600px, calc(100vw - 24px)); color: #243c45; color-scheme: light; background: #ffffff; border-color: #315253; font-family: inherit; }
.stage-dev-dialog :deep(.terminal-dialog-header) { color: #243c45; background: #f4faf8; border-color: #315253; }
.stage-dev-dialog :deep(.terminal-dialog-header h2) { font-size: 18px; }
.stage-dev-dialog :deep(.terminal-icon-button) { color: #365860; background: #e7f3f0; }
.stage-dev-dialog :deep(.terminal-dialog-body) { padding: 12px; scrollbar-width: thin; }
.stage-dev-dialog .range-control { min-height: 44px; }
.stage-dev-dialog .range-control input { min-height: 44px; margin: 0; }
.inspector-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.inspector-tools .lab-link { margin: 0; }
.inspector-tools .rebuild-button { min-height: 44px; margin: 0; }
.technical-note, .stage-help-dialog p { color: #526e73; font-size: 13px; line-height: 1.7; }
.shortcut-list { display: grid; gap: 12px; font-size: 13px; }
.shortcut-list > div { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 12px; align-items: center; }
.shortcut-list dd { margin: 0; }
kbd { padding: 2px 6px; border: 1px solid #577a7a; border-radius: 4px; font: inherit; }
.pure-peek { position: fixed; z-index: 8; inset: 0 0 auto; display: flex; justify-content: flex-end; align-items: center; gap: var(--gs-space-2); padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) var(--gs-space-6) var(--gs-space-3); background: linear-gradient(color-mix(in srgb, var(--gs-chrome) 72%, transparent), transparent); opacity: 0; transition: opacity 160ms ease-out; }
.pure-peek:hover, .pure-peek:has(:focus-visible) { opacity: 1; }
.pure-exit { min-height: 44px; padding: 0 12px; border: 1px solid #c6ddda; border-radius: 8px; color: #243c45; background: #f1f7f7ed; cursor: pointer; }
/* Touch has no pointer to reach the edge: only the way back stays, faint. */
@media (hover: none) {
  .pure-peek { opacity: 1; background: none; pointer-events: none; }
  .pure-peek .stage-icon-action { display: none; }
  .pure-exit { pointer-events: auto; opacity: .35; }
  .pure-exit:focus-visible { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { .pure-peek { transition: none; } }
.is-pure .stage-header, .is-pure .stage-inspector, .is-pure .performance-hud, .is-pure .rail-summary, .is-pure .position-rail, .is-pure .transport { display: none; }
.is-pure { grid-template-rows: minmax(0, 1fr); }
.is-pure .stage-workspace { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); max-width: none; min-height: 0; height: 100%; padding: 0; }
.is-pure .performance-shell { height: 100%; min-height: 0; border: 0; border-radius: 0; background: transparent; }
.is-pure .performance-viewport { flex: 1 1 0; }
@media (hover: hover) and (pointer: fine) {
  .stage-icon-action:hover { background: var(--gs-chrome-hover); color: var(--gs-surface); }
  .lineup-actions button:not(:disabled):hover, .idol-change-action:not(:disabled):hover { background: var(--gs-paper); }
  .position-marker:not(:disabled):hover { border-color: var(--gs-ink-3); }
}

/* Tabs keep one control task visible while the stage remains in place. */
@media (min-width: 981px) {
  .stage-ambient { display: block; }
  .position-marker.selected { outline: 2px solid var(--gs-mint); outline-offset: -2px; }
  .position-marker:disabled { min-height: 76px; border-color: transparent; background: var(--gs-chrome-hover); }
  .position-marker:disabled :deep(.idol-avatar-shell) { display: none; }
  .rest-position { display: grid; gap: 6px; font-size: 12px; line-height: 1.4; }
  .rest-position small { color: var(--muted); }
  .singing-label { display: inline; }
}
@media (max-width: 980px) {
  .stage-header { padding-right: max(12px, var(--stage-safe-right)); padding-left: max(12px, var(--stage-safe-left)); gap: 8px; }
  .stage-header h1 { font-size: 15px; }
  .stage-header p { display: none; }
  .stage-workspace { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 0; padding: 0 var(--stage-safe-right) var(--stage-safe-bottom) var(--stage-safe-left); }
  .stage-inspector { border-top-left-radius: var(--gs-radius-panel); border-top-right-radius: var(--gs-radius-panel); box-shadow: var(--gs-shadow-float); }
  .performance-shell { height: min(calc((100vw - 16px) * 9 / 16 + 240px), calc(100svh - var(--stage-header-height) - var(--stage-safe-bottom) - 160px)); }
  .mobile-panel-tabs button:disabled { color: var(--gs-line); cursor: default; }
  .control-section { padding: 10px 12px; }
  .transport { grid-template-columns: 44px 48px minmax(110px, auto) minmax(0, 1fr); padding: 6px 8px; }
  select { font-size: 16px; }
  .is-pure .stage-workspace { grid-template-rows: minmax(0, 1fr); padding: 0; }
  .is-pure .performance-shell { height: 100%; }
}

@media (max-width: 620px) {
  .stage-header { padding-right: max(8px, var(--stage-safe-right)); padding-left: max(8px, var(--stage-safe-left)); gap: 4px; }
  .stage-header-title { flex: 1; min-width: 0; }
  .stage-header h1 { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stage-title-full { display: none; }
  .stage-title-compact { display: inline; }
  .stage-header .header-divider { display: none; }
  .stage-header :deep(.archive-language-switch) { margin-left: auto; }
  .lab-link { width: 44px; padding: 0; margin: 0; font-size: 0; flex-shrink: 0; }
  .lab-link::after { content: '1人'; font-size: 12px; }
  .performance-shell { height: min(calc((100vw - 16px) * 9 / 16 + 180px), calc(100svh - var(--stage-header-height) - var(--stage-safe-bottom) - 160px)); }
  .performance-hud { position: absolute; z-index: 7; inset: 0 0 auto; gap: 4px; min-height: 0; padding: 6px; border: 0; background: transparent; pointer-events: none; }
  .performance-identity { display: grid; gap: 2px; padding: 4px 8px; border-radius: var(--gs-radius-control); background: rgb(11 20 36 / 72%); }
  .performance-actions .stage-icon-action { background: rgb(11 20 36 / 55%); }
  .performance-hud strong { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .performance-actions { pointer-events: auto; }
  .position-rail { gap: 2px; padding: 6px 4px; }
  .position-marker { gap: 1px; padding: 3px 1px; }
  .position-marker :deep(.idol-avatar-shell) { --idol-avatar-override-size: 36px; }
  .position-marker .position-caption { gap: 0 2px; min-height: 14px; font-size: var(--gs-text-caption); }
  .position-marker small { font-size: var(--gs-text-caption); line-height: 1.25; }
  .transport { min-height: 58px; grid-template-columns: 44px 44px auto minmax(0, 1fr); gap: 8px; margin: 0 8px 8px; width: calc(100% - 16px); padding: 6px 10px; }
  .transport button, .transport .primary-transport { width: 44px; height: 44px; }
  .transport-copy { position: relative; gap: 0; }
  .transport-copy strong { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
  .transport-copy small { white-space: nowrap; }
  .transport input { grid-column: auto; margin: 0; }
}

@media (max-width: 980px) and (max-height: 500px) and (orientation: landscape) {
  .chibi-stage { --stage-header-height: calc(52px + var(--stage-safe-top)); }
  .stage-title-full { display: none; }
  .stage-title-compact { display: inline; }
  .stage-workspace { grid-template-columns: minmax(0, 1fr) minmax(240px, 32%); grid-template-rows: minmax(0, 1fr); gap: 6px; }
  .performance-shell { height: 100%; }
  .performance-hud { position: absolute; z-index: 7; inset: 0 0 auto; align-items: flex-start; justify-content: space-between; gap: 8px; min-height: 0; padding: 6px; border: 0; background: transparent; pointer-events: none; }
  .performance-identity { display: grid; gap: 2px; flex: 1; min-width: 0; padding: 4px 8px; border-radius: var(--gs-radius-control); background: rgb(11 20 36 / 72%); font-size: var(--gs-text-meta); }
  .performance-hud strong { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .performance-actions { pointer-events: auto; }
  .position-rail { padding: 4px; gap: 4px; }
  .position-marker { grid-template-columns: 32px minmax(0, 1fr); grid-template-rows: auto auto; align-items: center; justify-items: start; gap: 0 4px; min-height: 48px; padding: 3px; }
  .position-marker :deep(.idol-avatar-shell) { --idol-avatar-override-size: 32px; grid-row: 1 / 3; }
  .position-marker .position-caption { justify-content: flex-start; font-size: 10px; }
  .position-marker small { font-size: 11px; }
  .transport { min-height: 58px; grid-template-columns: 44px 44px auto minmax(0, 1fr); gap: 6px; padding: 5px 8px; }
  .transport button, .transport .primary-transport { width: 44px; height: 44px; }
  .transport-copy { position: relative; gap: 0; }
  .transport-copy strong { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  .transport-copy small { white-space: nowrap; }
  .transport input { grid-column: auto; }
  .is-pure .performance-shell { height: 100%; }
}
/* On very short phones, one lower-panel scroller keeps every control reachable. */
@media (max-width: 620px) and (max-height: 650px) and (orientation: portrait) {
  .inspector-scroll.is-song-panel { overflow-y: auto; }
  .song-section { flex: none; height: auto; }
  .song-section :deep(.chibi-song-picker) { flex: none; height: auto; }
  .song-section :deep(.song-library), .song-section :deep(.song-list) { flex: none; }
  .song-section :deep(.song-list) { overflow-y: visible; }
}
@media (pointer: coarse) {
  select { font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .loading-icon { animation: none; }
}
/* Loading only; the adjacent error branch intentionally keeps its own style. */
.stage-state--loading {
  box-sizing: border-box; padding: 18px; min-width: 0; min-height: 0;
  overflow: auto; overscroll-behavior: contain; backdrop-filter: none;
}
.stage-state--loading :deep(.gs-loading-indicator) { max-width: min(22rem, 100%); }
</style>
