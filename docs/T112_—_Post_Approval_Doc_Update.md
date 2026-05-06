# T112 — Post-Approval Doc Update

## Goal

Once Anthropic approves the connector (and ideally the plugin too) and GymLogic appears in `claude.com/connectors/directory`, replace the "Coming soon" callout in user-facing docs with the actual directory listing URL. Add a small banner-style "Available in Claude Connectors Directory" callout so users discover the one-click install path.

This is the **closing ticket** of #296 — represents "epic shipped" and "discoverable in the Anthropic ecosystem".

Addresses Epic Brief Track **D3** + closes the loop on stories **1, 7**.

## Mode

**HITL** — gated on Anthropic approval (variable wall-clock; could be days, could be weeks). Once triggered, the work itself is mechanical (docs only) — could even bring back to AFK if you split into a "wait" phase + "execute" phase.

## Slice

`#302's claude.mdx (Astro mini-site, replace ComingSoon callout)` → `docs/mcp-connect/claude-desktop.md (source markdown sync)` → optional: SKILL.md mention of directory listing

## Dependencies

- **T108** (connector submission) — Anthropic approval received.
- (Optional) **T111** (plugin submission) — if plugin also approved, mention in callout.
- **#302** has shipped (so `claude.mdx` exists at `docs.gymlogic.me/connect/claude`).

## Scope

### 1. Update `web/src/content/connect/claude.mdx` (Astro mini-site)

Per #302's `T93` / `T95` work, the page has a `<ComingSoon>` component / callout. Replace it with a callout linking to the directory listing.

Find the existing block (likely in the "Setup" section near the top):

```mdx
<ComingSoon>
  GymLogic will soon be available as a one-click connector in the [Claude Connectors Directory](https://claude.com/connectors/directory). Until then, follow the manual setup below.
</ComingSoon>
```

Replace with:

```mdx
<Callout type="success" title="Available in Claude">
  GymLogic is in the [Claude Connectors Directory](<DIRECTORY_LISTING_URL>) — install with one click from Claude Desktop / Claude.ai. The manual setup below is only needed for non-Claude MCP clients.
</Callout>
```

Where `<DIRECTORY_LISTING_URL>` is the canonical URL to the GymLogic listing in Anthropic's directory (captured during T108 follow-up).

If the plugin also approved (T111 done), extend:

```mdx
<Callout type="success" title="Available in Claude">
  GymLogic is in the [Claude Connectors Directory](<CONNECTOR_URL>) and the [Claude Plugins Directory](<PLUGIN_URL>) — install with one click from Claude Desktop / Claude.ai. The manual setup below is only needed for non-Claude MCP clients.
</Callout>
```

### 2. Sync `docs/mcp-connect/claude-desktop.md` (source markdown)

Per #302's "drift-tolerance" rule (T95), source markdown and MDX must stay congruent on PAT setup truth. Update the equivalent callout / intro block in `docs/mcp-connect/claude-desktop.md` with the same Connectors Directory message.

If the source file doesn't have a callout block today, add one at the top:

```markdown
> ✅ **Available in Claude**: GymLogic is in the [Claude Connectors Directory](<DIRECTORY_LISTING_URL>) — install with one click from Claude Desktop / Claude.ai. The manual setup below is only needed for non-Claude MCP clients.
```

### 3. Update `skills/gymlogic-mcp/SKILL.md` (optional)

The skill is for the LLM, not end users — directory listing isn't directly relevant. But the intro paragraph (line 13) mentions the GymLogic MCP server; consider adding a one-liner under "About this skill" pointing future LLMs (and future-you) at the directory listing as additional context. **Optional, low priority.**

### 4. SPA mention (optional)

If the SPA has a "Connect Claude" badge or onboarding step (per #295 — downstream epic), consider updating the badge text from "Coming soon" to "Install now" with the directory link. **Out of scope here** — that's #295's territory; flag in #295's tracking comment.

### 5. Verify the deploy

After commit + merge to `main`:
- Vercel auto-deploys `web/` (Astro) per `file:.github/workflows/ci.yml` `deploy-web` job.
- Visit https://docs.gymlogic.me/connect/claude — confirm the new callout renders.
- Check both light and dark themes if the Callout component theme-shifts.

### 6. Close the epic

This ticket landing means #296 is **done**. Move related docs:

```bash
mv docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md docs/done/
mv docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md docs/done/
mv docs/T100_—_Tool_Annotations_on_All_10_MCP_Tools.md docs/done/
mv docs/T101_—_Extract_getPublicMcpUrl_to_lib_publicUrl.md docs/done/
mv docs/T102_—_Cloudflare_Worker_Proxy_+_CI_Worker-Unit_Job.md docs/done/
mv docs/T103_—_Switch_User-Facing_Docs_to_mcp.gymlogic.me.md docs/done/
mv docs/T104_—_Privacy_Policy_MCP_AI-Agent_Disclosure.md docs/done/
mv docs/T105_—_Deploy_Worker_to_Production_+_Ops_Setup.md docs/done/
mv docs/T106_—_Prepare_Directory-Reviewer_Test_Account.md docs/done/
mv docs/T107_—_Anthropic_Submission_Branding_Assets.md docs/done/
mv docs/T108_—_Submit_to_Connectors_Directory.md docs/done/
mv docs/T109_—_MCP_Inspector_Validation_Pass.md docs/done/
mv docs/T110_—_Plugin_Packaging_Research.md docs/done/
mv docs/T111_—_Validate_and_Submit_Plugin.md docs/done/
mv docs/T112_—_Post_Approval_Doc_Update.md docs/done/
```

(Same convention as the other completed epics in `docs/done/`.)

Close the GitHub issue #296 with a summary comment linking to the directory listing.

## Out of Scope

- Major copy revisions to the docs page — only the callout swap; existing content stays intact.
- Marketing campaign / social posts — separate concern.
- New badge in SPA onboarding — that's #295.
- Re-organizing `docs/mcp-connect/*.md` files — drift-tolerance window stays open; major reorganizing is a separate cleanup ticket.

## Acceptance Criteria

- [ ] `web/src/content/connect/claude.mdx` updated: `<ComingSoon>` → `<Callout>` linking to directory listing URL.
- [ ] `docs/mcp-connect/claude-desktop.md` updated with equivalent callout.
- [ ] `https://docs.gymlogic.me/connect/claude` deploys + renders the new callout (visual smoke).
- [ ] All #296 epic docs (Epic Brief, Tech Plan, T100-T112) moved to `docs/done/`.
- [ ] GitHub issue #296 closed with a summary comment linking to the directory listing.
- [ ] Demoable: visit `docs.gymlogic.me/connect/claude` post-deploy; new callout visible at the top of the page.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track D3)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes → Deferred ticket scope: D3)
- #302 callout component: T93 / T95 — `file:docs/T95_—_Claude_Content_+_Screenshots.md` (`<ComingSoon>` and `<Callout>` patterns)
- Predecessors: T108 (Anthropic connector approval), T111 (plugin approval — optional)
- Drift-tolerance rule: see #302 Tech Plan + T95
