import { test, expect } from "@playwright/test"

test.describe("Login — unauthenticated user", () => {
  test("redirects to /login and shows Google OAuth button", async ({
    page,
  }) => {
    await page.goto("/")
    await page.waitForURL("**/login")

    await expect(page).toHaveURL(/\/login/)
    await expect(
      page.getByRole("button", { name: /sign in with google/i }),
    ).toBeVisible()
  })
})
