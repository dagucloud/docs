# Workflow Operator on LINE

Workflow Operator on LINE connects LINE one-on-one chats, groups, and rooms to the built-in Dagu agent through the LINE Messaging API webhook. Each allowed source keeps its own running context, so follow-up questions and DAG-run notifications stay in the same LINE conversation.

## Prerequisites

Before setting up Workflow Operator on LINE, configure Steward in the Web UI. Go to **Steward Settings** (`/agent-settings`) and set up the model, tool policy, and other defaults first. The LINE bot forwards messages to the built-in steward, so it must be configured before LINE can use it.

You also need a public HTTPS URL for the Dagu server. LINE requires the webhook URL to use HTTPS with a certificate trusted by common browsers.

::: warning Deployment requirement
LINE delivers user messages by sending webhook requests to Dagu. For self-hosted Dagu, the LINE webhook endpoint must be reachable from the public internet over HTTPS, either by exposing the Dagu server through a reverse proxy or by using a tunnel such as Tailscale Funnel, Cloudflare Tunnel, or ngrok.

If you do not want to operate the public endpoint yourself, use a managed instance instead. Dagu Cloud runs a full managed Dagu server with a public HTTPS endpoint, while private workers can still run workflows inside your own infrastructure when needed. See the [Dagu pricing page](https://dagu.sh/pricing) for the current managed-instance options.
:::

## Creating a LINE Bot

Before configuring Dagu, create a LINE Messaging API channel for the bot.

1. Open the [LINE Developers Console](https://developers.line.biz/console/).
2. Create or select a provider.
3. Create a **Messaging API** channel for the bot.
4. In the channel's **Messaging API** tab, issue a channel access token. This is the value for `bots.line.channel_access_token`.
5. In the channel's **Basic settings** tab, copy the channel secret. This is the value for `bots.line.channel_secret`.
6. In the **Messaging API** tab, set the webhook URL to your Dagu server:

   ```
   https://<your-dagu-host>/api/v1/bots/line/webhook
   ```

   If Dagu is served under a base path, include it before `/api/v1`.

7. Click **Verify**. LINE sends a webhook with an empty `events` array; Dagu returns HTTP 200 when the signature is valid.
8. Enable **Use webhook**.
9. Add the LINE Official Account as a friend, or invite it to the group or room where you want to use it.

LINE's own greeting and auto-response messages can make it hard to tell whether a reply came from Dagu or from LINE Official Account Manager. For first-time setup, turn those off in LINE Official Account Manager.

## Finding Source IDs

Dagu authorizes LINE conversations with `allowed_source_ids`. These are LINE user IDs, group IDs, or room IDs from webhook event sources.

To find a source ID, temporarily start Dagu with the LINE bot configured but without the desired source in `allowed_source_ids`, then send a message from that LINE chat. Dagu logs the rejected source ID and source type. Add that ID to `allowed_source_ids` and restart.

## Running

The LINE connector for Workflow Operator starts automatically when `bots.provider` is set to `line` and you run either:

```bash
dagu server
```

or

```bash
dagu start-all
```

In both modes, the connector shares the server's agent API instance and registers the LINE webhook route on the same HTTP server.

## Configuration

Set `provider: line` under `bots` and configure the LINE-specific fields. Only one connector can be active at a time.

```yaml
bots:
  provider: line
  safe_mode: true
  line:
    channel_access_token: "your-line-channel-access-token"
    channel_secret: "your-line-channel-secret"
    allowed_source_ids:
      - "U1234567890abcdef"
      - "C1234567890abcdef"
    respond_to_all: true
```

### `bots` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `""` (disabled) | Which connector to run. Set to `"line"` for LINE. If empty, no bot starts. |
| `safe_mode` | bool | `true` | Passed to the agent's `ChatRequest.SafeMode` field. Applies to all bot connectors. |

### `bots.line` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `channel_access_token` | string | (required) | LINE Messaging API channel access token. |
| `channel_secret` | string | (required) | LINE Messaging API channel secret used to verify `x-line-signature`. |
| `allowed_source_ids` | []string | (required) | LINE user, group, or room IDs authorized to use the bot. Messages from other sources are rejected. |
| `respond_to_all` | bool | `true` | When `true`, the bot responds to every message in allowed groups and rooms. When `false`, group and room messages must mention the bot. One-on-one chats always respond. |

### Environment variables

| Variable | Config equivalent |
|----------|-------------------|
| `DAGU_BOTS_PROVIDER` | `bots.provider` |
| `DAGU_BOTS_SAFE_MODE` | `bots.safe_mode` |
| `DAGU_BOTS_LINE_CHANNEL_ACCESS_TOKEN` | `bots.line.channel_access_token` |
| `DAGU_BOTS_LINE_CHANNEL_SECRET` | `bots.line.channel_secret` |
| `DAGU_BOTS_LINE_ALLOWED_SOURCE_IDS` | `bots.line.allowed_source_ids` |
| `DAGU_BOTS_LINE_RESPOND_TO_ALL` | `bots.line.respond_to_all` |

For `allowed_source_ids`, use a comma-separated string:

```bash
export DAGU_BOTS_LINE_ALLOWED_SOURCE_IDS=U1234567890abcdef,C1234567890abcdef
```

## Event Handling

LINE sends webhook events to Dagu. Dagu verifies the `x-line-signature` header with HMAC-SHA256 before processing the body.

### Messages

- **One-on-one chats**: handled when the user ID is listed in `allowed_source_ids`.
- **Groups and rooms**: handled when the group ID or room ID is listed in `allowed_source_ids`.
- With `respond_to_all: false`, group and room messages are handled only when the message mentions the bot or when the chat is answering a pending prompt.

Only text messages are forwarded to the agent. Other LINE message types are ignored.

### Text Commands

Type these as plain messages:

| Text | Behavior |
|------|----------|
| `new` or `/new` | Starts a fresh conversation in the current LINE source |
| `cancel` or `/cancel` | Cancels the currently active agent session |
| `start` or `/start` | Prints a short welcome message |

All other text is forwarded to the agent.

## Agent Prompts

When the agent asks the user a question, the LINE bot sends the question as text. If the prompt has options, Dagu lists each option as `<option_id>: <label>`. Reply with the option ID or label to submit that option. If the prompt allows free text, a normal text reply is also accepted.

## DAG Run Notifications

When event tracking is available, the bot can send DAG-run notifications into each allowed LINE source. If event tracking is unavailable, LINE chat still works; only automatic run notifications are skipped.

Notifications follow the same batching model as the other Workflow Operator connectors:

1. Dagu checks for new run events every **10 seconds** and remembers what it has already delivered.
2. On first startup, existing LINE sources only receive future events.
3. For each destination, it batches pending DAG-run notifications. Urgent single-run batches try to generate the message with the agent; all other delivered batches use deterministic formatting.
4. Delivered entries are retained for **2 hours** to suppress duplicate event replays, while failed deliveries remain pending and are retried.

## Message Length

LINE text messages are split at paragraph boundaries when they exceed 5,000 characters, falling back to line boundaries when needed.
