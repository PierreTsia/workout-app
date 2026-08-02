import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/formatters"
import {
  buildReviewSections,
  orphanObjections,
  type ReviewLine,
  type ReviewObjection,
} from "@/lib/translationReview"
import type { InstructionSection } from "@/lib/instructionQuality"
import type { TranslationReviewRow } from "@/hooks/useTranslationReviewQueue"

const SECTION_KEYS: Record<InstructionSection, string> = {
  setup: "translations.sections.setup",
  movement: "translations.sections.movement",
  breathing: "translations.sections.breathing",
  common_mistakes: "translations.sections.commonMistakes",
}

const STATUS_VARIANT: Record<string, "secondary" | "destructive" | "default"> = {
  clean: "secondary",
  flagged: "destructive",
  approved: "default",
}

interface TranslationReviewCardProps {
  row: TranslationReviewRow
}

function ObjectionBadge({ objection }: { objection: ReviewObjection }) {
  return (
    <Badge
      variant="outline"
      className="max-w-full items-start gap-1.5 whitespace-normal border-destructive/40 bg-destructive/10 py-1 text-left text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="min-w-0">
        <span className="font-semibold">{objection.verdict}</span>
        {objection.note ? <> — {objection.note}</> : null}
      </span>
    </Badge>
  )
}

/**
 * One aligned pair. The objections belong inside the row rather than above the
 * section: a reviewer arbitrating "hip-width" needs to be looking at the
 * sentence that says it, not counting down from a heading.
 */
function SentencePair({
  line,
  missingLabel,
}: {
  line: ReviewLine
  missingLabel: string
}) {
  return (
    <li className="grid gap-2 border-t border-border/40 py-2 first:border-t-0 sm:grid-cols-2 sm:gap-4">
      <p className="text-sm text-muted-foreground">
        {line.fr ?? <em className="opacity-60">{missingLabel}</em>}
      </p>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm">
          {line.en ?? <em className="opacity-60">{missingLabel}</em>}
        </p>
        {line.objections.map((objection, i) => (
          <ObjectionBadge key={`${objection.verdict}-${i}`} objection={objection} />
        ))}
      </div>
    </li>
  )
}

export function TranslationReviewCard({ row }: TranslationReviewCardProps) {
  const { t, i18n } = useTranslation("admin")

  const audit = row.instructions_en_audit
  const objections = audit?.objections ?? []
  const sections = buildReviewSections(
    row.instructions,
    row.instructions_en,
    objections,
  )
  const orphans = orphanObjections(sections, objections)
  const status = row.instructions_en_status ?? "unknown"
  const missingLabel = t("translations.missingSentence")

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">{row.name}</h2>
          {row.name_en ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{row.name_en}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
            {t(`translations.status.${status}`, {
              defaultValue: t("translations.status.unknown"),
            })}
          </Badge>
          <Badge variant="outline" className="tabular-nums text-muted-foreground">
            {t("translations.loggedSets", { count: row.logged_sets })}
          </Badge>
        </div>
      </header>

      {audit ? (
        <section className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            {t("translations.audit.line", {
              model: audit.model,
              checker:
                audit.checker_model ?? t("translations.audit.checkerUnavailable"),
              version: audit.prompt_version,
              date: formatDate(audit.translated_at, i18n.language, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
          {audit.gate_flags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium">
                {t("translations.gateFlags")}
              </span>
              {audit.gate_flags.map((flag) => (
                <Badge
                  key={flag}
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                >
                  {flag}
                </Badge>
              ))}
            </div>
          ) : null}
          {orphans.length > 0 ? (
            <p className="text-xs text-destructive">
              {t("translations.orphanObjections", { count: orphans.length })}
            </p>
          ) : null}
        </section>
      ) : null}

      {sections.map(({ section, lines }) => (
        <section key={section} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{t(SECTION_KEYS[section])}</h3>
          <div className="grid gap-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid-cols-2 sm:gap-4">
            <span>{t("translations.frenchHeading")}</span>
            <span>{t("translations.englishHeading")}</span>
          </div>
          <ul className="flex flex-col">
            {lines.map((line) => (
              <SentencePair
                key={line.index}
                line={line}
                missingLabel={missingLabel}
              />
            ))}
          </ul>
        </section>
      ))}
    </article>
  )
}
