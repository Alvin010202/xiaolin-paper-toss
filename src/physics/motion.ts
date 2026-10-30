import type { Vec2 } from './matterLib'
import type { Motion } from '../levels/types'

/** 路线在 tMs 时刻的位置（纯函数，不依赖帧率） */
export function motionPosition(m: Motion, tMs: number): Vec2 {
  const raw = tMs / m.periodMs + (m.phase ?? 0)
  const p = raw - Math.floor(raw)
  if (m.type === 'pingpong') {
    const s = p < 0.5 ? p * 2 : 2 - p * 2
    const eased = (1 - Math.cos(Math.PI * s)) / 2
    return { x: m.from.x + (m.to.x - m.from.x) * eased, y: m.from.y + (m.to.y - m.from.y) * eased }
  }
  // loop：沿闭合折线匀速运动
  const pts = m.points
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    lengths.push(len)
    total += len
  }
  let d = p * total
  for (let i = 0; i < pts.length; i++) {
    if (d <= lengths[i] || i === pts.length - 1) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const k = lengths[i] === 0 ? 0 : Math.min(1, d / lengths[i])
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    }
    d -= lengths[i]
  }
  return { ...pts[0] }
}

/** 有运动的布局，返回最长周期（用于关卡验证时枚举出手时机）；没有运动返回 0 */
export function layoutPeriod(motions: (Motion | undefined)[]): number {
  return motions.reduce((max, m) => (m ? Math.max(max, m.periodMs) : max), 0)
}
