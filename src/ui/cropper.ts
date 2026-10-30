import { cropRectFor, type CropRect } from '../characters/imageProcess'
import { h } from './dom'

/**
 * 方形裁剪器：拖动平移、滑块/滚轮缩放、方向键微调。
 * 预览以圆形遮罩显示最终效果；导出的是正方形图片，游戏里以圆形显示。
 */
export class Cropper {
  readonly el: HTMLElement
  readonly zoomInput: HTMLInputElement
  private readonly canvas: HTMLCanvasElement
  private readonly empty: HTMLElement
  private img: HTMLImageElement | null = null
  private zoom = 1
  private offX = 0
  private offY = 0
  private drag: { id: number; x: number; y: number } | null = null

  constructor() {
    this.canvas = h('canvas', { width: 480, height: 480 })
    this.empty = h('div.cropper-empty', '选择一张照片后，在这里拖动调整位置')
    this.el = h(
      'div.cropper',
      { tabindex: '0', role: 'img', 'aria-label': '头像裁剪预览：拖动平移，方向键微调' },
      this.canvas,
      h('div.mask', { 'aria-hidden': 'true' }),
      this.empty,
    )
    this.canvas.hidden = true
    this.zoomInput = h('input.range', { type: 'range', min: '1', max: '4', step: '0.01', value: '1', 'aria-label': '缩放' }) as HTMLInputElement
    this.zoomInput.addEventListener('input', () => {
      this.zoom = Number(this.zoomInput.value)
      this.draw()
    })
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.img) return
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
      this.el.setPointerCapture(e.pointerId)
    })
    this.el.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id || !this.img) return
      const k = this.rect().size / this.el.clientWidth
      this.offX -= (e.clientX - this.drag.x) * k
      this.offY -= (e.clientY - this.drag.y) * k
      this.drag.x = e.clientX
      this.drag.y = e.clientY
      this.clampOffsets()
      this.draw()
    })
    const end = (e: PointerEvent) => {
      if (this.drag && e.pointerId === this.drag.id) this.drag = null
    }
    this.el.addEventListener('pointerup', end)
    this.el.addEventListener('pointercancel', end)
    this.el.addEventListener(
      'wheel',
      (e) => {
        if (!this.img) return
        e.preventDefault()
        this.setZoom(this.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
      },
      { passive: false },
    )
    this.el.addEventListener('keydown', (e) => {
      if (!this.img) return
      const step = this.rect().size * 0.04
      const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      const d = map[e.key]
      if (d) {
        e.preventDefault()
        this.offX += d[0]
        this.offY += d[1]
        this.clampOffsets()
        this.draw()
      } else if (e.key === '+' || e.key === '=') this.setZoom(this.zoom * 1.1)
      else if (e.key === '-') this.setZoom(this.zoom / 1.1)
    })
  }

  get hasImage(): boolean {
    return !!this.img
  }

  setImage(img: HTMLImageElement): void {
    this.img = img
    this.zoom = 1
    this.offX = 0
    this.offY = 0
    this.zoomInput.value = '1'
    this.canvas.hidden = false
    this.empty.hidden = true
    this.draw()
  }

  setZoom(z: number): void {
    this.zoom = Math.max(1, Math.min(4, z))
    this.zoomInput.value = String(this.zoom)
    this.clampOffsets()
    this.draw()
  }

  rect(): CropRect {
    const img = this.img!
    return cropRectFor(img.naturalWidth, img.naturalHeight, this.zoom, this.offX, this.offY)
  }

  get image(): HTMLImageElement | null {
    return this.img
  }

  private clampOffsets(): void {
    if (!this.img) return
    const r = this.rect()
    // cropRectFor 已经限制了范围；把偏移同步回被限制后的值，避免越拖越“卡住”
    this.offX = r.sx + r.size / 2 - this.img.naturalWidth / 2
    this.offY = r.sy + r.size / 2 - this.img.naturalHeight / 2
  }

  private draw(): void {
    if (!this.img) return
    const g = this.canvas.getContext('2d')!
    const r = this.rect()
    g.clearRect(0, 0, this.canvas.width, this.canvas.height)
    g.imageSmoothingQuality = 'high'
    g.drawImage(this.img, r.sx, r.sy, r.size, r.size, 0, 0, this.canvas.width, this.canvas.height)
  }
}
