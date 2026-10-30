/**
 * 关卡可解性搜索：在实际物理规则下枚举出手方向、力度（以及动态关卡的出手时机），
 * 记录能命中的投掷。验证用的是游戏里同一个 PhysicsWorld / ThrowRun。
 */
import type { LayoutDef } from '../src/levels/types'
import { layoutPeriod } from '../src/physics/motion'
import type { Aim } from '../src/physics/throwModel'
import { simulateThrow } from '../src/physics/throwRun'
import { PhysicsWorld } from '../src/physics/world'

export interface VerifiedThrow extends Aim {
  /** 出手时的回合时间（毫秒），静态关卡为 0 */
  launchTimeMs: number
}

export interface SolveReport {
  /** 搜索到的命中数 / 总尝试数 */
  hits: number
  tried: number
  /** 推荐的投掷：周围邻近参数也大多命中，最稳的一个 */
  best: VerifiedThrow | null
  /** 推荐投掷周围 3×3 参数里命中的个数（衡量容错） */
  bestNeighborhood: number
  /** 额外记录的几条不同的命中投掷 */
  samples: VerifiedThrow[]
}

export interface SolveOptions {
  angleMin?: number
  angleMax?: number
  angleStep?: number
  powerStep?: number
  phases?: number
}

export function solveLayout(layout: LayoutDef, opts: SolveOptions = {}): SolveReport {
  const angleMin = opts.angleMin ?? -20
  const angleMax = opts.angleMax ?? 88
  const angleStep = opts.angleStep ?? 1
  const powerStep = opts.powerStep ?? 0.02
  const period = layoutPeriod([layout.bin.motion, ...layout.dynamicObstacles.map((d) => d.motion)])
  const phaseCount = period > 0 ? (opts.phases ?? 12) : 1
  const angles: number[] = []
  for (let a = angleMin; a <= angleMax + 1e-9; a += angleStep) angles.push(Math.round(a * 100) / 100)
  const powers: number[] = []
  for (let p = 0; p <= 1 + 1e-9; p += powerStep) powers.push(Math.round(p * 1000) / 1000)

  const world = new PhysicsWorld(layout)
  let hits = 0
  let tried = 0
  let best: VerifiedThrow | null = null
  let bestScore = -1
  const samples: VerifiedThrow[] = []

  for (let ph = 0; ph < phaseCount; ph++) {
    const t0 = period > 0 ? Math.round((period * ph) / phaseCount) : 0
    const grid: boolean[][] = angles.map(() => powers.map(() => false))
    angles.forEach((angleDeg, ai) => {
      powers.forEach((power, pi) => {
        world.resetTime(t0)
        const r = simulateThrow(world, { angleDeg, power })
        tried++
        if (r.outcome === 'hit') {
          hits++
          grid[ai][pi] = true
        }
      })
    })
    angles.forEach((angleDeg, ai) => {
      powers.forEach((power, pi) => {
        if (!grid[ai][pi]) return
        let n = 0
        for (let da = -1; da <= 1; da++) for (let dp = -1; dp <= 1; dp++) if (grid[ai + da]?.[pi + dp]) n++
        const candidate = { angleDeg, power, launchTimeMs: t0 }
        if (n > bestScore) {
          bestScore = n
          best = candidate
        }
        if (n >= 5 && samples.length < 6 && !samples.some((s) => Math.abs(s.angleDeg - angleDeg) < 8 && s.launchTimeMs === t0)) {
          samples.push(candidate)
        }
      })
    })
  }
  return { hits, tried, best, bestNeighborhood: Math.max(bestScore, 0), samples }
}

/** 在全新的物理世界里重放一次投掷 */
export function replayThrow(layout: LayoutDef, t: VerifiedThrow) {
  const world = new PhysicsWorld(layout, t.launchTimeMs)
  return simulateThrow(world, t)
}
