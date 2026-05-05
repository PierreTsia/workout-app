import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, KeyRound, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CreatePATDialog } from "@/components/account/CreatePATDialog"
import { RevokePATDialog } from "@/components/account/RevokePATDialog"
import { PATListItem } from "@/components/account/PATListItem"
import { usePersonalAccessTokens } from "@/hooks/usePersonalAccessTokens"
import { publicSite } from "@/lib/publicSite"
import type { PersonalAccessToken } from "@/types/personalAccessToken"

// Mirror of `PAT_QUOTA` in supabase/functions/create-pat/createPatLogic.ts.
// Kept as a literal here to avoid importing Deno-flavored modules into the
// browser bundle. If you change one, change the other.
const PAT_QUOTA = 10

export function AccountApiTokensPage() {
  const { t } = useTranslation(["api-tokens", "common"])
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<PersonalAccessToken | null>(
    null,
  )

  const { data: tokens, isLoading, isError, refetch } = usePersonalAccessTokens()

  const used = tokens?.length ?? 0
  const quotaReached = used >= PAT_QUOTA

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("api-tokens:back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{t("api-tokens:title")}</h1>
      </div>

      <p className="text-sm text-muted-foreground">{t("api-tokens:subtitle")}</p>
      <p className="-mt-3 text-xs text-muted-foreground">
        <a
          href={publicSite.connectClaude}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {t("api-tokens:connectClaudeHint")}
        </a>
      </p>

      <section
        className="rounded-xl border border-border bg-card p-4"
        aria-labelledby="api-tokens-list-heading"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2
              id="api-tokens-list-heading"
              className="text-sm font-semibold text-foreground"
            >
              {t("api-tokens:title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("api-tokens:quotaHint", { used, max: PAT_QUOTA })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={quotaReached}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("api-tokens:createCta")}
          </Button>
        </div>

        {quotaReached ? (
          <div className="mb-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
            {t("api-tokens:quotaReached", { max: PAT_QUOTA })}
          </div>
        ) : null}

        {isLoading ? (
          <ul className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-20 animate-pulse rounded-lg border border-border bg-muted/40"
              />
            ))}
          </ul>
        ) : isError ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              {t("api-tokens:loadError")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              {t("api-tokens:retry")}
            </Button>
          </div>
        ) : !tokens || tokens.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-8 text-center">
            <KeyRound className="h-6 w-6 text-muted-foreground" />
            <div className="flex flex-col gap-1 px-4">
              <p className="text-sm font-medium text-foreground">
                {t("api-tokens:empty")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("api-tokens:emptyHint")}
              </p>
              <p className="text-xs text-muted-foreground">
                <a
                  href={publicSite.connectClaude}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {t("api-tokens:connectClaudeHint")}
                </a>
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("api-tokens:createCta")}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tokens.map((token) => (
              <PATListItem
                key={token.id}
                token={token}
                onRevoke={setRevokeTarget}
              />
            ))}
          </ul>
        )}
      </section>

      <CreatePATDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <RevokePATDialog
        token={revokeTarget}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  )
}
