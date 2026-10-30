import { ACCENT_CHOICES } from '../../characters/characters.config'
import { decodeImage, ImageImportError, renderCrop, validateImageFile } from '../../characters/imageProcess'
import type { RosterCharacter } from '../../characters/types'
import { DEFAULT_PITCHER } from '../../save/schema'
import type { App } from '../app'
import { Cropper } from '../cropper'
import { h, openDialog, toast } from '../dom'

const MAX_NICK = 12
const MAX_CUSTOM = 30

export function renderAvatars(app: App): HTMLElement {
  const list = h('ul.char-list', { 'aria-label': '人物列表' })
  const fill = () => {
    list.replaceChildren(...app.roster.characters.map((c) => charItem(app, c, fill)))
  }
  fill()
  const customCount = app.roster.characters.filter((c) => c.source === 'custom').length
  return h(
    'div.screen-inner',
    h(
      'div.topbar',
      h('button.btn.icon', { type: 'button', 'aria-label': '返回首页', onclick: () => app.go('home') }, '←'),
      h('h1', { tabindex: '-1' }, '朋友头像'),
    ),
    h('p.muted', { style: { margin: '0' } }, '选一位当投手，其他人会当观众、坐转椅挡路、轮流主持每日挑战。'),
    !app.roster.persistent ? h('p.notice', '当前浏览器无法长期保存图片，导入的朋友刷新后会消失。') : null,
    h(
      'button.btn.primary',
      {
        type: 'button',
        disabled: customCount >= MAX_CUSTOM,
        onclick: () => openEditor(app, null, fill),
      },
      '＋ 导入新朋友',
    ),
    list,
    h('p.footnote', '导入的照片只在本机浏览器里裁剪、缩小和保存，不会上传到任何服务器。'),
  )
}

function charItem(app: App, c: RosterCharacter, refresh: () => void): HTMLElement {
  const selected = app.roster.pitcher(app.save.data.pitcherId).id === c.id
  return h(
    'li',
    { class: `char-item${selected ? ' selected' : ''}` },
    h('img.avatar.lg', { src: app.roster.avatarUrl(c.id), alt: '', style: { borderColor: c.accentColor } }),
    h(
      'div.info',
      h('div.nick', c.nickname),
      h('div', selected ? h('span.tag.me', '当前投手') : null, ' ', h('span.tag', c.source === 'preset' ? (c.id === DEFAULT_PITCHER ? '主角' : '预置') : '我导入的')),
    ),
    h(
      'div.char-actions',
      selected
        ? null
        : h(
            'button.btn.small.secondary',
            {
              type: 'button',
              'aria-label': `选 ${c.nickname} 当投手`,
              onclick: () => {
                app.save.data.pitcherId = c.id
                app.save.save()
                app.sfx.play('ui')
                toast(`${c.nickname} 上场投球！`)
                refresh()
              },
            },
            '当投手',
          ),
      c.source === 'custom'
        ? h('button.btn.small', { type: 'button', 'aria-label': `编辑 ${c.nickname}`, onclick: () => openEditor(app, c, refresh) }, '编辑')
        : null,
      c.source === 'custom'
        ? h('button.btn.small.danger', { type: 'button', 'aria-label': `删除 ${c.nickname}`, onclick: () => confirmDelete(app, c, refresh) }, '删除')
        : null,
    ),
  )
}

function confirmDelete(app: App, c: RosterCharacter, refresh: () => void): void {
  const dlg = openDialog({
    title: `删除 ${c.nickname}？`,
    onEscape: () => dlg.close(),
    content: [
      h('p', '会从这台设备上删除这位朋友的头像和昵称。'),
      h(
        'div.row',
        h('button.btn', { type: 'button', 'data-autofocus': '', onclick: () => dlg.close() }, '取消'),
        h(
          'button.btn.danger',
          {
            type: 'button',
            onclick: async () => {
              try {
                await app.avatarStore.remove(c.id)
              } catch {
                toast('删除失败，请稍后再试')
                return
              }
              if (app.save.data.pitcherId === c.id) {
                app.save.data.pitcherId = DEFAULT_PITCHER
                app.save.save()
              }
              await app.roster.load()
              dlg.close()
              toast('已删除')
              refresh()
            },
          },
          '删除',
        ),
      ),
    ],
  })
}

function openEditor(app: App, existing: RosterCharacter | null, refresh: () => void): void {
  const cropper = new Cropper()
  const err = h('p.error', { role: 'alert' })
  err.hidden = true
  const showErr = (msg: string) => {
    err.textContent = msg
    err.hidden = false
  }
  let color = existing?.accentColor ?? ACCENT_CHOICES[0]
  const nick = h('input.input', {
    type: 'text',
    id: 'nick-input',
    maxlength: String(MAX_NICK),
    value: existing?.nickname ?? '',
    placeholder: '例如：隔壁小王',
    autocomplete: 'off',
  }) as HTMLInputElement
  const file = h('input.visually-hidden', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'avatar-file' }) as HTMLInputElement
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    file.value = ''
    if (!f) return
    err.hidden = true
    try {
      await validateImageFile(f)
      cropper.setImage(await decodeImage(f))
    } catch (e) {
      showErr(e instanceof ImageImportError ? e.message : '图片无法读取，请换一张。')
    }
  })
  // 编辑时先显示原头像：不换图直接保存即保留原头像，也可以重新缩放平移
  if (existing) {
    const img = new Image()
    img.src = app.roster.avatarUrl(existing.id)
    img.decode().then(() => cropper.setImage(img)).catch(() => undefined)
  }
  const swatches = h(
    'div.swatches',
    { role: 'group', 'aria-label': '主题色' },
    ...ACCENT_CHOICES.map((c) => {
      const b = h('button.swatch', {
        type: 'button',
        'aria-label': `颜色 ${c}`,
        'aria-pressed': String(c === color),
        style: { background: c },
        onclick: () => {
          color = c
          swatches.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s === b)))
        },
      })
      return b
    }),
  )

  const saveBtn = h('button.btn.primary', { type: 'button' }, '保存')
  saveBtn.addEventListener('click', async () => {
    err.hidden = true
    const name = nick.value.trim()
    if (!name) return showErr('请填写昵称。')
    if (!cropper.hasImage) return showErr('请先选择一张照片。')
    saveBtn.disabled = true
    try {
      const blob = await renderCrop(cropper.image!, cropper.rect())
      const now = Date.now()
      const id = existing?.id ?? `custom-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const prev = existing ? (await app.avatarStore.list()).find((x) => x.id === id) : undefined
      await app.avatarStore.put({ id, nickname: name.slice(0, MAX_NICK), accentColor: color, image: blob, createdAt: prev?.createdAt ?? now, updatedAt: now })
      await app.roster.load()
      dlg.close()
      toast(existing ? '已保存修改' : `欢迎 ${name} 加入！`)
      refresh()
    } catch {
      showErr('保存失败：浏览器存储可能已满或不可用。')
    } finally {
      saveBtn.disabled = false
    }
  })

  const dlg = openDialog({
    title: existing ? `编辑 ${existing.nickname}` : '导入新朋友',
    onEscape: () => dlg.close(),
    content: [
      cropper.el,
      h('div.field', h('span.label', '缩放'), cropper.zoomInput),
      h(
        'div.row',
        h('label.btn.small', { for: 'avatar-file', tabindex: '0', role: 'button', onkeydown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), file.click()) }, existing ? '更换照片' : '选择照片'),
        file,
      ),
      h('p.muted', { style: { textAlign: 'left' } }, '支持 JPEG、PNG、WebP，8 MB 以内。拖动照片调整位置，圆圈内就是头像。'),
      h('div.field', h('label', { for: 'nick-input' }, `昵称（最多 ${MAX_NICK} 个字）`), nick),
      h('div.field', h('span.label', '衣服颜色'), swatches),
      err,
      h('div.row', h('button.btn', { type: 'button', onclick: () => dlg.close() }, '取消'), saveBtn),
    ],
  })
}
