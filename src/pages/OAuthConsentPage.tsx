import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Dumbbell, Loader2, ShieldCheck, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface AuthorizationDetails {
  authorization_id: string
  application?: { name?: string; icon_uri?: string }
  scope?: string
}

const SCOPE_LABELS: Record<string, { en: string; fr: string }> = {
  openid: { en: "Verify your identity", fr: "Vérifier votre identité" },
  email: { en: "View your email address", fr: "Voir votre adresse e-mail" },
  profile: { en: "View your profile info", fr: "Voir vos informations de profil" },
}

export function OAuthConsentPage() {
  const { t, i18n } = useTranslation("common")
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const authorizationId = searchParams.get("authorization_id")

  const [details, setDetails] = useState<AuthorizationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      if (!authorizationId) {
        setError(t("oauthConsentMissingId"))
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        navigate(`/login`, { replace: true })
        return
      }

      const { data, error: err } = await (supabase.auth as any).oauth.getAuthorizationDetails(authorizationId)

      if (err || !data) {
        setError(err?.message ?? t("oauthConsentError"))
        setLoading(false)
        return
      }

      if ("redirect_to" in data) {
        window.location.href = data.redirect_to
        return
      }

      setDetails(data as AuthorizationDetails)
      setLoading(false)
    }

    load()
  }, [authorizationId, navigate, t])

  const handleApprove = useCallback(async () => {
    if (!authorizationId) return
    setSubmitting(true)

    const { data, error: err } = await (supabase.auth as any).oauth.approveAuthorization(authorizationId)

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    if (data?.redirect_to) {
      window.location.href = data.redirect_to
    }
  }, [authorizationId])

  const handleDeny = useCallback(async () => {
    if (!authorizationId) return
    setSubmitting(true)

    const { data, error: err } = await (supabase.auth as any).oauth.denyAuthorization(authorizationId)

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    if (data?.redirect_to) {
      window.location.href = data.redirect_to
    }
  }, [authorizationId])

  const lang = i18n.language.startsWith("fr") ? "fr" : "en"
  const clientName = details?.application?.name ?? "Unknown app"
  const scopes = details?.scope?.split(" ").filter(Boolean) ?? []

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f0f13] text-white">
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#00c9a7]/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00c9a7]/25 bg-[#00c9a7]/10">
            <Dumbbell className="h-7 w-7 text-[#00c9a7]" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold tracking-tight">GymLogic</span>
        </div>

        <Card className="w-full border-white/10 bg-zinc-900/50 shadow-2xl backdrop-blur-md">
          {loading ? (
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#00c9a7]" />
              <p className="text-sm text-zinc-400">{t("oauthConsentLoading")}</p>
            </CardContent>
          ) : error ? (
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <XCircle className="h-10 w-10 text-red-400" />
              <p className="text-center text-sm text-zinc-400">{error}</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00c9a7]/20 bg-[#00c9a7]/10">
                  <ShieldCheck className="h-7 w-7 text-[#00c9a7]" />
                </div>
                <CardTitle className="text-xl text-white">
                  {t("oauthConsentTitle")}
                </CardTitle>
                <CardDescription className="text-base text-zinc-400">
                  {t("oauthConsentDescription", { clientName })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pb-8">
                {scopes.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-300">
                      {t("oauthConsentScopesLabel")}
                    </p>
                    <ul className="space-y-1.5">
                      {scopes.map((scope) => (
                        <li
                          key={scope}
                          className="flex items-center gap-2 text-sm text-zinc-400"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00c9a7]" />
                          {SCOPE_LABELS[scope]?.[lang] ?? scope}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="h-12 w-full bg-[#00c9a7] text-[#0f0f13] hover:bg-[#00b89a]"
                    onClick={handleApprove}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("oauthConsentApprove")}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full border-white/10 text-zinc-300 hover:bg-white/5"
                    onClick={handleDeny}
                    disabled={submitting}
                  >
                    {t("oauthConsentDeny")}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
