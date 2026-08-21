import { Suspense } from "react"
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
import { lazyWithRecover } from "@/lib/lazyWithRecover"

// `lazyWithRecover` wraps `React.lazy` with a single auto-reload on
// chunk-load failure (#356). The named-export → default-export adapter
// is unchanged; only the failure path is. Lazy routes nested under
// `AppShell` share the Suspense boundary mounted there; the handful of
// routes outside it (about, privacy, oauth consent) get an individual
// wrapper via `standalone()` below.
const HistoryPage = lazyWithRecover(() =>
  import("@/pages/HistoryPage").then((m) => ({ default: m.HistoryPage })),
)
const BuilderPage = lazyWithRecover(() =>
  import("@/pages/BuilderPage").then((m) => ({ default: m.BuilderPage })),
)
const AboutPage = lazyWithRecover(() =>
  import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })),
)
const AdminExercisesPage = lazyWithRecover(() =>
  import("@/pages/AdminExercisesPage").then((m) => ({
    default: m.AdminExercisesPage,
  })),
)
const AdminExerciseEditPage = lazyWithRecover(() =>
  import("@/pages/AdminExerciseEditPage").then((m) => ({
    default: m.AdminExerciseEditPage,
  })),
)
const LibraryProgramsPage = lazyWithRecover(() =>
  import("@/pages/library/LibraryProgramsPage").then((m) => ({
    default: m.LibraryProgramsPage,
  })),
)
const ExerciseLibraryPage = lazyWithRecover(() =>
  import("@/pages/library/ExerciseLibraryPage").then((m) => ({
    default: m.ExerciseLibraryPage,
  })),
)
const ExerciseLibraryExercisePage = lazyWithRecover(() =>
  import("@/pages/library/ExerciseLibraryExercisePage").then((m) => ({
    default: m.ExerciseLibraryExercisePage,
  })),
)
const CircuitCatalogPage = lazyWithRecover(() =>
  import("@/pages/library/CircuitCatalogPage").then((m) => ({
    default: m.CircuitCatalogPage,
  })),
)
const CircuitCatalogSeedPage = lazyWithRecover(() =>
  import("@/pages/library/CircuitCatalogSeedPage").then((m) => ({
    default: m.CircuitCatalogSeedPage,
  })),
)
const AdminFeedbackPage = lazyWithRecover(() =>
  import("@/pages/AdminFeedbackPage").then((m) => ({
    default: m.AdminFeedbackPage,
  })),
)
const AdminHomePage = lazyWithRecover(() =>
  import("@/pages/AdminHomePage").then((m) => ({ default: m.AdminHomePage })),
)
const AdminEnrichmentPage = lazyWithRecover(() =>
  import("@/pages/AdminEnrichmentPage").then((m) => ({
    default: m.AdminEnrichmentPage,
  })),
)
const AdminReviewPage = lazyWithRecover(() =>
  import("@/pages/AdminReviewPage").then((m) => ({
    default: m.AdminReviewPage,
  })),
)
const AdminTranslationsPage = lazyWithRecover(() =>
  import("@/pages/AdminTranslationsPage").then((m) => ({
    default: m.AdminTranslationsPage,
  })),
)
const CycleSummaryPage = lazyWithRecover(() =>
  import("@/pages/CycleSummaryPage").then((m) => ({
    default: m.CycleSummaryPage,
  })),
)
const AccountPage = lazyWithRecover(() =>
  import("@/pages/AccountPage").then((m) => ({ default: m.AccountPage })),
)
const AccountApiTokensPage = lazyWithRecover(() =>
  import("@/pages/AccountApiTokensPage").then((m) => ({
    default: m.AccountApiTokensPage,
  })),
)
const AchievementsPage = lazyWithRecover(() =>
  import("@/pages/AchievementsPage").then((m) => ({
    default: m.AchievementsPage,
  })),
)
const UnlockOverlayPlaygroundPage = lazyWithRecover(() =>
  import("@/pages/UnlockOverlayPlaygroundPage").then((m) => ({
    default: m.UnlockOverlayPlaygroundPage,
  })),
)
const ProfileChartsPlaygroundPage = lazyWithRecover(() =>
  import("@/pages/ProfileChartsPlaygroundPage").then((m) => ({
    default: m.ProfileChartsPlaygroundPage,
  })),
)
const PrivacyPage = lazyWithRecover(() =>
  import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
)
const OAuthConsentPage = lazyWithRecover(() =>
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
                  {
                    path: "circuits",
                    element: <CircuitCatalogPage />,
                  },
                  {
                    path: "circuits/:slug",
                    element: <CircuitCatalogSeedPage />,
                  },
                ],
              },
              {
                path: "/account",
                element: <AccountPage />,
              },
              {
                path: "/account/api-tokens",
                element: <AccountApiTokensPage />,
              },
              {
                path: "/achievements",
                element: <AchievementsPage />,
              },
              {
                path: "/_unlock-overlay",
                element: <UnlockOverlayPlaygroundPage />,
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
                    path: "/admin/translations",
                    element: <AdminTranslationsPage />,
                  },
                  {
                    path: "/admin/enrichment",
                    element: <AdminEnrichmentPage />,
                  },
                  {
                    path: "/admin/feedback",
                    element: <AdminFeedbackPage />,
                  },
                  {
                    path: "/_profile-charts",
                    element: <ProfileChartsPlaygroundPage />,
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
