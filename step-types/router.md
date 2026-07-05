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
- Every matching route runs, not just the first match.
- Use `re:.*` as a default route.

## Route Dependencies

Router target steps implicitly depend on the router step. You normally do not need to repeat `depends: router`.

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
- [YAML Specification](/writing-workflows/yaml-specification)
