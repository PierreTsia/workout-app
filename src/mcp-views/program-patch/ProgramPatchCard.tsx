import { Badge, Button, Card, CardContent } from '@nomosui/react'

import type {
  ProgramPatchLabels,
  ProgramPatchPayload,
  ProgramPatchViewState,
} from './types'

const panel = {
  width: '100%',
  maxWidth: 520,
  margin: '0 auto',
  padding: 12,
  boxSizing: 'border-box' as const,
}

const muted = { opacity: 0.7 } as const

const plural = (one: string, other: string, n: number): string =>
  (n === 1 ? one : other).replace('{{count}}', String(n))

/**
 * The **Decision Card** (ADR 0028): an `update_program` preview the athlete approves in the
 * conversation. It renders the change and a single **Apply** button; it never writes — the
 * button asks the host to call `apply_program_patch`.
 */
export function ProgramPatchCard({
  payload,
  labels,
  state,
  onApply,
}: {
  payload: ProgramPatchPayload
  labels: ProgramPatchLabels
  state: ProgramPatchViewState
  onApply: () => void
}) {
  const removed = payload.removed_days ?? []
  const added = payload.added_days ?? []
  const warnings = payload.warnings ?? []
  const applied = state === 'applied' || payload.status === 'applied'

  return (
    <div data-theme="dark" data-density="comfortable" style={panel}>
      <Card>
        <CardContent>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{labels.title}</span>
            {applied ? <Badge>{labels.applied}</Badge> : null}
          </div>

          {state === 'error' ? (
            <p style={{ margin: '8px 0 0', fontSize: 13, ...muted }}>{labels.error}</p>
          ) : applied ? (
            <p style={{ margin: '8px 0 0', fontSize: 13, ...muted }}>{payload.message ?? ''}</p>
          ) : (
            <>
              {removed.length > 0 || added.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {removed.length > 0 ? (
                    <Badge variant="destructive">
                      {plural(labels.removedOne, labels.removedOther, removed.length)}
                    </Badge>
                  ) : null}
                  {added.length > 0 ? (
                    <Badge variant="secondary">
                      {plural(labels.addedOne, labels.addedOther, added.length)}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {warnings.map((warning, index) => (
                <p key={index} style={{ margin: '8px 0 0', fontSize: 12, ...muted }}>
                  {warning}
                </p>
              ))}

              {payload.rendered ? (
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
                <Button type="button" onClick={onApply} disabled={state === 'applying' || !payload.preview_token}>
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
