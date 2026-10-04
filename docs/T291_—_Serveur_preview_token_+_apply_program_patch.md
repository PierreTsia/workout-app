# T291 — Serveur : `preview_token` + `apply_program_patch` + aperçu `update_program`

## Goal

Côté serveur MCP : émettre un **token signé** dans l'aperçu d'`update_program` et livrer l'outil **`apply_program_patch`** (`visibility:["app"]`) qui l'exige pour appliquer. Le modèle ne peut pas obtenir le token → le chemin carte est enforcé serveur, indépendamment de la conformité de l'hôte. Epic [#643](https://github.com/PierreTsia/workout-app/issues/643).

## Mode

AFK — décisions et contrat figés par T290 ; travail mécanique testable.

## Slice

edge lib (`previewToken`) → tool `applyProgramPatch` → tool `updateProgram` (aperçu + token + `_meta`) → `tools/registry` (`_meta` élargi) → tests Deno/Vitest.

## Dependencies

T290 (ADR/contrat).

## Scope

### `supabase/functions/mcp/lib/previewToken.ts`

- Copie fidèle du pattern `file:supabase/functions/_shared/unsubscribeToken.ts` : base64url + HMAC-SHA256 via `crypto.subtle`.
- Payload `{ u: string; exp: number; p: string; patch: { name?; days? }; confirm: boolean }`.
- `mintPreviewToken(payload, secret)` / `verifyPreviewToken(token, secret)` → `null` si signature invalide, `exp` dépassé.
- `previewSecret()` : `Deno.env.get("MCP_PREVIEW_SECRET")` → repli `WEBHOOK_SECRET` → `null` (mint échoue proprement).
- TTL proposition : 15 min.

### `supabase/functions/mcp/tools/applyProgramPatch.ts`

- `name: "apply_program_patch"`, `annotations: { title: "Apply program change", readOnlyHint: false, destructiveHint: true, idempotentHint: true }`.
- `_meta: { ui: { visibility: ["app"] } }` — **sans** `resourceUri`.
- `inputSchema: { preview_token: string }` requis.
- Handler : auth → `verifyPreviewToken` → contrôle `u === user.id` → **délègue à `updateProgram.handler({ ...token.patch, dry_run: false, confirm: token.confirm }, supabase)`**. Aucune duplication de la validation/diff/apply.
- Renvoie le résultat + `structuredContent = { status: "applied", program_id, applied_days, failed_at, remaining_days, warnings, message }`.

### `supabase/functions/mcp/tools/updateProgram.ts`

- `_meta: { ui: { resourceUri: "ui://gymlogic/program-patch" } }`.
- Branche `dry_run` : mint le token sur `{ u: userId, exp, p: program_id, patch: args−dry_run, confirm }`, et renvoie `structuredContent = { status:"preview", dry_run:true, program_id, rendered, removed_days, added_days, warnings, preview_token }` en plus du `content` markdown actuel (le token **jamais** dans le texte).
- Branche apply (`dry_run:false`) : renvoie aussi `structuredContent = { status:"applied", … }`.
- `dry_run:false` et la description « Re-call with `dry_run:false` to apply » **conservés**.

### `supabase/functions/mcp/tools/registry.ts`

- `_meta?: { ui?: { resourceUri?: string; visibility?: Array<"model"|"app"> } }` (élargissement rétro-compatible).
- Enregistrer `applyProgramPatch`.

### Tests

- Deno/Vitest : mint/verify (round-trip, exp, signature altérée, secret absent, user mismatch).
- `updateProgram` dry_run : `structuredContent.preview_token` présent, `content.text` **sans** token.
- `apply_program_patch` : token valide → write ; token invalide/expiré/autre user → `isError:true`, **aucun** write.

## Out of Scope

- La vue et son artefact → T292.
- Le SKILL et les docs `mcp-connect` → T293.
- Propose-only (`update_program` garde `dry_run:false`).

## Acceptance Criteria

- [ ] `npm test` vert : nouveaux tests `previewToken`, `updateProgram`, `applyProgramPatch`.
- [ ] `tools/list` expose `apply_program_patch` avec `_meta.ui.visibility:["app"]` et `update_program` avec `_meta.ui.resourceUri` (test d'arch).
- [ ] `update_program{dry_run:true}` renvoie un `preview_token` dans `structuredContent` ; le `content.text` ne le contient pas.
- [ ] `apply_program_patch` avec un token valide applique le patch prévisualisé ; rejouer le même token donne le même état (idempotent).
- [ ] `apply_program_patch` avec token absent/invalide/expiré/d'un autre user → `isError:true` et zéro écriture (prouvé par test).
- [ ] Aucune régression sur les 11 outils existants (`dry_run:false` d'`update_program` fonctionne toujours).

## References

- Epic [#643](https://github.com/PierreTsia/workout-app/issues/643) · Tech Plan `file:docs/Tech_Plan_—_Agentic_components_show_act_#643.md` (Data Model, Component Architecture)
- `file:supabase/functions/_shared/unsubscribeToken.ts` · `file:supabase/functions/mcp/tools/updateProgram.ts` · `file:supabase/functions/mcp/tools/registry.ts`
