# Labels

Categorize and filter DAGs and DAG runs using labels.

## Overview

Labels support key-value pairs (`env=prod`) and simple labels (`critical`). Values are normalized to lowercase.

## Label Format

Labels are validated at DAG load time. Invalid labels cause load errors.

| Component | Rules |
|-----------|-------|
| **Key** | 1-63 characters. Alphanumeric, `-`, `_`, `.`. Must start with letter or number. |
| **Value** | 0-255 characters. Alphanumeric, `-`, `_`, `.`, `/`. |

Valid: `env`, `my-label`, `app.version`, `path=foo/bar`

Invalid: `-starts-with-dash`, `has space`, `has@special`

## YAML Formats

All formats below are equivalent:

```yaml
# String: space-separated key=value
labels: "env=prod team=platform"

# String: comma-separated (simple labels)
labels: "production, critical, batch"

# Map notation
labels:
  env: prod
  team: platform

# Array of strings
labels:
  - env=prod
  - team=platform
  - critical

# Array of maps
labels:
  - env: prod
  - team: platform

# Mixed array
labels:
  - env=prod
  - critical
  - team: platform
```

`tags` is accepted as a deprecated alias for compatibility with existing DAGs. Do not set both `labels` and `tags` in the same DAG.

## API Filtering

Filter DAGs and DAG runs using the `labels` query parameter.

### Filter Syntax

| Syntax | Description |
|--------|-------------|
| `key` | Match any item with this key (any value) |
| `key=value` | Match exact key-value pair |
| `!key` | Match items WITHOUT this key |
| `key*` | Wildcard: match keys starting with `key` |
| `key=value*` | Wildcard: match values starting with `value` |
| `te?m` | Wildcard: `?` matches single character |

Multiple filters use AND logic.

### Wildcard Patterns

Use `*` (any characters) and `?` (single character) for pattern matching:

```bash
# Match env=prod, env=production, env=prod-us
GET /api/v1/dags?labels=env=prod*

# Match any value for team key
GET /api/v1/dags?labels=team=*

# Match keys starting with "env"
GET /api/v1/dags?labels=env*

# Match team or teem (single char wildcard)
GET /api/v1/dags?labels=te?m
```

### DAG Filtering

```bash
# DAGs with "env" key (any value)
GET /api/v1/dags?labels=env

# DAGs with env=prod
GET /api/v1/dags?labels=env=prod

# DAGs with env=prod AND team key
GET /api/v1/dags?labels=env=prod,team

# DAGs without "deprecated" key
GET /api/v1/dags?labels=!deprecated

# Combined: env=prod AND has team AND not deprecated
GET /api/v1/dags?labels=env=prod,team,!deprecated
```

### DAG Runs Filtering

Filter runs from DAGs that have the specified labels:

```bash
# Runs from DAGs with "env" key
GET /api/v1/dag-runs?labels=env

# Runs from DAGs with env=prod
GET /api/v1/dag-runs?labels=env=prod

# Runs from DAGs with env=prod AND team key
GET /api/v1/dag-runs?labels=env=prod,team
```

## UI

The label filter dropdown is available on both the DAG list and DAG runs pages. Select labels to filter; multiple labels use AND logic.
