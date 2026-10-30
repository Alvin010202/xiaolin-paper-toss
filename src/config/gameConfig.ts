/**
 * 游戏的固定参数。
 * 物理在固定的逻辑尺寸（540×960）和固定步长（1/60 秒）下运行，
 * 屏幕大小和设备像素比只影响显示与输入映射，不影响物理结果。
 */

export const GAME_TITLE = '小林这球必须进'

/** 逻辑画面尺寸与地面高度 */
export const WORLD = {
  width: 540,
  height: 960,
  /** 地面顶部的 y 坐标 */
  floorY: 860,
  /** 超出画面多少像素算飞出边界 */
  outMargin: 80,
} as const

/** 物理参数（所有关卡、每日挑战、关卡验证工具共用同一套） */
export const PHYSICS = {
  /** 固定步长（毫秒） */
  stepMs: 1000 / 60,
  gravityY: 1,
  gravityScale: 0.001,
  positionIterations: 10,
  velocityIterations: 8,
  ball: {
    radius: 13,
    density: 0.0012,
    restitution: 0.12,
    friction: 0.08,
    frictionStatic: 0.4,
    /** 纸团的空气阻力 */
    frictionAir: 0.006,
  },
} as const

/** 投掷手感 */
export const THROW = {
  /** 在纸团周围多大范围内按下算抓住纸团 */
  grabRadius: 84,
  /** 拖动距离小于这个值松手不发射（防误触） */
  minDrag: 26,
  /** 拖动距离上限，超过按上限计算 */
  maxDrag: 170,
  /** 发射速度范围（逻辑像素 / 物理步） */
  minSpeed: 6,
  maxSpeed: 19,
  /** 轨迹预览只模拟飞行前段的这么多步 */
  previewSteps: 22,
  previewDotEvery: 2,
  /** 单次投掷最长时间 */
  timeLimitMs: 7000,
  /** 速度低于该值并持续 restMs 视为静止 */
  restSpeed: 0.18,
  restMs: 700,
  /** 一次投掷结束后到出现下一枚纸团的间隔 */
  nextBallDelayMs: 420,
} as const

/** 垃圾桶尺寸与命中判定 */
export const BIN = {
  innerWidth: 74,
  wallThickness: 10,
  bottomThickness: 10,
  defaultHeight: 92,
  /** 桶口感应区高度（以桶口为中线） */
  sensorHeight: 22,
  /** 纸团需要在桶内停留的时间 */
  dwellMs: 300,
} as const

/** 模式规则 */
export const RULES = {
  campaignThrows: 5,
  dailyThrows: 10,
  dailyBaseScore: 100,
  dailyStreakStep: 25,
  dailyStreakMax: 100,
  /** 每日挑战规则版本：规则或模板改动时需要升级 */
  dailyRuleVersion: 'daily-v1',
  dailyTimeZone: 'Asia/Shanghai',
} as const
