import Phaser from 'phaser'
import type { RosterCharacter } from '../characters/types'
import { CHAIR } from '../physics/world'

const OUTLINE = 0x3b3024
const SKIN = 0xffe0c8
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

export type Pose = 'idle' | 'cheer' | 'surprise' | 'sad' | 'ready' | 'throw'

export interface CharacterViewOptions {
  headR: number
  /** 坐在转椅上（尺寸与转椅嘉宾的碰撞形状一致） */
  seated?: boolean
  /** 朝向：1 向右，-1 向左 */
  facing?: 1 | -1
  reducedMotion: boolean
  textResolution: number
}

/**
 * 人物：圆形头像 + 简单卡通身体。头像始终保持圆形等比显示，不随动作拉伸；
 * 动作通过手臂角度、身体位置、头像缩放和对话气泡表现。
 * 容器原点在脚底（坐姿时为椅子轮子着地点）。
 */
export class CharacterView extends Phaser.GameObjects.Container {
  readonly character: RosterCharacter
  private readonly opts: CharacterViewOptions
  private readonly bodyBox: Phaser.GameObjects.Container
  private readonly armL: Phaser.GameObjects.Container
  private readonly armR: Phaser.GameObjects.Container
  private readonly head: Phaser.GameObjects.Container
  private bubble: Phaser.GameObjects.Container | null = null
  private bubbleTimer: Phaser.Time.TimerEvent | null = null
  private poseTween: Phaser.Tweens.TweenChain | Phaser.Tweens.Tween | null = null
  private readonly headY: number
  private readonly baseY: number

  constructor(scene: Phaser.Scene, x: number, y: number, character: RosterCharacter, avatarKey: string, opts: CharacterViewOptions) {
    super(scene, x, y)
    this.baseY = y
    this.character = character
    this.opts = opts
    const r = opts.headR
    const accent = Phaser.Display.Color.HexStringToColor(character.accentColor).color
    const dark = Phaser.Display.Color.IntegerToColor(accent).darken(25).color
    const facing = opts.facing ?? 1

    this.bodyBox = scene.add.container(0, 0)
    const g = scene.add.graphics()
    let shoulderY: number
    if (opts.seated) {
      // 转椅：轮子、支柱、座面、靠背
      g.fillStyle(0x374151)
      for (const dx of [-18, 0, 18]) g.fillCircle(dx, -4, 4)
      g.fillRect(-22, -12, 44, 5)
      g.fillRect(-3, -30, 6, 20)
      g.fillStyle(0x1f2937).fillRoundedRect(-CHAIR.baseW / 2, -34, CHAIR.baseW, 9, 4)
      g.fillStyle(0x4b5563).fillRoundedRect(-facing * 26 - 5, -86, 10, 56, 4)
      // 弯曲的腿
      g.fillStyle(0x334155).fillRoundedRect(facing > 0 ? -4 : -22, -36, 26, 10, 4)
      g.fillRoundedRect(facing > 0 ? 14 : -22, -36, 8, 22, 3)
      // 身体
      g.fillStyle(accent).fillRoundedRect(-CHAIR.torsoW / 2, -80, CHAIR.torsoW, 50, 12)
      g.lineStyle(3, OUTLINE).strokeRoundedRect(-CHAIR.torsoW / 2, -80, CHAIR.torsoW, 50, 12)
      shoulderY = -72
      this.headY = CHAIR.headY
    } else {
      const legH = r * 0.95
      const torsoH = r * 1.45
      const torsoW = r * 1.55
      g.fillStyle(0x334155).fillRoundedRect(-torsoW * 0.32, -legH, torsoW * 0.26, legH, 4)
      g.fillRoundedRect(torsoW * 0.06, -legH, torsoW * 0.26, legH, 4)
      g.fillStyle(0x1f2937).fillRoundedRect(-torsoW * 0.38, -6, torsoW * 0.34, 6, 3)
      g.fillRoundedRect(torsoW * 0.04, -6, torsoW * 0.34, 6, 3)
      g.fillStyle(accent).fillRoundedRect(-torsoW / 2, -legH - torsoH, torsoW, torsoH, r * 0.45)
      g.lineStyle(3, OUTLINE).strokeRoundedRect(-torsoW / 2, -legH - torsoH, torsoW, torsoH, r * 0.45)
      shoulderY = -legH - torsoH + r * 0.35
      this.headY = -legH - torsoH - r * 0.78
    }
    this.bodyBox.add(g)

    const armLen = opts.seated ? 30 : r * 1.1
    const makeArm = (side: -1 | 1) => {
      const arm = scene.add.container(side * (opts.seated ? CHAIR.torsoW / 2 - 4 : r * 0.72), shoulderY)
      const ag = scene.add.graphics()
      ag.lineStyle(9, dark, 1).lineBetween(0, 0, 0, armLen)
      ag.fillStyle(SKIN).fillCircle(0, armLen + 2, 5.5)
      ag.lineStyle(2, OUTLINE).strokeCircle(0, armLen + 2, 5.5)
      arm.add(ag)
      return arm
    }
    this.armL = makeArm(-1)
    this.armR = makeArm(1)

    this.head = scene.add.container(0, this.headY)
    const img = scene.add.image(0, 0, avatarKey).setDisplaySize(r * 2, r * 2)
    const ring = scene.add.graphics().lineStyle(4, accent).strokeCircle(0, 0, r).lineStyle(2, OUTLINE).strokeCircle(0, 0, r + 2)
    this.head.add([img, ring])

    this.add([this.armL, this.bodyBox, this.armR, this.head])
    this.setPose('idle', false)
    scene.add.existing(this)
  }

  get headTop(): number {
    return this.headY - this.opts.headR
  }

  /** 设置姿势；animate 为 false 或减少动画时直接切换 */
  setPose(pose: Pose, animate = true): void {
    const angles: Record<Pose, [number, number]> = {
      idle: [12, -12],
      ready: [12, -150],
      throw: [12, -40],
      cheer: [160, -160],
      surprise: [95, -95],
      sad: [6, -6],
    }
    const [l, r] = angles[pose]
    this.poseTween?.stop()
    this.poseTween = null
    if (!this.opts.seated) this.y = this.baseY
    const scene = this.scene
    const motion = animate && !this.opts.reducedMotion
    const toL = Phaser.Math.DegToRad(l)
    const toR = Phaser.Math.DegToRad(r)
    if (!motion) {
      this.armL.rotation = toL
      this.armR.rotation = toR
      this.head.setScale(1).setRotation(pose === 'sad' ? 0.12 : 0)
      this.bodyBox.y = 0
      return
    }
    scene.tweens.add({ targets: this.armL, rotation: toL, duration: 140, ease: 'Back.Out' })
    scene.tweens.add({ targets: this.armR, rotation: toR, duration: 140, ease: 'Back.Out' })
    if (pose === 'cheer') {
      // 坐在转椅上的人位置每帧由物理决定，不做跳跃
      if (!this.opts.seated) {
        const y0 = this.baseY
        this.y = y0
        this.poseTween = scene.tweens.chain({
          targets: this,
          tweens: [
            { y: y0 - 14, duration: 140, ease: 'Quad.Out' },
            { y: y0, duration: 180, ease: 'Quad.In' },
            { y: y0 - 10, duration: 130, ease: 'Quad.Out' },
            { y: y0, duration: 160, ease: 'Bounce.Out' },
          ],
        })
      }
      scene.tweens.add({ targets: this.head, scale: 1.12, duration: 160, yoyo: true, repeat: 1 })
    } else if (pose === 'surprise') {
      scene.tweens.add({ targets: this.head, scale: 1.15, rotation: -0.12, duration: 120, yoyo: true, hold: 300 })
    } else if (pose === 'sad') {
      scene.tweens.add({ targets: this.head, rotation: 0.14, duration: 260 })
    } else {
      scene.tweens.add({ targets: this.head, rotation: 0, scale: 1, duration: 150 })
    }
  }

  /** 对话气泡 */
  say(text: string, ms = 1600): void {
    this.bubbleTimer?.remove()
    this.bubble?.destroy()
    const scene = this.scene
    const t = scene.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#3b3024',
        align: 'center',
        wordWrap: { width: 170, useAdvancedWrap: true },
        resolution: this.opts.textResolution,
      })
      .setOrigin(0.5)
    const pad = 10
    const w = Math.max(44, t.width + pad * 2)
    const h = t.height + pad * 1.4
    const accent = Phaser.Display.Color.HexStringToColor(this.character.accentColor).color
    const g = scene.add.graphics()
    g.fillStyle(0xffffff, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 12)
    g.lineStyle(3, accent).strokeRoundedRect(-w / 2, -h / 2, w, h, 12)
    g.fillStyle(0xffffff).fillTriangle(-8, h / 2 - 2, 8, h / 2 - 2, 0, h / 2 + 10)
    g.lineStyle(3, accent).lineBetween(-8, h / 2, 0, h / 2 + 10).lineBetween(8, h / 2, 0, h / 2 + 10)
    const bubble = scene.add.container(0, this.headTop - h / 2 - 14, [g, t])
    // 气泡不能超出画面左右边缘
    const worldX = this.x
    const minX = w / 2 + 6 - worldX
    const maxX = 540 - w / 2 - 6 - worldX
    bubble.x = Phaser.Math.Clamp(0, minX, maxX)
    this.add(bubble)
    this.bubble = bubble
    if (!this.opts.reducedMotion) {
      bubble.setScale(0.6)
      scene.tweens.add({ targets: bubble, scale: 1, duration: 160, ease: 'Back.Out' })
    }
    this.bubbleTimer = scene.time.delayedCall(ms, () => {
      bubble.destroy()
      if (this.bubble === bubble) this.bubble = null
    })
  }
}
