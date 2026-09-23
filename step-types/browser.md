# Browser

Automate websites that have no API. A browser step drives a local Chrome with natural-language instructions, extracts structured data into step outputs, and can pause for a person, for example to enter a one-time code, then continue in the same browser.

Browser steps are powered by the [Stagehand](https://github.com/browserbase/stagehand) Go SDK. Every model request goes through Dagu's own [LLM providers](/step-types/llm/providers), so the step uses the same `llm` configuration as `chat.completion`, and API keys never enter the browser.

## Requirements

- Google Chrome or Chromium installed on the host that runs the step. Dagu uses `browser.executable`, then `CHROME_PATH`, then a standard install location. The Dagu container image does not include a browser.
- A model configured with a DAG-level `llm` block or `with.llm`.

## Quick Start

`browser.extract` opens a page and returns structured data:

```yaml
secrets:
  - name: ANTHROPIC_API_KEY
    provider: env
    key: ANTHROPIC_API_KEY

llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: hn
    action: browser.extract
    with:
      url: https://news.ycombinator.com
      instruction: The top 5 stories with their points
      schema:
        type: object
        properties:
          stories:
            type: array
            items:
              type: object
              properties:
                title: { type: string }
                points: { type: integer }

  - id: report
    depends: hn
    run: echo '${steps.hn.outputs.stories}'
```

`browser.run` runs several operations in one browser session:

```yaml
steps:
  - id: invoice
    action: browser.run
    with:
      url: https://portal.vendor.com/billing
      browser:
        profile: vendor
        allowed_domains: [portal.vendor.com]
      variables:
        user: ${VENDOR_USER}
        password: ${VENDOR_PASSWORD}
      do:
        - act: Sign in with %user% and %password%
          when: A login form is visible
        - expect: The billing page lists at least one invoice
        - extract:
            instruction: The most recent invoice
            schema:
              type: object
              properties:
                invoice_number: { type: string }
                total: { type: number }
        - act: Download the most recent invoice PDF

  - id: book
    depends: invoice
    run: ./book.sh "${steps.invoice.outputs.invoice_number}"
```

## Operations

`with.do` lists operations that run in order. Each item sets exactly one operation:

| Operation | Value | Effect |
|-----------|-------|--------|
| `goto` | URL | Navigate the current tab. |
| `act` | Instruction, or `{instruction, cache}` | Perform an action described in natural language: click, type, select, scroll, press a key. |
| `extract` | `{instruction, schema}` | Extract data from the page. The schema must be a JSON Schema with `type: object`. |
| `expect` | Statement | Fail the step unless the statement about the page is true. The failure shows the model's reason. |
| `wait` | `{selector}` or `{duration}` | Wait until a CSS selector is visible, or pause, such as `2s`. |
| `screenshot` | Name | Save a PNG of the page as a run artifact. |
| `ask` | `{prompt, as, timeout}` | Wait for a person's answer. See [Human Input](#human-input). |

Any operation can also set:

| Field | Description |
|-------|-------------|
| `when` | A statement about the page. The operation is skipped unless it is true. |
| `timeout` | Maximum time for the operation, such as `30s`. Defaults to `2m`. |

`with.url` is opened before the first operation.

## Model

Browser steps use the DAG-level `llm` block. `with.llm` replaces it entirely for one step:

```yaml
steps:
  - id: prices
    action: browser.extract
    with:
      llm:
        provider: openrouter
        model: deepseek/deepseek-v4-flash
      url: https://shop.example.com
      instruction: All product names and prices
      schema:
        type: object
        properties:
          products: { type: array }
```

A list of models under `model` is tried in order for each request. Every provider that works with `chat.completion` works here, including local models. Browser automation needs a model that follows tool-call schemas reliably; small local models often pick the wrong element.

## Secrets and Variables

Put secret values in `with.variables` and reference them as `%name%` in `act` instructions. The browser types the value; the model sees only the name.

```yaml
secrets:
  - name: PORTAL_PASSWORD
    provider: env
    key: PORTAL_PASSWORD

steps:
  - id: login
    action: browser.run
    with:
      url: https://portal.example.com/login
      variables:
        password: ${PORTAL_PASSWORD}
      do:
        - act: Type %password% into the password field and sign in
```

Do not write `${PORTAL_PASSWORD}` inside an instruction. The reference would resolve to the secret, which would be sent to the model, so the step fails before starting a browser. Secret and variable values are also masked in text sent to the model, in the step log, and in the timeline.

## Outputs

The top-level properties each `extract` schema lists become step outputs, readable as `${steps.<id>.outputs.<name>}` and checked when the DAG loads. Fields a schema does not list are dropped. Two extracts in one step cannot list the same property.

When the step succeeds with outputs, stdout is one JSON object of them, so `output:` also works. Operation progress is written to the step's stderr log:

```text
[start] goto "https://portal.vendor.com/billing" (completed, 0 tokens, 800ms)
[1/4] act "Sign in with %user% and %password%" → fill xpath=/html[1]/body[1]/form[1]/input[1] %user%; … (cache-hit, 0 tokens, 400ms)
[3/4] extract "The most recent invoice" → {"invoice_number":"INV-8812","total":412.5} (completed, 1204 tokens, 2.1s)
```

## Screenshots and Downloads

Browser steps store files as [run artifacts](/writing-workflows/artifacts) under `browser/<step id>/`:

| `browser.screenshots` | Automatic screenshots |
|-----------------------|-----------------------|
| `on_failure` (default) | When the step fails, and at the end of a successful step. |
| `each` | After every operation, plus the above. |
| `never` | None. `screenshot` operations still save. |

Files the page downloads are saved under `browser/<step id>/downloads/`.

A DAG with a browser step enables artifact storage automatically. With `artifacts.enabled: false`, no screenshots or downloads are saved and a `screenshot` operation fails.

## Replay Cache

A successful `act` records the actions it performed. The next run of the same step replays them without asking the model when the operation's position, its instruction, and the page URL (without query or fragment) match. Scheduled runs against a stable page therefore spend tokens only on `extract`, `expect`, and `when`.

When a replay fails because the page changed, the step asks the model again, records the new actions, and marks the operation `healed` in the log. Disable the cache with `with.cache: false`, or for one operation with `act: {instruction: ..., cache: false}`.

## Profiles

`browser.profile` keeps cookies and storage across runs, so a site stays signed in:

```yaml
with:
  browser:
    profile: vendor
  do:
    - act: Sign in with %user% and %password%
      when: A login form is visible
```

Profiles are stored on the host that runs the step. Runs that use the same profile run one at a time. A run fails immediately when another run is waiting for input with the same profile open.

## Human Input

`ask` pauses the step until someone answers in the Web UI:

```yaml
do:
  - act: Sign in with %user% and %password%
  - ask:
      prompt: Enter the 6-digit code sent to your phone
      as: otp
      timeout: 15m
    when: The page asks for a verification code
  - act: Type %otp% into the code field and submit
    when: The page asks for a verification code
```

The step enters **Waiting** with the question in the step's **Agent** tab. The browser stays open. Answering resumes the step in the same browser at the next operation, with the answer available as `%otp%`. Rejecting the question fails the step. The browser stays open for `timeout` (default `1h`); after that, the answer fails the step and **Start clean session** runs the step again from the beginning.

Answers are stored in the run's history, like other human input. Use `ask` for short-lived codes, not long-term secrets.

In distributed mode, the answer resumes the step on the worker that holds the browser.

## Safety

- `browser.allowed_domains` limits navigation to the listed domains and their subdomains. Dagu also rejects a `goto` or `url` outside the list before navigating.
- Page content can contain instructions aimed at the model. Limit domains and keep operations specific.
- The browser runs with the permissions of the Dagu process.

## Web UI

The step's **Agent** tab shows each operation with its status, token use, and screenshot thumbnails, and holds pending questions.

## Browser Options

| Field | Description |
|-------|-------------|
| `browser.headless` | Run without a window. Defaults to `true`. |
| `browser.executable` | Chrome or Chromium binary. |
| `browser.viewport` | `{width, height}` in pixels. |
| `browser.proxy` | Proxy server URL. Authenticated proxies are not supported. |
| `browser.allowed_domains` | Domains the browser may navigate to. |
| `browser.screenshots` | `on_failure`, `each`, or `never`. |
| `browser.profile` | Persistent profile name. |

## Not Supported Yet

- Attaching to an already running browser.
- Hosted browsers, CAPTCHA solving, and stealth fingerprints.
- Screenshot-based extraction.

## Related

- [LLM Providers](/step-types/llm/providers)
- [Artifacts](/writing-workflows/artifacts)
- [Human Tasks](/writing-workflows/human-tasks)
