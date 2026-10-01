import { beforeEach, describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import {
  BUILD_RELEASE_VERSION,
  fetchReleaseVersion,
} from "@/lib/releaseVersion"
import { useReleaseVersion } from "./useReleaseVersion"

vi.mock("@/lib/releaseVersion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/releaseVersion")>()
  return { ...actual, fetchReleaseVersion: vi.fn() }
})

const mockedFetch = vi.mocked(fetchReleaseVersion)

describe("useReleaseVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the fetched version once resolved", async () => {
    mockedFetch.mockResolvedValue("9.9.9")

    const { result } = renderHookWithProviders(() => useReleaseVersion())

    await waitFor(() => expect(result.current).toBe("9.9.9"))
  })

  it("falls back to the build version when the fetch returns null", async () => {
    mockedFetch.mockResolvedValue(null)

    const { result } = renderHookWithProviders(() => useReleaseVersion())

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(result.current).toBe(BUILD_RELEASE_VERSION)
  })
})
