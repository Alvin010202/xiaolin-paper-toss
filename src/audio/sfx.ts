/**
 * 全部音效由 Web Audio 程序实时合成，没有外部音频文件。
 * 浏览器要求在用户交互后才能播放声音：第一次点击/按键时才创建 AudioContext。
 */
export type SfxName =
  | 'ui'
  | 'grab'
  | 'stretch'
  | 'throw'
  | 'thud'
  | 'rim'
  | 'score'
  | 'combo'
  | 'miss'
  | 'cheer'
  | 'clear'
  | 'fail'
  | 'cancel'

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private lastThud = 0

  constructor(public muted: boolean) {
    const unlock = () => {
      this.ensure()
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
  }

  setMuted(m: boolean): void {
    this.muted = m
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } catch {
      this.ctx = null
    }
    return this.ctx
  }

  /** volume 0～1 */
  play(name: SfxName, volume = 1): void {
    if (this.muted) return
    const ctx = this.ctx
    if (!ctx || !this.master || ctx.state !== 'running') return
    const t = ctx.currentTime
    switch (name) {
      case 'ui':
        this.tone(660, t, 0.06, 'sine', 0.25)
        break
      case 'grab':
        this.tone(420, t, 0.07, 'triangle', 0.3)
        break
      case 'stretch':
        this.tone(300 + volume * 500, t, 0.04, 'sine', 0.12)
        break
      case 'cancel':
        this.tone(330, t, 0.08, 'triangle', 0.2)
        this.tone(250, t + 0.06, 0.1, 'triangle', 0.2)
        break
      case 'throw':
        this.noiseBurst(t, 0.22, 900, 2600, 0.35 * (0.5 + volume / 2))
        break
      case 'thud': {
        if (t - this.lastThud < 0.06) return
        this.lastThud = t
        const v = Math.min(1, volume)
        this.tone(140, t, 0.09, 'sine', 0.5 * v)
        this.noiseBurst(t, 0.06, 400, 300, 0.25 * v)
        break
      }
      case 'rim':
        this.tone(980, t, 0.25, 'triangle', 0.18 * volume)
        this.tone(1470, t, 0.18, 'sine', 0.1 * volume)
        break
      case 'score':
        ;[523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.07, 0.18, 'triangle', 0.3))
        break
      case 'combo':
        ;[659, 784, 988, 1319].forEach((f, i) => this.tone(f, t + i * 0.06, 0.16, 'square', 0.12))
        break
      case 'miss':
        this.slide(320, 150, t, 0.4, 'triangle', 0.3)
        break
      case 'cheer':
        this.noiseBurst(t, 0.7, 1200, 1800, 0.12)
        this.noiseBurst(t + 0.15, 0.6, 1500, 1500, 0.1)
        break
      case 'clear':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.11, 0.3, 'triangle', 0.3))
        this.tone(1047, t + 0.45, 0.5, 'sine', 0.2)
        break
      case 'fail':
        ;[392, 349, 330, 262].forEach((f, i) => this.tone(f, t + i * 0.16, 0.26, 'triangle', 0.25))
        break
    }
  }

  private env(t: number, dur: number, peak: number): GainNode {
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    g.connect(this.master!)
    return g
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, peak: number): void {
    const o = this.ctx!.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    o.connect(this.env(t, dur, peak))
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private slide(from: number, to: number, t: number, dur: number, type: OscillatorType, peak: number): void {
    const o = this.ctx!.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, t + dur)
    o.connect(this.env(t, dur, peak))
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private noiseBurst(t: number, dur: number, fromHz: number, toHz: number, peak: number): void {
    if (!this.noise) return
    const src = this.ctx!.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx!.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(fromHz, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t + dur)
    src.connect(f)
    f.connect(this.env(t, dur, peak))
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }
}
