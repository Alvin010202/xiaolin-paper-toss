/** 极简 DOM 构建工具：h('button.btn.primary', { onclick }, '文字') */
type Child = Node | string | number | null | undefined | false
type Attrs = Record<string, unknown>

export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}` | `${K}#${string}`, attrs?: Attrs | Child, ...children: Child[]): HTMLElementTagNameMap[K] {
  const [base, ...rest] = tag.split(/(?=[.#])/)
  const el = document.createElement(base) as HTMLElementTagNameMap[K]
  for (const part of rest) {
    if (part.startsWith('.')) el.classList.add(part.slice(1))
    else if (part.startsWith('#')) el.id = part.slice(1)
  }
  let kids = children
  if (attrs !== undefined && (attrs === null || typeof attrs !== 'object' || attrs instanceof Node)) {
    kids = [attrs as Child, ...children]
  } else if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2), v as EventListener)
      } else if (k === 'class') {
        el.className = String(v)
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v)
      } else if (k in el && typeof v !== 'string') {
        ;(el as unknown as Record<string, unknown>)[k] = v
      } else {
        el.setAttribute(k, v === true ? '' : String(v))
      }
    }
  }
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue
    el.append(c instanceof Node ? c : String(c))
  }
  return el
}

export function starsText(stars: number, max = 3): HTMLElement {
  const span = h('span.stars', { 'aria-label': `${stars} 星` })
  for (let i = 0; i < max; i++) span.append(h('span', { class: i < stars ? 'on' : 'off', 'aria-hidden': 'true' }, '★'))
  return span
}

/** 弹窗：自动聚焦第一个按钮，Esc 触发 onEscape，Tab 键循环在弹窗内 */
export function openDialog(opts: {
  title: string
  content: Child[]
  labelledBy?: string
  onEscape?: () => void
  className?: string
}): { el: HTMLElement; close: () => void } {
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`
  const dialog = h('div', { class: `dialog ${opts.className ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('h2', { id: titleId }, opts.title),
    ...opts.content,
  )
  const overlay = h('div.overlay', dialog)
  const prevFocus = document.activeElement as HTMLElement | null
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && opts.onEscape) {
      e.preventDefault()
      opts.onEscape()
    } else if (e.key === 'Tab') {
      const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"], a[href]')]
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
  overlay.addEventListener('keydown', onKey)
  document.body.append(overlay)
  requestAnimationFrame(() => (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('button'))?.focus())
  return {
    el: dialog,
    close: () => {
      overlay.remove()
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus()
    },
  }
}

export function toast(message: string, ms = 2600): void {
  const box = document.getElementById('toast')
  if (!box) return
  const item = h('div.toast-item', message)
  box.append(item)
  setTimeout(() => item.remove(), ms)
}
