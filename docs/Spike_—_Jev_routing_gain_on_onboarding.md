# Spike — Jev routing gain on onboarding

- **Issue:** [#555](https://github.com/PierreTsia/workout-app/issues/555) (refs #552, ADR `file:docs/adr/0023-jev-verdicts-only-embedded-agent.md`)
- **Date:** 2026-09-28
- **Question:** does routing the onboarding Embedded Agent chat through a **Jev** door (one pass at the head of `/send`, `ask_progress` / `ask_history` answered by the database with zero model call) have a real gain — or does onboarding need to be rethought first?

## Headline

**0 % of real onboarding turns are routable.** On the 10 user turns that actually exist in the onboarding transcripts, **zero** classify as `ask_progress` or `ask_history`. The door needs a **~20–24 % routable hit rate** to pay for itself, and even a fixture set deliberately salted with progress/history turns only reaches **9 %**. Measured on the real Jev wire (`jev-1.13-free`), on real + synthetic data.

**Recommendation: rethink onboarding before building the door.** Tranche 1 (`ask_progress` / `ask_history` at the head of the onboarding chat) has no terrain to save on. Jev's honest home is elsewhere — a between-session role (#505) or the MCP write consent (Piste B, #287) — not this chat.

## Method & data provenance

| | |
|---|---|
| **Real data** | `embedded_agent_threads`, `purpose = 'onboarding'`, read-only SQL via Supabase MCP (project `favusepjqwpcroiolvaz`), 2026-09-28. **Anonymised**: user ids stripped, only message text kept. |
| **Sample** | 35 onboarding threads exist; **6 carry a transcript**. Those 6 hold **10 user turns** — i.e. the *entire* surviving real corpus. |
| **Fixtures** | 32 synthetic onboarding turns (injuries, goals, vague constraints, schedule/equipment, preferences, language) plus 3 `ask_progress`/`ask_history`, 2 `start_session`/`log_set`, 2 `program_draft` — salted on purpose so the classifier has routable turns to find. |
| **Classifier** | Live `POST https://opencode.ai/zen/v1/systemone`, model `jev-1.13-free`, same wire as `ai-issue-routing/jev_core/jev.py` (`{ model, state, questions: { id: { type:"choice", instructions, criteria } } }`). One call per turn. Script: `file:scripts/spike/jev-routing-gain.ts`. |
| **Fallback** | Deterministic keyword classifier exists in the script but was **not used** — the Jev credential answered. |

**Credential finding:** the spike and ADR 0023 record the `system_one` credential answering **401 today**. On 2026-09-28 the local `~/.local/share/opencode/auth.json` (`opencode-go` key) returns **HTTP 200** against the Zen endpoint. The 401 blocker is gone — but the measurement below says the door still should not be built on this surface.

**Methodological note:** Jev reads `state` as the target of the verdict. Passing the chat's purpose/description in `state` collapsed the classification to `question` for all 42 turns (confidence 0.97). Passing a compact screen-level `state` and the sentence in the choice `instructions` produced a sane distribution — that is the shape used, and it is the shape the real door would carry (`state` = screen/thread/program, sentence = the thing to classify).

## What the surface actually is

The onboarding chat exists to **fill qualitative gaps before a program draft** — injuries, fuzzy goals, schedule, equipment, preferences (CONTEXT: *Embedded Agent onboarding product (v1), rule 3*). And its users are **brand-new**: onboarding runs *before* any training history exists, so `ask_progress` / `ask_history` has almost nothing to point at by construction. This is not an accident of the sample; it is the product's definition.

The real transcripts confirm it. Every user turn is qualitative:

| # | Turn (real, anonymised) | Jev intent |
|---|---|---|
| 1 | « Hola, hablas español? » | `question` |
| 2 | night shift 18:00–6:00 + past lower-back/bench/deadlift injuries | `question` |
| 3 | « Primero que nada, hablas español? » | `question` |
| 4 | « Generabrutina de ejercicios para hipertrofia » | `program_draft` |
| 5 | cold, rested two days, awake 1:30, gym ~15:00 | `question` |
| 6 | drop fat, keep muscle | `question` |
| 7 | chronic stress, likes barbell/dumbbell/kettlebell, basics | `question` |
| 8 | train whole body, in shape, every day, ≤30 min, simple exercises | `question` |
| 9 | « i eat alot and i want to lose weight » | `question` |
| 10 | « im hot » | `question` |

## Measurements

### Classification

| Set | n | `ask_progress`/`ask_history` (v1) | other-routable (`start_session`/`log_set`/`program_draft`) | `question` |
|---|---|---|---|---|
| **Real** | 10 | **0 (0 %)** | 1 (10 %) | 9 (90 %) |
| **Fixtures** | 32 | 3 (9,4 %) | 5 (15,6 %) | 24 (75 %) |
| Overall | 42 | 3 (7,1 %) | 6 (14,3 %) | 33 (78,6 %) |

Jev latency: median **442 ms**, mean 478 ms per call (real subset 427 ms). Classification confidence on the salted routable fixtures: 0.89–1.00; on qualitative turns 0.71–1.00.

### Economics

Per logical turn today the chat pays **one Gemini call** (`gemini-2.5-flash`, one turn = one call). With a Jev door it pays **one Jev call always**, plus Gemini **only when not routed**.

Modelled on measured tokens (`417 in / 66 out` for Jev) and list prices; latency Gemini is an estimate (no prod measurement available):

| Unit | Value | Source |
|---|---|---|
| Jev latency / call | **0.44 s** | measured |
| Jev cost / call | ~$0.00029 | measured tokens @ Gemini-Flash list rates; **`jev-1.13-free` is billed $0 today** |
| Gemini cost / call | ~$0.0012 | estimated (profile prompt + transcript + reply) |
| Gemini latency / call | 2.0–3.0 s (est.) | no measurement |

Per **100 onboarding turns**:

- without the door: 100 Gemini calls;
- with the door at real hit rate `p = 0`: **0 Gemini calls saved**, **+100 Jev calls**, **+~44 s of added latency** across the batch;
- break-even **hit rate**:
  - on dollars (Jev priced like its tokens): `p* = c_jev / c_gemini ≈ 24 %`;
  - on latency: `p* = L_jev / L_gemini ≈ 15–22 %`.

So the door must hit roughly **one routed turn in four or five** to break even. The real surface delivers **zero**. Even the salted fixtures (9,4 %) stay under it.

### Volume check

`ai_generation_log` holds **34 `embedded_chat` calls total**, 2026-05-12 → 2026-08-12. The whole surface is ~11 turns/month. At a 100 % hit rate the lifetime saving would be 34 model calls — the door is not a cost lever at current volume either.

## Confidence

- **Direction — high.** `0/10` is not a sampling wobble: it is the product's definition (brand-new users, chat scoped to qualitative gaps) and it is corroborated by all 6 surviving transcripts and by the fixture result (9,4 % even when salted).
- **Magnitude — low.** The real sample is tiny (10 turns, 6 threads, some 1–2 turns long) and truncated by the 90-day retention sweep; it cannot support a precise percentage beyond "≈0".
- **Break-even — medium.** Depends on the estimated Gemini latency/cost; the 20–24 % figure is a range, not a measured threshold.
- **Classifier — verified.** Live Jev call on the real wire, sane distributions on known-intent fixtures (0.89–1.00 confidence on progress/history/log/draft).

## Recommendation

**Don't build tranche 1 on onboarding.** The routable intents the door is meant to catch have no reason to appear there. Two honest follow-ups, in order of value:

1. **Rethink onboarding first (#505).** Give the chat a between-session / follow-up role where a user with history actually asks `ask_progress` / `ask_history`. Measure *that* surface before cutting a Jev tranche.
2. **Re-point Jev at the MCP write consent (Piste B, #287).** There the value is blast-radius control on third-party writes, not model-call savings — a different question, and offsetting the 401/credential dependency is now unblocked.

If tranche 1 is kept at all, it should be measured on the post-onboarding surfaces (`additional_program`, #505) where its break-even is reachable — not on onboarding, where the ceiling is the surface's own purpose.

## Repro

```
npx tsx scripts/spike/jev-routing-gain.ts   # needs an opencode/zen key in ~/.local/share/opencode/auth.json
```

No production writes: SQL was `SELECT`-only, no migrations, no inserts.
