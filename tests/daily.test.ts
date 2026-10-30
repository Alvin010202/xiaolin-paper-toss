import { describe, expect, it } from 'vitest'
import { RULES } from '../src/config/gameConfig'
import { dailyChallengeFor, hashSeed, shanghaiDate } from '../src/daily/daily'
import { DAILY_TEMPLATES } from '../src/levels/dailyTemplates'
import { simulateThrow } from '../src/physics/throwRun'
import { PhysicsWorld } from '../src/physics/world'

describe('每日挑战日期（Asia/Shanghai）', () => {
  it('北京时间零点换日，与设备时区无关', () => {
    // 北京时间 = UTC+8
    expect(shanghaiDate(new Date('2026-10-29T15:59:59.999Z'))).toBe('2026-10-29')
    expect(shanghaiDate(new Date('2026-10-29T16:00:00.000Z'))).toBe('2026-10-30')
    expect(shanghaiDate(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01')
    expect(shanghaiDate(new Date('2028-02-28T16:30:00Z'))).toBe('2028-02-29')
  })

  it('同一天的不同时刻得到同一个挑战', () => {
    const a = dailyChallengeFor(shanghaiDate(new Date('2026-10-29T16:00:00Z')), 5)
    const b = dailyChallengeFor(shanghaiDate(new Date('2026-10-30T15:59:00Z')), 5)
    expect(a.date).toBe(b.date)
    expect(a.seed).toBe(b.seed)
    expect(a.template.id).toBe(b.template.id)
    expect(a.ruleVersion).toBe(RULES.dailyRuleVersion)
    expect(a.timeZone).toBe('Asia/Shanghai')
  })

  it('种子稳定可复现，并且会在日期之间变化', () => {
    expect(hashSeed('daily-v1:2026-10-30')).toBe(hashSeed('daily-v1:2026-10-30'))
    const seeds = new Set<number>()
    const templates = new Set<string>()
    for (let d = 1; d <= 30; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`
      const c = dailyChallengeFor(date, 5)
      seeds.add(c.seed)
      templates.add(c.template.id)
    }
    expect(seeds.size).toBe(30)
    expect(templates.size).toBeGreaterThan(2)
  })

  it('当天布局只来自已验证的模板', () => {
    for (let d = 1; d <= 60; d++) {
      const date = new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10)
      expect(DAILY_TEMPLATES).toContain(dailyChallengeFor(date, 3).template)
    }
  })

  it('主持人按天轮换', () => {
    const hosts = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((d) => dailyChallengeFor(d, 4).hostIndex)
    expect(new Set(hosts).size).toBe(4)
  })

  it('同一天同一投掷：物理结果完全相同（同一环境内可复现）', () => {
    const c = dailyChallengeFor('2026-10-30', 5)
    const aim = { angleDeg: 40, power: 0.7 }
    const r1 = simulateThrow(new PhysicsWorld(c.template, 0), aim)
    const r2 = simulateThrow(new PhysicsWorld(c.template, 0), aim)
    expect(r1).toEqual(r2)
  })
})
