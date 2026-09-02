import { describe, expect, it } from "vitest"
import en from "@/locales/en/program.json"
import fr from "@/locales/fr/program.json"

describe("program i18n contract", () => {
  it("matches the Tech Plan EN and FR values", () => {
    expect(en.band.short).toBe("Low")
    expect(en.band.ok).toBe("Moderate")
    expect(en.band.high).toBe("High")
    expect(en.rubric.hypertrophy).toBe(
      "Moderate: most muscles you programmed hit 8–20 sets and 2–3 days this week.",
    )
    expect(en.rubric.strength).toBe(
      "Moderate: 20–40% of your sets are 6 reps or fewer, with rest of 150 seconds or more.",
    )
    expect(en.rubric.endurance).toBe(
      "Moderate: one Circuit, or enough short-rest high-rep sets.",
    )
    expect(en.rubric.balance).toBe(
      "A score out of 100 for how much the program works all your muscle groups. 70 to 100 is balanced; 50 to 69 needs a look; under 50, a few muscles do almost all the work.",
    )
    expect(en.example.hypertrophy).toBe(
      "{{muscle}}: {{sets}} sets · {{days}} days → {{band}}",
    )
    expect(en.facts.stat.days).toBe("Days")
    expect(en.facts.stat.sets).toBe("Sets")
    expect(en.facts.stat.circuits).toBe("Circuits")
    expect(en.facts.mix.free).toBe("Free weights")
    expect(en.facts.mix.machine).toBe("Machines")
    expect(en.facts.mix.bodyweight).toBe("Bodyweight")
    expect(en.facts.mix.other).toBe("Other")
    expect(en.empty.scores).toBe("Add a day to see what this program is for.")
    expect(en.notFound).toBe("This program isn’t here.")
    expect(en.notFoundBack).toBe("Back to programs")
    expect(en.loadError).toBe("We couldn’t load this program.")
    expect(en.offline).toBe(
      "Scores will show when this week is already on the phone.",
    )
    expect(en.edit).toBe("Edit")
    expect(en.pageTitle).toBe("Program")
    expect(en.focus.label).toBe("Built for")
    expect(en.focus.help).toBe("Why this goal")
    expect(en.focus.fit).toBe(
      "This program looks better for {{goal}}, because {{reason}}.",
    )
    expect(en.focus.reason.hypertrophy).toBe(
      "most muscles you programmed hit 8–20 sets and 2–3 days this week",
    )
    expect(en.focus.reason.strength).toBe(
      "20–40% of your sets are 6 reps or fewer, with rest of 150 seconds or more",
    )
    expect(en.focus.reason.endurance).toBe(
      "it has a Circuit, or enough high-rep sets with short rest",
    )
    expect(en.balance.help).toBe("What this score means")
    expect(en.days.preview).toBe("Exercises on {{day}}")
    expect(en.days.empty).toBe("Nothing on this day yet.")
    expect(en.days.index).toBe("Day {{count}}")
    expect(en.days.edit).toBe("Edit {{day}}")

    expect(fr.band.short).toBe("Faible")
    expect(fr.band.ok).toBe("Modéré")
    expect(fr.band.high).toBe("Élevé")
    expect(fr.rubric.hypertrophy).toBe(
      "Modéré : la plupart des muscles que tu as mis dans la semaine ont 8–20 séries et 2–3 jours.",
    )
    expect(fr.rubric.strength).toBe(
      "Modéré : 20–40 % des séries font 6 reps ou moins, avec 150 secondes de repos ou plus.",
    )
    expect(fr.rubric.endurance).toBe(
      "Modéré : un Circuit, ou assez de séries à reps hautes et repos court.",
    )
    expect(fr.rubric.balance).toBe(
      "Un score sur 100 qui évalue à quel point le programme travaille l'ensemble des groupes musculaires. De 70 à 100, c'est équilibré ; 50 à 69, à surveiller ; sous 50, quelques muscles font presque tout.",
    )
    expect(fr.example.hypertrophy).toBe(
      "{{muscle}} : {{sets}} séries · {{days}} j → {{band}}",
    )
    expect(fr.facts.stat.days).toBe("Jours")
    expect(fr.facts.stat.sets).toBe("Séries")
    expect(fr.facts.stat.circuits).toBe("Circuits")
    expect(fr.facts.mix.free).toBe("Charges libres")
    expect(fr.facts.mix.machine).toBe("Machines")
    expect(fr.facts.mix.bodyweight).toBe("Poids du corps")
    expect(fr.facts.mix.other).toBe("Autre")
    expect(fr.empty.scores).toBe(
      "Ajoute un jour pour voir à quoi sert ce programme.",
    )
    expect(fr.notFound).toBe("Ce programme n’est pas là.")
    expect(fr.notFoundBack).toBe("Retour aux programmes")
    expect(fr.loadError).toBe("On n’a pas pu charger ce programme.")
    expect(fr.offline).toBe(
      "Les scores s’affichent si la semaine est déjà sur le téléphone.",
    )
    expect(fr.edit).toBe("Éditer")
    expect(fr.pageTitle).toBe("Programme")
    expect(fr.track.balance).toBe("Équilibre")
    expect(fr.focus.label).toBe("Fait pour")
    expect(fr.focus.help).toBe("Pourquoi cet objectif")
    expect(fr.focus.fit).toBe(
      "Ce programme paraît plus fait pour {{goal}}, parce que {{reason}}.",
    )
    expect(fr.focus.reason.hypertrophy).toBe(
      "la plupart des muscles de la semaine ont 8–20 séries et 2–3 jours",
    )
    expect(fr.focus.reason.strength).toBe(
      "20–40 % des séries font 6 reps ou moins, avec 150 secondes de repos ou plus",
    )
    expect(fr.focus.reason.endurance).toBe(
      "tu as un Circuit, ou assez de séries à reps hautes et repos court",
    )
    expect(fr.balance.help).toBe("Ce que ce score veut dire")
    expect(fr.days.preview).toBe("Exercices du jour {{day}}")
    expect(fr.days.empty).toBe("Rien ce jour-là pour l'instant.")
    expect(fr.days.index).toBe("Jour {{count}}")
    expect(fr.days.edit).toBe("Éditer {{day}}")
  })
})
