import { useTranslation } from "react-i18next"
import {
  deviationReasonKey,
  type DebriefAdjustment,
} from "@/lib/deviationCapture"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"

export type { DebriefAdjustment }

interface SessionAdjustmentsProps {
  adjustments: DebriefAdjustment[]
}

/** S3 debrief section (T267) — reads the captured deviations, never writes. */
export function SessionAdjustments({ adjustments }: SessionAdjustmentsProps) {
  const { t } = useTranslation("workout")
  const { exerciseName } = useCatalogLabels()

  return (
    <div className="w-full max-w-xs">
      <h3 className="mb-3 text-center text-sm font-semibold">
        {t("deviation.debriefTitle")}
      </h3>

      {adjustments.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {t("deviation.debriefEmpty")}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-xl bg-card">
          {adjustments.map((adjustment) => {
            const showWeight =
              adjustment.weightChanged || !adjustment.repsChanged
            return (
              <div key={adjustment.id} className="flex flex-col gap-1 p-3">
                <span className="text-sm font-medium">
                  {exerciseName({
                    exercise: adjustment.catalogExercise,
                    name_snapshot: adjustment.exerciseNameSnapshot,
                  })}
                </span>
                {showWeight && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t("deviation.setInfo", {
                      setNumber: adjustment.setNumber ?? 0,
                      prescribed: adjustment.prescribed,
                      actual: adjustment.actual,
                      unit: adjustment.unit,
                    })}
                  </span>
                )}
                {adjustment.repsChanged && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t("deviation.setInfoReps", {
                      prescribed: adjustment.prescribedReps,
                      actual: adjustment.actualReps,
                    })}
                  </span>
                )}
                <span className="inline-flex w-fit items-center rounded-lg bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {t(deviationReasonKey(adjustment.reasonCode))}
                </span>
                {adjustment.note && (
                  <span className="text-xs italic text-muted-foreground">
                    {adjustment.note}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
