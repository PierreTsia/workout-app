import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

type MockOscillator = {
  frequency: { value: number }
  type: OscillatorType | ""
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onended: ((this: void) => void) | null
}

type MockGain = {
  connect: ReturnType<typeof vi.fn>
  gain: {
    value: number
    setValueAtTime: ReturnType<typeof vi.fn>
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
  }
}

type MockAudioContext = {
  state: "running" | "suspended" | "closed"
  currentTime: number
  destination: object
  resume: ReturnType<typeof vi.fn>
  createOscillator: () => MockOscillator
  createGain: () => MockGain
  oscillators: MockOscillator[]
}

function makeMockAudioContext(): MockAudioContext {
  const oscillators: MockOscillator[] = []
  return {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    createOscillator: () => {
      const osc: MockOscillator = {
        frequency: { value: 0 },
        type: "",
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      oscillators.push(osc)
      return osc
    },
    createGain: () => ({
      connect: vi.fn(),
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }),
    oscillators,
  }
}

let constructorSpy: ReturnType<typeof vi.fn>
let currentCtx: MockAudioContext

beforeEach(() => {
  vi.resetModules()
  currentCtx = makeMockAudioContext()
  constructorSpy = vi.fn(function MockAudioContext() {
    return currentCtx
  })
  vi.stubGlobal("AudioContext", constructorSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function importAudio() {
  return await import("./audio")
}

describe("audio.ts", () => {
  it("creates exactly one AudioContext across multiple primeAudio calls", async () => {
    const { primeAudio } = await importAudio()

    primeAudio()
    primeAudio()
    primeAudio()

    expect(constructorSpy).toHaveBeenCalledTimes(1)
  })

  it("resumes the context when primeAudio is called and the context is suspended", async () => {
    currentCtx.state = "suspended"
    const { primeAudio } = await importAudio()

    primeAudio()

    expect(currentCtx.resume).toHaveBeenCalledTimes(1)
  })

  it("swallows exceptions when AudioContext is unavailable", async () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function ThrowingAudioContext() {
        throw new Error("Web Audio not supported")
      }),
    )

    const { primeAudio, playBeep, playFinishBeeps, playAchievementFanfare } =
      await importAudio()

    expect(() => primeAudio()).not.toThrow()
    expect(() => playBeep(440, 100)).not.toThrow()
    expect(() => playFinishBeeps()).not.toThrow()
    expect(() => playAchievementFanfare()).not.toThrow()
  })

  it("plays the finish chime as two oscillators at 880 Hz and 1100 Hz, 250 ms apart", async () => {
    vi.useFakeTimers()
    try {
      const { playFinishBeeps } = await importAudio()

      playFinishBeeps()

      expect(currentCtx.oscillators).toHaveLength(1)
      expect(currentCtx.oscillators[0].frequency.value).toBe(880)

      vi.advanceTimersByTime(250)

      expect(currentCtx.oscillators).toHaveLength(2)
      expect(currentCtx.oscillators[1].frequency.value).toBe(1100)
    } finally {
      vi.useRealTimers()
    }
  })

  it("plays a rising fanfare, not a two-beep chime", async () => {
    const { playAchievementFanfare } = await importAudio()

    playAchievementFanfare("gold")

    expect(currentCtx.oscillators.length).toBeGreaterThan(4)
    expect(currentCtx.oscillators[0]?.frequency.value).toBeCloseTo(261.63)
    expect(currentCtx.oscillators.some((osc) => osc.frequency.value === 1046.5)).toBe(
      true,
    )
    expect(
      currentCtx.oscillators.some((osc) => osc.type === "triangle"),
    ).toBe(true)
  })

  it("adds a higher sparkle for Diamond", async () => {
    const { playAchievementFanfare } = await importAudio()

    playAchievementFanfare("gold")
    const goldCount = currentCtx.oscillators.length

    playAchievementFanfare("diamond")
    expect(currentCtx.oscillators.length).toBeGreaterThan(goldCount)
    expect(currentCtx.oscillators.some((osc) => osc.frequency.value === 2093)).toBe(
      true,
    )
  })
})
