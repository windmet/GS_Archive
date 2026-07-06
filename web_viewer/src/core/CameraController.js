import { easeOutCubic, runRafTween } from './rafTween.js'

export class CameraController {
  constructor({
    bgContainer,
    spineContainer,
    getWidth,
    getHeight,
    getBgSprite,
  }) {
    this.bgContainer = bgContainer
    this.spineContainer = spineContainer
    this.getWidth = getWidth
    this.getHeight = getHeight
    this.getBgSprite = getBgSprite

    this._cameraZoom = null
    this._cameraTween = null
  }

  _applyCameraTransform(scale, x, y) {
    const width = this.getWidth()
    const height = this.getHeight()
    const bgScale = Math.max(1, scale)
    const bgSprite = this.getBgSprite?.()
    const bgMinX = bgSprite ? width - ((bgSprite.x + bgSprite.width) * bgScale) : width * 0.5 * (1 - bgScale)
    const bgMaxX = bgSprite ? -bgSprite.x * bgScale : 0
    const bgMinY = bgSprite ? height - ((bgSprite.y + bgSprite.height) * bgScale) : height * 0.5 * (1 - bgScale)
    const bgMaxY = bgSprite ? -bgSprite.y * bgScale : 0

    this.bgContainer.scale.set(bgScale)
    this.bgContainer.x = Math.min(bgMaxX, Math.max(bgMinX, x))
    this.bgContainer.y = Math.min(bgMaxY, Math.max(bgMinY, y))
    this.spineContainer.scale.set(scale)
    this.spineContainer.x = x
    this.spineContainer.y = y
  }

  setCameraZoom(zoomData) {
    const resetDuration = Number(zoomData?.duration || 0)
    if (!zoomData || (zoomData.zoom === 1.0 && zoomData.offset_x === 0 && zoomData.offset_y === 0 && resetDuration <= 0)) {
      this.resetCameraZoom()
      return
    }

    this._cameraZoom = zoomData
    const { zoom, offset_x, offset_y, duration } = zoomData
    const animDuration = duration > 0 ? duration * 1000 : 0
    const width = this.getWidth()
    const height = this.getHeight()
    const coordScale = width / 1280
    const centerX = width / 2
    const targetScale = zoom
    const targetX = centerX * (1 - zoom) - offset_x * coordScale * zoom
    const targetY = height / 2 * (1 - zoom) - offset_y * coordScale * zoom

    this._cameraTween?.cancel?.()

    if (animDuration > 0 && this.spineContainer.scale.x > 0) {
      const startScale = this.spineContainer.scale.x
      const startX = this.spineContainer.x
      const startY = this.spineContainer.y
      this._cameraTween = runRafTween({
        durationMs: animDuration,
        startValue: 0,
        endValue: 1,
        ease: easeOutCubic,
        onUpdate: (t) => {
          this._applyCameraTransform(
            startScale + (targetScale - startScale) * t,
            startX + (targetX - startX) * t,
            startY + (targetY - startY) * t,
          )
        },
      })
    } else {
      this._applyCameraTransform(targetScale, targetX, targetY)
    }
  }

  resetCameraZoom() {
    this._cameraTween?.cancel?.()
    this._cameraZoom = null
    this.bgContainer.scale.set(1)
    this.bgContainer.x = 0
    this.bgContainer.y = 0
    this.spineContainer.scale.set(1)
    this.spineContainer.x = 0
    this.spineContainer.y = 0
  }

  destroy() {
    this._cameraTween?.cancel?.()
    this._cameraTween = null
    this._cameraZoom = null
  }
}
