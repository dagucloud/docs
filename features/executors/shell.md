# Shell Executor

The default executor for running system commands.

## Basic Usage

```yaml
shell: ["/bin/bash", "-e"]   # Default shell for all steps
steps:
  - echo "Hello, World!"     # Uses DAG shell
  - shell: /usr/local/bin/zsh  # Override for one step
    command: echo "Hello from zsh"
```

When no step-level shell is provided, Dagu runs commands through the DAG shell (or system default) and automatically adds `-e` on Unix-like shells so scripts stop on first error. If you set `shell` on a step, include `-e` yourself if you want the same errexit behavior.

## Writing Scripts

```yaml
steps:
  - shell: bash  # Specify shell (add -e yourself if you want errexit here)
    script: |
      echo "Running script..."
      python process.py  # Run a Python script
```

When `shell` is omitted, Dagu executes the script with the interpreter defined by its shebang (`#!`) if one is provided.

## Shell Selection

```yaml
steps:
  - echo $0  # Uses DAG shell or system default
    
  - shell: ["bash", "-e", "-u"]  # Array form to avoid quoting flags
    command: echo "Bash version: $BASH_VERSION"

  - shell: "/usr/local/bin/fish -C 'set -e'"  # String form also accepted
    command: echo "Using Fish shell"
```

## Shell Arguments

Both DAG- and step-level `shell` fields accept either a string (`"bash -e"`) or an array (`["bash", "-e"]`). Arrays make it easy to pass multiple flags without worrying about quoting. DAG-level values expand environment variables when the workflow loads; step-level values are evaluated at runtime, so you can reference parameters, secrets, or outputs.

### Nix Shell

Use nix-shell for reproducible environments with specific packages:

> **Note:** nix-shell must be installed on your system separately. The Dagu binary and container image do not include nix-shell. Install Nix from [nixos.org](https://nixos.org/download.html) to use this feature.

```yaml
steps:
  - shell: nix-shell
    shellPackages: [python3, curl, jq]
    command: |
      python3 --version
      curl --version
      jq --version
```

#### Examples

```yaml
# Specific versions
steps:
  - shell: nix-shell
    shellPackages: [python314, nodejs_24]
    command: python3 --version && node --version

# Data science stack
steps:
  - shell: nix-shell
    shellPackages:
      - python3
      - python3Packages.pandas
      - python3Packages.numpy
    command: python analyze.py

# Multiple tools
steps:
  - shell: nix-shell
    shellPackages: [go, docker, kubectl]
    command: |
      go build -o app
      docker build -t app:latest .
```

Find packages at [search.nixos.org](https://search.nixos.org/packages).

## Execution Methods

```yaml
steps:
  # Single command
  - date +"%Y-%m-%d %H:%M:%S"
    
  # Multi-line command
  - |
      echo "Starting..."
      echo "Processing data..."
      echo "Done"
      
  # Script block
  - script: |
      #!/bin/bash
      # errexit is enabled by default when you omit a step shell
      find /data -name "*.csv" -exec process {} \;
      
  # Working directory
  - workingDir: /app/src
    command: npm install
```

Multi-line command strings are treated as inline scripts. They run without splitting into `command` and `args`, so you can include shell control flow, environment setup, or even a shebang (`#! /usr/bin/env bash`) as the first line. When no `shell` is specified, Dagu honors the shebang interpreter just like it does for the `script` field.

## Environment Variables

```yaml
# Global variables
env:
  - ENVIRONMENT: production
  - BASE_PATH: /data
  - FULL_PATH: ${BASE_PATH}/input  # Variable expansion

steps:
  # Step-level variables
  - env:
      - API_KEY: ${API_KEY}
    command: curl -H "X-API-Key: $API_KEY" api.example.com
    
  # Command substitution
  - mkdir -p /backup/`date +%Y%m%d`
```
