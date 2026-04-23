# Tool Calling

The chat executor supports function calling (also known as tool use), allowing the LLM to execute DAG workflows as tools during sessions. This enables building AI agents that can perform actions, query data, and interact with external systems.

## How It Works

1. Define tool DAGs with `name`, `description`, and `params`
2. Reference tools in `llm.tools` array
3. LLM automatically calls tools when needed
4. Tool results feed back into session
5. Process repeats until termination condition is met

### Execution Termination

The chat step finishes in one of two ways:

**1. Normal Completion (Recommended Path)**
- LLM returns a response **without tool calls**
- This is the final answer to the user's question
- Session is saved and step completes successfully

**2. Max Iterations Reached**
- Loop hits `max_tool_iterations` limit (default: 10)
- Last assistant message content is returned as output
- Warning logged: `"Max tool iterations reached"`
- Step still completes successfully (not treated as error)

Both scenarios result in successful step completion. The step only fails if the LLM request itself encounters an error.

## Basic Example

```yaml
# Main DAG that uses the tool
steps:
  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      tools:
        - calculator
    messages:
      - role: user
        content: "What is 15 times 23?"

---
# Tool DAG definition
name: calculator
description: "Perform basic arithmetic operations"
params: "operation a b"

steps:
  - id: calculate
    script: |
      case "$1" in
        add) echo $(($2 + $3)) ;;
        multiply) echo $(($2 * $3)) ;;
        *) echo "Unknown operation" ;;
      esac
    output: RESULT
```

## Tool Definition

Tools are standard DAGs with special fields that the LLM uses:

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Function name shown to LLM | `search_tool` |
| `description` | What the tool does | `"Search the web for information"` |
| `params` | Parameters (auto-parsed to JSON Schema) | `"query max_results=10"` |
| Steps with `output` | Return values to LLM | `output: RESULT` |

## Parameter Format

Parameters in `params` are parsed to generate JSON Schema:

```yaml
# Format: "required_param optional=default bool=true number=42"
params: "query max_results=10 include_images=false temperature=0.7"

# Generates JSON Schema:
# {
#   "type": "object",
#   "properties": {
#     "query": {"type": "string"},
#     "max_results": {"type": "integer", "default": 10},
#     "include_images": {"type": "boolean", "default": false},
#     "temperature": {"type": "number", "default": 0.7}
#   },
#   "required": ["query"]
# }
```

**Type Inference:**
- Bare parameter → required string
- `param=value` → optional, type inferred from value
- Quoted strings: `name="default value"`
- Numbers: `limit=10` (integer), `temp=0.7` (float)
- Booleans: `verbose=true`
- Arrays: `filters=[]`
- Objects: `config={}`

## Tool Discovery

Tools are discovered in this order:

1. **Local DAGs**: DAGs defined in the same file using `---` separator
2. **Database**: DAGs from the configured DAG directory

```yaml
# Main DAG
steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
      tools:
        - local_tool      # Found in local DAGs
        - database_tool   # Loaded from DAG directory
    messages:
      - role: user
        content: "Use the tools as needed."

---
# Local tool (inline definition)
name: local_tool
description: "A tool defined locally"
params: "input"

steps:
  - command: echo "Processing: $1"
    output: RESULT
```

## Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tools` | string[] | `[]` | DAG names to expose as tools |
| `max_tool_iterations` | int | `10` | Maximum tool calling loops |

```yaml
steps:
  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      tools:
        - search_tool
        - calculator
        - database_query
      max_tool_iterations: 15  # Allow more iterations for complex tasks
    messages:
      - role: user
        content: "Research and analyze..."
```

## Multi-Tool Example

```yaml
# Main workflow
steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
      tools:
        - web_search
        - analyze_data
    messages:
      - role: user
        content: "Search for AI trends and analyze them"

---
# Search tool
name: web_search
description: "Search the web for current information"
params: "query"

steps:
  - command: curl "https://api.example.com/search?q=$1"
    output: SEARCH_RESULTS

---
# Analysis tool
name: analyze_data
description: "Analyze data and generate insights"
params: "data"

steps:
  - command: echo "$1" | python analyze.py
    output: INSIGHTS
```

The LLM can call multiple tools across multiple turns to complete the task.

## Tool Execution

When the LLM requests a tool call:

1. **Tool DAG Execution**: The tool DAG runs as a sub-DAG with parameters passed as DAG params
2. **Parameter Mapping**: Tool arguments → DAG parameters in `KEY=value` format
3. **Output Collection**: DAG `output` fields collected and returned as JSON
4. **Result Format**: If DAG has outputs, they're returned as JSON. If no outputs, status message is returned.
5. **Sub-DAG Tracking**: Each tool execution creates a sub-DAG run for UI drill-down

## UI Features

**Tool Definitions Panel:**
- Shows all available tools with names and descriptions
- Displays parameter schemas with types and defaults
- Collapsible panel in message history view

**Tool Call Display:**
- Assistant messages show tool calls with function names and arguments
- Tool result messages show outputs or errors
- Sub-DAG run links for drilling into tool execution details

**Execution Tracking:**
- Each tool call creates a sub-DAG run
- Full execution details available via sub-DAG run drill-down
- Step outputs, logs, and status visible in UI

## Provider Support

All major providers support tool calling with automatic API mapping:

| Provider | API Format | Notes |
|----------|-----------|-------|
| Anthropic | `tool_use` content blocks | Claude 3+, Claude 4 models |
| OpenAI | `tool_calls` array | GPT-3.5, GPT-4, GPT-4o models |
| Gemini | `functionCall` parts | Gemini 1.5+, Gemini 2 models |
| OpenRouter | Provider-specific mapping | Depends on underlying model |
| Local | OpenAI-compatible format | If model supports function calling |

## Error Handling

**Tool Execution Failures:**
- DAG execution errors are passed to LLM as tool error messages
- LLM can retry, adjust parameters, or try alternative approaches
- Session continues even if tool fails

**Iteration Limits:**
- When `max_tool_iterations` is reached, the last assistant message is written to stdout
- If no assistant message exists, outputs: `"[Max tool iterations (N) reached. The LLM may not have provided a complete response.]"`
- Warning logged but step completes successfully (not as error)
- Increase `max_tool_iterations` for complex multi-step tasks

## Best Practices

1. **Clear Descriptions**: Write detailed tool descriptions so LLM knows when to use them
2. **Specific Parameters**: Use descriptive parameter names and provide defaults
3. **Structured Output**: Return JSON from tools for easier LLM parsing
4. **Error Messages**: Provide clear error messages when tools fail
5. **Iteration Limits**: Set `max_tool_iterations` based on task complexity
6. **Tool Modularity**: Keep tools focused on single responsibilities
7. **Parameter Validation**: Validate inputs in tool DAG steps

## Advanced Example: Data Pipeline Agent

```yaml
# Main agent workflow
steps:
  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      tools:
        - fetch_data
        - transform_data
        - store_data
      max_tool_iterations: 20
    messages:
      - role: user
        content: "Fetch user data, transform it to standard format, and store in database"

---
# Fetch data tool
name: fetch_data
description: "Fetch data from external API"
params: "endpoint"

steps:
  - command: curl "https://api.example.com/$1"
    output: RAW_DATA

---
# Transform data tool
name: transform_data
description: "Transform and clean data"
params: "data format=json"

steps:
  - command: echo "$1" | jq '.' > /tmp/transformed.json
  - command: cat /tmp/transformed.json
    output: TRANSFORMED_DATA

---
# Store data tool
name: store_data
description: "Store data in database"
params: "data table"

steps:
  - type: postgres
    with:
      dsn: ${DATABASE_URL}
    command: "INSERT INTO $2 (data) VALUES ('$1'::jsonb)"
```

The LLM orchestrates the multi-step data pipeline by calling tools in sequence.

## Notes

- Tool calling requires streaming to be disabled automatically (handled internally)
- Tool DAGs execute in the same working directory as the parent DAG
- Tool execution creates standard sub-DAG runs visible in UI
- Session history includes all tool calls and results
- Tool results are visible in the message history for debugging

## See Also

- [Basic Chat](/features/chat/basics) - Simple LLM sessions without tools
- [Chat Overview](/features/chat/) - All chat capabilities and providers
