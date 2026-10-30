/**
 * 存档结构、默认值、校验与版本迁移（纯函数，可单独测试）。
 *
 * 存档只保存必要数据：设置、各关最高星级、所选投手、每日挑战本机最高分。
 * 自定义头像图片不放在这里，而是存在 IndexedDB（见 characters/avatarStore.ts）。
 */

export const SAVE_VERSION = 2
export const SAVE_KEY = 'xiaolin-paper-toss:save'
/** 每日挑战记录最多保留的天数 */
export const DAILY_KEEP = 60

export interface Settings {
  muted: boolean
  reducedMotion: boolean
}

export interface LevelRecord {
  stars: 1 | 2 | 3
}

export interface DailyRecord {
  date: string
  templateId: string
  seed: number
  ruleVersion: string
  best: number
  plays: number
}

export interface SaveData {
  version: typeof SAVE_VERSION
  settings: Settings
  /** 键为关卡 id */
  levels: Record<string, LevelRecord>
  pitcherId: string
  /** 键为挑战日期 YYYY-MM-DD */
  daily: Record<string, DailyRecord>
  tutorialDone: boolean
}

export const DEFAULT_PITCHER = 'xiaolin'

export function defaultSave(reducedMotion = false): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { muted: false, reducedMotion },
    levels: {},
    pitcherId: DEFAULT_PITCHER,
    daily: {},
    tutorialDone: false,
  }
}

export interface ParseResult {
  data: SaveData
  /** 'ok' 正常；'empty' 没有存档；'migrated' 从旧版本升级；'repaired' 部分数据损坏已丢弃；'reset' 完全无法读取已重置 */
  status: 'ok' | 'empty' | 'migrated' | 'repaired' | 'reset'
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 解析存档文本：任何异常都不会抛出，最差回到默认存档 */
export function parseSave(raw: string | null, reducedMotionDefault = false): ParseResult {
  if (raw === null || raw === '') return { data: defaultSave(reducedMotionDefault), status: 'empty' }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { data: defaultSave(reducedMotionDefault), status: 'reset' }
  }
  if (!isObj(json)) return { data: defaultSave(reducedMotionDefault), status: 'reset' }
  let migrated = false
  if (json.version === 1) {
    json = migrateV1(json)
    migrated = true
  } else if (json.version !== SAVE_VERSION) {
    return { data: defaultSave(reducedMotionDefault), status: 'reset' }
  }
  const { data, repaired } = sanitize(json as Record<string, unknown>, reducedMotionDefault)
  return { data, status: repaired ? 'repaired' : migrated ? 'migrated' : 'ok' }
}

/**
 * v1 是开发原型阶段的格式：{ version: 1, stars: number[]（下标 = 关卡 - 1）, muted: boolean, pitcher?: string }
 */
export function migrateV1(v1: Record<string, unknown>): Record<string, unknown> {
  const levels: Record<string, unknown> = {}
  if (Array.isArray(v1.stars)) {
    v1.stars.forEach((s, i) => {
      if (typeof s === 'number' && s >= 1) levels[String(i + 1)] = { stars: s }
    })
  }
  return {
    version: SAVE_VERSION,
    settings: { muted: v1.muted === true, reducedMotion: false },
    levels,
    pitcherId: typeof v1.pitcher === 'string' ? v1.pitcher : DEFAULT_PITCHER,
    daily: {},
    tutorialDone: Object.keys(levels).length > 0,
  }
}

/** 逐项校验：合法的保留，不合法的丢弃并标记 repaired */
export function sanitize(src: Record<string, unknown>, reducedMotionDefault = false): { data: SaveData; repaired: boolean } {
  const data = defaultSave(reducedMotionDefault)
  let repaired = false

  if (isObj(src.settings)) {
    const s = src.settings
    if (typeof s.muted === 'boolean') data.settings.muted = s.muted
    else repaired = true
    if (typeof s.reducedMotion === 'boolean') data.settings.reducedMotion = s.reducedMotion
    else repaired = true
  } else repaired = true

  if (isObj(src.levels)) {
    for (const [id, rec] of Object.entries(src.levels)) {
      const n = Number(id)
      if (Number.isInteger(n) && n >= 1 && n <= 999 && isObj(rec) && [1, 2, 3].includes(rec.stars as number)) {
        data.levels[String(n)] = { stars: rec.stars as 1 | 2 | 3 }
      } else repaired = true
    }
  } else repaired = true

  if (typeof src.pitcherId === 'string' && src.pitcherId.length > 0 && src.pitcherId.length < 80) data.pitcherId = src.pitcherId
  else repaired = true

  if (isObj(src.daily)) {
    for (const [date, rec] of Object.entries(src.daily)) {
      if (
        DATE_RE.test(date) &&
        isObj(rec) &&
        rec.date === date &&
        typeof rec.templateId === 'string' &&
        Number.isFinite(rec.seed) &&
        typeof rec.ruleVersion === 'string' &&
        Number.isFinite(rec.best) &&
        (rec.best as number) >= 0 &&
        Number.isFinite(rec.plays)
      ) {
        data.daily[date] = {
          date,
          templateId: rec.templateId,
          seed: rec.seed as number,
          ruleVersion: rec.ruleVersion,
          best: Math.floor(rec.best as number),
          plays: Math.max(0, Math.floor(rec.plays as number)),
        }
      } else repaired = true
    }
    data.daily = pruneDaily(data.daily)
  } else repaired = true

  if (typeof src.tutorialDone === 'boolean') data.tutorialDone = src.tutorialDone
  else repaired = true

  return { data, repaired }
}

export function pruneDaily(daily: Record<string, DailyRecord>): Record<string, DailyRecord> {
  const dates = Object.keys(daily).sort().slice(-DAILY_KEEP)
  const out: Record<string, DailyRecord> = {}
  for (const d of dates) out[d] = daily[d]
  return out
}

/** 写入关卡成绩：只在更好时覆盖 */
export function recordLevelStars(data: SaveData, levelId: number, stars: 0 | 1 | 2 | 3): boolean {
  if (stars < 1) return false
  const prev = data.levels[String(levelId)]?.stars ?? 0
  if (stars <= prev) return false
  data.levels[String(levelId)] = { stars: stars as 1 | 2 | 3 }
  return true
}

/** 写入每日挑战成绩：次数累加，最高分只在更高时覆盖；返回是否刷新了最高分 */
export function recordDaily(data: SaveData, rec: Omit<DailyRecord, 'best' | 'plays'>, score: number): boolean {
  const old = data.daily[rec.date]
  const prev = old && old.ruleVersion === rec.ruleVersion && old.templateId === rec.templateId ? old : undefined
  const isBest = !prev || score > prev.best
  data.daily[rec.date] = {
    ...rec,
    best: prev ? Math.max(prev.best, score) : score,
    plays: (prev?.plays ?? 0) + 1,
  }
  data.daily = pruneDaily(data.daily)
  return isBest
}

/** 关卡是否解锁：第 1 关始终解锁；之后需要前一关已过关 */
export function isLevelUnlocked(data: SaveData, levelId: number): boolean {
  return levelId <= 1 || !!data.levels[String(levelId - 1)]
}
