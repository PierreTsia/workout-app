import { useAtomValue } from "jotai"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { authAtom, authLoadingAtom } from "@/store/atoms"

export function LoginPage() {
  const user = useAtomValue(authAtom)
  const authLoading = useAtomValue(authLoadingAtom)

  if (!authLoading && user) {
    return <Navigate to="/" replace />
  }

  const handleGoogleSignIn = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-4"
      style={{ background: "#0f0f13" }}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl">🏋️</span>
        <h1 className="text-4xl font-bold text-white">Workout</h1>
        <p className="text-muted-foreground">Track your progress</p>
      </div>
      <Button size="lg" onClick={handleGoogleSignIn}>
        Sign in with Google
      </Button>
    </div>
  )
}
