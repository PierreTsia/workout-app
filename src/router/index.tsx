import { createBrowserRouter, Navigate } from "react-router-dom"
import { AuthGuard } from "@/router/AuthGuard"
import { OnboardingGuard } from "@/router/OnboardingGuard"
import { AdminGuard } from "@/router/AdminGuard"
import { AppShell } from "@/components/AppShell"
import { LoginPage } from "@/pages/LoginPage"
import { WorkoutPage } from "@/pages/WorkoutPage"
import { HistoryPage } from "@/pages/HistoryPage"
import { BuilderPage } from "@/pages/BuilderPage"
import { AboutPage } from "@/pages/AboutPage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { AdminExercisesPage } from "@/pages/AdminExercisesPage"
import { AdminExerciseEditPage } from "@/pages/AdminExerciseEditPage"
import { LibraryLayout } from "@/pages/library/LibraryLayout"
import { LibraryProgramsPage } from "@/pages/library/LibraryProgramsPage"
import { ExerciseLibraryPage } from "@/pages/library/ExerciseLibraryPage"
import { ExerciseLibraryExercisePage } from "@/pages/library/ExerciseLibraryExercisePage"
import { CreateProgramPage } from "@/pages/CreateProgramPage"
import { AdminFeedbackPage } from "@/pages/AdminFeedbackPage"
import { AdminHomePage } from "@/pages/AdminHomePage"
import { AdminEnrichmentPage } from "@/pages/AdminEnrichmentPage"
import { CycleSummaryPage } from "@/pages/CycleSummaryPage"
import { AccountPage } from "@/pages/AccountPage"
import { PrivacyPage } from "@/pages/PrivacyPage"
import { RouteErrorFallback } from "@/components/RouteErrorFallback"

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/about",
    element: <AboutPage />,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/privacy",
    element: <PrivacyPage />,
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
