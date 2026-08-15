# T183 — Schema + Builder AMRAP definition

## Goal

Un utilisateur définit un Circuit en **Tours** ou **AMRAP** dans le Builder : cap en minutes, mot **AMRAP** jamais nu, rest/transition forcés à 0, liste uniforme, grille pyramidale opt-in **Tours**. Zeus/Athena existants restent **Tours** sans backfill. Couvre les stories 1–7, 29.

## Mode

**AFK** — schéma et copy figés (ADR 0014, `AmrapLabel` seul renderer du mot).

## Slice

`migration (mode + cap_seconds + block_runs)` → `database.ts` → `blockPersistence` / `useBlockMutations` → `BlockEditor` ToggleGroup → `AmrapLabel` + `BlockCard` → vitest

## Dependencies

None.

## Scope

### Migration — `supabase/migrations/{ts}_amrap_block_runs.sql`

- `exercise_blocks.mode text NOT NULL DEFAULT 'rounds'` CHECK `IN ('rounds', 'amrap')`.
- `exercise_blocks.cap_seconds integer` CHECK `NULL OR (60–3600)` + CHECK mode/cap : **Tours** ⇒ cap NULL ; **AMRAP** ⇒ cap NOT NULL.
- AMRAP persisté : `rounds = 1`, `rest_seconds = 0`, `transition_seconds = 0` (app + edge enforce ; CHECK optionnel si ça ne casse pas les rows Tours).
- `CREATE TABLE block_runs` **dans cette migration** (colonnes ADR 0014, UNIQUE `(session_id, block_id)`, RLS via `sessions.user_id`). **Aucun write** dans ce ticket — T185 enfile la queue.

### Types — `file:src/types/database.ts`

`ExerciseBlock.mode`, `cap_seconds`. Type `BlockRun` (id, session_id, block_id, started_at, finished_at, mode, cap_seconds, template_fingerprint) pour que T185 n’attende pas une 2ᵉ passe types.

### Persist — `file:src/lib/blockPersistence.ts` + `file:src/hooks/useBlockMutations.ts`

- Save AMRAP : `mode: "amrap"`, `cap_seconds = minutes * 60`, `rounds: 1`, rest/transition 0, chaque `per_round.length === 1`.
- `useUpdateBlockMeta` **ne resize pas** `per_round` via `file:src/lib/perRound.ts` quand `mode === "amrap"`.
- Switch de mode : `file:src/lib/blockTemplate.ts` — AMRAP → garder round 1, length 1, cap défaut 20 min ; Tours → `rounds: 3`, propagate, rest 90.

### UI — `file:src/components/builder/BlockEditor.tsx`

- `ToggleGroup` shadcn **Tours | AMRAP** en **premier** contrôle (`file:src/components/ui/toggle-group.tsx`).
- AMRAP : input minutes 1–60, défaut 20, un geste 20→10. Rest/transition **non montés**.
- Tours : rest/transition inchangés. Liste uniforme par défaut ; `PerRoundGrid` **opt-in** (pas la vue par défaut d’un 4-tours plat).
- `file:src/components/circuit/AmrapLabel.tsx` : seul moyen de rendre le mot. Badge `AMRAP {n} min` + gloss FR/EN. **Pas** de prop « hide gloss ».
- `BlockCard` / pre-session : `AmrapLabel` si AMRAP ; Tours garde le copy rounds actuel.

### i18n

Clés `builder` : Tours, AMRAP gloss *« Autant de tours que possible. »* / *« As many rounds as possible. »*.

## Out of Scope

- Écriture `block_runs` / queue → **T185**.
- Round Screen (GO, clock, leftover) → **T184** / **T185**.
- MCP / générateurs → **T187** / **T189**.
- **T144** « Créer un circuit » top-level ; **#398** ; EMOM.

## Acceptance Criteria

- [ ] Migration : Zeus existants ont `mode = 'rounds'` et `cap_seconds IS NULL` sans backfill métier.
- [ ] Créer Cindy (`AMRAP 20 min`, 5-10-15) depuis le Builder persiste `mode`, `cap_seconds = 1200`, `rounds = 1`, rest/transition 0, `per_round.length === 1`.
- [ ] Reouvrir le bloc : ToggleGroup sur AMRAP, cap 20, rest/transition absents.
- [ ] Switch Tours ↔ AMRAP libre ; round 1 survit ; passé non réécrit (pas de `block_runs` ici).
- [ ] Tours : liste uniforme par défaut ; pyramide uniquement après opt-in.
- [ ] Aucune surface Builder/carte n’affiche `AMRAP` sans minutes **et** gloss (snapshot `AmrapLabel`).
- [ ] `useUpdateBlockMeta` sur un AMRAP ne clone pas `per_round` à N cellules.
- [ ] Tests vitest : persist shape, mode-switch `blockTemplate`, `AmrapLabel` obligatoire.

## References

- Epic Brief : stories 1–7, 29 — `file:docs/Epic_Brief_—_Circuit_AMRAP_#474.md`
- Tech Plan : Key Decisions (mode, rounds=1, ToggleGroup), Data Model — `file:docs/Tech_Plan_—_Circuit_AMRAP_#474.md`
- ADR : `file:docs/adr/0014-amrap-mode-and-block-runs.md`
