import { GAME_TITLE } from '../config/gameConfig'

export interface ScoreCardData {
  nickname: string
  avatar: HTMLCanvasElement
  accentColor: string
  /** 例如“闯关模式”“每日挑战” */
  modeLabel: string
  /** 例如“第 3 关 · 高个子垃圾桶”“2026-10-30（Asia/Shanghai）” */
  detail: string
  /** 主成绩，例如“★★★”“850 分” */
  result: string
  /** 补充，例如“进球 2/2 · 剩余 3 次机会” */
  resultSub: string
  /** 一句简短文案 */
  line: string
  /** 当前有效的游戏入口地址；没有正式网址时为 null，不显示网址 */
  url: string | null
}

export const CARD_W = 1080
export const CARD_H = 1350
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

/** 画成绩卡（Canvas），返回画布 */
export function drawScoreCard(d: ScoreCardData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = CARD_W
  c.height = CARD_H
  const g = c.getContext('2d')!

  // 背景：浅黄便签纸 + 横线
  const bg = g.createLinearGradient(0, 0, 0, CARD_H)
  bg.addColorStop(0, '#fff8e1')
  bg.addColorStop(1, '#ffe8cc')
  g.fillStyle = bg
  g.fillRect(0, 0, CARD_W, CARD_H)
  g.strokeStyle = 'rgba(180,140,90,0.15)'
  g.lineWidth = 2
  for (let y = 120; y < CARD_H; y += 64) {
    g.beginPath()
    g.moveTo(60, y)
    g.lineTo(CARD_W - 60, y)
    g.stroke()
  }
  // 角落的纸团
  drawPaperBall(g, 930, 150, 46)
  drawPaperBall(g, 140, 1230, 34)
  drawPaperBall(g, 990, 1180, 26)

  // 标题
  g.textAlign = 'center'
  g.fillStyle = '#3d2c1e'
  g.font = `900 84px ${FONT}`
  g.fillText(GAME_TITLE, CARD_W / 2, 190)

  // 头像
  const cx = CARD_W / 2
  const cy = 400
  const r = 130
  g.save()
  g.beginPath()
  g.arc(cx, cy, r + 14, 0, Math.PI * 2)
  g.fillStyle = d.accentColor
  g.fill()
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.clip()
  g.drawImage(d.avatar, cx - r, cy - r, r * 2, r * 2)
  g.restore()

  g.fillStyle = '#3d2c1e'
  g.font = `bold 60px ${FONT}`
  g.fillText(fit(g, d.nickname, 800), cx, 620)

  // 模式与关卡
  g.font = `40px ${FONT}`
  g.fillStyle = '#7a5c3e'
  g.fillText(`${d.modeLabel} · ${fit(g, d.detail, 700)}`, cx, 700)

  // 成绩
  g.fillStyle = d.result.includes('★') ? '#f4a300' : '#e4572e'
  g.font = `900 140px ${FONT}`
  g.fillText(d.result, cx, 880)
  g.fillStyle = '#5a4330'
  g.font = `44px ${FONT}`
  g.fillText(d.resultSub, cx, 960)

  // 文案气泡
  g.font = `bold 46px ${FONT}`
  const text = fit(g, `“${d.line}”`, 860)
  const tw = g.measureText(text).width
  const bw = tw + 100
  roundRect(g, cx - bw / 2, 1020, bw, 100, 50)
  g.fillStyle = '#ffffff'
  g.fill()
  g.strokeStyle = d.accentColor
  g.lineWidth = 6
  g.stroke()
  g.fillStyle = '#3d2c1e'
  g.fillText(text, cx, 1088)

  // 入口地址（没有正式网址时不显示，也不生成二维码）
  g.font = `34px ${FONT}`
  g.fillStyle = '#7a5c3e'
  if (d.url) g.fillText(fit(g, `来挑战：${d.url}`, 960), cx, 1240)
  else g.fillText('办公室纸团投篮小游戏', cx, 1240)
  return c
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
}

function fit(g: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (g.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function drawPaperBall(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save()
  g.fillStyle = '#ffffff'
  g.strokeStyle = '#c9b79c'
  g.lineWidth = 3
  g.beginPath()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const rr = r * (0.88 + ((i * 7) % 5) * 0.03)
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(x - r * 0.5, y - r * 0.2)
  g.lineTo(x + r * 0.1, y + r * 0.1)
  g.lineTo(x + r * 0.4, y - r * 0.4)
  g.moveTo(x - r * 0.2, y + r * 0.5)
  g.lineTo(x + r * 0.3, y + r * 0.3)
  g.stroke()
  g.restore()
}
