/**
 * Automated quality gate over a (French source, English translation) pair.
 *
 * Pure by construction: no I/O, no network, no Supabase. It lives in `src/`
 * rather than next to the CLI that calls it because `tsconfig.app.json` only
 * includes `src`, so nothing under `scripts/` is type-checked — and the gate is
 * the one part of the pipeline that has to be right.
 *
 * Every check compares the English against ITS OWN French source, never against
 * the `equipment` column. Checking against the column produced only false
 * positives during the spike: the French of a cable row genuinely says
 * "machine", and a Smith machine row genuinely mentions a bench and a bar.
 */
import enCatalog from "@/locales/en/catalog.json"
import type { ExerciseInstructions } from "@/types/database"

export const INSTRUCTION_SECTIONS = [
  "setup",
  "movement",
  "breathing",
  "common_mistakes",
] as const satisfies readonly (keyof ExerciseInstructions)[]

export type InstructionSection = (typeof INSTRUCTION_SECTIONS)[number]

/** The columns of the source row the gate reads. */
export interface TranslationSubject {
  muscle_group: string
  instructions: ExerciseInstructions
}

const MUSCLE_LABELS: Record<string, string> = enCatalog.muscles
const EQUIPMENT_LABELS: Record<string, string> = enCatalog.equipment

/**
 * `\b` is defined on the ASCII word class, so it sees no boundary next to an
 * accented letter: `\bépaules\b` and `\bélastique\b` can never match, and the
 * term is skipped in silence. Unicode-property lookarounds are the only safe
 * boundary here.
 */
const word = (pattern: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, "iu")

/**
 * English equipment noun → the French words whose presence would justify it.
 *
 * `bench` carries synonyms because the French names a preacher bench after
 * Larry Scott and never says "banc": the spike flagged "pupitre Larry Scott" →
 * "preacher bench" as invented equipment, which is the correct translation.
 */
const EQUIPMENT_EVIDENCE: ReadonlyArray<readonly [en: string, fr: readonly string[]]> = [
  ["barbell", ["barre"]],
  ["dumbbell", ["haltère", "haltere"]],
  ["cable", ["câble", "cable", "poulie"]],
  ["pulley", ["poulie"]],
  ["machine", ["machine"]],
  ["kettlebell", ["kettlebell"]],
  ["band", ["élastique", "elastique", "bande"]],
  ["bench", ["banc", "pupitre", "larry scott"]],
  ["smith machine", ["smith"]],
]

/**
 * An alternation over labels taken literally.
 *
 * The labels are data: they live in the catalog JSON under `src/locales` and
 * change with content work, not with code review. A label like "Deltoids
 * (rear)" or "Abs (lower)" would silently widen the pattern or throw at module
 * load, so nothing is left to chance about what a label means inside a regex.
 * Exported for the test that
 * proves it, since the labels themselves reach this module through a static
 * import with no seam to inject through.
 */
export const buildLabelPattern = (labels: readonly string[]): string =>
  labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")

/**
 * Title Case bleed: a canonical badge label ("Lower back", "EZ Bar") copied
 * into the middle of a sentence. Applied to one sentence at a time, so the
 * `(?<!^)` guard actually protects a sentence opener — over the whole block
 * joined together it only ever protected the very first one, which is how
 * "Lower back to 90°" was reported as a stray muscle label when `Lower` is a
 * verb.
 */
const CASING_BLEED = new RegExp(
  `(?<!^)(?<![.!?—:]\\s)(?<![\\p{L}\\p{N}])(${buildLabelPattern(
    [
      ...Object.values(MUSCLE_LABELS),
      ...Object.values(EQUIPMENT_LABELS),
      "Pulley",
    ].filter((label) => label !== "Other"),
  )})(?![\\p{L}\\p{N}])`,
  "u",
)

const REP_PATTERNS = [
  /\b\d+\s*(?:to|-|–)\s*\d+\s*(?:reps?|repetitions?|sets?)\b/i,
  /\b\d+\s*(?:reps?|repetitions?|sets?)\b/i,
  /\bsets? of \d+/i,
]

const FRENCH_LEFTOVERS = word(
  "le|la|les|des|une|vous|votre|jambes?|haltères?|poulie|élastiques?|gainage|serrez|gardez|expirez|inspirez",
)

/** French anatomical calques a coach would not write in English. */
const CALQUES = word(
  "retroversion|rétroversion|anteversion|coccyx|clavicular bundle|dorsal|lumbars?|ischio[-\\s]?jambiers?|deltoids? bundle",
)

const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).sort()

/**
 * Body parts referenced as "your back" versus "the back". Mixing the two inside
 * one exercise reads as two authors, and it is invisible to every other check —
 * a run can be flawless on the gate and still switch register mid-sentence.
 */
const BODY_PART =
  /\b(your|the)\s+(back|hips?|knees?|elbows?|shoulders?|shoulder blades?|glutes|core|chest|legs?|feet|foot|arms?|wrists?|ankles?|pelvis|torso|head|abs|hamstrings|quads|calves|spine|neck)\b/gi

export interface SecondPersonRatio {
  total: number
  yours: number
}

const secondPersonRatio = (text: string): SecondPersonRatio | null => {
  const articles = [...text.matchAll(BODY_PART)].map(([, article]) =>
    article.toLowerCase(),
  )
  return articles.length === 0
    ? null
    : {
        total: articles.length,
        yours: articles.filter((article) => article === "your").length,
      }
}

/**
 * Sentence-aligned glossary. Structure parity means French sentence i maps to
 * English sentence i, so a term present on one side must be present on the
 * other. This is the only regex check that sees semantic drift — a
 * mistranslation reads fluently, keeps the structure, invents no equipment and
 * drops no number.
 *
 * It is a net, not a proof: it rewards keyword PRESENCE, not meaning. The spike
 * saw it pass "let your shoulders hang loosely at your sides" for someone
 * hanging from a pull-up bar, purely because the token was there. Catching that
 * class of defect is the cross-checker's job, not this one's.
 */
const GLOSSARY: ReadonlyArray<{
  term: string
  fr: RegExp
  en: RegExp
  /** A term routinely substituted for the right one; its presence is a violation by itself. */
  not?: RegExp
}> = [
  // "shoulders" must stand alone: a sentence naming both omoplates and épaules
  // has to translate both, and "shoulder blades" is not evidence of "shoulders".
  {
    term: "épaules",
    fr: word("épaules?"),
    en: /(?<![\p{L}\p{N}])shoulders?(?!\s*[- ]\s*blades?)(?![\p{L}\p{N}])/iu,
  },
  { term: "omoplates", fr: word("omoplates?"), en: word("shoulder blades?|scapulae?") },
  { term: "ischios", fr: word("ischios?|ischio-jambiers?"), en: word("hamstrings?") },
  { term: "lombaires", fr: word("lombaires?"), en: word("lower back|lumbar") },
  { term: "fessiers", fr: word("fessiers?"), en: word("glutes?|gluteal") },
  { term: "mollets", fr: word("mollets?"), en: word("calves?|calf") },
  { term: "genoux", fr: word("genoux?"), en: word("knees?") },
  // "largeur de hanches" came back as "shoulder-width" — hip-width is the tell.
  { term: "hanches", fr: word("hanches?"), en: word("hips?") },
  { term: "coudes", fr: word("coudes?"), en: word("elbows?") },
  { term: "chevilles", fr: word("chevilles?"), en: word("ankles?") },
  { term: "poignets", fr: word("poignets?"), en: word("wrists?") },
  { term: "haltère", fr: word("haltères?"), en: word("dumbbells?"), not: word("barbells?") },
  { term: "élastique", fr: word("élastiques?"), en: word("bands?") },
  { term: "banc", fr: word("bancs?"), en: word("bench(?:es)?") },
]

export interface GlossaryViolation {
  section: InstructionSection
  index: number
  term: string
  fr: string
  en: string
  /** The English used a term this one is commonly confused with. */
  confused: boolean
}

const glossaryViolations = (
  section: InstructionSection,
  fr: readonly string[],
  en: readonly string[],
): GlossaryViolation[] =>
  fr.flatMap((sentence, index) => {
    const translated = en[index] ?? ""
    return GLOSSARY.filter((entry) => entry.fr.test(sentence)).flatMap((entry) => {
      const confused = entry.not?.test(translated) ?? false
      return !entry.en.test(translated) || confused
        ? [{ section, index, term: entry.term, fr: sentence, en: translated, confused }]
        : []
    })
  })

/**
 * Base-form verbs seen opening a `common_mistakes` entry. The check is a
 * heuristic, not a parser: an entry NAMES an error, so it should be a gerund or
 * a noun phrase — an opening base-form verb reads as an instruction to commit
 * the mistake. Unlisted verbs fall through as `unclassified` rather than being
 * silently counted as clean, so the miss rate stays visible.
 */
const IMPERATIVE_VERBS: ReadonlySet<string> = new Set([
  "allow", "arch", "avoid", "bend", "bounce", "bring", "cheat", "collapse",
  "cross", "curl", "do", "don't", "drop", "extend", "flare", "flex", "forget",
  "go", "hold", "hunch", "jerk", "keep", "lean", "let", "lift", "lock", "look",
  "lower", "move", "neglect", "overextend", "pinch", "place", "press", "pull",
  "push", "raise", "relax", "release", "rely", "rest", "rock", "roll", "rotate",
  "round", "rush", "shrug", "sit", "skip", "squeeze", "stand", "start", "stop",
  "straighten", "swing", "throw", "tilt", "touch", "turn", "twist", "use",
])

export type MistakeMood = "noun-phrase" | "imperative" | "unclassified"

/**
 * Some cues open with a phase label — "Jerk: pushing only with your arms" — and
 * the label is a noun, not the verb under test.
 */
const stripLabel = (sentence: string) => sentence.replace(/^[^:]{1,24}:\s*/u, "")

export function moodOf(sentence: string): MistakeMood {
  const first = stripLabel(sentence)
    .trim()
    .split(/[\s,;:—-]+/)[0]
    ?.toLowerCase()
    .replace(/[^\p{L}']/gu, "")
  if (!first) return "unclassified"
  if (first.endsWith("ing")) return "noun-phrase"
  return IMPERATIVE_VERBS.has(first) ? "imperative" : "unclassified"
}

export interface MistakeMoodEntry {
  sentence: string
  mood: MistakeMood
}

export interface TranslationChecks {
  /** Every section has the same number of entries on both sides. */
  lengthParity: boolean
  /** Numbers present in the French and absent from the English. */
  droppedNumbers: string[]
  /** English equipment nouns with no French word to justify them. */
  inventedEquipment: string[]
  /** The French muscle-group name survived into the English text. */
  untranslatedMuscle: boolean
  /** A canonical badge label copied Title Case into mid-sentence, or null. */
  casingBleed: string | null
  glossary: GlossaryViolation[]
  imperativeMistakes: MistakeMoodEntry[]
  unclassifiedMistakes: number
  calques: string[]
  /** "your back" vs "the back" tally, or null when no body part is named. */
  person: SecondPersonRatio | null
  prescribesReps: boolean
  frenchLeftovers: boolean
  charsFr: number
  charsEn: number
}

export function checkTranslation(
  subject: TranslationSubject,
  translation: ExerciseInstructions,
): TranslationChecks {
  const enSentences = INSTRUCTION_SECTIONS.flatMap((section) => translation[section])
  const frSentences = INSTRUCTION_SECTIONS.flatMap(
    (section) => subject.instructions[section],
  )
  const enText = enSentences.join(" ")
  const frText = frSentences.join(" ")
  const enLower = enText.toLowerCase()
  const frLower = frText.toLowerCase()

  const lengthParity = INSTRUCTION_SECTIONS.every(
    (section) => translation[section].length === subject.instructions[section].length,
  )

  // The number-preservation check is what caught "1-2 secondes" being dropped.
  const enNumbers = new Set(numbersIn(enText))
  const droppedNumbers = numbersIn(frText).filter((n) => !enNumbers.has(n))

  // Substring matching, not `word()`: `.includes()` is immune to the accent
  // trap because it never inspects the surrounding characters.
  const inventedEquipment = EQUIPMENT_EVIDENCE.filter(
    ([en, evidence]) =>
      enLower.includes(en) && !evidence.some((fr) => frLower.includes(fr)),
  ).map(([en]) => en)

  const frMuscle = subject.muscle_group.toLowerCase()
  const enMuscle = (MUSCLE_LABELS[subject.muscle_group] ?? subject.muscle_group).toLowerCase()

  const moods = translation.common_mistakes.map((sentence) => ({
    sentence,
    mood: moodOf(sentence),
  }))

  return {
    lengthParity,
    droppedNumbers,
    inventedEquipment,
    // Biceps and Triceps are spelled identically in both languages: comparing
    // them would flag every correct translation.
    untranslatedMuscle:
      frMuscle !== enMuscle && enLower.includes(frMuscle) && !enLower.includes(enMuscle),
    casingBleed:
      enSentences
        .map((sentence) => CASING_BLEED.exec(sentence)?.[1] ?? null)
        .find((match) => match !== null) ?? null,
    // Sentence i ↔ sentence i only holds while the arrays line up.
    glossary: lengthParity
      ? INSTRUCTION_SECTIONS.flatMap((section) =>
          glossaryViolations(
            section,
            subject.instructions[section],
            translation[section],
          ),
        )
      : [],
    imperativeMistakes: moods.filter(({ mood }) => mood === "imperative"),
    unclassifiedMistakes: moods.filter(({ mood }) => mood === "unclassified").length,
    calques: [...enText.matchAll(new RegExp(CALQUES.source, "giu"))].map(([match]) => match),
    person: secondPersonRatio(enText),
    prescribesReps:
      REP_PATTERNS.some((pattern) => pattern.test(enText)) &&
      !/\breps?\b|répétitions?/i.test(frText),
    frenchLeftovers: FRENCH_LEFTOVERS.test(enText),
    charsFr: frText.length,
    charsEn: enText.length,
  }
}

/**
 * The checks a human would want named on the row. The second-person ratio is
 * deliberately absent: it is a corpus measurement, and a single row switching
 * register once is not worth sending back to French.
 */
export function gateFlags(checks: TranslationChecks): string[] {
  return [
    !checks.lengthParity && "length drift",
    checks.droppedNumbers.length > 0 &&
      `dropped numbers: ${checks.droppedNumbers.join(", ")}`,
    checks.inventedEquipment.length > 0 &&
      `invented equipment: ${checks.inventedEquipment.join(", ")}`,
    checks.untranslatedMuscle && "untranslated muscle",
    checks.casingBleed && `Title Case bleed: ${checks.casingBleed}`,
    checks.glossary.length > 0 &&
      `glossary: ${[...new Set(checks.glossary.map((v) => v.term))].join(", ")}`,
    checks.imperativeMistakes.length > 0 &&
      `imperative mistakes: ${checks.imperativeMistakes.length}`,
    checks.calques.length > 0 && `calques: ${[...new Set(checks.calques)].join(", ")}`,
    checks.prescribesReps && "prescribes reps",
    checks.frenchLeftovers && "French leftovers",
  ].filter((flag): flag is string => typeof flag === "string")
}
