import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { PrivacyPage } from "./PrivacyPage"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

describe("PrivacyPage", () => {
  it("renders the page title", () => {
    renderWithProviders(<PrivacyPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy Policy")
  })

  it("renders all seven section headings", () => {
    renderWithProviders(<PrivacyPage />)
    expect(screen.getByText("Who we are")).toBeInTheDocument()
    expect(screen.getByText("What we collect and why")).toBeInTheDocument()
    expect(screen.getByText("Where your data is processed")).toBeInTheDocument()
    expect(screen.getByText("Retention")).toBeInTheDocument()
    expect(screen.getByText("Your rights")).toBeInTheDocument()
    expect(screen.getByText("Security")).toBeInTheDocument()
    expect(screen.getByText("Changes to this policy")).toBeInTheDocument()
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
})
