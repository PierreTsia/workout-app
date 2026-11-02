# T709 — ADR 0035 + SKILL.md + CONTEXT.md locale contract

## Goal

Record the locale contract **before** implementation, so T710+ code against a decided
document. This ticket delivers ADR 0035, documents the `locale` argument in the MCP skill,
and fixes the stale **Display Locale** prose in `CONTEXT.md`. It closes the churn class's
documentation gap: the #677 plan deferred exercise names "suivi séparé", and ADR 0010 §37
deferred ranking — both are now settled here.

Addresses Epic Brief stories: **7, 8, 9** (agent locale contract) and the invariant behind
**2, 10** (retroactive correction).

## Mode

AFK — the decisions are pinned in the Tech Plan.

## Slice

`docs/adr/0035-*.md` (new) → `file:skills/gymlogic-mcp/SKILL.md` → `file:docs/CONTEXT.md`.

## Dependencies

None.

## Scope

### ADR 0035 — "Resolve workout labels at display time, everywhere"

Contents (per Tech Plan Key Decisions):

| Decision | Record |
|---|---|
| Name resolution | `name_en` (EN) → `name` → `name_snapshot` — extends ADR 0010 |
| MCP `locale` argument | Optional on **every** name-emitting tool (read **and** write); precedence explicit → profile seed → `en` |
| `locale` on a write tool | Drives only the dry-run echo; stripped before persistence; never localizes a snapshot |
| `muscle_group` | DB values **unchanged**; MCP output localized. **Reverses** the Epic Brief's "migrate to EN slugs" |
| `localeAtom` | No code change (already `en`); only `CONTEXT.md` prose. **Reverses** the Epic Brief's earlier code-change scope item |
| Warnings | Both layers localized: typed `warning_details` (view) **and** markdown `warnings[]` (non-UI clients) |
| Ranking | Defaulted `locale` param on `search_exercises` / `resolve_exercises_batch`; **supersedes ADR 0010 §37** (which deferred it + its own ADR) |
| `programDraft` §E | Accepted limitation — French snapshot reaches the LLM as context only; output validated against catalog `name_en` |
| Guard | Golden fixtures per surface + muscle-table parity |

Must state explicitly:
- **ADR 0010:** amended — display-time resolution now covers MCP output and muscle labels.
- **ADR 0010 §37:** **contradicted** — ranking pulled in-scope and its ADR folded into this one.
- **ADR 0031:** **card-locale precedence unchanged** — ADR 0035 assumes ADR 0031's chain
  (explicit → host → profile → `en`); the server `locale` argument reuses it, it does not
  reorder it. **Its §Amendment clause "French `warnings[]` stay for non-UI clients" is
  superseded** — the markdown `warnings[]` is now localized.
- **Two reversals vs the Epic Brief:** `muscle_group` (output-only, not DB rename) and
  `localeAtom` (already fixed, docs-only).

### SKILL.md

Document `locale` (`en` | `fr`) for each tool that gains it, mirroring the existing
`update_program` / `render_session_card` wording: *"Language of user-facing labels. Defaults
to the host's language, then the athlete's stored locale, then English."*

### CONTEXT.md — Display Locale

Remove/correct the claim that `localeAtom` starts at `"fr"` while `fallbackLng` is `"en"` —
`file:src/store/atoms.ts` already defaults to `detectLocale(navigator.language) ?? "en"`.

## Out of Scope

- Any code change (all implementation is T710–T716).

## Acceptance Criteria

- [ ] `docs/adr/0035-*.md` exists with Status/Date/Context/Decision/Consequences/Alternatives.
- [ ] ADR 0035 explicitly names ADR 0010 and ADR 0031 and states which parts it amends/supersedes (0010 amended, §37 contradicted, 0031 precedence unchanged).
- [ ] ADR 0035 records the `muscle_group` reversal against the Epic Brief's wording.
- [ ] ADR 0035 records the `localeAtom` reversal and the `programDraft` §E accepted limitation.
- [ ] `skills/gymlogic-mcp/SKILL.md` lists `locale` for every tool in the Tech Plan's in-scope list.
- [ ] `CONTEXT.md` **Display Locale** no longer claims `localeAtom` defaults to `fr`.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Locale_end-to-end_#729.md`
- Tech Plan: `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md` (Key Decisions)
- Issue: #729
