# Connect GymLogic to Le Chat (Mistral)

Use your training data and exercise catalog in Le Chat conversations via GymLogic's MCP server, and **persist a new multi-day program** with `create_program` once you agree on the plan (dry run, then apply).

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- A [Le Chat](https://chat.mistral.ai) account (free tier works)

## Setup — recommended path: Personal Access Token (API Key)

Le Chat's Custom MCP Connector lets you authenticate with a static API Key, which is the simplest and most stable option for GymLogic. You generate a long-lived Personal Access Token (PAT) on GymLogic, paste it into Le Chat once, and you're done — no OAuth round-trip, no expiring sessions.

### 1. Create a Personal Access Token

1. Go to [gymlogic.me/account/api-tokens](https://gymlogic.me/account/api-tokens)
2. Click **Create token**
3. Give it a recognizable name (e.g. `Le Chat`) and a lifetime (default `30 days`; pick `Never` only if you understand the trade-off)
4. Click **Create**
5. **Copy the token immediately** — it starts with `glp_` and is shown only once. If you lose it, just revoke and create a new one.

### 2. Create the Le Chat Connector

1. Go to [chat.mistral.ai](https://chat.mistral.ai) and sign in
2. Click **Intelligence** in the left sidebar, then select **Connectors**
3. Click **Add Connector** (top-right)
4. Switch to the **Custom MCP Connector** tab
5. Fill in:
   - **Connector Name**: `gymlogic`
   - **Connector Server**: `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp`
   - **Authentication Method**: select **API Key**
   - **API Key**: paste your `glp_…` token from step 1
6. Click **Connect** — Le Chat probes the server and saves the connector

### 3. Create an Agent with the Connector

Connectors don't work in regular chats — you need an Agent:

1. Go to **Intelligence** > **Agents**
2. Click **Create Agent**
3. Give it a name (e.g. "Coach GymLogic")
4. In the **Connectors** section, toggle on the **gymlogic** connector you just created
5. (Optional) Add system instructions like: _"You are a personal training coach. Use the gymlogic tools for history, stats, catalog, and upcoming workouts; use `create_program` only after a clear dry-run preview and explicit user consent to apply."_
6. Click **Save**

### 4. Start a conversation

1. Go back to **Intelligence** > **Agents**
2. Click your Agent, then **New Chat**
3. Ask something — Le Chat will automatically discover and use the GymLogic tools

### Rotating or revoking the token

- **Revoke**: at any time on [gymlogic.me/account/api-tokens](https://gymlogic.me/account/api-tokens). Revocation is immediate (the token is hard-deleted) — Le Chat will start getting `401 Unauthorized` on the next tool call.
- **Rotate**: create a new token, paste it into the Le Chat connector (re-edit it if Le Chat allows in-place editing, or delete + recreate the connector), then revoke the old one.

## Alternative path: OAuth 2.1

If you'd rather authenticate via OAuth (e.g. you don't want a long-lived token sitting in Le Chat), the connector supports that too — but be aware that Mistral's OAuth client registration with GymLogic has historically been less stable than other MCP clients (see Troubleshooting below).

1. In step 2 above, pick **OAuth 2.1** instead of **API Key**, and leave the API Key field empty.
2. Click **Connect**. Le Chat opens the GymLogic consent screen.
3. If you're not already signed in to GymLogic, you'll be redirected to the login page first — sign in with your Google account.
4. Review the permissions requested by Le Chat and click **Approve**.
5. You're redirected back to Le Chat — the connector now shows as connected.

The rest of the setup (Agent + chat) is identical.

## Available tools

| Tool                    | What it does                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `search_exercises`      | Search the exercise catalog by name (FR/EN), muscle group, equipment, or difficulty                                          |
| `get_exercise_details`  | Full exercise info: instructions, muscles, equipment, media                                                                  |
| `get_workout_history`   | Your past sessions with sets, weights, and PRs                                                                               |
| `get_training_stats`    | Volume by muscle group, personal records, session frequency                                                                  |
| `get_upcoming_workouts` | Your programmed training days and exercises                                                                                  |
| `create_program`        | **Create / replace your active program** (multi-day). Default **`dry_run: true`**; **`dry_run: false`** saves and activates. |

**Six tools** — five reads, one write (`create_program`).

## Example prompts

- "What did I train this week?"
- "Search for chest exercises with dumbbells"
- "How's my training volume this month?"
- "What's my next workout?"
- "Tell me about the Kroc Row"
- "Based on my stats, propose a 3-day full-body refresh and save it with create_program (show dry run first)"

## Troubleshooting

| Problem                                                                                 | Fix                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401 Unauthorized` from tool calls (API Key path)                                       | Token may have been revoked or expired. Generate a new PAT at `gymlogic.me/account/api-tokens` and update the connector.                                                                                                                                                                  |
| OAuth consent fails with `validation_failed: authorization request cannot be processed` | Mistral's stored OAuth client registration on the GymLogic auth server may be stale. The simplest fix is to switch the connector to **API Key** (PAT). If you want to insist on OAuth, contact admin to clean up the dynamic client registrations server-side, then re-add the connector. |
| OAuth consent page doesn't load                                                         | Make sure you're signed in to GymLogic at `www.gymlogic.me` first, then retry                                                                                                                                                                                                             |
| `unauthorized request origin` error                                                     | Your browser must be on `www.gymlogic.me` (not `gymlogic.me` without www). The Supabase Site URL must match.                                                                                                                                                                              |
| Tools not appearing in chat                                                             | You must chat via an **Agent** that has the gymlogic Connector enabled, not a regular chat                                                                                                                                                                                                |
| Agent doesn't call tools                                                                | Make sure the Connector toggle is on in the Agent config. Try an explicit prompt like "Use gymlogic to show my last 5 workouts"                                                                                                                                                           |

## Headless / scripted access (outside Le Chat)

The same PAT also works as a Bearer token for direct HTTP calls to the MCP server — handy for CI jobs, custom agents, or `curl`-based debugging:

```bash
curl -X POST https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp \
  -H "Authorization: Bearer <YOUR_PAT>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

You can use the same token in Le Chat and in scripts simultaneously, or create separate tokens per use-case for cleaner audit and revocation.
