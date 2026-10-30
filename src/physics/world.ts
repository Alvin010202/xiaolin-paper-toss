import { BIN, PHYSICS, WORLD } from '../config/gameConfig'
import type { LayoutDef, ObstacleKind, RectObstacle, WindZone } from '../levels/types'
import { getMatter, type MBody, type MEngine, type MPair, type Vec2 } from './matterLib'
import { motionPosition } from './motion'

/** 转椅嘉宾的碰撞形状（相对轮子着地点） */
export const CHAIR = {
  baseW: 46,
  baseH: 30,
  torsoW: 46,
  torsoH: 50,
  headR: 24,
  /** 各部件中心相对着地点的 y 偏移 */
  baseY: -15,
  torsoY: -55,
  headY: -104,
} as const

const RESTITUTION: Partial<Record<ObstacleKind, number>> = {
  wall: 0.55,
  whiteboard: 0.6,
  partition: 0.4,
  screen: 0.35,
}

interface Attached {
  body: MBody
  offset: Vec2
}

export interface ImpactEvent {
  /** 碰撞瞬间纸团速度（逻辑像素/步） */
  speed: number
  label: string
  x: number
  y: number
}

/** 一个关卡布局对应的物理世界。只负责物理，不涉及绘制。 */
export class PhysicsWorld {
  readonly engine: MEngine
  readonly layout: LayoutDef
  readonly binHeight: number
  ball: MBody | null = null
  /** 回合时间（毫秒）：动态障碍的位置由它决定 */
  timeMs: number
  /** 本步内纸团是否接触到桶口感应区 */
  mouthContact = false
  /** 本步内发生的碰撞（用于音效与反馈） */
  impacts: ImpactEvent[] = []

  private readonly binParts: Attached[] = []
  private readonly guestParts: Attached[][] = []

  constructor(layout: LayoutDef, startTimeMs = 0) {
    const M = getMatter()
    this.layout = layout
    this.timeMs = startTimeMs
    this.binHeight = layout.bin.height ?? BIN.defaultHeight
    this.engine = M.Engine.create({ enableSleeping: false })
    this.engine.gravity.x = 0
    this.engine.gravity.y = PHYSICS.gravityY
    this.engine.gravity.scale = PHYSICS.gravityScale
    this.engine.positionIterations = PHYSICS.positionIterations
    this.engine.velocityIterations = PHYSICS.velocityIterations

    const statics: MBody[] = []
    // 地面
    statics.push(
      M.Bodies.rectangle(WORLD.width / 2, WORLD.floorY + 100, WORLD.width + 400, 200, {
        isStatic: true,
        label: 'floor',
        friction: 0.6,
        restitution: 0.1,
      }),
    )
    for (const o of layout.staticObstacles) statics.push(this.createObstacle(o))
    M.Composite.add(this.engine.world, statics)

    this.createBin()
    layout.dynamicObstacles.forEach((_, i) => this.createGuest(i))
    this.placeDynamics(this.timeMs, false)

    M.Events.on(this.engine, 'collisionStart', (e: { pairs: MPair[] }) => this.onPairs(e.pairs, true))
    M.Events.on(this.engine, 'collisionActive', (e: { pairs: MPair[] }) => this.onPairs(e.pairs, false))
  }

  private createObstacle(o: RectObstacle): MBody {
    const M = getMatter()
    return M.Bodies.rectangle(o.x, o.y, o.w, o.h, {
      isStatic: true,
      label: `obstacle:${o.kind}`,
      angle: ((o.angle ?? 0) * Math.PI) / 180,
      restitution: o.restitution ?? RESTITUTION[o.kind] ?? 0.2,
      friction: 0.2,
    })
  }

  private createBin(): void {
    const M = getMatter()
    const h = this.binHeight
    const half = BIN.innerWidth / 2
    const w = BIN.wallThickness
    const parts: { offset: Vec2; w: number; h: number; label: string; sensor?: boolean }[] = [
      { offset: { x: -(half + w / 2), y: -h / 2 }, w, h, label: 'binWall' },
      { offset: { x: half + w / 2, y: -h / 2 }, w, h, label: 'binWall' },
      { offset: { x: 0, y: -BIN.bottomThickness / 2 }, w: BIN.innerWidth + 2 * w, h: BIN.bottomThickness, label: 'binBottom' },
      { offset: { x: 0, y: -h }, w: BIN.innerWidth, h: BIN.sensorHeight, label: 'binMouth', sensor: true },
    ]
    for (const p of parts) {
      const body = M.Bodies.rectangle(0, 0, p.w, p.h, {
        isStatic: true,
        isSensor: !!p.sensor,
        label: p.label,
        restitution: 0.15,
        friction: 0.3,
      })
      this.binParts.push({ body, offset: p.offset })
      M.Composite.add(this.engine.world, body)
    }
  }

  private createGuest(index: number): void {
    const M = getMatter()
    const opts = { isStatic: true, label: 'chairGuest', restitution: 0.35, friction: 0.2 }
    const parts: Attached[] = [
      { body: M.Bodies.rectangle(0, 0, CHAIR.baseW, CHAIR.baseH, opts), offset: { x: 0, y: CHAIR.baseY } },
      { body: M.Bodies.rectangle(0, 0, CHAIR.torsoW, CHAIR.torsoH, opts), offset: { x: 0, y: CHAIR.torsoY } },
      { body: M.Bodies.circle(0, 0, CHAIR.headR, opts), offset: { x: 0, y: CHAIR.headY } },
    ]
    for (const p of parts) M.Composite.add(this.engine.world, p.body)
    this.guestParts[index] = parts
  }

  /** 桶底中心点在某时刻的位置 */
  binAnchorAt(tMs: number): Vec2 {
    const b = this.layout.bin
    return b.motion ? motionPosition(b.motion, tMs) : { x: b.x, y: b.y }
  }

  get binAnchor(): Vec2 {
    return this.binAnchorAt(this.timeMs)
  }

  guestAnchorAt(index: number, tMs: number): Vec2 {
    return motionPosition(this.layout.dynamicObstacles[index].motion, tMs)
  }

  /** 把回合时间设到 tMs（重开回合或关卡验证时使用），动态障碍回到该时刻的位置 */
  resetTime(tMs: number): void {
    this.removeBall()
    this.timeMs = tMs
    this.placeDynamics(tMs, false)
  }

  private placeDynamics(tMs: number, updateVelocity: boolean): void {
    const M = getMatter()
    const move = (parts: Attached[], anchor: Vec2) => {
      for (const p of parts) {
        M.Body.setPosition(p.body, { x: anchor.x + p.offset.x, y: anchor.y + p.offset.y }, updateVelocity)
      }
    }
    move(this.binParts, this.binAnchorAt(tMs))
    this.guestParts.forEach((parts, i) => move(parts, this.guestAnchorAt(i, tMs)))
  }

  /** 生成并发射纸团（速度单位：逻辑像素/物理步） */
  spawnBall(pos: Vec2, velocity: Vec2): MBody {
    const M = getMatter()
    this.removeBall()
    const b = PHYSICS.ball
    const ball: MBody = M.Bodies.circle(pos.x, pos.y, b.radius, {
      label: 'ball',
      density: b.density,
      restitution: b.restitution,
      friction: b.friction,
      frictionStatic: b.frictionStatic,
      frictionAir: b.frictionAir,
    })
    M.Body.setVelocity(ball, velocity)
    M.Body.setAngularVelocity(ball, velocity.x * 0.012)
    M.Composite.add(this.engine.world, ball)
    this.ball = ball
    return ball
  }

  removeBall(): void {
    if (!this.ball) return
    getMatter().Composite.remove(this.engine.world, this.ball)
    this.ball = null
  }

  /** 纸团当前所在的风力区域 */
  windAt(pos: Vec2): WindZone | null {
    return findWind(this.layout.windZones, pos)
  }

  /** 前进一个固定物理步 */
  step(): void {
    const M = getMatter()
    const dt = PHYSICS.stepMs
    this.mouthContact = false
    this.impacts = []
    this.placeDynamics(this.timeMs + dt, true)
    if (this.ball) applyWind(this.ball, this.layout.windZones)
    M.Engine.update(this.engine, dt)
    this.timeMs += dt
  }

  private onPairs(pairs: MPair[], started: boolean): void {
    const ball = this.ball
    if (!ball) return
    for (const pair of pairs) {
      let other: MBody | null = null
      if (pair.bodyA === ball || pair.bodyA.parent === ball) other = pair.bodyB
      else if (pair.bodyB === ball || pair.bodyB.parent === ball) other = pair.bodyA
      if (!other) continue
      if (other.label === 'binMouth') {
        this.mouthContact = true
      } else if (started && !other.isSensor) {
        this.impacts.push({ speed: ball.speed, label: other.label, x: ball.position.x, y: ball.position.y })
      }
    }
  }
}

export function findWind(zones: WindZone[], pos: Vec2): WindZone | null {
  for (const z of zones) {
    if (Math.abs(pos.x - z.x) <= z.w / 2 && Math.abs(pos.y - z.y) <= z.h / 2) return z
  }
  return null
}

/** 风力：以力的形式施加，Matter 在下一次积分时把它换算成速度变化 */
export function applyWind(ball: MBody, zones: WindZone[]): void {
  const z = findWind(zones, ball.position)
  if (!z) return
  const dt2 = PHYSICS.stepMs * PHYSICS.stepMs
  ball.force.x += (ball.mass * z.ax) / dt2
  ball.force.y += (ball.mass * z.ay) / dt2
}
