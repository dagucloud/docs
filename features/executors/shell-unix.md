# Shell (macOS / Linux)

Run commands and scripts on Unix-like systems (macOS, Linux, BSD).

## Configure the Shell

- **DAG defaults** (literal values):
  ```yaml
  shell: ["/bin/bash", "-e", "-u"]
  steps:
    - command: echo "Runs with bash -e -u"
  ```
- **Step override** (evaluated at runtime so params/secrets/outputs are allowed):
  ```yaml
  steps:
    - shell: ${CUSTOM_SHELL:-/bin/zsh}
      command: echo "Runs in the step shell"
  ```
- **Fallback**: If no shell is set, Dagu uses `DAGU_DEFAULT_SHELL`, then `$SHELL`, then `sh`.
- **String or array**: `shell` accepts either `"bash -e"` or `["bash", "-e"]`; arrays avoid quoting issues.

## Running Commands

- **Inline command string**:
  ```yaml
  steps:
    - echo "Hello"
    - command: echo "Hello with key"
    - |
        echo "Multi-line command block"
        echo "Runs as a script (not split into args)"
  ```
- **Command + args array**:
  ```yaml
  steps:
    - command: [python3, -u, app.py, --limit, "10"]
  ```
- **Script block**:
  ```yaml
  steps:
    - script: |
        #!/usr/bin/env bash
        set -e
        echo "Multi-line script"
  ```
  If you omit a step-level `shell` and the script has a shebang, that interpreter is used. Otherwise the resolved shell runs the script file.
- **Interpreter + inline script**:
  ```yaml
  steps:
    - command: python3
      script: |
        import sys
        print("Args:", sys.argv)
  ```
- **Working directory and env**: Use `working_dir`/`dir` and `env` on the step (or DAG defaults) to control context.

## Script Behavior (Unix)

- A `script:` block is saved to a temp file in the working directory when possible and removed after the step finishes.
- If there is no step-level `shell` and the script has a shebang, that interpreter runs the script. Without a shebang, the resolved shell runs it (Dagu appends `-e` for sh/bash/zsh/ksh/ash/dash when using the default/DAG-level shell; step-level shells are left unchanged).
- When both `command` and `script` are set, `command` is treated as the interpreter and receives the script path directly (no shell wrapper) — useful for `command: python3` with inline code.

## Shell Options

- **POSIX shells (sh/bash/zsh/ksh/ash/dash)**  
  With the default or DAG-level shell, Dagu appends `-e` so the shell stops on the first failing command. If you set a step-level shell, add `-e` yourself when you want errexit.

- **nix-shell**  
  Pin tools per step with `shell: nix-shell` and `shell_packages`:
  ```yaml
  steps:
    - shell: nix-shell
      shell_packages: [python3, jq]
      command: |
        python3 --version
        jq --version
  ```
  nix-shell must be installed separately. Dagu runs inside `nix-shell --run ...`; it defaults to `--pure` if you do not supply purity flags. Include any flags you need (such as `--impure`) in the `shell` array. When Dagu supplies the shell, it prepends `set -e;` to the command string unless you already provided it.

- **Direct execution (no shell parsing)**  
  `shell: direct` runs binaries without shell features; use array form:
  ```yaml
  steps:
    - shell: direct
      command: [/usr/bin/python3, -u, script.py]
  ```

## Tips

- Prefer array syntax for commands with flags to avoid quoting surprises.
- Keep DAG-level shells stable; override per-step only when you need a different interpreter.
- Use shebangs in multi-line scripts when you want a specific interpreter without repeating `shell`.
- When using nix-shell, list every tool your step needs in `shell_packages` for reproducibility.
