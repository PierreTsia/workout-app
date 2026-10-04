import { Badge, Card, CardContent, CardHeader, CardTitle, Meter } from '@nomosui/react'

import type { SessionCardLabels, SessionCardPayload } from './types'

const panel = {
  width: '100%',
  maxWidth: 520,
  margin: '0 auto',
  padding: 12,
  boxSizing: 'border-box' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
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
          <CardHeader>
            <CardTitle>{labels.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ margin: 0, fontWeight: 600 }}>{labels.empty}</p>
            <p style={{ margin: '4px 0 0', opacity: 0.7 }}>{labels.emptyHint}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const session = payload.session

  return (
    <div data-theme="dark" data-density="comfortable" style={panel}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <CardTitle>{session.label}</CardTitle>
            <span style={{ opacity: 0.7 }}>{session.finishedAtLabel}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Badge variant="secondary">{session.durationLabel}</Badge>
            <span>
              {session.setsDone} {labels.sets}
            </span>
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payload.items.map((item, index) => (
              <li key={index}>
                {item.kind === 'solo' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <strong>{item.name}</strong>
                    {item.sets.map((set, setIndex) => (
                      <span key={setIndex} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {set.measure} × {set.weightKg} kg
                        {set.isPr ? <Badge>{labels.pr}</Badge> : null}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <strong>{item.label || labels.circuit}</strong>
                    {item.mode === 'amrap' && item.amrap ? (
                      <span>
                        {item.amrap.fullRounds}+{item.amrap.leftover} · {item.amrap.leftoverName} — {labels.amrapGloss}
                      </span>
                    ) : item.completionSeconds != null ? (
                      <span>
                        {labels.completionTime.replace(
                          '{{time}}',
                          `${Math.floor(item.completionSeconds / 60)}:${String(item.completionSeconds % 60).padStart(2, '0')}`,
                        )}
                      </span>
                    ) : (
                      <span>
                        {(item.rounds === 1 ? labels.roundsOne : labels.roundsOther).replace(
                          '{{count}}',
                          String(item.rounds),
                        )}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 16 }}>
            <Meter label={labels.tonnage} value={payload.tonnageKg} max={10000} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
