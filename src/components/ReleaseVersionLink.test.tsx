import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import {
  BUILD_RELEASE_VERSION,
  fetchReleaseVersion,
} from "@/lib/releaseVersion"
import { ReleaseVersionLink } from "./ReleaseVersionLink"

vi.mock("@/lib/releaseVersion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/releaseVersion")>()
  return { ...actual, fetchReleaseVersion: vi.fn() }
})

const mockedFetch = vi.mocked(fetchReleaseVersion)

describe("ReleaseVersionLink", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the fetched version and links to the releases in a new tab", async () => {
    mockedFetch.mockResolvedValue("1.2.3")

    renderWithProviders(<ReleaseVersionLink />)

    await waitFor(() =>
      expect(screen.getByText("Version 1.2.3")).toBeInTheDocument(),
    )

    const link = screen.getByRole("link", { name: /Release notes/i })
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/PierreTsia/workout-app/releases",
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("falls back to the exact build version when the fetch returns null", async () => {
    mockedFetch.mockResolvedValue(null)

    renderWithProviders(<ReleaseVersionLink />)

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(
      screen.getByText(`Version ${BUILD_RELEASE_VERSION}`),
    ).toBeInTheDocument()
  })
})
