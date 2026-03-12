import { describe, it, expect } from "vitest"
import { extractVideoId, getYouTubeThumbnail } from "./youtube"

describe("extractVideoId", () => {
  it("parses standard watch URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    )
  })

  it("parses youtu.be short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    )
  })

  it("parses shorts URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ")
  })

  it("parses URL with extra query params", () => {
    expect(
      extractVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=PLx",
      ),
    ).toBe("dQw4w9WgXcQ")
  })

  it("returns null for malformed URL", () => {
    expect(extractVideoId("https://youtube.com/watch?v=")).toBeNull()
  })

  it("returns null for non-YouTube URL", () => {
    expect(extractVideoId("https://vimeo.com/123456789")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(extractVideoId("")).toBeNull()
  })
})

describe("getYouTubeThumbnail", () => {
  it("returns correct thumbnail URL", () => {
    expect(
      getYouTubeThumbnail("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg")
  })

  it("returns null for invalid input", () => {
    expect(getYouTubeThumbnail("not-a-url")).toBeNull()
  })
})
