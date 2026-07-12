export type WaveKind = OscillatorType

export interface ToneOptions {
  freq: number
  duration?: number
  wave?: WaveKind
  gain?: number
}

export function clampArcadeVolume(volume: number) {
  if (!Number.isFinite(volume)) return 0.65
  return Math.min(1, Math.max(0, volume))
}

export class ArcadeAudio {
  private ctx: AudioContext | null = null
  private loopTimer: ReturnType<typeof setTimeout> | null = null
  private muted = false
  private paused = false
  private volume = 0.65
  private closed = false
  private loopNotes: ToneOptions[] = []
  private loopBeatMs = 120

  constructor(muted: boolean, volume = 0.65) {
    this.muted = muted
    this.volume = clampArcadeVolume(volume)
  }

  setMuted(muted: boolean) {
    const wasMuted = this.muted
    this.muted = muted
    if (muted) this.stopLoop()
    if (wasMuted && !muted) this.restartLoopIfAudible()
  }

  setPaused(paused: boolean) {
    const wasPaused = this.paused
    this.paused = paused
    if (paused) this.stopLoop()
    if (wasPaused && !paused) this.restartLoopIfAudible()
  }

  setVolume(volume: number) {
    const previous = this.volume
    this.volume = clampArcadeVolume(volume)
    if (this.volume === 0) this.stopLoop()
    if (previous === 0 && this.volume > 0) this.restartLoopIfAudible()
  }

  tone({ freq, duration = 0.08, wave = 'square', gain = 0.05 }: ToneOptions) {
    if (this.muted || this.paused || this.closed || this.volume === 0) return false
    const ctx = this.ensureContext()
    if (!ctx) return false
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    amp.gain.setValueAtTime(Math.max(0.001, gain * this.volume), now)
    amp.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration)
    return true
  }

  noise(duration = 0.09, gain = 0.04) {
    if (this.muted || this.paused || this.closed || this.volume === 0) return false
    const ctx = this.ensureContext()
    if (!ctx) return false
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(Math.max(0.001, gain * this.volume), ctx.currentTime)
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    src.buffer = buffer
    src.connect(amp)
    amp.connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + duration)
    return true
  }

  startLoop(notes: ToneOptions[], beatMs = 120) {
    this.stopLoop()
    this.loopNotes = notes
    this.loopBeatMs = beatMs
    if (this.muted || this.paused || this.closed || this.volume === 0 || notes.length === 0) return
    this.runLoop()
  }

  private runLoop() {
    if (this.muted || this.paused || this.closed || this.volume === 0 || this.loopNotes.length === 0) return
    let index = 0
    const tick = () => {
      if (this.muted || this.paused || this.closed || this.volume === 0) return
      this.tone(this.loopNotes[index])
      index = (index + 1) % this.loopNotes.length
      this.loopTimer = setTimeout(tick, this.loopBeatMs)
    }
    tick()
  }

  stopLoop() {
    if (this.loopTimer) clearTimeout(this.loopTimer)
    this.loopTimer = null
  }

  private restartLoopIfAudible() {
    if (!this.muted && !this.paused && !this.closed && this.volume > 0 && this.loopNotes.length > 0) {
      this.runLoop()
    }
  }

  close() {
    this.closed = true
    this.stopLoop()
    const ctx = this.ctx
    this.ctx = null
    if (ctx && ctx.state !== 'closed') void ctx.close()
  }

  private ensureContext() {
    if (this.ctx) return this.ctx
    const AudioCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioCtor) return null
    this.ctx = new AudioCtor()
    return this.ctx
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export const arcadeLoop: ToneOptions[] = [
  { freq: 262, duration: 0.06, wave: 'square', gain: 0.025 },
  { freq: 330, duration: 0.06, wave: 'square', gain: 0.025 },
  { freq: 392, duration: 0.06, wave: 'triangle', gain: 0.025 },
  { freq: 330, duration: 0.06, wave: 'square', gain: 0.025 },
  { freq: 294, duration: 0.06, wave: 'square', gain: 0.022 },
  { freq: 349, duration: 0.06, wave: 'triangle', gain: 0.022 },
  { freq: 440, duration: 0.06, wave: 'square', gain: 0.02 },
  { freq: 349, duration: 0.06, wave: 'triangle', gain: 0.022 },
]
