import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { MixStackedChart } from "@/components/profile/charts/MixStackedChart"
import { MuscleRadarChart } from "@/components/profile/charts/MuscleRadarChart"
import { RecordsComboChart } from "@/components/profile/charts/RecordsComboChart"
import {
  COMBO_CATEGORIES,
  COMBO_SERIES,
  MIX_7_CATEGORIES,
  MIX_7_SERIES,
  RADAR_SERIES,
} from "@/components/profile/charts/fixtures"

export function ProfileChartsPlaygroundPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Profile chart atoms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Not in nav — fixtures only. Mix 7-day stacks, Records combo with a
          missing RIR point, radar on all 13 muscle axes.
        </p>
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold tracking-tight">Mix</h2>
          <CardDescription>
            Session-count stacked Programme / Quick Workout / Circuits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MixStackedChart
            categories={MIX_7_CATEGORIES}
            series={MIX_7_SERIES}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold tracking-tight">Records</h2>
          <CardDescription>
            PR bars + RIR 0 rate. Mer has no declared RIR — a gap, not 0%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordsComboChart
            categories={COMBO_CATEGORIES}
            series={COMBO_SERIES}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold tracking-tight">Équilibre</h2>
          <CardDescription>
            13 MUSCLE_TAXONOMY axes. Current solid, prior dashed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MuscleRadarChart series={RADAR_SERIES} />
        </CardContent>
      </Card>
    </div>
  )
}
