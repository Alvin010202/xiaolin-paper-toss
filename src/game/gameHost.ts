import Phaser from 'phaser'
import { WORLD } from '../config/gameConfig'
import { setMatter } from '../physics/matterLib'
import { GameScene, type SceneDeps } from './GameScene'
import type { GameCallbacks, RoundConfig } from './types'

// 使用 Phaser 内置的 Matter 物理库
setMatter((Phaser.Physics.Matter as unknown as { Matter: unknown }).Matter)

export interface HostDeps extends Omit<SceneDeps, 'callbacks' | 'zoom'> {}

/**
 * 管理唯一的 Phaser 游戏实例。
 * 画布内部分辨率 = 逻辑尺寸 × 显示倍率（考虑设备像素比），摄像机缩放回逻辑坐标，
 * 所以物理和输入始终在 540×960 逻辑坐标中计算，只有显示清晰度随屏幕变化。
 */
export class GameHost {
  private game: Phaser.Game | null = null
  private ready: Promise<void> | null = null
  private zoom = 1
  private lastStart: { cfg: RoundConfig; callbacks: GameCallbacks } | null = null

  constructor(private readonly parent: HTMLElement, private readonly deps: HostDeps) {
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200))
    // 失去窗口焦点时取消未完成的拖动
    window.addEventListener('blur', () => this.scene()?.cancelAim())
  }

  private computeZoom(): number {
    const rect = this.parent.getBoundingClientRect()
    const css = Math.min(rect.width / WORLD.width, rect.height / WORLD.height) || 1
    const dpr = window.devicePixelRatio || 1
    // 按 0.25 取整，避免细微尺寸变化反复重建画布；上限控制在 2.5 以兼顾性能
    return Math.max(1, Math.min(2.5, Math.round(css * dpr * 4) / 4))
  }

  private boot(): Promise<void> {
    if (this.ready) return this.ready
    this.zoom = this.computeZoom()
    this.ready = new Promise((resolve) => {
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: this.parent,
        width: WORLD.width * this.zoom,
        height: WORLD.height * this.zoom,
        backgroundColor: '#f6f1e7',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 2, touch: { capture: true } },
        render: { antialias: true, roundPixels: false },
        audio: { noAudio: true },
        banner: false,
        disableContextMenu: true,
        fps: { target: 60 },
      })
      this.game.scene.add(GameScene.KEY, GameScene, false)
      this.game.events.once(Phaser.Core.Events.READY, () => resolve())
    })
    return this.ready
  }

  private scene(): GameScene | null {
    if (!this.game) return null
    const s = this.game.scene.getScene(GameScene.KEY) as GameScene | null
    return s && s.sys.settings.active ? s : null
  }

  /** 根据容器大小与设备像素比调整画布分辨率 */
  resize(): void {
    if (!this.game) return
    const z = this.computeZoom()
    if (z !== this.zoom) {
      this.zoom = z
      this.game.scale.resize(WORLD.width * z, WORLD.height * z)
    } else {
      this.game.scale.refresh()
    }
  }

  async start(cfg: RoundConfig, callbacks: GameCallbacks): Promise<void> {
    await this.boot()
    const game = this.game!
    this.lastStart = { cfg, callbacks }
    game.loop.wake()
    this.resize()
    const data = { cfg, deps: { ...this.deps, callbacks, zoom: () => this.zoom } }
    const mgr = game.scene
    if (mgr.isActive(GameScene.KEY) || mgr.isPaused(GameScene.KEY) || mgr.isSleeping(GameScene.KEY)) mgr.stop(GameScene.KEY)
    mgr.start(GameScene.KEY, data)
  }

  /** 重新开始当前这一局（全新物理世界，回合时间归零） */
  async restart(): Promise<void> {
    if (this.lastStart) await this.start(this.lastStart.cfg, this.lastStart.callbacks)
  }

  pause(): void {
    const s = this.scene()
    if (!s) return
    s.setFrozen(true)
    if (!s.scene.isPaused()) s.scene.pause()
  }

  resume(): void {
    const s = this.game?.scene.getScene(GameScene.KEY) as GameScene | undefined
    if (!s) return
    s.setFrozen(false)
    if (s.scene.isPaused()) s.scene.resume()
  }

  /** 离开游戏画面：停止场景并让游戏循环休眠，节省电量 */
  stop(): void {
    if (!this.game) return
    const mgr = this.game.scene
    if (mgr.getScene(GameScene.KEY) && (mgr.isActive(GameScene.KEY) || mgr.isPaused(GameScene.KEY))) mgr.stop(GameScene.KEY)
    this.game.loop.sleep()
  }

  get isPaused(): boolean {
    return !!this.game?.scene.isPaused(GameScene.KEY)
  }
}
