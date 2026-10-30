import { describe, expect, it } from 'vitest'
import { defaultSave, isLevelUnlocked, parseSave, recordDaily, recordLevelStars, SAVE_KEY, SAVE_VERSION, DAILY_KEEP } from '../src/save/schema'
import { SaveManager, type KeyValueStore } from '../src/save/saveManager'

class MemStore implements KeyValueStore {
  map = new Map<string, string>()
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
}

describe('存档解析与校验', () => {
  it('没有存档：默认值', () => {
    const r = parseSave(null)
    expect(r.status).toBe('empty')
    expect(r.data).toEqual(defaultSave())
  })

  it('JSON 损坏：重置为默认值，不抛出', () => {
    expect(parseSave('{oops').status).toBe('reset')
    expect(parseSave('42').status).toBe('reset')
    expect(parseSave('[]').status).toBe('reset')
  })

  it('未知版本：重置', () => {
    expect(parseSave(JSON.stringify({ version: 99 })).status).toBe('reset')
  })

  it('部分字段损坏：保留合法部分，标记 repaired', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      settings: { muted: 'yes', reducedMotion: true },
      levels: { '1': { stars: 3 }, '2': { stars: 7 }, abc: { stars: 1 } },
      pitcherId: 'xiaolin',
      daily: { '2026-10-30': { date: '2026-10-30', templateId: 'gap', seed: 1, ruleVersion: 'daily-v1', best: 500, plays: 2 }, bad: {} },
      tutorialDone: true,
    })
    const r = parseSave(raw)
    expect(r.status).toBe('repaired')
    expect(r.data.settings).toEqual({ muted: false, reducedMotion: true })
    expect(r.data.levels).toEqual({ '1': { stars: 3 } })
    expect(Object.keys(r.data.daily)).toEqual(['2026-10-30'])
    expect(r.data.tutorialDone).toBe(true)
  })

  it('v1 → v2 升级：星级、静音、投手都被迁移', () => {
    const v1 = JSON.stringify({ version: 1, stars: [3, 2, 0, 1], muted: true, pitcher: 'friend-desk' })
    const r = parseSave(v1)
    expect(r.status).toBe('migrated')
    expect(r.data.version).toBe(SAVE_VERSION)
    expect(r.data.levels).toEqual({ '1': { stars: 3 }, '2': { stars: 2 }, '4': { stars: 1 } })
    expect(r.data.settings.muted).toBe(true)
    expect(r.data.pitcherId).toBe('friend-desk')
  })

  it('较差成绩不覆盖较好成绩', () => {
    const d = defaultSave()
    expect(recordLevelStars(d, 3, 2)).toBe(true)
    expect(recordLevelStars(d, 3, 1)).toBe(false)
    expect(recordLevelStars(d, 3, 0)).toBe(false)
    expect(d.levels['3'].stars).toBe(2)
    expect(recordLevelStars(d, 3, 3)).toBe(true)
    expect(d.levels['3'].stars).toBe(3)
  })

  it('每日挑战：保存最高分与次数，记录日期/模板/种子/规则版本', () => {
    const d = defaultSave()
    const meta = { date: '2026-10-30', templateId: 'gap', seed: 123, ruleVersion: 'daily-v1' }
    expect(recordDaily(d, meta, 500)).toBe(true)
    expect(recordDaily(d, meta, 300)).toBe(false)
    expect(recordDaily(d, meta, 800)).toBe(true)
    expect(d.daily['2026-10-30']).toEqual({ ...meta, best: 800, plays: 3 })
  })

  it('每日记录只保留最近的天数', () => {
    const d = defaultSave()
    for (let i = 0; i < DAILY_KEEP + 10; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
      recordDaily(d, { date, templateId: 't', seed: i, ruleVersion: 'daily-v1' }, i)
    }
    expect(Object.keys(d.daily)).toHaveLength(DAILY_KEEP)
  })

  it('解锁：通过上一关才解锁下一关', () => {
    const d = defaultSave()
    expect(isLevelUnlocked(d, 1)).toBe(true)
    expect(isLevelUnlocked(d, 2)).toBe(false)
    recordLevelStars(d, 1, 1)
    expect(isLevelUnlocked(d, 2)).toBe(true)
    expect(isLevelUnlocked(d, 3)).toBe(false)
  })
})

describe('SaveManager 回退', () => {
  it('正常读写', () => {
    const store = new MemStore()
    const m = new SaveManager(store)
    m.data.levels['1'] = { stars: 2 }
    expect(m.save()).toBe(true)
    const m2 = new SaveManager(store)
    expect(m2.data.levels['1'].stars).toBe(2)
    expect(m2.notice).toBeNull()
  })

  it('存储不可用：仍可游玩，给出提示', () => {
    const m = new SaveManager(null)
    expect(m.storage).toBe('unavailable')
    expect(m.save()).toBe(false)
    expect(m.data).toEqual(defaultSave())
    expect(m.notice).toMatch(/不会保存/)
  })

  it('读取时抛错：视为不可用', () => {
    const store: KeyValueStore = {
      getItem() {
        throw new Error('SecurityError')
      },
      setItem() {
        throw new Error('SecurityError')
      },
      removeItem() {},
    }
    const m = new SaveManager(store)
    expect(m.storage).toBe('unavailable')
    expect(m.notice).toBeTruthy()
  })

  it('写入失败（配额满）：标记失败并提示，内存中的进度不丢', () => {
    const store = new MemStore()
    store.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const m = new SaveManager(store)
    m.data.levels['1'] = { stars: 1 }
    expect(m.save()).toBe(false)
    expect(m.writeFailed).toBe(true)
    expect(m.notice).toMatch(/保存失败/)
    expect(m.data.levels['1'].stars).toBe(1)
  })

  it('损坏的存档被修复后立即写回新格式', () => {
    const store = new MemStore()
    store.setItem(SAVE_KEY, JSON.stringify({ version: 1, stars: [2], muted: false }))
    const m = new SaveManager(store)
    expect(m.loadStatus).toBe('migrated')
    expect(JSON.parse(store.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION)
  })

  it('重置存档：删除存储中的数据', () => {
    const store = new MemStore()
    const m = new SaveManager(store)
    m.data.levels['5'] = { stars: 3 }
    m.save()
    m.reset()
    expect(store.getItem(SAVE_KEY)).toBeNull()
    expect(m.data.levels).toEqual({})
  })
})
