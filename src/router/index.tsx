import { createBrowserRouter } from "react-router-dom"
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
import { LibraryPage } from "@/pages/LibraryPage"
import { AdminFeedbackPage } from "@/pages/AdminFeedbackPage"
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
                path: "/builder",
                element: <BuilderPage />,
              },
              {
                path: "/library",
                element: <LibraryPage />,
              },
              {
                element: <AdminGuard />,
                children: [
                  {
                    path: "/admin/exercises",
                    element: <AdminExercisesPage />,
                  },
                  {
                    path: "/admin/exercises/:id",
                    element: <AdminExerciseEditPage />,
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
