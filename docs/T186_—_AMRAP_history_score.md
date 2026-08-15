# T186 — AMRAP history score

## Goal

La **Block history sheet** inverse le score pour l’AMRAP : rounds + leftover (`AmrapScore` glosé), PB = plus c’est mieux (leftover tie-break), fingerprint = template + cap (20 min ≠ 10 min). **Tours** CCT inchangé. `isRunComplete` / `runFingerprint` **non touchés**. Couvre les stories 21–23.

## Mode

**AFK** — règles de score figées ; `AmrapScore` existe (T185).

## Slice

`src/lib/amrapScore.ts` → `BlockHistorySheet` / card → vitest (Tours fixtures non-régression)

## Dependencies

T185 (`finished_at`, leftover logs, `AmrapScore`, `template_fingerprint` au GO).

## Scope

### `file:src/lib/amrapScore.ts`

- Completeness AMRAP = `block_runs.finished_at IS NOT NULL`. Leftover = dernier round en lambeaux dans `set_logs` (actual + nom d’exo).
- Groupe par `template_fingerprint` (snapshot GO : mode + cap + amounts/weights).
- PB = max `(fullRounds, leftover)` ; delta en tours, jamais vs un autre cap.
- **Ne pas** appeler / modifier `isRunComplete` ou `runFingerprint` (`file:src/lib/blockCompletionHistory.ts`).

### UI

- Sheet / carte : branche `mode === "amrap"` → `AmrapScore` (même composant que le done T185).
- Tours : `annotateRuns` actuel, CCT ADR 0008.

## Out of Scope

- Ligne MCP history → **T188** (recopie les règles, pas d’import `src/` depuis Deno).
- Leaderboard / achievements / #398 PR global.
- Mixer un run Tours et un run AMRAP dans le même groupe.

## Acceptance Criteria

- [ ] Run `27+3` avec `finished_at` : hero + gloss `27 tours · 3 pompes` (mouvement leftover nommé).
- [ ] Run sans `finished_at` (session finish sans Terminer) : incomplet, hors PB.
- [ ] Cap 20 → 10 : nouveau fingerprint ; les 3 runs 20 min gardent leur PB.
- [ ] Fixture Zeus : card/sheet byte-identique à pre-T186 (`isRunComplete` still rectangle).
- [ ] Tests : leftover derivation, PB ordering, non-mix modes, non-régression `annotateRuns`.

## References

- Epic Brief : stories 21–23
- Tech Plan : amrapScore / history ; Failure Mode (cap edit, session finish)
- ADR 0014 + 0008 (Tours only)
