import { describe, it, expect } from "vitest"
import { act, screen } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"
import { renderWithProviders } from "@/test/utils"
import { AdminGuard } from "@/router/AdminGuard"
import { isAdminAtom, isAdminLoadingAtom } from "@/store/atoms"

/**
 * `/admin/translations` is guarded by the same `AdminGuard` as the five admin
 * routes that came before it, so the criterion is a fact about the guard rather
 * than about the page — verified here once, on the real route path.
 */
function renderGuardedRoute({
  isAdmin,
  isLoading = false,
}: {
  isAdmin: boolean
  isLoading?: boolean
}) {
  const rendered = renderWithProviders(
    <Routes>
      <Route path="/" element={<p>home</p>} />
      <Route element={<AdminGuard />}>
        <Route path="/admin/translations" element={<p>translation queue</p>} />
      </Route>
    </Routes>,
    { initialEntries: ["/admin/translations"] },
  )

  // `isAdminLoadingAtom` starts true, so the first paint renders neither branch
  // and the verdict below is the only one the router ever sees.
  act(() => {
    rendered.store.set(isAdminAtom, isAdmin)
    rendered.store.set(isAdminLoadingAtom, isLoading)
  })
  return rendered
}

describe("AdminGuard on /admin/translations", () => {
  it("lets an admin through", () => {
    renderGuardedRoute({ isAdmin: true })

    expect(screen.getByText("translation queue")).toBeInTheDocument()
  })

  it("redirects a non-admin home", () => {
    renderGuardedRoute({ isAdmin: false })

    expect(screen.queryByText("translation queue")).toBeNull()
    expect(screen.getByText("home")).toBeInTheDocument()
  })

  // Rendering nothing while the admin flag is still resolving is what stops a
  // legitimate admin from being bounced home on a slow first paint.
  it("shows neither the route nor the redirect while the flag is loading", () => {
    renderGuardedRoute({ isAdmin: false, isLoading: true })

    expect(screen.queryByText("translation queue")).toBeNull()
    expect(screen.queryByText("home")).toBeNull()
  })
})
