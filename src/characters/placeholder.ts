/**
 * 原创占位头像：没有头像图片或图片损坏时，用 Canvas 画一个简单的卡通脸。
 * 不依赖任何外部图片，保证永远不会出现破图。
 */
export const AVATAR_SIZE = 256

export function drawPlaceholderAvatar(accent: string, style: number, initial: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = AVATAR_SIZE
  const g = c.getContext('2d')!
  const s = AVATAR_SIZE
  // 背景
  g.fillStyle = tint(accent, 0.78)
  g.fillRect(0, 0, s, s)
  // 头发（后层）
  g.fillStyle = ['#3b2f2f', '#6b4423', '#1f1f2e', '#8d5524'][style % 4]
  g.beginPath()
  if (style % 4 === 1) g.ellipse(s / 2, s * 0.52, s * 0.36, s * 0.4, 0, 0, Math.PI * 2)
  else g.ellipse(s / 2, s * 0.47, s * 0.33, s * 0.33, 0, 0, Math.PI * 2)
  g.fill()
  // 脸
  g.fillStyle = '#ffe3cf'
  g.beginPath()
  g.ellipse(s / 2, s * 0.56, s * 0.27, s * 0.29, 0, 0, Math.PI * 2)
  g.fill()
  // 刘海
  g.fillStyle = ['#3b2f2f', '#6b4423', '#1f1f2e', '#8d5524'][style % 4]
  g.beginPath()
  if (style % 4 === 2) {
    g.moveTo(s * 0.24, s * 0.46)
    g.quadraticCurveTo(s * 0.5, s * 0.16, s * 0.76, s * 0.46)
    g.quadraticCurveTo(s * 0.5, s * 0.36, s * 0.24, s * 0.46)
  } else {
    g.ellipse(s / 2, s * 0.36, s * 0.28, s * 0.13, 0, Math.PI, 0)
  }
  g.fill()
  // 眼睛
  g.fillStyle = '#2b2b2b'
  for (const dx of [-0.1, 0.1]) {
    g.beginPath()
    g.ellipse(s * (0.5 + dx), s * 0.56, s * 0.028, s * 0.036, 0, 0, Math.PI * 2)
    g.fill()
  }
  // 腮红
  g.fillStyle = 'rgba(255,120,140,0.35)'
  for (const dx of [-0.16, 0.16]) {
    g.beginPath()
    g.ellipse(s * (0.5 + dx), s * 0.64, s * 0.045, s * 0.028, 0, 0, Math.PI * 2)
    g.fill()
  }
  // 嘴
  g.strokeStyle = '#c0392b'
  g.lineWidth = s * 0.018
  g.lineCap = 'round'
  g.beginPath()
  g.arc(s / 2, s * 0.66, s * 0.05, 0.15 * Math.PI, 0.85 * Math.PI)
  g.stroke()
  // 名字首字（角标）
  if (initial) {
    g.fillStyle = accent
    g.beginPath()
    g.arc(s * 0.82, s * 0.82, s * 0.13, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff'
    g.font = `bold ${Math.round(s * 0.14)}px "PingFang SC", "Microsoft YaHei", sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(initial, s * 0.82, s * 0.825)
  }
  return c
}

/** 把颜色与白色混合 */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}
