import type { App } from '../app'
import { h } from '../dom'

export function renderHome(app: App): HTMLElement {
  const pitcher = app.roster.pitcher(app.save.data.pitcherId)
  const cleared = Object.keys(app.save.data.levels).length
  const notice = app.save.notice
  const ui = () => app.sfx.play('ui')
  return h(
    'div.screen-inner',
    h(
      'header.home-hero',
      h('h1.home-title', { tabindex: '-1' }, '小林', h('em', '这球'), '必须进'),
      h('p.muted', { style: { margin: '0' } }, '办公室纸团投篮 · 拖动瞄准，松手出手'),
      h(
        'div.home-art',
        { 'aria-hidden': 'true' },
        h('img.full', { src: 'avatars/xiaolin-full.png', alt: '' }),
        h('div.ball'),
        h('div.bin'),
      ),
      h(
        'div.pitcher-chip',
        h('img.avatar', { src: app.roster.avatarUrl(pitcher.id), alt: '' }),
        h('span', '当前投手：', h('b', pitcher.nickname)),
      ),
    ),
    notice ? h('p.notice', { role: 'status' }, notice) : null,
    h(
      'nav.stack.home-menu',
      { 'aria-label': '主菜单' },
      h(
        'button.btn.primary',
        { type: 'button', onclick: () => (ui(), app.go('levels')) },
        cleared ? `继续闯关（已过 ${cleared}/20 关）` : '开始闯关',
      ),
      h('button.btn.secondary', { type: 'button', onclick: () => (ui(), app.go('daily')) }, '每日挑战'),
      h('button.btn', { type: 'button', onclick: () => (ui(), app.go('avatars')) }, '朋友头像'),
      h('button.btn', { type: 'button', onclick: () => (ui(), app.go('settings')) }, '设置'),
    ),
    h('p.footnote', '进度和头像只保存在你的浏览器里，不会上传。'),
  )
}
