import { DEFAULT_CHEER_LINES, DEFAULT_MISS_LINES, PRESET_CHARACTERS } from './characters.config'
import type { AvatarStore, StoredCharacter } from './avatarStore'
import { AVATAR_SIZE, drawPlaceholderAvatar } from './placeholder'
import type { RosterCharacter } from './types'
import { DEFAULT_PITCHER } from '../save/schema'

/**
 * 人物名单：预置人物 + 玩家导入的人物。
 * 每个人物都有一张 256×256 的正方形头像画布（加载失败时为占位头像），游戏和界面都从这里取图。
 */
export class CharacterRoster {
  characters: RosterCharacter[] = []
  private readonly canvases = new Map<string, HTMLCanvasElement>()
  private readonly dataUrls = new Map<string, string>()
  /** 每次名单变化 +1，游戏画面据此刷新纹理 */
  revision = 0

  constructor(private readonly store: AvatarStore) {}

  get persistent(): boolean {
    return this.store.persistent
  }

  async load(): Promise<void> {
    let customs: StoredCharacter[] = []
    try {
      customs = await this.store.list()
    } catch {
      customs = []
    }
    const list: RosterCharacter[] = PRESET_CHARACTERS.map((c, i) => ({ ...c, source: 'preset', placeholderStyle: i % 4 }))
    customs.forEach((c, i) =>
      list.push({
        id: c.id,
        nickname: c.nickname,
        avatar: '',
        accentColor: c.accentColor,
        cheerLines: DEFAULT_CHEER_LINES,
        missLines: DEFAULT_MISS_LINES,
        source: 'custom',
        placeholderStyle: (i + 1) % 4,
      }),
    )
    this.characters = list
    this.canvases.clear()
    this.dataUrls.clear()
    const customById = new Map(customs.map((c) => [c.id, c]))
    await Promise.all(
      list.map(async (c) => {
        const blob = customById.get(c.id)?.image
        this.canvases.set(c.id, await loadAvatarCanvas(c, blob))
      }),
    )
    this.revision++
  }

  get(id: string): RosterCharacter | undefined {
    return this.characters.find((c) => c.id === id)
  }

  /** 选中的投手；不存在（例如已被删除）时回到小林 */
  pitcher(id: string): RosterCharacter {
    return this.get(id) ?? this.get(DEFAULT_PITCHER) ?? this.characters[0]
  }

  /** 除投手以外的观众；人数不足时循环复用（至少返回 count 个，名单只有一人时复用此人） */
  audience(pitcherId: string, count: number, offset = 0): RosterCharacter[] {
    const others = this.characters.filter((c) => c.id !== pitcherId)
    const pool = others.length ? others : this.characters
    const out: RosterCharacter[] = []
    for (let i = 0; i < count; i++) out.push(pool[(i + offset) % pool.length])
    return out
  }

  canvas(id: string): HTMLCanvasElement {
    let c = this.canvases.get(id)
    if (!c) {
      const ch = this.get(id)
      c = drawPlaceholderAvatar(ch?.accentColor ?? '#999999', 0, ch?.nickname.slice(0, 1) ?? '?')
      this.canvases.set(id, c)
    }
    return c
  }

  /** 给 DOM <img> 用的头像地址 */
  avatarUrl(id: string): string {
    let url = this.dataUrls.get(id)
    if (!url) {
      url = this.canvas(id).toDataURL('image/png')
      this.dataUrls.set(id, url)
    }
    return url
  }
}

/** 加载头像并画到正方形画布；任何失败都退回占位头像 */
export async function loadAvatarCanvas(c: RosterCharacter, blob?: Blob): Promise<HTMLCanvasElement> {
  const placeholder = () => drawPlaceholderAvatar(c.accentColor, c.placeholderStyle, c.source === 'custom' ? c.nickname.slice(0, 1) : '')
  let src = ''
  let revoke = false
  if (blob) {
    src = URL.createObjectURL(blob)
    revoke = true
  } else if (c.avatar) {
    src = new URL(c.avatar, document.baseURI).href
  }
  if (!src) return placeholder()
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    await img.decode()
    if (!img.naturalWidth) return placeholder()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = AVATAR_SIZE
    const g = canvas.getContext('2d')!
    // 居中裁成正方形，保持比例，避免头像变形
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    return canvas
  } catch {
    return placeholder()
  } finally {
    if (revoke) URL.revokeObjectURL(src)
  }
}

export function randomLine(lines: string[], fallback: string[]): string {
  const pool = lines.length ? lines : fallback
  return pool[Math.floor(Math.random() * pool.length)]
}
