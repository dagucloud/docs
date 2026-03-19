# Parameters

DAG-level `params:` define runtime inputs for a workflow. They can be overridden when the DAG is started from the CLI, API, Web UI, or a sub-DAG step.

By default, parameter defaults are treated as literal values. If you want a parameter to compute its effective default at execution time, use `eval:` on an inline rich definition. `eval` uses the same expression engine as DAG `env:` and supports `$VAR` expansion plus backtick command substitution.

Named parameters are injected into the step execution environment, so shell commands can read them with normal shell syntax such as `${ENVIRONMENT}`.

## Supported Formats

Dagu supports these DAG-level parameter formats:

```yaml
# 1. Positional parameters in a single string
params: first second third

# 2. Named parameters in a single string
params: ENVIRONMENT=dev PORT=8080 DEBUG=false

# 3. Named parameters as an array of strings
params:
  - ENVIRONMENT=dev
  - PORT=8080

# 4. Named parameters as ordered single-key maps
params:
  - ENVIRONMENT: dev
  - PORT: 8080

# 5. Inline rich definitions
params:
  - name: environment
    type: string
    default: staging
    enum: [dev, staging, prod]
    description: Target environment
  - name: batch_size
    type: integer
    default: 25
    minimum: 1
    maximum: 100

# 6. External JSON Schema validation
params:
  schema: ./schemas/params.json
  values:
    environment: staging
    batch_size: 25
```

Legacy map form is still supported:

```yaml
params:
  ENVIRONMENT: dev
  PORT: 8080
```

Prefer the ordered list form for authored DAGs. It preserves declaration order for UI rendering and help output.

## Inline Rich Definitions

Inline rich definitions keep defaults, validation, and UI metadata next to the parameter declaration.

```yaml
params:
  - name: region
    type: string
    default: us-east-1
    enum: [us-east-1, us-west-2, eu-west-1]
    description: AWS region to deploy to
  - name: instance_count
    type: integer
    default: 3
    minimum: 1
    maximum: 100
    description: Number of application instances
  - name: debug
    type: boolean
    default: false
    description: Enable verbose logging
  - name: project_name
    type: string
    min_length: 3
    max_length: 64
    pattern: "^[a-z][a-z0-9-]*$"
    required: true
    description: Lowercase project identifier
```

Rich definitions must use object form with a required `name` field. The older nested-map form such as `- region: { type: string }` is rejected.

Supported fields:

| Field | Type | Description |
|------|------|-------------|
| `eval` | string | Expression evaluated at execution time to compute the effective default |
| `default` | scalar | Literal fallback/default value used when no runtime override is supplied |
| `description` | string | Human-readable help text shown in the UI and API metadata |
| `type` | string | `string`, `integer`, `number`, or `boolean`. Defaults to `string` |
| `required` | boolean | Marks the parameter as required unless a default is present |
| `enum` | list | Allowed values |
| `minimum` / `maximum` | number | Numeric bounds for `integer` and `number` params |
| `min_length` / `max_length` | integer | String length bounds |
| `pattern` | string | Regex for string validation (Go RE2 syntax) |

Notes:

- `eval` is supported only on inline rich definitions (`- name: ...`), not on legacy string/map param forms or external-schema-backed `params.schema`.
- DAG YAML uses `snake_case` field names such as `min_length` and `max_length`.
- The API exposes derived metadata as `paramDefs` in `camelCase`.
- Type information is used for validation and UI rendering. Shell-visible runtime values remain strings.

## Runtime Validation and Coercion

All external inputs arrive as strings. When a parameter has an inline type, Dagu coerces the string before validation:

- `integer`: `"3"` becomes `3`
- `number`: `"3.14"` becomes `3.14`
- `boolean`: `"true"` or `"false"` becomes a boolean
- `string`: unchanged

Validation happens before the run starts. Invalid values are rejected with an error that names the parameter and the failed rule.

At execution time, step commands still receive string values:

```yaml
params:
  - name: instance_count
    type: integer
    default: 3

steps:
  - command: echo "Launching ${instance_count} instances"
```

The shell sees `"3"`, not a typed integer object.

## Dynamic Defaults with `eval`

Use `eval` when a parameter should derive its effective default from the runtime environment.

```yaml
env:
  - BASE_DIR: /srv/data

params:
  - name: output_dir
    eval: "$BASE_DIR/out"
    default: /tmp/out
  - name: today
    eval: "`date +%Y-%m-%d`"
  - name: workers
    type: integer
    eval: "`nproc`"
    default: 4
    minimum: 1

steps:
  - command: echo "${output_dir} ${today} ${workers}"
```

Behavior:

- `default` stays literal. It is never executed.
- Precedence is: runtime override, then `eval`, then literal `default`.
- Params are evaluated top-to-bottom, so later params can reference earlier params.
- The evaluation scope includes OS environment variables, resolved DAG `env:` values, and earlier resolved params.
- Eval results are coerced and validated when the param declares a type.
- If `eval` fails and `default` exists, Dagu falls back to `default`.
- If `eval` fails and there is no `default`, the run fails before any step starts.
- Metadata-only loads skip `eval`, which is why computed defaults may not appear prefilled in UI/API metadata.
- External-schema-backed `params.schema` defaults are not evaluated.

Example of parameter chaining:

```yaml
params:
  - name: year
    eval: "`date +%Y`"
  - name: report_path
    eval: "/reports/$year/summary.csv"
```

`report_path` resolves after `year`, so it becomes `/reports/2026/summary.csv`.

## Parameter JSON Payload

Every step receives the merged parameter payload through `DAG_PARAMS_JSON`.

- For resolved DAG parameters, the JSON payload remains a string-only object such as `{"instance_count":"3","debug":"false"}`.
- Raw JSON input may be supplied as either an object or an array. For named parameters, prefer a JSON object such as `{"region":"us-west-2","count":"5"}`.
- JSON arrays are mainly useful for positional or mixed payloads.
- If the run was started with raw JSON parameters, the original JSON payload is preserved verbatim.

Typed parameter definitions do not change this serialization.

## Literal Defaults by Default

When `eval` is absent, parameter defaults stay literal:

```yaml
params:
  - DATE: "2026-03-14"
  - MESSAGE: "hello world"
  - SOURCE_REF: "${HOME}/data"

steps:
  - command: echo "${DATE} ${MESSAGE} ${SOURCE_REF}"
```

If you want dynamic values without using param `eval`, compute them in `env:`:

```yaml
env:
  - DATE: "`date +%Y-%m-%d`"
  - HOME_DIR: "${HOME}"

params:
  - INPUT_FILE: data.csv
  - name: THREADS
    type: integer
    default: 4
    minimum: 1

steps:
  - command: python processor.py --input "${INPUT_FILE}" --threads "${THREADS}" --date "${DATE}" --home "${HOME_DIR}"
```

## Runtime Overrides Stay Literal

Runtime overrides are never evaluated, even when a param uses `eval`. This applies to:

- CLI overrides such as `dagu start workflow.yaml -- 'DIR=${HOME}/tmp'`
- API overrides sent in the start request
- Sub-DAG params passed from a parent DAG

Those values are treated as literal strings for safety. Dagu evaluates the DAG author's `eval` expressions, not untrusted runtime input.

## Passing Parameters

```bash
# Named parameters
dagu start workflow.yaml -- ENVIRONMENT=prod PORT=80

# Positional parameters
dagu start workflow.yaml -- input.csv output.json

# Mixed
dagu start workflow.yaml -- config.json ENVIRONMENT=prod

# Raw JSON payload
dagu start workflow.yaml -- '{"environment":"prod","batch_size":50}'

# Raw JSON array payload (mainly for positional or mixed input)
dagu start workflow.yaml -- '["input.csv",{"ENVIRONMENT":"prod"}]'
```

The Web UI uses `paramDefs` from `GET /api/v1/dags/{fileName}` to render typed controls in the start/enqueue modal when the DAG exposes inline definitions or representable external schema metadata. Param descriptions are shown inline below each typed control. For named params, typed clients should submit a JSON object payload. If no typed metadata is available, the UI falls back to the raw parameter editor.

When a param uses `eval`, `paramDefs.default` still reflects only the literal `default` field, if one exists. Computed defaults such as `` `nproc` `` or `$BASE_DIR/out` are resolved by the server at start/enqueue time, not by the client.

## External JSON Schema Validation

Use external schema mode for advanced validation that does not fit the inline subset, such as nested objects, conditional rules, or shared `$ref` definitions.

```yaml
params:
  schema: "https://example.com/schemas/dag-params.json"
  values:
    batch_size: 25
    environment: staging
```

The schema can be:

- **Local file**: `./schemas/params.json` or `/absolute/path/to/schema.json`
- **Remote URL**: `https://example.com/schemas/params.json`

`values:` provides defaults that are validated against the external schema.

## Enforcing Fixed Parameters

Prevent users from editing runtime params in the Web UI:

```yaml
run_config:
  disable_param_edit: true
  disable_run_id_edit: false

params:
  - name: environment
    type: string
    default: production
    description: Fixed deployment target
  - name: safety_mode
    default: enabled

steps:
  - command: echo "Deploying to ${environment} with safety mode ${safety_mode}"
```
