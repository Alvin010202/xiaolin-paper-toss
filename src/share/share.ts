/**
 * 分享：优先使用系统分享（手机浏览器的分享面板）；不支持时由界面提供“下载图片”和“复制链接”。
 * 用户取消分享时返回 'cancelled'，界面不提示错误。
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'error'

export const CARD_FILE_NAME = 'xiaolin-score.png'

export function canShareFiles(blob: Blob): boolean {
  try {
    const file = new File([blob], CARD_FILE_NAME, { type: 'image/png' })
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export async function systemShare(blob: Blob, title: string, text: string, url: string | null): Promise<ShareOutcome> {
  if (!canShareFiles(blob)) return 'unsupported'
  const file = new File([blob], CARD_FILE_NAME, { type: 'image/png' })
  try {
    await navigator.share({ files: [file], title, text: url ? `${text} ${url}` : text })
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    return 'error'
  }
}

export function downloadBlob(blob: Blob, fileName = CARD_FILE_NAME): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 退回旧方法 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
