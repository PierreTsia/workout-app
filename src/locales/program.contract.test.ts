import { describe, expect, it } from "vitest"
import en from "@/locales/en/program.json"
import fr from "@/locales/fr/program.json"

describe("program i18n contract", () => {
  it("matches the Tech Plan EN and FR values", () => {
    expect(en.rubric.hypertrophy).toBe(
      "On target means most muscles you programmed hit 8–20 sets and 2–3 days this week.",
    )
    expect(en.rubric.strength).toBe(
      "On target means 20–40% of your sets are 6 reps or fewer, with rest of 150 seconds or more.",
    )
    expect(en.rubric.endurance).toBe(
      "On target means one Circuit, or enough short-rest high-rep sets.",
    )
    expect(en.rubric.balance).toBe(
      "A number from how evenly this week hits the muscle list. Not last month’s sessions.",
    )
    expect(en.example.hypertrophy).toBe(
      "{{muscle}}: {{sets}} sets · {{days}} days → {{band}}",
    )
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

    expect(fr.rubric.hypertrophy).toBe(
      "Dans le viseur : la plupart des muscles que tu as mis dans la semaine ont 8–20 séries et 2–3 jours.",
    )
    expect(fr.rubric.strength).toBe(
      "Dans le viseur : 20–40 % des séries font 6 reps ou moins, avec 150 secondes de repos ou plus.",
    )
    expect(fr.rubric.endurance).toBe(
      "Dans le viseur : un Circuit, ou assez de séries à reps hautes et repos court.",
    )
    expect(fr.rubric.balance).toBe(
      "Un nombre : à quel point cette semaine touche les muscles de façon égale. Pas tes séances d’hier.",
    )
    expect(fr.example.hypertrophy).toBe(
      "{{muscle}} : {{sets}} séries · {{days}} j → {{band}}",
    )
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
    expect(fr.track.balance).toBe("Répartition")
    expect(JSON.stringify(fr)).not.toMatch(/Équilibre/)
  })
})
