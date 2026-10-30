import type { Vec2 } from '../physics/matterLib'

export type SceneId = 'desk' | 'pantry' | 'meeting'

/** 障碍物外观（物理上都是矩形；外观只影响绘制） */
export type ObstacleKind =
  | 'desk'
  | 'monitor'
  | 'cabinet'
  | 'shelf'
  | 'wall'
  | 'partition'
  | 'coffeeMachine'
  | 'fridge'
  | 'counter'
  | 'table'
  | 'whiteboard'
  | 'lamp'
  | 'screen'
  | 'plantPot'

/** 静态矩形障碍：x、y 为中心点 */
export interface RectObstacle {
  kind: ObstacleKind
  x: number
  y: number
  w: number
  h: number
  /** 旋转角度（度） */
  angle?: number
  /** 弹性，默认按种类决定 */
  restitution?: number
}

/**
 * 按固定路线运动。位置是时间的纯函数：position = f(回合时间)，
 * 所以每次重开把时间归零即可重置所有动态障碍的相位。
 */
export type Motion =
  | { type: 'pingpong'; from: Vec2; to: Vec2; periodMs: number; phase?: number }
  | { type: 'loop'; points: Vec2[]; periodMs: number; phase?: number }

export interface BinDef {
  /** 桶底中心点 */
  x: number
  y: number
  /** 桶高（默认 92） */
  height?: number
  /** 移动垃圾桶：位置为桶底中心点 */
  motion?: Motion
}

/** 坐在转椅上的朋友：按路线移动的障碍，位置为椅子轮子着地点 */
export interface ChairGuestDef {
  kind: 'chairGuest'
  /** 使用观众名单里的第几个人物（人数不足时循环复用） */
  slot: number
  motion: Motion
}

export type DynamicObstacleDef = ChairGuestDef

/** 风力区域：x、y 为中心点，ax、ay 为每物理步的加速度（逻辑像素/步²） */
export interface WindZone {
  x: number
  y: number
  w: number
  h: number
  ax: number
  ay: number
}

/** 关卡与每日挑战共用的布局 */
export interface LayoutDef {
  scene: SceneId
  /** 纸团出现的位置 */
  throwPoint: Vec2
  bin: BinDef
  staticObstacles: RectObstacle[]
  dynamicObstacles: DynamicObstacleDef[]
  windZones: WindZone[]
}

export interface LevelDef extends LayoutDef {
  id: number
  name: string
  /** 目标进球数 */
  target: number
  /** 关卡开始时的提示 */
  hint: string
  /** 难度说明 */
  difficulty: string
  /** 第一次出现的新机制提示（一句话） */
  newMechanic?: string
}

export interface DailyTemplate extends LayoutDef {
  id: string
  name: string
}
