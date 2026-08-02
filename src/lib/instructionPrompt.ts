/**
 * Prompts and response parsing for the instruction-translation pipeline (#417).
 *
 * Pure: builds strings and reads strings. The HTTP calls, the keys and the
 * retry policy stay in `scripts/translate-instructions.ts`. Splitting it this
 * way is what lets the prompt rules and the parser be type-checked and tested,
 * since CI never looks at `scripts/`.
 */
import { INSTRUCTION_SECTIONS, type InstructionSection } from "@/lib/instructionQuality"
import enCatalog from "@/locales/en/catalog.json"
import type { ExerciseInstructions, TranslationAudit } from "@/types/database"

/**
 * Stamped on every row in `instructions_en_audit`. Bump it whenever a rule in
 * `buildPrompt` changes, so a later re-run is diffable rather than a mystery.
 */
export const PROMPT_VERSION = 1

export type TranslationObjection = TranslationAudit["objections"][number]

/** The columns the prompts need. Same shape the CLI selects. */
export interface PromptSubject {
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
  instructions: ExerciseInstructions
}

const MUSCLE_LABELS: Record<string, string> = enCatalog.muscles
const EQUIPMENT_LABELS: Record<string, string> = enCatalog.equipment

export interface Prompt {
  system: string
  user: string
}

/**
 * The translation prompt, unchanged from the spike that measured Gemini 2.5
 * Flash at 29/30 clean rows over a seeded sample of 30. Every rule in it
 * answers a defect that was actually observed, so edits here need their own
 * measurement — and a `PROMPT_VERSION` bump.
 */
export function buildPrompt(subject: PromptSubject): Prompt {
  // Canonical labels are Title Case for badges; lowercase them or the model
  // copies the casing into the middle of sentences.
  const muscleLabel = (
    MUSCLE_LABELS[subject.muscle_group] ?? subject.muscle_group
  ).toLowerCase()
  const equipmentLabel = (
    EQUIPMENT_LABELS[subject.equipment] ?? subject.equipment
  ).toLowerCase()

  const system = `You are an expert strength coach translating exercise coaching cues from French to English. You reply with valid JSON only, no commentary.

Strict rules:
- Translate meaning, not words. The result must read like it was written by an English-speaking coach, not translated.
- Preserve the structure EXACTLY: same keys, same number of items in each array, same order. One French sentence maps to one English sentence.
- Preserve EVERY concrete detail: durations, angles, tempos, degrees, parenthetical anatomical notes. "1-2 secondes" stays "1-2 seconds"; "30-45°" stays "30-45°". Dropping a number is a failure.
- The French source deliberately used French equipment words. Map them back: "haltère" → dumbbell, "barre" → barbell, "poulie" → pulley, "câble" → cable, "élastique" → band, "banc" → bench, "barre de traction" → pull-up bar, "barre EZ" → EZ bar. This exercise's equipment is "${equipmentLabel}"; do not introduce equipment the French source does not mention.
- "décliné" means declined and "incliné" means inclined. Never swap them.
- Anatomy glossary, apply exactly. These two are distinct and must never be swapped: "épaules" → shoulders; "omoplates" → shoulder blades. Also: "hanches" → hips (note "largeur de hanches" is hip-width, NOT shoulder-width), "ischios" → hamstrings, "lombaires" → lower back, "gainage" → bracing or plank depending on context. The target muscle is "${muscleLabel}".
- Address the reader in the second person throughout, consistently: "your back", "your hips", never "the back" or "the hips". Do not switch register between sentences.
- The "common_mistakes" entries NAME an error; they are not instructions. Each one MUST stay a noun phrase in English, normally a gerund. "Arrondir le dos pendant le tirage" → "Rounding your back during the pull", NEVER "Round your back during the pull". An imperative here tells the reader to commit the mistake, which is the opposite of the intent. This applies to every entry in that array without exception.
- Write equipment and muscle names in normal lowercase sentence case, never Title Case, unless they are proper nouns (Smith machine, EZ bar).
- Refer to the exercise as "${subject.name_en ?? subject.name}" if you name it at all.
- Keep standard gym terms as they already are in English (squat, curl, pull-up, deadlift, hip thrust, face pull, plank...).
- Never introduce a number of reps or sets that the French does not state. Never start a sentence with "Repeat" or "Remember".
- Do not add, remove, soften or improve any cue. If the French is wrong, translate it faithfully — correctness is reviewed separately.`

  const user = `Exercise: ${subject.name}${subject.name_en ? ` (${subject.name_en})` : ""}
Muscle group: ${subject.muscle_group} (English: ${MUSCLE_LABELS[subject.muscle_group] ?? subject.muscle_group})
Equipment: ${subject.equipment} (English: ${EQUIPMENT_LABELS[subject.equipment] ?? subject.equipment})

Translate this JSON to English, same shape, same array lengths:

${JSON.stringify(subject.instructions, null, 2)}`

  return { system, user }
}

/**
 * Reads a model response into an instruction block, or `null` when it cannot be
 * trusted. Tolerates prose around the JSON — models wrap it in prose or in a
 * fence often enough that refusing would throw away good translations — but not
 * a missing key or a non-string entry: a partial block must never reach the
 * database.
 */
export function parseInstructions(
  raw: string | null | undefined,
): ExerciseInstructions | null {
  if (typeof raw !== "string") return null
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as ExerciseInstructions
    const wellFormed = INSTRUCTION_SECTIONS.every(
      (section) =>
        Array.isArray(parsed[section]) &&
        parsed[section].every((entry) => typeof entry === "string"),
    )
    return wellFormed ? parsed : null
  } catch {
    return null
  }
}

/** Sentence pairs the cross-checker is asked to rule on, in a stable order. */
const alignedPairs = (source: ExerciseInstructions, translation: ExerciseInstructions) =>
  INSTRUCTION_SECTIONS.flatMap((section) =>
    source[section].flatMap((fr, index) => {
      const en = translation[section][index]
      return en === undefined ? [] : [{ section, index, fr, en }]
    }),
  )

/**
 * Cross-check prompt for the second model. It runs on a different provider from
 * the translator on purpose: correlated errors would make the second opinion
 * worthless, and this is the only thing that can catch "largeur des épaules"
 * rendered as *hip-width* — fluent, structurally identical, and invisible to
 * every regex in the gate.
 */
export function buildReviewPrompt(
  subject: PromptSubject,
  translation: ExerciseInstructions,
): Prompt {
  const system = `You are a bilingual French/English strength-coaching editor. You audit an existing translation of exercise cues, sentence pair by sentence pair, and you reply with valid JSON only, no commentary.

For each numbered pair, decide whether the English says the same thing as the French. Report ONLY real divergences. A different but equivalent wording is not a divergence; neither is a stylistic choice you would have made differently.

These standard renderings are CORRECT. Never report them: "ischios"/"ischio-jambiers" → hamstrings, "épaules" → shoulders, "omoplates" → shoulder blades, "lombaires" → lower back, "fessiers" → glutes, "mollets" → calves, "quadriceps" → quads, "trapèzes" → traps, "abdos" → abs, "gainage" → bracing or plank, "haltère" → dumbbell, "barre" → barbell, "barre EZ" → EZ bar, "poulie" → pulley or cable, "élastique" → band, "banc" → bench, "pupitre" → preacher bench. Translating a French term into its English equivalent is the job, not an error.

When you hesitate, do not report. A false objection sends a correct translation back to a human for nothing.

Report a pair when:
- "meaning-changed": the English states something the French does not, or omits a cue the French gives.
- "measurement-changed": a body-part reference, width, angle, tempo, count or duration differs ("largeur des épaules" rendered as hip-width).
- "equipment-changed": the English names equipment the French does not, or drops the one it names.
- "anatomy-changed": a muscle or joint is swapped for another ("épaules" rendered as shoulder blades).
- "mood-flipped": a "common_mistakes" entry that NAMES an error in French reads as an order in English ("Rounding your back" is right, "Round your back" is not).

Never comment on the French itself, even when it is wrong: the source is out of scope and is corrected elsewhere.

Reply exactly with:
{"objections":[{"section":"setup|movement|breathing|common_mistakes","index":<number>,"verdict":"<one of the labels above>","note":"<one short sentence, in English>"}]}

An empty array means the translation is faithful. Use it when it is.`

  const pairs = alignedPairs(subject.instructions, translation)
    .map(
      ({ section, index, fr, en }) =>
        `[${section} ${index}]\n  FR: ${fr}\n  EN: ${en}`,
    )
    .join("\n")

  const user = `Exercise: ${subject.name}${subject.name_en ? ` (${subject.name_en})` : ""}

${pairs}`

  return { system, user }
}

const isSection = (value: unknown): value is InstructionSection =>
  INSTRUCTION_SECTIONS.some((section) => section === value)

/**
 * Reads the cross-checker's verdict. `null` means "no usable answer" — the
 * caller must treat that as an unavailable checker and flag the row, never as
 * an absence of objections.
 *
 * Objections pointing at a sentence that does not exist are dropped rather than
 * failing the whole response: a hallucinated index says nothing about the other
 * verdicts, and the review screen anchors every objection to a real sentence.
 */
export function parseObjections(
  raw: string | null | undefined,
  translation: ExerciseInstructions,
): TranslationObjection[] | null {
  if (typeof raw !== "string") return null
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { objections?: unknown }
    if (!Array.isArray(parsed.objections)) return null

    return parsed.objections
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .flatMap((entry) => {
        const { section, index, verdict, note } = entry
        return isSection(section) &&
          typeof index === "number" &&
          Number.isInteger(index) &&
          index >= 0 &&
          index < translation[section].length &&
          typeof verdict === "string" &&
          verdict.trim() !== ""
          ? [
              {
                section,
                index,
                verdict: verdict.trim(),
                note: typeof note === "string" ? note.trim() : "",
              },
            ]
          : []
      })
  } catch {
    return null
  }
}
