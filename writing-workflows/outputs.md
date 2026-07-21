# Outputs

Use step outputs when one step needs to pass a validated value to a later step.

The current validated reference form is:

```text
${steps.<step_id>.outputs.<output_name>}
```

For command steps, the producer must have an `id`, declare each output name in `outputs`, and write the value to `DAGU_OUTPUT_FILE`. Built-in actions can provide their own output contract. For example, a [human task](/writing-workflows/human-tasks) derives outputs from its form properties and publishes the validated operator input without an authored `outputs` field or `DAGU_OUTPUT_FILE`.

## Basic Example

```yaml
steps:
  - id: get_version
    run: |
      printf 'version=%s\n' "$(cat VERSION)" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version

  - id: build_image
    depends: get_version
    run: docker build -t "myapp:${steps.get_version.outputs.version}" .
```

This is more explicit than a bare `${VERSION}` reference:

- `get_version` declares that it publishes `version`
- `build_image` declares the dependency that makes the output available
- Dagu can report a passive notice if the step id, output name, or dependency is wrong

Human-task outputs use the same `${steps.<step_id>.outputs.<output_name>}` reference and dependency rules. See [Human Tasks](/writing-workflows/human-tasks#generated-step-outputs) for the generated-output behavior.

## Output File Format

For each step attempt, Dagu creates an output file and exposes its path as `DAGU_OUTPUT_FILE`.

Write single-line values as `name=value`:

```yaml
steps:
  - id: inspect_build
    run: |
      printf 'version=v1.2.3\n' >> "$DAGU_OUTPUT_FILE"
      printf 'artifact_url=https://example.test/app.tgz\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version
      - name: artifact_url
```

Write multi-line values with a delimiter:

```yaml
steps:
  - id: summarize
    run: |
      {
        printf 'report<<REPORT\n'
        ./generate-report --format markdown
        printf '\nREPORT\n'
      } >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: report
```

Rules:

- Every declared output must be written exactly once.
- Written output names must be declared.
- Duplicate output names fail the step attempt.
- Failed, aborted, timed-out, skipped, and not-yet-completed steps publish no outputs.

## JSON Outputs

Declare `type: json` when the output value must be valid JSON.

```yaml
steps:
  - id: inspect
    run: |
      cat >> "$DAGU_OUTPUT_FILE" <<'EOF'
      metadata<<JSON
      {"image":"api","tag":"v1.2.3"}
      JSON
      EOF
    outputs:
      - name: metadata
        type: json

  - id: print_metadata
    depends: inspect
    env:
      - METADATA: ${steps.inspect.outputs.metadata}
    run: printf '%s\n' "$METADATA"
```

Step output references read top-level declared output names. Nested output paths such as `${steps.inspect.outputs.metadata.tag}` are not part of the strict reference syntax.

## Dependency Requirement

Step output references do not create dependencies. The consuming step must depend directly or transitively on the producing step.

```yaml
steps:
  - id: build
    run: |
      printf 'image=registry.example.com/app:v1.2.3\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: image

  - id: deploy
    depends: build
    run: ./deploy.sh "${steps.build.outputs.image}"
```

If `deploy` omits `depends: build`, Dagu preserves `${steps.build.outputs.image}` and inspection surfaces can report a `missing_dependency` notice.

## Output Names

Output names must match:

```text
^[A-Za-z][A-Za-z0-9_]*$
```

Use names such as `version`, `image_tag`, `artifact_url`, or `record_count`.

## Large Results

Do not use step outputs for large reports, logs, media files, or full datasets. Write those to an artifact instead and publish only the small path or summary that later steps need.

```yaml
artifacts:
  enabled: true

steps:
  - id: report
    run: ./generate-report --format markdown
    stdout:
      artifact: reports/report.md
```

See [Artifacts](/writing-workflows/artifacts) for run artifact storage.
