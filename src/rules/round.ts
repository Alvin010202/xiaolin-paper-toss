import { RULES } from '../config/gameConfig'
import { dailyHitPoints, starsFor } from './scoring'

export type RoundMode = 'campaign' | 'daily'

export interface ThrowRecord {
  hit: boolean
  /** 本球得分（每日挑战）；闯关为 0 */
  points: number
  /** 投完这一球后的连续命中数 */
  streak: number
}

export interface RoundSummary {
  mode: RoundMode
  cleared: boolean
  hits: number
  throwsUsed: number
  remaining: number
  stars: 0 | 1 | 2 | 3
  score: number
  bestStreak: number
}

/**
 * 一局的规则状态（与画面无关，可单独测试）。
 * 闯关：5 次投掷，达到目标立即过关；用完次数未达标则失败。
 * 每日挑战：10 次投掷，全部投完后结算分数。
 */
export class RoundState {
  readonly mode: RoundMode
  readonly totalThrows: number
  readonly target: number
  readonly records: ThrowRecord[] = []
  hits = 0
  streak = 0
  bestStreak = 0
  score = 0
  finished = false

  constructor(mode: RoundMode, target = 0) {
    this.mode = mode
    this.totalThrows = mode === 'campaign' ? RULES.campaignThrows : RULES.dailyThrows
    this.target = target
  }

  get throwsUsed(): number {
    return this.records.length
  }

  get remaining(): number {
    return this.totalThrows - this.records.length
  }

  get cleared(): boolean {
    return this.mode === 'campaign' ? this.hits >= this.target : this.finished
  }

  /** 记录一次投掷结果；局已结束时忽略（防止重复计入） */
  record(hit: boolean): ThrowRecord | null {
    if (this.finished) return null
    if (hit) {
      this.hits++
      this.streak++
      this.bestStreak = Math.max(this.bestStreak, this.streak)
    } else {
      this.streak = 0
    }
    const points = this.mode === 'daily' && hit ? dailyHitPoints(this.streak) : 0
    this.score += points
    const rec: ThrowRecord = { hit, points, streak: this.streak }
    this.records.push(rec)
    if (this.mode === 'campaign' && this.hits >= this.target) this.finished = true
    if (this.remaining <= 0) this.finished = true
    return rec
  }

  summary(): RoundSummary {
    const cleared = this.mode === 'campaign' ? this.hits >= this.target : this.finished
    return {
      mode: this.mode,
      cleared,
      hits: this.hits,
      throwsUsed: this.throwsUsed,
      remaining: this.remaining,
      stars: this.mode === 'campaign' ? starsFor(cleared, this.remaining) : 0,
      score: this.score,
      bestStreak: this.bestStreak,
    }
  }
}
