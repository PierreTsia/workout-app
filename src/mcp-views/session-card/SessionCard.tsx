import {
  Badge,
  Card,
  CardContent,
  Counter,
  EmptyState,
  Heading,
  Separator,
  Text,
} from '@nomosui/react'

import { panel, type ViewTheme } from '../styles'
import type { SessionCardLabels, SessionCardItem, SessionCardPayload } from './types'

function setLine(item: SessionCardItem): string {
  if (item.kind !== 'solo') return ''
  return item.sets
    .map((set) => (set.weightKg > 0 ? `${set.measure} × ${set.weightKg} kg` : set.measure))
    .join(' · ')
}

function hasPr(item: SessionCardItem): boolean {
  return item.kind === 'solo' && item.sets.some((set) => set.isPr)
}

/**
 * The **Session Card** (ADR 0027): a read-only card of the athlete's most recent finished
 * **Session**, built from Nomos primitives. Tones and the type scale come from the design
 * system; the outer panel box comes from `../styles`.
 */
export function SessionCard({
  payload,
  labels,
  theme = 'dark',
}: {
  payload: SessionCardPayload
  labels: SessionCardLabels
  theme?: ViewTheme
}) {
  if (!payload.session) {
    return (
      <div data-theme={theme} data-density="comfortable" style={panel}>
        <Card>
          <CardContent>
            <EmptyState title={labels.empty} description={labels.emptyHint} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const session = payload.session

  return (
    <div data-theme={theme} data-density="comfortable" style={panel}>
      <Card>
        <CardContent>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'baseline',
            }}
          >
            <Heading level={3}>{session.label}</Heading>
            <Text size="caption" className="text-muted-foreground" style={{ whiteSpace: 'nowrap' }}>
              {session.finishedAtLabel}
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Badge variant="secondary">{session.durationLabel}</Badge>
            <Text size="caption" className="text-muted-foreground">
              {session.setsDone} {labels.sets}
            </Text>
          </div>

          <Separator style={{ margin: '12px 0' }} decorative />

          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {payload.items.map((item, index) => (
              <li key={index}>
                {item.kind === 'solo' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text as="span" style={{ fontWeight: 600 }}>
                        {item.name}
                      </Text>
                      {hasPr(item) ? <Badge>{labels.pr}</Badge> : null}
                    </div>
                    <Text
                      size="caption"
                      className="text-muted-foreground"
                      style={{ marginTop: 2 }}
                    >
                      {setLine(item)}
                    </Text>
                  </>
                ) : (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                  >
                    <Text as="span" style={{ fontWeight: 600 }}>
                      {item.label || labels.circuit}
                    </Text>
                    {item.mode === 'amrap' && item.amrap ? (
                      <Text as="span" size="caption" className="text-muted-foreground">
                        {item.amrap.fullRounds}+{item.amrap.leftover} · {item.amrap.leftoverName}
                      </Text>
                    ) : item.completionSeconds != null ? (
                      <Text as="span" size="caption" className="text-muted-foreground">
                        {labels.completionTime.replace(
                          '{{time}}',
                          `${Math.floor(item.completionSeconds / 60)}:${String(item.completionSeconds % 60).padStart(2, '0')}`,
                        )}
                      </Text>
                    ) : (
                      <Text as="span" size="caption" className="text-muted-foreground">
                        {(item.rounds === 1 ? labels.roundsOne : labels.roundsOther).replace(
                          '{{count}}',
                          String(item.rounds),
                        )}
                      </Text>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div
            style={{
              marginTop: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Text size="caption" className="text-muted-foreground">
              {labels.tonnage}
            </Text>
            <Counter value={payload.tonnageKg} suffix="kg" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
