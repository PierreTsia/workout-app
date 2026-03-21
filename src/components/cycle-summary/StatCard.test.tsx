import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { Calendar } from "lucide-react"
import { StatCard } from "./StatCard"

describe("StatCard", () => {
  it("renders value, label, and icon", () => {
    renderWithProviders(
      <StatCard icon={Calendar} value="4/6" label="Sessions" />,
    )
    expect(screen.getByText("4/6")).toBeInTheDocument()
    expect(screen.getByText("Sessions")).toBeInTheDocument()
  })

  it("renders numeric values", () => {
    renderWithProviders(
      <StatCard icon={Calendar} value={42} label="Sets done" />,
    )
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("shows delta badge when delta is provided", () => {
    renderWithProviders(
      <StatCard icon={Calendar} value={120} label="Sets" delta={15.2} />,
    )
    const badge = screen.getByText((_content, element) =>
      element?.textContent === "+15.2%" && element?.tagName === "SPAN",
    )
    expect(badge).toBeInTheDocument()
  })

  it("hides delta badge when delta is null", () => {
    const { container } = renderWithProviders(
      <StatCard icon={Calendar} value={120} label="Sets" delta={null} />,
    )
    expect(container.querySelector(".text-emerald-400")).toBeNull()
    expect(container.querySelector(".text-red-400")).toBeNull()
  })

  it("hides delta badge when delta is not provided", () => {
    const { container } = renderWithProviders(
      <StatCard icon={Calendar} value={120} label="Sets" />,
    )
    expect(container.querySelector(".text-emerald-400")).toBeNull()
  })
})
