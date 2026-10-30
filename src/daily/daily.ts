import { RULES } from '../config/gameConfig'
import { DAILY_TEMPLATES } from '../levels/dailyTemplates'
import type { DailyTemplate } from '../levels/types'

export interface DailyChallenge {
  /** 挑战日期（Asia/Shanghai），格式 YYYY-MM-DD */
  date: string
  timeZone: string
  seed: number
  template: DailyTemplate
  ruleVersion: string
  /** 主持人在人物名单中的序号（按日期轮换） */
  hostIndex: number
}

/** 按 Asia/Shanghai 时区取日期，与设备本地时区无关 */
export function shanghaiDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RULES.dailyTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** FNV-1a 32 位哈希：同一个字符串永远得到同一个种子 */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 由日期确定当天挑战：同一天、同一规则版本得到相同模板和种子 */
export function dailyChallengeFor(date: string, rosterSize: number): DailyChallenge {
  const seed = hashSeed(`${RULES.dailyRuleVersion}:${date}`)
  const template = DAILY_TEMPLATES[seed % DAILY_TEMPLATES.length]
  // 主持人按天数轮换：用日期换算出的天序号，人数变化时也能稳定轮换
  const dayNumber = Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400000)
  const hostIndex = rosterSize > 0 ? ((dayNumber % rosterSize) + rosterSize) % rosterSize : 0
  return { date, timeZone: RULES.dailyTimeZone, seed, template, ruleVersion: RULES.dailyRuleVersion, hostIndex }
}
