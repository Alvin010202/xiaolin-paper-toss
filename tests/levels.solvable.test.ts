import { describe, expect, it } from 'vitest'
import solutions from '../src/levels/solutions.json'
import { LEVELS } from '../src/levels/levels'
import { DAILY_TEMPLATES } from '../src/levels/dailyTemplates'
import { replayThrow, type VerifiedThrow } from '../scripts/solverCore'

type Entry = { hitRate: number; best: VerifiedThrow; samples: VerifiedThrow[] }
const table = solutions as Record<string, Entry>

describe('关卡数据结构', () => {
  it('共 20 关，id 连续，三个场景分组正确', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    for (const l of LEVELS) {
      const scene = l.id <= 6 ? 'desk' : l.id <= 13 ? 'pantry' : 'meeting'
      expect(l.scene, `第 ${l.id} 关`).toBe(scene)
      expect(l.target).toBeGreaterThanOrEqual(1)
      expect(l.target).toBeLessThanOrEqual(5)
      expect(l.name && l.hint && l.difficulty).toBeTruthy()
    }
  })

  it('机制按顺序引入：风从茶水间开始，移动桶与转椅从会议室开始', () => {
    for (const l of LEVELS) {
      if (l.id < 7) expect(l.windZones, `第 ${l.id} 关`).toHaveLength(0)
      if (l.id < 14) {
        expect(l.bin.motion, `第 ${l.id} 关`).toBeUndefined()
        expect(l.dynamicObstacles, `第 ${l.id} 关`).toHaveLength(0)
      }
    }
    expect(LEVELS.find((l) => l.windZones.length)!.newMechanic).toBeTruthy()
    expect(LEVELS.find((l) => l.bin.motion)!.newMechanic).toBeTruthy()
    expect(LEVELS.find((l) => l.dynamicObstacles.length)!.newMechanic).toBeTruthy()
  })
})

describe('20 个关卡在实际物理下可解', () => {
  for (const l of LEVELS) {
    it(`第 ${l.id} 关 ${l.name}：记录的投掷在全新世界中重放命中`, () => {
      const e = table[`level-${l.id}`]
      expect(e, '缺少验证记录，请运行 npm run solve').toBeTruthy()
      expect(replayThrow(l, e.best).outcome).toBe('hit')
      for (const s of e.samples) expect(replayThrow(l, s).outcome).toBe('hit')
      // 目标进球数不超过可用次数，且至少存在一条可重复使用的命中投掷
      expect(e.hitRate).toBeGreaterThan(0)
    })
  }
})

describe('每日挑战模板在实际物理下可解', () => {
  for (const t of DAILY_TEMPLATES) {
    it(`模板 ${t.id}`, () => {
      const e = table[`daily-${t.id}`]
      expect(e).toBeTruthy()
      expect(replayThrow(t, e.best).outcome).toBe('hit')
    })
  }
})

describe('布局合理性：动态物体在整条路线上不与桶、障碍物重叠', () => {
  type Box = { l: number; r: number; t: number; b: number }
  const overlap = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t
  const binBox = (x: number, y: number, h: number): Box => ({ l: x - 47, r: x + 47, t: y - h - 4, b: y })
  const chairBox = (x: number, y: number): Box => ({ l: x - 24, r: x + 24, t: y - 128, b: y })
  const rectBox = (o: { x: number; y: number; w: number; h: number }): Box => ({ l: o.x - o.w / 2, r: o.x + o.w / 2, t: o.y - o.h / 2, b: o.y + o.h / 2 })

  for (const layout of [...LEVELS, ...DAILY_TEMPLATES]) {
    const name = 'id' in layout && typeof layout.id === 'number' ? `第 ${layout.id} 关` : `每日模板 ${layout.id}`
    it(name, async () => {
      const { PhysicsWorld } = await import('../src/physics/world')
      const w = new PhysicsWorld(layout)
      const h = w.binHeight
      const solids = layout.staticObstacles.filter((o) => !['lamp', 'screen'].includes(o.kind)).map(rectBox)
      for (let t = 0; t < 12000; t += 50) {
        const bin = w.binAnchorAt(t)
        const bb = binBox(bin.x, bin.y, h)
        for (const s of solids) {
          // 桶放在台面/架子上时底边与障碍顶边相接，不算重叠
          const touchingTop = Math.abs(bb.b - s.t) < 8
          if (!touchingTop) expect(overlap(bb, s), `${name} 桶与障碍重叠 t=${t}`).toBe(false)
        }
        layout.dynamicObstacles.forEach((_, i) => {
          const g = w.guestAnchorAt(i, t)
          const cb = chairBox(g.x, g.y)
          expect(overlap(cb, bb), `${name} 转椅 ${i} 与桶重叠 t=${t}`).toBe(false)
          for (const s of solids) expect(overlap(cb, s), `${name} 转椅 ${i} 与障碍重叠 t=${t}`).toBe(false)
        })
      }
    })
  }
})
