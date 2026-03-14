import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAtomValue, useSetAtom } from "jotai"
import { Dumbbell, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import {
  authAtom,
  hasProgramAtom,
  activeProgramIdAtom,
} from "@/store/atoms"
import { Button } from "@/components/ui/button"

export function OnboardingPage() {
  const { t } = useTranslation("onboarding")
  const user = useAtomValue(authAtom)
  const hasProgram = useAtomValue(hasProgramAtom)
  const setHasProgram = useSetAtom(hasProgramAtom)
  const setActiveProgramId = useSetAtom(activeProgramIdAtom)
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  if (hasProgram) return <Navigate to="/" replace />

  async function handleGetStarted() {
    if (!user) return
    setCreating(true)
    try {
      const { data, error } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name: "My Program",
          template_id: null,
          is_active: true,
        })
        .select("id")
        .single()

      if (error) throw error

      setHasProgram(true)
      setActiveProgramId(data.id)
      navigate("/builder", { replace: true })
    } catch (err) {
      console.error("[Onboarding] Failed to create program:", err)
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Dumbbell className="h-16 w-16 text-primary" />
      <h1 className="text-2xl font-bold">{t("welcomeTitle")}</h1>
      <p className="max-w-sm text-muted-foreground">
        {t("welcomeDescription")}
      </p>
      <Button
        size="lg"
        className="gap-2"
        onClick={handleGetStarted}
        disabled={creating}
      >
        {creating && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("getStarted")}
      </Button>
    </div>
  )
}
