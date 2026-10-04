import { Badge, Card, CardContent } from '@nomosui/react'

import type { SessionCardLabels, SessionCardItem, SessionCardPayload } from './types'

const panel = {
  width: '100%',
  maxWidth: 520,
  margin: '0 auto',
  padding: 12,
  boxSizing: 'border-box' as const,
}

const muted = { opacity: 0.7 } as const

function setLine(item: SessionCardItem): string {
  if (item.kind !== 'solo') return ''
  return item.sets
    .map((set) => (set.weightKg > 0 ? `${set.measure} × ${set.weightKg} kg` : set.measure))
    .join(' · ')
}

function hasPr(item: SessionCardItem): boolean {
  return item.kind === 'solo' && item.sets.some((set) => set.isPr)
}

export function SessionCard({
  payload,
  labels,
}: {
  payload: SessionCardPayload
  labels: SessionCardLabels
}) {
  if (!payload.session) {
    return (
      <div data-theme="dark" data-density="comfortable" style={panel}>
        <Card>
          <CardContent>
            <p style={{ margin: 0, fontWeight: 600 }}>{labels.empty}</p>
            <p style={{ margin: '4px 0 0', ...muted }}>{labels.emptyHint}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const session = payload.session

  return (
    <div data-theme="dark" data-density="comfortable" style={panel}>
      <Card>
        <CardContent>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{session.label}</span>
            <span style={{ fontSize: 12, whiteSpace: 'nowrap', ...muted }}>{session.finishedAtLabel}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Badge variant="secondary">{session.durationLabel}</Badge>
            <span style={{ fontSize: 13, ...muted }}>
              {session.setsDone} {labels.sets}
            </span>
          </div>

          <div style={{ height: 1, background: 'color-mix(in srgb, currentColor 12%, transparent)', margin: '12px 0' }} />

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payload.items.map((item, index) => (
              <li key={index}>
                {item.kind === 'solo' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                      {hasPr(item) ? <Badge>{labels.pr}</Badge> : null}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, ...muted }}>{setLine(item)}</div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label || labels.circuit}</span>
                    {item.mode === 'amrap' && item.amrap ? (
                      <span style={{ fontSize: 13, ...muted }}>
                        {item.amrap.fullRounds}+{item.amrap.leftover} · {item.amrap.leftoverName}
                      </span>
                    ) : item.completionSeconds != null ? (
                      <span style={{ fontSize: 13, ...muted }}>
                        {labels.completionTime.replace(
                          '{{time}}',
                          `${Math.floor(item.completionSeconds / 60)}:${String(item.completionSeconds % 60).padStart(2, '0')}`,
                        )}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, ...muted }}>
                        {(item.rounds === 1 ? labels.roundsOne : labels.roundsOther).replace('{{count}}', String(item.rounds))}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, ...muted }}>
              <span>{labels.tonnage}</span>
              <span>{payload.tonnageKg.toLocaleString('fr-FR')} kg</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, marginTop: 6, background: 'color-mix(in srgb, currentColor 14%, transparent)' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 999,
                  background: 'var(--nomos-color-primary)',
                  width: `${Math.min(100, Math.round((payload.tonnageKg / 10000) * 100))}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
