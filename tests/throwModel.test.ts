import { describe, expect, it } from 'vitest'
import { PHYSICS, THROW } from '../src/config/gameConfig'
import type { LayoutDef } from '../src/levels/types'
import { motionPosition } from '../src/physics/motion'
import { aimFromDrag, aimToVelocity, TrajectoryPredictor } from '../src/physics/throwModel'
import { PhysicsWorld } from '../src/physics/world'
import { LEVELS } from '../src/levels/levels'

describe('拖动 → 发射', () => {
  const ball = { x: 100, y: 700 }

  it('拖动太短不发射（防误触）', () => {
    expect(aimFromDrag(ball, { x: 100 - THROW.minDrag + 1, y: 700 })).toBeNull()
    expect(aimFromDrag(ball, { x: 100, y: 700 })).toBeNull()
  })

  it('向左下拉 → 向右上发射（与拖动方向相反）', () => {
    const aim = aimFromDrag(ball, { x: 40, y: 760 })!
    expect(aim.angleDeg).toBeCloseTo(45, 5)
    const v = aimToVelocity(aim)
    expect(v.x).toBeGreaterThan(0)
    expect(v.y).toBeLessThan(0)
  })

  it('力度有上下限', () => {
    expect(aimFromDrag(ball, { x: 100 - THROW.minDrag, y: 700 })!.power).toBeCloseTo(0)
    expect(aimFromDrag(ball, { x: 100 - THROW.maxDrag, y: 700 })!.power).toBeCloseTo(1)
    expect(aimFromDrag(ball, { x: 100 - THROW.maxDrag * 3, y: 700 })!.power).toBe(1)
    const vmax = aimToVelocity({ angleDeg: 0, power: 1 })
    expect(Math.hypot(vmax.x, vmax.y)).toBeCloseTo(THROW.maxSpeed)
  })
})

describe('轨迹预览与实际飞行一致', () => {
  const open: LayoutDef = {
    scene: 'desk',
    throwPoint: { x: 100, y: 720 },
    bin: { x: 470, y: 860 },
    staticObstacles: [],
    dynamicObstacles: [],
    windZones: [{ x: 300, y: 450, w: 420, h: 500, ax: 0.045, ay: 0 }],
  }

  it('预览点与同参数实际出手后的位置重合（含风力）', () => {
    const aim = { angleDeg: 50, power: 0.6 }
    const preview = new TrajectoryPredictor(open.windZones).predict(open.throwPoint, aim, THROW.previewSteps, 1)
    const world = new PhysicsWorld(open)
    world.spawnBall(open.throwPoint, aimToVelocity(aim))
    for (let i = 0; i < preview.length; i++) {
      world.step()
      expect(world.ball!.position.x).toBeCloseTo(preview[i].x, 6)
      expect(world.ball!.position.y).toBeCloseTo(preview[i].y, 6)
    }
  })

  it('预览只覆盖飞行前段，不是完整落点', () => {
    const pts = new TrajectoryPredictor([]).predict({ x: 100, y: 720 }, { angleDeg: 60, power: 1 })
    expect(pts.length).toBeLessThanOrEqual(Math.ceil(THROW.previewSteps / THROW.previewDotEvery))
    // 最后一个点仍在上升或刚过顶点，远没到地面
    expect(pts[pts.length - 1].y).toBeLessThan(720)
  })
})

describe('动态障碍按时间运动、可重置相位', () => {
  it('同一时刻位置相同；重置时间后回到初始位置', () => {
    const level = LEVELS.find((l) => l.bin.motion)!
    const w = new PhysicsWorld(level)
    const start = w.binAnchor
    for (let i = 0; i < 100; i++) w.step()
    expect(w.binAnchor).not.toEqual(start)
    expect(w.timeMs).toBeCloseTo(100 * PHYSICS.stepMs)
    w.resetTime(0)
    expect(w.binAnchor).toEqual(start)
    expect(w.binAnchorAt(1234)).toEqual(motionPosition(level.bin.motion!, 1234))
  })

  it('不推进物理（暂停）时回合时间不变', () => {
    const level = LEVELS.find((l) => l.dynamicObstacles.length)!
    const w = new PhysicsWorld(level)
    for (let i = 0; i < 30; i++) w.step()
    const t = w.timeMs
    const pos = w.guestAnchorAt(0, w.timeMs)
    expect(w.timeMs).toBe(t)
    expect(w.guestAnchorAt(0, w.timeMs)).toEqual(pos)
  })
})
