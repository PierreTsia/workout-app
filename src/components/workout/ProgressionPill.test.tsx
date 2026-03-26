import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProgressionPill } from "./ProgressionPill"
import type { ProgressionSuggestion, ProgressionRule } from "@/lib/progression"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuggestion(
  rule: ProgressionRule,
  overrides: Partial<ProgressionSuggestion> = {},
): ProgressionSuggestion {
  const defaults: Record<ProgressionRule, Omit<ProgressionSuggestion, "rule">> = {
    REPS_UP: { reps: 11, weight: 80, sets: 3, reasonKey: "progression.repsUp", delta: "+1 rep" },
    WEIGHT_UP: {
      reps: 8,
      weight: 82.5,
      sets: 3,
      reasonKey: "progression.weightUp",
      delta: "+2.5kg",
    },
    SETS_UP: { reps: 8, weight: 80, sets: 4, reasonKey: "progression.setsUp", delta: "+1 set" },
    HOLD_INCOMPLETE: {
      reps: 10,
      weight: 80,
      sets: 3,
      reasonKey: "progression.holdIncomplete",
      delta: "—",
    },
    HOLD_NEAR_FAILURE: {
      reps: 10,
      weight: 80,
      sets: 3,
      reasonKey: "progression.holdNearFailure",
      delta: "—",
    },
    PLATEAU: { reps: 12, weight: 100, sets: 5, reasonKey: "progression.plateau", delta: "—" },
  }
  return { rule, ...defaults[rule], ...overrides }
}

/** Click the pill badge to open the popover */
async function openPopover(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger)
}

function renderPill(rule: ProgressionRule, overrides?: Partial<ProgressionSuggestion>) {
  return renderWithProviders(<ProgressionPill suggestion={makeSuggestion(rule, overrides)} />)
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("ProgressionPill", () => {
  const progressRules: ProgressionRule[] = ["REPS_UP", "WEIGHT_UP", "SETS_UP"]
  const holdRules: ProgressionRule[] = ["HOLD_INCOMPLETE", "HOLD_NEAR_FAILURE"]

  it.each(progressRules)("renders %s with emerald styling", (rule) => {
    renderPill(rule)
    const badge = screen.getByText(/up/i).closest("div[class]")!
    expect(badge.className).toMatch(/emerald/)
  })

  it.each(holdRules)("renders %s with amber styling", (rule) => {
    renderPill(rule)
    const badge = screen.getByText(/Hold/i).closest("div[class]")!
    expect(badge.className).toMatch(/amber/)
  })

  it("renders PLATEAU with muted styling", () => {
    renderPill("PLATEAU")
    const badge = screen.getByText(/Plateau/i).closest("div[class]")!
    expect(badge.className).toMatch(/muted/)
  })

  it("shows delta in the label when delta is not —", () => {
    renderPill("REPS_UP")
    expect(screen.getByText(/\+1 rep/)).toBeTruthy()
  })

  it("does not show delta when delta is —", () => {
    renderPill("HOLD_INCOMPLETE")
    const badge = screen.getByText(/Hold/i)
    expect(badge.textContent).not.toContain("—")
  })

  it("opens popover with detail text on click", async () => {
    const user = userEvent.setup()
    renderPill("REPS_UP")

    const trigger = screen.getByText(/Reps up/i)
    await openPopover(user, trigger)

    expect(screen.getByText(/nailed every set/i)).toBeTruthy()
  })

  it("shows autoAppliedHint for progress rules (REPS_UP)", async () => {
    const user = userEvent.setup()
    renderPill("REPS_UP")

    await openPopover(user, screen.getByText(/Reps up/i))

    expect(screen.getByText(/Already applied/i)).toBeTruthy()
  })

  it("does not show autoAppliedHint for hold rules", async () => {
    const user = userEvent.setup()
    renderPill("HOLD_INCOMPLETE")

    await openPopover(user, screen.getByText(/Hold/i))

    expect(screen.queryByText(/Already applied/i)).toBeNull()
  })

  it("shows 'Try the AI program generator' link only for PLATEAU", async () => {
    const user = userEvent.setup()
    renderPill("PLATEAU")

    await openPopover(user, screen.getByText(/Plateau/i))

    const link = screen.getByRole("link", { name: /AI program generator/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute("href")).toBe("/create-program")
  })
})
