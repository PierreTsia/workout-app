import { Button } from "@/components/ui/button"
import { pushAchievementsToQueue } from "@/lib/syncService"
import type { AchievementRank, UnlockedAchievement } from "@/types/achievements"

const CEREMONY_BUTTONS = [
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

const BODYWEIGHT_BUTTONS = [
  "Pompes ladder",
  "Tractions diamond",
  "Squat diamond",
  "Expert diamond",
  "Hard Time diamond",
  "BW mixed",
] as const

const FIXTURE_BUTTONS = [...CEREMONY_BUTTONS, ...BODYWEIGHT_BUTTONS] as const

type FixtureName = (typeof FIXTURE_BUTTONS)[number]

const ICON_BASE =
  "https://favusepjqwpcroiolvaz.supabase.co/storage/v1/object/public/badge-icons"

function grant(
  rank: AchievementRank,
  group_slug: string,
  title_en: string,
  title_fr: string,
  threshold_value: number,
  icon_asset_url: string | null = null,
): UnlockedAchievement {
  return {
    tier_id: crypto.randomUUID(),
    group_slug,
    rank,
    title_en,
    title_fr,
    icon_asset_url,
    threshold_value,
    granted_at: new Date().toISOString(),
  }
}

function bwGrant(
  rank: AchievementRank,
  group_slug: string,
  title_en: string,
  title_fr: string,
  threshold_value: number,
): UnlockedAchievement {
  return grant(
    rank,
    group_slug,
    title_en,
    title_fr,
    threshold_value,
    `${ICON_BASE}/${group_slug}_${rank}.webp`,
  )
}

const PUSH_UPS_LADDER = [
  {
    rank: "bronze",
    title_en: "Nose to Floor",
    title_fr: "Nez au sol",
    threshold_value: 100,
  },
  {
    rank: "silver",
    title_en: "Piston",
    title_fr: "Piston",
    threshold_value: 500,
  },
  {
    rank: "gold",
    title_en: "Push-up Wall",
    title_fr: "Mur de pompes",
    threshold_value: 2_500,
  },
  {
    rank: "platinum",
    title_en: "The Jack",
    title_fr: "Le Vérin",
    threshold_value: 10_000,
  },
  {
    rank: "diamond",
    title_en: "The Eternal Pump",
    title_fr: "La Pompe éternelle",
    threshold_value: 25_000,
  },
] as const satisfies readonly {
  rank: AchievementRank
  title_en: string
  title_fr: string
  threshold_value: number
}[]

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
  "Pompes ladder": () =>
    PUSH_UPS_LADDER.map((tier) =>
      bwGrant(
        tier.rank,
        "push_ups",
        tier.title_en,
        tier.title_fr,
        tier.threshold_value,
      ),
    ),
  "Tractions diamond": () => [
    bwGrant(
      "diamond",
      "pull_ups",
      "King of the Bar",
      "Le Roi de la barre",
      25_000,
    ),
  ],
  "Squat diamond": () => [
    bwGrant(
      "diamond",
      "bw_squats",
      "The Eternal Well",
      "Le Puits éternel",
      25_000,
    ),
  ],
  "Expert diamond": () => [
    bwGrant(
      "diamond",
      "bw_expert",
      "Bodyweight Expert",
      "Expert du poids du corps",
      25_000,
    ),
  ],
  "Hard Time diamond": () => [
    bwGrant("diamond", "hundred_a_day", "Hard Time", "100 jours ferme", 100),
  ],
  "BW mixed": () => [
    bwGrant("gold", "push_ups", "Push-up Wall", "Mur de pompes", 2_500),
    bwGrant("silver", "pull_ups", "V-Taper", "Dos en V", 500),
    bwGrant("bronze", "bw_squats", "Ass to Grass", "Cul vers l'herbe", 100),
    bwGrant("platinum", "bw_expert", "Calisthenist", "Calisthéniste", 10_000),
    bwGrant("gold", "hundred_a_day", "A Month Inside", "Un mois ferme", 30),
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
        {CEREMONY_BUTTONS.map((name) => (
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
      <div className="flex flex-wrap gap-2">
        {BODYWEIGHT_BUTTONS.map((name) => (
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
