import type { ReactNode } from "react"
import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  LineChart,
  Pill,
  Row,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas"

type Viewport = "desktop" | "mobile"
type WindowKey = "7" | "30" | "100"

type Pulse = {
  sessions: number
  sessionsDelta: number
  hoursLabel: string
  avgMin: number
  prescribedMin: number
  prs: number
  distinct: number
  drought: number
  prWeeks: number[]
}

const PULSE: Record<WindowKey, Pulse> = {
  "7": {
    sessions: 3,
    sessionsDelta: 0,
    hoursLabel: "3h 18",
    avgMin: 66,
    prescribedMin: 60,
    prs: 1,
    distinct: 1,
    drought: 2,
    prWeeks: [0, 0, 1],
  },
  "30": {
    sessions: 14,
    sessionsDelta: 2,
    hoursLabel: "16h 20",
    avgMin: 70,
    prescribedMin: 60,
    prs: 6,
    distinct: 4,
    drought: 4,
    prWeeks: [2, 1, 2, 1],
  },
  "100": {
    sessions: 48,
    sessionsDelta: -3,
    hoursLabel: "56h",
    avgMin: 70,
    prescribedMin: 60,
    prs: 19,
    distinct: 8,
    drought: 4,
    prWeeks: [2, 1, 3, 2, 1, 2, 3, 1, 2, 0, 1, 1],
  },
}

const WEEK_SESSIONS = [4, 3, 4, 2, 4, 4, 3, 4, 3, 4, 4, 3]
const WEEK_LABELS = [
  "S−11",
  "S−10",
  "S−9",
  "S−8",
  "S−7",
  "S−6",
  "S−5",
  "S−4",
  "S−3",
  "S−2",
  "S−1",
  "S",
]
const TARGET_DAYS = 4

type DayKind = "session" | "skip" | "rest"

const DAYS_7: { label: string; kind: DayKind }[] = [
  { label: "Lun", kind: "session" },
  { label: "Mar", kind: "rest" },
  { label: "Mer", kind: "session" },
  { label: "Jeu", kind: "rest" },
  { label: "Ven", kind: "session" },
  { label: "Sam", kind: "rest" },
  { label: "Dim", kind: "rest" },
]

const MIX_PGM = [2, 2, 2, 1, 3, 2, 2, 3, 2, 2, 3, 2]
const MIX_QW = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0]
const MIX_CIR = [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1]
const MIX_7_PGM = [1, 0, 0, 0, 0, 0, 0]
const MIX_7_QW = [0, 0, 1, 0, 0, 0, 0]
const MIX_7_CIR = [0, 0, 0, 0, 1, 0, 0]

const MUSCLE_AXES = [
  "Pec",
  "Dos",
  "Ép",
  "Bi",
  "Tri",
  "Quad",
  "Isch",
  "Fes",
  "Add",
  "Mol",
  "Abd",
  "Trap",
  "Lomb",
]

type BalanceWindow = {
  score: number
  prev: number
  band: string
  current: number[]
  previous: number[]
  tonnes: number
  tonnesPrev: number
  tonneBars: number[]
}

const BALANCE: Record<WindowKey, BalanceWindow> = {
  "7": {
    score: 78,
    prev: 74,
    band: "Bon",
    current: [0.9, 0.85, 0.5, 0.4, 0.45, 0.8, 0.55, 0.5, 0.25, 0.3, 0.45, 0.35, 0.3],
    previous: [0.8, 0.7, 0.45, 0.35, 0.5, 0.9, 0.4, 0.4, 0.2, 0.25, 0.55, 0.3, 0.25],
    tonnes: 14.3,
    tonnesPrev: 15.1,
    tonneBars: [8.2, 0, 6.1, 0, 0, 0, 0],
  },
  "30": {
    score: 72,
    prev: 68,
    band: "Bon",
    current: [1, 0.9, 0.55, 0.45, 0.5, 0.95, 0.6, 0.5, 0.2, 0.3, 0.4, 0.35, 0.25],
    previous: [0.85, 0.7, 0.5, 0.4, 0.55, 1, 0.45, 0.4, 0.15, 0.25, 0.5, 0.3, 0.2],
    tonnes: 84.4,
    tonnesPrev: 76.2,
    tonneBars: [19, 14, 18, 20.4, 13],
  },
  "100": {
    score: 70,
    prev: 73,
    band: "Bon",
    current: [0.95, 0.88, 0.52, 0.42, 0.48, 0.92, 0.58, 0.48, 0.18, 0.28, 0.38, 0.32, 0.22],
    previous: [0.9, 0.92, 0.58, 0.5, 0.52, 0.85, 0.62, 0.55, 0.28, 0.35, 0.42, 0.4, 0.3],
    tonnes: 268,
    tonnesPrev: 281,
    tonneBars: [24.8, 18.6, 24.8, 12.4, 24.8, 24.8, 18.6, 24.8, 18.6, 24.8, 24.8, 26.2],
  },
}

const RIR0_7_LABELS = ["Lun", "Mer", "Ven"]
const RIR0_7_PCT = [8, 0, 22]
const RIR0_100_PCT = [7, 5, 11, 4, 9, 12, 6, 5, 10, 6, 8, 9]

type CircuitWindow = {
  sessions: number
  wods: number
  pbs: number
  olympians: string
}

const CIRCUIT_WINDOW: Record<WindowKey, CircuitWindow> = {
  "7": { sessions: 1, wods: 1, pbs: 0, olympians: "1 / 4" },
  "30": { sessions: 4, wods: 2, pbs: 1, olympians: "1 / 4" },
  "100": { sessions: 10, wods: 2, pbs: 2, olympians: "1 / 4" },
}

type WodCard = {
  name: string
  mode: string
  specialty: string
  last: string
  pb: string
  delta: string
  pbInWindow: Record<WindowKey, boolean>
  visible: Record<WindowKey, boolean>
  labels: string[]
  rounds: number[]
}

const WODS: WodCard[] = [
  {
    name: "Cindy",
    mode: "AMRAP 20",
    specialty: "Full body",
    last: "18+6",
    pb: "18+6",
    delta: "+1 ronde vs préc.",
    pbInWindow: { "7": false, "30": true, "100": true },
    visible: { "7": true, "30": true, "100": true },
    labels: ["12/6", "28/6", "9/7", "23/7", "6/8", "21/8"],
    rounds: [15.2, 16, 16.4, 17.1, 17.3, 18.6],
  },
  {
    name: "Athena",
    mode: "AMRAP 20",
    specialty: "Core · Olympien",
    last: "11+4",
    pb: "11+8",
    delta: "−4 leftover vs PB",
    pbInWindow: { "7": false, "30": false, "100": true },
    visible: { "7": false, "30": true, "100": true },
    labels: ["3/6", "18/6", "2/7", "20/7", "10/8"],
    rounds: [8.2, 9.1, 9.8, 11.8, 11.4],
  },
]

const ACH_UNLOCKED = 18
const ACH_TOTAL = 92

const ACH_LATEST = {
  group: "L'Araignée",
  title: "La toile",
  rank: "Argent",
  date: "21 août",
}

const ACH_HIGHEST = {
  group: "Régularité",
  title: "Routine de Fer",
  rank: "Or",
  date: "mars 2026",
}

type AchGrant = {
  date: string
  group: string
  title: string
  rank: string
  window: WindowKey[]
}

const ACH_GRANTS: AchGrant[] = [
  {
    date: "21 août",
    group: "L'Araignée",
    title: "La toile",
    rank: "Argent",
    window: ["7", "30", "100"],
  },
  {
    date: "19 août",
    group: "Records",
    title: "Chasseur",
    rank: "Or",
    window: ["7", "30", "100"],
  },
  {
    date: "10 août",
    group: "Au sommet de l'Olympe",
    title: "Acolyte",
    rank: "Bronze",
    window: ["30", "100"],
  },
  {
    date: "6 août",
    group: "Circuit runner",
    title: "Premier tour",
    rank: "Bronze",
    window: ["30", "100"],
  },
  {
    date: "12 juin",
    group: "Série de Records",
    title: "En feu",
    rank: "Argent",
    window: ["100"],
  },
  {
    date: "mars 2026",
    group: "Régularité",
    title: "Routine de Fer",
    rank: "Or",
    window: ["100"],
  },
]

const STAPLES = [
  {
    name: "Back squat",
    metric: "e1RM 142 kg",
    spark: [128, 130, 132, 135, 138, 140, 142],
    last: "il y a 2j",
    onProgram: true,
  },
  {
    name: "Bench press",
    metric: "e1RM 98 kg",
    spark: [92, 94, 94, 95, 96, 97, 98],
    last: "il y a 4j",
    onProgram: true,
  },
  {
    name: "Chest-supported row",
    metric: "heaviest 42 kg",
    spark: [36, 38, 38, 40, 40, 42, 42],
    last: "il y a 2j",
    onProgram: true,
  },
  {
    name: "Pull-up",
    metric: "8 reps",
    spark: [5, 6, 6, 7, 7, 8, 8],
    last: "il y a 5j",
    onProgram: true,
  },
  {
    name: "RDL",
    metric: "e1RM 118 kg",
    spark: [110, 110, 112, 114, 114, 116, 118],
    last: "il y a 4j",
    onProgram: true,
  },
  {
    name: "Cindy",
    metric: "AMRAP 20 · 18+6",
    spark: [15, 16, 16, 17, 17, 18, 18],
    last: "il y a 11j",
    onProgram: false,
  },
]

function deltaTone(n: number): "success" | "warning" | undefined {
  if (n > 0) return "success"
  if (n < 0) return "warning"
  return undefined
}

function deltaLabel(n: number): string {
  if (n === 0) return "stable vs préc."
  const sign = n > 0 ? "+" : ""
  return `${sign}${n} vs préc.`
}

function Spark({ values }: { values: number[] }) {
  const theme = useHostTheme()
  const w = 72
  const h = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={theme.accent.primary}
        strokeWidth={1.5}
      />
    </svg>
  )
}

function weekWindow(windowKey: WindowKey): {
  title: string
  hint: string
  caption: string
  from: number
} {
  if (windowKey === "7") {
    return {
      title: "Rythme",
      hint: "7 derniers jours · présence",
      caption: "Plein = séance. Vide = pas de séance.",
      from: 0,
    }
  }
  if (windowKey === "30") {
    return {
      title: "Rythme",
      hint: `5 semaines · cible ${TARGET_DAYS} j / sem`,
      caption: "Grain = semaine ISO. Même vocabulaire que les 7 jours.",
      from: WEEK_SESSIONS.length - 5,
    }
  }
  return {
    title: "Rythme",
    hint: `12 semaines · cible ${TARGET_DAYS} j / sem`,
    caption: "S−8 = deload (2 séances).",
    from: 0,
  }
}

function DayStrip({ compact }: { compact: boolean }) {
  const theme = useHostTheme()
  const size = compact ? 14 : 18
  return (
    <Row gap={compact ? 8 : 14} align="end">
      {DAYS_7.map((d) => (
        <div key={d.label} style={{ flex: 1, minWidth: 0 }}>
          <Stack gap={6} style={{ alignItems: "center" }}>
            <div
              style={{
                width: size,
                height: size,
                borderRadius: 99,
                background:
                  d.kind === "session"
                    ? theme.accent.primary
                    : d.kind === "skip"
                      ? "transparent"
                      : theme.fill.tertiary,
                border:
                  d.kind === "skip" ? `1.5px solid ${theme.stroke.secondary}` : undefined,
              }}
            />
            <Text size="small" tone="tertiary">
              {d.label}
            </Text>
          </Stack>
        </div>
      ))}
    </Row>
  )
}

function WeekColumns({
  compact,
  from,
}: {
  compact: boolean
  from: number
}) {
  const theme = useHostTheme()
  const counts = WEEK_SESSIONS.slice(from)
  const labels = WEEK_LABELS.slice(from)
  return (
    <Row gap={compact ? 6 : 10} align="end">
      {counts.map((count, i) => {
        const missed = TARGET_DAYS - count
        const label = labels[i]
        return (
          <div key={label} style={{ flex: 1, minWidth: 0 }}>
            <Stack gap={4} style={{ alignItems: "center" }}>
              <Row gap={3} align="end" style={{ height: compact ? 36 : 48 }}>
                {Array.from({ length: TARGET_DAYS }, (_, slot) => {
                  const filled = slot < count
                  const skip = !filled && slot < count + missed
                  return (
                    <div
                      key={slot}
                      style={{
                        width: compact ? 7 : 9,
                        height: compact ? 7 : 9,
                        borderRadius: 99,
                        background: filled
                          ? theme.accent.primary
                          : skip
                            ? theme.fill.tertiary
                            : "transparent",
                        border:
                          skip && !filled
                            ? `1px solid ${theme.stroke.secondary}`
                            : undefined,
                      }}
                    />
                  )
                })}
              </Row>
              <Text size="small" tone="tertiary">
                {label}
              </Text>
            </Stack>
          </div>
        )
      })}
    </Row>
  )
}

function WeekStrip({
  compact,
  windowKey,
}: {
  compact: boolean
  windowKey: WindowKey
}) {
  const meta = weekWindow(windowKey)
  return (
    <Stack gap={8}>
      <Row align="center" justify="space-between" wrap>
        <H2>{meta.title}</H2>
        <Text size="small" tone="tertiary">
          {meta.hint}
        </Text>
      </Row>
      {windowKey === "7" ? (
        <DayStrip compact={compact} />
      ) : (
        <WeekColumns compact={compact} from={meta.from} />
      )}
      <Text size="small" tone="tertiary">
        {meta.caption}
      </Text>
    </Stack>
  )
}

function Hero({ compact }: { compact: boolean }) {
  const theme = useHostTheme()
  return (
    <Row gap={compact ? 12 : 20} align="center">
      <div
        style={{
          width: compact ? 48 : 64,
          height: compact ? 48 : 64,
          borderRadius: 99,
          background: theme.fill.secondary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: theme.text.primary,
          fontWeight: 600,
          fontSize: compact ? 16 : 20,
        }}
      >
        PT
      </div>
      <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
        <Text weight="bold" style={{ fontSize: compact ? 16 : 18 }}>
          Pierre
        </Text>
        <Text size="small" italic tone="secondary">
          Routine de Fer
        </Text>
        <Row gap={8} wrap>
          <Text size="small" tone="secondary">
            Actif · Upper / Lower 4j
          </Text>
          <Text size="small" tone="tertiary">
            Aussi PPL cette semaine
          </Text>
          <Text size="small" tone="tertiary">
            Série · 18 j
          </Text>
        </Row>
      </Stack>
    </Row>
  )
}

function PulseStrip({ windowKey, compact }: { windowKey: WindowKey; compact: boolean }) {
  const p = PULSE[windowKey]
  const avgTone = p.avgMin > p.prescribedMin + 5 ? "warning" : undefined
  return (
    <Grid columns={compact ? 2 : 3} gap={compact ? 12 : 20}>
      <Stat
        value={String(p.sessions)}
        label={`Séances · ${deltaLabel(p.sessionsDelta)}`}
        tone={deltaTone(p.sessionsDelta)}
      />
      <Stat value={p.hoursLabel} label="Temps sous barre" />
      <Stat
        value={`${p.avgMin} min`}
        label={`Durée moy. · vs ${p.prescribedMin} min prescrits`}
        tone={avgTone}
      />
    </Grid>
  )
}

function recordsCombo(windowKey: WindowKey): {
  hint: string
  caption: string
  categories: string[]
  prs: number[]
  rirPct: number[]
} {
  if (windowKey === "7") {
    return {
      hint: "grain = séance",
      caption: "Barres = PRs (séance × exercice). Ligne = % de séries à RIR 0.",
      categories: RIR0_7_LABELS,
      prs: [0, 0, 1],
      rirPct: RIR0_7_PCT,
    }
  }
  if (windowKey === "30") {
    return {
      hint: "grain = semaine ISO",
      caption: "% RIR 0 = moyenne des séances de la semaine. Pic 13 % = semaine squat.",
      categories: ["S−3", "S−2", "S−1", "S"],
      prs: [2, 1, 2, 1],
      rirPct: [5, 7, 13, 6],
    }
  }
  return {
    hint: "grain = semaine ISO",
    caption: "100j : % = moyenne des % séance dans la semaine. Axe droit en %.",
    categories: WEEK_LABELS,
    prs: PULSE["100"].prWeeks,
    rirPct: RIR0_100_PCT,
  }
}

function ComboPrRir({
  compact,
  windowKey,
}: {
  compact: boolean
  windowKey: WindowKey
}) {
  const theme = useHostTheme()
  const chart = recordsCombo(windowKey)
  const w = compact ? 320 : 560
  const h = compact ? 168 : 208
  const padL = 36
  const padR = 40
  const padT = 18
  const padB = 28
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const n = chart.categories.length
  const prMax = Math.max(3, ...chart.prs)
  const pctMax = 30
  const band = plotW / n
  const barW = Math.min(22, band * 0.45)

  const yPr = (v: number) => padT + plotH - (v / prMax) * plotH
  const yPct = (v: number) => padT + plotH - (v / pctMax) * plotH
  const xAt = (i: number) => padL + band * i + band / 2

  const prTicks = Array.from({ length: prMax + 1 }, (_, i) => i)
  const pctTicks = [0, 10, 20, 30]
  const line = chart.rirPct
    .map((v, i) => `${xAt(i).toFixed(1)},${yPct(v).toFixed(1)}`)
    .join(" ")

  return (
    <Stack gap={8}>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="PRs et pourcentage RIR 0"
      >
        <text x={padL} y={12} fill={theme.text.tertiary} fontSize={10}>
          PRs
        </text>
        <text
          x={w - padR}
          y={12}
          fill={theme.text.tertiary}
          fontSize={10}
          textAnchor="end"
        >
          %
        </text>
        {prTicks.map((t) => (
          <g key={`pr-${t}`}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yPr(t)}
              y2={yPr(t)}
              stroke={theme.stroke.tertiary}
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={yPr(t)}
              fill={theme.text.tertiary}
              fontSize={10}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {t}
            </text>
          </g>
        ))}
        {pctTicks.map((t) => (
          <text
            key={`pct-${t}`}
            x={w - padR + 8}
            y={yPct(t)}
            fill={theme.text.tertiary}
            fontSize={10}
            textAnchor="start"
            dominantBaseline="middle"
          >
            {t}
          </text>
        ))}
        {chart.prs.map((v, i) => (
          <rect
            key={`bar-${chart.categories[i]}`}
            x={xAt(i) - barW / 2}
            y={yPr(v)}
            width={barW}
            height={Math.max(0, yPr(0) - yPr(v))}
            fill={theme.fill.secondary}
          />
        ))}
        <polyline
          points={line}
          fill="none"
          stroke={theme.accent.primary}
          strokeWidth={1.5}
        />
        {chart.rirPct.map((v, i) => (
          <circle
            key={`dot-${chart.categories[i]}`}
            cx={xAt(i)}
            cy={yPct(v)}
            r={2.5}
            fill={theme.accent.primary}
          />
        ))}
        {chart.categories.map((label, i) => (
          <text
            key={label}
            x={xAt(i)}
            y={h - 8}
            fill={theme.text.tertiary}
            fontSize={10}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
      <Row gap={16}>
        <Text size="small" tone="secondary">
          Barres · PRs
        </Text>
        <Text size="small" tone="secondary">
          Ligne · % RIR 0
        </Text>
        <Spacer />
        <Text size="small" tone="tertiary">
          {chart.hint}
        </Text>
      </Row>
      <Text size="small" tone="tertiary">
        {chart.caption}
      </Text>
    </Stack>
  )
}

function PrSection({ windowKey, compact }: { windowKey: WindowKey; compact: boolean }) {
  const p = PULSE[windowKey]
  return (
    <Stack gap={12}>
      <Row align="center">
        <H2>Records</H2>
        <Spacer />
        <Text size="small" tone="tertiary">
          PRs = séance × exercice · % = sets à RIR 0
        </Text>
      </Row>
      <Grid columns={compact ? 2 : 3} gap={12}>
        <Stat value={String(p.prs)} label={`PRs / ${windowKey}j`} />
        <Stat value={String(p.distinct)} label="Exercices" />
        <Stat value={`${p.drought} j`} label="Depuis le dernier" />
      </Grid>
      <ComboPrRir compact={compact} windowKey={windowKey} />
      {!compact && (
        <Table
          headers={["Exercice", "Quand", "Ce qui a bougé", "RIR 0"]}
          rows={[
            ["Back squat", "19 août", "e1RM 142 kg", "oui"],
            ["Pull-up", "17 août", "8 reps", "—"],
            ["Bench press", "14 août", "e1RM 98 kg", "—"],
            ["Cindy", "10 août", "18+6 · AMRAP 20", "—"],
          ]}
          columnAlign={["left", "left", "right", "right"]}
        />
      )}
    </Stack>
  )
}

function Staples({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <Stack gap={10}>
        <H2>Récurrents</H2>
        <Text size="small" tone="tertiary">
          Les plus loggés · 100 jours · le programme annote, ne filtre pas
        </Text>
        {STAPLES.map((s) => (
          <div key={s.name}>
          <Row gap={10} align="center">
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Row gap={6} align="center">
                <Text weight="semibold" truncate>
                  {s.name}
                </Text>
                {s.onProgram ? (
                  <Pill size="sm" active>
                    Sur le programme
                  </Pill>
                ) : null}
              </Row>
              <Text size="small" tone="secondary">
                {s.metric} · {s.last}
              </Text>
            </Stack>
            <Spark values={s.spark} />
          </Row>
          </div>
        ))}
      </Stack>
    )
  }
  return (
    <Stack gap={10}>
      <H2>Récurrents</H2>
      <Text size="small" tone="tertiary">
        Les plus loggés · 100 jours
      </Text>
      <Table
        headers={["Mouvement", "Métrique", "Tendance", "Dernière", ""]}
        rows={STAPLES.map((s) => [
          s.name,
          s.metric,
          <Spark values={s.spark} />,
          s.last,
          s.onProgram ? "Sur le programme" : "Hors plan",
        ])}
        columnAlign={["left", "left", "left", "right", "right"]}
      />
      <Text size="small" tone="tertiary">
        Cindy est un Circuit : ici l’habitude, dans Circuits le score.
      </Text>
    </Stack>
  )
}

function mixWindow(windowKey: WindowKey): {
  title: string
  hint: string
  caption: string
  categories: string[]
  pgm: number[]
  qw: number[]
  circuits: number[]
} {
  if (windowKey === "7") {
    return {
      title: "Mix",
      hint: "7 derniers jours",
      caption: "Une barre = un jour. Programme · Quick Workout · Circuits.",
      categories: DAYS_7.map((d) => d.label),
      pgm: MIX_7_PGM,
      qw: MIX_7_QW,
      circuits: MIX_7_CIR,
    }
  }
  const from = windowKey === "30" ? MIX_PGM.length - 5 : 0
  return {
    title: "Mix",
    hint: windowKey === "30" ? "5 semaines" : "12 semaines",
    caption: "Même grain que le Rythme. Quick Workout = hors plan.",
    categories: WEEK_LABELS.slice(from),
    pgm: MIX_PGM.slice(from),
    qw: MIX_QW.slice(from),
    circuits: MIX_CIR.slice(from),
  }
}

function MixChart({ compact, windowKey }: { compact: boolean; windowKey: WindowKey }) {
  const chart = mixWindow(windowKey)
  const totPgm = chart.pgm.reduce((a, n) => a + n, 0)
  const totQw = chart.qw.reduce((a, n) => a + n, 0)
  const totCir = chart.circuits.reduce((a, n) => a + n, 0)
  return (
    <Stack gap={10}>
      <Row align="center" wrap>
        <H2>{chart.title}</H2>
        <Spacer />
        <Text size="small" tone="tertiary">
          {chart.hint}
        </Text>
      </Row>
      <BarChart
        categories={chart.categories}
        stacked
        height={compact ? 140 : 200}
        series={[
          { name: "Programme", data: chart.pgm },
          { name: "Quick Workout", data: chart.qw },
          { name: "Circuits", data: chart.circuits },
        ]}
      />
      <Text size="small" tone="secondary">
        {totPgm} Programme · {totQw} Quick Workout · {totCir} Circuits
      </Text>
      <Text size="small" tone="tertiary">
        {chart.caption}
      </Text>
    </Stack>
  )
}

function AchievementsSection({
  compact,
  windowKey,
}: {
  compact: boolean
  windowKey: WindowKey
}) {
  const inWindow = ACH_GRANTS.filter((g) => g.window.includes(windowKey))
  return (
    <Stack gap={12}>
      <Row align="center" wrap>
        <H2>Succès</H2>
        <Spacer />
        <Pill size="sm">
          {ACH_UNLOCKED} / {ACH_TOTAL}
        </Pill>
        <Pill size="sm">Voir tout</Pill>
      </Row>
      <Grid columns={compact ? 1 : 2} gap={16}>
        <Card>
          <CardHeader trailing={<Pill size="sm">{ACH_LATEST.rank}</Pill>}>
            Plus récent
          </CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text weight="semibold">{ACH_LATEST.title}</Text>
              <Text size="small" tone="secondary">
                {ACH_LATEST.group}
              </Text>
              <Text size="small" tone="tertiary">
                Reçu le {ACH_LATEST.date}
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm" active>{ACH_HIGHEST.rank}</Pill>}>
            Plus haut
          </CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text weight="semibold">{ACH_HIGHEST.title}</Text>
              <Text size="small" tone="secondary">
                {ACH_HIGHEST.group} · titre équipé
              </Text>
              <Text size="small" tone="tertiary">
                Palier max · {ACH_HIGHEST.date}
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>
      <Text size="small" tone="secondary">
        Derniers reçus
      </Text>
      <Row gap={8} wrap>
        {inWindow.map((g) => (
          <span key={`${g.date}-${g.title}`}>
            <Pill size="sm">
              {g.title} · {g.rank}
            </Pill>
          </span>
        ))}
      </Row>
    </Stack>
  )
}

function DashboardBody({ compact, windowKey }: { compact: boolean; windowKey: WindowKey }) {
  return (
    <Stack gap={compact ? 20 : 28}>
      <Hero compact={compact} />
      <AchievementsSection compact={compact} windowKey={windowKey} />
      <PulseStrip windowKey={windowKey} compact={compact} />
      <WeekStrip compact={compact} windowKey={windowKey} />
      <MixChart compact={compact} windowKey={windowKey} />
      <PrSection windowKey={windowKey} compact={compact} />
      <BalanceSection compact={compact} windowKey={windowKey} />
      <Staples compact={compact} />
      <CircuitsSection compact={compact} windowKey={windowKey} />
    </Stack>
  )
}

function CircuitsSection({
  compact,
  windowKey,
}: {
  compact: boolean
  windowKey: WindowKey
}) {
  const stats = CIRCUIT_WINDOW[windowKey]
  const wods = WODS.filter((w) => w.visible[windowKey])
  return (
    <Stack gap={12}>
      <Row align="center" wrap>
        <H2>Circuits</H2>
        <Spacer />
        <Pill size="sm">Olympiens {stats.olympians}</Pill>
      </Row>
      <Grid columns={compact ? 2 : 3} gap={12}>
        <Stat value={String(stats.sessions)} label={`Runs / ${windowKey}j`} />
        <Stat value={String(stats.wods)} label="Circuits distincts" />
        <Stat value={String(stats.pbs)} label="PBs" />
      </Grid>
      <Grid columns={compact ? 1 : wods.length} gap={16}>
        {wods.map((wod) => (
          <div key={wod.name}>
            <Card>
              <CardHeader
                trailing={
                  wod.pbInWindow[windowKey] ? (
                    <Pill size="sm" active>
                      PB fenêtre
                    </Pill>
                  ) : (
                    <Text size="small" tone="tertiary">
                      {wod.mode}
                    </Text>
                  )
                }
              >
                {wod.name}
              </CardHeader>
              <CardBody>
                <Stack gap={10}>
                  <Row justify="space-between" align="end">
                    <Stack gap={2}>
                      <Text size="small" tone="tertiary">
                        {wod.mode} · {wod.specialty}
                      </Text>
                      <Text weight="semibold" style={{ fontSize: compact ? 18 : 22 }}>
                        {wod.last}
                      </Text>
                    </Stack>
                    <Stack gap={2} style={{ alignItems: "flex-end" }}>
                      <Text size="small" tone="tertiary">
                        PB {wod.pb}
                      </Text>
                      <Text size="small" tone="secondary">
                        {wod.delta}
                      </Text>
                    </Stack>
                  </Row>
                  <LineChart
                    categories={wod.labels}
                    series={[{ name: "Score (tours + leftover)", data: wod.rounds }]}
                    height={compact ? 110 : 140}
                    beginAtZero={false}
                    fill
                  />
                </Stack>
              </CardBody>
            </Card>
          </div>
        ))}
      </Grid>
      <Text size="small" tone="tertiary">
        Score AMRAP = tours + leftover. Les Circuits jetables (temps) restent dans
        History. PB Circuit ≠ PR d’exercice.
      </Text>
    </Stack>
  )
}

function MuscleRadar({
  current,
  previous,
  compact,
}: {
  current: number[]
  previous: number[]
  compact: boolean
}) {
  const theme = useHostTheme()
  const size = compact ? 220 : 280
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 36
  const n = MUSCLE_AXES.length

  const point = (i: number, value: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    return {
      x: cx + r * value * Math.cos(angle),
      y: cy + r * value * Math.sin(angle),
    }
  }

  const poly = (values: number[]) =>
    values
      .map((v, i) => {
        const p = point(i, v)
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
      })
      .join(" ")

  const rings = [1 / 3, 2 / 3, 1]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {rings.map((scale) => (
        <polygon
          key={scale}
          points={poly(Array.from({ length: n }, () => scale))}
          fill="none"
          stroke={theme.stroke.tertiary}
          strokeWidth={1}
        />
      ))}
      {MUSCLE_AXES.map((_, i) => {
        const p = point(i, 1)
        return (
          <line
            key={MUSCLE_AXES[i]}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={theme.stroke.tertiary}
            strokeWidth={1}
          />
        )
      })}
      <polygon
        points={poly(previous)}
        fill="none"
        stroke={theme.stroke.secondary}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <polygon
        points={poly(current)}
        fill={theme.accent.primary}
        fillOpacity={0.16}
        stroke={theme.accent.primary}
        strokeWidth={1.5}
      />
      {MUSCLE_AXES.map((label, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
        const lx = cx + (r + 18) * Math.cos(angle)
        const ly = cy + (r + 18) * Math.sin(angle)
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            fill={theme.text.tertiary}
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

function formatTonnes(n: number): string {
  return `${n.toFixed(1).replace(".", ",")} t`
}

function volumeBars(windowKey: WindowKey): { categories: string[]; bars: number[] } {
  const b = BALANCE[windowKey]
  if (windowKey === "7") {
    return { categories: DAYS_7.map((d) => d.label), bars: b.tonneBars }
  }
  const from = windowKey === "30" ? WEEK_LABELS.length - 5 : 0
  return { categories: WEEK_LABELS.slice(from), bars: b.tonneBars }
}

function BalanceSection({
  compact,
  windowKey,
}: {
  compact: boolean
  windowKey: WindowKey
}) {
  const b = BALANCE[windowKey]
  const scoreDelta = b.score - b.prev
  const scoreDeltaLabel =
    scoreDelta === 0
      ? `stable vs ${windowKey}j préc.`
      : `${scoreDelta > 0 ? "+" : ""}${scoreDelta} vs ${windowKey}j préc.`
  const tonneDelta = Math.round((b.tonnes - b.tonnesPrev) * 10) / 10
  const tonneDeltaLabel =
    tonneDelta === 0
      ? "stable vs préc."
      : `${tonneDelta > 0 ? "+" : ""}${formatTonnes(Math.abs(tonneDelta)).replace(" t", "")} t vs préc.`
  const chart = volumeBars(windowKey)

  return (
    <Stack gap={12}>
      <Row align="center" wrap>
        <H2>Équilibre</H2>
        <Spacer />
        <Row gap={8} align="center">
          <Pill active>
            {b.score} · {b.band}
          </Pill>
          <Pill size="sm">{scoreDeltaLabel}</Pill>
        </Row>
      </Row>
      <Grid columns={compact ? 1 : 2} gap={compact ? 16 : 24} align="start">
        <Stack gap={8} style={{ alignItems: compact ? "center" : "flex-start" }}>
          <MuscleRadar current={b.current} previous={b.previous} compact={compact} />
          <Row gap={12}>
            <Text size="small" tone="secondary">
              Plein = fenêtre
            </Text>
            <Text size="small" tone="tertiary">
              Pointillé = même durée, décalée
            </Text>
          </Row>
        </Stack>
        <Stack gap={10}>
          <H3>Tonnage</H3>
          <Stat
            value={formatTonnes(b.tonnes)}
            label={tonneDeltaLabel}
            tone={deltaTone(tonneDelta)}
          />
          <BarChart
            categories={chart.categories}
            series={[{ name: "Tonnage (t)", data: chart.bars, tone: "info" }]}
            height={compact ? 120 : 160}
            beginAtZero
            valueSuffix=" t"
          />
          <Text size="small" tone="tertiary">
            Sets chargés · poids × reps. Vendredi Circuit = 0 t (Cindy). BW, durée,
            Circuits hors compte. Ne pas sommer le radar.
          </Text>
        </Stack>
      </Grid>
      <Text size="small" tone="tertiary">
        Body map et paires restent dans History.
      </Text>
    </Stack>
  )
}

function PhoneFrame({ children }: { children: ReactNode }) {
  const theme = useHostTheme()
  return (
    <div
      style={{
        width: 390,
        margin: "0 auto",
        border: `1px solid ${theme.stroke.primary}`,
        borderRadius: 28,
        background: theme.bg.chrome,
        padding: 10,
      }}
    >
      <div
        style={{
          height: 10,
          width: 108,
          borderRadius: 99,
          background: theme.fill.tertiary,
          margin: "4px auto 10px",
        }}
      />
      <div
        style={{
          borderRadius: 20,
          background: theme.bg.editor,
          padding: 16,
          maxHeight: 720,
          overflow: "auto",
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function ProfileMixStacked() {
  const [viewport, setViewport] = useCanvasState<Viewport>("viewport", "desktop")
  const [windowKey, setWindowKey] = useCanvasState<WindowKey>("window", "30")

  return (
    <Stack gap={20}>
      <Row align="center" wrap>
        <H1>Profil</H1>
        <Spacer />
        <Row gap={6}>
          <Pill active={viewport === "desktop"} onClick={() => setViewport("desktop")}>
            Desktop
          </Pill>
          <Pill active={viewport === "mobile"} onClick={() => setViewport("mobile")}>
            Mobile
          </Pill>
        </Row>
      </Row>

      <Row gap={8} align="center" wrap>
        <Text size="small" tone="secondary">
          /profile
        </Text>
        <Pill size="sm" active>
          Dashboard
        </Pill>
        <Pill size="sm">Réglages</Pill>
        <Spacer />
        <Row gap={6}>
          {(["7", "30", "100"] as const).map((k) => (
            <span key={k}>
              <Pill active={windowKey === k} onClick={() => setWindowKey(k)}>
                {k}j
              </Pill>
            </span>
          ))}
        </Row>
      </Row>

      <Callout tone="neutral" title="Trois actes">
        Cette fenêtre (hero, succès, stats, rythme, mix) · Preuve (records + RIR 0
        sur le même graphe, équilibre) · Pratique (récurrents, circuits). History
        ne bouge pas. Mensuel coupé.
      </Callout>

      {viewport === "mobile" ? (
        <PhoneFrame>
          <DashboardBody compact windowKey={windowKey} />
        </PhoneFrame>
      ) : (
        <DashboardBody compact={false} windowKey={windowKey} />
      )}

      <Divider />
      <Text size="small" tone="tertiary">
        Hors cadre volontaire : calendrier, liste de séances, body map, formulaire, 1RM
        sur plank.
      </Text>
    </Stack>
  )
}
