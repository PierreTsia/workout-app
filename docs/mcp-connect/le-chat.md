# Connect GymLogic to Le Chat (Mistral)

Use your training data and exercise catalog in Le Chat conversations via GymLogic's MCP server.

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- A [Le Chat](https://chat.mistral.ai) account (free tier works)

## Setup

### 1. Create a Connector

1. Go to [chat.mistral.ai](https://chat.mistral.ai) and sign in
2. Click **Intelligence** in the left sidebar, then select **Connectors**
3. Click **Add Connector** (top-right)
4. Switch to the **Custom MCP Connector** tab
5. Fill in:
   - **Connector Name**: `gymlogic`
   - **Connector Server**: `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp`
   - **Authentication Method**: select **OAuth 2.1**
6. Click **Connect**

### 2. Authenticate via OAuth

After clicking Connect, Le Chat opens the GymLogic consent screen:

1. If you're not already signed in to GymLogic, you'll be redirected to the login page first — sign in with your Google account
2. Review the permissions requested by Le Chat
3. Click **Approve**
4. You're redirected back to Le Chat — the connector now shows as connected

### 3. Create an Agent with the Connector

Connectors don't work in regular chats — you need an Agent:

1. Go to **Intelligence** > **Agents**
2. Click **Create Agent**
3. Give it a name (e.g. "Coach GymLogic")
4. In the **Connectors** section, toggle on the **gymlogic** connector you just created
5. (Optional) Add system instructions like: *"You are a personal training coach. Use the gymlogic tools to answer questions about the user's training history, stats, and exercise catalog."*
6. Click **Save**

### 4. Start a conversation

1. Go back to **Intelligence** > **Agents**
2. Click your Agent, then **New Chat**
3. Ask something — Le Chat will automatically discover and use the GymLogic tools

## Available tools

| Tool | What it does |
|---|---|
| `search_exercises` | Search the exercise catalog by name (FR/EN), muscle group, equipment, or difficulty |
| `get_exercise_details` | Full exercise info: instructions, muscles, equipment, media |
| `get_workout_history` | Your past sessions with sets, weights, and PRs |
| `get_training_stats` | Volume by muscle group, personal records, session frequency |
| `get_upcoming_workouts` | Your programmed training days and exercises |

## Example prompts

- "What did I train this week?"
- "Search for chest exercises with dumbbells"
- "How's my training volume this month?"
- "What's my next workout?"
- "Tell me about the Kroc Row"

## Troubleshooting

| Problem | Fix |
|---|---|
| OAuth 2.1 not selectable in dropdown | Make sure you entered the exact MCP URL above — Le Chat probes it for OAuth discovery |
| OAuth consent page doesn't load | Make sure you're signed in to GymLogic at `www.gymlogic.me` first, then retry |
| `unauthorized request origin` error | Your browser must be on `www.gymlogic.me` (not `gymlogic.me` without www). The Supabase Site URL must match. |
| "Authentication required" errors | Token may have expired — disconnect the Connector and reconnect |
| Tools not appearing in chat | You must chat via an **Agent** that has the gymlogic Connector enabled, not a regular chat |
| Agent doesn't call tools | Make sure the Connector toggle is on in the Agent config. Try an explicit prompt like "Use gymlogic to show my last 5 workouts" |
