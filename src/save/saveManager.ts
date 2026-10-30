import { parseSave, SAVE_KEY, defaultSave, type SaveData, type ParseResult } from './schema'

/** 最小的键值存储接口：浏览器里是 localStorage，测试里可以替换 */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type StorageStatus = 'ok' | 'unavailable'

/** localStorage 不可用（隐私模式、被禁用、配额满）时返回 null */
export function probeLocalStorage(): KeyValueStore | null {
  try {
    const ls = globalThis.localStorage
    if (!ls) return null
    const k = '__xlpt_probe__'
    ls.setItem(k, '1')
    ls.removeItem(k)
    return ls
  } catch {
    return null
  }
}

/**
 * 存档管理：读取失败、数据损坏或存储不可用时都能继续游戏（退回内存存档）。
 * notice 给界面显示一句简短提示。
 */
export class SaveManager {
  data: SaveData
  storage: StorageStatus
  loadStatus: ParseResult['status']
  /** 最近一次写入是否失败 */
  writeFailed = false

  constructor(private readonly store: KeyValueStore | null, reducedMotionDefault = false) {
    this.storage = store ? 'ok' : 'unavailable'
    let raw: string | null = null
    try {
      raw = store ? store.getItem(SAVE_KEY) : null
    } catch {
      this.storage = 'unavailable'
    }
    const parsed = parseSave(raw, reducedMotionDefault)
    this.data = parsed.data
    this.loadStatus = parsed.status
    // 升级或修复后立即写回新格式
    if (parsed.status === 'migrated' || parsed.status === 'repaired' || parsed.status === 'reset') this.save()
  }

  /** 给玩家的提示文字；没有需要提示的情况返回 null */
  get notice(): string | null {
    if (this.storage === 'unavailable') return '浏览器不允许本地存储，本次进度不会保存，但可以照常游玩。'
    if (this.writeFailed) return '进度保存失败（存储空间可能已满），本次游玩不受影响。'
    if (this.loadStatus === 'repaired') return '存档有部分数据损坏，已保留能读取的进度。'
    if (this.loadStatus === 'reset') return '存档无法读取，已重新开始。'
    return null
  }

  save(): boolean {
    if (!this.store || this.storage === 'unavailable') return false
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(this.data))
      this.writeFailed = false
      return true
    } catch {
      this.writeFailed = true
      return false
    }
  }

  /** 删除存档（进度、设置、每日挑战记录），回到默认值 */
  reset(reducedMotionDefault = false): void {
    this.data = defaultSave(reducedMotionDefault)
    try {
      this.store?.removeItem(SAVE_KEY)
    } catch {
      /* 存储不可用时只重置内存中的存档 */
    }
    this.loadStatus = 'empty'
  }
}
