import { SCENE_NAMES } from '../../game/sceneArt'
import { LEVELS } from '../../levels/levels'
import type { SceneId } from '../../levels/types'
import { isLevelUnlocked } from '../../save/schema'
import type { App } from '../app'
import { h, starsText } from '../dom'

const SCENE_DESC: Record<SceneId, string> = {
  desk: '第 1～6 关 · 距离、桶高、墙壁、桌面',
  pantry: '第 7～13 关 · 风力、平台、窄路',
  meeting: '第 14～20 关 · 移动桶、转椅嘉宾',
}

export function renderLevels(app: App): HTMLElement {
  const data = app.save.data
  const next = app.nextPlayableLevel()
  const groups: SceneId[] = ['desk', 'pantry', 'meeting']
  const totalStars = Object.values(data.levels).reduce((s, r) => s + r.stars, 0)
  return h(
    'div.screen-inner',
    h(
      'div.topbar',
      h('button.btn.icon', { type: 'button', 'aria-label': '返回首页', onclick: () => app.go('home') }, '←'),
      h('h1', { tabindex: '-1' }, '选择关卡'),
      h('span.muted', `★ ${totalStars}/60`),
    ),
    ...groups.map((scene) =>
      h(
        'section.level-group',
        { 'aria-label': SCENE_NAMES[scene] },
        h('h2', SCENE_NAMES[scene], h('small', SCENE_DESC[scene])),
        h(
          'div.level-grid',
          ...LEVELS.filter((l) => l.scene === scene).map((l) => {
            const unlocked = isLevelUnlocked(data, l.id)
            const stars = data.levels[String(l.id)]?.stars ?? 0
            const cls = `level-tile${unlocked ? '' : ' locked'}${l.id === next ? ' current' : ''}`
            return h(
              'button',
              {
                type: 'button',
                class: cls,
                'aria-disabled': unlocked ? 'false' : 'true',
                'aria-label': unlocked ? `第 ${l.id} 关 ${l.name}，${stars ? `最高 ${stars} 星` : '未通过'}` : `第 ${l.id} 关，未解锁，先通过第 ${l.id - 1} 关`,
                onclick: () => {
                  if (!unlocked) return
                  app.sfx.play('ui')
                  const cfg = app.levelConfig(l.id)
                  if (cfg) app.startRound(cfg)
                },
              },
              h('span.num', unlocked ? String(l.id) : '🔒'),
              h('span.name', unlocked ? l.name : '未解锁'),
              unlocked ? starsText(stars) : null,
            )
          }),
        ),
      ),
    ),
  )
}
