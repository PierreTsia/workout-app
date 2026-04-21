import { useAtomValue } from "jotai"
import { Check, Dumbbell } from "lucide-react"
import { Link, Navigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { authAtom, authLoadingAtom } from "@/store/atoms"

const FEATURE_KEYS = [1, 2, 3, 4] as const

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"])
  const user = useAtomValue(authAtom)
  const authLoading = useAtomValue(authLoadingAtom)
  const [searchParams] = useSearchParams()
  const next = searchParams.get("next")

  if (!authLoading && user) {
    return <Navigate to={next ?? "/"} replace />
  }

  const handleGoogleSignIn = () => {
    sessionStorage.setItem("notification_prompt_after_oauth", "1")
    const redirectTo = next
      ? `${window.location.origin}${next}`
      : window.location.origin
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f0f13] text-white">
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#00c9a7]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-violet-500/5 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-4 py-10 md:gap-10 md:py-16 lg:flex-row lg:items-center lg:gap-16 lg:py-20">
        <section className="flex-1 text-center lg:mb-0 lg:text-left">
          <div className="mb-6 flex items-center justify-center gap-3 lg:justify-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00c9a7]/25 bg-[#00c9a7]/10">
              <Dumbbell className="h-7 w-7 text-[#00c9a7]" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {t("auth:appName")}
            </span>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {t("auth:marketingHeadline")}
          </h1>
          <p className="mx-auto mb-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg lg:mx-0">
            {t("auth:marketingSub")}
          </p>
          <ul className="mx-auto max-w-md flex flex-col gap-3 text-left sm:max-w-lg lg:mx-0 lg:max-w-lg">
            {FEATURE_KEYS.map((n) => (
              <li key={n} className="flex gap-3 text-[15px] leading-snug text-zinc-300 md:text-base">
                <Check
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#00c9a7]"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span>{t(`auth:feature${n}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto w-full max-w-md flex-1 lg:mx-0 lg:max-w-md">
          <Card className="border-white/10 bg-zinc-900/50 shadow-2xl backdrop-blur-md">
            <CardHeader className="gap-1 pb-2 text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-[#00c9a7]">
                {t("auth:cardEyebrow")}
              </p>
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0f0f13]">
                <Dumbbell className="h-8 w-8 text-[#00c9a7]" strokeWidth={2.5} />
              </div>
              <CardTitle className="text-2xl text-white">
                {t("auth:appName")}
              </CardTitle>
              <CardDescription className="text-base text-zinc-400">
                {t("auth:tagline")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pb-8">
              <Button
                size="lg"
                className="h-12 w-full bg-[#00c9a7] text-[#0f0f13] hover:bg-[#00b89a]"
                onClick={handleGoogleSignIn}
              >
                {t("auth:signInGoogle")}
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
                <Link
                  to="/about"
                  className="underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
                >
                  {t("common:about")}
                </Link>
                <span className="hidden sm:inline" aria-hidden>
                  ·
                </span>
                <Link
                  to="/privacy"
                  className="underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
                >
                  {t("common:privacy")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
