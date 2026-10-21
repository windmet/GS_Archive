import { runRafTween } from './rafTween.js'
import { cameraScreenTransform } from '../../shared/story/AdvStageLayout.js'

export class CameraController {
  constructor({
    bgContainer,
    spineContainer,
    getWidth,
    getHeight,
    onCameraMove = null,
  }) {
    this.bgContainer = bgContainer
    this.spineContainer = spineContainer
    this.getWidth = getWidth
    this.getHeight = getHeight
    this.onCameraMove = onCameraMove

    this._cameraZoom = null
    this._cameraTween = null
    this._camera = { zoom: 1, x: 0, y: 0 }
  }

  // StoryCamera.MoveCamera: the camera moves to (offset_x, offset_y) canvas units and orthographicSize becomes
  // default / zoom, both linearly over the play time. Actors follow the camera fully. ResizeCamera rescales the
  // background panel only when the view widens (zoom < 1), so it zooms in with the camera but never shrinks.
  // Every MoveCamera frame also calls StoryCamera.BlurBackGround. Re-applying an unchanged entry snapshot
  // or resizing is not a camera move and leaves the background blur alone.
  _applyCameraTransform(zoom, cameraX, cameraY, { moving = false } = {}) {
    const previous = this._camera
    const view = cameraScreenTransform(this.getWidth(), this.getHeight(), { zoom, x: cameraX, y: cameraY })
    this.bgContainer.scale.set(view.bgScale)
    this.bgContainer.x = view.bgX
    this.bgContainer.y = view.bgY
    this.spineContainer.scale.set(view.scale)
    this.spineContainer.x = view.x
    this.spineContainer.y = view.y
    this._camera = { zoom, x: cameraX, y: cameraY }
    if (moving || previous.zoom !== zoom || previous.x !== cameraX || previous.y !== cameraY) this.onCameraMove?.(zoom)
  }

  setCameraZoom(zoomData) {
    const resetDuration = Number(zoomData?.duration || 0)
    const delayMs = Math.max(0, Number(zoomData?.delay || 0) * 1000)
    if (!zoomData || (zoomData.zoom === 1.0 && zoomData.offset_x === 0 && zoomData.offset_y === 0 && resetDuration <= 0 && delayMs <= 0)) {
      this.resetCameraZoom()
      return
    }

    this._cameraZoom = zoomData
    const target = { zoom: zoomData.zoom, x: Number(zoomData.offset_x || 0), y: Number(zoomData.offset_y || 0) }
    const animDuration = zoomData.duration > 0 ? zoomData.duration * 1000 : 0

    this._cameraTween?.cancel?.()

    if (animDuration > 0) {
      const start = { ...this._camera }
      this._cameraTween = runRafTween({
        durationMs: animDuration,
        delayMs,
        nowMilliseconds: zoomData.nowMilliseconds,
        startValue: 0,
        endValue: 1,
        ease: t => t,
        onUpdate: (t) => {
          this._applyCameraTransform(
            start.zoom + (target.zoom - start.zoom) * t,
            start.x + (target.x - start.x) * t,
            start.y + (target.y - start.y) * t,
            { moving: true },
          )
        },
      })
    } else if (delayMs > 0) {
      this._cameraTween = runRafTween({
        durationMs: 0,
        delayMs,
        nowMilliseconds: zoomData.nowMilliseconds,
        onUpdate: () => this._applyCameraTransform(target.zoom, target.x, target.y, { moving: true }),
      })
    } else {
      this._applyCameraTransform(target.zoom, target.x, target.y)
    }
  }

  resetCameraZoom() {
    this._cameraTween?.cancel?.()
    this._cameraZoom = null
    const moved = this._camera.zoom !== 1 || this._camera.x !== 0 || this._camera.y !== 0
    this._camera = { zoom: 1, x: 0, y: 0 }
    if (moved) this.onCameraMove?.(1)
    this.bgContainer.scale.set(1)
    this.bgContainer.x = 0
    this.bgContainer.y = 0
    this.spineContainer.scale.set(1)
    this.spineContainer.x = 0
    this.spineContainer.y = 0
  }

  cancelCameraTween() {
    this._cameraTween?.cancel?.()
    this._cameraTween = null
  }

  handleResize() {
    if (!this._cameraZoom) return
    this.setCameraZoom({ ...this._cameraZoom, duration: 0, delay: 0 })
  }

  destroy() {
    this.cancelCameraTween()
    this._cameraTween = null
    this._cameraZoom = null
  }
}
