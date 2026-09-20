# Router

Route execution to different steps based on a value. Routers are graph-only control-flow actions, so set the DAG `type` to `graph`.

## Basic Usage

```yaml
env:
  - INPUT: exact_value
steps:
  - id: router
    action: router.route
    with:
      value: ${env.INPUT}
      routes:
        "exact_value": [route_a]
        "other": [route_b]

  - id: route_a
    run: echo "Route A executed"
    output: RESULT_A

  - id: route_b
    run: echo "Route B executed"
    output: RESULT_B
```

When `INPUT=exact_value`, only `route_a` runs. The `route_b` step is skipped.

## Patterns

Routes are matched against `with.value`.

```yaml
env:
  - STATUS: success_code
steps:
  - id: router
    action: router.route
    with:
      value: ${env.STATUS}
      routes:
        "success": [handle_success]
        "re:^success.*": [handle_success_prefix]
        "re:.*_code$": [handle_code]
        "re:.*": [catch_all]

  - id: handle_success
    run: echo "Exact success"

  - id: handle_success_prefix
    run: echo "Success prefix"

  - id: handle_code
    run: echo "Code suffix"

  - id: catch_all
    run: echo "Default route"
```

Rules:

- A plain key is an exact match.
- A key prefixed with `re:` is a Go regular expression.
- A key prefixed with `num:` is a numeric comparison, using `>`, `>=`, `<`, or `<=`.
- Every matching route runs, not just the first match.
- Use `re:.*` as a default route.

## Numeric Routes

A `num:` key compares the value as a number rather than as text. Keep the routes mutually
exclusive and exactly one target runs:

```yaml
type: graph
env:
  - SCORE: "0.95"
steps:
  - id: router
    action: router.route
    with:
      value: ${env.SCORE}
      routes:
        "num:>=0.9": [auto_approve]
        "num:<0.9": [needs_review]

  - id: auto_approve
    run: echo "Approved automatically"

  - id: needs_review
    run: echo "Sent for review"
```

A threshold can be a variable, written as the whole number:
`"num:>=${threshold}"`. See
[Numeric Comparison](/writing-workflows/control-flow#numeric-comparison) for the full
comparison rules, which are shared with preconditions.

::: warning A numeric route fails the run on a non-numeric value
When a workflow declares any `num:` route and the value is not a number, the router step
itself fails and no target runs. That includes a target whose pattern matches the text and
a `re:.*` catch-all, so a catch-all cannot be used as a safety net for non-numeric
input.
:::

Because every matching route runs, a catch-all added beside numeric routes runs as well.
And no single pattern expresses a middle band such as `0.1 < x < 0.9`, since a route
carries one pattern; put those bounds on the target step as two preconditions instead.

## Route Dependencies

Router target steps implicitly depend on the router step, so you do not need to repeat `depends: router`.

```yaml
steps:
  - id: setup
    run: |
      printf 'status=%s\n' "prod" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: status

  - id: route
    action: router.route
    with:
      value: ${steps.setup.outputs.status}
      routes:
        prod: [deploy_prod]
        stg: [deploy_stg]
    depends: setup

  - id: deploy_prod
    run: echo "Deploying production"

  - id: deploy_stg
    run: echo "Deploying staging"
```

## Related

- [Control Flow](/writing-workflows/control-flow)
- [Decision](/step-types/decision)
- [YAML Specification](/writing-workflows/yaml-specification)
