import { RULES } from '../config/gameConfig'

/** 闯关星级：过关 1 星；剩余至少 1 次机会 2 星；剩余至少 2 次机会 3 星；未过关 0 星 */
export function starsFor(cleared: boolean, remainingThrows: number): 0 | 1 | 2 | 3 {
  if (!cleared) return 0
  if (remainingThrows >= 2) return 3
  if (remainingThrows >= 1) return 2
  return 1
}

/**
 * 每日挑战单球得分。streak 为命中后的连续命中数（本球是第几个连续命中）。
 * 命中基础 100；从连续第 2 球起加成 25、50、75，之后封顶 100。
 */
export function dailyHitPoints(streak: number): number {
  if (streak < 1) return 0
  const bonus = Math.min((streak - 1) * RULES.dailyStreakStep, RULES.dailyStreakMax)
  return RULES.dailyBaseScore + bonus
}

/** 一串投掷结果（true 为命中）的每日挑战总分 */
export function dailyTotal(results: boolean[]): number {
  let streak = 0
  let total = 0
  for (const hit of results) {
    if (hit) {
      streak++
      total += dailyHitPoints(streak)
    } else {
      streak = 0
    }
  }
  return total
}
