/**
 * 玩家导入的人物保存在浏览器 IndexedDB（图片以 Blob 形式存储，不放进 localStorage）。
 * 图片只在本机浏览器里处理和保存，不会上传到任何服务器。
 * IndexedDB 不可用时退回内存存储（本次可用，刷新后消失），并给出提示。
 */

export interface StoredCharacter {
  id: string
  nickname: string
  accentColor: string
  image: Blob
  createdAt: number
  updatedAt: number
}

const DB_NAME = 'xiaolin-paper-toss'
const STORE = 'customCharacters'
const DB_VERSION = 1

export interface AvatarStore {
  readonly persistent: boolean
  list(): Promise<StoredCharacter[]>
  put(c: StoredCharacter): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

class IdbAvatarStore implements AvatarStore {
  readonly persistent = true
  constructor(private readonly db: IDBDatabase) {}

  private tx(mode: IDBTransactionMode) {
    return this.db.transaction(STORE, mode).objectStore(STORE)
  }

  async list(): Promise<StoredCharacter[]> {
    const all = (await reqToPromise(this.tx('readonly').getAll())) as StoredCharacter[]
    return all.filter((c) => c && typeof c.id === 'string' && c.image instanceof Blob).sort((a, b) => a.createdAt - b.createdAt)
  }

  async put(c: StoredCharacter): Promise<void> {
    await reqToPromise(this.tx('readwrite').put(c))
  }

  async remove(id: string): Promise<void> {
    await reqToPromise(this.tx('readwrite').delete(id))
  }

  async clear(): Promise<void> {
    await reqToPromise(this.tx('readwrite').clear())
  }
}

export class MemoryAvatarStore implements AvatarStore {
  readonly persistent = false
  private readonly items = new Map<string, StoredCharacter>()
  async list() {
    return [...this.items.values()].sort((a, b) => a.createdAt - b.createdAt)
  }
  async put(c: StoredCharacter) {
    this.items.set(c.id, c)
  }
  async remove(id: string) {
    this.items.delete(id)
  }
  async clear() {
    this.items.clear()
  }
}

export async function openAvatarStore(): Promise<AvatarStore> {
  try {
    if (!globalThis.indexedDB) return new MemoryAvatarStore()
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('blocked'))
    })
    return new IdbAvatarStore(db)
  } catch {
    return new MemoryAvatarStore()
  }
}
