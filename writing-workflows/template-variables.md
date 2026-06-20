# Variables Reference

For automatically injected run metadata, see [Special Environment Variables](/writing-workflows/runtime-variables).

## Reference Syntax

Dagu-owned value references are scoped:

| Form | Meaning |
| --- | --- |
| `${consts.name}` | Immutable workflow constant |
| `${params.name}` | Named runtime parameter |
| `${env.NAME}` | Value from the current environment scope |
| `${steps.step_id.outputs.name}` | Declared output from a completed dependency step |

These forms are validated more precisely than bare `${NAME}` text. They let Dagu identify unknown params, missing environment values, unknown step ids, unknown output names, and missing dependencies.

Bare `$NAME` and `${NAME}` are unqualified environment syntax. In `run` scripts, Dagu leaves them for the selected shell or interpreter. In fields where Dagu owns unqualified environment expansion, they read from the current environment scope.

## Constants

Use `consts` for immutable values known when the workflow is loaded.

```yaml
consts:
  - service: api
  - image_repo: registry.example.com/${consts.service}

steps:
  - id: print_repo
    run: echo "${consts.image_repo}"
```

`consts` entries are evaluated in order. A const can reference only earlier consts.

## Parameters

Use `${params.name}` for named runtime parameters.

```yaml
params:
  - name: environment
    type: string
    default: staging
    enum: [dev, staging, prod]

steps:
  - id: deploy
    run: ./deploy.sh --env "${params.environment}"
```

Parameter defaults are literal unless `eval` is used on an inline rich parameter.

## Environment Values

Use `${env.NAME}` when Dagu should resolve an environment value.

```yaml
env:
  - BASE_DIR: /tmp/data
  - OUTPUT_DIR: ${env.BASE_DIR}/output

steps:
  - id: process
    run: ./process.sh --out "${env.OUTPUT_DIR}"
```

To import a host process environment value into the workflow environment, use root `env`:

```yaml
env:
  - AWS_REGION: ${AWS_REGION}
```

After import, prefer `${env.AWS_REGION}` in workflow fields.

## Step Outputs

Use `${steps.step_id.outputs.name}` to read a declared output from a completed dependency.

```yaml
type: graph

steps:
  - id: build
    run: |
      printf 'image=registry.example.com/api:v1.2.3\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: image

  - id: deploy
    depends: build
    run: ./deploy.sh "${steps.build.outputs.image}"
```

Rules:

- The producing step must have an `id`.
- The output name must be declared in the producing step's `outputs` list.
- The producing step must complete successfully before the consuming step starts.
- The consuming step must depend directly or transitively on the producing step.
- Step output references do not create dependencies.

## Escaping Dagu References

Prefix a Dagu-owned reference with a backslash when the later runtime should receive the literal reference text.

```yaml
steps:
  - id: script
    run: |
      node - <<'JS'
      console.log('\${steps.build.outputs.image}')
      JS
```

Dagu removes its escape marker and passes `${steps.build.outputs.image}` to the script as literal text.

## Shell Variables

Inside `run`, unqualified `$NAME` and `${NAME}` belong to the selected shell or script interpreter.

```yaml
steps:
  - id: shell_example
    run: |
      tmp="${TMPDIR:-/tmp}/work"
      mkdir -p "$tmp"
      echo "scratch=$tmp"
```

Use shell syntax for shell-local variables, shell defaults, substring operators, arrays, and command substitution that must run inside the step process.

Use scoped Dagu references when the value should be resolved by Dagu before the step starts:

```yaml
env:
  - OUTPUT_DIR: /tmp/out

steps:
  - id: shell_and_dagu
    run: |
      mkdir -p "${env.OUTPUT_DIR}"
      file="${env.OUTPUT_DIR}/result.txt"
      echo "done" > "$file"
```

## Field Behavior

Common value-resolved fields include:

- root `env`
- `dotenv` paths
- `working_dir`
- `preconditions[].condition`
- `steps[].run`
- `steps[].with` nested string values
- `steps[].env`
- `steps[].working_dir`
- retry and repeat numeric string fields listed in the YAML spec
- `steps[].parallel` strings
- `steps[].stdout`, `steps[].stderr`, and artifact paths
- lifecycle handler step fields

Fields such as step identity, dependency names, parameter defaults, secret provider keys, and most root provider configuration are literal unless their owning spec opts in.

## Unknown References

Unsupported braced text is preserved as ordinary string content.

```yaml
steps:
  - id: literal_text
    run: echo '${not.a.supported.reference}'
```

Supported but unavailable references are also preserved, and inspection surfaces can report a passive notice. For example, a known step-output reference without a dependency is preserved with a `missing_dependency` notice.

## Related Pages

- [Outputs](/writing-workflows/outputs)
- [Parameters](/writing-workflows/parameters)
- [Environment Variables](/writing-workflows/environment-variables)
- [YAML Specification](/writing-workflows/yaml-specification)
