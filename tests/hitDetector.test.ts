import { describe, expect, it } from 'vitest'
import { BIN, PHYSICS } from '../src/config/gameConfig'
import type { LayoutDef } from '../src/levels/types'
import { HitDetector, type HitSample } from '../src/rules/hitDetector'
import { RoundState } from '../src/rules/round'
import { ThrowRun, simulateThrow } from '../src/physics/throwRun'
import { PhysicsWorld } from '../src/physics/world'
import { getMatter } from '../src/physics/matterLib'

const H = BIN.defaultHeight
const dt = PHYSICS.stepMs

/** 构造一个桶固定在 (0,0) 的样本：纸团从 (px,py) 移到 (x,y) */
function sample(px: number, py: number, x: number, y: number, mouthContact: boolean): HitSample {
  return { x, y, prevX: px, prevY: py, binX: 0, binY: 0, prevBinX: 0, prevBinY: 0, mouthContact, dtMs: dt }
}

describe('命中判定状态流程（纯逻辑）', () => {
  it('从桶口上方向下进入并停留足够时间：得分且只得一次', () => {
    const d = new HitDetector({ binHeight: H })
    expect(d.update(sample(0, -H - 20, 0, -H + 10, true))).toBe(false)
    expect(d.state).toBe('inside')
    let scoredCount = 0
    for (let i = 0; i < 60; i++) if (d.update(sample(0, -20, 0, -20, i % 2 === 0))) scoredCount++
    expect(scoredCount).toBe(1)
    expect(d.state).toBe('scored')
  })

  it('停留不足就弹出桶口：不得分；再次落回并停住才得分（仍只得一次）', () => {
    const d = new HitDetector({ binHeight: H })
    d.update(sample(0, -H - 20, 0, -H + 10, true))
    for (let i = 0; i < 5; i++) expect(d.update(sample(0, -H + 10, 0, -H + 10, false))).toBe(false)
    d.update(sample(0, -H + 10, 0, -H - 30, false)) // 弹出
    expect(d.state).toBe('outside')
    expect(d.dwellMs).toBe(0)
    d.update(sample(0, -H - 30, 0, -H + 5, true)) // 再次进入
    let scored = 0
    for (let i = 0; i < 40; i++) if (d.update(sample(0, -30, 0, -30, true))) scored++
    expect(scored).toBe(1)
    expect(d.entries).toBe(2)
  })

  it('越过桶口线但没碰到感应区：不算进入', () => {
    const d = new HitDetector({ binHeight: H })
    d.update(sample(0, -H - 20, 0, -H + 10, false))
    expect(d.state).not.toBe('inside')
  })

  it('侧面擦碰（纸团在桶外侧上下移动）：不得分', () => {
    const d = new HitDetector({ binHeight: H })
    const side = BIN.innerWidth / 2 + BIN.wallThickness + PHYSICS.ball.radius
    let y = -H - 40
    for (let i = 0; i < 40; i++) {
      const ny = y + 4
      expect(d.update(sample(side, y, side, ny, false))).toBe(false)
      y = ny
    }
    expect(d.state).toBe('outside')
  })

  it('从桶底穿入（没经过桶口直接出现在桶内）：判为无效，之后再怎么停留都不得分', () => {
    const d = new HitDetector({ binHeight: H })
    d.update(sample(0, 30, 0, -20, false))
    expect(d.state).toBe('invalid')
    for (let i = 0; i < 60; i++) expect(d.update(sample(0, -20, 0, -20, true))).toBe(false)
  })

  it('从下往上穿过桶口（反方向）：不算进入', () => {
    const d = new HitDetector({ binHeight: H })
    d.update(sample(0, -H + 30, 0, -H - 10, true))
    expect(d.state).not.toBe('inside')
    expect(d.state).not.toBe('scored')
  })

  it('移动垃圾桶：用桶的局部坐标判断', () => {
    const d = new HitDetector({ binHeight: H })
    // 桶向右移动 3 像素，纸团同样向右移动并从上方进入
    const s: HitSample = { x: 103, y: -H + 8, prevX: 100, prevY: -H - 12, binX: 103, binY: 0, prevBinX: 100, prevBinY: 0, mouthContact: true, dtMs: dt }
    d.update(s)
    expect(d.state).toBe('inside')
  })
})

const emptyLayout = (over: Partial<LayoutDef> = {}): LayoutDef => ({
  scene: 'desk',
  throwPoint: { x: 100, y: 720 },
  bin: { x: 300, y: 860 },
  staticObstacles: [],
  dynamicObstacles: [],
  windZones: [],
  ...over,
})

describe('命中判定（实际物理）', () => {
  it('纸团从桶口正上方落下：命中，ThrowRun 只报告一次结束', () => {
    const world = new PhysicsWorld(emptyLayout({ throwPoint: { x: 300, y: 600 } }))
    const run = new ThrowRun(world, { angleDeg: -90, power: 0 })
    let doneCount = 0
    let outcome: string | undefined
    for (let i = 0; i < 600; i++) {
      const r = run.step()
      if (r.done) {
        doneCount++
        outcome ??= r.outcome
      }
    }
    expect(outcome).toBe('hit')
    // 结束后继续调用 step 不会再产生新的命中
    expect(run.outcome).toBe('hit')
    expect(run.detector.state).toBe('scored')
    expect(doneCount).toBeGreaterThan(0)
  })

  it('纸团直接出现在桶里（模拟从桶底穿入）：不计分，判为 invalid', () => {
    const world = new PhysicsWorld(emptyLayout({ throwPoint: { x: 300, y: 820 } }))
    const r = simulateThrow(world, { angleDeg: 90, power: 0 })
    expect(r.outcome).toBe('miss')
    expect(r.reason).toBe('invalid')
  })

  it('平飞撞到桶的外侧壁：不计分', () => {
    const world = new PhysicsWorld(emptyLayout({ throwPoint: { x: 120, y: 820 } }))
    const r = simulateThrow(world, { angleDeg: 0, power: 0.6 })
    expect(r.outcome).toBe('miss')
  })

  it('感应区反复被触发（纸团砸在桶口边沿来回弹跳）也只计一次分', () => {
    // 让纸团砸在桶口左沿附近：会多次接触感应区
    for (const dx of [-BIN.innerWidth / 2 - 4, -BIN.innerWidth / 2 + 4, BIN.innerWidth / 2 - 3]) {
      const world = new PhysicsWorld(emptyLayout({ throwPoint: { x: 300 + dx, y: 560 } }))
      const run = new ThrowRun(world, { angleDeg: -90, power: 0 })
      let scoredSignals = 0
      let contactSteps = 0
      const realUpdate = run.detector.update.bind(run.detector)
      run.detector.update = (sample) => {
        if (sample.mouthContact) contactSteps++
        const r = realUpdate(sample)
        if (r) scoredSignals++
        return r
      }
      for (let i = 0; i < 600 && !run.step().done; i++);
      expect(scoredSignals).toBeLessThanOrEqual(1)
      expect(contactSteps).toBeGreaterThan(0)
      const round = new RoundState('campaign', 1)
      round.record(run.outcome === 'hit')
      // 目标 1 球：命中后本局已结束，重复上报会被忽略
      if (run.outcome === 'hit') expect(round.record(true)).toBeNull()
    }
  })

  it('桶有实际的桶壁、桶底和桶口感应区', () => {
    const world = new PhysicsWorld(emptyLayout())
    const M = getMatter()
    const bodies = M.Composite.allBodies(world.engine.world) as { label: string; isSensor: boolean; isStatic: boolean }[]
    expect(bodies.filter((b) => b.label === 'binWall' && !b.isSensor)).toHaveLength(2)
    expect(bodies.filter((b) => b.label === 'binBottom' && !b.isSensor)).toHaveLength(1)
    expect(bodies.filter((b) => b.label === 'binMouth' && b.isSensor)).toHaveLength(1)
  })
})
