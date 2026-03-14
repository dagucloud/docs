# Parameters

DAG-level `params:` define runtime inputs for a workflow. They are stored as literal values and can be overridden when the DAG is started from the CLI, API, Web UI, or a sub-DAG step.

Parameter values are **not** evaluated at parse time. Dagu does not run backticks, expand `${VAR}`, or perform shell evaluation inside DAG-level `params:`. If you need a dynamic default, compute it in `env:` and reference that environment variable from your steps.

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
| `default` | scalar | Default value used when no runtime override is supplied |
| `description` | string | Human-readable help text shown in the UI and API metadata |
| `type` | string | `string`, `integer`, `number`, or `boolean`. Defaults to `string` |
| `required` | boolean | Marks the parameter as required unless a default is present |
| `enum` | list | Allowed values |
| `minimum` / `maximum` | number | Numeric bounds for `integer` and `number` params |
| `min_length` / `max_length` | integer | String length bounds |
| `pattern` | string | Regex for string validation (Go RE2 syntax) |

Notes:

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

## Parameter JSON Payload

Every step receives the merged parameter payload through `DAG_PARAMS_JSON`.

- For resolved DAG parameters, the JSON payload remains a string-only object such as `{"instance_count":"3","debug":"false"}`.
- If the run was started with raw JSON parameters, the original JSON payload is preserved verbatim.

Typed parameter definitions do not change this serialization.

## Parameter Values Are Literal

Parameter values are not evaluated at parse time:

```yaml
params:
  - DATE: "2026-03-14"
  - MESSAGE: "hello world"
  - SOURCE_REF: "${HOME}/data"

steps:
  - command: echo "${DATE} ${MESSAGE} ${SOURCE_REF}"
```

If you need command substitution or variable expansion, use `env:`:

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
```

The Web UI uses `paramDefs` from `GET /api/v1/dags/{fileName}` to render typed controls in the start/enqueue modal when the DAG exposes inline definitions or representable external schema metadata. If no typed metadata is available, the UI falls back to the raw parameter editor.

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
