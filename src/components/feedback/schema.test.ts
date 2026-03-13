import { feedbackFormSchema, formValuesToPayload, type FeedbackFormValues } from "./schema"

const VALID_BASE: FeedbackFormValues = {
  whatIllustration: true,
  whatVideo: false,
  whatDescription: false,
  illustration: ["wrong_exercise"],
  video: [],
  description: [],
  other_illustration_text: "",
  other_video_text: "",
  other_description_text: "",
  comment: "",
}

describe("feedbackFormSchema", () => {
  describe("validation", () => {
    it("rejects when no category is selected", () => {
      const result = feedbackFormSchema.safeParse({
        ...VALID_BASE,
        whatIllustration: false,
        illustration: [],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message === "atLeastOneRequired")).toBe(true)
      }
    })

    it("rejects when category is selected but array is empty", () => {
      const result = feedbackFormSchema.safeParse({
        ...VALID_BASE,
        illustration: [],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("illustration"))).toBe(true)
      }
    })

    it("rejects when 'other' is selected but text is empty", () => {
      const result = feedbackFormSchema.safeParse({
        ...VALID_BASE,
        illustration: ["other"],
        other_illustration_text: "",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("other_illustration_text"))).toBe(true)
      }
    })

    it("rejects when 'other' text is only whitespace", () => {
      const result = feedbackFormSchema.safeParse({
        ...VALID_BASE,
        illustration: ["other"],
        other_illustration_text: "   ",
      })
      expect(result.success).toBe(false)
    })

    it("rejects video 'other' without text", () => {
      const result = feedbackFormSchema.safeParse({
        ...VALID_BASE,
        whatVideo: true,
        video: ["other"],
        other_video_text: "",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("other_video_text"))).toBe(true)
      }
    })

    it("rejects description 'other' without text", () => {
      const result = feedbackFormSchema.safeParse({
        ...VALID_BASE,
        whatDescription: true,
        description: ["other"],
        other_description_text: "",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("other_description_text"))).toBe(true)
      }
    })

    it("accepts valid minimal form", () => {
      const result = feedbackFormSchema.safeParse(VALID_BASE)
      expect(result.success).toBe(true)
    })

    it("accepts all three categories with 'other' text filled", () => {
      const result = feedbackFormSchema.safeParse({
        ...VALID_BASE,
        whatVideo: true,
        whatDescription: true,
        illustration: ["other"],
        video: ["different_exercise", "other"],
        description: ["unrelated", "other"],
        other_illustration_text: "bad image",
        other_video_text: "wrong video",
        other_description_text: "inaccurate steps",
      })
      expect(result.success).toBe(true)
    })

    it("accepts empty comment", () => {
      const result = feedbackFormSchema.safeParse({ ...VALID_BASE, comment: "" })
      expect(result.success).toBe(true)
    })
  })

  describe("formValuesToPayload", () => {
    const EX_ID = "ex-123"
    const EMAIL = "user@test.com"
    const USER_ID = "uid-456"
    const SOURCE = "workout" as const

    it("includes only selected categories in fields_reported", () => {
      const payload = formValuesToPayload(VALID_BASE, EX_ID, EMAIL, USER_ID, SOURCE)
      expect(payload.fields_reported).toEqual(["illustration"])
      expect(payload.error_details).toEqual({ illustration: ["wrong_exercise"] })
    })

    it("maps all three categories when selected", () => {
      const values: FeedbackFormValues = {
        ...VALID_BASE,
        whatVideo: true,
        whatDescription: true,
        video: ["poor_quality"],
        description: ["unrelated", "wrong_muscle"],
      }
      const payload = formValuesToPayload(values, EX_ID, EMAIL, USER_ID, SOURCE)
      expect(payload.fields_reported).toEqual(["illustration", "video", "description"])
      expect(payload.error_details.video).toEqual(["poor_quality"])
      expect(payload.error_details.description).toEqual(["unrelated", "wrong_muscle"])
    })

    it("excludes category when flag is true but array is empty", () => {
      const values: FeedbackFormValues = {
        ...VALID_BASE,
        whatVideo: true,
        video: [],
      }
      const payload = formValuesToPayload(values, EX_ID, EMAIL, USER_ID, SOURCE)
      expect(payload.fields_reported).not.toContain("video")
      expect(payload.error_details.video).toBeUndefined()
    })

    it("trims other_*_text and converts empty to null", () => {
      const values: FeedbackFormValues = {
        ...VALID_BASE,
        illustration: ["other"],
        other_illustration_text: "  trimmed  ",
        other_video_text: "",
        other_description_text: "   ",
      }
      const payload = formValuesToPayload(values, EX_ID, EMAIL, USER_ID, SOURCE)
      expect(payload.other_illustration_text).toBe("trimmed")
      expect(payload.other_video_text).toBeNull()
      expect(payload.other_description_text).toBeNull()
    })

    it("trims comment and converts empty to null", () => {
      const payload = formValuesToPayload(
        { ...VALID_BASE, comment: "  " },
        EX_ID, EMAIL, USER_ID, SOURCE,
      )
      expect(payload.comment).toBeNull()

      const payload2 = formValuesToPayload(
        { ...VALID_BASE, comment: " some note " },
        EX_ID, EMAIL, USER_ID, SOURCE,
      )
      expect(payload2.comment).toBe("some note")
    })

    it("passes through exercise_id, user_email, user_id, source_screen", () => {
      const payload = formValuesToPayload(VALID_BASE, EX_ID, EMAIL, USER_ID, SOURCE)
      expect(payload.exercise_id).toBe(EX_ID)
      expect(payload.user_email).toBe(EMAIL)
      expect(payload.user_id).toBe(USER_ID)
      expect(payload.source_screen).toBe(SOURCE)
    })
  })
})
