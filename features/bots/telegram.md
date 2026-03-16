# Telegram Bot

A Telegram bot that maps each Telegram chat to a Dagu AI agent session. Messages sent in Telegram are forwarded to the agent, and agent responses are sent back to Telegram. When a DAG run completes, the bot can also send AI-generated notifications.

## Creating a Telegram Bot

Before configuring Dagu, you need to create a bot on Telegram and get its token.

1. Open Telegram and search for `@BotFather`, or go to [https://t.me/BotFather](https://t.me/BotFather).
2. Send `/newbot`.
3. BotFather will ask for a **display name** (e.g., `My Dagu Bot`). Send it.
4. BotFather will ask for a **username**. This must end in `bot` (e.g., `my_dagu_bot`). Send it.
5. BotFather replies with a message containing your bot token. It looks like this:

   ```
   Done! Congratulations on your new bot. You will find it at t.me/my_dagu_bot.
   You can now add a description, about section and profile picture for your bot, see /help for a list of commands.

   Use this token to access the HTTP API:
   123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```

6. Copy the token (`123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` in this example). This is the value for `telegram.token` in Dagu config or the `DAGU_TELEGRAM_TOKEN` environment variable.
7. Open a chat with your new bot in Telegram (search for `@my_dagu_bot`) and send any message. This is needed so the bot has a chat to respond to, and so you can retrieve your chat ID (see [Finding your chat ID](#finding-your-chat-id) below).

## Running

There are two ways to run the Telegram bot:

### Standalone

```bash
dagu telegram --dags=/path/to/dags
```

This starts the bot as its own process. It creates its own agent API instance internally.

### As part of `start-all`

```bash
dagu start-all
```

When `telegram.token` is configured, `start-all` automatically launches the Telegram bot alongside the server, scheduler, and coordinator. In this mode, the bot shares the server's agent API instance.

## Configuration

The bot requires a token and at least one allowed chat ID. Set these in the Dagu config file (`~/.config/dagu/config.yaml` or the path set by `DAGU_HOME`):

```yaml
telegram:
  token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
  allowed_chat_ids:
    - 123456789
    - 987654321
  safe_mode: true
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | string | (required) | Bot token from Telegram's [@BotFather](https://t.me/BotFather) |
| `allowed_chat_ids` | []int64 | (required) | Telegram chat IDs authorized to use the bot. Messages from other chats are rejected. |
| `safe_mode` | bool | `true` | Passed to the agent's `ChatRequest.SafeMode` field |

The token can also be set via environment variable:

```bash
export DAGU_TELEGRAM_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
```

The environment variable takes precedence over the config file value. `allowed_chat_ids` and `safe_mode` can only be set in the config file.

### Finding your chat ID

Send a message to your bot, then call the Telegram API to see the `chat.id`:

```bash
curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" | jq '.result[0].message.chat.id'
```

## Telegram Commands

| Command | Behavior |
|---------|----------|
| `/start` | Prints a welcome message listing available commands |
| `/new` | Resets the chat state and clears the current agent session |
| `/cancel` | Cancels the currently active agent session |

Any non-command text message is forwarded to the agent. If no session exists, one is created. If a session already exists, the message is sent to it.

## Agent Prompts

When the agent asks the user a question (a `UserPrompt`), the bot renders it in Telegram:

- If the prompt has predefined options, they appear as **inline keyboard buttons**. Tapping a button submits that option.
- If the prompt allows free text (`AllowFreeText: true`), the user can also reply with a regular text message.
- If the prompt includes a `Command` field, it is shown in the message as `` `command text` ``.

Only prompts that are currently pending in the session are shown. Prompts that were already answered are not re-displayed.

## Session Rotation

The bot tracks token usage across all messages in a session. When total tokens exceed 50% of the assumed context limit (200,000 tokens), the bot automatically:

1. Collects the last 3 user/assistant exchanges from the old session (each truncated to 200/300 characters respectively)
2. Resets the chat state
3. Creates a new session with the summary prepended to the user's message
4. Sends a notice: `(Session context limit reached — continuing with recent context carried forward)`

## DAG Run Notifications

When a `DAGRunStore` is available (it is in both `start-all` and standalone `telegram` modes), the bot starts a **DAG run monitor** that polls for completed runs and sends notifications.

### Monitored statuses

Notifications are sent for these DAG run statuses:

- `succeeded`
- `failed`
- `aborted`
- `partially_succeeded`
- `rejected`
- `waiting` (for human approval requests)

### How notifications work

1. The monitor polls every **10 seconds** for runs with the above statuses from the last hour.
2. On startup, it seeds its "seen" set with all completed runs from the last 24 hours to avoid notifying about old runs.
3. For each new completion, it creates a **dedicated agent session** per allowed chat, sends a structured prompt with the run details (DAG name, status, error, start/finish times, step results), and waits for the agent to generate a notification message (up to **10 minutes**).
4. The notification session is **adopted** as the chat's active session, so the user can send follow-up messages like "show me the logs" or "retry it".
5. Seen entries are evicted after **2 hours**.

### Fallback

If the agent API is unavailable or times out, the bot sends a plain text fallback:

```
<emoji> DAG '<name>' <status>
Error: <error message if any>
```

Where the emoji is: `✅` succeeded/partial, `❌` failed/rejected, `⚠️` aborted, `⏳` waiting.

## Polling Behavior

The bot subscribes to agent session updates by polling `GetSessionDetail`. Polling starts at **1 second** intervals. When there are no new messages and the agent is not working, the interval doubles up to **5 seconds**. When new messages arrive, it resets to 1 second. Polling stops when the agent is not working and no new messages have appeared for 3+ consecutive polls.
