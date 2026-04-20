/* eslint-disable react-refresh/only-export-components --
 * This file only exports `router` (config), not components. The local
 * `lazy(...)` consts trip the rule, but there is no fast-refresh surface
 * to break here. */
import { lazy, Suspense } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import { AuthGuard } from "@/router/AuthGuard"
import { OnboardingGuard } from "@/router/OnboardingGuard"
import { AdminGuard } from "@/router/AdminGuard"
import { AppShell } from "@/components/AppShell"
import { LoginPage } from "@/pages/LoginPage"
import { WorkoutPage } from "@/pages/WorkoutPage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { LibraryLayout } from "@/pages/library/LibraryLayout"
import { CreateProgramPage } from "@/pages/CreateProgramPage"
import { RouteErrorFallback } from "@/components/RouteErrorFallback"
import { RouteSkeleton } from "@/components/RouteSkeleton"

// Named-export → default-export adapter for `React.lazy`. All page files
// in this repo use named exports, so every dynamic import is translated
// into a `{ default: ... }` shape. Lazy routes nested under `AppShell`
// share the Suspense boundary mounted in `AppShell`; the handful of
// routes outside it (about, privacy, oauth consent) get an individual
// wrapper via `standalone()` below.
const HistoryPage = lazy(() =>
  import("@/pages/HistoryPage").then((m) => ({ default: m.HistoryPage })),
)
const BuilderPage = lazy(() =>
  import("@/pages/BuilderPage").then((m) => ({ default: m.BuilderPage })),
)
const AboutPage = lazy(() =>
  import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })),
)
const AdminExercisesPage = lazy(() =>
  import("@/pages/AdminExercisesPage").then((m) => ({
    default: m.AdminExercisesPage,
  })),
)
const AdminExerciseEditPage = lazy(() =>
  import("@/pages/AdminExerciseEditPage").then((m) => ({
    default: m.AdminExerciseEditPage,
  })),
)
const LibraryProgramsPage = lazy(() =>
  import("@/pages/library/LibraryProgramsPage").then((m) => ({
    default: m.LibraryProgramsPage,
  })),
)
const ExerciseLibraryPage = lazy(() =>
  import("@/pages/library/ExerciseLibraryPage").then((m) => ({
    default: m.ExerciseLibraryPage,
  })),
)
const ExerciseLibraryExercisePage = lazy(() =>
  import("@/pages/library/ExerciseLibraryExercisePage").then((m) => ({
    default: m.ExerciseLibraryExercisePage,
  })),
)
const AdminFeedbackPage = lazy(() =>
  import("@/pages/AdminFeedbackPage").then((m) => ({
    default: m.AdminFeedbackPage,
  })),
)
const AdminHomePage = lazy(() =>
  import("@/pages/AdminHomePage").then((m) => ({ default: m.AdminHomePage })),
)
const AdminEnrichmentPage = lazy(() =>
  import("@/pages/AdminEnrichmentPage").then((m) => ({
    default: m.AdminEnrichmentPage,
  })),
)
const AdminReviewPage = lazy(() =>
  import("@/pages/AdminReviewPage").then((m) => ({
    default: m.AdminReviewPage,
  })),
)
const CycleSummaryPage = lazy(() =>
  import("@/pages/CycleSummaryPage").then((m) => ({
    default: m.CycleSummaryPage,
  })),
)
const AccountPage = lazy(() =>
  import("@/pages/AccountPage").then((m) => ({ default: m.AccountPage })),
)
const AchievementsPage = lazy(() =>
  import("@/pages/AchievementsPage").then((m) => ({
    default: m.AchievementsPage,
  })),
)
const PrivacyPage = lazy(() =>
  import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
)
const OAuthConsentPage = lazy(() =>
  import("@/pages/OAuthConsentPage").then((m) => ({
    default: m.OAuthConsentPage,
  })),
)

const standalone = (element: React.ReactNode) => (
  <Suspense fallback={<RouteSkeleton />}>{element}</Suspense>
)

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/about",
    element: standalone(<AboutPage />),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/privacy",
    element: standalone(<PrivacyPage />),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/oauth/consent",
    element: standalone(<OAuthConsentPage />),
    errorElement: <RouteErrorFallback />,
  },
  {
    element: <AuthGuard />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        path: "/onboarding",
        element: <OnboardingPage />,
      },
      {
        element: <OnboardingGuard />,
        children: [
          {
            path: "/create-program",
            element: <CreateProgramPage />,
          },
          {
            element: <AppShell />,
            children: [
              {
                path: "/",
                element: <WorkoutPage />,
              },
              {
                path: "/history",
                element: <HistoryPage />,
              },
              {
                path: "/builder/:programId",
                element: <BuilderPage />,
              },
              {
                path: "/library",
                element: <LibraryLayout />,
                children: [
                  {
                    index: true,
                    element: <Navigate to="programs" replace />,
                  },
                  {
                    path: "programs",
                    element: <LibraryProgramsPage />,
                  },
                  {
                    path: "exercises",
                    element: <ExerciseLibraryPage />,
                  },
                  {
                    path: "exercises/:exerciseId",
                    element: <ExerciseLibraryExercisePage />,
                  },
                ],
              },
              {
                path: "/account",
                element: <AccountPage />,
              },
              {
                path: "/achievements",
                element: <AchievementsPage />,
              },
              {
                path: "/cycle-summary/:cycleId",
                element: <CycleSummaryPage />,
              },
              {
                element: <AdminGuard />,
                children: [
                  {
                    path: "/admin",
                    element: <AdminHomePage />,
                  },
                  {
                    path: "/admin/exercises",
                    element: <AdminExercisesPage />,
                  },
                  {
                    path: "/admin/exercises/:id",
                    element: <AdminExerciseEditPage />,
                  },
                  {
                    path: "/admin/review",
                    element: <AdminReviewPage />,
                  },
                  {
                    path: "/admin/enrichment",
                    element: <AdminEnrichmentPage />,
                  },
                  {
                    path: "/admin/feedback",
                    element: <AdminFeedbackPage />,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
