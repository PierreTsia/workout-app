// Spike #555 — measure the Jev routing gain on the onboarding Embedded Agent chat.
//
// Two data sets, labelled by `source`:
//   - "real": the 10 user turns found in the 6 onboarding `embedded_agent_threads`
//     rows that still carry transcripts (read-only SQL, 2026-09-28). User ids
//     stripped; only the message text is kept.
//   - "fixture": ~30 synthetic onboarding turns (injuries, goals, vague
//     constraints, plus a few progress/history/start/log turns) so the
//     classification has something to bite on beyond the tiny real sample.
//
// Classifier: one Jev `choice` call per turn (`POST /zen/v1/systemone`,
// model `jev-1.13-free`), same wire as ai-issue-routing/jev_core/jev.py
// ({ model, state, questions: { id: { type, instructions, criteria } } }).
// Fallback when no credential: a deterministic keyword classifier (documented
// in the spike note). The script records which one ran.
//
// Run: npx tsx scripts/spike/jev-routing-gain.ts

import { readFileSync } from "node:fs";

const JEV_URL = "https://opencode.ai/zen/v1/systemone";
const JEV_MODEL = "jev-1.13-free";

type Turn = { source: "real" | "fixture"; text: string };

const REAL_TURNS: Turn[] = [
  { source: "real", text: "Hola, hablas español?" },
  {
    source: "real",
    text:
      "Te explico, trabajo de noche de 18:00 a 6:00. No tengo alguna lesión aunque comúnmente me he lastimado haciendo sentadilla libre con barra, press linear y peso muerto.",
  },
  { source: "real", text: "Primero que nada, hablas español?" },
  { source: "real", text: "Generabrutina de ejercicios para hipertrofia" },
  {
    source: "real",
    text:
      "Hey, ayer y hoy estuve con resfriado y preferí descansar, ahorita ya me siento bien. Yo trabajo de noche por lo que duermo de día. Normalmente me levanto 1:30, me arreglo, como algo y me voy al gym, llegó como a las 15:00 hrs",
  },
  { source: "real", text: "Мне необходимо сбросить жир и сохранить мускулы." },
  {
    source: "real",
    text:
      "Мой главный недостаток – хронический стресс. Я люблю штангу, гантели, гири. Базовые упражнения.",
  },
  {
    source: "real",
    text:
      "Je souhaite rafer tout mon corps. Et rester en forme. Je suis disponible tous les jours. J'aimerais ne pas faire plus de 30 min/j au maximum avec des exercices simples",
  },
  { source: "real", text: "i eat alot and i want to lose weight" },
  { source: "real", text: "im hot" },
];

const FIXTURE_TURNS: Turn[] = [
  { source: "fixture", text: "I hurt my lower back deadlifting last year, anything heavy for hinge worries me." },
  { source: "fixture", text: "My right shoulder clicks on overhead press, I'd rather avoid barbell OHP." },
  { source: "fixture", text: "I had knee surgery two years ago, can we keep the squats light?" },
  { source: "fixture", text: "Tendinitis in both elbows from too many pull-ups, need a workaround." },
  { source: "fixture", text: "No injuries, but I sit at a desk all day and my hips are tight." },
  { source: "fixture", text: "I want to get stronger but also drop a bit of fat." },
  { source: "fixture", text: "Mostly I want to look better in a t-shirt, arms and shoulders." },
  { source: "fixture", text: "My goal is to be able to do 10 clean pull-ups." },
  { source: "fixture", text: "I don't really care about numbers, I just want to feel athletic again." },
  { source: "fixture", text: "Training for general health, nothing competitive." },
  { source: "fixture", text: "I'd love to bring up my bench press, it's stuck at 80kg." },
  { source: "fixture", text: "I'm training for a half marathon next spring, but want to keep lifting." },
  { source: "fixture", text: "I'm not sure what goal to pick, maybe a mix of strength and size." },
  { source: "fixture", text: "I can only train 3 days, and never on weekends." },
  { source: "fixture", text: "Some weeks I travel for work so I'll miss days, is that ok?" },
  { source: "fixture", text: "My gym is a small hotel one, only dumbbells and a bench." },
  { source: "fixture", text: "I train at home with a pull-up bar and two kettlebells." },
  { source: "fixture", text: "The squat rack is always busy around 6pm." },
  { source: "fixture", text: "I hate burpees and anything high impact." },
  { source: "fixture", text: "I really enjoy deadlifts and rows, please include them." },
  { source: "fixture", text: "Can we avoid machines, I prefer free weights?" },
  { source: "fixture", text: "I don't enjoy long cardio finishers." },
  { source: "fixture", text: "English please." },
  { source: "fixture", text: "¿Puedes responder en español?" },
  { source: "fixture", text: "How many sets did I do this week?" },
  { source: "fixture", text: "What did I bench in my last session?" },
  { source: "fixture", text: "Show me my recent workouts." },
  { source: "fixture", text: "Let's start today's workout." },
  { source: "fixture", text: "Just did 3x8 bench at 80kg." },
  { source: "fixture", text: "I logged my squats, 5x5 at 100." },
  { source: "fixture", text: "Ok I'm ready, build me the program." },
  { source: "fixture", text: "Generate my plan now please." },
];

const INTENT_CRITERIA: Record<string, string> = {
  ask_progress: "asks about their own training progress, volume, stats or how they are doing this week",
  ask_history: "asks about past workouts, history, previous sessions or past performances",
  start_session: "wants to begin training right now",
  log_set: "reports a set they just completed",
  program_draft: "asks to generate, build or start their training program now",
  question:
    "anything else, especially qualitative context: injuries, health, goals, schedule, equipment, exercise preferences, language/meta",
};

function keyFromAuthFile(): string | null {
  const path = process.env.OPENCODE_AUTH_FILE ??
    `${process.env.HOME}/.local/share/opencode/auth.json`;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    for (const name of ["zen", "opencode", "opencode-zen", "opencode-go"]) {
      const v = data[name];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        for (const f of ["key", "apiKey", "token"]) {
          if (typeof o[f] === "string" && (o[f] as string).trim()) return (o[f] as string).trim();
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

type Intent = "ask_progress" | "ask_history" | "start_session" | "log_set" | "program_draft" | "question";

async function classifyWithJev(
  text: string,
  key: string,
): Promise<{ intent: Intent; confidence: number; latencyMs: number }> {
  // Jev reads `state` as the target of the verdict. The sentence goes in the
  // question `instructions`; `state` stays a compact, screen-level context —
  // the shape the real door would carry. A verbose state here collapses the
  // distribution to `question` (measured: all 42 turns at 0.97).
  const body = {
    model: JEV_MODEL,
    state:
      "Onboarding chat. New user, questionnaire profile known, no training history. Screen: onboarding chat.",
    questions: {
      intent: {
        type: "choice",
        instructions: `Classify this user message, pick exactly one intent: ${text}`,
        criteria: INTENT_CRITERIA,
      },
    },
  };
  const started = Date.now();
  const res = await fetch(JEV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "jev-core",
    },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const payload = (await res.json()) as {
    answers?: { intent?: { choice?: string; confidence?: number } };
  };
  const intent = payload.answers?.intent?.choice as Intent | undefined;
  if (!intent) throw new Error("Jev response missing answers.intent.choice");
  return { intent, confidence: payload.answers?.intent?.confidence ?? 0, latencyMs };
}

// Deterministic fallback — lower bound, only used when no Jev credential.
// Matches on explicit self-data / history / action verbs so a qualitative turn
// ("I hurt my back") is never mistaken for a routable one.
function classifyDeterministic(text: string): Intent {
  const t = text.toLowerCase();
  if (/(just did|i logged|logged my)\b/.test(t)) return "log_set";
  if (/(let'?s start|start (today|my|the) (workout|session))/.test(t)) return "start_session";
  if (/(how many sets|this week|my progress|my stats)/.test(t)) return "ask_progress";
  if (/(last session|last time|my (recent )?(workouts|history)|past workouts|what did i)/.test(t)) {
    return "ask_history";
  }
  if (/(build|generate|create).*(program|plan)|generate my plan|ready.*build/.test(t)) {
    return "program_draft";
  }
  return "question";
}

type Result = {
  source: "real" | "fixture";
  text: string;
  intent: Intent;
  confidence: number;
  latencyMs: number;
};

async function main() {
  const key = process.env.JEV_API_KEY?.trim() || keyFromAuthFile();
  const method = key ? "jev" : "deterministic";
  const turns = [...REAL_TURNS, ...FIXTURE_TURNS];
  const results: Result[] = [];

  for (const turn of turns) {
    if (method === "jev") {
      let attempt = 0;
      for (;;) {
        try {
          const r = await classifyWithJev(turn.text, key!);
          results.push({ ...turn, ...r });
          break;
        } catch (err) {
          attempt++;
          if (attempt >= 4) throw err;
          await new Promise((r) => setTimeout(r, 500 * attempt)); // 429 backoff
        }
      }
    } else {
      results.push({ ...turn, intent: classifyDeterministic(turn.text), confidence: 1, latencyMs: 0 });
    }
  }

  const routable = new Set<Intent>(["ask_progress", "ask_history"]);
  const otherRoutable = new Set<Intent>(["start_session", "log_set", "program_draft"]);

  const summarize = (rows: Result[]) => {
    const n = rows.length;
    const r = rows.filter((x) => routable.has(x.intent)).length;
    const o = rows.filter((x) => otherRoutable.has(x.intent)).length;
    const g = rows.filter((x) => x.intent === "question").length;
    const lat = rows.filter((x) => x.latencyMs > 0).map((x) => x.latencyMs).sort((a, b) => a - b);
    return {
      turns: n,
      routable_v1: r,
      routable_v1_share: n ? +(r / n).toFixed(4) : 0,
      other_routable: o,
      other_routable_share: n ? +(o / n).toFixed(4) : 0,
      generative_question: g,
      generative_share: n ? +(g / n).toFixed(4) : 0,
      by_intent: Object.fromEntries(
        [...routable, ...otherRoutable, "question"].map((i) => [
          i,
          rows.filter((x) => x.intent === i).length,
        ]),
      ),
      jev_latency_ms_median: lat.length ? lat[Math.floor(lat.length / 2)] : null,
      jev_latency_ms_mean: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
    };
  };

  const report = {
    method,
    classifier: method === "jev" ? `${JEV_MODEL} via ${JEV_URL}` : "deterministic keyword",
    overall: summarize(results),
    real: summarize(results.filter((x) => x.source === "real")),
    fixture: summarize(results.filter((x) => x.source === "fixture")),
    results,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
