import type { AchievementRank } from "@/types/achievements"

let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === "suspended") audioCtx.resume()
  return audioCtx
}

export function primeAudio(): void {
  try {
    getAudioCtx()
  } catch {
    // Web Audio not available — silent fallback
  }
}

export function playBeep(
  frequency: number,
  durationMs: number,
  volume = 0.3,
): void {
  try {
    const ctx = getAudioCtx()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.frequency.value = frequency
    osc.type = "sine"
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + durationMs / 1000,
    )

    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch {
    // Web Audio not available — silent fallback
  }
}

export function playWarningBeep(): void {
  playBeep(660, 150, 0.2)
}

export function playFinishBeeps(): void {
  playBeep(880, 200, 0.5)
  setTimeout(() => playBeep(1100, 300, 0.5), 250)
}

type FanfareVoice = {
  freq: number
  delay: number
  dur: number
  volume: number
  type: OscillatorType
}

/** C major lift: arpeggio → octave resolve → sparkle. Game unlock, not a rest beep. */
const FANFARE_VOICES: FanfareVoice[] = [
  { freq: 261.63, delay: 0, dur: 0.72, volume: 0.1, type: "sine" },
  { freq: 523.25, delay: 0, dur: 0.16, volume: 0.22, type: "triangle" },
  { freq: 659.25, delay: 0.11, dur: 0.16, volume: 0.24, type: "triangle" },
  { freq: 783.99, delay: 0.22, dur: 0.2, volume: 0.26, type: "triangle" },
  { freq: 1046.5, delay: 0.34, dur: 0.58, volume: 0.28, type: "triangle" },
  { freq: 783.99, delay: 0.34, dur: 0.52, volume: 0.14, type: "triangle" },
  { freq: 1318.51, delay: 0.44, dur: 0.38, volume: 0.11, type: "sine" },
]

const DIAMOND_VOICES: FanfareVoice[] = [
  { freq: 1567.98, delay: 0.52, dur: 0.4, volume: 0.09, type: "sine" },
  { freq: 2093.0, delay: 0.6, dur: 0.28, volume: 0.07, type: "triangle" },
]

const FANFARE_GAIN: Record<AchievementRank, number> = {
  bronze: 0.78,
  silver: 0.86,
  gold: 0.94,
  platinum: 1,
  diamond: 1.06,
}

function playVoice(ctx: AudioContext, voice: FanfareVoice, gainScale: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = voice.type
  osc.frequency.value = voice.freq
  const start = ctx.currentTime + voice.delay
  const peak = Math.max(voice.volume * gainScale, 0.001)
  gain.gain.setValueAtTime(0.001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, start + voice.dur)
  osc.start(start)
  osc.stop(start + voice.dur)
}

export function playAchievementFanfare(rank: AchievementRank = "gold"): void {
  try {
    const ctx = getAudioCtx()
    const scale = FANFARE_GAIN[rank] ?? FANFARE_GAIN.gold
    const voices =
      rank === "diamond" ? [...FANFARE_VOICES, ...DIAMOND_VOICES] : FANFARE_VOICES
    voices.forEach((voice) => playVoice(ctx, voice, scale))
  } catch {
    // Web Audio not available — silent fallback
  }
}
