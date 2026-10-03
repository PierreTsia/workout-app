import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Check, Clipboard, MessagesSquare } from "lucide-react"
import { toast } from "sonner"
import { Button, Dialog, Textarea } from "@nomosui/react"
import { copyToClipboard } from "@/lib/clipboard"
import {
  buildReviewRequest,
  diffCorrection,
  readCorrection,
  type CorrectionResult,
  type DiffLine,
  type ReviewSubject,
} from "@/lib/reviewAssist"
import { SECTION_LABEL_KEYS } from "@/lib/translationReview"
import type { ExerciseInstructions } from "@/types/database"

interface ReviewAssistDialogProps {
  subject: ReviewSubject
  /**
   * Hands the accepted correction to the card, which records it through the
   * one mutation. This dialog deliberately owns no write: a second path to the
   * column would be a second place for the refused-write handling to be
   * forgotten.
   */
  onApply: (instructions: ExerciseInstructions) => void
  open: boolean
  /**
   * Reported to the card, which silences its own shortcuts while this is open:
   * a portal keeps the dialog out of the card's DOM subtree but not out of its
   * React tree, so a keystroke in the paste box still reaches the card's
   * `onKeyDown` and would otherwise be read as a verdict.
   */
  onOpenChange: (open: boolean) => void
  disabled: boolean
}

/**
 * One sentence of the diff. Unchanged text stays plain so the eye skips it;
 * anything else is boxed, and carries the verdict as text as well as colour —
 * "the red one" is not a description a screen reader can give.
 */
function DiffLineRow({ line }: { line: DiffLine }) {
  const { t } = useTranslation("admin")

  if (line.status === "unchanged") {
    return <p className="text-sm text-muted-foreground">{line.after}</p>
  }

  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
      <span className="sr-only">
        {t(`translations.assist.change.${line.status}`)}
      </span>
      {line.before !== null ? (
        <p className="text-destructive line-through decoration-destructive/60">
          {line.before}
        </p>
      ) : null}
      {line.after !== null ? (
        <p className="text-emerald-600 dark:text-emerald-400">{line.after}</p>
      ) : null}
    </div>
  )
}

/**
 * What the write would do to the stored English, before it is offered. The
 * unchanged sentences are shown too: a diff of only the changes hides whether
 * the assistant returned the whole block or a fragment of it, which is exactly
 * the thing the reviewer is here to notice.
 */
function CorrectionDiff({
  current,
  proposed,
}: {
  current: ExerciseInstructions | null
  proposed: ExerciseInstructions
}) {
  const { t } = useTranslation("admin")

  return (
    <ul
      aria-label={t("translations.assist.diffLabel")}
      className="flex flex-col gap-3"
    >
      {diffCorrection(current, proposed).map(({ section, lines }) => (
        <li key={section} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">
            {t(SECTION_LABEL_KEYS[section])}
          </h3>
          {lines.map((line) => (
            <DiffLineRow key={line.index} line={line} />
          ))}
        </li>
      ))}
    </ul>
  )
}

/**
 * Why the paste was refused, in terms of what to do about it. `role="alert"`
 * because the message appears in response to a click somewhere else on the
 * dialog and would otherwise go unannounced.
 */
function CorrectionRefusal({
  problem,
}: {
  problem: Extract<CorrectionResult, { ok: false }>
}) {
  const { t } = useTranslation("admin")
  const sections =
    problem.problem === "blanked"
      ? problem.sections.map((section) => t(SECTION_LABEL_KEYS[section])).join(", ")
      : ""

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {t(`translations.assist.problem.${problem.problem}`, { sections })}
    </p>
  )
}

export function ReviewAssistDialog({
  subject,
  onApply,
  open,
  onOpenChange,
  disabled,
}: ReviewAssistDialogProps) {
  const { t } = useTranslation("admin")
  // Derived, not stored: keeping it in state would let it go stale against the
  // row, and it is a pure string build over eight columns.
  const request = useMemo(() => buildReviewRequest(subject), [subject])
  const [pasted, setPasted] = useState("")
  // `null` is "not checked yet", which is not the same as "checked and fine":
  // the apply button only exists in the second case.
  const [result, setResult] = useState<CorrectionResult | null>(null)

  const copy = async () => {
    if (await copyToClipboard(request)) {
      toast.success(t("translations.assist.copied"))
      return
    }
    // Not a dead end: the text goes into the toast so a reviewer on an insecure
    // context can still select it by hand, the way the enrichment toolbar does
    // with its illustration prompts.
    toast.error(t("translations.assist.copyFailed"), {
      description: request,
      duration: 20000,
    })
  }

  // The core dialog owns its trigger and exposes no `disabled`, so the fieldset
  // carries the card's "verdict issued" lock: a disabled ancestor makes the
  // trigger inert without unmounting the modal, and a correction still in
  // flight keeps its diff on screen.
  const footer =
    result && result.ok ? (
      <Button className="gap-2" onClick={() => onApply(result.instructions)}>
        <Check className="h-4 w-4" />
        {t("translations.assist.apply")}
      </Button>
    ) : undefined

  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        trigger={
          <>
            <MessagesSquare className="h-4 w-4" />
            {t("translations.assist.open")}
          </>
        }
        title={t("translations.assist.title")}
        description={t("translations.assist.description")}
        closeLabel={t("common:close")}
        className="max-h-[85vh] max-w-3xl overflow-y-auto"
        body={
          <div className="flex flex-col gap-4">
            <Button variant="outline" className="gap-2 self-start" onClick={copy}>
              <Clipboard className="h-4 w-4" />
              {t("translations.assist.copy")}
            </Button>

            <div className="flex flex-col gap-2">
              <Textarea
                value={pasted}
                aria-label={t("translations.assist.pasteLabel")}
                placeholder={t("translations.assist.pastePlaceholder")}
                // Editing after a check invalidates it: leaving the old verdict on
                // screen would let the reviewer apply a diff of text that is no
                // longer in the box.
                onChange={(event) => {
                  setPasted(event.target.value)
                  setResult(null)
                }}
                rows={6}
                className="font-mono text-xs"
              />
              <Button
                variant="secondary"
                className="self-start"
                disabled={pasted.trim() === ""}
                onClick={() =>
                  setResult(readCorrection(pasted, subject.instructions))
                }
              >
                {t("translations.assist.check")}
              </Button>
            </div>

            {result === null ? null : result.ok ? (
              <CorrectionDiff
                current={subject.instructions_en}
                proposed={result.instructions}
              />
            ) : (
              <CorrectionRefusal problem={result} />
            )}
          </div>
        }
        footer={footer}
      />
    </fieldset>
  )
}
