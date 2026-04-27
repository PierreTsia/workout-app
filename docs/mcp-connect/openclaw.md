# Connect GymLogic to OpenClaw

Wire GymLogic's MCP server into [OpenClaw](https://docs.openclaw.ai) so any agent running on the OpenClaw runtime (e.g. [Iris / sudo-ceo](https://github.com/PierreTsia/sudo-ceo)) can read your training data and create or replace your active program with `create_program`.

> ⚠️ **Pending [#266](https://github.com/PierreTsia/workout-app/issues/266)** — OpenClaw's strict Streamable-HTTP MCP transport opens an SSE stream that our edge function currently rejects with `405`. The wiring below is **valid for the day #266 ships**; until then you'll see `[bundle-mcp] failed to start server "gymlogic": Error: SSE error: Non-200 status code (405)` in the gateway logs. Cursor, Le Chat, and Claude Desktop all work today because they fall back to plain POST.

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- [OpenClaw](https://docs.openclaw.ai) installed (verified against `openclaw 2026.4.21` and later)

## Setup

### 1. Create a Personal Access Token (PAT)

1. Sign in at [gymlogic.me](https://gymlogic.me)
2. Open **Account** > **Security & access** > **Manage API tokens** (or go directly to [gymlogic.me/account/api-tokens](https://gymlogic.me/account/api-tokens))
3. Click **Create token**
4. Give it a clear name (e.g. `OpenClaw / Iris`) and pick a lifetime (30 / 90 / 365 days, or never)
5. **Copy the token now** — it starts with `glp_` and is shown only once. Treat it like a password.

> Tokens are scoped to your account (full read + program write). Lost a token? Revoke it from the same page; the next request from that token will return 401.

### 2. Add the MCP server

Edit `~/.openclaw/openclaw.json` (overridable via `OPENCLAW_CONFIG_PATH`):

```json
{
  "mcp": {
    "servers": {
      "gymlogic": {
        "url": "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp",
        "headers": {
          "Authorization": "Bearer <YOUR_PAT>"
        }
      }
    }
  }
}
```

> **Schema gotcha** — the top-level key is **`mcp.servers`**, NOT `mcpServers` (the Cursor / Claude Desktop convention). OpenClaw rejects `mcpServers` with `Unrecognized key: mcpServers` and the gateway crash-loops on startup. Confirmed via `openclaw config schema`.

### 2bis. CLI alternative

If you'd rather not edit JSON by hand:

```bash
openclaw mcp set gymlogic '{"url":"https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp","headers":{"Authorization":"Bearer <YOUR_PAT>"}}'
openclaw mcp list                # confirms "gymlogic" is registered
openclaw mcp show gymlogic       # prints the stored config
openclaw mcp unset gymlogic      # remove
```

### 3. Validate, restart, verify

```bash
openclaw config validate
# or against a candidate file:
OPENCLAW_CONFIG_PATH=/tmp/candidate.json openclaw config validate
```

Strongly recommended in deploy scripts — catches schema drift before the gateway tries to boot.

OpenClaw hot-reloads (`[reload] config hot reload applied`), but for first-time wiring a clean restart is more reliable:

```bash
systemctl --user restart openclaw-gateway.service   # systemd-managed installs (sudo-ceo, prod)
openclaw gateway --force                             # manual / dev mode
```

Verify:

```bash
openclaw mcp list
journalctl --user -u openclaw-gateway.service -n 30 --no-pager
```

You're looking for `[bundle-mcp] starting server "gymlogic"` with no SSE errors. (Today, this is where you'll hit the [#266](https://github.com/PierreTsia/workout-app/issues/266) blocker.)

## Available tools

| Tool | What it does |
|---|---|
| `search_exercises` | Search the exercise catalog by name (FR/EN), muscle group, equipment, or difficulty |
| `get_exercise_details` | Full exercise info: instructions, muscles, equipment, media |
| `get_workout_history` | Your past sessions with sets, weights, and PRs |
| `get_training_stats` | Volume by muscle group, personal records, session frequency |
| `get_upcoming_workouts` | Your programmed training days and exercises |
| `create_program` | **Create / replace your active program** from structured days + exercise UUIDs. Default **`dry_run: true`** returns the insert plan only; **`dry_run: false`** writes to Supabase (deactivates other active programs). Use after `search_exercises` / `get_exercise_details` to resolve IDs. |

There is also one **MCP Resource** (`exercise_catalog_schema`) exposing the exercise taxonomy (muscle groups, equipment types, difficulty levels).

**Six tools** total — five for reads/analysis, one for persisting a full program.

> **Building agent-side context?** [`skills/gymlogic-mcp/SKILL.md`](../../skills/gymlogic-mcp/SKILL.md) is a drop-in prompt context covering tool intent, weight conventions for unilateral equipment, and edge cases. Load it into your agent's system prompt or skill registry.

## Example prompts

In French:

- "Montre-moi mes 5 dernières séances"
- "C'est quoi mon prochain training ?"
- "Analyse mon équilibre push/pull sur le dernier mois"
- "Voici ma semaine type en 4 jours — sauvegarde ça comme programme actif (dry run puis apply avec create_program)"

In English:

- "What did I train this week?"
- "Search for chest exercises with dumbbells"
- "Tell me about the Romanian Deadlift"
- "Propose a 3-day full-body refresh and save it with create_program (dry run first)"

## Pro tip: env-var indirection for templated configs

In CI/CD or a templated repo (like sudo-ceo), don't paste the PAT directly into `openclaw.json`. Use OpenClaw's env-var reference:

```bash
openclaw config set mcp.servers.gymlogic.headers.Authorization \
  --ref-source env --ref-id GYMLOGIC_PAT
```

Or template the file with `envsubst` and run `openclaw config validate` as a pre-flight in your deploy script — see [`scripts/apply-config.sh`](https://github.com/PierreTsia/sudo-ceo/blob/main/scripts/apply-config.sh) for a working example.

## Rotating or revoking a token

- **Rotate**: create a new token, swap it into `~/.openclaw/openclaw.json` (or update the env var if you used the indirection trick), restart the gateway, then revoke the old one from `/account/api-tokens`.
- **Revoke**: hit **Revoke** next to the token. Revocation is immediate and irreversible — the next request returns 401.
- **Lost server / leaked token**: revoke the corresponding PAT. Any other tokens you created keep working.

## Troubleshooting

| Problem | Fix |
|---|---|
| Gateway crash-loops after a config edit | Run `openclaw config validate` (or `OPENCLAW_CONFIG_PATH=/path/to/file openclaw config validate`) — almost always schema drift caught here. |
| `Unrecognized key: mcpServers` | The schema is `mcp.servers`, NOT `mcpServers`. Different from Cursor / Claude Desktop. |
| `SSE error: Non-200 status code (405)` | Blocked on [#266](https://github.com/PierreTsia/workout-app/issues/266) — server-side SSE support not shipped yet. No client-side workaround. |
| `401 Authentication required` | Token revoked, expired, or mistyped. Create a fresh one at [/account/api-tokens](https://gymlogic.me/account/api-tokens) and swap it in. |
| `gymlogic` not appearing in `openclaw mcp list` | Re-check the JSON path — top-level key must be `mcp.servers.gymlogic`, not `mcpServers.gymlogic`. Then restart the gateway. |
| Tools missing in agent chats but `mcp mcp list` shows the server | Restart the agent process — connector lists are cached at agent boot. |

## Headless / scripted access (outside OpenClaw)

The same PAT works as a Bearer token for direct HTTP calls — handy for CI jobs or `curl`-based debugging:

```bash
curl -X POST https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp \
  -H "Authorization: Bearer <YOUR_PAT>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

You can use the same token in OpenClaw and in scripts simultaneously, or create separate tokens per use-case for cleaner audit and revocation.
