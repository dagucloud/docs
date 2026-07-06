# Parameters

DAG-level `params:` define runtime inputs for a workflow. They can be overridden when the DAG is started from the CLI, API, Web UI, or a sub-DAG step.

By default, parameter defaults are treated as literal values. If you want a parameter to compute its effective default at execution time, use `eval:` on an inline rich definition. `eval` resolves scoped Dagu references and supports command substitution.

Use `${params.name}` when Dagu should resolve and validate a named parameter reference.

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

# 6. Schema-backed params via local file or URL
params:
  schema: ./schemas/params.json
  values:
    environment: staging
    batch_size: 25

# 7. Schema-backed params with an inline JSON Schema object
params:
  schema:
    type: object
    properties:
      environment:
        type: string
        enum: [dev, staging, prod]
    required: [environment]
  values:
    environment: staging

# 8. Schema-backed params with a boolean schema
params:
  schema: true
  values:
    environment: staging

# 9. Top-level inline JSON Schema
params:
  type: object
  properties:
    environment:
      type: string
      enum: [dev, staging, prod]
    batch_size:
      type: integer
      default: 25
  required: [environment]
```

Legacy map form is still supported:

```yaml
params:
  ENVIRONMENT: dev
  PORT: 8080
```

Top-level inline JSON Schema is recognized only when the top-level `params:` object includes both:

- `type: object`
- `properties:`

`properties:` by itself is not enough to activate schema mode. For example, `params: { properties: { foo: bar } }` remains a legacy named parameter map.

Prefer the ordered list form for authored DAGs when a flat list of scalar parameters is enough. Use schema-backed params when you need nested objects, arrays, or JSON Schema rules outside the inline rich subset.

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
  - run: echo "Launching ${params.instance_count} instances"
```

The shell sees `"3"`, not a typed integer object.

Top-level inline JSON Schema and `params.schema` use the same runtime validation path:

- named overrides are parsed and validated against the schema
- positional overrides are rejected
- defaults from the schema are merged before validation
- shell-visible runtime values and `DAG_PARAMS_JSON` remain string-based

## Dynamic Defaults with `eval`

Use `eval` when a parameter should derive its effective default from the runtime environment.

```yaml
env:
  - BASE_DIR: /srv/data

params:
  - name: output_dir
    eval: "${env.BASE_DIR}/out"
    default: /tmp/out
  - name: today
    eval: "`date +%Y-%m-%d`"
  - name: workers
    type: integer
    eval: "`nproc`"
    default: 4
    minimum: 1

steps:
  - run: echo "${params.output_dir} ${params.today} ${params.workers}"
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
    eval: "/reports/${params.year}/summary.csv"
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
  - run: echo "${params.DATE} ${params.MESSAGE} ${params.SOURCE_REF}"
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

tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python processor.py --input "${params.INPUT_FILE}" --threads "${params.THREADS}" --date "${env.DATE}" --home "${env.HOME_DIR}"
```

`env:` values can also reference `params:` values using `${params.name}`:

```yaml
params:
  data_dir: /tmp/foo

env:
  - FULL_PATH: "${params.data_dir}/output"

steps:
  - run: echo "${env.FULL_PATH}"  # Outputs: /tmp/foo/output
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

The Web UI uses `GET /api/v1/dags/{fileName}` metadata in this order:

- `paramSchema` for schema-backed object forms that are safe to render directly
- `paramDefs` for inline rich params and other typed scalar metadata

Param descriptions are shown inline below each typed control. For named params, typed clients should submit a JSON object payload. If neither `paramSchema` nor `paramDefs` is available, the UI falls back to the raw parameter editor.

When a param uses `eval`, `paramDefs.default` still reflects only the literal `default` field, if one exists. Computed defaults such as `` `nproc` `` or `$BASE_DIR/out` are resolved by the server at start/enqueue time, not by the client.

## Schema-Backed Validation

Use schema-backed params when you need validation that does not fit the inline rich subset, such as nested objects, arrays, conditional rules, or shared `$ref` definitions.

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
- **Inline object**: a JSON Schema object embedded directly in YAML
- **Boolean schema**: `true` to accept any object, `false` to reject all input

`values:` provides defaults that are validated against the schema.

Inline object example:

```yaml
params:
  schema:
    type: object
    properties:
      environment:
        type: string
        enum: [dev, staging, prod]
      replicas:
        type: integer
        minimum: 1
        maximum: 10
        default: 3
    required: [environment]
  values:
    environment: staging
```

Compatibility notes:

- `params: { schema: prod }` without `values:` is still treated as a legacy named parameter, not schema mode.
- `params: { schema: true }` without `values:` is also treated as a legacy named parameter.
- Boolean schema mode becomes active only when `values:` is present.
- A string `schema:` value without `values:` is treated as schema mode only when it looks like a file path or URL.

When the resolved schema is simple enough for direct form rendering, `GET /api/v1/dags/{fileName}` also includes `paramSchema`. In `v2.6.2`, that renderable subset is:

- a root object schema with top-level `properties`
- scalar properties of type `string`, `integer`, `number`, or `boolean`
- fixed-choice scalar properties expressed with `enum` or `oneOf` constant options

Nested objects, arrays, conditional schemas, `patternProperties`, and other unsupported constructs are still validated at runtime, but the Web UI falls back to the raw parameter editor instead of generating a form.

## Top-Level Inline JSON Schema

Top-level inline JSON Schema is an alternative to `params: { schema, values }` when you want the schema itself to be the `params:` value.

```yaml
params:
  type: object
  properties:
    environment:
      type: string
      enum: [dev, staging, prod]
    batch_size:
      type: integer
      minimum: 1
      maximum: 100
      default: 25
    debug:
      type: boolean
      default: false
  required: [environment]
  additionalProperties: false
```

Behavior:

- The top-level object must include `type: object` and `properties`.
- Metadata loads derive `paramDefs`, `defaultParams`, and, when possible, a renderable `paramSchema` from scalar property defaults.
- Runtime overrides must be named (`environment=prod`), not positional (`prod`).
- If `additionalProperties: false` is set, unknown named overrides are rejected.
- JSON Schema keywords outside the inline rich subset are passed through to runtime validation.

This form is useful when you want JSON Schema validation but do not need a separate `values:` object for defaults.

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
  - run: echo "Deploying to ${params.environment} with safety mode ${params.safety_mode}"
```
