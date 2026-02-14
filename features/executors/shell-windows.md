# Shell (Windows)

Run commands and scripts on Windows using PowerShell, pwsh, or cmd.exe.

## Configure the Shell

- **DAG defaults** (literal values):
  ```yaml
  shell: powershell -NoProfile
  steps:
    - command: Write-Host "Runs with PowerShell"
  ```
- **Step override** (evaluated at runtime so params/secrets/outputs are allowed):
  ```yaml
  steps:
    - shell: ${SHELL_OVERRIDE:-pwsh -NoProfile}
      command: Write-Host "Runs in the step shell"
  ```
- **Fallback**: If no shell is set, Dagu prefers PowerShell, then `pwsh`, then `cmd.exe`.
- **String or array**: `shell` accepts either `"powershell -NoProfile"` or `["powershell", "-NoProfile"]`; arrays avoid quoting issues.

## Running Commands

- **Inline command string**:
  ```yaml
  steps:
    - command: Write-Host "Hello from PowerShell"
    - shell: cmd
      command: echo Hello from cmd
    - shell: cmd
      command: |
        @echo off
        echo Multi-line command block
        echo Runs as a script (not split into args)
  ```
- **Command + args array**:
  ```yaml
  steps:
    - shell: cmd
      command: [cmd, /c, echo, Hello from cmd array]
  ```
- **Script block**:
  ```yaml
  steps:
    - shell: powershell
      script: |
        Write-Host "Multi-line script"
        Get-Date
  ```
  Scripts are saved as `.ps1` files and executed with the selected shell.
- **Interpreter + inline script**:
  ```yaml
  steps:
    - command: powershell
      script: |
        Write-Host "Inline ps1 body"
  ```
- **Working directory and env**: Use `working_dir`/`dir` and `env` on the step (or DAG defaults) to control context.

## Script Behavior (Windows)

- A `script:` block is saved to a temp file in the working directory when possible and removed after the step finishes.
- With PowerShell/pwsh, the script is stored as `.ps1` and executed by the selected shell. Dagu prefixes each script with `$ErrorActionPreference = 'Stop'` and `$PSNativeCommandUseErrorActionPreference = $true` so cmdlet errors and native command failures stop execution. With `cmd`, scripts follow cmd semantics; use PowerShell for richer scripting.
- When both `command` and `script` are set, `command` is treated as the interpreter and receives the script path directly (no shell wrapper) — useful for `command: powershell` with inline code.

## Shell Options

- **PowerShell / pwsh**  
  Use `shell: powershell` or `shell: pwsh`. Script blocks become `.ps1` files and are prefixed with `$ErrorActionPreference = 'Stop'` plus `$PSNativeCommandUseErrorActionPreference = $true` for fail-fast behavior on cmdlet errors and native command exit codes (PowerShell 7.4+). Use PowerShell syntax for variables/pipelines.

- **cmd.exe**  
  Set `shell: cmd` for command prompt semantics. Include `/c` in the shell string/array when you want to run a single command string. For multi-line cmd scripts, embed the batch pattern directly in YAML:
  ```yaml
  steps:
    - shell: cmd
      command: |
        @echo off
        rem Command || (What to do if it fails)
        copy file.txt destination_folder\ || exit /b 1

        echo This line runs only if the copy succeeded.
  ```

- **Direct execution (no shell parsing)**  
  `shell: direct` bypasses shell parsing; use array form:
  ```yaml
  steps:
    - shell: direct
      command: ["C:\\Program Files\\Git\\bin\\bash.exe", -c, "echo from bash in direct mode"]
  ```

## Tips

- Prefer array syntax for commands with flags to avoid quoting surprises.
- Choose PowerShell for richer scripting; use `cmd` only when you need cmd.exe semantics.
- Keep DAG-level shells stable; override per-step only when a different interpreter is required.
- For `.ps1/.cmd/.bat` scripts in the working directory, use explicit relative or absolute paths to avoid PATH lookup issues.
