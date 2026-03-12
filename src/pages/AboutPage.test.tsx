import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { AboutPage } from "./AboutPage"

describe("AboutPage", () => {
  function renderAbout() {
    return renderWithProviders(<AboutPage />, { initialEntries: ["/about"] })
  }

  it("renders the hero section with app name and tagline", () => {
    renderAbout()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Workout")
    expect(screen.getByText("Free, open-source workout tracker")).toBeInTheDocument()
  })

  it("renders all section headings", () => {
    renderAbout()
    const expectedHeadings = [
      "The Story",
      "What makes it different",
      "Open Source",
      "Support the project",
      "Credits",
    ]
    for (const heading of expectedHeadings) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
    }
  })

  it("renders the story paragraphs", () => {
    renderAbout()
    expect(screen.getByText(/I built this because/)).toBeInTheDocument()
    expect(screen.getByText(/no-BS workout tracker/)).toBeInTheDocument()
  })

  it("renders all four feature items", () => {
    renderAbout()
    expect(screen.getByText(/Works offline/)).toBeInTheDocument()
    expect(screen.getByText(/Fully open-source/)).toBeInTheDocument()
    expect(screen.getByText(/Privacy-first/)).toBeInTheDocument()
    expect(screen.getByText(/Free forever/)).toBeInTheDocument()
  })

  it("renders GitHub repo link with correct href and target", () => {
    renderAbout()
    const ghLink = screen.getByRole("link", { name: /View on GitHub/i })
    expect(ghLink).toHaveAttribute("href", "https://github.com/PierreTsia/workout-app")
    expect(ghLink).toHaveAttribute("target", "_blank")
  })

  it("renders the donations coming soon badge", () => {
    renderAbout()
    expect(screen.getByText("Donations coming soon")).toBeInTheDocument()
  })

  it("renders the credits with author profile link", () => {
    renderAbout()
    const authorLink = screen.getByRole("link", { name: "PierreTsia" })
    expect(authorLink).toHaveAttribute("href", "https://github.com/PierreTsia")
    expect(authorLink).toHaveAttribute("target", "_blank")
  })

  it("renders AI-assisted development credit", () => {
    renderAbout()
    expect(screen.getByText(/AI-assisted development/)).toBeInTheDocument()
  })

  it("renders the 'Go to app' navigation link pointing to /", () => {
    renderAbout()
    const navLink = screen.getByRole("link", { name: /Go to app/i })
    expect(navLink).toHaveAttribute("href", "/")
  })
})
