<template>
  <div
    class="chibi-stage"
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
    :data-lyrics-enabled="lyricsEnabled"
    :data-backmonitor-movie="currentBackmonitorState.movie || ''"
    :data-backmonitor-event-time="currentBackmonitorState.eventTime"
    :data-backmonitor-transition="currentBackmonitorState.transition || ''"
    :data-backmonitor-transition-active="backmonitorTransitionActive"
    data-backmonitor-transition-mode="alpha-overlay"
    :data-backmonitor-ready="backmonitorReady"
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
    :data-spotlight-count="visibleSpotlightCount"
    :data-stagelight-count="visibleStagelightCount"
    :data-stagelight-colors="appliedStagelightColors"
    data-stagelight-animation="reference-preview-not-native-tween-equivalence"
    :data-spotlight-ids="visibleSpotlightIds.join(',')"
    :data-spotlight-unresolved-ids="unresolvedSpotlightIds.join(',')"
    :data-spotlight-renderer="stageEffectIndex?.spotlight ? 'native-sprites' : 'resources-unavailable'"
    :data-laserlight-count="visibleLaserlightCount"
    :data-laserlight-ids="visibleLaserlightIds.join(',')"
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
    :data-character-light="currentCharacterLight.color"
    :data-body-colors="appliedBodyColors"
    :data-image-colors="appliedImageColors"
    :data-background-component-count="backgroundComponentCount"
    :data-background-tint-conflict="backgroundTintConflict"
  >
    <header class="stage-header">
      <ArchiveBackAction class="stage-back-button" :label="backLabel" icon-only @back="emit('back')" />
      <div class="header-divider" aria-hidden="true"></div>
      <div class="stage-header-title">
        <h1>{{ isSpecialSingle ? '社长特别演出 · 单人 2D' : '舞台小人 · 多人舞台' }}</h1>
        <p>{{ isSpecialSingle ? '社长剪影与舞台对象按原脚本切换' : '选择歌曲与编队，观看舞台演出' }}</p>
      </div>
      <button class="lab-link" type="button" @click="emit('open-lab')">单人实验室</button>
      <ArchiveLanguageSwitch />
      <div class="header-meta">{{ isSpecialSingle ? '社长剪影 · 单人演出' : `${loadedPositions.length}/${activePositions.length} 人就绪` }}</div>
    </header>

    <main class="stage-workspace">
      <section class="performance-shell" :aria-label="isSpecialSingle ? '社长特别演出预览' : '多人舞台预览'">
        <div class="performance-hud">
          <span>NOW PLAYING</span>
          <strong>{{ selectedSong?.title || '—' }}</strong>
          <small>{{ isSpecialSingle ? '社长单人剪影 · 特别版音源' : `${activePositions.length} 人${handoffLineup ? '出场' : '编排'} · 当前演唱 ${currentSingerLabel}` }}</small>
        </div>

        <div class="performance-screen">
        <div class="stage-backdrop" aria-hidden="true"></div>
        <div class="stage-floor" aria-hidden="true"></div>
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

        <div v-if="!isSpecialSingle" class="position-rail" aria-label="舞台站位状态">
          <div
            v-for="position in allPositions"
            :key="position"
            class="position-marker"
            :class="{
              active: activePositions.includes(position),
              loaded: loadedPositions.includes(position),
              singing: currentSingerPositions.includes(position),
            }"
            :data-position="position"
            :data-motion="slotByPosition(position)?.currentMotion || ''"
            :data-motion-source="slotByPosition(position)?.currentMotionSource || ''"
            :data-position-scale="positionDebugState(position).scale"
            :data-position-tween-progress="positionDebugState(position).progress"
          >
            <span>{{ position }}</span>
            <small>{{ characterForSlot(slotByPosition(position))?.name || '空位' }}</small>
          </div>
        </div>

        <div class="transport" :class="{ disabled: !stageTransportReady || preloading }">
          <button type="button" aria-label="回到开头" @click="resetStage">
            <RotateCcw :size="19" />
          </button>
          <button
            class="primary-transport"
            type="button"
            :aria-label="stageStarting ? '取消舞台准备' : isSpecialSingle ? (playing ? '暂停社长特别演出' : '播放社长特别演出') : (playing ? '暂停多人编排' : '播放多人编排')"
            :disabled="!stageStarting && (!stageTransportReady || preloading)"
            @click="toggleStage"
          >
            <Pause v-if="playing || stageStarting" :size="22" fill="currentColor" />
            <Play v-else :size="22" fill="currentColor" />
          </button>
          <div class="transport-copy">
            <strong>{{ preloading ? `正在预载动作 ${preloadProgress}%` : (isSpecialSingle ? (playing ? '社长特别演出播放中' : '社长特别演出已暂停') : (playing ? '多人编排播放中' : '多人编排已暂停')) }}</strong>
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
        <div class="inspector-scroll">
          <section class="control-section song-section">
            <div class="section-heading">
              <div>
                <h2>{{ isSpecialSingle ? '特别演出脚本' : '歌曲编排' }}</h2>
                <span>{{ songs.length }} 首可选演出</span>
              </div>
              <Music2 :size="18" />
            </div>
            <select v-model="selectedSongId" :aria-label="isSpecialSingle ? '特别演出与舞台歌曲' : '多人舞台歌曲'" @change="handleSongChange">
              <option v-for="song in songs" :key="song.id" :value="song.id">
                {{ songOptionLabel(song) }} · {{ song.songCode === 'drv999' ? '社长单人 2D' : `${song.positions.join('/')} 号位` }}
              </option>
            </select>
            <fieldset v-if="stageVocalAvailable" class="stage-vocal-controls">
              <legend>{{ stageVocalLegend }}</legend>
              <label class="camera-toggle">
                <input v-model="stageVocalEnabled" type="checkbox" @change="handleStageVocalToggle" />
                <span>{{ stageVocalToggleLabel }}</span>
              </label>
              <template v-if="stageVocalEnabled">
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
              </template>
              <small>均衡归一化与居中声像是浏览器近似，不代表游戏官方混音参数。</small>
              <small v-if="handoffLineup">已接入歌曲页编成；空位不出场，舞台从 00:00 暂停开始。刷新后使用舞台默认编队。</small>
            </fieldset>
          </section>

          <section v-if="!isSpecialSingle" class="control-section lineup-section">
            <div class="section-heading">
              <div>
                <h2>演出编队</h2>
                <span>站位按舞台从左到右编号</span>
              </div>
              <UsersRound :size="18" />
            </div>

            <article
              v-for="slot in lineup"
              :key="slot.position"
              class="lineup-card"
              :class="{ inactive: !activePositions.includes(slot.position), singing: currentSingerPositions.includes(slot.position) }"
              :data-lineup-position="slot.position"
              :data-runtime-ready="Boolean(runtimeForPosition(slot.position))"
            >
              <div class="slot-number">
                <span>{{ slot.position }}</span>
                <small>{{ activePositions.includes(slot.position) ? (slot.loading ? '加载中' : '出演') : '休息' }}</small>
              </div>
              <div class="slot-controls">
                <select
                  v-model="slot.characterId"
                  :aria-label="`${slot.position}号位角色`"
                  :disabled="!activePositions.includes(slot.position)"
                  @change="handleCharacterChange(slot)"
                >
                  <option value="" disabled>空位</option>
                  <option v-for="character in characters" :key="character.id" :value="character.id">
                    {{ character.name }}
                  </option>
                </select>
                <select
                  v-model="slot.costumeId"
                  :aria-label="`${slot.position}号位服装`"
                  :disabled="!activePositions.includes(slot.position)"
                  @change="loadSlot(slot)"
                >
                  <option v-for="costume in costumesForSlot(slot)" :key="costume.id" :value="costume.id">
                    {{ costume.label }}
                  </option>
                </select>
              </div>
              <Mic2 v-if="currentSingerPositions.includes(slot.position)" class="singing-icon" :size="17" />
            </article>

            <button class="rebuild-button" type="button" :disabled="booting" @click="rebuildStage">
              <RefreshCw :size="16" />重新构建当前编队
            </button>
          </section>

          <details class="advanced-controls">
            <summary>高级控制与演出信息</summary>
          <section class="control-section playback-section">
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
              <p>人物染色、聚光与激光共 {{ stageVfxApproximateCount }} 条，当前采用浏览器近似绘制，尚未对原片逐帧核对。</p>
              <p v-if="stageVfxCoverage.sourceEvents.wholeScreenColorLayer">多层舞台染色 {{ stageVfxCoverage.sourceEvents.wholeScreenColorLayer }} 条已接线，深度合成仍待原片核对。</p>
              <p v-if="stageVfxCoverage.unresolvedColorPlanes.length" class="vfx-coverage-gap">{{ stageVfxCoverage.unresolvedColorPlanes.length }} 条染色指令缺少层编号，暂未应用。</p>
              <p v-if="stageVfxCoverage.unresolvedImageColors.length" class="vfx-coverage-gap">{{ stageVfxCoverage.unresolvedImageColors.length }} 条布景染色指令的原始参数异常，暂未应用。</p>
              <p v-if="backgroundTintConflict" class="vfx-coverage-gap">当前资源包缺少独立背景组件，无法应用各层不同的染色。</p>
              <p>静态对象素材 {{ stageVfxCoverage.objectSprites.length }} 种已接线；粒子试点 {{ stageVfxCoverage.objectParticlePilots.length }} 种已接线，{{ stageVfxCoverage.objectParticleUnimplemented.length }} 种尚未实现。</p>
              <p v-if="stageVfxCoverage.objectMissing.length || stageVfxCoverage.objectOther.length || stageVfxCoverage.missingMedia.length" class="vfx-coverage-gap">另有 {{ stageVfxCoverage.objectMissing.length + stageVfxCoverage.objectOther.length + stageVfxCoverage.missingMedia.length }} 种对象或媒体缺少本地可用实现。</p>
              <details v-if="stageVfxCoverage.objectParticleUnimplemented.length || stageVfxCoverage.objectMissing.length || stageVfxCoverage.objectOther.length">
                <summary>查看未支持的对象素材</summary>
                <code>{{ [...stageVfxCoverage.objectParticleUnimplemented, ...stageVfxCoverage.objectMissing, ...stageVfxCoverage.objectOther].join('、') }}</code>
              </details>
            </div>

            <div class="section-heading">
              <div>
                <h2>播放参数</h2>
                <span>{{ isSpecialSingle ? '歌曲与 2D 舞台对象共用同一时钟' : '歌曲、动作、口型共用同一时钟' }}</span>
              </div>
            </div>
            <label class="range-control">
              <span>速度</span>
              <input v-model.number="playbackSpeed" type="range" min="0.5" max="2" step="0.05" @input="applyPlaybackSpeed" />
              <output>{{ playbackSpeed.toFixed(2) }}×</output>
            </label>
            <label class="camera-toggle">
              <input v-model="cameraEnabled" type="checkbox" @change="applyCameraTransform" />
              <span>启用 CSV 角色镜头</span>
            </label>
            <fieldset class="layer-debug-controls">
              <legend>图层调试</legend>
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
              <label>
                <input v-model="lyricsEnabled" type="checkbox" />
                <span>歌词</span>
              </label>
            </fieldset>
            <label class="range-control view-scale-control">
              <span>总览</span>
              <input
                v-model.number="stageViewScale"
                aria-label="整体视图缩放"
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                @input="applyCameraTransform"
              />
              <output>{{ stageViewScale.toFixed(2) }}×</output>
            </label>
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
            <dl class="runtime-summary">
              <div><dt>演出主体</dt><dd>{{ isSpecialSingle ? '社长单人剪影' : (activePositions.join(' / ') || '—') }}</dd></div>
              <div><dt>当前演唱</dt><dd>{{ isSpecialSingle ? '齋藤孝司' : currentSingerLabel }}</dd></div>
              <div><dt>动作预载</dt><dd>{{ isSpecialSingle ? '2D 对象按需载入' : (preloading ? `${preloadProgress}%` : (songMotionsReady ? '已完成' : '播放时载入')) }}</dd></div>
              <div><dt>音频时钟</dt><dd>{{ stageVocalEnabled ? (stageVocalReady ? '实验伴奏' : '实验声部加载中') : (audioReady ? '官方混音' : '等待加载') }}</dd></div>
              <div v-if="!isSpecialSingle"><dt>位置过渡</dt><dd>{{ POSITION_TWEEN_MS }}ms 平滑插值</dd></div>
              <div><dt>动作组补位</dt><dd>{{ derivedGroupEventCount }} 处</dd></div>
              <div><dt>当前镜头</dt><dd>{{ currentCameraLabel }}</dd></div>
              <div><dt>舞台屏幕</dt><dd>{{ currentBackmonitorLabel }}</dd></div>
              <div><dt>图片布景</dt><dd>{{ visibleImageLayerCount }} 层</dd></div>
              <div><dt>舞台对象</dt><dd>{{ visibleObjectLayerCount }} 组</dd></div>
              <div v-if="stageEffectIndex?.stagelightSongs?.[selectedSong?.songCode]"><dt>固定舞台灯</dt><dd>{{ visibleStagelightCount }} 组 · 原生灯位与配色，闪烁曲线仍在核对</dd></div>
              <div><dt>静态舞台</dt><dd>{{ stageBackgroundReady ? '已载入' : '无/等待' }}</dd></div>
              <div><dt>当前歌词</dt><dd>{{ currentLyric?.text || '—' }}</dd></div>
            </dl>
          </section>
          </details>
          <p v-if="audioError" class="audio-error" role="alert">{{ audioError }}</p>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import ArchiveLanguageSwitch from './archive/ArchiveLanguageSwitch.vue'
import { createPlaybackIntent } from '../core/PlaybackIntent.js'
import { colorLayersAt } from '../core/chibiColorLayers.js'
import { bodyColorsAt, multiplyBodyTint } from '../core/chibiBodyColors.js'
import { imageColorsAt, compositeImageTint } from '../core/chibiImageColors.js'
import GsLoadingIndicator from './GsLoadingIndicator.vue'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowReactive } from 'vue'
import * as PIXI from 'pixi.js'
import {
  CircleAlert,
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
import { stagelightStatesAt, sampleStagelight, createStagelightRuntime } from '../core/chibiStagelights.js'
import { createPinspotlightSprites, destroyPinspotlightSprites, pinspotlightModelForAsset } from '../core/chibiPinspotlightSprites.js'
import { chibiGroundRegistration, projectChibiGround } from '../core/chibiStageCoordinates.js'
import { createSpotlightSpriteStore } from '../core/chibiSpotlightSprites.js'
import { backmonitorRegistration, projectChibiBackmonitor } from '../core/chibiBackmonitorCoordinates.js'
import { imageObjectsAt, imageObjectLayout } from '../core/chibiImageObjects.js'
import { loadChibiParticleLayer, updateChibiParticleLayer } from '../utils/chibiParticleLayers.js'
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
})
const canvasRef = ref(null)
const manifest = ref(null)
const choreography = ref(null)
const lipSyncReady = ref(false)
const lipSyncFrameCount = ref(0)
const musicIndex = ref(null)
const backmonitorIndex = ref(null)
const imageLayerIndex = ref(null)
const imageObjectIndex = ref(null)
const visibleImageObjectCount = ref(0)
const visibleImageObjectAssets = ref([])
const objectLayerIndex = ref(null)
const stageBackgroundIndex = ref(null)
const stageEffectIndex = ref(null)
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
const stageTime = ref(0)
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
const visibleSpotlightCount = ref(0)
const visibleSpotlightIds = ref([])
const unresolvedSpotlightIds = ref([])
const visibleLaserlightCount = ref(0)
const visibleLaserlightIds = ref([])
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
  destroyRuntime: runtime => { runtime.container.removeFromParent(); runtime.container.destroy({ children: true }) },
  destroyTexture: texture => texture.destroy(true),
  onReady: () => syncStagelights(),
  onError: error => console.warn('Native stage lamp textures could not be loaded', error),
})
let stagelightSongId = ''
const spotlightBackgroundAlpha = ref(0)
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
const currentSingerEvent = computed(() => [...(selectedSong.value?.singerEvents || [])]
  .reverse()
  .find(event => event.time <= stageTime.value))
const currentSingerPositions = computed(() => (
  currentSingerEvent.value?.stagePositions
  || currentSingerEvent.value?.singers
  || []
).filter(position => activePositions.value.includes(position)))
const currentSingerPerformerSlots = computed(() => (
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
const currentCameraState = computed(() => cameraStateAt(stageTime.value))
const currentBackmonitorState = computed(() => backmonitorStateAt(stageTime.value))
const currentBackmonitorLabel = computed(() => currentBackmonitorState.value.movie
  ? currentBackmonitorState.value.movie.replace('live_backmonitor_movie_', '')
  : '无')
const currentLyric = computed(() => lyricAt(stageTime.value))
const currentWholeScreenColor = computed(() => wholeScreenColorAt(stageTime.value))
const currentColorPlanes = computed(() => colorLayersAt(selectedSong.value?.wholeScreenColorLayerEvents, stageTime.value))
const visibleColorPlanes = computed(() => lightingEnabled.value
  ? [...currentColorPlanes.value.values()].filter(state => state.alpha > 0.001) : [])
const currentCharacterLight = computed(() => characterLightAt(stageTime.value))
const currentBodyColors = computed(() => bodyColorsAt(selectedSong.value?.bodyColorEvents, stageTime.value))
const currentImageColors = computed(() => imageColorsAt(selectedSong.value?.imageColorEvents, stageTime.value))
const appliedBodyColors = ref('')
const currentCameraLabel = computed(() => {
  if (!cameraEnabled.value) return `${stageViewScale.value.toFixed(2)}× · 总览 · 0.0°`
  const camera = currentCameraState.value
  const focus = camera.stagePosition ? `${camera.stagePosition}号位` : '自由'
  const composedZoom = camera.zoom * STAGE_BASE_ZOOM * stageViewScale.value
  return `${composedZoom.toFixed(2)}× · ${focus} · ${camera.rotation.toFixed(1)}°`
})

let stageDisposed = false
const stageStarting = ref(false)
const stageIntent = createPlaybackIntent(() => `${selectedSong.value?.id || ''}:${stageBuildSequence}`)
const stageAudioOwners = new Map()
onMounted(async () => {
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
    manifest.value = await fetchLiveChibiManifest()
    if (stageDisposed) return
    choreography.value = await fetchLiveChibiChoreography(manifest.value.choreography.index)
    if (stageDisposed) return
    ;[
      musicIndex.value,
      backmonitorIndex.value,
      imageLayerIndex.value,
      imageObjectIndex.value,
      objectLayerIndex.value,
      stageBackgroundIndex.value,
      stageEffectIndex.value,
    ] = await Promise.all([
      fetchLiveChibiMusicIndex(),
      fetchLiveChibiBackmonitorIndex(),
      fetchLiveChibiImageLayerIndex(),
      fetchLiveChibiImageObjectIndex(),
      fetchLiveChibiObjectLayerIndex(),
      fetchLiveChibiStageBackgroundIndex(),
      fetchLiveChibiStageEffectIndex(),
    ])
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
  stageDisposed = true
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
  app.stage.sortableChildren = true
  cameraContainer = markRaw(new PIXI.Container())
  cameraContainer.sortableChildren = true
  backmonitorContainer = markRaw(new PIXI.Container())
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

function costumesForSlot(slot) {
  return characterForSlot(slot)?.costumes || []
}

function costumeForSlot(slot) {
  return costumesForSlot(slot).find(costume => costume.id === slot.costumeId) || null
}

function songOptionLabel(song) {
  const fallback = song?.title || song?.id || ''
  const setting = song?.vocalSetting
  if (!setting) {
    if (!/^solo(?:_|$)/.test(song?.variant || '')) return fallback
    return `${song.title} · 中心一人演出（raw: ${song.variant}）`
  }
  const suffix = song.variant ? ` · ${song.variant}` : ''
  const baseTitle = suffix && fallback.endsWith(suffix)
    ? fallback.slice(0, -suffix.length)
    : fallback
  if (setting.mode === 'formation-or-all-stars') {
    return `${baseTitle} · 编成偶像 / 315 ALL STARS`
  }
  if (setting.mode === 'unit') return `${baseTitle} · ${setting.label}（raw: ${song.variant}）`
  if (setting.mode === 'center') return `${baseTitle} · Center（中心一人 / raw: ${song.variant}）`
  return fallback
}

function ensureCharacterShadowTexture() {
  if (characterShadowTexture) return Promise.resolve(characterShadowTexture)
  if (!characterShadowLoad) {
    const relativePath = manifest.value?.shared?.characterShadow || 'shared/character-shadow.png'
    characterShadowLoad = loadImageLayerTexture(relativePath).then(texture => {
      characterShadowTexture = texture
      return texture
    })
  }
  return characterShadowLoad
}

function destroyStageRuntime(runtime) {
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
    const [runtime, shadowTexture] = await Promise.all([
      createLiveChibi(character, costume),
      ensureCharacterShadowTexture(),
    ])
    if (sequence !== slot.loadSequence || !app) {
      destroyLiveChibi(runtime)
      return
    }
    const groundShadow = markRaw(new PIXI.Sprite(shadowTexture))
    groundShadow.anchor.set(0.5)
    // The source PNG already tops out at 50% alpha; avoid attenuating it a
    // second time or it disappears against the illuminated stage floor.
    groundShadow.alpha = 1
    const stageRuntime = markRaw({
      ...runtime,
      groundShadow,
      loadedMotions: new Map(),
      preloadedSongs: new Set(),
      characterId: character.id,
      costumeId: costume.id,
      stagePosition: slot.position,
    })
    runtimes.set(slot.position, stageRuntime)
    cameraContainer.addChild(stageRuntime.groundShadow)
    cameraContainer.addChild(stageRuntime.spine)
    slot.loading = false
    resizeStage()
    await syncSlotAtTime(slot, stageTime.value, true)
    applyCurrentLipSync()
    applyStageLighting()
  } catch (error) {
    if (sequence !== slot.loadSequence) return
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
  return {
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
  const positionIsNewer = positionState
    && (!event || Number(positionState.time) > Number(event.time))
  return {
    x: Number(positionIsNewer ? positionState.x : (event?.x ?? positionState?.x ?? fallbackX)),
    y: Number(positionIsNewer ? positionState.y : (event?.y ?? positionState?.y ?? 180)),
    scale: Number(positionState?.scale ?? 1700),
    positionState,
  }
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
  const state = {
    movie: null,
    movieTime: 0,
    transition: null,
    transitionTime: 0,
    x: 0,
    y: 360,
    scale: 1000,
    rotation: 0,
    opacity: 1000,
    eventTime: '',
  }
  for (const event of (selectedSong.value?.backmonitorEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    if (event.movie) {
      state.movie = event.movie
      state.movieTime = eventTime
    }
    for (const key of ['x', 'y', 'scale', 'rotation', 'opacity']) {
      if (event[key] !== null && event[key] !== undefined) state[key] = Number(event[key])
    }
    state.transition = event.transition || null
    if (state.transition) state.transitionTime = eventTime
    state.eventTime = eventTime
  }
  return state
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

function characterLightAt(milliseconds) {
  return colorTrackAt(
    selectedSong.value?.characterLightEvents,
    milliseconds,
    { color: 0xffffff, alpha: 1, depth: 1250, eventTime: '' },
    event => ({
      color: mixRgb(
        0xffffff,
        parseHexColor(event.color),
        Math.max(0, Math.min(1, Number(event.opacity) / 1000)),
      ),
      alpha: 1,
      depth: Number(event.depth ?? 1250),
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
    for (const runtime of runtimes.values()) runtime.spine.tint = 0xffffff
    appliedBodyColors.value = ''
    return
  }
  const screen = currentWholeScreenColor.value
  if (wholeScreenColorOverlay) {
    wholeScreenColorOverlay.tint = screen.color
    wholeScreenColorOverlay.alpha = screen.alpha
    wholeScreenColorOverlay.zIndex = screen.depth
    wholeScreenColorOverlay.visible = screen.alpha > 0.001
  }
  const character = currentCharacterLight.value
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
    if (pinspotlightStates.length > 0) {
      runtime.spine.tint = pinspotlightPositions.has(position)
        ? mixRgb(character.color, 0xffffff, 0.5)
        : mixRgb(character.color, pinspotlightDimColor, pinspotlightDim)
    } else {
      runtime.spine.tint = spotlightPositions.has(position)
        ? mixRgb(character.color, 0xffffff, 0.5)
        : spotlightStates.length > 0
          ? mixRgb(character.color, spotlightDimColor, spotlightDim)
          : character.color
    }
    runtime.spine.tint = multiplyBodyTint(runtime.spine.tint, currentBodyColors.value.get(position))
  }
  appliedBodyColors.value = [...runtimes].filter(([position]) => activePositions.value.includes(position))
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
    if (!model || (state.hideTime !== undefined && stageTime.value >= state.hideTime + (state.fadeDuration || 1))) continue
    // Asset belongs in the runtime key: reused lamp IDs must not reuse another prefab.
    const runtime = stagelightSprites.ensure(`${code}:${state.id}:${state.asset}`, model, stageEffectIndex.value.assets)
    if (!runtime) continue
    runtime.container.position.set(width * .5, height * .5)
    runtime.container.scale.set(fit)
    runtime.container.zIndex = state.depth ?? 1600
    runtime.container.visible = true
    for (const [index, sprite] of runtime.sprites.entries()) {
      const lamp = sampleStagelight(state, stageTime.value, index, runtime.sprites.length)
      sprite.tint = lamp.color
      sprite.alpha = lamp.alpha
    }
    visibleStagelightCount.value += 1
    colors.push(`${state.id}:#${runtime.sprites[0].tint.toString(16).padStart(6, '0')}`)
  }
  appliedStagelightColors.value = colors.join(',')
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
  const states = laserlightStatesAt(stageTime.value)
  const active = beamEffectsEnabled.value
    ? [...states.values()].filter(state => (
      state.alpha > 0.001 && state.style && state.color
    ))
    : []
  visibleLaserlightCount.value = active.length
  visibleLaserlightIds.value = active.map(state => state.id).sort((a, b) => a - b)
  for (const [id, runtime] of laserlightRuntimes) {
    runtime.graphics.visible = beamEffectsEnabled.value && Boolean(states.get(id)?.alpha > 0.001)
  }
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const state of active) {
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
}

function releaseLaserlights() {
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
  }
  particleLayerFrames.value = [...objectLayerRuntimes.entries()]
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
  particleLayerFrames.value = ''
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
    if (entry?.kind === 'sprite' || entry?.kind === 'mixed' || entry?.particleAnimation) supportedStates.push(state)
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
  backmonitorSprite.rotation = -state.rotation * Math.PI / 180
  backmonitorSprite.alpha = Math.max(0, Math.min(1, state.opacity / 1000))
  backmonitorSprite.visible = backmonitorEnabled.value && Boolean(state.movie) && state.y < 4000
  if (backmonitorTransitionSprite) {
    backmonitorTransitionSprite.position.copyFrom(backmonitorSprite.position)
    backmonitorTransitionSprite.scale.copyFrom(backmonitorSprite.scale)
    backmonitorTransitionSprite.rotation = backmonitorSprite.rotation
    backmonitorTransitionSprite.alpha = backmonitorSprite.alpha
  }
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
  if (runtime.groundShadow) {
    runtime.groundShadow.position.set(runtime.spine.x, runtime.spine.y + 3 * viewportScale)
    runtime.groundShadow.scale.set(runtime.spine.scale.x * 2.1, runtime.spine.scale.y * 0.42)
    runtime.groundShadow.visible = charactersEnabled.value
      && characterShadowsEnabled.value
      && runtime.spine.visible
    runtime.groundShadow.zIndex = runtime.spine.zIndex - 1
  }
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
  try {
    await Promise.all(targets.map(async ({ runtime }) => {
      await Promise.all(motions.map(async motion => {
        await injectLiveChibiMotion(runtime, motion, { signal:intent.signal, isCurrent: () => intent.current() && runtimes.get(runtime.stagePosition) === runtime })
        if (!intent.current() || runtimes.get(runtime.stagePosition) !== runtime) return
        completed += 1
        preloadProgress.value = Math.round(completed / total * 100)
      }))
      if (intent.current() && runtimes.get(runtime.stagePosition) === runtime) runtime.preloadedSongs.add(songId)
    }))
    if (!intent.current()) return false
    songMotionsReady.value = true
    return true
  } catch (error) {
    if (!intent.current()) return false
    audioError.value = `舞台动作预载失败：${error.message}`
    console.error('[ChibiStage] motion preload failed', error)
    return false
  } finally {
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
  const animationNames = await injectLiveChibiMotion(runtime, motion, { isCurrent: current })
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
      playSlotEvent(slot, events[index])
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
.advanced-controls > summary { min-height: 44px; padding: 14px 18px; box-sizing: border-box; cursor: pointer; font-weight: 600; }
.advanced-controls > summary:focus-visible { outline: 2px solid #168f87; outline-offset: -2px; }
.chibi-stage {
  --ink: #07111f;
  --panel: #102238;
  --line: rgba(167, 197, 228, 0.18);
  --text: #edf5fc;
  --muted: #8ca2b8;
  --accent: #41a5ff;
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--text);
  background: var(--ink);
  font-family: Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif;
}

.stage-header {
  position: sticky;
  z-index: 5;
  top: 0;
  height: 66px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 22px;
  border-bottom: 1px solid var(--line);
  background: rgba(5, 15, 28, 0.96);
}
.stage-header h1 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
.stage-header p { margin: 4px 0 0; color: var(--muted); font-size: 10px; }
.stage-back-button { --archive-back-ink: var(--text); --archive-back-hover: rgba(255, 255, 255, 0.07); border-radius: 8px; }
.header-divider { width: 1px; height: 28px; background: var(--line); }
.header-meta { margin-left: auto; color: var(--muted); font-size: 11px; }
.lab-link { min-height: 44px; margin-left: 8px; padding: 0 13px; color: #dbeeff; background: rgba(30, 109, 184, 0.22); border: 1px solid rgba(65, 165, 255, 0.42); border-radius: 7px; font: 650 11px/1 inherit; cursor: pointer; }

.stage-workspace { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; min-height: 0; max-width: 1600px; margin: 0 auto; padding: 18px; box-sizing: border-box; }
.performance-shell { display: flex; flex-direction: column; align-items: center; width: 100%; min-width: 0; overflow: hidden; border: 1px solid var(--line); border-radius: 12px; background: #0b1726; box-sizing: border-box; }
.performance-screen { position: relative; width: min(100%, calc(clamp(180px, 100svh - 260px, 620px) * 16 / 9)); min-width: 0; aspect-ratio: 16 / 9; overflow: hidden; flex: none; container-type: inline-size; }
.stage-backdrop { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(5, 12, 23, 0.16), rgba(5, 12, 23, 0.04) 55%, rgba(2, 8, 16, 0.62)), url('/assets/bg/bg086_dancestudio_in_01.png') center / cover no-repeat; filter: saturate(0.82) brightness(0.7); transform: scale(1.015); }
.stage-floor { position: absolute; z-index: 1; left: 6%; right: 6%; bottom: 7%; height: 30%; border: 1px solid rgba(104, 180, 245, 0.2); border-radius: 50%; background: radial-gradient(ellipse at center, rgba(67, 163, 241, 0.16), rgba(20, 70, 115, 0.05) 52%, transparent 72%); transform: perspective(500px) rotateX(62deg); transform-origin: center bottom; }
.chibi-stage[data-static-stage-enabled="false"] .stage-backdrop,
.chibi-stage[data-static-stage-enabled="false"] .stage-floor { visibility: hidden; }
.stage-canvas { position: absolute; z-index: 2; inset: 0; }
.stage-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }
.performance-screen::after { content: ""; position: absolute; z-index: 2; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 47%, transparent 28%, rgba(2, 7, 14, 0.34) 100%); }

.performance-hud { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 4px 12px; padding: 12px 16px; width: 100%; box-sizing: border-box; border-bottom: 1px solid var(--line); background: #102238; }
.performance-hud strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.performance-hud small { grid-column: 2; }
.performance-hud span { color: #73bfff; font-size: 9px; font-weight: 750; letter-spacing: 0.16em; }
.performance-hud strong { font-size: 16px; }
.performance-hud small { color: var(--muted); font-size: 10px; }

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

.position-rail { width: 100%; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; padding: 10px 12px; box-sizing: border-box; border-top: 1px solid var(--line); pointer-events: none; }
.position-marker { min-width: 0; display: grid; justify-items: center; gap: 4px; color: rgba(163, 184, 204, 0.3); }
.position-marker span { display: grid; place-items: center; width: 25px; height: 25px; border: 1px solid currentColor; border-radius: 50%; font: 700 10px/1 monospace; background: rgba(5, 14, 25, 0.66); }
.position-marker small { max-width: 110px; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.position-marker.active { color: #9eb7ce; }
.position-marker.loaded span { color: #ddecf9; border-color: rgba(103, 179, 241, 0.64); }
.position-marker.singing { color: #83c8ff; }
.position-marker.singing span { color: white; border-color: #61b7ff; background: rgba(28, 112, 187, 0.7); box-shadow: 0 0 20px rgba(65, 165, 255, 0.48); }

.stage-state { position: absolute; z-index: 6; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #cbd9e7; background: rgba(5, 13, 23, 0.58); backdrop-filter: blur(5px); }
.loading-icon { animation: spin 1s linear infinite; }
.error-state { color: #ffc2c2; text-align: center; }
.error-state span { max-width: 420px; color: #b3c1cf; }
@keyframes spin { to { transform: rotate(360deg); } }

.transport { width: 100%; min-height: 76px; display: grid; grid-template-columns: 44px 48px minmax(110px, auto) minmax(0, 1fr); gap: 12px; align-items: center; padding: 10px 14px; box-sizing: border-box; border-top: 1px solid var(--line); background: #102238; }
.transport.disabled { opacity: 0.62; }
.transport button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; color: #dceaf7; background: #142941; border: 1px solid rgba(151, 192, 227, 0.27); border-radius: 9px; cursor: pointer; }
.transport .primary-transport { width: 48px; height: 48px; border-radius: 50%; border-color: var(--accent); background: rgba(36, 119, 195, 0.56); }
.transport button:disabled { cursor: wait; }
.transport-copy { display: grid; gap: 5px; }
.transport-copy strong { font-size: 12px; }
.transport-copy small { color: var(--muted); font: 600 10px/1 monospace; }
.transport input { width: 100%; accent-color: var(--accent); }

.stage-inspector { min-width: 0; max-height: calc(100svh - 104px); overflow: auto; overscroll-behavior: contain; border: 1px solid var(--line); border-radius: 12px; background: linear-gradient(180deg, #142940, #0c1b2d); }
.inspector-scroll { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; height: auto; }
.control-section { min-width: 0; padding: 16px; box-sizing: border-box; border-bottom: 1px solid var(--line); }
.control-section:last-child { border-right: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; color: #a9c4dd; }
.section-heading > div { display: grid; gap: 4px; }
.section-heading h2 { margin: 0; color: #d9e7f3; font-size: 12px; letter-spacing: 0.06em; }
.section-heading span { color: var(--muted); font-size: 10px; }
select { width: 100%; height: 39px; padding: 0 10px; color: #edf5fc; background: #0e2034; border: 1px solid rgba(158, 192, 222, 0.28); border-radius: 7px; outline: none; font: 500 12px/1 inherit; }
select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(65, 165, 255, 0.12); }
.song-facts { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
.song-facts span { padding: 5px 7px; color: #9eb4c8; background: rgba(4, 14, 25, 0.42); border-radius: 5px; font-size: 9px; }
.stage-vocal-controls { display: grid; gap: 10px; margin: 13px 0 0; padding: 11px 12px 12px; border: 1px solid rgba(65, 165, 255, 0.3); border-radius: 9px; background: rgba(18, 67, 108, 0.16); }
.stage-vocal-controls legend { padding: 0 5px; color: #8ecbff; font-size: 10px; letter-spacing: 0.06em; }
.stage-vocal-controls small { color: var(--muted); font-size: 9px; line-height: 1.5; }
.vfx-coverage { display: grid; gap: 6px; margin-top: 14px; padding: 10px 12px; border: 1px solid rgba(232, 179, 99, .32); border-radius: 9px; background: rgba(100, 68, 33, .14); }
.vfx-coverage h3, .vfx-coverage p { margin: 0; }
.vfx-coverage h3 { color: #f1d0a1; font-size: 12px; }
.vfx-coverage p, .vfx-coverage summary, .vfx-coverage code { color: #c8d5df; font-size: 12px; line-height: 1.55; }
.vfx-coverage .vfx-coverage-gap { color: #ffbd9d; }
.vfx-coverage summary { cursor: pointer; }
.vfx-coverage code { display: block; overflow-wrap: anywhere; margin-top: 5px; }

.lineup-section { display: grid; gap: 9px; }
.lineup-card { position: relative; display: grid; grid-template-columns: 46px minmax(0, 1fr) 18px; gap: 9px; align-items: center; padding: 9px; border: 1px solid rgba(151, 185, 215, 0.17); border-radius: 9px; background: rgba(5, 16, 29, 0.34); transition: opacity 160ms ease, border-color 160ms ease; }
.lineup-card.inactive { opacity: 0.38; }
.lineup-card.singing { border-color: rgba(73, 171, 255, 0.52); background: rgba(27, 101, 166, 0.18); }
.slot-number { display: grid; justify-items: center; gap: 4px; }
.slot-number span { display: grid; place-items: center; width: 30px; height: 30px; color: #e3effa; border: 1px solid rgba(119, 180, 230, 0.5); border-radius: 50%; font: 700 11px/1 monospace; }
.slot-number small { color: var(--muted); font-size: 8px; }
.slot-controls { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 7px; }
.slot-controls select { height: 35px; min-width: 0; }
.singing-icon { color: #6ebcff; }
.rebuild-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; margin-top: 3px; color: #e6f3ff; background: rgba(30, 112, 185, 0.38); border: 1px solid rgba(66, 163, 246, 0.52); border-radius: 8px; font: 650 11px/1 inherit; cursor: pointer; }

.playback-section { display: grid; gap: 13px; }
.range-control { display: grid; grid-template-columns: 36px minmax(0, 1fr) 48px; gap: 9px; align-items: center; color: #c9d9e8; font-size: 11px; }
.range-control input { width: 100%; accent-color: var(--accent); }
.range-control output { text-align: right; font: 650 11px/1 monospace; }
.camera-toggle { display: flex; gap: 8px; align-items: center; color: #c9d9e8; font-size: 11px; }
.camera-toggle input { margin: 0; accent-color: var(--accent); }
.layer-debug-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin: 12px 0 0; padding: 11px 12px 12px; border: 1px solid rgba(111, 174, 229, 0.22); border-radius: 10px; }
.layer-debug-controls legend { padding: 0 5px; color: #8ebfe9; font-size: 10px; letter-spacing: 0.08em; }
.layer-debug-controls label { display: flex; gap: 7px; align-items: center; min-width: 0; color: #c9d9e8; font-size: 11px; }
.layer-debug-controls input { margin: 0; accent-color: var(--accent); }
.runtime-summary { display: grid; gap: 8px; margin: 0; }
.runtime-summary div { display: grid; grid-template-columns: 70px 1fr; gap: 10px; font-size: 10px; }
.runtime-summary dt { color: var(--muted); }
.runtime-summary dd { margin: 0; color: #d8e6f2; }
.audio-error { color: #ff9d9d; font-size: 10px; }

@media (max-width: 980px) {
  .stage-header { height: 58px; padding: 0 13px; }
  .stage-header h1 { font-size: 15px; }
  .stage-header p, .header-meta { display: none; }
  .stage-workspace { grid-template-columns: 1fr; overflow: visible; }
  .performance-screen { width: 100%; }
  .stage-inspector { max-height: none; overflow: visible; }
  .inspector-scroll { grid-template-columns: 1fr; height: auto; overflow: visible; }
  .control-section { height: auto; border-right: 0; }
  .transport { min-height: 72px; grid-template-columns: 40px 50px minmax(110px, auto) minmax(0, 1fr); padding: 10px 12px; }
  .transport button { width: 40px; height: 40px; }
  .transport .primary-transport { width: 50px; height: 50px; }
}

@media (max-width: 620px) {
  .stage-header { height: 52px; padding: 0 8px; gap: 6px; box-sizing: border-box; }
  .stage-header-title { flex: 1; min-width: 0; }
  .stage-header h1 { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stage-header .header-divider { display: none; }
  .stage-header :deep(.archive-language-switch) { margin-left: auto; }
  .lab-link { width: 44px; padding: 0; margin: 0; font-size: 0; flex-shrink: 0; }
  .lab-link::after { content: '1人'; font-size: 12px; }
  .stage-workspace { padding: 8px; gap: 10px; padding-bottom: max(16px, env(safe-area-inset-bottom)); }
  .performance-hud { grid-template-columns: minmax(0, 1fr); padding: 9px 12px; }
  .performance-hud span { display: none; }
  .performance-hud small { grid-column: 1; }
  .performance-hud strong { font-size: 14px; }
  .position-rail { gap: 2px; padding: 8px 4px; }
  .position-marker small { max-width: 58px; }
  .transport { grid-template-columns: 38px 44px minmax(0, 1fr); gap: 6px 10px; padding: 8px 12px; }
  .transport button, .transport .primary-transport { width: 38px; height: 38px; }
  .transport input { grid-column: 1 / -1; margin: 0; }
  .slot-controls { grid-template-columns: 1fr; }
}

@media (max-width: 980px) and (max-height: 500px) and (orientation: landscape) {
  .stage-header { height: 48px; }
  .stage-workspace { padding: 6px; gap: 10px; }
  .performance-screen { width: min(100%, calc(clamp(140px, 100svh - 210px, 290px) * 16 / 9)); }
  .performance-hud { padding: 6px 12px; }
  .performance-hud small { display: none; }
  .performance-hud strong { font-size: 14px; }
  .position-rail { padding: 4px; gap: 2px; }
  .position-marker { gap: 2px; }
  .position-marker span { width: 18px; height: 18px; font-size: 9px; }
  .position-marker small { font-size: 8px; }
  .transport { min-height: 48px; grid-template-columns: 38px 38px minmax(110px, auto) minmax(0, 1fr); gap: 8px; padding: 5px 10px; }
  .transport button, .transport .primary-transport { width: 38px; height: 38px; }
  .transport input { grid-column: auto; }
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
