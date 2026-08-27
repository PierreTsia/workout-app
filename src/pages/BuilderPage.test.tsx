import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"
import { mockQueryResult, renderWithProviders } from "@/test/utils"
import type { Program } from "@/types/onboarding"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}))

vi.mock("@/hooks/useProgram", () => ({
  useProgram: () =>
    mockQueryResult({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      user_id: "u-1",
      name: "PPL",
      template_id: null,
      is_active: true,
      archived_at: null,
      created_at: "2026-08-01T00:00:00Z",
    } satisfies Program),
}))

vi.mock("@/components/builder/BuilderHeader", () => ({
  BuilderHeader: ({ viewTitle }: { viewTitle: string }) => (
    <h1>{viewTitle}</h1>
  ),
}))

vi.mock("@/components/builder/DayList", () => ({
  DayList: () => <div>day list</div>,
}))

vi.mock("@/components/builder/DayEditor", () => ({
  DayEditor: ({ dayId }: { dayId: string }) => <div>{`editing ${dayId}`}</div>,
}))

import { BuilderPage } from "./BuilderPage"

const PROGRAM_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

function renderBuilder(state?: { dayId?: string; from?: string }) {
  return renderWithProviders(
    <Routes>
      <Route path="/builder/:programId" element={<BuilderPage />} />
    </Routes>,
    {
      initialEntries: [{ pathname: `/builder/${PROGRAM_ID}`, state }],
    },
  )
}

describe("BuilderPage", () => {
  it("opens on the day list when no day is in location state", () => {
    renderBuilder({ from: "/programs/x" })

    expect(
      screen.getByRole("heading", { name: "Workout Builder" }),
    ).toBeInTheDocument()
    expect(screen.getByText("day list")).toBeInTheDocument()
    expect(screen.queryByText(/editing /)).not.toBeInTheDocument()
  })

  it("opens that day's editor when location state carries a day id", () => {
    renderBuilder({ dayId: "day-1", from: "/programs/x" })

    expect(
      screen.getByRole("heading", { name: "Edit Day" }),
    ).toBeInTheDocument()
    expect(screen.getByText("editing day-1")).toBeInTheDocument()
    expect(screen.queryByText("day list")).not.toBeInTheDocument()
  })
})
