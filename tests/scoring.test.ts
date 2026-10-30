import { describe, expect, it } from 'vitest'
import { dailyHitPoints, dailyTotal, starsFor } from '../src/rules/scoring'
import { RoundState } from '../src/rules/round'

describe('闯关星级', () => {
  it('按剩余次数给星', () => {
    expect(starsFor(false, 4)).toBe(0)
    expect(starsFor(true, 0)).toBe(1)
    expect(starsFor(true, 1)).toBe(2)
    expect(starsFor(true, 2)).toBe(3)
    expect(starsFor(true, 4)).toBe(3)
  })

  it('达到目标立即过关，剩余次数决定星级', () => {
    const r = new RoundState('campaign', 2)
    r.record(true)
    r.record(false)
    expect(r.finished).toBe(false)
    r.record(true)
    expect(r.finished).toBe(true)
    const s = r.summary()
    expect(s.cleared).toBe(true)
    expect(s.throwsUsed).toBe(3)
    expect(s.remaining).toBe(2)
    expect(s.stars).toBe(3)
    expect(r.record(true)).toBeNull()
  })

  it('最后一球才达标：1 星', () => {
    const r = new RoundState('campaign', 2)
    ;[false, false, true, false, true].forEach((h) => r.record(h))
    expect(r.summary()).toMatchObject({ cleared: true, remaining: 0, stars: 1 })
  })

  it('剩余 1 次过关：2 星', () => {
    const r = new RoundState('campaign', 3)
    ;[true, false, true, true].forEach((h) => r.record(h))
    expect(r.summary()).toMatchObject({ cleared: true, remaining: 1, stars: 2 })
  })

  it('5 次用完未达标：失败 0 星', () => {
    const r = new RoundState('campaign', 3)
    ;[true, false, true, false, false].forEach((h) => r.record(h))
    expect(r.finished).toBe(true)
    expect(r.summary()).toMatchObject({ cleared: false, stars: 0 })
  })
})

describe('每日挑战连击计分', () => {
  it('单球得分：基础 100，第 2 球起加成 25 递增，封顶 100', () => {
    expect(dailyHitPoints(1)).toBe(100)
    expect(dailyHitPoints(2)).toBe(125)
    expect(dailyHitPoints(3)).toBe(150)
    expect(dailyHitPoints(4)).toBe(175)
    expect(dailyHitPoints(5)).toBe(200)
    expect(dailyHitPoints(6)).toBe(200)
    expect(dailyHitPoints(10)).toBe(200)
  })

  it('未命中重置连击', () => {
    expect(dailyTotal([true, true, false, true, true])).toBe(100 + 125 + 100 + 125)
    expect(dailyTotal([false, false, false])).toBe(0)
  })

  it('10 球全中 = 1775 分', () => {
    expect(dailyTotal(Array(10).fill(true))).toBe(100 + 125 + 150 + 175 + 200 * 6)
  })

  it('RoundState 每日模式：10 球后结束，分数与 dailyTotal 一致', () => {
    const seq = [true, true, true, false, true, true, true, true, true, false]
    const r = new RoundState('daily')
    seq.forEach((h) => r.record(h))
    expect(r.finished).toBe(true)
    expect(r.score).toBe(dailyTotal(seq))
    expect(r.bestStreak).toBe(5)
    expect(r.record(true)).toBeNull()
  })
})
