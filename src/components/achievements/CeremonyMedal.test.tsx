import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CeremonyMedal } from "./CeremonyMedal"

describe("CeremonyMedal", () => {
  it("renders a metallic coin with the GymLogic ring, not a trophy emoji", () => {
    const { container } = render(
      <CeremonyMedal rank="gold" iconUrl={null} alt="Plateau Titan" size={112} />,
    )

    expect(screen.getByRole("img", { name: "Plateau Titan" })).toBeInTheDocument()
    expect(container.textContent).toContain("GYMLOGIC")
    expect(container.textContent).not.toContain("🏆")
  })

  it("clips the real icon into the coin when a url is provided", () => {
    const { container } = render(
      <CeremonyMedal
        rank="gold"
        iconUrl="https://example.com/badge.png"
        alt="Plateau Titan"
        size={112}
      />,
    )

    expect(container.querySelector("image")).toHaveAttribute(
      "href",
      "https://example.com/badge.png",
    )
  })
})
