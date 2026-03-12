import { createBrowserRouter } from "react-router-dom"
import { AuthGuard } from "@/router/AuthGuard"
import { AppShell } from "@/components/AppShell"
import { LoginPage } from "@/pages/LoginPage"
import { WorkoutPage } from "@/pages/WorkoutPage"
import { HistoryPage } from "@/pages/HistoryPage"
import { BuilderPage } from "@/pages/BuilderPage"
import { AboutPage } from "@/pages/AboutPage"

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/about",
    element: <AboutPage />,
  },
  {
    element: <AuthGuard />,
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
        ],
      },
    ],
  },
])
