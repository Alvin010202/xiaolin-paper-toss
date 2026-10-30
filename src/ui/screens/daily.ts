import { RULES } from '../../config/gameConfig'
import type { App } from '../app'
import { h } from '../dom'

export function renderDaily(app: App): HTMLElement {
  const ch = app.todayChallenge()
  const host = app.roster.characters[ch.hostIndex] ?? app.roster.pitcher(app.save.data.pitcherId)
  const rec = app.save.data.daily[ch.date]
  return h(
    'div.screen-inner',
    h(
      'div.topbar',
      h('button.btn.icon', { type: 'button', 'aria-label': '返回首页', onclick: () => app.go('home') }, '←'),
      h('h1', { tabindex: '-1' }, '每日挑战'),
    ),
    h(
      'section.card',
      h(
        'div.daily-head',
        h('img.avatar.lg', { src: app.roster.avatarUrl(host.id), alt: '', style: { borderColor: host.accentColor } }),
        h('div', h('div.muted', '今日主持'), h('div', { style: { fontSize: '20px', fontWeight: '800' } }, host.nickname)),
      ),
      h(
        'dl.kv',
        h('dt', '挑战日期'),
        h('dd', `${ch.date}（${ch.timeZone} 时区）`),
        h('dt', '今日场地'),
        h('dd', ch.template.name),
        h('dt', '本机最高分'),
        h('dd', rec ? `${rec.best} 分（已挑战 ${rec.plays} 次）` : '还没有挑战'),
      ),
    ),
    h(
      'section.card',
      h('h2', '规则'),
      h(
        'ul.rules',
        h('li', `每轮 ${RULES.dailyThrows} 次投掷，同一天所有人的场地、物理参数和规则都一样。`),
        h('li', `每进一球 ${RULES.dailyBaseScore} 分。`),
        h('li', `连续命中从第 2 球起加成：+25、+50、+75，之后每球封顶 +${RULES.dailyStreakMax}。`),
        h('li', '没进会把连续命中清零。'),
        h('li', '当天可以重复挑战，只保存本机最高分。'),
        h('li', '按北京时间（Asia/Shanghai）零点换新挑战。'),
      ),
      h('p.muted', { style: { margin: '10px 0 0' } }, '成绩只保存在本机，没有全球或好友排行榜。不同浏览器、设备的物理计算可能有极细微差别。'),
    ),
    h(
      'button.btn.primary',
      {
        type: 'button',
        onclick: () => {
          app.sfx.play('ui')
          app.startRound(app.dailyConfig(ch), ch)
        },
      },
      rec ? '再挑战一次' : '开始挑战',
    ),
    h('p.footnote', `规则版本 ${ch.ruleVersion} · 场地模板 ${ch.template.id} · 种子 ${ch.seed}`),
  )
}
