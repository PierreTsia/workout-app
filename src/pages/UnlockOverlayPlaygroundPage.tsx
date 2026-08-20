import { Button } from "@/components/ui/button"
import { pushAchievementsToQueue } from "@/lib/syncService"
import type { AchievementRank, UnlockedAchievement } from "@/types/achievements"

const FIXTURE_BUTTONS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "2 overlap",
  "Burst 3",
  "Burst 4",
  "Overflow 5+",
] as const

type FixtureName = (typeof FIXTURE_BUTTONS)[number]

function grant(
  rank: AchievementRank,
  group_slug: string,
  title_en: string,
  title_fr: string,
  threshold_value: number,
): UnlockedAchievement {
  return {
    tier_id: crypto.randomUUID(),
    group_slug,
    rank,
    title_en,
    title_fr,
    icon_asset_url: null,
    threshold_value,
    granted_at: new Date().toISOString(),
  }
}

const FIXTURES: Record<FixtureName, () => UnlockedAchievement[]> = {
  Bronze: () => [
    grant(
      "bronze",
      "volume_king",
      "Is That All You Got?",
      "Sérieux, c'est tout ?",
      15_000,
    ),
  ],
  Silver: () => [
    grant("silver", "consistency_streak", "Iron Routine", "Routine de Fer", 25),
  ],
  Gold: () => [
    grant("gold", "volume_king", "Plateau Titan", "Titan du plateau", 50_000),
  ],
  Platinum: () => [
    grant(
      "platinum",
      "volume_king",
      "Steel Forger",
      "Forgeron d'Acier",
      500_000,
    ),
  ],
  Diamond: () => [
    grant(
      "diamond",
      "volume_king",
      "God of Steel",
      "Dieu de l'Acier",
      2_000_000,
    ),
  ],
  "2 overlap": () => [
    grant(
      "silver",
      "volume_king",
      "Sunday Mover",
      "Déménageur du dimanche",
      25_000,
    ),
    grant(
      "bronze",
      "consistency_streak",
      "The Sore Apprentice",
      "Apprenti Courbaturé",
      5,
    ),
  ],
  "Burst 3": () => [
    grant("gold", "volume_king", "Plateau Titan", "Titan du plateau", 50_000),
    grant("silver", "consistency_streak", "Iron Routine", "Routine de Fer", 25),
    grant("bronze", "record_hunter", "Ceiling Breaker", "Briseur de plafonds", 1),
  ],
  "Burst 4": () => [
    grant(
      "diamond",
      "volume_king",
      "God of Steel",
      "Dieu de l'Acier",
      2_000_000,
    ),
    grant("gold", "consistency_streak", "Gym Demon", "Démon des Salles", 100),
    grant("silver", "rhythm_master", "Human Pendulum", "Pendule humaine", 8),
    grant("bronze", "record_hunter", "Ceiling Breaker", "Briseur de plafonds", 1),
  ],
  "Overflow 5+": () => [
    grant(
      "diamond",
      "volume_king",
      "God of Steel",
      "Dieu de l'Acier",
      2_000_000,
    ),
    grant("gold", "consistency_streak", "Gym Demon", "Démon des Salles", 100),
    grant(
      "platinum",
      "exercise_variety",
      "Fiber Master",
      "Maître des Fibres",
      35,
    ),
    grant("silver", "rhythm_master", "Human Pendulum", "Pendule humaine", 8),
    grant("bronze", "record_hunter", "Ceiling Breaker", "Briseur de plafonds", 1),
  ],
}

export function UnlockOverlayPlaygroundPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Unlock overlay playground</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Not in nav — fixtures only.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FIXTURE_BUTTONS.map((name) => (
          <Button
            key={name}
            type="button"
            variant="outline"
            onClick={() => pushAchievementsToQueue(FIXTURES[name]())}
          >
            {name}
          </Button>
        ))}
      </div>
    </div>
  )
}
