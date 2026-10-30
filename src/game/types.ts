import type { LayoutDef } from '../levels/types'
import type { RoundMode, RoundSummary, ThrowRecord } from '../rules/round'

/** 开始一局所需的全部信息（由界面层组装后交给游戏画面） */
export interface RoundConfig {
  mode: RoundMode
  layout: LayoutDef
  /** 关卡 id（闯关）；每日挑战为 0 */
  levelId: number
  title: string
  target: number
  hint: string
  newMechanic?: string
  pitcherId: string
  /** 观众（底部 3 位） */
  audienceIds: string[]
  /** 转椅嘉宾按 slot 取人 */
  guestIds: string[]
  /** 每日挑战主持人 */
  hostId?: string
  /** 是否显示拖动演示 */
  showTutorial: boolean
}

export interface HudState {
  mode: RoundMode
  throwsLeft: number
  totalThrows: number
  hits: number
  target: number
  score: number
  streak: number
}

export interface GameCallbacks {
  onHud(s: HudState): void
  onThrow(rec: ThrowRecord): void
  onRoundEnd(summary: RoundSummary): void
  /** 第一次成功出手（用于关闭新手演示） */
  onFirstLaunch(): void
}
