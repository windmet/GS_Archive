/** Static compositions render once per invalidation; only preview owns a ticker. */
export function createStudioRenderLoop({ app, draw, animate, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
  let frame = null, playing = false, hidden = false, disposed = false;
  const cancel = () => { if (frame !== null) cancelFrame(frame); frame = null; };
  const invalidate = () => {
    if (disposed || hidden || playing || frame !== null) return;
    frame = requestFrame(() => { frame = null; if (!disposed && !hidden && !playing) draw(); });
  };
  const tick = () => { if (!disposed && !hidden && playing) animate(Math.min(.05, app.ticker.deltaMS / 1000)); };
  app.stop();
  app.ticker.add(tick);
  return {
    invalidate,
    setPlaying(value) {
      playing = !!value;
      cancel();
      if (playing && !hidden && !disposed) app.start();
      else { app.stop(); invalidate(); }
    },
    setHidden(value) {
      hidden = !!value;
      cancel();
      if (playing && !hidden && !disposed) app.start();
      else { app.stop(); invalidate(); }
    },
    dispose() { disposed = true; cancel(); app.stop(); app.ticker.remove(tick); },
  };
}
