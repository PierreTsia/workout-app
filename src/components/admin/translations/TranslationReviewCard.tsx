import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Check, Pencil, SkipForward, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  useApproveTranslation,
  type TranslationVerdict,
} from "@/hooks/useApproveTranslation"
import { formatDate } from "@/lib/formatters"
import {
  buildReviewSections,
  fromInstructionDraft,
  orphanObjections,
  toInstructionDraft,
  type InstructionDraft,
  type ReviewLine,
  type ReviewObjection,
} from "@/lib/translationReview"
import type { InstructionSection } from "@/lib/instructionQuality"
import type { ExerciseInstructions } from "@/types/database"
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
  /** Move to the next row without recording a verdict. */
  onSkip: () => void
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
 * Whether the event came from somewhere the reviewer is composing text. Checked
 * on the event target rather than on the editing flag: the flag says a textarea
 * exists, this says the keystroke landed in one.
 */
const isTypingTarget = (target: EventTarget): boolean =>
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLInputElement ||
  (target instanceof HTMLElement && target.isContentEditable)

/**
 * The key hint on a button. `aria-hidden` because the shortcut is already
 * spelled out on the card's own label, and a screen reader announcing
 * "Approve A" reads as a typo.
 */
function Shortcut({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden
      className="rounded border border-current/30 px-1 text-[10px] font-semibold opacity-70"
    >
      {children}
    </kbd>
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

export function TranslationReviewCard({
  row,
  onSkip,
}: TranslationReviewCardProps) {
  const { t, i18n } = useTranslation("admin")
  const decide = useApproveTranslation()
  const cardRef = useRef<HTMLElement>(null)
  // `null` means "not editing". Holding the draft and the mode in one value
  // makes the impossible state — editing with no draft — unrepresentable.
  const [draft, setDraft] = useState<InstructionDraft | null>(null)

  // The shortcuts are local `onKeyDown` handlers, so they only fire while focus
  // is inside the card — and taking focus on mount is what makes the keyboard
  // path work on arrival instead of after a click. The page remounts this
  // component per row, so each new row re-arms it.
  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  /**
   * Every decision reports the same way, and the toast names the exercise: the
   * queue has already moved on by the time it appears, so "saved" alone would
   * be ambiguous about which row it saved.
   */
  const record = (
    status: TranslationVerdict,
    instructionsEn?: ExerciseInstructions,
  ) => {
    // A held key repeats. The queue only rebuilds once the write lands, so
    // without this the reviewer decides the same row twice — and the second
    // verdict could be one they meant for the row they expected to see next.
    if (decide.isPending) return

    decide.mutate(
      {
        exerciseId: row.id,
        status,
        ...(instructionsEn ? { instructionsEn } : {}),
      },
      {
        onSuccess: () =>
          toast.success(
            t(`translations.toast.${status}`, { name: row.name }),
          ),
        onError: () => toast.error(t("translations.toast.error")),
      },
    )
  }

  const approve = () =>
    record("approved", draft ? fromInstructionDraft(draft) : undefined)

  const revert = () => record("flagged")

  const toggleEditing = () =>
    setDraft((current) =>
      current ? null : toInstructionDraft(row.instructions_en),
    )

  /**
   * `A` / `E` / `R` / `→`, normalized so a held shift still triggers them while
   * named keys keep their casing. No global shortcut hook exists in this repo
   * and this card does not invent one.
   */
  const shortcuts: Record<string, () => void> = {
    a: approve,
    e: toggleEditing,
    r: revert,
    ArrowRight: onSkip,
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    // A letter typed into a textarea is a correction, not a verdict. Without
    // this the first word of any edit would approve the row and move on.
    if (isTypingTarget(event.target)) return

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const action = shortcuts[key]
    if (!action) return
    event.preventDefault()
    action()
  }

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
    <article
      ref={cardRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      aria-label={t("translations.cardLabel", { name: row.name })}
      className="flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
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
          {draft ? (
            <Textarea
              value={draft[section]}
              aria-label={t("translations.editSection", {
                section: t(SECTION_KEYS[section]),
              })}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, [section]: event.target.value } : current,
                )
              }
              rows={Math.max(lines.length, 2)}
              className="mt-1 font-mono text-xs"
            />
          ) : null}
        </section>
      ))}

      <footer className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="gap-2"
          disabled={decide.isPending}
          onClick={approve}
        >
          <Check className="h-4 w-4" />
          {t("translations.approve")}
          <Shortcut>A</Shortcut>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={toggleEditing}
        >
          <Pencil className="h-4 w-4" />
          {t(draft ? "translations.cancelEdit" : "translations.edit")}
          <Shortcut>E</Shortcut>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={decide.isPending}
          onClick={revert}
        >
          <Undo2 className="h-4 w-4" />
          {t("translations.revert")}
          <Shortcut>R</Shortcut>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 text-muted-foreground"
          onClick={onSkip}
        >
          <SkipForward className="h-4 w-4" />
          {t("translations.skip")}
          <Shortcut>→</Shortcut>
        </Button>
      </footer>
    </article>
  )
}
