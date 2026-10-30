import Phaser from 'phaser'
import type { CharacterRoster } from '../characters/roster'

export const TEX = {
  ball: 'paper-ball',
  confetti: 'confetti',
  puff: 'puff',
} as const

/** 程序生成的贴图（不依赖外部图片） */
export function ensureBaseTextures(scene: Phaser.Scene): void {
  const tm = scene.textures
  if (!tm.exists(TEX.ball)) {
    const s = 96
    const c = tm.createCanvas(TEX.ball, s, s)!
    const g = c.getContext()
    const cx = s / 2
    const r = s * 0.46
    g.fillStyle = '#fdfdfb'
    g.strokeStyle = '#8f8a80'
    g.lineWidth = 3
    g.beginPath()
    const n = 14
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const rr = r * (0.86 + ((i * 5) % 7) * 0.022)
      const x = cx + Math.cos(a) * rr
      const y = cx + Math.sin(a) * rr
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.fill()
    g.stroke()
    // 折痕和阴影
    g.fillStyle = 'rgba(120,110,95,0.16)'
    g.beginPath()
    g.moveTo(cx, cx)
    g.lineTo(cx + r * 0.8, cx + r * 0.3)
    g.lineTo(cx + r * 0.3, cx + r * 0.85)
    g.closePath()
    g.fill()
    g.strokeStyle = 'rgba(110,100,90,0.6)'
    g.lineWidth = 2.2
    g.beginPath()
    g.moveTo(cx - r * 0.55, cx - r * 0.25)
    g.lineTo(cx - r * 0.05, cx + r * 0.1)
    g.lineTo(cx + r * 0.45, cx - r * 0.45)
    g.moveTo(cx - r * 0.3, cx + r * 0.55)
    g.lineTo(cx + r * 0.2, cx + r * 0.35)
    g.lineTo(cx + r * 0.55, cx + r * 0.5)
    g.moveTo(cx - r * 0.05, cx + r * 0.1)
    g.lineTo(cx - r * 0.1, cx + r * 0.5)
    g.stroke()
    // 横线（笔记本纸）
    g.strokeStyle = 'rgba(80,140,220,0.35)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(cx - r * 0.7, cx - r * 0.55)
    g.lineTo(cx + r * 0.2, cx - r * 0.7)
    g.moveTo(cx - r * 0.75, cx + r * 0.25)
    g.lineTo(cx - r * 0.35, cx + r * 0.2)
    g.stroke()
    c.refresh()
  }
  if (!tm.exists(TEX.confetti)) {
    const c = tm.createCanvas(TEX.confetti, 12, 8)!
    const g = c.getContext()
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 12, 8)
    c.refresh()
  }
  if (!tm.exists(TEX.puff)) {
    const c = tm.createCanvas(TEX.puff, 32, 32)!
    const g = c.getContext()
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
    c.refresh()
  }
}

/** 圆形头像贴图：从人物的正方形头像裁成圆形，保持比例不变形 */
export function avatarTexture(scene: Phaser.Scene, roster: CharacterRoster, id: string): string {
  const key = `avatar:${id}:${roster.revision}`
  if (scene.textures.exists(key)) return key
  const src = roster.canvas(id)
  const s = 160
  const c = scene.textures.createCanvas(key, s, s)!
  const g = c.getContext()
  g.save()
  g.beginPath()
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
  g.clip()
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, 0, 0, s, s)
  g.restore()
  c.refresh()
  return key
}
