import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue";
import { DomainRepository } from "../../../readmodels/runtime/DomainRepository.mjs";
import {
  createStudioDocument,
  validateStudioDocument,
  validateStudioSources,
  studioObject,
  moveStudioObject,
  STUDIO_LIMITS,
} from "../../core/StudioDocument.mjs";
import { StudioCompositionStage } from "../../core/StudioCompositionStage.js";
import { studioReference } from "../../core/StudioReferences.mjs";
import { verifiedStudioPreset } from "../../core/PictureStudioPolicy.mjs";
import { serializeStudioDocument, parseStudioDocument, readStudioDocumentFile } from "../../core/StudioDocumentFile.mjs";

export function useStudioComposition(props, canvas) {
  const repository = new DomainRepository(props.client, props.bootstrap),
    draft = ref(createStudioDocument()),
    actors = shallowRef([]),
    materials = shallowRef(null),
    media = shallowRef(null),
    views = shallowRef(new Map());
  const busy = ref(true),
    rendering = ref(false),
    error = ref(""),
    status = ref(""),
    selectedId = ref(""),
    playing = ref(false),
    exportUrl = ref(""),
    exportStatus = ref(""),
    exporting = ref(false),
    documentError = ref(""),
    documentStatus = ref(""),
    documentUrl = ref(""),
    documentLoading = ref(false);
  const selected = computed(() => studioObject(draft.value, selectedId.value)),
    selectedActor = computed(() =>
      selected.value?.idolId
        ? views.value.get(String(selected.value.idolId))
        : null,
    );
  const controller = new AbortController(),
    jobs = new Map();
  let stage = null,
    disposed = false,
    serial = 0,
    renderVersion = 0,
    exportVersion = 0,
    documentRequest = 0,
    syncRunning = false,
    syncNeeded = false;
  function clearExport() {
    exportVersion++;
    if (exportUrl.value) URL.revokeObjectURL(exportUrl.value);
    exportUrl.value = "";
    exportStatus.value = "";
  }
  function clearDocumentFile() {
    if (documentUrl.value) URL.revokeObjectURL(documentUrl.value);
    documentUrl.value = "";
    documentStatus.value = "";
  }
  async function actorView(id) {
    id = String(id);
    if (views.value.has(id)) return views.value.get(id);
    if (!jobs.has(id))
      jobs.set(
        id,
        (async () => {
          const row = actors.value.find((row) => row.id === id);
          if (!row) throw Error("偶像不在摄影目录中");
          const value = await repository.detail("photos", row, {
            signal: controller.signal,
          });
          if (!Array.isArray(value.costumes))
            throw Error("摄影构图数据合同未更新");
          if (!disposed) views.value = new Map(views.value).set(id, value);
          return value;
        })().finally(() => jobs.delete(id)),
      );
    return jobs.get(id);
  }
  function select(id) {
    selectedId.value = id;
    stage?.select(id);
  }
  function transform(id, values) {
    const row = studioObject(draft.value, id);
    if (row)
      for (const [key, value] of Object.entries(values))
        row[key] = Math.min(key === "y" ? 3 : 2, Math.max(-1, value));
  }
  function poseFor(view, row) {
    const pose = verifiedStudioPreset(
        view.media,
        "poses",
        row.poseId,
        view.media.entries[`poses:${row.poseId}`].preset.modelId,
      ),
      face = verifiedStudioPreset(
        view.media,
        "faces",
        row.faceId,
        view.media.entries[`faces:${row.faceId}`].preset.modelId,
      );
    return [pose, face];
  }
  async function sync() {
    if (!stage || busy.value || disposed) return;
    syncNeeded = true;
    if (syncRunning) return;
    syncRunning = true;
    rendering.value = true;
    try {
      while (syncNeeded && !disposed) {
        syncNeeded = false;
        const version = renderVersion,
          doc = validateStudioDocument(draft.value);
        await Promise.all(doc.actors.map((row) => actorView(row.idolId)));
        if (version !== renderVersion) continue;
        validateStudioSources(doc, materials.value, views.value);
        for (const key of stage.controllers.keys()) {
          if (
            key.startsWith("actor:") &&
            !doc.actors.some((row) => key === "actor:" + row.instanceId)
          )
            stage.destroyActor(key.slice(6));
          if (
            key.startsWith("sticker:") &&
            !doc.stickers.some((row) => key === "sticker:" + row.instanceId)
          )
            stage.removeSticker(key.slice(8));
        }
        const loads = [];
        for (const row of doc.actors) {
          const view = views.value.get(String(row.idolId)),
            presets = poseFor(view, row),
            model = stage.actorInstances.get(row.instanceId);
          if (model?.modelId !== row.modelId)
            loads.push(
              stage.addActor(row, view.media.models[row.modelId], ...presets),
            );
          else {
            model.row = row;
            if (
              model.presetKey !==
              JSON.stringify([
                ...presets.map((p) => p.label),
                row.poseTime == null,
              ])
            )
              stage.setActorPose(row.instanceId, ...presets);
            stage.setActorTransform(row.instanceId, row);
          }
        }
        for (const row of doc.stickers) {
          if (
            stage.stickerInstances.get(row.instanceId)?.stickerId !==
            row.stickerId
          )
            loads.push(
              stage.addSticker(
                row,
                media.value[`stickers:${row.stickerId}`]?.full,
              ),
            );
          else stage.setStickerTransform(row.instanceId, row);
        }
        loads.push(
          stage.setImages("background", [
            media.value[`scenes:${doc.background.sceneId}`]?.image,
          ]),
          stage.setImages(
            "frame",
            doc.frameId
              ? media.value[`frames:${doc.frameId}`]?.layers || [undefined]
              : [],
          ),
        );
        const results = await Promise.allSettled(loads);
        if (disposed) return;
        if (version !== renderVersion) {
          syncNeeded = true;
          continue;
        }
        const failure = results.find((result) => result.status === "rejected");
        if (failure) throw failure.reason;
        stage.setBackgroundZoom(doc.background.zoom);
        stage.setOrder(doc.actors, doc.stickers);
        stage.setWebFilter(
          materials.value.filters.find((row) => row.id === doc.filterId)
            ?.resourceId || "",
        );
        stage.select(selectedId.value);
        error.value = "";
        status.value = `${doc.actors.length} 人物 · ${doc.stickers.length} 贴纸 · 1280 × 720`;
      }
    } catch (cause) {
      if (!disposed && cause.name !== "AbortError")
        error.value = `画布暂时无法展示：${cause.message}`;
    } finally {
      syncRunning = false;
      if (!disposed) rendering.value = false;
      if (syncNeeded && !disposed) void sync();
    }
  }
  watch(
    draft,
    () => {
      renderVersion++;
      clearExport();
      clearDocumentFile();
      void sync();
    },
    { deep: true },
  );
  watch(selectedId, (id) => stage?.select(id));
  function defaultActor(id, view) {
    const pose = view.actor.poses[0],
      preset = view.media.entries[`poses:${pose.id}`].preset;
    return {
      instanceId: `actor-${++serial}-${Date.now()}`,
      idolId: Number(id),
      modelId: preset.modelId,
      poseId: pose.id,
      faceId: view.actor.faces[0].id,
      x: 0.5,
      y: 0.97,
      scale: 1,
      rotation: 0,
      poseTime: null,
      faceTime: 0,
    };
  }
  async function addActor(id) {
    const request = documentRequest;
    try {
      const view = await actorView(id);
      if (disposed || request !== documentRequest) return;
      if (draft.value.actors.length >= STUDIO_LIMITS.actors)
        throw Error("每张构图最多添加 6 位人物");
      const row = defaultActor(id, view);
      row.x = 0.35 + (draft.value.actors.length % 3) * 0.15;
      draft.value.actors.push(row);
      select(row.instanceId);
    } catch (cause) {
      error.value = cause.message;
    }
  }
  function addSticker(id) {
    if (draft.value.stickers.length >= STUDIO_LIMITS.stickers) {
      error.value = "每张构图最多添加 32 张贴纸";
      return;
    }
    const row = {
      instanceId: `sticker-${++serial}-${Date.now()}`,
      stickerId: Number(id),
      x: 0.5,
      y: 0.3,
      scale: 0.8,
      rotation: 0,
    };
    draft.value.stickers.push(row);
    select(row.instanceId);
  }
  function remove(id) {
    for (const kind of ["actors", "stickers"])
      draft.value[kind] = draft.value[kind].filter(
        (row) => row.instanceId !== id,
      );
    if (selectedId.value === id)
      select(
        draft.value.actors.at(-1)?.instanceId ||
          draft.value.stickers.at(-1)?.instanceId ||
          "",
      );
  }
  function move(id, direction) {
    moveStudioObject(
      draft.value,
      draft.value.actors.some((row) => row.instanceId === id)
        ? "actors"
        : "stickers",
      id,
      direction,
    );
  }
  function setSpot(id) {
    draft.value.background = {
      spotId: Number(id),
      sceneId: materials.value.sceneIdsBySpotId[id][0],
      zoom: 1,
    };
  }
  async function replace(input, request) {
    const doc = validateStudioDocument(input);
    await Promise.all(doc.actors.map((row) => actorView(row.idolId)));
    validateStudioSources(doc, materials.value, views.value);
    if (disposed || request !== documentRequest) return false;
    playing.value = false;
    stage.setPlaying(false);
    draft.value = doc;
    select(doc.actors.at(-1)?.instanceId || "");
    return true;
  }
  async function reference(name) {
    const request = ++documentRequest;
    documentLoading.value = false;
    documentError.value = "";
    documentStatus.value = "";
    try {
      await Promise.all((name === "A" ? [38, 40] : [4, 5, 6]).map(actorView));
      if (request !== documentRequest || disposed) return;
      await replace(studioReference(name, views.value), request);
    } catch (cause) {
      if (request === documentRequest && !disposed) documentError.value = cause.message;
    }
  }
  function reset() {
    if (!selected.value) return;
    Object.assign(selected.value, {
      x: 0.5,
      y: selected.value.idolId ? 0.97 : 0.3,
      scale: 1,
      rotation: 0,
    });
  }
  function togglePlayback() {
    clearExport();
    playing.value = !playing.value;
    stage.setPlaying(playing.value);
  }
  function settleFrame() {
    if (!playing.value) return;
    playing.value = false;
    stage.setPlaying(false);
    clearExport();
  }
  async function exportPng() {
    if (rendering.value || error.value || busy.value) return;
    settleFrame();
    exporting.value = true;
    clearExport();
    const version = exportVersion;
    try {
      const blob = await stage.exportPng();
      if (disposed || version !== exportVersion) return;
      exportUrl.value = URL.createObjectURL(blob);
      exportStatus.value = "PNG 已生成 · 1280 × 720";
    } catch (cause) {
      if (!disposed) exportStatus.value = `导出失败：${cause.message}`;
    } finally {
      exporting.value = false;
    }
  }
  function save() {
    documentError.value = "";
    try {
      settleFrame();
      localStorage.setItem(
        "sidem-studio-document-v1",
        serializeStudioDocument(draft.value),
      );
      documentStatus.value = "构图已保存在此浏览器。";
    } catch (cause) {
      documentStatus.value = "";
      documentError.value = `保存失败：${cause.message}`;
    }
  }
  function exportDocument() {
    documentError.value = "";
    try {
      settleFrame();
      const text = serializeStudioDocument(draft.value);
      if (documentUrl.value) URL.revokeObjectURL(documentUrl.value);
      documentUrl.value = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      documentStatus.value = "构图文件已生成，可保存后继续编辑。";
    } catch (cause) {
      documentError.value = `构图文件无法生成：${cause.message}`;
    }
  }
  async function copyDocument() {
    documentError.value = "";
    try {
      settleFrame();
      await navigator.clipboard.writeText(serializeStudioDocument(draft.value));
      if (!disposed) documentStatus.value = "构图内容已复制，可粘贴保存为 .json 文件。";
    } catch (cause) {
      if (!disposed) documentError.value = `无法复制构图：${cause.message}。可使用「生成构图文件」。`;
    }
  }
  async function loadDocument(read, label) {
    const request = ++documentRequest;
    documentLoading.value = true;
    documentError.value = "";
    documentStatus.value = "";
    try {
      const doc = await read();
      if (disposed || request !== documentRequest) return;
      if (await replace(doc, request)) documentStatus.value = label;
    } catch (cause) {
      if (request === documentRequest && !disposed)
        documentError.value = `载入失败：${cause.message}。当前构图已保留。`;
    } finally {
      if (request === documentRequest && !disposed) documentLoading.value = false;
    }
  }
  async function restore() {
    await loadDocument(() => {
      const value = localStorage.getItem("sidem-studio-document-v1");
      if (!value) throw Error("此浏览器尚未保存构图");
      return parseStudioDocument(value);
    }, "已载入此浏览器保存的构图。");
  }
  async function importDocument(file) {
    if (!file) return;
    await loadDocument(() => readStudioDocumentFile(file), "已载入构图文件。");
  }
  async function load() {
    busy.value = true;
    error.value = "";
    try {
      stage ||= new StudioCompositionStage(canvas.value, {
        onSelect: select,
        onTransform: transform,
      });
      const catalog = await repository.catalog("photos", {
        signal: controller.signal,
      });
      actors.value = catalog.filter((row) => row.id !== "materials");
      const row = catalog.find((row) => row.id === "materials");
      const value = await repository.detail("photos", row, {
        signal: controller.signal,
      });
      if (disposed) return;
      materials.value = value.materials;
      media.value = value.media;
      const doc = createStudioDocument();
      doc.background = {
        spotId: materials.value.spots[0].id,
        sceneId:
          materials.value.sceneIdsBySpotId[materials.value.spots[0].id][0],
      };
      const id = props.photoIdol || actors.value[0].id,
        view = await actorView(id),
        actor = defaultActor(id, view);
      doc.actors = [actor];
      const [kind, seed] = props.photoEntity.split(":");
      if (seed) {
        const key = Number(seed);
        if (["poses", "faces"].includes(kind)) {
          if (!view.actor[kind].some((row) => row.id === key))
            throw Error("预设不属于所选偶像");
          actor[kind === "poses" ? "poseId" : "faceId"] = key;
        } else if (kind === "spots") {
          doc.background = {
            spotId: key,
            sceneId: materials.value.sceneIdsBySpotId[key]?.[0],
          };
        } else if (kind === "scenes") {
          const pair = Object.entries(materials.value.sceneIdsBySpotId).find(
            ([, ids]) => ids.includes(key),
          );
          if (!pair) throw Error("场景缺少地点关联");
          doc.background = { spotId: Number(pair[0]), sceneId: key };
        } else if (kind === "stickers")
          doc.stickers = [
            {
              instanceId: "seed-sticker",
              stickerId: key,
              x: 0.5,
              y: 0.3,
              scale: 0.8,
              rotation: 0,
            },
          ];
        else if (["frames", "filters"].includes(kind))
          doc[kind === "frames" ? "frameId" : "filterId"] = key;
      }
      validateStudioSources(doc, materials.value, views.value);
      draft.value = validateStudioDocument(doc);
      select(actor.instanceId);
      busy.value = false;
      await sync();
    } catch (cause) {
      if (!disposed) {
        busy.value = false;
        error.value = `摄影资料无法读取：${cause.message}`;
      }
    }
  }
  onBeforeUnmount(() => {
    disposed = true;
    controller.abort();
    clearExport();
    clearDocumentFile();
    stage?.destroy();
  });
  return {
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
    remove,
    move,
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
    retry: sync,
  };
}
