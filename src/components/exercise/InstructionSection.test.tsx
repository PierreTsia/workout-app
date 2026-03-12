import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { Settings2 } from "lucide-react"
import { renderWithProviders } from "@/test/utils"
import { InstructionSection } from "./InstructionSection"

describe("InstructionSection", () => {
  it("renders title and items list", () => {
    renderWithProviders(
      <InstructionSection
        icon={Settings2}
        title="Setup"
        items={["Step one", "Step two"]}
      />,
    )

    expect(screen.getByText("Setup")).toBeInTheDocument()
    expect(screen.getByText("Step one")).toBeInTheDocument()
    expect(screen.getByText("Step two")).toBeInTheDocument()

    const listItems = screen.getAllByRole("listitem")
    expect(listItems).toHaveLength(2)
  })

  it("renders nothing when items is empty", () => {
    const { container } = renderWithProviders(
      <InstructionSection icon={Settings2} title="Setup" items={[]} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when items is undefined", () => {
    const { container } = renderWithProviders(
      <InstructionSection icon={Settings2} title="Setup" />,
    )

    expect(container.firstChild).toBeNull()
  })
})
