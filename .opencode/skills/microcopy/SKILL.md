---
name: microcopy
description: >
  Review and write GymLogic user-facing microcopy (EN + FR i18n keys).
  Factual, short, pedagogical, a little fun; no jargon; no naked acronyms;
  only terms from CONTEXT.md, ADRs, and this skill's terms list. Use when a
  Tech Plan adds translation keys, when drafting or reviewing locale strings,
  or when the user says microcopy, i18n copy, UI wording, or "write the keys".
---

# Microcopy

Write or review **new** translation keys so EN and FR say the same thing, in the same voice, with the same words the rest of the product already locked.

This skill does **not** rewrite the existing 1,540-string corpus. It stops new keys from making the mess worse.

Read [terms.md](terms.md) before drafting. Read [examples.md](examples.md) before you ship a joke or a gloss.

---

## When this runs

1. **From Tech Plan** — if the epic adds or changes user-facing UI, the Tech Plan skill invokes this skill and pastes the i18n contract into the plan. Do that *before* tickets are split.
2. **Standalone** — the user asks for keys, a copy pass, or a review of proposed strings.
3. **From a ticket** — a ticket is about to invent strings the Tech Plan never contracted. Stop, run this skill, then write the ticket.

If there are **no** new user-facing strings, say so in one line and stop.

---

## Tone (locked)

Target voice, not the average of today's files. Today's files disagree with each other. New keys follow this, even when a sibling string in the same namespace does not.

The tone is **factual, simple, short, and fun and not too stuck**. No jargon. Each word, each acronym is explained in parentheses. Pedagogical for beginners. Precise.

| Trait | Means | Does not mean |
|---|---|---|
| **Factual** | What happened, what to do next | "the perfect plan", "AI-powered", coach pep talks |
| **Simple** | One idea per string. Words a beginner already has | Schema words, gym-bro slang, English left in FR |
| **Short** | Button 1–4 words. Title ≤ 8 words. Body 1–2 sentences | Stacked clauses, "Please try again" padding |
| **Fun, not stuck** | One gym wink on empty / error / earned celebration | Puns on delete-account. "Failed to submit. Please try again." |
| **Pedagogical** | First meeting of a term teaches it | Assuming the user knows RIR, AMRAP, 1RM, MCP, PPL |
| **Precise** | CONTEXT / ADR name, exactly | Synonyms ("workout" for **Session**, "block" for **Circuit**) |

**Register**

- EN: *you*. *We* only when **we** failed ("We couldn't save").
- FR product UI: **tu** (session, builder, profile, library, achievements, errors).
- FR legal / OAuth / account destruction: **vous**.
- Never mix *tu* and *vous* on the same screen.

**Fun ceiling:** `error.json` ("Dropped the bar" / "Raté la rep") is the ceiling, not the floor. Chrome (buttons, tabs, field labels) stays dry. Destructive confirms stay dry.

**Exclamation marks:** one, and only on an earned celebration (session done, badge unlocked). Never on errors, never on legal.

**Case:** sentence case. Proper nouns keep their shape (GymLogic, Circuit, Cindy, Claude). Not `Start Workout`, `New Program`.

**Providers:** Gemini, Groq, model names are infrastructure. They may appear in the Privacy Policy. They never appear in product chrome. Say "the assistant" / "l'assistant".

---

## Vocabulary law

A user-facing noun is legal only if it is a **user-facing** term in one of:

1. `docs/CONTEXT.md` (prefer entries marked `UI:`)
2. An ADR under `docs/adr/`
3. [terms.md](terms.md)

If the concept is new, **stop**. Do not nickname it. Ask the user to add it to CONTEXT before you write the key.

Internal names stay in **keys** and in code. They never appear in **values**.

Forbidden in values (non-exhaustive — CONTEXT **Program Score Copy** + ADR 0007): `Exercise Slot`, `Template Prescription`, `Goal Track`, `Exercise Block`, `block`, `solo` / `solos`, `UUID`, `thread`, `dry_run`, `JSONB`, `RLS`, `rep_range_max`, `MUSCLE_TAXONOMY`, `CV`, `log1p`, file paths, provider brand names.

**Circuit, never Block.** Keys may say `blockRunner`. Values say Circuit (EN and FR).

**AMRAP is never naked.** Badge is `AMRAP 20 min` plus the gloss. Same for the score: `27+3` always ships with "27 rounds · 3 push-ups" / "27 tours · 3 pompes".

---

## Acronyms and hard words

On the **first meeting** in a flow, the short form is followed by a parenthesis:

`RIR (reps in reserve)` / `RIR (répétitions en réserve)`

Same screen may then use the short form. A later screen starts over.

Dense chrome (tab, table header, badge) may show the short form **only if** a title, hint, or parenthetical on that same screen carries the gloss. If there is no room for a gloss, do not use the acronym — write the plain words.

| Short | EN gloss | FR gloss |
|---|---|---|
| AMRAP | as many rounds as possible | autant de tours que possible |
| RIR | reps in reserve | répétitions en réserve |
| PR | personal record | record personnel |
| PB | personal best | meilleur score |
| 1RM | one-rep max | charge max sur une répétition |
| MCP | the connector that lets an AI agent talk to GymLogic | le connecteur qui permet à un agent IA de parler à GymLogic |
| PAT | personal access token — a long-lived password for agents | jeton d'accès personnel — un mot de passe longue durée pour les agents |
| PPL | push / pull / legs | poussée / tirage / jambes |

Do not ship `PPL`, `Bro Split`, `Hypertrophy`, `Compound`, `Isolation`, `opsec`, `headless` without the plain-language form. Prefer the plain form alone when the acronym adds nothing.

**Hypertrophy:** user-facing goal is **Muscle growth** / **Prise de masse**. If a Goal Track label must match the catalog word, write `Hypertrophy (muscle growth)` / `Hypertrophie (prise de masse)`.

---

## Workflow

Copy this list and tick it.

```
- [ ] 1. Inventory
- [ ] 2. Load vocabulary
- [ ] 3. Draft EN, then FR
- [ ] 4. Self-review
- [ ] 5. Output the contract
```

### 1. Inventory

List every new or changed user-facing string: labels, buttons, empty states, errors, hints, toasts, a11y, notifications, notifications permission, emails if any.

Reuse an existing key when the meaning is the same. Do not mint `cancel2`.

Pick the namespace the surface already uses (`workout`, `profile`, `builder`, …). New namespace only if `file:src/lib/i18n.ts` is gaining one — say so.

### 2. Load vocabulary

Read, do not paraphrase from memory:

- `docs/CONTEXT.md` — every term the copy will use
- Relevant `docs/adr/*.md`
- Sibling keys in `src/locales/en/<ns>.json` and `src/locales/fr/<ns>.json` (rhythm and established labels, **not** their jargon)
- [terms.md](terms.md)

### 3. Draft

Write EN first. Then write FR for the same meaning — do not translate English syntax.

FR is not a calque. `Dropped the bar` → `Raté la rep`, not `J'ai fait tomber la barre`.

Interpolation: `{{count}}`, `{{name}}`, i18next `_one` / `_other` (and FR `_one` / `_other` / `_many` when needed). Never bake a plural into a single string.

### 4. Self-review

For each key: PASS, or rewrite before it appears in the table.

1. **Jargon** — would a first-week lifter need Google?
2. **Naked acronym** — every short form has a gloss on first meeting or on the same screen.
3. **Glossary** — every product noun is in CONTEXT / ADR / terms.md. No `solo`, no `block`, no `UUID`.
4. **Length** — cut one word. Then stop.
5. **Fun** — at most one wink, and only if the surface is empty / error / celebration.
6. **FR address** — tu vs vous matches the register rule. No mix.
7. **Parity** — EN and FR teach the same fact. Neither is a summary of the other.
8. **Ban list** — no *delve, seamless, unlock your potential, game-changer, please try again* as the whole message. Recovery is a specific next step (`Try again`, `Pick a template`, `Reconnect`).

### 5. Output

Do **not** write locale files unless the user asked to land the keys. The deliverable is the contract.

```markdown
## i18n contract

**Namespace:** `…`
**Surfaces:** `…`

| Key | EN | FR | Why this wording |
|---|---|---|---|
| `foo.bar` | … | … | … |

### Rejected
- `old` → `new` — reason (jargon / naked acronym / not in glossary / too long / too stuck)

### Open
- Term X is not in CONTEXT — need a glossary entry before this key ships.
```

`Why this wording` is one short clause, not an essay.

---

## Key names

- camelCase, namespaced by surface (`preSession.scopePermanent`, `rir.infoText`).
- Keys may use internal words (`blockRunner`). Values may not.
- Mirror an existing key name when the concept is the same across namespaces (`agentBuildHint` in `onboarding` and `create-program`).
- Pluralization: `setCount_one` / `setCount_other`, not a hand-rolled `{{count}} set(s)`.

---

## Existing corpus

The 21 namespaces in `src/locales/{en,fr}/` are **evidence**, not law. Steal rhythm from `profile.json` hints, `error.json`, `builder.amrapGloss`, and the RIR / Epley explainers. Do not copy `split_ppl: "PPL"`, `argsFallbackHint` (UUID leak), `statusLine: "Thread {{idShort}}"`, or `Please try again.`

Rewriting old keys is out of scope unless the user asks.
