# Connect GymLogic to Hermes

Wire GymLogic's MCP server into [Hermes](https://github.com/PierreTsia/hermes) so the agent can read your training data and create or replace your active program with `create_program`.

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- Hermes installed (verified against the `hermes` CLI with an HTTP MCP server)

## Transport note

Hermes connects to remote MCP servers over **Streamable HTTP** (POST). GymLogic accepts POST and does **not** serve the GET-SSE handshake, so leave Hermes on its default transport — do **not** set `transport: sse`, which returns `405` (tracked in [#266](https://github.com/PierreTsia/workout-app/issues/266)).

## Setup

### 1. Create a Personal Access Token (PAT)

1. Sign in at [gymlogic.me](https://gymlogic.me)
2. Go to **Account** > **Security & access** > **Manage API tokens** (or [gymlogic.me/account/api-tokens](https://gymlogic.me/account/api-tokens))
3. Click **Create token**
4. Give it a clear name (e.g. `Hermes VPS`) and pick a lifetime
5. **Copy the token now** — it starts with `glp_` and is shown only once

### 2. Add the MCP server

Let the CLI prompt for the token so it never lands in shell history:

```bash
hermes mcp add gymlogic \
  --url https://mcp.gymlogic.me/functions/v1/mcp \
  --auth header
```

Or edit `~/.hermes/config.yaml` directly:

```yaml
mcp_servers:
  gymlogic:
    url: https://mcp.gymlogic.me/functions/v1/mcp
    headers:
      Authorization: "Bearer glp_…"
```

> **Schema gotcha** — the key is `mcp_servers` (Hermes' schema), NOT `mcpServers` (Cursor / Claude Desktop) and NOT OpenClaw's `mcp.servers`.

### 3. Reload and verify

```bash
hermes mcp list          # gymlogic should be listed
```

Then ask Hermes something training-related. Tools are read at agent boot, so restart a running agent/gateway after the config change.

## Load the GymLogic Skill (recommended)

The connector exposes the tools; the **Skill** ([`skills/gymlogic-mcp/SKILL.md`](../../skills/gymlogic-mcp/SKILL.md)) teaches Hermes *how* to use them well — the propose-confirm-act handshake on every write, the per-side weight convention ([#263](https://github.com/PierreTsia/workout-app/issues/263)), bilingual routing.

```bash
mkdir -p ~/.hermes/skills/gymlogic-mcp
curl -L https://raw.githubusercontent.com/PierreTsia/workout-app/main/skills/gymlogic-mcp/SKILL.md \
  -o ~/.hermes/skills/gymlogic-mcp/SKILL.md
```

Hermes picks it up on the next skill scan; it triggers on training prompts in FR or EN.

## Available tools

| Tool | What it does |
|---|---|
| `search_exercises` | Search the exercise catalog by name (FR/EN), muscle group, equipment, or difficulty |
| `resolve_exercises` | Resolve a batch of exercise names (up to 30) to catalog UUIDs in one call — bundles `weight_convention`, `measurement_type`, `default_duration_seconds` |
| `get_exercise_details` | Full exercise info: instructions, muscles, equipment, media |
| `get_workout_history` | Your past sessions with sets, weights, and PRs |
| `get_training_stats` | Volume by muscle group, personal records, session frequency |
| `get_upcoming_workouts` | Your programmed training days and exercises |
| `list_programs` | List all your training programs (active, drafts, optionally archived) with id, name, day count, creation date, active-cycle flag |
| `get_program_details` | Full structure of one program by UUID — works on any program (active/draft/archived) |
| `create_program` | **Create / replace your active program** from structured days + exercise UUIDs. Default **`dry_run: true`**; **`dry_run: false`** writes and deactivates other active programs |
| `create_workout_day` | **Log a single ad-hoc session** without touching the active program. `dry_run` defaults to `true` |
| `update_program` | **Edit an existing program in place** by `program_id` — preserves logged history. `dry_run` defaults to `true`; removing days also needs `confirm: true` |

**Eleven tools** — eight reads, three writes.

## Example prompts

- "Montre-moi mes 5 dernières séances"
- "Analyse mon équilibre push/pull sur le dernier mois"
- "C'est quoi mon prochain training ?"
- "Voici ma semaine type en 4 jours — enregistre ça comme programme actif (dry run puis apply avec create_program)"

## Rotating or revoking a token

- **Rotate**: create a new token, swap it into `mcp_servers.gymlogic.headers.Authorization`, restart the agent, then revoke the old one.
- **Revoke**: click **Revoke** next to the token at `/account/api-tokens`. Immediate and irreversible — the next call returns `401`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `405` / `SSE error` on connect | `transport: sse` is set. Remove it so Hermes uses Streamable HTTP POST — GymLogic only serves POST ([#266](https://github.com/PierreTsia/workout-app/issues/266)) |
| `401 Authentication required` | Token revoked, expired, or mistyped. Mint a fresh one and re-add the header |
| `gymlogic` missing from `hermes mcp list` | Check the YAML path: `mcp_servers.gymlogic` with `url` + `headers`, then reload |
| Tools not callable in a running session | Restart the agent/gateway — MCP tools are read at boot |
