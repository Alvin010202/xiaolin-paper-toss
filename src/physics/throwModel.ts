import { PHYSICS, THROW, WORLD } from '../config/gameConfig'
import type { WindZone } from '../levels/types'
import type { Vec2 } from './matterLib'
import { getMatter, type MBody, type MEngine } from './matterLib'
import { applyWind } from './world'

export interface Aim {
  /** 发射方向（度）：0 = 向右，90 = 向上 */
  angleDeg: number
  /** 力度 0～1 */
  power: number
}

/** 拖动向量（从手指指向纸团，即“往后拉”的反方向）换算成瞄准；拉得太短返回 null（不发射） */
export function aimFromDrag(ball: Vec2, pointer: Vec2): Aim | null {
  const dx = ball.x - pointer.x
  const dy = ball.y - pointer.y
  const len = Math.hypot(dx, dy)
  if (len < THROW.minDrag) return null
  const clamped = Math.min(len, THROW.maxDrag)
  const power = (clamped - THROW.minDrag) / (THROW.maxDrag - THROW.minDrag)
  const angleDeg = (Math.atan2(-dy, dx) * 180) / Math.PI
  return { angleDeg, power }
}

/** 拖动长度（已限制在最大值内），用于绘制拉伸效果 */
export function dragLength(ball: Vec2, pointer: Vec2): number {
  return Math.min(Math.hypot(ball.x - pointer.x, ball.y - pointer.y), THROW.maxDrag)
}

export function aimToVelocity(aim: Aim): Vec2 {
  const speed = THROW.minSpeed + aim.power * (THROW.maxSpeed - THROW.minSpeed)
  const rad = (aim.angleDeg * Math.PI) / 180
  return { x: Math.cos(rad) * speed, y: -Math.sin(rad) * speed }
}

/**
 * 轨迹预览：用同一个 Matter 引擎、同样的纸团参数和风力，只模拟飞行前段（不含碰撞），
 * 所以和实际出手后的初始运动一致；不会画出完整落点。
 */
export class TrajectoryPredictor {
  private readonly engine: MEngine
  private readonly ball: MBody

  constructor(private readonly winds: WindZone[]) {
    const M = getMatter()
    this.engine = M.Engine.create({ enableSleeping: false })
    this.engine.gravity.y = PHYSICS.gravityY
    this.engine.gravity.scale = PHYSICS.gravityScale
    const b = PHYSICS.ball
    this.ball = M.Bodies.circle(0, 0, b.radius, {
      density: b.density,
      frictionAir: b.frictionAir,
      collisionFilter: { group: -1, mask: 0 },
    })
    M.Composite.add(this.engine.world, this.ball)
  }

  predict(origin: Vec2, aim: Aim, steps: number = THROW.previewSteps, every: number = THROW.previewDotEvery): Vec2[] {
    const M = getMatter()
    M.Body.setPosition(this.ball, origin, false)
    M.Body.setVelocity(this.ball, aimToVelocity(aim))
    const points: Vec2[] = []
    for (let i = 1; i <= steps; i++) {
      applyWind(this.ball, this.winds)
      M.Engine.update(this.engine, PHYSICS.stepMs)
      if (i % every === 0) points.push({ x: this.ball.position.x, y: this.ball.position.y })
      if (this.ball.position.y > WORLD.floorY) break
    }
    return points
  }
}
