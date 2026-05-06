# T104 — Privacy Policy MCP / AI-Agent Disclosure

## Goal

Close the MCP/AI-agent disclosure gap on the existing privacy page at `https://www.gymlogic.me/privacy`. The page already covers the 6 Anthropic-required points (data collection, usage, storage, third-party sharing, retention, contact) — but says nothing about user data flowing to Claude / Cursor / Le Chat via MCP. This ticket adds a single `s2AIAgent` paragraph naming the integration, revises `s3Body` to list MCP routing as a sub-processor flow, and bumps the `lastUpdated` date — in both FR and EN locales.

No new component, no new route, no new section. Pure copy edit.

Addresses Epic Brief story **3**: directory reviewer wants a privacy policy that covers AI-agent integrations.

**Position in PR**: commit 5 of 5 on `feat/296/publish-mcp-connectors-directory`. Independent of T100-T103 (different files), can be reordered freely if convenient.

## Mode

**AFK** — exact copy is in the Tech Plan; FR translation is the only judgment call, and the maintainer is a native FR speaker so it's a no-op constraint.

## Slice

`src/locales/en/privacy.json (s2AIAgent + s3Body + lastUpdated)` → `src/locales/fr/privacy.json (same, in French)` → `src/pages/PrivacyPage.tsx (one render line)` → `src/pages/PrivacyPage.test.tsx (update if it asserts text)`

End-to-end demoable: `npm run dev`, navigate to `/privacy` in EN and FR, confirm the new MCP paragraph renders and `lastUpdated` shows "May 2026".

## Dependencies

None. Touches a different code area than T100-T103. Reorderable in commit sequence.

## Scope

### 1. Modify `file:src/locales/en/privacy.json`

Two changes:

**(a)** Add new key `s2AIAgent`:

```jsonc
"s2AIAgent": "AI agent integrations (Claude, Cursor, Le Chat, etc.): when you connect GymLogic via OAuth or a Personal Access Token, the agent reads your training data on your behalf. Writes (program creation/updates) require your explicit confirmation in-chat before execution.",
```

Place it **after** the existing `s2Device` key, before the closing brace of the `s2*` block (or wherever the natural alphabetic / logical order sits — match the existing pattern in the file).

**(b)** Replace `s3Body`:

```jsonc
"s3Body": "Your data is stored in Supabase (database, auth, file storage). AI generation requests are sent to Google Gemini. AI agent integrations are routed through Cloudflare and Supabase, with the agent's provider (Anthropic, OpenAI, Mistral, etc.) processing only the prompt and response. The app is hosted on Vercel. These are the only sub-processors. We do not sell or share your data with anyone else."
```

**(c)** Update `lastUpdated`:

```jsonc
"lastUpdated": "Last updated: May 2026",
```

### 2. Modify `file:src/locales/fr/privacy.json`

Same three changes, FR translation. Suggested copy (review before committing — adjust to match the existing FR voice in the file):

```jsonc
"s2AIAgent": "Intégrations avec des agents IA (Claude, Cursor, Le Chat, etc.) : lorsque vous connectez GymLogic via OAuth ou un Personal Access Token, l'agent lit vos données d'entraînement en votre nom. Les écritures (création / mise à jour de programme) nécessitent votre confirmation explicite dans le chat avant exécution.",

"s3Body": "Vos données sont stockées chez Supabase (base de données, authentification, stockage de fichiers). Les requêtes de génération IA sont envoyées à Google Gemini. Les intégrations avec des agents IA passent par Cloudflare et Supabase, le fournisseur de l'agent (Anthropic, OpenAI, Mistral, etc.) ne traitant que le prompt et la réponse. L'application est hébergée sur Vercel. Ce sont les seuls sous-traitants. Nous ne vendons ni ne partageons vos données avec qui que ce soit d'autre.",

"lastUpdated": "Dernière mise à jour : mai 2026",
```

**Translation discipline** (per Tech Plan): if you don't speak French fluently, ask the maintainer (native speaker) to review before committing. Do NOT ship machine-translated FR without a human pass.

### 3. Modify `file:src/pages/PrivacyPage.tsx`

One new line inside the existing `s2*` `<Section>` block. Locate the existing block (around lines 42-49):

```tsx
<Section title={t("s2Title")}>
  <p>{t("s2Auth")}</p>
  <p>{t("s2Profile")}</p>
  <p>{t("s2Workout")}</p>
  <p>{t("s2Analytics")}</p>
  <p>{t("s2AI")}</p>
  <p>{t("s2Device")}</p>
  <p>{t("s2AIAgent")}</p>  {/* NEW LINE */}
</Section>
```

`s3Body` rendering doesn't change — the existing `<p>{t("s3Body")}</p>` line already renders the revised content via the locale update.

### 4. Modify `file:src/pages/PrivacyPage.test.tsx` (if needed)

Open the file. If it asserts on:
- Section count → no change needed (we're adding a `<p>` inside an existing `<Section>`, not a new section).
- Specific rendered text in s2 block → update assertions to either include the new key OR be more lenient (e.g. assert key fragments rather than full text).
- Specific text in s3Body → update the assertion to match the revised content.
- `lastUpdated` text → update to "May 2026" / "mai 2026" depending on the locale being asserted.

Run `npm run test -- PrivacyPage` to verify. If the test passes without changes (e.g. it only asserts the page renders without errors), leave it alone.

### 5. Visual smoke (manual)

```bash
npm run dev
# Navigate to http://localhost:5173/privacy
# Confirm: new s2AIAgent paragraph renders inside the "What we collect" section.
# Confirm: s3Body paragraph reflects the new text mentioning MCP routing.
# Confirm: lastUpdated shows "Last updated: May 2026".
# Repeat in FR locale (toggle via UI or set i18n default).
# Confirm on mobile viewport (Chrome DevTools): paragraph length doesn't break layout.
```

## Out of Scope

- Adding a separate "AI agent integrations" section (s8) — copy stays inside s2 (collection scope) and s3 (sub-processors), where it belongs.
- Adding a dedicated `/privacy/mcp` page — single privacy URL is the convention reviewers expect.
- Updating the `s7Body` "Changes to this policy" text to acknowledge this is a material change — current policy already says "If we make material changes, we will update the date at the top". The `lastUpdated` bump is the change-notification mechanism. (User-facing email about the change is a separate ops decision, NOT a code ticket.)
- Legal review by a lawyer — explicitly deferred per Epic Brief Out-of-Scope (revisit when audience grows or B2B pivot happens).
- Other locales (DE, ES, etc.) — only EN + FR exist today; locale parity caps at what's shipped.

## Acceptance Criteria

- [ ] `src/locales/en/privacy.json` has the new `s2AIAgent` key, revised `s3Body`, and bumped `lastUpdated`.
- [ ] `src/locales/fr/privacy.json` has the equivalent in French (FR text reviewed by the maintainer if not a fluent FR speaker).
- [ ] `src/pages/PrivacyPage.tsx` renders the new `s2AIAgent` key.
- [ ] `npm run test -- PrivacyPage` passes (with or without test updates as needed).
- [ ] `npm run lint` passes.
- [ ] Visual smoke: `/privacy` in both locales shows the new paragraph; mobile layout intact.
- [ ] Demoable: navigate to https://www.gymlogic.me/privacy after deploy, confirm new content (post-merge ops, not blocking acceptance of this ticket).

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A4)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Key Decisions: privacy policy update strategy + i18n keys; Data Model section 5; Component Responsibilities → Privacy policy update; Implementation Notes commit 5; Failure Mode Analysis: privacy-related rows)
- Code anchors: `file:src/pages/PrivacyPage.tsx`, `file:src/locales/en/privacy.json`, `file:src/locales/fr/privacy.json`
- Anthropic review criteria: https://claude.com/docs/connectors/building/review-criteria (privacy URL requirements)
