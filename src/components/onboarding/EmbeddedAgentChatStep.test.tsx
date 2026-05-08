import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import { EmbeddedAgentChatStep } from "./EmbeddedAgentChatStep"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

const invokeMock = supabase.functions.invoke as unknown as Mock

const realOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine")

beforeEach(() => {
  invokeMock.mockReset()
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
})

afterEach(() => {
  if (realOnLine) Object.defineProperty(navigator, "onLine", realOnLine)
})

describe("EmbeddedAgentChatStep", () => {
  it("renders the thread shortened id, status and a Restart action once /thread resolves", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "deadbeef-1234-5678-9abc-deadbeefcafe",
        status: "open",
        resumed: false,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(
      await screen.findByText(/Thread deadbeef · open/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /Build your program with the assistant/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /restart/i }),
    ).toBeInTheDocument()
  })

  it("shows the resumed badge when the thread was resumed", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "abcdef12-0000-0000-0000-000000000000",
        status: "preview_ready",
        resumed: true,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(await screen.findByText(/Resumed conversation/i)).toBeInTheDocument()
  })

  it("does not show the resumed badge for a fresh thread", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "fresh1234-0000-0000-0000-000000000000",
        status: "open",
        resumed: false,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    await screen.findByText(/Thread fresh/)
    expect(screen.queryByText(/Resumed conversation/i)).not.toBeInTheDocument()
  })

  it("renders the offline banner instead of waiting forever when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(screen.getByText(/You're offline/i)).toBeInTheDocument()
  })

  it("renders the offline banner when /thread fails to fetch", async () => {
    invokeMock.mockRejectedValueOnce(new Error("network"))

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(await screen.findByText(/You're offline/i)).toBeInTheDocument()
  })

  it("Restart confirms, abandons the active thread, and refetches a fresh one", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "old11111-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: { thread_id: "new22222-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(await screen.findByText(/Thread old1/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /restart/i }))

    await user.click(await screen.findByRole("button", { name: /start over/i }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
        body: { action: "abandon" },
      })
    })

    expect(await screen.findByText(/Thread new2/)).toBeInTheDocument()
  })

  it("Back abandons the active thread and calls onBack", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "th-1234-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })

    const onBack = vi.fn()
    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={onBack} />)

    await screen.findByText(/Thread th-1234/)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /^back$/i }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
        body: { action: "abandon" },
      })
    })
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
