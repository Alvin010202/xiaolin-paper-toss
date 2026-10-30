import type { Sfx } from '../audio/sfx'
import type { AvatarStore } from '../characters/avatarStore'
import type { CharacterRoster } from '../characters/roster'
import { dailyChallengeFor, shanghaiDate, type DailyChallenge } from '../daily/daily'
import { GameHost } from '../game/gameHost'
import type { RoundConfig } from '../game/types'
import { getLevel, LEVELS } from '../levels/levels'
import type { SaveManager } from '../save/saveManager'
import { h } from './dom'
import { renderAvatars } from './screens/avatars'
import { renderDaily } from './screens/daily'
import { renderHome } from './screens/home'
import { renderLevels } from './screens/levels'
import { PlayScreen } from './screens/play'
import { renderSettings } from './screens/settings'

export type Route = 'home' | 'levels' | 'daily' | 'avatars' | 'settings' | 'play'

/** 界面层的总控：持有各项服务，负责页面切换 */
export class App {
  readonly root: HTMLElement
  readonly host: GameHost
  readonly play: PlayScreen
  private readonly screenEl: HTMLElement
  route: Route = 'home'

  constructor(
    root: HTMLElement,
    readonly save: SaveManager,
    readonly roster: CharacterRoster,
    readonly avatarStore: AvatarStore,
    readonly sfx: Sfx,
  ) {
    this.root = root
    this.screenEl = h('main.screen', { id: 'screen' })
    this.play = new PlayScreen(this)
    root.append(this.screenEl, this.play.el)
    this.host = new GameHost(this.play.stage, {
      roster,
      sfx,
      settings: () => this.save.data.settings,
    })
    this.applyMotionClass()
  }

  applyMotionClass(): void {
    document.documentElement.classList.toggle('reduce-motion', this.save.data.settings.reducedMotion)
  }

  /** 切换到普通页面（非游戏画面） */
  go(route: Exclude<Route, 'play'>): void {
    if (this.route === 'play') this.play.leave()
    this.route = route
    this.screenEl.hidden = false
    document.body.classList.remove('playing')
    this.screenEl.replaceChildren()
    const render = { home: renderHome, levels: renderLevels, daily: renderDaily, avatars: renderAvatars, settings: renderSettings }[route]
    this.screenEl.append(render(this))
    window.scrollTo(0, 0)
    this.screenEl.querySelector<HTMLElement>('h1')?.focus()
  }

  /** 当前最高可玩的关卡 */
  nextPlayableLevel(): number {
    for (const l of LEVELS) if (!this.save.data.levels[String(l.id)]) return l.id
    return LEVELS[LEVELS.length - 1].id
  }

  todayChallenge(): DailyChallenge {
    return dailyChallengeFor(shanghaiDate(), this.roster.characters.length)
  }

  /** 组装闯关模式的一局 */
  levelConfig(levelId: number): RoundConfig | null {
    const level = getLevel(levelId)
    if (!level) return null
    const pitcherId = this.roster.pitcher(this.save.data.pitcherId).id
    const audience = this.roster.audience(pitcherId, 3, levelId)
    const guests = this.roster.audience(pitcherId, 3, levelId + 1)
    return {
      mode: 'campaign',
      layout: level,
      levelId: level.id,
      title: `第 ${level.id} 关 · ${level.name}`,
      target: level.target,
      hint: level.hint,
      newMechanic: level.newMechanic,
      pitcherId,
      audienceIds: audience.map((c) => c.id),
      guestIds: guests.map((c) => c.id),
      showTutorial: !this.save.data.tutorialDone && level.id === 1,
    }
  }

  /** 组装每日挑战的一局 */
  dailyConfig(ch: DailyChallenge): RoundConfig {
    const pitcherId = this.roster.pitcher(this.save.data.pitcherId).id
    const host = this.roster.characters[ch.hostIndex] ?? this.roster.pitcher(pitcherId)
    // 主持人站在观众第一位；若主持人就是投手，则观众里复用其他朋友
    const others = this.roster.audience(pitcherId, 3, ch.hostIndex)
    const audience = host.id === pitcherId ? others : [host, ...others.filter((c) => c.id !== host.id)].slice(0, 3)
    while (audience.length < 3) audience.push(others[audience.length % others.length])
    return {
      mode: 'daily',
      layout: ch.template,
      levelId: 0,
      title: `每日挑战 · ${ch.template.name}`,
      target: 0,
      hint: '10 球定胜负：连续命中有额外加成，没进会清零连击。',
      pitcherId,
      audienceIds: audience.map((c) => c.id),
      guestIds: others.map((c) => c.id),
      hostId: host.id,
      showTutorial: false,
    }
  }

  startRound(cfg: RoundConfig, daily?: DailyChallenge): void {
    this.route = 'play'
    this.screenEl.hidden = true
    document.body.classList.add('playing')
    this.play.enter(cfg, daily)
  }
}
