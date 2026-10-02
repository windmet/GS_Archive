/** Native Pointer Events: capture both contacts, and release every binding on exit. */
export function bindStudioCanvasInput(view, stage, blurTarget = window) {
  const point = event => {
    const rect = view.getBoundingClientRect();
    if (view.parentElement?.dataset.studioRotation === '90')
      return { x: (event.clientY - rect.top) * 1280 / rect.height,
        y: (rect.right - event.clientX) * 720 / rect.width };
    return { x: (event.clientX - rect.left) * 1280 / rect.width,
      y: (event.clientY - rect.top) * 720 / rect.height };
  };
  const captured = new Set();
  const release = id => {
    captured.delete(id);
    if (view.hasPointerCapture(id)) view.releasePointerCapture(id);
  };
  const cancel = restore => {
    stage.gestures.cancel(restore);
    stage.endInteraction?.();
    for (const id of [...captured]) release(id);
    view.style.cursor = 'default';
  };
  const down = event => {
    if (event.button !== 0) return;
    const p = point(event);
    const intent = stage.gestures.points.size ? null : stage.pointerIntent(p, event.pointerType);
    if (intent?.id && !stage.gestures.points.size) stage.onSelect(intent.id);
    if (!stage.gestures.down(event.pointerId, p, intent)) return;
    event.preventDefault();
    view.focus({ preventScroll: true });
    view.setPointerCapture(event.pointerId);
    captured.add(event.pointerId);
    view.style.cursor = intent?.mode === 'rotate' ? 'grabbing' : intent?.mode === 'scale' ? 'nwse-resize' : 'grabbing';
  };
  const move = event => {
    const p = point(event);
    stage.snapEnabled = !event.altKey;
    if (stage.gestures.move(event.pointerId, p, { shiftKey: event.shiftKey })) { event.preventDefault(); return; }
    if (event.pointerType === 'mouse' && !stage.gestures.points.size) {
      const intent = stage.pointerIntent(p, event.pointerType);
      view.style.cursor = !intent || intent.mode === 'blank' ? 'default'
        : intent.mode === 'scale' ? 'nwse-resize' : intent.mode === 'rotate' ? 'grab' : 'move';
    }
  };
  const up = event => { stage.gestures.up(event.pointerId); if (!stage.gestures.points.size) stage.endInteraction?.(); release(event.pointerId); view.style.cursor = 'default'; };
  const wheel = event => {
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 720 : 1);
    if (!stage.adjustSelected({ point: point(event),
      factor: event.shiftKey ? 1 : Math.exp(-Math.max(-240, Math.min(240, delta)) * .0015),
      angle: event.shiftKey ? Math.max(-15, Math.min(15, delta * .05)) : 0 })) return;
    event.preventDefault();
  };
  const key = event => {
    if (event.key === 'Escape' && stage.gestures.points.size) { event.preventDefault(); cancel(true); return; }
    if (stage.gestures.points.size) return;
    const row = stage.selectedRow();
    if (!row || row.locked || row.hidden || event.ctrlKey || event.metaKey || event.altKey) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = directions[event.key];
    if (delta) {
      const step = event.shiftKey ? .05 : .01;
      stage.applyInteractiveTransform(stage.selectedId, { x: row.x + delta[0] * step, y: row.y + delta[1] * step });
    } else if (['+', '=', '-', '_', '[', ']'].includes(event.key)) {
      stage.adjustSelected({ factor: ['+', '='].includes(event.key) ? 1.1 : ['-', '_'].includes(event.key) ? 1 / 1.1 : 1,
        angle: event.key === '[' ? -5 : event.key === ']' ? 5 : 0 });
    } else return;
    event.preventDefault();
  };
  const blur = () => cancel(false);
  const bindings = [['pointerdown', down], ['pointermove', move], ['pointerup', up],
    ['pointercancel', up], ['lostpointercapture', up], ['wheel', wheel], ['keydown', key]];
  for (const [name, listener] of bindings) view.addEventListener(name, listener, { passive: false });
  blurTarget.addEventListener('blur', blur);
  blurTarget.addEventListener('resize', blur);
  return { cancel, dispose() {
    cancel(false);
    for (const [name, listener] of bindings) view.removeEventListener(name, listener);
    blurTarget.removeEventListener('blur', blur);
    blurTarget.removeEventListener('resize', blur);
  } };
}
