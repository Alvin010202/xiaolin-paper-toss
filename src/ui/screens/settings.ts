import type { App } from '../app'
import { h, openDialog, toast } from '../dom'

export function renderSettings(app: App): HTMLElement {
  const s = app.save.data.settings
  const toggle = (label: string, desc: string, get: () => boolean, set: (v: boolean) => void) => {
    const id = `set-${label}`
    const sw = h('button.switch', {
      type: 'button',
      role: 'switch',
      'aria-checked': String(get()),
      'aria-labelledby': id,
      onclick: () => {
        set(!get())
        sw.setAttribute('aria-checked', String(get()))
        app.save.save()
        app.sfx.play('ui')
      },
    })
    return h('div.setting', h('div', h('div', { id, style: { fontWeight: '700' } }, label), h('div.muted', desc)), sw)
  }

  const resetBtn = h('button.btn.danger', { type: 'button', onclick: () => confirmReset(app) }, '重置存档…')

  return h(
    'div.screen-inner',
    h(
      'div.topbar',
      h('button.btn.icon', { type: 'button', 'aria-label': '返回首页', onclick: () => app.go('home') }, '←'),
      h('h1', { tabindex: '-1' }, '设置'),
    ),
    h(
      'section.card',
      toggle('声音', '投掷、碰撞、进球和欢呼音效', () => !s.muted, (v) => {
        s.muted = !v
        app.sfx.setMuted(s.muted)
      }),
      toggle('减少动画', '关闭纸屑、震屏、跳跃等动态效果，规则和操作不变', () => s.reducedMotion, (v) => {
        s.reducedMotion = v
        app.applyMotionClass()
      }),
    ),
    h(
      'section.card',
      h('h2', '操作说明'),
      h(
        'ul.rules',
        h('li', '在纸团周围的虚线圈里按住，往投出方向的反方向拉。'),
        h('li', '拉得越长力度越大，圆圈颜色从绿到红表示力度；虚线点是纸团刚飞出时的轨迹。'),
        h('li', '松手发射。拉得太短松手不会发射，可以重新瞄准。'),
        h('li', '纸团要从桶口上方落进桶里并停住才算进球，擦到桶边不算。'),
        h('li', '风力区域有蓝色箭头；转椅上的朋友和移动的垃圾桶按固定路线运动。'),
        h('li', '电脑上用鼠标拖动；按 Esc 或 P 暂停。'),
      ),
    ),
    h(
      'section.card',
      h('h2', '存档'),
      h('p.muted', { style: { margin: '0 0 12px' } }, app.save.storage === 'ok' ? '进度保存在本机浏览器中。' : '当前浏览器不允许本地存储，进度只在本次打开期间有效。'),
      resetBtn,
    ),
  )
}

function confirmReset(app: App): void {
  const alsoAvatars = h('input', { type: 'checkbox', id: 'reset-avatars' }) as HTMLInputElement
  const dlg = openDialog({
    title: '重置存档？',
    onEscape: () => dlg.close(),
    content: [
      h('p', { style: { textAlign: 'left' } }, '将从这台设备的浏览器中删除：'),
      h('ul', h('li', '所有关卡的通关记录和星级（关卡重新锁定）'), h('li', '每日挑战的本机最高分和挑战次数'), h('li', '声音、减少动画等设置'), h('li', '所选的投手（回到小林）')),
      h(
        'label',
        { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        alsoAvatars,
        h('span', '同时删除我导入的朋友头像和昵称'),
      ),
      h('p.muted', '预置人物不受影响。此操作无法撤销。'),
      h(
        'div.row',
        h('button.btn', { type: 'button', 'data-autofocus': '', onclick: () => dlg.close() }, '取消'),
        h(
          'button.btn.danger',
          {
            type: 'button',
            onclick: async () => {
              const prefers = matchMedia('(prefers-reduced-motion: reduce)').matches
              app.save.reset(prefers)
              app.sfx.setMuted(false)
              app.applyMotionClass()
              if (alsoAvatars.checked) {
                try {
                  await app.avatarStore.clear()
                } catch {
                  /* 忽略：存储不可用时没有可删除的内容 */
                }
                await app.roster.load()
              }
              dlg.close()
              toast(alsoAvatars.checked ? '存档和导入的头像已删除' : '存档已重置')
              app.go('settings')
            },
          },
          '确认删除',
        ),
      ),
    ],
  })
}
