# T285 — Donnée réelle : projection de session + pont MCP Apps

## Goal

Alimenter la Session Card avec la **dernière Session terminée réelle** de l'athlète : la projection MCP-side assemble la donnée, `render_session_card` la renvoie en `structuredContent`, et le pont `ext-apps` la pousse dans l'iframe qui la rend. Couvre les stories 1, 3, 4, 5, 7, 9 de l'Epic Brief.

## Mode

**AFK** — la projection, ses ports et le pont sont entièrement spécifiés ; la parité est tenue par fixtures.

## Slice

`mcp/lib/tonnage.ts` + `mcp/lib/blockCompletion.ts` + `mcp/lib/sessionCard.ts` → `tools/renderSessionCard.ts` (renvoie `structuredContent`) → `src/mcp-views/session-card/entry.tsx` (`App` reçoit le tool result) → `SessionCard.tsx` rend le payload → tests golden (Deno + Vitest).

## Dependencies

**T284** (chaîne statique + serveur + vue en place).

## Scope

### Ports purs — `supabase/functions/mcp/lib/`

| Fichier | Rôle | Miroir de |
|---|---|---|
| `tonnage.ts` | `loadedSetKg` + somme de session (`Σ weight_logged × numericReps`, `weight_logged > 0 AND duration_seconds IS NULL`) | `file:src/lib/profile/tonnage.ts:31` |
| `blockCompletion.ts` | `runCompletionSeconds` (`round((max(logged_at) − min(logged_at))/1000)`) + détection de run complète | `file:src/lib/blockCompletionHistory.ts` |

- Réutiliser le port existant `file:supabase/functions/mcp/lib/amrapScore.ts` (ne pas redéfinir).
- Durée de session : `active_duration_ms`, repli `finished_at − started_at` (miroir de `file:src/lib/sessionRowDuration.ts`).

### Projection — `supabase/functions/mcp/lib/sessionCard.ts`

- Requêtes **RLS-scopées** (mêmes tables que `getWorkoutHistory` : `sessions` filtré `finished_at IS NOT NULL` tri desc **limit 1**, `set_logs`, `block_exercises` + `exercise_blocks`, `block_runs`).
- Assemble `SessionCardPayload` (cf. Tech Plan § Data Model) : `session` (label `workout_label_snapshot`, durée/date pré-formatées, `setsDone`), `items` (solos vs Circuits, `amrap` / `completionSeconds`), `tonnageKg`.
- `session: null` → état vide honnête, **jamais** un zéro fabriqué.
- `session_id` optionnel pour cibler une séance ; défaut = la plus récente.

### Outil

- `render_session_card` renvoie `{ content:[{type:'text', text: <markdown summary>}], structuredContent: payload }` ; `isError: true` sur absence d'auth / `session_id` inconnu.
- `meta.ui.resourceUri` inchangé (T284).

### Vue

- `entry.tsx` : `App` reçoit le **tool result** (dialecte MCP Apps), parse `structuredContent`, `render(<SessionCard payload=… />)`.
- `SessionCard.tsx` rend les états **plein**, **vide** (`session:null`), **erreur** ; chaînes dynamiques rendues verbatim.

### Tests

- Fixtures **golden** partagées (JSON) : une séance solo, une avec Circuit AMRAP, une avec Circuit Tours, une vide.
- `lib/sessionCard_test.ts` (Deno) + `lib/sessionCard.test.ts` (Vitest) : projection, tonnage, completion time, score AMRAP, parité de durée.
- Test du rendu : le composant rend le payload (plein + vide + erreur).

## Out of Scope

- Locale `en|fr` et noms localisés → **T286**.
- `SKILL.md` → **T287**.
- QA dans un vrai hôte → **T288**.
- Toute interaction / écriture.

## Acceptance Criteria

- [ ] `render_session_card` renvoie la **dernière session terminée** : solos et Circuits, score **AMRAP** (`R+leftover`), temps **Tours**, **Tonnage**, durée.
- [ ] Dans Claude Desktop, la carte affiche la séance **réelle** de l'athlète.
- [ ] Aucune session terminée → **état vide** (pas de zéro fabriqué).
- [ ] Tonnage = `Σ weight_logged × reps` (sets `duration_seconds` et 0 kg exclus) ; test de parité vert.
- [ ] **AMRAP** jamais affiché nu (numéral + gloss) ; **Tours** affiche un temps.
- [ ] `structuredContent` présent ; repli **texte** pour les clients non-MCP-Apps.
- [ ] `readOnlyHint` conservé ; **aucun** chemin d'écriture.
- [ ] Tests Deno **et** Vitest verts (fixtures golden).

## References

- Epic Brief `file:docs/Epic_Brief_—_Surface_agentique_Nomos_#591.md` (stories 1, 3, 4, 5, 7, 9)
- Tech Plan `file:docs/Tech_Plan_—_Surface_agentique_Nomos_#591.md` (§ Data Model, Failure Mode Analysis)
- ADR `file:docs/adr/0027-agentic-view-contract.md`
- `file:supabase/functions/mcp/tools/getWorkoutHistory.ts`, `file:src/lib/profile/tonnage.ts`, `file:src/lib/blockCompletionHistory.ts`
