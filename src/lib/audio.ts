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
