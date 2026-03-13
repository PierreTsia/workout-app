import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { MultiSelect, type MultiSelectOption } from "./multi-select"

const OPTIONS: MultiSelectOption[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
]

function renderSelect(props: Partial<React.ComponentProps<typeof MultiSelect>> = {}) {
  const onChange = vi.fn()
  const result = renderWithProviders(
    <MultiSelect
      options={OPTIONS}
      value={[]}
      onChange={onChange}
      placeholder="Pick one…"
      {...props}
    />,
  )
  return { ...result, onChange }
}

describe("MultiSelect", () => {
  it("renders placeholder when value is empty", () => {
    renderSelect()
    expect(screen.getByRole("combobox")).toHaveTextContent("Pick one…")
  })

  it("shows first label when 1 item selected", () => {
    renderSelect({ value: ["b"] })
    expect(screen.getByRole("combobox")).toHaveTextContent("Bravo")
  })

  it("shows first label + count pill when 2+ items selected", () => {
    renderSelect({ value: ["a", "b", "c"] })
    const trigger = screen.getByRole("combobox")
    expect(trigger).toHaveTextContent("Alpha")
    expect(trigger).toHaveTextContent("+2")
  })

  it("opens popover with all options", async () => {
    const user = userEvent.setup()
    renderSelect()
    await user.click(screen.getByRole("combobox"))
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Bravo")).toBeInTheDocument()
    expect(screen.getByText("Charlie")).toBeInTheDocument()
  })

  it("calls onChange with value added when clicking unchecked option", async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect({ value: ["a"] })
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByText("Bravo"))
    expect(onChange).toHaveBeenCalledWith(["a", "b"])
  })

  it("calls onChange with value removed when clicking checked option", async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect({ value: ["a", "b"] })
    await user.click(screen.getByRole("combobox"))
    const checkedAlpha = screen.getAllByText("Alpha").find(
      (el) => el.closest("label") !== null,
    )!
    await user.click(checkedAlpha)
    expect(onChange).toHaveBeenCalledWith(["b"])
  })

  it("does not open when disabled", async () => {
    const user = userEvent.setup()
    renderSelect({ disabled: true })
    await user.click(screen.getByRole("combobox"))
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
  })

  it("falls back to raw value string if not in options", () => {
    renderSelect({ value: ["unknown"] })
    expect(screen.getByRole("combobox")).toHaveTextContent("unknown")
  })
})
