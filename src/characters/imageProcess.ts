/**
 * 导入头像的本地图片处理：校验格式与大小、解码、按裁剪框输出 256×256 正方形图片。
 * 全部在浏览器内完成，不上传。
 */
import { AVATAR_SIZE } from './placeholder'

export const MAX_FILE_BYTES = 8 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export class ImageImportError extends Error {}

/** 根据文件头判断真实格式（不只看扩展名和 MIME） */
export function sniffImageType(bytes: Uint8Array): (typeof ACCEPTED_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return 'image/webp'
  return null
}

/** 检查文件；不合格时抛出带中文说明的错误 */
export async function validateImageFile(file: File): Promise<void> {
  if (file.size === 0) throw new ImageImportError('这个文件是空的。')
  if (file.size > MAX_FILE_BYTES) throw new ImageImportError('图片太大了，请选择 8 MB 以内的图片。')
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!sniffImageType(head)) throw new ImageImportError('只支持 JPEG、PNG、WebP 格式的图片。')
}

/** 解码图片；损坏的图片会抛出错误 */
export async function decodeImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty')
    if (img.naturalWidth < 32 || img.naturalHeight < 32) throw new ImageImportError('图片太小了，请选择至少 32×32 像素的图片。')
    return img
  } catch (e) {
    if (e instanceof ImageImportError) throw e
    throw new ImageImportError('图片无法读取，文件可能已损坏。')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface CropRect {
  /** 正方形裁剪框在原图中的左上角与边长（原图像素） */
  sx: number
  sy: number
  size: number
}

/** 按缩放与平移计算裁剪框。zoom ≥ 1：1 表示短边刚好填满；offset 为裁剪中心相对图片中心的偏移（原图像素） */
export function cropRectFor(imgW: number, imgH: number, zoom: number, offsetX: number, offsetY: number): CropRect {
  const size = Math.min(imgW, imgH) / Math.max(1, zoom)
  const maxX = (imgW - size) / 2
  const maxY = (imgH - size) / 2
  const cx = imgW / 2 + Math.max(-maxX, Math.min(maxX, offsetX))
  const cy = imgH / 2 + Math.max(-maxY, Math.min(maxY, offsetY))
  return { sx: cx - size / 2, sy: cy - size / 2, size }
}

/** 输出 256×256 正方形图片（优先 WebP，不支持时为 PNG） */
export async function renderCrop(img: CanvasImageSource, rect: CropRect, out = AVATAR_SIZE): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = c.height = out
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, rect.sx, rect.sy, rect.size, rect.size, 0, 0, out, out)
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/webp', 0.9))
  if (blob && blob.size > 0) return blob
  const png = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))
  if (!png) throw new ImageImportError('图片处理失败，请换一张试试。')
  return png
}
