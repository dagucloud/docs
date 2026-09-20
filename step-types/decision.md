# Decision

Ask a model typed questions about some material and get structured answers back. Use `action: decision.evaluate` to classify, score, or judge yes/no questions in one call, then route execution on the answer without parsing free text.

## Basic Usage

```yaml
secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

steps:
  - id: classify
    action: decision.evaluate
    with:
      provider: openrouter
      model: typesafe/jev-1.13
      state: I was charged twice for the same order.
      questions:
        department:
          type: choice
          instructions: Which department should handle this request?
          criteria:
            billing: Charges, refunds, and invoices
            other: Anything else

  - id: announce
    action: log.write
    with:
      message: "Routing to ${classify.output.answers.department.choice}"
    depends: classify
```

All questions share one request. The response is captured automatically, so a later step reads an answer with no `output` mapping.

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | `openrouter` or `typesafe`. |
| `model` | string | Yes | Model identifier, passed to the endpoint unchanged. |
| `state` | string, object, or array | Yes | The material the questions are asked about. |
| `questions` | object | Yes | Map of question ID to question. At least one. |
| `base_url` | string | No | Overrides the API root, including its version prefix. |
| `api_key_name` | string | No | Names the environment variable holding the key. |

Connection settings belong to the step. The DAG-level `llm` block is not used, and there is no streaming, model fallback, chat history, or tool calling.

Question IDs correlate answers, so pick names you want to read back in a reference. Runtime references resolve in `provider`, `model`, `base_url`, and in the string leaves of `state`, `instructions`, and `criteria`; object and array structure is preserved.

### Question Types

Each question takes a `type`, an `instructions` value carrying its meaning, and type-specific `criteria`.

```yaml
steps:
  - id: triage
    action: decision.evaluate
    with:
      provider: openrouter
      model: typesafe/jev-1.13
      state: The checkout page returns a 500 after the payment step.
      questions:
        department:
          type: choice
          instructions: Which department should handle this?
          criteria:
            billing: Charges and refunds
            engineering: Bugs and outages

        urgency:
          type: score
          instructions: How urgent is this?
          criteria: [Routine, Soon, Immediate]

        refund:
          type: noul
          instructions: Is the customer asking for a refund?
          criteria:
            "true": A refund is requested
            "false": No refund is requested
```

| Type | `criteria` | Answer |
|------|------------|--------|
| `choice` | 2 to 255 named options, each a description or null | The selected option name |
| `score` | 2 to 10 descriptions, ordered from level zero upward | A number within the scale |
| `noul` | Optional object with `"true"` and `"false"` descriptions | A probability, not a boolean |

A `noul` question is a yes/no question answered as a probability rather than a boolean, so `0.95` means the answer is very likely yes. Its `criteria` keys are the literal strings `true` and `false`, and YAML parses those unquoted as booleans, so they must be quoted.

## Answers

Every answer carries its `type`. Beyond that:

| Type | Fields |
|------|--------|
| `choice` | `choice`, `probabilities` for every option, `confidence` |
| `score` | `score`, `legend` for every level, `probabilities`, `confidence` |
| `noul` | `noul` |

Probabilities and confidence are numbers between zero and one. A low-confidence answer is a successful result, not an execution error, so decide for yourself what confidence is good enough. See [Acting on Confidence](#acting-on-confidence).

## Using the Answer

The whole response is captured, so a dependent step reads any field by path:

```yaml
steps:
  - id: classify
    action: decision.evaluate
    with:
      provider: openrouter
      model: typesafe/jev-1.13
      state: I was charged twice.
      questions:
        department:
          type: choice
          instructions: Which department should handle this?
          criteria:
            billing: Charges and refunds
            other: Anything else

  - id: report
    action: log.write
    with:
      message: "${classify.output.answers.department.choice} at ${classify.output.answers.department.confidence}"
    depends: classify
```

`answers`, `model`, and `usage` are also published as named outputs, readable as `${steps.classify.outputs.answers}` and the equivalent top-level forms. Those strict references read a top-level name only, so use the `${classify.output....}` path form to reach a field inside an answer.

Setting `output`, `output_schema`, or `stdout.outputs` yourself replaces the automatic capture with ordinary capture semantics. The raw response is bounded by `max_output_size`, 1 MiB by default, and an oversized response fails the step without publishing output.

## Routing on a Decision

Pair the action with [Router](/step-types/router) to send execution down one branch per answer. Router steps require `type: graph`.

```yaml
type: graph
steps:
  - id: classify
    action: decision.evaluate
    with:
      provider: openrouter
      model: typesafe/jev-1.13
      state: The checkout page returns a 500 after the payment step.
      questions:
        department:
          type: choice
          instructions: Which department should handle this?
          criteria:
            billing: Charges and refunds
            engineering: Bugs and outages

  - id: route
    action: router.route
    with:
      value: ${classify.output.answers.department.choice}
      routes:
        billing: [handle_billing]
        engineering: [handle_engineering]
    depends: classify

  - id: handle_billing
    run: echo "Billing queue"

  - id: handle_engineering
    run: echo "Engineering queue"
```

Because `criteria` constrains the model to named options, the route keys and the option names are the same list. Rename an option and the matching route has to change with it, or nothing runs: a router with no matching route is not an error.

## Acting on Confidence

Answers carry numbers, so gate automation with a [numeric comparison](/writing-workflows/control-flow#numeric-comparison). Handle the confident cases automatically and leave the rest to a person:

```yaml
type: graph
steps:
  - id: classify
    action: decision.evaluate
    with:
      provider: openrouter
      model: typesafe/jev-1.13
      state: Please refund my duplicate charge.
      questions:
        refund:
          type: noul
          instructions: Is the customer asking for a refund?

  - id: triage
    action: router.route
    with:
      value: ${classify.output.answers.refund.noul}
      routes:
        "num:>=0.9": [auto_approve]
        "num:<=0.1": [auto_reject]
    depends: classify

  - id: auto_approve
    run: echo "Refund approved"

  - id: auto_reject
    run: echo "Not a refund request"

  - id: human_review
    preconditions:
      - condition: ${classify.output.answers.refund.noul}
        expected: "num:<0.9"
      - condition: ${classify.output.answers.refund.noul}
        expected: "num:>0.1"
    run: echo "Needs a human"
    depends: classify
```

A route carries one pattern, so the middle band has no route of its own. The step covering it states both bounds as preconditions, which are combined with AND.

Three things to keep in mind:

- The answer goes on the `condition` side. A threshold has to be a literal or one whole variable such as `${params.threshold}`, so a nested answer path cannot be used as a threshold.
- A gating step needs `depends` on the decision step. Without it the reference stays literal text, and a numeric comparison against text fails the step rather than skipping it.
- A `noul` answer is a probability, so compare it with `num:>=0.5` rather than matching `true`. Referencing a whole object such as `probabilities` yields JSON, which is not a number either.

::: warning A numeric route fails the run on a non-numeric value
This is the same rule as any numeric route. If the value is not a number, the router step fails and no target runs, including a `re:.*` catch-all. See [Numeric Routes](/step-types/router#numeric-routes).
:::

## Providers

| Provider | Default base URL | Request path | Default API key variable |
|----------|------------------|--------------|--------------------------|
| `openrouter` | `https://openrouter.ai/api/alpha` | `/decisions` | `OPENROUTER_API_KEY` |
| `typesafe` | `https://api.typesafe.ai/v1` | `/systemone` | `TYPESAFE_API_KEY` |

These are the decision endpoints and are separate from the providers available to [`chat.completion`](/step-types/llm/).

`api_key_name` names another environment variable rather than carrying the key itself. The key is resolved from the workflow environment, including declared secrets, and an absent or empty key fails before any request is sent. Exporting the variable in your shell is not enough on its own; see [Making the key reachable](/step-types/llm/providers#making-the-key-reachable).

`base_url` overrides the API root including its version prefix. A trailing slash is accepted, query and fragment delimiters are rejected, and the URL must use HTTPS except for localhost and loopback addresses.

## Errors

Missing required fields, an unsupported provider or question type, invalid criteria, and invalid literal URLs are rejected when the DAG is built. Values containing runtime references are checked after they resolve.

At run time the step fails on an invalid JSON response, missing or mismatched answers, invalid answer fields, exhausted HTTP retries, cancellation, and timeout. Validation errors never include the response content. Without a step `timeout_sec` the request has no deadline of its own, so set one for a bounded run.

## Related

- [Router](/step-types/router)
- [Numeric Comparison](/writing-workflows/control-flow#numeric-comparison)
- [LLM Steps](/step-types/llm/)
- [Outputs](/writing-workflows/outputs)
