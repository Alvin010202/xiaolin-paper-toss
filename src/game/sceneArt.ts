import Phaser from 'phaser'
import { BIN, WORLD } from '../config/gameConfig'
import type { RectObstacle, SceneId } from '../levels/types'

/**
 * 三个办公室场景的背景与障碍物绘制（全部为程序绘制的原创矢量图形）。
 * 背景装饰颜色淡、对比低；障碍物用深色描边，保证轮廓清楚、不被装饰混淆。
 */

const OUTLINE = 0x3b3024
const W = WORLD.width
const FLOOR = WORLD.floorY

export const SCENE_NAMES: Record<SceneId, string> = {
  desk: '工位区',
  pantry: '茶水间',
  meeting: '会议室',
}

export function drawBackground(scene: Phaser.Scene, id: SceneId): void {
  const g = scene.add.graphics().setDepth(-100)
  if (id === 'desk') drawDesk(g)
  else if (id === 'pantry') drawPantry(g)
  else drawMeeting(g)
}

function drawDesk(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0xf6f1e7).fillRect(0, 0, W, FLOOR)
  g.fillStyle(0xeee5d3).fillRect(0, FLOOR - 26, W, 26)
  // 窗户
  g.fillStyle(0xd6ebfb).fillRoundedRect(36, 140, 170, 150, 8)
  g.fillStyle(0xffffff, 0.7).fillRect(118, 140, 6, 150).fillRect(36, 212, 170, 6)
  g.lineStyle(4, 0xd9cbb3).strokeRoundedRect(36, 140, 170, 150, 8)
  // 便签墙
  const notes = [0xfff07a, 0xffb3c7, 0xa8e6cf, 0xffd59e, 0xbde0fe]
  notes.forEach((c, i) => {
    const x = 260 + (i % 3) * 52
    const y = 150 + Math.floor(i / 3) * 56
    g.fillStyle(c, 0.85).fillRect(x, y, 42, 42)
    g.lineStyle(2, 0x000000, 0.12).lineBetween(x + 6, y + 14, x + 34, y + 14).lineBetween(x + 6, y + 24, x + 28, y + 24)
  })
  // 挂钟
  g.fillStyle(0xffffff).fillCircle(470, 190, 30)
  g.lineStyle(4, 0xd9cbb3).strokeCircle(470, 190, 30)
  g.lineStyle(3, 0x8a7a66).lineBetween(470, 190, 470, 170).lineBetween(470, 190, 484, 196)
  // 墙脚的远处工位剪影（与墙同色系、很淡、没有描边，不会被误认为障碍）
  g.fillStyle(0xe6dccb, 0.6)
  for (let x = 150; x < W; x += 150) g.fillRoundedRect(x, FLOOR - 70, 110, 44, 6)
  // 绿植（左下角，在投手身后）
  g.fillStyle(0xc77d4a, 0.8).fillRoundedRect(14, FLOOR - 70, 44, 70, 6)
  g.fillStyle(0x6bbf59, 0.8)
  for (const [x, y, r] of [
    [36, FLOOR - 92, 22],
    [20, FLOOR - 110, 16],
    [52, FLOOR - 116, 18],
    [36, FLOOR - 134, 15],
  ])
    g.fillEllipse(x, y, r * 1.4, r * 2)
  // 木地板
  g.fillStyle(0xd8b98f).fillRect(0, FLOOR, W, WORLD.height - FLOOR)
  g.lineStyle(2, 0xc19d70, 0.7)
  for (let y = FLOOR + 24; y < WORLD.height; y += 24) g.lineBetween(0, y, W, y)
  for (let x = 40; x < W; x += 120) g.lineBetween(x, FLOOR, x, FLOOR + 24).lineBetween(x + 60, FLOOR + 24, x + 60, FLOOR + 48)
  g.lineStyle(4, 0xa98458).lineBetween(0, FLOOR, W, FLOOR)
}

function drawPantry(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0xe6f5f0).fillRect(0, 0, W, FLOOR)
  // 墙砖
  g.lineStyle(2, 0xcfe8df, 1)
  for (let y = 120; y < FLOOR; y += 40) g.lineBetween(0, y, W, y)
  for (let y = 120; y < FLOOR; y += 40) for (let x = (y / 40) % 2 ? 0 : 30; x < W; x += 60) g.lineBetween(x, y, x, y + 40)
  // 上方吊柜轮廓（淡）
  g.fillStyle(0xffffff, 0.55).fillRoundedRect(20, 120, 200, 110, 8)
  g.lineStyle(3, 0xb9d9cf).strokeRoundedRect(20, 120, 200, 110, 8).lineBetween(120, 120, 120, 230)
  // 杯子架
  g.fillStyle(0xb98b5e, 0.6).fillRect(300, 270, 200, 10)
  const cups = [0xff8fab, 0x4d96ff, 0xffd166, 0x6bcb77]
  cups.forEach((c, i) => {
    g.fillStyle(c, 0.75).fillRoundedRect(316 + i * 46, 236, 28, 34, 5)
    g.lineStyle(3, c, 0.75).strokeCircle(348 + i * 46, 252, 7)
  })
  // 远处的咖啡机（装饰，很淡）
  g.fillStyle(0x5a4a42, 0.22).fillRoundedRect(250, 140, 70, 90, 8)
  g.fillStyle(0xffffff, 0.3).fillCircle(285, 170, 10)
  // 地砖
  g.fillStyle(0xf2e8d5).fillRect(0, FLOOR, W, WORLD.height - FLOOR)
  g.fillStyle(0xe2d3b5)
  for (let y = FLOOR; y < WORLD.height; y += 34) for (let x = (((y - FLOOR) / 34) % 2) * 34; x < W; x += 68) g.fillRect(x, y, 34, 34)
  g.lineStyle(4, 0xb9a57f).lineBetween(0, FLOOR, W, FLOOR)
}

function drawMeeting(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0xe9edf6).fillRect(0, 0, W, FLOOR)
  // 落地窗与城市天际线
  g.fillStyle(0xcfe3f8).fillRect(0, 120, W, 200)
  g.fillStyle(0xaec6e4, 0.8)
  const towers = [40, 70, 110, 60, 130, 90, 150, 80, 100, 120, 70]
  towers.forEach((h, i) => g.fillRect(i * 50, 320 - h, 42, h))
  g.lineStyle(6, 0xffffff, 0.9)
  for (let x = 0; x <= W; x += 135) g.lineBetween(x, 120, x, 320)
  g.lineBetween(0, 320, W, 320)
  // 墙上的小白板装饰
  g.fillStyle(0xffffff, 0.85).fillRoundedRect(30, 370, 150, 100, 6)
  g.lineStyle(3, 0xc8cfdc).strokeRoundedRect(30, 370, 150, 100, 6)
  g.lineStyle(3, 0x4d96ff, 0.7).lineBetween(46, 450, 80, 420).lineBetween(80, 420, 110, 435).lineBetween(110, 435, 160, 390)
  g.lineStyle(3, 0xef476f, 0.6).strokeCircle(160, 390, 8)
  // 远处的会议桌与椅子（很淡）
  g.fillStyle(0x8d99ae, 0.18).fillRoundedRect(120, 760, 360, 24, 8)
  g.fillStyle(0x8d99ae, 0.14)
  for (let x = 140; x < 480; x += 80) g.fillRoundedRect(x, 712, 40, 46, 10)
  // 地毯
  g.fillStyle(0x7d8bb0).fillRect(0, FLOOR, W, WORLD.height - FLOOR)
  g.fillStyle(0x8a98bc)
  for (let y = FLOOR + 10; y < WORLD.height; y += 20) for (let x = (((y - FLOOR) / 20) % 2) * 20; x < W; x += 40) g.fillRect(x, y, 10, 4)
  g.lineStyle(4, 0x5d6a8f).lineBetween(0, FLOOR, W, FLOOR)
}

/** 画一个静态障碍（以障碍中心为原点的局部坐标） */
export function drawObstacle(scene: Phaser.Scene, o: RectObstacle): Phaser.GameObjects.Container {
  const g = scene.add.graphics()
  const w = o.w
  const h = o.h
  const x0 = -w / 2
  const y0 = -h / 2
  const box = (fill: number, radius = 6) => {
    g.fillStyle(fill).fillRoundedRect(x0, y0, w, h, Math.min(radius, w / 2, h / 2))
    g.lineStyle(3, OUTLINE).strokeRoundedRect(x0, y0, w, h, Math.min(radius, w / 2, h / 2))
  }
  switch (o.kind) {
    case 'desk': {
      box(0xd9a066, 4)
      g.fillStyle(0xb57f45).fillRect(x0 + 3, y0 + 3, w - 6, 14)
      g.lineStyle(2, 0x8a5a2b, 0.6)
      for (let i = 1; i < 3; i++) g.strokeRoundedRect(x0 + 14, y0 + 24 + (i - 1) * ((h - 30) / 2), w * 0.35, (h - 40) / 2, 3)
      g.fillStyle(0x8a5a2b).fillCircle(x0 + 14 + w * 0.175, y0 + 30 + (h - 40) / 4, 3)
      break
    }
    case 'monitor': {
      g.fillStyle(0x5c6370).fillRect(-6, y0 + h * 0.7, 12, h * 0.3)
      g.fillStyle(0x2f3540).fillRoundedRect(x0, y0, w, h * 0.72, 5)
      g.lineStyle(3, OUTLINE).strokeRoundedRect(x0, y0, w, h * 0.72, 5)
      g.fillStyle(0x3a6ea5).fillRect(x0 + 6, y0 + 6, w - 12, h * 0.72 - 12)
      g.lineStyle(2, 0xa8e6cf, 0.8)
      for (let i = 0; i < 4; i++) g.lineBetween(x0 + 12, y0 + 14 + i * 9, x0 + 12 + ((i * 17) % 30) + 14, y0 + 14 + i * 9)
      g.fillStyle(0x5c6370).fillRoundedRect(-w * 0.3, h / 2 - 6, w * 0.6, 6, 2)
      break
    }
    case 'cabinet': {
      box(0xb8c4d0, 5)
      const drawers = Math.max(1, Math.round(h / 60))
      g.lineStyle(2, 0x6b7a8a)
      for (let i = 1; i < drawers; i++) g.lineBetween(x0 + 6, y0 + (h / drawers) * i, x0 + w - 6, y0 + (h / drawers) * i)
      g.fillStyle(0x6b7a8a)
      for (let i = 0; i < drawers; i++) g.fillRoundedRect(-14, y0 + (h / drawers) * i + 10, 28, 6, 3)
      break
    }
    case 'shelf': {
      box(0xc8955c, 3)
      g.fillStyle(0x8a6a4a).fillTriangle(x0 + w - 30, y0 + h, x0 + w - 8, y0 + h, x0 + w - 8, y0 + h + 26)
      break
    }
    case 'wall': {
      box(0xd8d2c4, 2)
      g.lineStyle(2, 0xb5ad9b, 0.8)
      for (let y = y0 + 20; y < y0 + h; y += 40) g.lineBetween(x0 + 2, y, x0 + w - 2, y)
      break
    }
    case 'partition': {
      box(0x7aa6d8, 6)
      g.lineStyle(2, 0xffffff, 0.35)
      for (let y = y0 + 10; y < y0 + h; y += 10) g.lineBetween(x0 + 3, y, x0 + w - 3, y)
      break
    }
    case 'coffeeMachine': {
      box(0x4a3b35, 8)
      g.fillStyle(0x2a211d).fillRoundedRect(x0 + 10, y0 + h * 0.45, w - 20, h * 0.3, 4)
      g.fillStyle(0xffffff).fillRoundedRect(-10, y0 + h * 0.58, 20, 18, 3)
      g.fillStyle(0xef476f).fillCircle(x0 + w - 14, y0 + 16, 5)
      g.fillStyle(0x9aa0a6).fillRoundedRect(x0 + 10, y0 + 10, w * 0.45, 16, 3)
      break
    }
    case 'fridge': {
      box(0xf1f5f9, 8)
      g.lineStyle(2, 0x94a3b8).lineBetween(x0 + 4, y0 + h * 0.35, x0 + w - 4, y0 + h * 0.35)
      g.fillStyle(0x94a3b8).fillRect(x0 + w - 14, y0 + 16, 5, 30)
      break
    }
    case 'counter': {
      box(0xa7c4bc, 4)
      g.fillStyle(0xf4f1ea).fillRect(x0, y0, w, 14)
      g.lineStyle(3, OUTLINE).strokeRect(x0, y0, w, 14)
      g.lineStyle(2, 0x6f8f86).lineBetween(0, y0 + 20, 0, y0 + h - 6)
      g.fillStyle(0x6f8f86).fillCircle(-8, y0 + 40, 3).fillCircle(8, y0 + 40, 3)
      break
    }
    case 'table': {
      g.fillStyle(0x6b7d99).fillRect(-10, y0 + 18, 20, h - 18)
      g.fillStyle(0x6b7d99).fillRoundedRect(-w * 0.3, y0 + h - 12, w * 0.6, 12, 4)
      g.fillStyle(0xf2efe8).fillRoundedRect(x0, y0, w, 22, 6)
      g.lineStyle(3, OUTLINE).strokeRoundedRect(x0, y0, w, 22, 6)
      // 物理形状是整块矩形：用淡色填充提示桌下也会挡
      g.fillStyle(0x6b7d99, 0.18).fillRect(x0 + 6, y0 + 22, w - 12, h - 22)
      g.lineStyle(2, OUTLINE, 0.35).strokeRect(x0 + 6, y0 + 22, w - 12, h - 22)
      break
    }
    case 'whiteboard': {
      box(0xffffff, 4)
      g.lineStyle(4, 0x9aa5b8).strokeRect(x0 + 2, y0 + 2, w - 4, h - 4)
      g.lineStyle(2, 0x4d96ff, 0.6)
      for (let y = y0 + 30; y < y0 + h - 20; y += 50) g.lineBetween(x0 + 6, y, x0 + w - 6, y + 10)
      break
    }
    case 'lamp': {
      g.lineStyle(2, 0x6b7280).lineBetween(0, y0, 0, -o.y)
      g.fillStyle(0xffd166).fillEllipse(0, y0 + h - 4, w * 0.5, 10)
      g.fillStyle(0x374151).fillRoundedRect(x0, y0, w, h - 6, { tl: 20, tr: 20, bl: 4, br: 4 })
      g.lineStyle(3, OUTLINE).strokeRoundedRect(x0, y0, w, h - 6, { tl: 20, tr: 20, bl: 4, br: 4 })
      break
    }
    case 'screen': {
      g.lineStyle(2, 0x6b7280).lineBetween(x0 + 20, y0, x0 + 20, -o.y).lineBetween(x0 + w - 20, y0, x0 + w - 20, -o.y)
      box(0xe5e7eb, 8)
      g.fillStyle(0x9ca3af).fillRect(x0 + 8, y0 + h / 2 - 2, w - 16, 4)
      break
    }
    case 'plantPot': {
      box(0xc77d4a, 6)
      g.fillStyle(0x6bbf59).fillEllipse(0, y0 - 10, w * 0.9, 30)
      break
    }
  }
  const c = scene.add.container(o.x, o.y, [g])
  if (o.angle) c.setRotation((o.angle * Math.PI) / 180)
  return c
}

/** 垃圾桶的后半部分（桶内阴影）与前半部分（铁丝网），纸团夹在两者之间显示 */
export function drawBinParts(scene: Phaser.Scene, height: number): { back: Phaser.GameObjects.Graphics; front: Phaser.GameObjects.Graphics } {
  const half = BIN.innerWidth / 2
  const t = BIN.wallThickness
  const outer = half + t
  const back = scene.add.graphics()
  back.fillStyle(0x4b5563).fillRect(-half, -height, half * 2, height)
  back.fillStyle(0x374151).fillEllipse(0, -height, half * 2, 14)
  const front = scene.add.graphics()
  // 侧壁与桶底（与物理形状一致）
  front.fillStyle(0x9aa5b4).fillRect(-outer, -height, t, height).fillRect(half, -height, t, height)
  front.fillStyle(0x7b8696).fillRect(-outer, -BIN.bottomThickness, outer * 2, BIN.bottomThickness)
  // 铁丝网（半透明，能看到桶里的纸团）
  front.lineStyle(2, 0xcbd5e1, 0.55)
  for (let x = -half + 10; x < half; x += 12) front.lineBetween(x, -height + 6, x, -BIN.bottomThickness)
  for (let y = -height + 18; y < -BIN.bottomThickness; y += 16) front.lineBetween(-half, y, half, y)
  front.lineStyle(3, OUTLINE).strokeRect(-outer, -height, outer * 2, height)
  // 桶口边沿
  front.fillStyle(0xd1d9e3).fillRoundedRect(-outer - 3, -height - 4, outer * 2 + 6, 8, 4)
  front.lineStyle(2, OUTLINE).strokeRoundedRect(-outer - 3, -height - 4, outer * 2 + 6, 8, 4)
  return { back, front }
}
