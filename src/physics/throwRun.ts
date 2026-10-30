import { PHYSICS, THROW, WORLD } from '../config/gameConfig'
import { HitDetector } from '../rules/hitDetector'
import type { Aim } from './throwModel'
import { aimToVelocity } from './throwModel'
import type { ImpactEvent, PhysicsWorld } from './world'

export type ThrowOutcome = 'hit' | 'miss'
export type MissReason = 'out' | 'rest' | 'timeout' | 'invalid'

export interface ThrowStepResult {
  done: boolean
  outcome?: ThrowOutcome
  reason?: MissReason
  impacts: ImpactEvent[]
}

/**
 * 一次投掷：从出手到结束（命中 / 飞出边界 / 静止 / 超时）。
 * 游戏画面和关卡验证工具都用这个类，按固定步长逐步推进。
 */
export class ThrowRun {
  readonly detector: HitDetector
  elapsedMs = 0
  private restMs = 0
  outcome: ThrowOutcome | null = null
  reason: MissReason | null = null

  constructor(private readonly world: PhysicsWorld, aim: Aim) {
    this.detector = new HitDetector({ binHeight: world.binHeight })
    world.spawnBall(world.layout.throwPoint, aimToVelocity(aim))
  }

  step(): ThrowStepResult {
    const w = this.world
    const ball = w.ball
    if (this.outcome || !ball) return { done: true, outcome: this.outcome ?? 'miss', reason: this.reason ?? undefined, impacts: [] }
    const prev = { x: ball.position.x, y: ball.position.y }
    const prevBin = w.binAnchor
    w.step()
    this.elapsedMs += PHYSICS.stepMs
    const bin = w.binAnchor
    const scored = this.detector.update({
      x: ball.position.x,
      y: ball.position.y,
      prevX: prev.x,
      prevY: prev.y,
      binX: bin.x,
      binY: bin.y,
      prevBinX: prevBin.x,
      prevBinY: prevBin.y,
      mouthContact: w.mouthContact,
      dtMs: PHYSICS.stepMs,
    })
    const impacts = w.impacts
    if (scored) return this.finish('hit', undefined, impacts)

    const p = ball.position
    const m = WORLD.outMargin
    if (p.x < -m || p.x > WORLD.width + m || p.y > WORLD.height + m) return this.finish('miss', 'out', impacts)
    if (this.detector.state === 'invalid') return this.finish('miss', 'invalid', impacts)
    // 静止判定：在桶里停住时停留计时会先完成得分
    if (ball.speed < THROW.restSpeed && this.detector.state !== 'inside') this.restMs += PHYSICS.stepMs
    else this.restMs = 0
    if (this.restMs >= THROW.restMs) return this.finish('miss', 'rest', impacts)
    if (this.elapsedMs >= THROW.timeLimitMs) return this.finish('miss', 'timeout', impacts)
    return { done: false, impacts }
  }

  private finish(outcome: ThrowOutcome, reason: MissReason | undefined, impacts: ImpactEvent[]): ThrowStepResult {
    this.outcome = outcome
    this.reason = reason ?? null
    return { done: true, outcome, reason, impacts }
  }
}

/** 不画画面、一口气模拟完一次投掷（关卡验证与测试使用） */
export function simulateThrow(world: PhysicsWorld, aim: Aim): { outcome: ThrowOutcome; reason: MissReason | null; elapsedMs: number } {
  const run = new ThrowRun(world, aim)
  let r = run.step()
  while (!r.done) r = run.step()
  world.removeBall()
  return { outcome: run.outcome ?? 'miss', reason: run.reason, elapsedMs: run.elapsedMs }
}
