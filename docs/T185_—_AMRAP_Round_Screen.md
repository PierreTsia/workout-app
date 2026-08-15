# T185 — AMRAP Round Screen

## Goal

Courir un AMRAP pour de vrai : cap wall-clock depuis **GO** (pas le 1er Valider, pas **Démarrer**), tours qui wrappent, `Tour N` sans dénominateur, **pas de Skip**, TIME / **Terminer** → leftover `0…amount` sur la station courante, score `AmrapScore` en done, **Annuler** wipe + DELETE **Block Run**, kill-app restaure ~le temps restant et le cursor. Couvre les stories 9, 12–20, 27–28.

## Mode

**AFK** — machine + queue figées au Tech Plan. Recette visuelle leftover → **T190**.

## Slice

`blockRunnerReducer` + `templateCell` → `syncService` `block_run` → `useBlockRun` / `useBlockSession` hydrate → `LeftoverStepper` + countdown chrome + `AmrapScore` → vitest

## Dependencies

T183 (mode, cap, `block_runs` table), T184 (`BlockGoCountdown`, `BlockClockChrome` elapsed).

## Scope

### Reducer — `file:src/lib/blockRunner.ts`

- `ctx.mode`. **Ne pas** `rounds: Infinity`.
- AMRAP `LOG_AND_ADVANCE` en fin de tour : toujours `{ round + 1, exerciseIdx: 0 }`, **jamais** `done`.
- Events `TIME` / `TERMINATE` → phase leftover (hors cursor pur si besoin) puis `done` après log actual.
- `GO_BACK` depuis leftover/`done` → **dernière cellule loggée**, pas `ctx.rounds - 1`.
- Hydratation kill-app : état initial depuis logs, **pas** `GO_TO` (toujours unhandled).

### Payload — `file:src/lib/blockSetLog.ts` + `file:src/lib/blockTemplate.ts`

- `templateCell(be, round)` : AMRAP → `per_round[0]` ; Tours → `per_round[round]`.
- Leftover : `reps_logged` / durée = **actual** (stepper), pas le prescrit.
- `set_number = round + 1` inchangé (tours non bornés).

### Queue — `file:src/lib/syncService.ts`

- `QueueItemType` += `"block_run"`. `enqueueBlockRun` appelle `resolveSessionMeta` (GO peut minter la session).
- Drain : `ensureSession` **avant** upsert `block_runs`, même ordre que `set_log`.
- UNIQUE `(session_id, block_id)` : Annuler → DELETE row + `discardBlockSetLogs` existant ; nouveau GO → UPSERT `started_at`.
- **Tours n’écrit pas** de `block_runs`.

### Hydrate — `file:src/hooks/useBlockRun.ts` + `file:src/hooks/useBlockSession.ts`

Trou actuel : queue `set_log` **non mergée** dans `loggedCells` au remount.

1. `started_at` : queue puis DB.
2. Merger `set_log` queued dans `loggedCells`.
3. Cursor = première cellule vide.
4. Si un **Block Run** existe pour `(session, block)` : **pas** de 2ᵉ GO — skip countdown, chrome = cap − (now − started_at).

### UI — `file:src/components/workout/BlockRunner.tsx`

- `BlockClockChrome` variante **countdown** depuis `started_at` + `cap_seconds`. Pause séance **ne gèle pas**.
- Mixed day : cap démarre au GO de **ce** bloc, pas `session.startedAt`.
- `BlockProgressBars` : `roundTotal` optionnel → `Tour {n}` sans ratio ; barre exos `2/3` inchangée.
- **Pas de Skip** en AMRAP.
- TIME overlay (plus de Valider) → `file:src/components/workout/LeftoverStepper.tsx` `0…amount` (holds : secondes, prefill elapsed).
- **Terminer** = même leftover, garde le score (`finished_at`).
- **Annuler** = wipe aujourd’hui + DELETE `block_runs`.
- Done : `file:src/components/circuit/AmrapScore.tsx` — hero `27+3` + gloss `27 tours · 3 pompes`. Seul renderer du score. Pas de prop hide-gloss.

## Out of Scope

- History sheet / PB / fingerprint grouping → **T186** (`AmrapScore` naît ici, le sheet l’importe).
- MCP → **T187** / **T188**.
- Soften `isRunComplete` — **interdit**.
- Rest prescrit en AMRAP / EMOM / #398.

## Acceptance Criteria

- [ ] AMRAP `rounds = 1` : Valider le dernier exo du tour 1 **n’envoie pas** `done` ; tour 2 s’ouvre.
- [ ] `per_round[7]` n’explose pas : `templateCell` → `[0]`.
- [ ] GO enqueue `block_run` **avant** le 1er set_log ; cap ignore le temps du squat d’avant (mixed day).
- [ ] TIME / Terminer : leftover sur la station courante ; `finished_at` posé ; `AmrapScore` glosé.
- [ ] Annuler : plus de row `block_runs`, plus de logs bloc.
- [ ] Skip absent en AMRAP ; présent en Tours.
- [ ] Pause séance : countdown continue.
- [ ] Kill-app à T+12:00 d’un cap 20 min : remaining ≈ 8:00 (±2s), cursor restauré (logs **+** queue), pas de 2ᵉ GO.
- [ ] Kill-app avant le 1er Valider : clock restored, cursor `(0,0)` légitime.
- [ ] Drain `block_run` sans session row : `ensureSession` d’abord.
- [ ] Jour 100 % AMRAP : Démarrer → GO (pas de régression `canStartPreSession`).
- [ ] Tests vitest : wrap reducer, leftover actual, enqueue/hydrate/annuler, `AmrapScore` snapshots.

## References

- Epic Brief : stories 9, 12–20, 27–28
- Tech Plan : Critical Constraints (reducer, payload, mint, kill-app hydrate, UNIQUE)
- ADR 0014
