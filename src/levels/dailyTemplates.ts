import type { DailyTemplate } from './types'

/**
 * 每日挑战布局模板。每天按日期种子从这里选一个，不现场随机拼障碍。
 * 每个模板都经过 scripts/solve-levels.ts 的实际物理验证（solutions.json 中的 daily-* 条目）。
 * 增删或修改模板后需要升级 RULES.dailyRuleVersion，并重新运行 `npm run solve`。
 */
export const DAILY_TEMPLATES: DailyTemplate[] = [
  {
    id: 'cubicle',
    name: '工位越野',
    scene: 'desk',
    throwPoint: { x: 100, y: 720 },
    bin: { x: 466, y: 860 },
    staticObstacles: [
      { kind: 'wall', x: 532, y: 560, w: 16, h: 600 },
      { kind: 'desk', x: 290, y: 805, w: 180, h: 110 },
      { kind: 'monitor', x: 310, y: 712, w: 70, h: 76 },
    ],
    dynamicObstacles: [],
    windZones: [],
  },
  {
    id: 'shelf-breeze',
    name: '顺风上架',
    scene: 'pantry',
    throwPoint: { x: 100, y: 720 },
    bin: { x: 452, y: 653, height: 84 },
    staticObstacles: [
      { kind: 'wall', x: 532, y: 560, w: 16, h: 600 },
      { kind: 'shelf', x: 452, y: 660, w: 160, h: 14 },
    ],
    dynamicObstacles: [],
    windZones: [{ x: 300, y: 450, w: 420, h: 420, ax: 0.03, ay: 0 }],
  },
  {
    id: 'gap',
    name: '吊柜窄缝',
    scene: 'pantry',
    throwPoint: { x: 100, y: 740 },
    bin: { x: 440, y: 860 },
    staticObstacles: [
      { kind: 'cabinet', x: 410, y: 540, w: 260, h: 180 },
      { kind: 'counter', x: 240, y: 815, w: 100, h: 90 },
    ],
    dynamicObstacles: [],
    windZones: [],
  },
  {
    id: 'slider',
    name: '滑行垃圾桶',
    scene: 'meeting',
    throwPoint: { x: 100, y: 720 },
    bin: { x: 380, y: 860, motion: { type: 'pingpong', from: { x: 300, y: 860 }, to: { x: 440, y: 860 }, periodMs: 4000 } },
    staticObstacles: [{ kind: 'whiteboard', x: 528, y: 600, w: 24, h: 420 }],
    dynamicObstacles: [],
    windZones: [],
  },
  {
    id: 'chair-rush',
    name: '转椅高峰',
    scene: 'meeting',
    throwPoint: { x: 100, y: 720 },
    bin: { x: 430, y: 860 },
    staticObstacles: [{ kind: 'wall', x: 532, y: 560, w: 16, h: 600 }],
    dynamicObstacles: [
      {
        kind: 'chairGuest',
        slot: 0,
        motion: { type: 'pingpong', from: { x: 230, y: 860 }, to: { x: 335, y: 860 }, periodMs: 3400 },
      },
    ],
    windZones: [],
  },
  {
    id: 'updraft',
    name: '风扇托举',
    scene: 'pantry',
    throwPoint: { x: 100, y: 720 },
    bin: { x: 456, y: 860 },
    staticObstacles: [{ kind: 'coffeeMachine', x: 300, y: 790, w: 70, h: 140 }],
    dynamicObstacles: [],
    windZones: [{ x: 300, y: 500, w: 120, h: 440, ax: 0, ay: -0.12 }],
  },
]

export function getDailyTemplate(id: string): DailyTemplate | undefined {
  return DAILY_TEMPLATES.find((t) => t.id === id)
}
