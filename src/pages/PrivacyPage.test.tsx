import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { PrivacyPage } from "./PrivacyPage"
import frPrivacy from "@/locales/fr/privacy.json"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

describe("PrivacyPage", () => {
  it("renders the page title", () => {
    renderWithProviders(<PrivacyPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy Policy")
  })

  it("renders all eight section headings (Embedded Agent disclosure added in T121)", () => {
    renderWithProviders(<PrivacyPage />)
    expect(screen.getByText("Who we are")).toBeInTheDocument()
    expect(screen.getByText("What we collect and why")).toBeInTheDocument()
    expect(screen.getByText("Where your data is processed")).toBeInTheDocument()
    expect(screen.getByText("Retention")).toBeInTheDocument()
    expect(screen.getByText(/AI onboarding chat/i)).toBeInTheDocument()
    expect(screen.getByText("Your rights")).toBeInTheDocument()
    expect(screen.getByText("Security")).toBeInTheDocument()
    expect(screen.getByText("Changes to this policy")).toBeInTheDocument()
  })

  // ---------- T121: Embedded Agent disclosure ----------

  it("discloses what the Embedded Agent collects, where it goes, retention, and deletion behavior", () => {
    renderWithProviders(<PrivacyPage />)
    const body = document.body.textContent ?? ""
    // What is collected: free-text chat content (potentially health-adjacent).
    expect(body).toMatch(/free[- ]text|what you type/i)
    // Where: stored on our DB + sent to Gemini for inference.
    expect(body).toMatch(/Gemini/)
    // Retention: 90 days after commit/abandon.
    expect(body).toMatch(/90 days/i)
    // Deletion: account deletion immediately removes Embedded Agent rows.
    expect(body).toMatch(/account deletion|delete your account/i)
  })

  it("ships the Embedded Agent disclosure in French as well (no half-localized release per T121 acceptance)", () => {
    // Key-level assertion — we don't re-render the page in FR (test utils
    // only mount EN), but the JSON file must carry the same keys so a FR
    // user gets the same disclosure when i18n flips language.
    expect(frPrivacy).toHaveProperty("s8Title")
    expect(frPrivacy).toHaveProperty("s8Body")
    // Sanity-check a few content invariants in the FR copy too.
    const all = `${frPrivacy.s8Title}\n${frPrivacy.s8Body}`
    expect(all).toMatch(/90 jours/i)
    expect(all).toMatch(/Gemini/)
  })

  it("has a back link pointing to /", () => {
    renderWithProviders(<PrivacyPage />)
    const backLink = screen.getByRole("link", { name: /back to app/i })
    expect(backLink).toHaveAttribute("href", "/")
  })

  it("names the three sub-processors", () => {
    renderWithProviders(<PrivacyPage />)
    const body = document.body.textContent ?? ""
    expect(body).toMatch(/Supabase/)
    expect(body).toMatch(/Vercel/)
    expect(body).toMatch(/Gemini/)
  })

  it("discloses analytics pseudonymisation on account deletion", () => {
    renderWithProviders(<PrivacyPage />)
    expect(screen.getByText(/pseudonymised/i)).toBeInTheDocument()
  })

  it("discloses AI-agent integrations and Cloudflare routing (required for Anthropic directory submission, #296)", () => {
    renderWithProviders(<PrivacyPage />)
    const body = document.body.textContent ?? ""
    expect(body).toMatch(/Claude/)
    expect(body).toMatch(/Cursor/)
    expect(body).toMatch(/Cloudflare/)
  })
})
