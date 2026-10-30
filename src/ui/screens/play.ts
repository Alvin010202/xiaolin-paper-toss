import { GAME_TITLE, WORLD } from '../../config/gameConfig'
import { publicGameUrl } from '../../config/site'
import { randomLine } from '../../characters/roster'
import { DEFAULT_CHEER_LINES } from '../../characters/characters.config'
import type { DailyChallenge } from '../../daily/daily'
import type { HudState, RoundConfig } from '../../game/types'
import { getLevel, LEVELS } from '../../levels/levels'
import type { RoundSummary } from '../../rules/round'
import { recordDaily, recordLevelStars } from '../../save/schema'
import { canvasToPng, drawScoreCard } from '../../share/scoreCard'
import { canShareFiles, copyText, downloadBlob, systemShare } from '../../share/share'
import type { App } from '../app'
import { h, openDialog, starsText, toast } from '../dom'

/** 游戏画面：Phaser 画布 + DOM 的 HUD、提示、暂停、结算与分享 */
export class PlayScreen {
  readonly el: HTMLElement
  readonly stage: HTMLElement
  private readonly frame: HTMLElement
  private readonly hudTitle: HTMLElement
  private readonly hudLeft: HTMLElement
  private readonly hudBalls: HTMLElement
  private readonly hint: HTMLElement
  private readonly landscapeTip: HTMLElement
  private cfg: RoundConfig | null = null
  private daily: DailyChallenge | undefined
  private dialog: { close: () => void } | null = null
  private hintTimer = 0
  private ended = false
  private active = false

  constructor(private readonly app: App) {
    this.stage = h('div#stage', { 'aria-label': '游戏画面：在纸团周围按住并往后拉，松手投出' })
    this.hudTitle = h('div.hud-title')
    this.hudLeft = h('span')
    this.hudBalls = h('span.balls', { 'aria-hidden': 'true' })
    const pauseBtn = h('button.btn.icon.pause-btn', { type: 'button', 'aria-label': '暂停', onclick: () => this.pause() }, '⏸')
    this.hint = h('div.hint-strip', { role: 'note' })
    this.landscapeTip = h('div.landscape-tip', '竖屏玩更舒服')
    this.frame = h(
      'div#frame',
      this.stage,
      h('div.hud', pauseBtn, h('div.hud-main', { 'aria-live': 'polite' }, this.hudTitle, h('div.hud-sub', this.hudLeft, this.hudBalls))),
      this.hint,
      this.landscapeTip,
    )
    this.el = h('section#play', { 'aria-label': '游戏中' }, this.frame)
    this.el.hidden = true

    window.addEventListener('resize', () => this.layout())
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 200))
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.active && !this.ended && !this.dialog) this.pause()
    })
    window.addEventListener('keydown', (e) => {
      if (!this.active) return
      if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !this.dialog && !this.ended) {
        e.preventDefault()
        this.pause()
      }
    })
    // 游戏区域内阻止页面滚动和双击缩放
    this.stage.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
  }

  /** 按 9:16 计算画面大小，居中显示完整游戏区域 */
  private layout(): void {
    if (this.el.hidden) return
    const cs = getComputedStyle(this.el)
    const w = this.el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const hgt = this.el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    const ratio = WORLD.width / WORLD.height
    let fw = w
    let fh = w / ratio
    if (fh > hgt) {
      fh = hgt
      fw = hgt * ratio
    }
    this.frame.style.width = `${Math.floor(fw)}px`
    this.frame.style.height = `${Math.floor(fh)}px`
    this.frame.style.setProperty('--u', `${fw / WORLD.width}px`)
    const landscape = window.innerWidth > window.innerHeight && matchMedia('(pointer: coarse)').matches
    this.landscapeTip.hidden = !landscape
    this.app.host.resize()
  }

  enter(cfg: RoundConfig, daily?: DailyChallenge): void {
    this.cfg = cfg
    this.daily = daily
    this.active = true
    this.el.hidden = false
    this.layout()
    this.closeDialog()
    this.startRound()
  }

  leave(): void {
    this.active = false
    this.closeDialog()
    this.app.host.stop()
    this.el.hidden = true
    clearTimeout(this.hintTimer)
  }

  private startRound(): void {
    const cfg = this.cfg!
    this.ended = false
    this.hudTitle.textContent = cfg.mode === 'daily' && this.daily ? `每日挑战 ${this.daily.date}` : cfg.title
    this.showHint(cfg)
    void this.app.host.start(cfg, {
      onHud: (s) => this.renderHud(s),
      onThrow: () => undefined,
      onRoundEnd: (s) => this.onRoundEnd(s),
      onFirstLaunch: () => {
        if (!this.app.save.data.tutorialDone) {
          this.app.save.data.tutorialDone = true
          this.app.save.save()
        }
        this.fadeHint(600)
      },
    })
  }

  private showHint(cfg: RoundConfig): void {
    clearTimeout(this.hintTimer)
    this.hint.classList.remove('fade')
    this.hint.hidden = false
    const parts: (Node | string)[] = []
    if (cfg.mode === 'daily' && this.daily) {
      const host = cfg.hostId ? this.app.roster.get(cfg.hostId) : undefined
      parts.push(h('span.new', `${this.daily.date}（${this.daily.timeZone}）`))
      if (host) parts.push(` · 今日主持 ${host.nickname}：“今天我来主持，10 球定胜负！”`)
      parts.push(h('br'), cfg.hint)
    } else {
      const level = getLevel(cfg.levelId)
      parts.push(h('b', `目标：5 次内进 ${cfg.target} 球`), level ? ` · ${level.difficulty}` : '', h('br'))
      if (cfg.newMechanic) parts.push(h('span.new', `新机制：${cfg.newMechanic}`), h('br'))
      parts.push(cfg.hint)
    }
    this.hint.replaceChildren(...parts)
    this.fadeHint(cfg.showTutorial ? 9000 : 5200)
  }

  private fadeHint(ms: number): void {
    clearTimeout(this.hintTimer)
    this.hintTimer = window.setTimeout(() => this.hint.classList.add('fade'), ms)
  }

  private renderHud(s: HudState): void {
    if (s.mode === 'campaign') {
      this.hudLeft.replaceChildren('进球 ', h('b', `${s.hits}/${s.target}`), `　剩 ${s.throwsLeft} 次`)
    } else {
      this.hudLeft.replaceChildren(h('b', `${s.score} 分`), s.streak >= 2 ? `　连中 ×${s.streak}` : '', `　剩 ${s.throwsLeft} 球`)
    }
    const balls: HTMLElement[] = []
    for (let i = 0; i < s.totalThrows; i++) balls.push(h('i', { class: i < s.totalThrows - s.throwsLeft ? 'used' : '' }))
    this.hudBalls.replaceChildren(...balls)
  }

  private closeDialog(): void {
    this.dialog?.close()
    this.dialog = null
  }

  pause(): void {
    if (!this.active || this.ended || this.dialog) return
    this.app.host.pause()
    this.app.sfx.play('ui')
    const backLabel = this.cfg?.mode === 'daily' ? '返回每日挑战' : '返回关卡选择'
    const dlg = openDialog({
      title: '暂停中',
      onEscape: () => this.resume(),
      content: [
        h('p.muted', this.cfg?.title ?? ''),
        h('button.btn.primary', { type: 'button', 'data-autofocus': '', onclick: () => this.resume() }, '继续'),
        h('button.btn', { type: 'button', onclick: () => this.restart() }, '重来'),
        h('button.btn', { type: 'button', onclick: () => this.back() }, backLabel),
      ],
    })
    this.dialog = dlg
  }

  private resume(): void {
    this.closeDialog()
    this.app.host.resume()
  }

  private restart(): void {
    this.closeDialog()
    this.app.sfx.play('ui')
    this.startRound()
  }

  private back(): void {
    this.closeDialog()
    this.app.go(this.cfg?.mode === 'daily' ? 'daily' : 'levels')
  }

  private onRoundEnd(s: RoundSummary): void {
    if (!this.active) return
    this.ended = true
    this.fadeHint(0)
    const cfg = this.cfg!
    const save = this.app.save
    let isBest = false
    if (cfg.mode === 'campaign') {
      const prev = save.data.levels[String(cfg.levelId)]?.stars ?? 0
      isBest = recordLevelStars(save.data, cfg.levelId, s.stars) && prev > 0
    } else if (this.daily) {
      const hadRecord = !!save.data.daily[this.daily.date]
      isBest = recordDaily(
        save.data,
        { date: this.daily.date, templateId: this.daily.template.id, seed: this.daily.seed, ruleVersion: this.daily.ruleVersion },
        s.score,
      ) && hadRecord
    }
    save.save()
    if (save.writeFailed) toast('进度保存失败，本次游玩不受影响')
    this.showResult(s, isBest)
  }

  private showResult(s: RoundSummary, isBest: boolean): void {
    const cfg = this.cfg!
    const content: (Node | string)[] = []
    let title: string
    if (cfg.mode === 'campaign') {
      title = s.cleared ? '过关！' : '差一点…'
      const best = this.app.save.data.levels[String(cfg.levelId)]?.stars ?? 0
      const big = h('p.big', { 'aria-label': `${s.stars} 星` })
      big.append(starsText(s.stars))
      content.push(big)
      content.push(h('p', `进球 ${s.hits}/${cfg.target} · 用了 ${s.throwsUsed} 次，剩余 ${s.remaining} 次`))
      if (s.cleared) content.push(h('p.muted', isBest ? '刷新了这一关的最高星级！' : `这一关最高：${'★'.repeat(best)}${'☆'.repeat(3 - best)}`))
      else content.push(h('p.muted', `需要在 5 次内进 ${cfg.target} 球。调整一下力度再试试！`))
    } else {
      title = '挑战完成'
      content.push(h('p.big.score', `${s.score} 分`))
      content.push(h('p', `进球 ${s.hits}/10 · 最长连中 ${s.bestStreak}`))
      const best = this.daily ? this.app.save.data.daily[this.daily.date]?.best ?? s.score : s.score
      content.push(h('p.muted', isBest ? '新的本机最高分！' : `今日本机最高：${best} 分`))
    }

    const buttons: HTMLElement[] = []
    const nextLevel = cfg.mode === 'campaign' && s.cleared ? LEVELS.find((l) => l.id === cfg.levelId + 1) : undefined
    if (nextLevel) {
      buttons.push(
        h('button.btn.primary', {
          type: 'button',
          'data-autofocus': '',
          onclick: () => {
            const next = this.app.levelConfig(nextLevel.id)
            this.closeDialog()
            if (next) this.enter(next)
          },
        }, `下一关：${nextLevel.name}`),
      )
    }
    buttons.push(
      h('button', { type: 'button', class: nextLevel ? 'btn' : 'btn primary', 'data-autofocus': nextLevel ? undefined : '', onclick: () => this.restart() }, cfg.mode === 'daily' ? '再挑战一次' : '重试'),
    )
    buttons.push(h('button.btn.secondary', { type: 'button', onclick: () => this.openShare(s) }, '分享成绩'))
    buttons.push(h('button.btn', { type: 'button', onclick: () => this.back() }, cfg.mode === 'daily' ? '返回' : '返回关卡选择'))
    if (cfg.mode === 'campaign' && s.cleared && cfg.levelId === LEVELS[LEVELS.length - 1].id) {
      content.push(h('p', '🎉 20 关全部通过！去每日挑战继续练手吧。'))
    }
    this.dialog = openDialog({ title, content: [...content, ...buttons], className: 'result' })
  }

  private async openShare(s: RoundSummary): Promise<void> {
    const cfg = this.cfg!
    const pitcher = this.app.roster.pitcher(cfg.pitcherId)
    const url = publicGameUrl()
    const card = drawScoreCard({
      nickname: pitcher.nickname,
      avatar: this.app.roster.canvas(pitcher.id),
      accentColor: pitcher.accentColor,
      modeLabel: cfg.mode === 'daily' ? '每日挑战' : '闯关模式',
      detail: cfg.mode === 'daily' && this.daily ? `${this.daily.date}（${this.daily.timeZone}）` : cfg.title,
      result: cfg.mode === 'daily' ? `${s.score} 分` : `${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}`,
      resultSub: cfg.mode === 'daily' ? `进球 ${s.hits}/10 · 最长连中 ${s.bestStreak}` : s.cleared ? `进球 ${s.hits}/${cfg.target} · 剩余 ${s.remaining} 次机会` : `进球 ${s.hits}/${cfg.target} · 下次一定`,
      line: cfg.mode === 'daily' ? `今天 ${s.score} 分，你来试试？` : s.cleared ? randomLine(pitcher.cheerLines, DEFAULT_CHEER_LINES) : '这球必须进，下次一定！',
      url,
    })
    let blob: Blob
    try {
      blob = await canvasToPng(card)
    } catch {
      toast('成绩卡生成失败')
      return
    }
    const previewUrl = URL.createObjectURL(blob)
    const shareText = `我在《${GAME_TITLE}》${cfg.mode === 'daily' ? `每日挑战拿了 ${s.score} 分` : `${cfg.title} 拿到 ${s.stars} 星`}！`
    const actions: HTMLElement[] = []
    if (canShareFiles(blob)) {
      actions.push(
        h('button.btn.primary', {
          type: 'button',
          'data-autofocus': '',
          onclick: async () => {
            const r = await systemShare(blob, GAME_TITLE, shareText, url)
            if (r === 'shared') toast('已分享')
            else if (r === 'error' || r === 'unsupported') toast('系统分享没有完成，可以改用下载图片')
            // 用户取消（cancelled）不提示
          },
        }, '分享给朋友'),
      )
    }
    actions.push(
      h('button', { type: 'button', class: actions.length ? 'btn' : 'btn primary', onclick: () => (downloadBlob(blob), toast('图片已开始下载')) }, '下载图片'),
    )
    if (url) {
      actions.push(
        h('button.btn', {
          type: 'button',
          onclick: async () => toast((await copyText(`${shareText} ${url}`)) ? '链接已复制' : '复制失败，请手动复制地址栏的链接'),
        }, '复制链接'),
      )
    }
    const prevDialog = this.dialog
    const dlg = openDialog({
      title: '分享成绩',
      onEscape: () => close(),
      content: [
        h('img.card-preview', { src: previewUrl, alt: '成绩卡预览' }),
        !url ? h('p.muted', '游戏还没有设置正式网址，成绩卡里暂不显示链接。') : null,
        ...actions,
        h('button.btn', { type: 'button', onclick: () => close() }, '关闭'),
      ],
    })
    const close = () => {
      dlg.close()
      URL.revokeObjectURL(previewUrl)
      this.dialog = prevDialog
    }
    this.dialog = { close }
  }
}
