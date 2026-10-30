import { BIN, PHYSICS } from '../config/gameConfig'

/**
 * 命中判定状态流程（每次投掷一个实例）：
 *
 *   outside ──(纸团中心从桶口上方向下越过桶口线，且碰到桶口感应区)──▶ inside
 *   inside  ──(重新回到桶口上方 / 离开桶内范围)──▶ outside（停留计时清零）
 *   inside  ──(连续停留 dwellMs)──▶ scored  ← 只在这里得分一次，之后不再变化
 *   outside ──(没经过桶口就出现在桶内，例如从桶底或侧壁穿入)──▶ invalid（本次投掷不再计分）
 *
 * 坐标全部换算到“桶的局部坐标”（以桶底中心为原点），所以移动垃圾桶同样适用。
 */
export type HitState = 'outside' | 'inside' | 'scored' | 'invalid'

export interface HitSample {
  /** 纸团中心（本步之后 / 本步之前） */
  x: number
  y: number
  prevX: number
  prevY: number
  /** 桶底中心（本步之后 / 本步之前） */
  binX: number
  binY: number
  prevBinX: number
  prevBinY: number
  /** 本步纸团是否接触到桶口感应区 */
  mouthContact: boolean
  dtMs: number
}

export interface HitDetectorOptions {
  binHeight: number
  innerWidth?: number
  ballRadius?: number
  dwellMs?: number
}

export class HitDetector {
  state: HitState = 'outside'
  /** 已在桶内连续停留的时间 */
  dwellMs = 0
  /** 从桶口进入的次数（弹出后再落回会再次计入，但最多得分一次） */
  entries = 0
  private readonly mouthY: number
  private readonly half: number
  private readonly radius: number
  private readonly needDwell: number
  /** 上一步是否接触了感应区（纸团很快时，越过桶口线和接触可能相差一步） */
  private contactLastStep = false

  constructor(opts: HitDetectorOptions) {
    this.mouthY = -opts.binHeight
    this.half = (opts.innerWidth ?? BIN.innerWidth) / 2
    this.radius = opts.ballRadius ?? PHYSICS.ball.radius
    this.needDwell = opts.dwellMs ?? BIN.dwellMs
  }

  /** 推进一步；只有刚刚得分的那一步返回 true */
  update(s: HitSample): boolean {
    const contact = s.mouthContact || this.contactLastStep
    this.contactLastStep = s.mouthContact
    if (this.state === 'scored' || this.state === 'invalid') return false

    const lx = s.x - s.binX
    const ly = s.y - s.binY
    const plx = s.prevX - s.prevBinX
    const ply = s.prevY - s.prevBinY
    const withinMouth = Math.abs(lx) < this.half && Math.abs(plx) < this.half + this.radius
    const crossedDown = ply <= this.mouthY && ly > this.mouthY && withinMouth
    const insideRegion = Math.abs(lx) < this.half && ly > this.mouthY + this.radius * 0.5 && ly < 0

    if (this.state === 'outside') {
      if (crossedDown && contact) {
        this.state = 'inside'
        this.dwellMs = 0
        this.entries++
      } else if (insideRegion) {
        // 没有从桶口上方进入却出现在桶内：从桶底/侧面穿过，不计分
        this.state = 'invalid'
        return false
      } else {
        return false
      }
    }

    // state === 'inside'
    const poppedOut = ly <= this.mouthY - this.radius || Math.abs(lx) >= this.half + this.radius
    if (poppedOut) {
      this.state = 'outside'
      this.dwellMs = 0
      return false
    }
    this.dwellMs += s.dtMs
    if (this.dwellMs >= this.needDwell) {
      this.state = 'scored'
      return true
    }
    return false
  }
}
