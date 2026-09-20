// Bound the backing framebuffer by displayed pixels, not virtual scene units.
export function stageRenderResolution(width, height, presentationScale = 1, devicePixelRatio = 1) {
  const scale = Number.isFinite(presentationScale) && presentationScale > 0 ? presentationScale : 1
  const density = Math.min(2, Math.max(1, Number(devicePixelRatio) || 1))
  const pixelBudget = 4 * 1024 * 1024
  return Math.min(density * scale, Math.sqrt(pixelBudget / Math.max(1, width * height)))
}
