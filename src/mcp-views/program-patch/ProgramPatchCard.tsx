import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  Heading,
  Kicker,
  Text,
} from '@nomosui/react'

import { panel, type ViewTheme } from '../styles'
import type {
  PatchCircuitExercise,
  PatchSoloExercise,
  PatchWarning,
  ProgramPatchLabels,
  ProgramPatchPayload,
  ProgramPatchViewState,
} from './types'

const plural = (one: string, other: string, n: number): string =>
  (n === 1 ? one : other).replace('{{count}}', String(n))

function warningText(warning: PatchWarning, labels: ProgramPatchLabels): string {
  return warning.kind === 'active_cycle'
    ? labels.warnActiveCycle.replace('{{date}}', warning.date)
    : labels.warnSlotDetachment.replace('{{exercise}}', warning.exercise)
}

function prescription(ex: PatchSoloExercise, labels: ProgramPatchLabels): string {
  const parts: string[] = []
  if (ex.targetDurationSeconds != null) parts.push(`${ex.sets} × ${ex.targetDurationSeconds}s`)
  else parts.push(`${ex.sets} × ${ex.reps} ${labels.reps}`)
  if (ex.weightKg > 0) parts.push(`${ex.weightKg} kg`)
  parts.push(`${labels.rest} ${ex.restSeconds} s`)
  return parts.join(' · ')
}

function changeNote(ex: PatchSoloExercise, labels: ProgramPatchLabels): string | null {
  if (!ex.change || ex.change.length === 0) return null
  const byField = {
    sets: labels.changedSets,
    reps: labels.changedReps,
    weight: labels.changedWeight,
    rest: labels.changedRest,
  } as const
  return ex.change.map((field) => byField[field]).join(' · ')
}

function circuitLine(ex: PatchCircuitExercise, labels: ProgramPatchLabels): string {
  if (ex.mode === 'amrap') {
    const capMinutes = ex.capSeconds ? Math.round(ex.capSeconds / 60) : 20
    return `AMRAP ${capMinutes} min · ${labels.amrapGloss}`
  }
  return (ex.rounds === 1 ? labels.roundsOne : labels.roundsOther).replace(
    '{{count}}',
    String(ex.rounds),
  )
}

/**
 * The **Decision Card** (ADR 0028/0031): an `update_program` preview the athlete approves in
 * the conversation. It renders the structured program (days, exercises, changed fields) from
 * `structuredContent`, and a single **Apply** button; it never writes — the button asks the
 * host to call `apply_program_patch`.
 */
export function ProgramPatchCard({
  payload,
  labels,
  state,
  onApply,
  theme = 'dark',
}: {
  payload: ProgramPatchPayload
  labels: ProgramPatchLabels
  state: ProgramPatchViewState
  onApply: () => void
  theme?: ViewTheme
}) {
  const removed = payload.removed_days ?? []
  const added = payload.added_days ?? []
  const warnings = payload.warning_details?.length
    ? payload.warning_details.map((warning) => warningText(warning, labels))
    : payload.warnings ?? []
  const program = payload.program
  const applied = state === 'applied' || payload.status === 'applied'

  return (
    <div data-theme={theme} data-density="comfortable" style={panel}>
      <Card>
        <CardContent>
          <Kicker>{labels.title}</Kicker>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <Heading level={3}>{program?.name ?? labels.title}</Heading>
            <Badge variant={applied ? 'secondary' : 'outline'}>
              {applied ? labels.applied : labels.statusPreview}
            </Badge>
          </div>

          {state === 'error' ? (
            <Text size="caption" className="text-muted-foreground" style={{ marginTop: 8 }}>
              {labels.error}
            </Text>
          ) : applied ? (
            <Text size="caption" className="text-muted-foreground" style={{ marginTop: 8 }}>
              {payload.message ?? ''}
            </Text>
          ) : (
            <>
              {removed.length > 0 || added.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {removed.length > 0 ? (
                    <Chip tone="danger">
                      {plural(labels.removedOne, labels.removedOther, removed.length)}
                    </Chip>
                  ) : null}
                  {added.length > 0 ? (
                    <Chip tone="success">
                      {plural(labels.addedOne, labels.addedOther, added.length)}
                    </Chip>
                  ) : null}
                </div>
              ) : null}

              <Text size="caption" className="text-muted-foreground" style={{ marginTop: 8 }}>
                {labels.consentNote}
              </Text>

              {warnings.map((warning, index) => (
                <div key={index} style={{ marginTop: 8 }}>
                  <Alert tone="warning" title={warning} />
                </div>
              ))}

              {program ? (
                <div>
                  {program.days.map((day, dayIndex) => (
                    <div key={dayIndex} style={{ marginTop: 14 }}>
                      <Kicker>{`${day.emoji} ${day.label}`}</Kicker>
                      <ul
                        style={{
                          listStyle: 'none',
                          margin: 0,
                          padding: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {day.exercises.map((ex, exIndex) => {
                          const note = ex.kind === 'solo' ? changeNote(ex, labels) : null
                          return (
                            <li key={exIndex}>
                              <Text as="span" style={{ fontWeight: 600 }}>
                                {ex.kind === 'solo' ? ex.name : ex.label || labels.circuit}
                              </Text>
                              <Text
                                size="caption"
                                className="text-muted-foreground"
                                style={{ display: 'block', marginTop: 2 }}
                              >
                                {ex.kind === 'solo'
                                  ? prescription(ex, labels)
                                  : `${circuitLine(ex, labels)} · ${plural(
                                      labels.circuitExercisesOne,
                                      labels.circuitExercisesOther,
                                      ex.exerciseCount,
                                    )}`}
                              </Text>
                              {note ? (
                                <Text
                                  size="caption"
                                  className="text-muted-foreground"
                                  style={{ display: 'block' }}
                                >
                                  {note}
                                </Text>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : payload.rendered ? (
                <pre
                  style={{
                    margin: '10px 0 0',
                    padding: 10,
                    borderRadius: 8,
                    overflowX: 'auto',
                    fontSize: 12,
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    background: 'color-mix(in srgb, currentColor 6%, transparent)',
                  }}
                >
                  {payload.rendered}
                </pre>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <Button
                  type="button"
                  onClick={onApply}
                  disabled={state === 'applying' || !payload.preview_token}
                >
                  {state === 'applying' ? labels.applying : labels.apply}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
