import {
  Callout,
  Divider,
  H1,
  H2,
  Pill,
  Row,
  Spacer,
  Stack,
  Table,
  Text,
} from "cursor/canvas"

type Verdict = "keep" | "merge" | "cut" | "caler"

type CopyRow = {
  slot: string
  fr: string
  en: string
}

type Section = {
  order: string
  name: string
  verdict: Verdict
  job: string
  challenge: string
  rows: CopyRow[]
}

const VERDICT_LABEL: Record<Verdict, string> = {
  keep: "Garder",
  merge: "Fusionner",
  cut: "Couper",
  caler: "À caler",
}

const SECTIONS: Section[] = [
  {
    order: "1.1",
    name: "Hero",
    verdict: "keep",
    job: "Qui s’entraîne, sous quel titre, sur quel plan — maintenant.",
    challenge:
      "La ligne « aussi PPL cette semaine » est honnête pour un hopper. Si un seul Programme est actif, elle disparaît — ne pas afficher Cycle 2 / 11/16 ici.",
    rows: [
      { slot: "H2", fr: "(pas de titre)", en: "(no heading)" },
      { slot: "Titre équipé", fr: "{title}", en: "{title}" },
      { slot: "Plan", fr: "Actif · {program}", en: "Active · {program}" },
      { slot: "Hop", fr: "Aussi {other} cette semaine", en: "Also {other} this week" },
      { slot: "Streak", fr: "Série · {n} j", en: "Streak · {n} d" },
    ],
  },
  {
    order: "1.2",
    name: "Succès",
    verdict: "keep",
    job: "Trois objets distincts : le dernier reçu, le plus haut palier, les récents de la fenêtre.",
    challenge:
      "Le tableau « derniers reçus » est le job de /achievements. Sur le Profil : deux cartes + une rangée, pas une table. Sinon le fold est une vitrine de badges.",
    rows: [
      { slot: "H2", fr: "Succès", en: "Achievements" },
      { slot: "Compte", fr: "{n} / {total}", en: "{n} / {total}" },
      { slot: "CTA", fr: "Voir tout", en: "See all" },
      { slot: "Carte A", fr: "Plus récent", en: "Latest" },
      { slot: "Carte B", fr: "Plus haut", en: "Highest" },
      { slot: "Liste", fr: "Derniers reçus", en: "Recently earned" },
      { slot: "Métal", fr: "Bronze · Argent · Or · Platine · Diamant", en: "Bronze · Silver · Gold · Platinum · Diamond" },
      { slot: "Vide", fr: "Aucun succès pour l’instant.", en: "No achievements yet." },
    ],
  },
  {
    order: "1.3",
    name: "Cette fenêtre",
    verdict: "keep",
    job: "Est-ce que ce bloc de 7 / 30 / 100 jours avance — comparable à la fenêtre d’avant.",
    challenge:
      "Quatre stats, c’est trop. « Séances / sem » double le Rythme. Trois : séances, temps sous barre, durée moy. vs prescrit.",
    rows: [
      { slot: "H2", fr: "(pas de titre)", en: "(no heading)" },
      { slot: "Toggle", fr: "7j · 30j · 100j", en: "7d · 30d · 100d" },
      { slot: "Stat 1", fr: "Séances", en: "Sessions" },
      { slot: "Delta", fr: "+{n} vs préc.", en: "+{n} vs prior" },
      { slot: "Delta 0", fr: "stable vs préc.", en: "even vs prior" },
      { slot: "Stat 2", fr: "Temps sous barre", en: "Time under the bar" },
      { slot: "Stat 3", fr: "Durée moy.", en: "Avg duration" },
      { slot: "Vs prescrit", fr: "vs {n} min prescrits", en: "vs {n} min prescribed" },
    ],
  },
  {
    order: "1.4",
    name: "Rythme",
    verdict: "keep",
    job: "Quand tu t’es présenté. Grain = jour (7j) ou semaine ISO (30 / 100).",
    challenge:
      "Les anneaux « skip vs plan » seulement si un seul Programme a assez de séances dans la fenêtre. Sinon : présence, pas fidélité.",
    rows: [
      { slot: "H2", fr: "Rythme", en: "Rhythm" },
      { slot: "7j", fr: "7 derniers jours", en: "Last 7 days" },
      { slot: "30j", fr: "5 semaines", en: "5 weeks" },
      { slot: "100j", fr: "12 semaines", en: "12 weeks" },
      { slot: "Légende séance", fr: "Séance", en: "Session" },
      { slot: "Légende vide", fr: "Pas de séance", en: "No session" },
      { slot: "Cible", fr: "Cible · {n} j / sem", en: "Target · {n} days / week" },
    ],
  },
  {
    order: "1.5",
    name: "Mix",
    verdict: "caler",
    job: "D’où viennent les séances de la fenêtre — même grain que le Rythme.",
    challenge:
      "Pgm / QW / Circuits en stacked exclusif : un jour Upper A avec Cindy, tu dois choisir une part. Origine (program_id) et forme (Circuit) ne sont pas orthogonales. À trancher au brief, pas dans la légende.",
    rows: [
      { slot: "H2", fr: "Mix", en: "Mix" },
      { slot: "Série A", fr: "Programme", en: "Program" },
      { slot: "Série B", fr: "Quick Workout", en: "Quick Workout" },
      { slot: "Série C", fr: "Circuits", en: "Circuits" },
      { slot: "Total", fr: "{a} Programme · {b} Quick Workout · {c} Circuits", en: "{a} Program · {b} Quick Workout · {c} Circuits" },
    ],
  },
  {
    order: "2.1",
    name: "Records",
    verdict: "keep",
    job: "Combien de PRs dans la fenêtre, sur combien de mouvements, à quel rythme.",
    challenge:
      "Unité hero = séance × exercice. Combo : barres PRs (axe gauche), ligne % RIR 0 (axe droit). Trois stats : PRs, exercices, sécheresse.",
    rows: [
      { slot: "H2", fr: "Records", en: "Records" },
      { slot: "Stat 1", fr: "PRs", en: "PRs" },
      { slot: "Stat 2", fr: "Exercices", en: "Exercises" },
      { slot: "Stat 3", fr: "Depuis le dernier", en: "Since last" },
      { slot: "Série A", fr: "PRs (barres)", en: "PRs (bars)" },
      { slot: "Série B", fr: "% RIR 0 (ligne)", en: "% RIR 0 (line)" },
      { slot: "Axe gauche", fr: "PRs", en: "PRs" },
      { slot: "Axe droit", fr: "%", en: "%" },
      { slot: "Marqueur table", fr: "RIR 0", en: "RIR 0" },
      { slot: "Vide", fr: "Pas de PR dans cette fenêtre.", en: "No PRs in this window." },
    ],
  },
  {
    order: "2.2",
    name: "Équilibre",
    verdict: "keep",
    job: "Le fer est-il réparti — et combien a bougé, vs la même fenêtre décalée.",
    challenge:
      "Desktop : 2 colonnes égales (radar | tonnage). Mobile : empilé. Tonnage = sets chargés only (poids × reps), pas la somme des 13 axes. BW / durée / Circuits hors compte. Pas une 4e puce pulse.",
    rows: [
      { slot: "H2", fr: "Équilibre", en: "Balance" },
      { slot: "Pill", fr: "{score} · {bande}", en: "{score} · {band}" },
      { slot: "Bandes", fr: "Excellent · Bon · À surveiller · Déséquilibré", en: "Excellent · Good · Needs work · Imbalanced" },
      { slot: "Delta score", fr: "+{n} vs {fenêtre} préc.", en: "+{n} vs prior {window}" },
      { slot: "Radar plein", fr: "Fenêtre", en: "Window" },
      { slot: "Radar pointillé", fr: "Même durée, décalée", en: "Same length, shifted" },
      { slot: "Colonne 2", fr: "Tonnage", en: "Tonnage" },
      { slot: "Valeur", fr: "{n,1} t", en: "{n.1} t" },
      { slot: "Delta fer", fr: "+{n,1} t vs préc.", en: "+{n.1} t vs prior" },
      { slot: "Légende", fr: "Sets chargés · poids × reps", en: "Loaded sets · weight × reps" },
      { slot: "Hors compte", fr: "BW, durée, Circuits hors compte", en: "Bodyweight, duration, Circuits excluded" },
      { slot: "Vide", fr: "Pas assez de séances pour un score.", en: "Not enough sessions for a score." },
    ],
  },
  {
    order: "3.1",
    name: "Récurrents",
    verdict: "keep",
    job: "Quels mouvements tu répètes vraiment — pas ceux du plan, pas tes PRs.",
    challenge:
      "Cindy apparaît ici et dans Circuits. Ici c’est l’habitude (fréquence × récence). Là-bas c’est le score. Deux jobs, même nom : assumer, ne pas dédupliquer en cachant l’un.",
    rows: [
      { slot: "H2", fr: "Récurrents", en: "Regulars" },
      { slot: "Sous-titre", fr: "Les plus loggés · 100 jours", en: "Most logged · 100 days" },
      { slot: "Badge on", fr: "Sur le programme", en: "On program" },
      { slot: "Badge off", fr: "Hors plan", en: "Off program" },
      { slot: "Colonne dernière", fr: "Dernière", en: "Last" },
      { slot: "Vide", fr: "Pas assez de logs sur 100 jours.", en: "Not enough logs in 100 days." },
    ],
  },
  {
    order: "3.2",
    name: "Circuits",
    verdict: "keep",
    job: "Tes épreuves nommées : dernier score, PB, tendance. Type-aware (AMRAP ≠ temps).",
    challenge:
      "Pas « Circuits / Benchmarks » — un mot. Les Tours jetables (temps) restent dans History. Ici : catalog, slug, fingerprint. Olympiens est un succès, pas un quatrième stat.",
    rows: [
      { slot: "H2", fr: "Circuits", en: "Circuits" },
      { slot: "Stat 1", fr: "Runs", en: "Runs" },
      { slot: "Stat 2", fr: "Circuits distincts", en: "Distinct circuits" },
      { slot: "Stat 3", fr: "PBs", en: "PBs" },
      { slot: "Pill PB", fr: "PB fenêtre", en: "PB this window" },
      { slot: "Mode", fr: "AMRAP {n}", en: "AMRAP {n}" },
      { slot: "Delta AMRAP", fr: "+{n} vs préc.", en: "+{n} vs prior" },
      { slot: "Cast", fr: "Olympiens {n} / 4", en: "Olympians {n} / 4" },
      { slot: "Vide", fr: "Aucun circuit dans cette fenêtre.", en: "No circuits in this window." },
    ],
  },
  {
    order: "—",
    name: "Régularité (séances / mois)",
    verdict: "cut",
    job: "Cousin de l’onglet Activité dans History.",
    challenge:
      "On a dit que History ne bouge pas. Recopier le mensuel ici, c’est garantir un follow-up pour l’effacer. Le Rythme fait déjà la présence.",
    rows: [
      { slot: "H2", fr: "(ne pas mettre)", en: "(do not ship)" },
    ],
  },
]

function SectionBlock({ section }: { section: Section }) {
  return (
    <Stack gap={10}>
      <Row align="center" wrap>
        <Text size="small" tone="tertiary">
          {section.order}
        </Text>
        <H2>{section.name}</H2>
        <Spacer />
        <Pill active={section.verdict === "keep"}>{VERDICT_LABEL[section.verdict]}</Pill>
      </Row>
      <Text weight="semibold">{section.job}</Text>
      <Text size="small" tone="secondary">
        {section.challenge}
      </Text>
      <Table
        headers={["Slot", "FR", "EN"]}
        rows={section.rows.map((r) => [r.slot, r.fr, r.en])}
        columnAlign={["left", "left", "left"]}
      />
    </Stack>
  )
}

export default function ProfileCopyDeck() {
  return (
    <Stack gap={24}>
      <H1>Profil — structure + copies</H1>
      <Callout tone="neutral" title="Trois actes, pas onze widgets">
        1 · Cette fenêtre : Hero, Succès compact, stats, Rythme, Mix. 2 · Preuve :
        Records (barres PRs + ligne % RIR 0, axe droit), Équilibre. 3 · Pratique :
        Récurrents, Circuits. Couper le mensuel. Caler le Mix exclusif au brief.
      </Callout>
      <Callout tone="warning" title="Le fold">
        Mix + Rythme au-dessus de Records. Si Records remonte, on a le dashboard
        Hevy. Succès : deux cartes sous le hero, pas le tableau.
      </Callout>

      {SECTIONS.map((section) => (
        <div key={section.order + section.name}>
          <Stack gap={24}>
            <Divider />
            <SectionBlock section={section} />
          </Stack>
        </div>
      ))}
    </Stack>
  )
}
