# Browser

Automate websites that have no API. A browser step drives a local Chrome with natural-language instructions, extracts structured data into step outputs, checks page state, and can pause for a person, for example to enter a one-time code, then continue in the same browser.

Browser steps are powered by the [Stagehand](https://github.com/browserbase/stagehand) Go SDK. Every model request goes through Dagu's own [LLM providers](/step-types/llm/providers), so the step uses the same `llm` configuration as `chat.completion`, and API keys never enter the browser.

## Requirements

- Google Chrome or Chromium installed on the host that runs the step. Dagu uses `browser.executable`, then `CHROME_PATH`, then a standard install location. The Dagu container image does not include a browser.
- A model configured with a DAG-level `llm` block or `with.llm`. Use a model that follows tool-call schemas reliably.

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
secrets:
  - name: VENDOR_USER
    provider: env
    key: VENDOR_USER
  - name: VENDOR_PASSWORD
    provider: env
    key: VENDOR_PASSWORD

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
          when: {selector: "form#login"}
        - expect: {text: Invoices}
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
| `expect` | [Condition](#conditions) | Fail the step unless the condition holds. |
| `wait` | `{selector}` or `{duration}` | Wait until a CSS selector is visible, or pause, such as `2s`. |
| `screenshot` | Name | Save a PNG of the page as a run artifact. |
| `ask` | `{prompt, as, timeout}` | Wait for a person's answer. See [Human Input](#human-input). |

Any operation can also set:

| Field | Description |
|-------|-------------|
| `when` | A [condition](#conditions) checked once before the operation. The operation is skipped unless it holds. |
| `timeout` | Maximum time for the operation, such as `30s`. Defaults to `2m`. |

`with.url` is opened before the first operation.

## Conditions

`expect` and `when` take either kind of condition:

| Form | Example | Checked by |
|------|---------|------------|
| Statement | `expect: The cart shows two items` | The model. Results can vary between runs. |
| `text` | `expect: {text: Order confirmed}` | The page's visible text contains it. |
| `selector` | `when: {selector: "#cookie-banner"}` | A CSS selector matches a visible element. |
| `url` | `expect: {url: /billing}` | The current URL contains it. |

Fixed checks (`text`, `selector`, `url`) make no model call and give the same answer on every run, so prefer them for monitoring. A fixed `expect` is retried until the operation timeout, because the page may still be updating.

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

A list of models under `model` is tried in order for each request. Every request asks the model for a tool call whose parameters are the expected JSON. A provider or model without tool calling works only if it replies with plain JSON text, so choose a model that follows tool-call schemas reliably. Small local models often pick the wrong element.

## Secrets and Variables

Declare secrets under `secrets:`, put them in `with.variables`, and reference them as `%name%` in `act` instructions. The browser types the value; the model sees only the name.

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

- Do not write `${PORTAL_PASSWORD}` inside an instruction. The step fails before starting a browser when a model-bound text contains the value of a declared secret of four or more characters. Values that only come from `env:` are not treated as secrets.
- A `%name%` must be a `with.variables` key or the `as` of an earlier `ask`; anything else fails validation.
- Declared secrets and `ask` answers of four or more characters are masked in text sent to the model, in the step log, and in the timeline. Plain variables are not masked.

## Outputs

The top-level properties each `extract` schema lists become step outputs, readable as `${steps.<id>.outputs.<name>}` and checked when the DAG loads. Fields a schema does not list are dropped. Two extracts in one step cannot list the same property.

When the step succeeds with outputs, stdout is one JSON object of them, so `output:` also works. Operation progress is written to the step's stderr log:

```text
[start] goto "https://portal.vendor.com/billing" (completed, 0 tokens, 800ms)
[1/4] act "Sign in with %user% and %password%" → fill xpath=/html[1]/body[1]/form[1]/input[1] %user%; … (cache-hit, 0 tokens, 400ms)
[3/4] extract "The most recent invoice" → {"invoice_number":"INV-8812","total":412.5} (completed, 1204 tokens, 2.1s)
[4/4] download "invoice-8812.pdf" → browser/invoice/downloads/invoice-8812.pdf (completed, 0 tokens, 0s)
```

## Screenshots and Downloads

Browser steps store files as [run artifacts](/writing-workflows/artifacts) under `browser/<step id>/`. A DAG with a browser step enables artifact storage automatically. These files are not masked and can show signed-in pages with personal data; use `screenshots: never` or `artifacts.enabled: false` to keep them out of run history.

| `browser.screenshots` | Automatic screenshots |
|-----------------------|-----------------------|
| `on_failure` (default) | When the step fails. |
| `final` | When the step fails, and at the end of a successful step. |
| `each` | After every operation, plus the `final` ones. |
| `never` | None. `screenshot` operations still save. |

Files the page downloads are saved under `browser/<step id>/downloads/` with the name the site suggests. After each operation the step waits for running downloads, up to that operation's timeout, and before it ends it waits a few seconds for a late download to begin. A canceled download, or one that does not finish in time, fails the step. Downloaded files appear in the timeline.

With `artifacts.enabled: false`, no screenshots are saved, a `screenshot` operation fails, and the browser refuses downloads.

## Replay Cache

A successful `act` records the actions it performed. The next run of the same step on the same host replays them without asking the model when the operation's position, its instruction, and the page URL (without query or fragment) match. When a replay fails because the page changed, the step asks the model again, records the new actions, and marks the operation `healed` in the log.

- The cache covers `act` only. `extract` and statement conditions call the model on every run. With fixed conditions, a rerun calls the model only for `extract`.
- A replay clicks the recorded element location. After a layout change it can hit a different element without failing, so follow important acts with an `expect`, preferably a fixed one.
- Disable the cache with `with.cache: false`, or for one operation with `act: {instruction: ..., cache: false}`.

## Profiles

`browser.profile` keeps cookies and storage across runs, so a site stays signed in:

```yaml
with:
  browser:
    profile: vendor
  do:
    - act: Sign in with %user% and %password%
      when: {selector: "form#login"}
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
    when: {text: Verification code}
  - act: Type %otp% into the code field and submit
    when: {text: Verification code}
```

The step enters **Waiting** with the question in the step's **Agent** tab. The browser stays open. Answering resumes the step in the same browser at the next operation, with the answer available as `%otp%`. If an act needs an answer whose `ask` was skipped, the step fails instead of typing `%otp%`. Rejecting the question fails the step. The browser stays open for `timeout` (default `1h`); after that, the answer fails the step and **Start clean session** runs the step again from the beginning.

Answers are stored in the run's history, like other human input. Use `ask` for short-lived codes, not long-term secrets.

`ask` is not supported on Windows, where the browser cannot outlive the step process; such a step fails at the start.

## Safety

- Page content is untrusted and is sent to the model. A hostile page, or content other users posted on an allowed site, can try to steer an `act`, for example into typing `%password%` into the wrong field. Use variables only on pages you trust, keep instructions specific, and follow sensitive acts with an `expect`.
- `browser.allowed_domains` limits every request the page makes, including scripts, images, and API calls, so list the hosts a site loads resources from. `example.com` matches only that host; `*.example.com` matches its subdomains but not `example.com`.
- Dagu rejects a `goto` or `url` outside the list, and after every operation fails the step if a redirect or a click left the allowed domains.
- The browser runs with the permissions of the Dagu process.

## Distributed Mode

Browser steps run on the worker that picks them up, which needs Chrome. Profiles and the replay cache are stored on that worker, so pin steps that rely on them with `worker_selector`. An answered `ask` resumes on the worker that holds the browser.

## Web UI

The step's **Agent** tab shows each operation with its status, token use, screenshot thumbnails, and downloads, and holds pending questions.

## Browser Options

| Field | Description |
|-------|-------------|
| `browser.headless` | Run without a window. Defaults to `true`. |
| `browser.executable` | Chrome or Chromium binary. |
| `browser.viewport` | `{width, height}` in pixels. |
| `browser.proxy` | Proxy server URL. Authenticated proxies are not supported. |
| `browser.allowed_domains` | Hosts the page may reach. |
| `browser.screenshots` | `on_failure`, `final`, `each`, or `never`. |
| `browser.profile` | Persistent profile name. |

## Not Supported Yet

- Attaching to an already running browser.
- Hosted browsers, CAPTCHA solving, and stealth fingerprints.
- Screenshot-based extraction.
- `ask` on Windows.

## Related

- [LLM Providers](/step-types/llm/providers)
- [Artifacts](/writing-workflows/artifacts)
- [Human Tasks](/writing-workflows/human-tasks)
