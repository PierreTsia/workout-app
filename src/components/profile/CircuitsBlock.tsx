import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { CircuitLedgerRow } from "@/components/profile/CircuitLedgerRow"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { ProfileSection } from "@/components/profile/ProfileSection"
import {
  ProfilePulseGrid,
  ProfileStatCard,
} from "@/components/profile/ProfileStatCard"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { useProfileCircuitLedger } from "@/hooks/useProfileCircuitLedger"
import {
  circuitLedger,
  circuitRowFromFixture,
  type CircuitLedgerPulse,
  type CircuitLedgerRowVm,
} from "@/lib/profile/circuitLedger"
import { vsPriorDelta } from "@/lib/profile/vsPrior"
import {
  pierreCircuits,
  pierreCircuitsPulse,
  type ProfileWindowKind,
} from "@/lib/profile/window"
import { authAtom } from "@/store/atoms"

export type CircuitsFixtureMode = "pierre" | "empty" | "loading"

function fixtureCircuitRows(kind: ProfileWindowKind): CircuitLedgerRowVm[] {
  return pierreCircuits(kind).flatMap((row) => {
    const vm = circuitRowFromFixture(row)
    return vm == null ? [] : [vm]
  })
}

function pulseDelta(value: number | null, include: boolean): number | null {
  if (!include) return null
  return value
}

export function CircuitsBlock({ mode }: { mode: CircuitsFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const ledgerQuery = useProfileCircuitLedger()
  const liveVm =
    user && ledgerQuery.isSuccess
      ? circuitLedger(ledgerQuery.data ?? [], { kind, now: new Date() })
      : null
  const pulse: CircuitLedgerPulse = liveVm?.pulse ?? pierreCircuitsPulse(kind)
  const rows = liveVm?.rows ?? fixtureCircuitRows(kind)
  const status =
    mode === "loading" || (Boolean(user) && ledgerQuery.isPending && liveVm == null)
      ? "loading"
      : mode === "empty"
        ? "empty"
        : user && ledgerQuery.isError
          ? "error"
          : liveVm?.status === "empty"
            ? "empty"
            : "ok"

  const runsDelta = pulseDelta(pulse.runsDelta, includeDeltas)
  const distinctDelta = pulseDelta(pulse.distinctDelta, includeDeltas)
  const pbsDelta = pulseDelta(pulse.pbsDelta, includeDeltas)

  return (
    <ProfileSection
      title={t("circuits.title")}
      hint={
        <ProfileHint label={t("about", { section: t("circuits.title") })}>
          {t("circuits.hint")}
        </ProfileHint>
      }
      status={status}
      empty={t("circuits.empty")}
      error={t("error")}
    >
      <div className="mb-4">
        <ProfilePulseGrid>
          <ProfileStatCard
            size="small"
            title={t("circuits.runs")}
            value={pulse.runs}
            delta={
              runsDelta == null ? undefined : vsPriorDelta(t, runsDelta)
            }
          />
          <ProfileStatCard
            size="small"
            title={t("circuits.distinct")}
            value={pulse.distinct}
            delta={
              distinctDelta == null
                ? undefined
                : vsPriorDelta(t, distinctDelta)
            }
          />
          <ProfileStatCard
            size="small"
            title={t("circuits.pbs")}
            value={pulse.pbs}
            delta={
              pbsDelta == null ? undefined : vsPriorDelta(t, pbsDelta)
            }
          />
        </ProfilePulseGrid>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <CircuitLedgerRow key={row.fingerprint} row={row} />
        ))}
      </ul>
    </ProfileSection>
  )
}
