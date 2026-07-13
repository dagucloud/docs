# Outputs & Routing

Capture completion responses for later steps, preserve large responses as artifacts, and route execution based on a model decision.

The final response is written to stdout. A consuming step must depend directly or transitively on the completion step.

## Flat Output Variable

Use string-form `output` for a small response:

```yaml
steps:
  - id: classify
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      prompt: |
        Reply with exactly one word: bug, feature, or question.
    output: REQUEST_TYPE

  - id: save_classification
    depends: [classify]
    action: file.write
    with:
      path: ${context.paths.artifacts_dir}/classification.txt
      content: ${REQUEST_TYPE}
```

String-form `output: REQUEST_TYPE` captures trimmed stdout in the flat `${REQUEST_TYPE}` variable.

## Route Subsequent Steps

Use `router.route` for switch-style branching based on a completion. Router actions are available in graph workflows, and route values use exact, case-sensitive matching unless a `re:` pattern is specified.

```yaml
type: graph

steps:
  - id: classify_request
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      temperature: 0
      max_tokens: 10
      stream: false
      prompt: |
        Classify the request as exactly one of these lowercase labels:
        bug, feature, question, other

        Reply with the label only.

        Request: The checkout page times out after payment.
    output: REQUEST_TYPE

  - id: route_request
    depends: [classify_request]
    action: router.route
    with:
      value: ${REQUEST_TYPE}
      routes:
        bug: [handle_bug]
        feature: [handle_feature]
        question: [handle_question]
        other: [manual_triage]

  - id: handle_bug
    action: file.write
    with:
      path: ${context.paths.artifacts_dir}/bug.txt
      content: Send the request to the bug workflow.

  - id: handle_feature
    action: file.write
    with:
      path: ${context.paths.artifacts_dir}/feature.txt
      content: Send the request to product review.

  - id: handle_question
    action: file.write
    with:
      path: ${context.paths.artifacts_dir}/question.txt
      content: Send the request to support.

  - id: manual_triage
    action: file.write
    with:
      path: ${context.paths.artifacts_dir}/manual-triage.txt
      content: Queue the request for manual triage.
```

The router must depend on `classify_request` so `${REQUEST_TYPE}` is available. Router targets implicitly depend on `route_request`, so the handler steps do not need their own `depends` fields. Only the target for the matching label runs.

Constrain the model to known labels and keep an explicit `other` label. If the response does not match any route, no handler runs. A `re:.*` route is not an exclusive default: router actions run every matching route, so it would also run alongside an exact match.

See [Router](/step-types/router) for regex routes, multiple targets, and routing constraints.

## Step-Scoped Output

Use object-form `output` when the response should be namespaced to the producing step:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      prompt: |
        Summarize the incident report.
    output:
      response:
        from: stdout

  - id: save_summary
    depends: [summarize]
    action: file.write
    with:
      path: ${context.paths.artifacts_dir}/summary.md
      content: ${summarize.output.response}
```

Object-form outputs are read through `${<step_id>.output.<field>}`. They avoid collisions when several completion steps publish similarly named values.

## Large Responses

Write a large response directly to a run artifact instead of loading it into a variable:

```yaml
steps:
  - id: write_report
    action: chat.completion
    with:
      provider: anthropic
      model: claude-sonnet-4-6
      prompt: |
        Write a detailed incident report.
    stdout:
      artifact: reports/incident.md
```

Later steps can use the file path `${context.paths.artifacts_dir}/reports/incident.md` after depending on `write_report`.

## Sessions

The completed session is saved with the DAG run, including the provider, model, and token usage reported for assistant messages. A chat action also inherits session history from the steps in its `depends` list, which enables multi-step conversations.

```yaml
steps:
  - id: first_question
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      system: |
        Answer as a math tutor.
      prompt: What is 2+2?

  - id: followup
    depends: [first_question]
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      prompt: Now multiply that result by 3.
```

Session inheritance follows these rules:

- History is transitive because every chat step saves its inherited messages, its own messages, and the response.
- Histories from multiple dependencies are merged in the order listed in `depends`.
- Only the first system message is kept when inherited histories contain several system messages.
- Retries continue with the session already attached to the DAG run.

When approval push-back re-executes a chat step, Dagu restores the previous conversation and appends the reviewer feedback as the next user message. The workflow does not need to add `${FEEDBACK}` to its messages. See [Approval push-back](/writing-workflows/approval#push-back-environment) for the feedback environment values.

## Related

- [LLM Completion](/step-types/llm/) for basic usage and configuration
- [Router](/step-types/router) for complete routing behavior
- [Outputs](/writing-workflows/outputs) and [Artifacts](/writing-workflows/artifacts) for general data-flow behavior
