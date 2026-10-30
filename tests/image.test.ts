import { describe, expect, it } from 'vitest'
import { cropRectFor, sniffImageType } from '../src/characters/imageProcess'

describe('导入图片格式识别', () => {
  it('按文件头识别 JPEG / PNG / WebP', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')
    expect(sniffImageType(webp)).toBe('image/webp')
  })

  it('其他文件（改了扩展名的 GIF、文本）被拒绝', () => {
    expect(sniffImageType(new TextEncoder().encode('GIF89a......'))).toBeNull()
    expect(sniffImageType(new TextEncoder().encode('hello world'))).toBeNull()
    expect(sniffImageType(new Uint8Array([]))).toBeNull()
  })
})

describe('方形裁剪', () => {
  it('缩放 1：取短边的正方形并居中', () => {
    expect(cropRectFor(400, 300, 1, 0, 0)).toEqual({ sx: 50, sy: 0, size: 300 })
  })

  it('放大后裁剪框变小', () => {
    expect(cropRectFor(400, 400, 2, 0, 0)).toEqual({ sx: 100, sy: 100, size: 200 })
  })

  it('平移不会超出图片边界', () => {
    const r = cropRectFor(400, 300, 1, 9999, 9999)
    expect(r.sx + r.size).toBeLessThanOrEqual(400)
    expect(r.sy).toBe(0)
    const r2 = cropRectFor(400, 400, 2, -9999, 0)
    expect(r2.sx).toBe(0)
  })
})
