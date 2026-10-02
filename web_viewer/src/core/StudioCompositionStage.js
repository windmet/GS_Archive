import * as PIXI from "pixi.js";
import {
  Spine,
  SkeletonBinary,
  AtlasAttachmentLoader,
} from "@pixi-spine/runtime-3.8";
import { TextureAtlas, MixBlend } from "@pixi-spine/base";
import { loadAndCreateSpine } from "./spineSpawnPipeline.js";
import { loadImageTexture } from "./loadImageTexture.js";
import { createStoryAssetTransport } from "./StoryAssetTransport.js";
import { decodeSpineAtlasText } from "../../shared/story/SpineAtlasPages.js";
import { decodeUnitySpineSkeleton } from "../../shared/story/SpineBinary.js";
import { neckOverlayAnimation } from "./spineNeckOverlay.js";
import { studioFramePlacement } from "./StudioFramePlacement.mjs";
import { studioActorPlacement, studioActorPoseBounds, studioActorSelectionBounds } from "./StudioActorPlacement.mjs";
import { StudioGestures, studioTransformAround, studioTransformPatch, studioSelectionControls, studioSnapMove } from './StudioGestures.mjs';
import { bindStudioCanvasInput } from './StudioCanvasInput.mjs';
import { studioSkeletonContains, studioStickerContains } from './StudioHitTest.js';
import {
  STUDIO_WIDTH as W,
  STUDIO_HEIGHT as H,
  studioExportSize,
  studioAnimationPlan,
} from "./PictureStudioPolicy.mjs";

/** Per-instance requests, textures, animation state and transforms; no Player cache. */
export class StudioCompositionStage {
  constructor(container, { onSelect = () => {}, onTransform = () => {}, onInteraction = () => {} } = {}) {
    this.disposed = false;
    this.controllers = new Map();
    this.actorInstances = new Map();
    this.stickerInstances = new Map();
    this.images = new Map();
    this.playing = false;
    this.onSelect = onSelect;
    this.onTransform = onTransform;
    this.onInteraction = onInteraction;
    this.guides = [];
    this.snapEnabled = true;
    this.selectedId = "";
    this.transport = createStoryAssetTransport({
      maxBytes: 24 * 1024 * 1024,
      maxEntries: 48,
    });
    this.app = new PIXI.Application({
      width: W,
      height: H,
      resolution: 1,
      antialias: true,
      backgroundColor: 0xe5eef5,
    });
    this.app.view.setAttribute("aria-label", "摄影画布");
    this.app.view.setAttribute("role", "img");
    this.app.view.tabIndex = 0;
    container.appendChild(this.app.view);
    this.backgroundLayer = new PIXI.Container();
    this.actorLayer = new PIXI.Container();
    this.stickerLayer = new PIXI.Container();
    this.frameLayer = new PIXI.Container();
    this.picture = new PIXI.Container();
    this.picture.addChild(this.backgroundLayer, this.actorLayer);
    this.outline = new PIXI.Graphics();
    this.app.stage.addChild(
      this.picture,
      this.stickerLayer,
      this.frameLayer,
      this.outline,
    );
    this.app.ticker.maxFPS = 30;
    this.tick = () => {
      for (const model of this.actorInstances.values())
        this.updateModel(
          model,
          this.playing ? Math.min(0.05, this.app.ticker.deltaMS / 1000) : 0,
        );
      this.drawSelection();
    };
    this.app.ticker.add(this.tick);
    this.visibility = () => {
      if (document.hidden) { this.input.cancel(false); this.app.stop(); }
      else this.app.start();
    };
    document.addEventListener("visibilitychange", this.visibility);
    this.gestures = new StudioGestures({ getRow: id => this.row(id),
      onTransform: (id, patch) => this.applyInteractiveTransform(id, patch) });
    this.input = bindStudioCanvasInput(this.app.view, this);
  }
  owner(key) {
    this.controllers.get(key)?.abort();
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return {
      signal: controller.signal,
      current: () =>
        !this.disposed &&
        !controller.signal.aborted &&
        this.controllers.get(key) === controller,
    };
  }
  texture(url, signal, spine = false) {
    return loadImageTexture(url, {
      signal,
      allowFallback: false,
      alphaMode: spine ? PIXI.ALPHA_MODES.PMA : PIXI.ALPHA_MODES.UNPACK,
      createBaseTexture: (image) => new PIXI.BaseTexture(image),
      createTexture: (base) => new PIXI.Texture(base),
      releaseFailedBase: (base) => base.destroy(),
    });
  }
  render() {
    if (!this.disposed) {
      this.drawSelection();
      this.app.renderer.render(this.app.stage);
    }
  }
  select(id) {
    if (id !== this.selectedId) this.input?.cancel(false);
    this.selectedId = id;
    this.drawSelection();
  }
  row(id) {
    return this.actorInstances.get(id)?.row || this.stickerInstances.get(id)?.row;
  }
  selectedRow() { return this.row(this.selectedId); }
  selectionControls() {
    const actor = this.actorInstances.get(this.selectedId);
    const object = actor?.spine || this.stickerInstances.get(this.selectedId)?.sprite;
    if (!object?.visible) return null;
    const bounds = actor ? studioActorSelectionBounds(object) : object.getBounds();
    const rect = this.app.view.getBoundingClientRect();
    const cssWidth = this.app.view.parentElement?.dataset.studioRotation === '90' ? rect.height : rect.width;
    return studioSelectionControls(bounds, cssWidth);
  }
  drawSelection() {
    this.outline.clear();
    const controls = this.selectionControls();
    if (controls) {
      const { rect, unit, rotate, corners } = controls;
      const locked = this.selectedRow()?.locked;
      this.outline
        .lineStyle(1.5 * unit, locked ? 0x95a6a3 : 0x50c7a4, 0.9)
        .drawRect(rect.x, rect.y, rect.right - rect.x, rect.bottom - rect.y);
      if (!locked) {
        for (const corner of corners) this.outline.beginFill(0xffffff).drawRoundedRect(corner.x - 5 * unit, corner.y - 5 * unit, 10 * unit, 10 * unit, 2 * unit).endFill();
        this.outline.beginFill(0xffffff).drawCircle(rotate.x, rotate.y, 9 * unit).endFill()
          .lineStyle(1.5 * unit, 0x076b54).arc(rotate.x, rotate.y, 4.5 * unit, -.8, 4.3)
          .moveTo(rotate.x - 5 * unit, rotate.y - 5 * unit).lineTo(rotate.x - 5 * unit, rotate.y);
      }
      this.outline.lineStyle(unit, 0x80c7ff, .9);
      for (const guide of this.guides || []) {
        const extent = guide.axis === 'x' ? H : W;
        for (let i = 0; i < extent; i += 12 * unit) {
          const end = Math.min(i + 6 * unit, extent);
          if (guide.axis === 'x') this.outline.moveTo(guide.value, i).lineTo(guide.value, end);
          else this.outline.moveTo(i, guide.value).lineTo(end, guide.value);
        }
      }
    }
  }
  pointerIntent(point, pointerType = 'mouse') {
    const controls = this.selectionControls();
    if (controls && !this.selectedRow()?.locked) {
      const radius = (pointerType === 'mouse' ? 10 : 22) * controls.unit;
      for (const corner of controls.corners)
        if (Math.hypot(point.x - corner.x, point.y - corner.y) <= radius)
          return { id: this.selectedId, mode: 'scale', center: controls.center };
      if (Math.hypot(point.x - controls.rotate.x, point.y - controls.rotate.y) <= radius)
        return { id: this.selectedId, mode: 'rotate', center: controls.center };
      if (pointerType === 'mouse')
        for (const corner of controls.corners)
          if ((point.x < controls.rect.x || point.x > controls.rect.right || point.y < controls.rect.y || point.y > controls.rect.bottom) && Math.hypot(point.x - corner.x, point.y - corner.y) <= 25 * controls.unit)
            return { id: this.selectedId, mode: 'rotate', center: controls.center };
    }
    const hit = this.hitTest(point);
    if (!hit && controls && !this.selectedRow()?.locked && point.x >= controls.rect.x && point.x <= controls.rect.right && point.y >= controls.rect.y && point.y <= controls.rect.bottom)
      return { id: this.selectedId, mode: 'move' };
    return hit ? { id: hit, mode: 'move' }
      : this.selectedRow() ? { id: this.selectedId, mode: 'blank' } : null;
  }
  hitTest(point) {
    const p = new PIXI.Point(point.x, point.y);
    for (const sprite of [...this.stickerLayer.children].reverse()) {
      const entry = this.stickerInstances.get(sprite.name);
      if (sprite.visible && entry && !entry.row.locked && !entry.row.hidden && studioStickerContains(entry, p)) return sprite.name;
    }
    for (const spine of [...this.actorLayer.children].reverse())
      if (spine.visible && !this.row(spine.name)?.locked && !this.row(spine.name)?.hidden && studioSkeletonContains(spine.skeleton, spine.toLocal(p))) return spine.name;
    return '';
  }
  applyInteractiveTransform(id, values) {
    const actor = this.actorInstances.get(id), sticker = this.stickerInstances.get(id);
    const model = actor || sticker;
    if (!model || model.row.locked || model.row.hidden) return;
    let patch = studioTransformPatch(values);
    this.guides = [];
    if (this.snapEnabled && this.gestures?.mode === 'move' && this.gestures.points.size === 1) {
      const bounds = actor ? studioActorSelectionBounds(actor.spine) : sticker.sprite.getBounds();
      const snapped = studioSnapMove(model.row, patch, bounds, 6 * W / this.app.view.getBoundingClientRect().width, !!actor);
      patch = snapped.patch; this.guides = snapped.guides;
    }
    const row = { ...model.row, ...patch };
    if (actor) this.setActorTransform(id, row);
    else this.setStickerTransform(id, row);
    this.onTransform(id, patch);
    if (this.gestures?.points.size) this.onInteraction?.({ mode: this.gestures.mode, rotation: Math.round(row.rotation), aligned: this.guides.length > 0 });
    this.render();
    return patch;
  }
  endInteraction() { this.guides = []; this.onInteraction?.(null); }
  adjustSelected({ point, factor = 1, angle = 0 } = {}) {
    const row = this.selectedRow(), center = point || this.selectionControls()?.center;
    if (!row || row.locked || row.hidden || !center || this.gestures.points.size) return false;
    this.applyInteractiveTransform(this.selectedId, studioTransformAround(row, center, center, factor, angle));
    return true;
  }
  destroyActor(id) {
    if (this.gestures?.id === id) this.input.cancel(false);
    this.controllers.get("actor:" + id)?.abort();
    this.controllers.delete("actor:" + id);
    const model = this.actorInstances.get(id);
    if (model) {
      model.spine.destroy({
        children: true,
        texture: false,
        baseTexture: false,
      });
      for (const texture of model.textures) texture.destroy(true);
      this.actorInstances.delete(id);
    }
  }
  async addActor(row, binding, pose, face) {
    this.destroyActor(row.instanceId);
    const current = this.owner("actor:" + row.instanceId),
      textures = new Set();
    try {
      const result = await loadAndCreateSpine({
        modelId: row.modelId,
        atlasUrl: binding.atlas.url,
        skelUrl: binding.skeleton.url,
        decodeAtlasText: decodeSpineAtlasText,
        decodeSkelBuffer: decodeUnitySpineSkeleton,
        Spine,
        SkeletonBinary,
        AtlasAttachmentLoader,
        TextureAtlas,
        signal: current.signal,
        transport: this.transport,
        resolveTextureUrl: async (_, page) => {
          const bound = binding.textures.find((entry) =>
            entry.url.endsWith("/" + page),
          );
          if (!bound?.url) throw Error("模型纹理页没有明确绑定");
          return bound.url;
        },
        loadTextureFromUrl: async (url, { signal }) => {
          const texture = await this.texture(url, signal, true);
          if (!current.current()) {
            texture.destroy(true);
            throw new DOMException("Aborted", "AbortError");
          }
          textures.add(texture);
          return texture;
        },
      });
      if (!current.current()) {
        result.spine.destroy({
          children: true,
          texture: false,
          baseTexture: false,
        });
        throw new DOMException("Aborted", "AbortError");
      }
      if (!result.hasMeshOrRegion) {
        result.spine.destroy({
          children: true,
          texture: false,
          baseTexture: false,
        });
        throw Error("模型没有可展示的图像附件");
      }
      const spine = result.spine;
      spine.name = row.instanceId;
      spine.autoUpdate = false;
      const model = {
        modelId: row.modelId,
        spine,
        textures,
        names: result.animNames,
        neckBones: [],
        neckSlots: [],
        flags: {},
        row,
      };
      this.actorInstances.set(row.instanceId, model);
      this.actorLayer.addChild(spine);
      this.setActorPose(row.instanceId, pose, face);
      this.setActorTransform(row.instanceId, row);
    } catch (error) {
      if (this.actorInstances.get(row.instanceId)?.textures === textures)
        this.destroyActor(row.instanceId);
      else
        for (const texture of textures)
          if (!texture.destroyed) texture.destroy(true);
      throw error;
    }
  }
  setActorPose(id, pose, face) {
    const model = this.actorInstances.get(id);
    if (!model) throw Error("模型尚未载入");
    const { spine } = model;
    try {
      const plan = studioAnimationPlan(pose, face, model.names);
      spine.state.clearTracks();
      spine.skeleton.setToSetupPose();
      spine.visible = !model.row.hidden;
      const settled = plan.motion + "_loop",
        motion =
          !this.playing &&
          model.row.poseTime == null &&
          model.names.includes(settled)
            ? settled
            : plan.motion;
      const body = spine.state.setAnimation(
        0,
        motion,
        motion.endsWith("_loop"),
      );
      if (
        this.playing &&
        !motion.endsWith("_loop") &&
        model.names.includes(settled)
      )
        spine.state.addAnimation(0, settled, true, 0);
      body.mixDuration = 0;
      if (!this.playing && !plan.motion.endsWith("_loop"))
        body.trackTime = body.animation.duration;
      const expression = spine.state.setAnimation(1, plan.face, true);
      expression.mixDuration = 0;
      const command =
        face.commands.find((c) => c.type === "idol_face") ||
        pose.commands.find((c) => c.type === "idol_face");
      model.flags = {
        sweat: command?.values[4] === "汗",
        blush: command?.values[5] === "チーク",
      };
      model.neckBones = [];
      model.neckSlots = [];
      if (plan.neck) {
        const neck = spine.state.setAnimation(3, plan.neck, false);
        neck.animation = neckOverlayAnimation(
          neck.animation,
          spine.skeleton.data,
        );
        neck.mixBlend = MixBlend.add;
        neck.mixDuration = 0;
        neck.trackTime = this.playing ? 0 : neck.animation.duration;
        model.neckBones = [
          ...new Set(
            neck.animation.timelines
              .map((t) => t.boneIndex)
              .filter(Number.isInteger),
          ),
        ];
        model.neckSlots = [
          ...new Set(
            neck.animation.timelines
              .map((t) => t.slotIndex)
              .filter(Number.isInteger),
          ),
        ];
      }
      model.presetKey = JSON.stringify([
        pose.label,
        face.label,
        model.row.poseTime == null,
      ]);
      model.pose = pose;
      model.face = face;
      this.applyFrame(model);
      this.updateModel(model, 0);
      return plan;
    } catch (error) {
      spine.visible = false;
      throw error;
    }
  }
  applyFrame(model) {
    if (this.playing) return;
    const body = model.spine.state.getCurrent(0),
      face = model.spine.state.getCurrent(1);
    if (body)
      body.trackTime =
        model.row.poseTime ?? (body.loop ? 0 : body.animation.duration);
    if (face) face.trackTime = model.row.faceTime ?? 0;
  }
  refreshActorPlacement(model) {
    if (model.row.layoutBasis === 'pose-bounds') {
      // Legacy v1 coordinates use the document's final pose, never a previous
      // pose or a moving preview frame. Recompute on static document changes.
      if (this.playing) return;
      const bounds = studioActorPoseBounds(model.spine.skeleton);
      model.baseScale = Math.min(H * .9 / bounds.height, W * .7 / bounds.width);
      model.spine.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height);
    } else {
      const placement = studioActorPlacement(model.spine.skeleton.data);
      model.baseScale = placement.baseScale;
      model.spine.pivot.set(placement.pivotX, placement.pivotY);
    }
    model.spine.scale.set(model.baseScale * model.row.scale);
  }
  updateModel(model, delta) {
    const { spine } = model;
    for (const index of model.neckBones)
      spine.skeleton.bones[index]?.setToSetupPose();
    for (const index of model.neckSlots)
      if (spine.skeleton.slots[index]?.deform)
        spine.skeleton.slots[index].deform.length = 0;
    spine.update(delta);
    for (const slot of spine.skeleton.slots) {
      if (/cheek/i.test(slot.data.name) && !model.flags.blush) slot.color.a = 0;
      if (/^(swet|sweat)\b/i.test(slot.data.name) && !model.flags.sweat)
        slot.color.a = 0;
    }
    this.refreshActorPlacement(model);
  }
  setActorTransform(id, row) {
    const model = this.actorInstances.get(id);
    if (!model?.baseScale) return;
    model.row = row;
    model.spine.visible = !row.hidden;
    this.applyFrame(model);
    model.spine.scale.set(model.baseScale * row.scale);
    model.spine.position.set(W * row.x, H * row.y);
    model.spine.rotation = (row.rotation * Math.PI) / 180;
  }
  removeSticker(id) {
    if (this.gestures?.id === id) this.input.cancel(false);
    this.controllers.get("sticker:" + id)?.abort();
    this.controllers.delete("sticker:" + id);
    const entry = this.stickerInstances.get(id);
    if (entry) {
      entry.sprite.destroy({ texture: false, baseTexture: false });
      entry.texture.destroy(true);
      this.stickerInstances.delete(id);
    }
  }
  async addSticker(row, binding) {
    this.removeSticker(row.instanceId);
    const owner = this.owner("sticker:" + row.instanceId);
    if (!binding?.url) throw Error("贴纸文件尚未绑定");
    const texture = await this.texture(binding.url, owner.signal);
    if (!owner.current()) {
      texture.destroy(true);
      throw new DOMException("Aborted", "AbortError");
    }
    const sprite = new PIXI.Sprite(texture);
    sprite.name = row.instanceId;
    sprite.anchor.set(0.5);
    let alpha = null;
    try {
      const probe = document.createElement('canvas');
      probe.width = texture.width; probe.height = texture.height;
      const context = probe.getContext('2d', { willReadFrequently: true });
      context.drawImage(texture.baseTexture.resource.source, 0, 0);
      alpha = context.getImageData(0, 0, probe.width, probe.height).data;
    } catch { /* A remote texture without pixel access still has its bounded hit area. */ }
    this.stickerInstances.set(row.instanceId, {
      sprite,
      texture,
      stickerId: row.stickerId,
      row,
      alpha,
    });
    this.stickerLayer.addChild(sprite);
    this.setStickerTransform(row.instanceId, row);
  }
  setStickerTransform(id, row) {
    const entry = this.stickerInstances.get(id);
    if (!entry) return;
    entry.row = row;
    entry.sprite.visible = !row.hidden;
    entry.sprite.position.set(W * row.x, H * row.y);
    entry.sprite.scale.set(row.scale);
    entry.sprite.rotation = (row.rotation * Math.PI) / 180;
  }
  setOrder(actors, stickers) {
    for (const row of actors) {
      const model = this.actorInstances.get(row.instanceId);
      if (model)
        this.actorLayer.setChildIndex(
          model.spine,
          this.actorLayer.children.length - 1,
        );
    }
    for (const row of stickers) {
      const entry = this.stickerInstances.get(row.instanceId);
      if (entry)
        this.stickerLayer.setChildIndex(
          entry.sprite,
          this.stickerLayer.children.length - 1,
        );
    }
    this.render();
  }
  setBackgroundZoom(zoom = 1) {
    for (const entry of this.images.get("background")?.loaded || [])
      entry.sprite.scale.set(
        Math.max(W / entry.texture.width, H / entry.texture.height) * zoom,
      );
  }
  setPlaying(value) {
    value = !!value;
    if (value === this.playing) return;
    this.playing = value;
    // Preview starts the source motion and its verified loop. Leaving preview
    // reconstructs the document's frame, including face and neck tracks.
    for (const [id, model] of this.actorInstances)
      this.setActorPose(id, model.pose, model.face);
    this.render();
  }
  setWebFilter(resourceId = "") {
    if (this.filterId === resourceId) return;
    this.filterId = resourceId;
    this.picture.filters = null;
    this.filter?.destroy();
    this.filter = null;
    if (!resourceId) return;
    const filter = new PIXI.ColorMatrixFilter();
    if (["sepia", "sepia_light"].includes(resourceId)) filter.sepia();
    else if (["gray", "mono"].includes(resourceId)) filter.desaturate();
    else throw Error("此滤镜没有网页近似实现");
    const strength =
        resourceId === "sepia_light" ? 0.35 : resourceId === "gray" ? 0.6 : 1,
      identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    filter.matrix = filter.matrix.map(
      (v, i) => identity[i] + (v - identity[i]) * strength,
    );
    this.filter = filter;
    this.picture.filters = [filter];
  }
  clearImages(key) {
    for (const entry of this.images.get(key)?.loaded || []) {
      entry.sprite.destroy({ texture: false, baseTexture: false });
      entry.texture.destroy(true);
    }
    this.images.delete(key);
  }
  async setImages(key, bindings = []) {
    const signature = JSON.stringify(bindings.map((b) => b?.url));
    if (this.images.get(key)?.signature === signature) return;
    const owner = this.owner(key);
    this.clearImages(key);
    const loaded = [];
    try {
      for (const binding of bindings) {
        if (!binding?.url) throw Error("素材文件尚未绑定");
        const texture = await this.texture(binding.url, owner.signal);
        if (!owner.current()) {
          texture.destroy(true);
          throw new DOMException("Aborted", "AbortError");
        }
        const sprite = new PIXI.Sprite(texture);
        loaded.push({ sprite, texture });
        if (key === "background") {
          sprite.anchor.set(0.5);
          sprite.scale.set(Math.max(W / texture.width, H / texture.height));
          sprite.position.set(W / 2, H / 2);
        } else {
          sprite.scale.set(
            Math.min(1.5, 340 / texture.width, 220 / texture.height),
          );
          const placement = studioFramePlacement(loaded.length - 1, W, H);
          sprite.anchor.set(placement.anchorX, placement.anchorY);
          sprite.position.set(placement.x, placement.y);
        }
      }
      if (!owner.current()) throw new DOMException("Aborted", "AbortError");
      this.images.set(key, { signature, loaded });
      for (const entry of loaded)
        (key === "background"
          ? this.backgroundLayer
          : this.frameLayer
        ).addChild(entry.sprite);
    } catch (error) {
      for (const entry of loaded) {
        entry.sprite.destroy({ texture: false, baseTexture: false });
        entry.texture.destroy(true);
      }
      throw error;
    }
  }
  async exportPng() {
    if (
      this.disposed ||
      ![...this.actorInstances.values()].every((m) => m.row.hidden || m.spine.visible)
    )
      throw Error("画布尚未准备好");
    this.setPlaying(false);
    for (const model of this.actorInstances.values())
      this.updateModel(model, 0);
    this.outline.visible = false;
    try {
      this.app.renderer.render(this.app.stage);
      const source = this.app.renderer.extract.canvas(),
        size = studioExportSize(),
        canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw Error("浏览器没有可用的导出画布");
      context.drawImage(source, 0, 0, size.width, size.height);
      return await new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(Error("PNG 编码失败"))),
          "image/png",
        ),
      );
    } catch (error) {
      if (error.name === "SecurityError")
        throw Error("图片跨域权限不允许导出。");
      throw error;
    } finally {
      this.outline.visible = true;
    }
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.controllers.values()) controller.abort();
    this.transport.clear();
    document.removeEventListener("visibilitychange", this.visibility);
    this.input.dispose();
    for (const id of this.actorInstances.keys()) this.destroyActor(id);
    for (const id of this.stickerInstances.keys()) this.removeSticker(id);
    for (const key of this.images.keys()) this.clearImages(key);
    this.filter?.destroy();
    this.app.ticker.remove(this.tick);
    this.app.destroy(true, {
      children: true,
      texture: false,
      baseTexture: false,
    });
  }
}
