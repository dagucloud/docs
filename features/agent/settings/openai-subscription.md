# OpenAI Subscription

Use this provider when you want Dagu's built-in agent to work through a ChatGPT Plus/Pro subscription login instead of an OpenAI API key.

![Screenshot of the OpenAI Codex provider card in agent settings, showing connection status and account ID](/agent-settings-openai-codex.png)

## What Makes It Different

In Dagu:

- **OpenAI** uses an API key
- **OpenAI Codex** uses a browser-based ChatGPT subscription login

For this provider, you do not enter an API key or custom base URL in the model form.

## Where To Set It Up

You can complete this flow from:

- `/agent-settings`
- `/setup`

The connection is scoped to the currently selected node. If you switch to another remote node, that node needs its own connection.

## Web UI Setup

### 1. Open Agent Settings

Go to `/agent-settings` and enable the built-in agent if it is not already enabled.

### 2. Connect The Subscription

In the **OpenAI Codex** card:

1. Click **Connect**
2. Complete the OpenAI login in the browser
3. Paste the returned redirect URL or authorization code back into Dagu
4. Finish the connection

The card shows whether the subscription is connected and whether it needs to be reconnected.

### 3. Add A Model

Create a saved model entry with values such as:

- **Provider**: `OpenAI Codex`
- **Model**: `gpt-5.4` or `gpt-5.4-mini`
- **Name**: any label you want in the UI

### 4. Set The Default

Mark the model as the default if you want the Web UI agent to use it automatically.

## Setup Wizard

The same connection flow is available in `/setup`. Dagu will not let you finish the Codex path until the subscription login is complete.

## Admin API

If you automate setup, these are the main endpoints:

| Action | Endpoint |
|--------|----------|
| Check provider status | `GET /api/v1/settings/agent/auth/providers` |
| Start login | `POST /api/v1/settings/agent/auth/providers/openai-codex/login` |
| Complete login | `POST /api/v1/settings/agent/auth/providers/openai-codex/login/complete` |
| Disconnect | `DELETE /api/v1/settings/agent/auth/providers/openai-codex/login` |
| Create model entry | `POST /api/v1/settings/agent/models` |
| Set default model | `PUT /api/v1/settings/agent/default-model` |

These endpoints require an authenticated admin user.

## When To Reconnect

Reconnect the provider when:

- the UI shows the login as expired
- the account changed
- you want a different node to use its own subscription login

Disconnecting the subscription does not delete the saved model entry. It only removes the login used by that provider.

## Related Pages

- [Models & Providers](/features/agent/settings/models)
- [AI Agent](/features/agent/)
