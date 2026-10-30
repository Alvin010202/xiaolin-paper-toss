import Phaser from 'phaser'
import { PHYSICS, THROW, WORLD } from '../config/gameConfig'
import type { Sfx } from '../audio/sfx'
import { randomLine, type CharacterRoster } from '../characters/roster'
import { DEFAULT_CHEER_LINES, DEFAULT_MISS_LINES } from '../characters/characters.config'
import type { WindZone } from '../levels/types'
import type { Vec2 } from '../physics/matterLib'
import { aimFromDrag, dragLength, TrajectoryPredictor, type Aim } from '../physics/throwModel'
import { ThrowRun } from '../physics/throwRun'
import { PhysicsWorld } from '../physics/world'
import { RoundState } from '../rules/round'
import { CharacterView } from './characterView'
import { drawBackground, drawBinParts, drawObstacle } from './sceneArt'
import { avatarTexture, ensureBaseTextures, TEX } from './textures'
import type { GameCallbacks, RoundConfig } from './types'

export interface SceneDeps {
  roster: CharacterRoster
  sfx: Sfx
  settings(): { reducedMotion: boolean }
  callbacks: GameCallbacks
  /** 当前的显示倍率（逻辑像素 → 画布像素） */
  zoom(): number
}

export interface SceneStartData {
  cfg: RoundConfig
  deps: SceneDeps
}

/** 一局里的阶段 */
export type Phase = 'ready' | 'aiming' | 'flying' | 'between' | 'ended'

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
const CONFETTI_COLORS = [0xff8fab, 0xffd166, 0x4d96ff, 0x6bcb77, 0x9b72cf, 0xff7f50]

export class GameScene extends Phaser.Scene {
  static readonly KEY = 'game'

  private cfg!: RoundConfig
  private deps!: SceneDeps
  world!: PhysicsWorld
  round!: RoundState
  phase: Phase = 'ready'
  private predictor!: TrajectoryPredictor
  private run: ThrowRun | null = null
  private acc = 0
  private throwTouched = false

  private ballImg!: Phaser.GameObjects.Image
  private binBack!: Phaser.GameObjects.Graphics
  private binFront!: Phaser.GameObjects.Graphics
  private guestViews: CharacterView[] = []
  private pitcher!: CharacterView
  private audience: CharacterView[] = []
  private aimG!: Phaser.GameObjects.Graphics
  private grabRing!: Phaser.GameObjects.Graphics
  private powerText!: Phaser.GameObjects.Text
  private windG!: Phaser.GameObjects.Graphics
  private windStreaks: { zone: WindZone; x: number; y: number }[] = []
  private fans: { g: Phaser.GameObjects.Graphics; zone: WindZone }[] = []
  private tutorial: Phaser.GameObjects.Container | null = null
  private dragPointerId: number | null = null
  private lastStretchBucket = -1
  private launchedOnce = false
  /** 暂停标记：立即生效（Phaser 的场景暂停要到下一帧才处理，这里保证暂停后不再多走一步） */
  private frozen = false

  constructor() {
    super(GameScene.KEY)
  }

  init(data: SceneStartData): void {
    this.cfg = data.cfg
    this.deps = data.deps
    this.phase = 'ready'
    this.run = null
    this.acc = 0
    this.guestViews = []
    this.audience = []
    this.windStreaks = []
    this.fans = []
    this.tutorial = null
    this.dragPointerId = null
    this.launchedOnce = false
    this.frozen = false
  }

  private get reduced(): boolean {
    return this.deps.settings().reducedMotion
  }

  private get textRes(): number {
    return Math.max(1, Math.min(3, this.deps.zoom()))
  }

  create(): void {
    const cfg = this.cfg
    ensureBaseTextures(this)
    this.applyZoom()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this))

    // 物理世界：每次开局（含重来）都是全新世界，回合时间从 0 开始，动态障碍相位随之重置
    this.world = new PhysicsWorld(cfg.layout, 0)
    this.predictor = new TrajectoryPredictor(cfg.layout.windZones)
    this.round = new RoundState(cfg.mode, cfg.target)

    drawBackground(this, cfg.layout.scene)
    this.drawWind()
    for (const o of cfg.layout.staticObstacles) drawObstacle(this, o).setDepth(4)

    const bin = drawBinParts(this, this.world.binHeight)
    this.binBack = bin.back.setDepth(10)
    this.binFront = bin.front.setDepth(30)

    const roster = this.deps.roster
    const textRes = this.textRes
    cfg.layout.dynamicObstacles.forEach((d, i) => {
      const id = cfg.guestIds[d.slot % Math.max(1, cfg.guestIds.length)] ?? cfg.pitcherId
      const ch = roster.pitcher(id)
      const pos = this.world.guestAnchorAt(i, 0)
      const v = new CharacterView(this, pos.x, pos.y, ch, avatarTexture(this, roster, ch.id), {
        headR: 24,
        seated: true,
        facing: -1,
        reducedMotion: this.reduced,
        textResolution: textRes,
      })
      v.setDepth(15)
      this.guestViews.push(v)
    })

    // 投手站在投掷点左下方的地面上
    const tp = cfg.layout.throwPoint
    const pitcherChar = roster.pitcher(cfg.pitcherId)
    this.pitcher = new CharacterView(this, tp.x - 40, WORLD.floorY, pitcherChar, avatarTexture(this, roster, pitcherChar.id), {
      headR: 28,
      reducedMotion: this.reduced,
      textResolution: textRes,
    }).setDepth(40)

    // 观众在前景地面上
    const audienceX = [310, 400, 488]
    cfg.audienceIds.slice(0, 3).forEach((id, i) => {
      const ch = roster.pitcher(id)
      const v = new CharacterView(this, audienceX[i], WORLD.height + 4, ch, avatarTexture(this, roster, ch.id), {
        headR: 21,
        facing: -1,
        reducedMotion: this.reduced,
        textResolution: textRes,
      })
      v.setDepth(60)
      this.audience.push(v)
    })

    this.grabRing = this.add.graphics().setDepth(19)
    this.ballImg = this.add.image(tp.x, tp.y, TEX.ball).setDisplaySize(PHYSICS.ball.radius * 2.15, PHYSICS.ball.radius * 2.15).setDepth(20)
    this.aimG = this.add.graphics().setDepth(50)
    this.powerText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#3b3024', fontStyle: 'bold', resolution: textRes })
      .setOrigin(0.5)
      .setDepth(51)
      .setVisible(false)

    this.syncDynamicViews()
    this.setupInput()
    this.toReady(true)

    if (cfg.showTutorial) this.showTutorial()
    this.emitHud()
    this.exposeProbe()
  }

  /** 逻辑坐标固定为 540×960：画布按显示倍率放大，摄像机缩放回逻辑坐标 */
  private applyZoom(): void {
    const cam = this.cameras.main
    const z = this.scale.width / WORLD.width
    cam.setZoom(z)
    cam.centerOn(WORLD.width / 2, WORLD.height / 2)
  }

  // ───────────────────────── 输入 ─────────────────────────

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.onDown(p))
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.onMove(p))
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.onUp(p))
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, (p: Phaser.Input.Pointer) => this.onUp(p))
  }

  private toWorld(p: Phaser.Input.Pointer): Vec2 {
    const pt = this.cameras.main.getWorldPoint(p.x, p.y)
    return { x: pt.x, y: pt.y }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'ready' || this.dragPointerId !== null) return
    const pt = this.toWorld(p)
    const tp = this.cfg.layout.throwPoint
    if (Math.hypot(pt.x - tp.x, pt.y - tp.y) > THROW.grabRadius) return
    this.dragPointerId = p.id
    this.phase = 'aiming'
    this.lastStretchBucket = -1
    this.deps.sfx.play('grab')
    this.pitcher.setPose('ready')
    this.hideTutorial()
    this.drawAim(pt)
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'aiming' || p.id !== this.dragPointerId) return
    if (!p.isDown) return
    this.drawAim(this.toWorld(p))
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'aiming' || p.id !== this.dragPointerId) return
    if (p.wasCanceled) {
      this.cancelAim()
      return
    }
    const aim = aimFromDrag(this.cfg.layout.throwPoint, this.toWorld(p))
    if (!aim) {
      this.cancelAim(true)
      return
    }
    this.launch(aim)
  }

  /** 取消未完成的拖动（松手太近、触摸被取消、失去焦点、暂停） */
  cancelAim(tooShort = false): void {
    if (this.phase !== 'aiming') return
    this.phase = 'ready'
    this.dragPointerId = null
    this.aimG.clear()
    this.powerText.setVisible(false)
    this.pitcher.setPose('idle')
    if (tooShort) {
      this.deps.sfx.play('cancel')
      this.floatText(this.cfg.layout.throwPoint.x + 70, this.cfg.layout.throwPoint.y - 50, '再往后拉一点', '#7a5c3e', 18)
    }
    this.drawGrabRing()
  }

  private drawAim(pointer: Vec2): void {
    const tp = this.cfg.layout.throwPoint
    const g = this.aimG
    g.clear()
    const aim = aimFromDrag(tp, pointer)
    const len = dragLength(tp, pointer)
    const dx = pointer.x - tp.x
    const dy = pointer.y - tp.y
    const d = Math.hypot(dx, dy) || 1
    const px = tp.x + (dx / d) * len
    const py = tp.y + (dy / d) * len
    // 皮筋
    g.lineStyle(4, 0x8a5a2b, 0.85).lineBetween(tp.x - 6, tp.y, px, py).lineBetween(tp.x + 6, tp.y, px, py)
    g.fillStyle(0x8a5a2b).fillCircle(px, py, 6)
    if (!aim) {
      g.lineStyle(2, 0x9ca3af, 0.8).strokeCircle(tp.x, tp.y, THROW.minDrag)
      this.powerText.setVisible(false)
      return
    }
    // 力度圈：从绿到红
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x6bcb77),
      Phaser.Display.Color.ValueToColor(0xef476f),
      100,
      aim.power * 100,
    )
    const c = Phaser.Display.Color.GetColor(color.r, color.g, color.b)
    g.lineStyle(6, 0xffffff, 0.8).beginPath().arc(tp.x, tp.y, 30, -Math.PI / 2, Math.PI * 1.5).strokePath()
    g.lineStyle(6, c, 1).beginPath().arc(tp.x, tp.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, aim.power)).strokePath()
    // 方向箭头
    const rad = Phaser.Math.DegToRad(aim.angleDeg)
    const ux = Math.cos(rad)
    const uy = -Math.sin(rad)
    const al = 34 + aim.power * 36
    const ax = tp.x + ux * (32 + al)
    const ay = tp.y + uy * (32 + al)
    g.lineStyle(5, c, 1).lineBetween(tp.x + ux * 32, tp.y + uy * 32, ax, ay)
    g.fillStyle(c).fillTriangle(ax + ux * 12, ay + uy * 12, ax - uy * 8, ay + ux * 8, ax + uy * 8, ay - ux * 8)
    // 预测轨迹：只显示飞行前段
    const pts = this.predictor.predict(tp, aim)
    pts.forEach((p, i) => {
      const a = 0.85 * (1 - i / (pts.length + 2))
      g.fillStyle(0x3b3024, a).fillCircle(p.x, p.y, 4 - i * 0.2)
    })
    this.powerText.setText(`${Math.round(aim.power * 100)}%`).setPosition(tp.x, tp.y + 50).setVisible(true)
    const bucket = Math.floor(aim.power * 8)
    if (bucket !== this.lastStretchBucket) {
      this.lastStretchBucket = bucket
      this.deps.sfx.play('stretch', aim.power)
    }
  }

  private launch(aim: Aim): void {
    this.phase = 'flying'
    this.dragPointerId = null
    this.aimG.clear()
    this.grabRing.clear()
    this.powerText.setVisible(false)
    this.throwTouched = false
    this.run = new ThrowRun(this.world, aim)
    this.deps.sfx.play('throw', aim.power)
    this.pitcher.setPose('throw')
    this.time.delayedCall(260, () => this.phase === 'flying' && this.pitcher.setPose('idle'))
    if (!this.launchedOnce) {
      this.launchedOnce = true
      this.deps.callbacks.onFirstLaunch()
    }
  }

  // ───────────────────────── 固定步长循环 ─────────────────────────

  setFrozen(f: boolean): void {
    this.frozen = f
    if (f) this.cancelAim()
    this.acc = 0
  }

  update(_time: number, delta: number): void {
    if (this.frozen) return
    // 限制单帧最大补偿，避免切回页面时一次推进太多
    this.acc += Math.min(delta, 100)
    while (this.acc >= PHYSICS.stepMs) {
      this.fixedStep()
      this.acc -= PHYSICS.stepMs
    }
    this.syncDynamicViews()
    this.syncBall()
    this.animateWind(delta)
  }

  private fixedStep(): void {
    if (this.phase === 'flying' && this.run) {
      const r = this.run.step()
      for (const imp of r.impacts) this.onImpact(imp.speed, imp.label, imp.x, imp.y)
      if (r.done) this.onThrowDone(r.outcome === 'hit')
    } else {
      // 没有纸团在飞时，动态障碍照常按回合时间运动
      this.world.step()
    }
  }

  private onImpact(speed: number, label: string, x: number, y: number): void {
    if (speed < 1.2) return
    this.throwTouched = true
    const vol = Math.min(1, speed / 14)
    if (label.startsWith('bin')) this.deps.sfx.play('rim', vol)
    else this.deps.sfx.play('thud', vol)
    if (this.reduced) return
    const n = Math.min(6, Math.round(speed / 3))
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, TEX.puff).setDepth(25).setScale(0.4).setAlpha(0.8).setTint(0xdcd3c4)
      const a = Math.random() * Math.PI * 2
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * 18,
        y: y + Math.sin(a) * 18,
        scale: 0.9,
        alpha: 0,
        duration: 320,
        onComplete: () => p.destroy(),
      })
    }
    this.tweens.add({ targets: this.ballImg, scaleX: this.ballImg.scaleX * 1.18, scaleY: this.ballImg.scaleY * 0.82, duration: 60, yoyo: true })
  }

  private onThrowDone(hit: boolean): void {
    const run = this.run
    this.run = null
    this.phase = 'between'
    const rec = this.round.record(hit)
    const ballPos = { x: this.ballImg.x, y: this.ballImg.y }
    this.world.removeBall()
    if (rec) this.deps.callbacks.onThrow(rec)
    this.emitHud()

    if (hit) this.celebrate(rec?.streak ?? 1, rec?.points ?? 0, !this.throwTouched)
    else this.lament(ballPos, run?.reason ?? null)

    // 纸团淡出
    this.tweens.add({ targets: this.ballImg, alpha: 0, duration: hit ? 380 : 260, delay: hit ? 200 : 0 })

    if (this.round.finished) {
      this.phase = 'ended'
      this.time.delayedCall(hit ? 1100 : 800, () => {
        const s = this.round.summary()
        this.deps.sfx.play(s.cleared ? 'clear' : 'fail')
        this.pitcher.setPose(s.cleared ? 'cheer' : 'sad')
        this.deps.callbacks.onRoundEnd(s)
      })
    } else {
      this.time.delayedCall(THROW.nextBallDelayMs + (hit ? 300 : 0), () => this.toReady(false))
    }
  }

  private toReady(first: boolean): void {
    if (this.phase === 'ended') return
    this.phase = 'ready'
    const tp = this.cfg.layout.throwPoint
    this.ballImg.setPosition(tp.x, tp.y).setRotation(0).setAlpha(1)
    const base = (PHYSICS.ball.radius * 2.15) / this.ballImg.width
    if (!first && !this.reduced) {
      this.ballImg.setScale(0.01)
      this.tweens.add({ targets: this.ballImg, scale: base, duration: 220, ease: 'Back.Out' })
    } else {
      this.ballImg.setScale(base)
    }
    this.pitcher.setPose('idle', false)
    this.drawGrabRing()
  }

  /** 投掷点周围的操作区域提示 */
  private drawGrabRing(): void {
    const g = this.grabRing
    g.clear()
    if (this.phase !== 'ready') return
    const tp = this.cfg.layout.throwPoint
    g.fillStyle(0xffffff, 0.35).fillCircle(tp.x, tp.y, THROW.grabRadius * 0.62)
    g.lineStyle(3, 0xff8fab, 0.7)
    const segs = 18
    for (let i = 0; i < segs; i += 2) {
      const a0 = (i / segs) * Math.PI * 2
      const a1 = ((i + 1) / segs) * Math.PI * 2
      g.beginPath().arc(tp.x, tp.y, THROW.grabRadius * 0.62, a0, a1).strokePath()
    }
  }

  private syncBall(): void {
    const b = this.world.ball
    if (b && this.phase === 'flying') {
      this.ballImg.setPosition(b.position.x, b.position.y).setRotation(b.angle)
    }
  }

  private syncDynamicViews(): void {
    const t = this.world.timeMs
    const bin = this.world.binAnchorAt(t)
    this.binBack.setPosition(bin.x, bin.y)
    this.binFront.setPosition(bin.x, bin.y)
    this.guestViews.forEach((v, i) => {
      const p = this.world.guestAnchorAt(i, t)
      v.setPosition(p.x, p.y)
    })
  }

  // ───────────────────────── 反馈 ─────────────────────────

  private celebrate(streak: number, points: number, swish: boolean): void {
    const bin = this.world.binAnchor
    const mouthY = bin.y - this.world.binHeight
    const sfx = this.deps.sfx
    sfx.play(streak >= 2 ? 'combo' : 'score')
    sfx.play('cheer')
    this.floatText(bin.x, mouthY - 30, swish ? '空心入桶！' : '进了！', '#e4572e', 30)
    if (streak >= 2) this.time.delayedCall(220, () => this.floatText(bin.x, mouthY - 70, `连中 ×${streak}`, '#9b2fae', 26))
    if (points > 0) this.time.delayedCall(120, () => this.floatText(bin.x + 60, mouthY - 10, `+${points}`, '#118ab2', 24))
    this.confetti(bin.x, mouthY)
    this.pitcher.setPose('cheer')
    this.pitcher.say(randomLine(this.pitcher.character.cheerLines, DEFAULT_CHEER_LINES), 1300)
    this.audience.forEach((a, i) => {
      a.setPose('cheer')
      if (i === streak % this.audience.length) this.time.delayedCall(250, () => a.say(randomLine(a.character.cheerLines, DEFAULT_CHEER_LINES), 1300))
    })
    this.time.delayedCall(900, () => {
      this.audience.forEach((a) => a.setPose('idle'))
      if (this.phase !== 'ended') this.pitcher.setPose('idle')
    })
    if (!this.reduced) this.cameras.main.shake(140, 0.004)
  }

  private lament(pos: Vec2, reason: string | null): void {
    this.deps.sfx.play('miss')
    const label = reason === 'out' ? '飞出去了' : reason === 'timeout' ? '超时了' : '差一点！'
    this.floatText(Phaser.Math.Clamp(pos.x, 60, WORLD.width - 60), Phaser.Math.Clamp(pos.y - 30, 150, WORLD.floorY - 20), label, '#6b7280', 22)
    this.pitcher.setPose('sad')
    const speaker = this.audience[(this.round.throwsUsed + 1) % Math.max(1, this.audience.length)]
    this.audience.forEach((a) => a.setPose('surprise'))
    speaker?.say(randomLine(speaker.character.missLines, DEFAULT_MISS_LINES), 1300)
    this.time.delayedCall(800, () => {
      this.audience.forEach((a) => a.setPose('idle'))
      if (this.phase !== 'ended') this.pitcher.setPose('idle')
    })
  }

  private floatText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#ffffff',
        strokeThickness: 6,
        resolution: this.textRes,
      })
      .setOrigin(0.5)
      .setDepth(80)
    if (this.reduced) {
      this.time.delayedCall(1000, () => t.destroy())
      return
    }
    t.setScale(0.5)
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' })
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 650, duration: 450, onComplete: () => t.destroy() })
  }

  private confetti(x: number, y: number): void {
    const count = this.reduced ? 0 : 36
    for (let i = 0; i < count; i++) {
      const c = this.add
        .image(x, y, TEX.confetti)
        .setTint(CONFETTI_COLORS[i % CONFETTI_COLORS.length])
        .setDepth(70)
        .setRotation(Math.random() * Math.PI)
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8
      const sp = 90 + Math.random() * 160
      this.tweens.add({
        targets: c,
        x: x + Math.cos(a) * sp,
        y: y + Math.sin(a) * sp + 140,
        rotation: c.rotation + (Math.random() - 0.5) * 12,
        alpha: 0,
        duration: 900 + Math.random() * 400,
        ease: 'Quad.Out',
        onComplete: () => c.destroy(),
      })
    }
  }

  // ───────────────────────── 风 ─────────────────────────

  private drawWind(): void {
    this.windG = this.add.graphics().setDepth(5)
    for (const z of this.cfg.layout.windZones) {
      const g = this.add.graphics().setDepth(5)
      g.fillStyle(0xbde0fe, 0.16).fillRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 16)
      g.lineStyle(2, 0x4d96ff, 0.35).strokeRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 16)
      // 静态箭头：关闭动画时也能看懂风向
      const mag = Math.hypot(z.ax, z.ay)
      const ux = z.ax / mag
      const uy = z.ay / mag
      g.lineStyle(4, 0x4d96ff, 0.55)
      for (let i = -1; i <= 1; i++) {
        const cx = z.x + (uy !== 0 ? i * z.w * 0.28 : 0)
        const cy = z.y + (ux !== 0 ? i * z.h * 0.28 : 0)
        const x1 = cx - ux * 26
        const y1 = cy - uy * 26
        const x2 = cx + ux * 26
        const y2 = cy + uy * 26
        g.lineBetween(x1, y1, x2, y2)
        g.fillStyle(0x4d96ff, 0.55).fillTriangle(x2 + ux * 10, y2 + uy * 10, x2 - uy * 8, y2 + ux * 8, x2 + uy * 8, y2 - ux * 8)
      }
      // 风扇（在上风处）
      const fx = Phaser.Math.Clamp(z.x - ux * (z.w / 2 - 22), 22, WORLD.width - 22)
      const fy = Phaser.Math.Clamp(z.y - uy * (z.h / 2 - 22), 130, WORLD.floorY - 22)
      const fan = this.add.graphics({ x: fx, y: fy }).setDepth(6)
      fan.fillStyle(0xffffff, 0.9).fillCircle(0, 0, 20)
      fan.lineStyle(3, 0x4d96ff).strokeCircle(0, 0, 20)
      fan.fillStyle(0x4d96ff, 0.8)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2
        fan.fillEllipse(Math.cos(a) * 9, Math.sin(a) * 9, 14, 7)
      }
      this.fans.push({ g: fan, zone: z })
      const n = Math.round((z.w * z.h) / 9000)
      for (let i = 0; i < n; i++) {
        this.windStreaks.push({ zone: z, x: z.x - z.w / 2 + Math.random() * z.w, y: z.y - z.h / 2 + Math.random() * z.h })
      }
    }
  }

  private animateWind(delta: number): void {
    if (!this.windStreaks.length) return
    const g = this.windG
    g.clear()
    if (this.reduced) return
    for (const f of this.fans) f.g.rotation += delta * 0.012
    g.lineStyle(2, 0x4d96ff, 0.35)
    for (const s of this.windStreaks) {
      const z = s.zone
      const mag = Math.hypot(z.ax, z.ay)
      const ux = z.ax / mag
      const uy = z.ay / mag
      const speed = 0.12 + mag * 3
      s.x += ux * speed * delta
      s.y += uy * speed * delta
      const left = z.x - z.w / 2
      const top = z.y - z.h / 2
      if (s.x < left) s.x += z.w
      if (s.x > left + z.w) s.x -= z.w
      if (s.y < top) s.y += z.h
      if (s.y > top + z.h) s.y -= z.h
      g.lineBetween(s.x, s.y, s.x - ux * 18, s.y - uy * 18)
    }
  }

  // ───────────────────────── 新手演示 ─────────────────────────

  private showTutorial(): void {
    const tp = this.cfg.layout.throwPoint
    const hand = this.add.graphics()
    hand.fillStyle(0xffffff, 0.95).fillCircle(0, 0, 16)
    hand.lineStyle(3, 0x3b3024).strokeCircle(0, 0, 16)
    hand.fillStyle(0xff8fab).fillCircle(0, 0, 7)
    const label = this.add
      .text(tp.x + 90, tp.y - 120, '按住纸团\n往左下拉，松手！', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#3b3024',
        align: 'center',
        backgroundColor: '#ffffffdd',
        padding: { x: 10, y: 6 },
        resolution: this.textRes,
      })
      .setOrigin(0.5)
    const c = this.add.container(0, 0, [label]).setDepth(90)
    const handC = this.add.container(tp.x, tp.y, [hand]).setDepth(91)
    c.add(handC)
    this.tutorial = c
    if (this.reduced) {
      handC.setPosition(tp.x - 60, tp.y + 50)
      return
    }
    this.tweens.add({
      targets: handC,
      x: tp.x - 70,
      y: tp.y + 55,
      duration: 900,
      ease: 'Sine.InOut',
      hold: 250,
      repeat: -1,
      repeatDelay: 400,
    })
  }

  private hideTutorial(): void {
    this.tutorial?.destroy()
    this.tutorial = null
  }

  // ───────────────────────── 对外 ─────────────────────────

  private emitHud(): void {
    const r = this.round
    this.deps.callbacks.onHud({
      mode: r.mode,
      throwsLeft: r.remaining,
      totalThrows: r.totalThrows,
      hits: r.hits,
      target: r.target,
      score: r.score,
      streak: r.streak,
    })
  }

  /** 端到端测试用的只读状态（只有地址带 ?e2e 时才挂到 window） */
  private exposeProbe(): void {
    if (!new URLSearchParams(location.search).has('e2e')) return
    ;(window as unknown as { __xlptProbe: () => unknown }).__xlptProbe = () => ({
      phase: this.phase,
      roundTimeMs: Math.round(this.world.timeMs),
      throwsLeft: this.round.remaining,
      hits: this.round.hits,
      score: this.round.score,
      paused: this.frozen || this.scene.isPaused(),
      ballInFlight: !!this.world.ball,
      levelId: this.cfg.levelId,
      throwPoint: this.cfg.layout.throwPoint,
    })
  }
}
