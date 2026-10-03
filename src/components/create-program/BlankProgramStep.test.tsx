import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlankProgramStep } from "./BlankProgramStep"

const mutateMock = vi.fn()

vi.mock("@/hooks/useCreateProgram", () => ({
  useCreateProgram: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}))

const navigateMock = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => navigateMock }
})

describe("BlankProgramStep — Nomos core form", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("associates the program name label with its input", () => {
    renderWithProviders(<BlankProgramStep />)
    expect(screen.getByLabelText("Program name")).toBe(
      screen.getByPlaceholderText("My Program"),
    )
  })

  it("creates the program with the typed name on submit", async () => {
    mutateMock.mockImplementation((_vars, options) => {
      options?.onSuccess?.("program-1")
    })

    renderWithProviders(<BlankProgramStep />)
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText("My Program"), "My Split")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { name: "My Split" },
        expect.anything(),
      )
    })
    expect(navigateMock).toHaveBeenCalledWith("/builder/program-1", {
      state: { from: "/create-program" },
    })
  })

  it("falls back to the placeholder as the name when left blank", async () => {
    mutateMock.mockImplementation((_vars, options) => {
      options?.onSuccess?.("program-2")
    })

    renderWithProviders(<BlankProgramStep />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { name: "My Program" },
        expect.anything(),
      )
    })
  })
})
