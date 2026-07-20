import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { issueLinksPlugin } from "./theme/plugins/issueLinks.js";

const llmItems = [
  { text: "Overview", link: "/step-types/llm/" },
  { text: "Providers & Endpoints", link: "/step-types/llm/providers" },
  { text: "Local Models", link: "/step-types/llm/local-models" },
  { text: "OpenCode", link: "/step-types/llm/opencode" },
  { text: "Reliability", link: "/step-types/llm/reliability" },
  { text: "Outputs & Routing", link: "/step-types/llm/outputs" },
  { text: "Reasoning & Web Search", link: "/step-types/llm/reasoning-web-search" },
  { text: "Tool Calling", link: "/features/chat/tool-calling" },
];

// Define the complete sidebar structure
const fullSidebar = [
  {
    text: "QuickStart",
    items: [
      { text: "What is Dagu?", link: "/overview/" },
      { text: "Quickstart", link: "/getting-started/quickstart" },
      { text: "Core Concepts", link: "/getting-started/concepts" },
      {
        text: "Installation",
        link: "/getting-started/installation/",
        collapsed: true,
        items: [
          { text: "Overview", link: "/getting-started/installation/" },
          { text: "macOS", link: "/getting-started/installation/macos" },
          { text: "Linux", link: "/getting-started/installation/linux" },
          { text: "npm", link: "/getting-started/installation/npm" },
          { text: "Windows", link: "/getting-started/installation/windows" },
          { text: "Docker", link: "/getting-started/installation/docker" },
          { text: "Kubernetes", link: "/getting-started/installation/kubernetes" },
          { text: "Build from source", link: "/getting-started/installation/source" },
          { text: "Uninstall", link: "/getting-started/installation/uninstall" },
        ],
      },
      { text: "CLI Reference", link: "/getting-started/cli" },
      {
        text: "Migration",
        collapsed: true,
        items: [
          { text: "From Cron", link: "/migration/from-cron" },
        ],
      },
      {
        text: "Project",
        collapsed: true,
        items: [
          { text: "Architecture", link: "/overview/architecture" },
          { text: "Deployment Models", link: "/overview/deployment-models" },
          { text: "License Comparison", link: "/overview/self-host-license" },
          { text: "Contributing", link: "/overview/contributing" },
          { text: "Changelog", link: "/overview/changelog" },
        ],
      },
    ],
  },
  {
    text: "Web UI",
    items: [
      { text: "Overview", link: "/overview/web-ui" },
      {
        text: "Core Tools",
        collapsed: true,
        items: [
          { text: "Cockpit", link: "/web-ui/cockpit" },
          { text: "Workspaces", link: "/web-ui/workspaces" },
          { text: "Profiles", link: "/web-ui/profiles" },
          { text: "Secrets", link: "/web-ui/secrets" },
        ],
      },
      {
        text: "Automation",
        collapsed: true,
        items: [
          { text: "Notifications", link: "/web-ui/notifications" },
          { text: "Incident Routing", link: "/web-ui/incidents" },
        ],
      },
      { text: "REST API", link: "/web-ui/api" },
    ],
  },
  {
    text: "Workflows",
    items: [
      {
        text: "Fundamentals",
        collapsed: false,
        items: [
          { text: "Introduction", link: "/writing-workflows/" },
          { text: "Workflow Basics", link: "/writing-workflows/basics" },
          { text: "Base Configuration", link: "/server-admin/base-config" },
          { text: "Parameters", link: "/writing-workflows/parameters" },
          { text: "Environment Variables", link: "/writing-workflows/environment-variables" },
          { text: "Labels", link: "/writing-workflows/labels" },
          { text: "Tags", link: "/writing-workflows/tags" },
        ],
      },
      {
        text: "Examples",
        link: "/writing-workflows/examples/",
        collapsed: false,
        items: [
          { text: "Overview", link: "/writing-workflows/examples/" },
          { text: "Basic Examples", link: "/writing-workflows/examples/basic" },
          { text: "Control Flow", link: "/writing-workflows/examples/control-flow" },
          { text: "Reliability", link: "/writing-workflows/examples/reliability" },
          { text: "Data & Variables", link: "/writing-workflows/examples/data-variables" },
          { text: "Scripts & Runtime", link: "/writing-workflows/examples/scripts-runtime" },
          { text: "Actions & Integrations", link: "/writing-workflows/examples/actions-integrations" },
          { text: "Scheduling & Queues", link: "/writing-workflows/examples/scheduling-queues" },
          { text: "Operations", link: "/writing-workflows/examples/operations" },
          {
            text: "AI Examples",
            link: "/writing-workflows/examples/ai",
            collapsed: false,
            items: [
              { text: "Chat & LLM", link: "/writing-workflows/examples/ai" },
              { text: "Harness Run", link: "/writing-workflows/examples/harness-run" },
            ],
          },
        ],
      },
      {
        text: "Variables & Runtime",
        collapsed: true,
        items: [
          { text: "Runtime Profiles", link: "/writing-workflows/runtime-profiles" },
          { text: "Runtime Variables", link: "/writing-workflows/runtime-variables" },
          { text: "Variables Reference", link: "/writing-workflows/template-variables" },
          { text: "Quoting & Escaping", link: "/writing-workflows/quoting-and-escaping" },
          { text: "Data & Variables", link: "/writing-workflows/data-variables" },
          { text: "Tools", link: "/writing-workflows/tools" },
        ],
      },
      {
        text: "Data Flow",
        collapsed: true,
        items: [
          { text: "Data Flow", link: "/writing-workflows/data-flow" },
          { text: "Outputs", link: "/writing-workflows/outputs" },
          { text: "Persistent State", link: "/writing-workflows/persistent-state" },
          { text: "Artifacts", link: "/writing-workflows/artifacts" },
        ],
      },
      {
        text: "Control",
        collapsed: true,
        items: [
          { text: "Control Flow", link: "/writing-workflows/control-flow" },
          { text: "Scheduling", link: "/writing-workflows/scheduling" },
          { text: "Execution Control", link: "/writing-workflows/execution-control" },
          { text: "Queue Assignment", link: "/writing-workflows/queues" },
          { text: "Approval Gates", link: "/writing-workflows/approval" },
        ],
      },
      {
        text: "Reliability",
        collapsed: true,
        items: [
          { text: "Error Handling", link: "/writing-workflows/error-handling" },
          { text: "Continue On", link: "/writing-workflows/continue-on" },
          { text: "Durable Execution", link: "/writing-workflows/durable-execution" },
          { text: "Lifecycle Handlers", link: "/writing-workflows/lifecycle-handlers" },
          { text: "Email Notifications", link: "/writing-workflows/email-notifications" },
        ],
      },
      {
        text: "Execution Settings",
        collapsed: true,
        items: [
          { text: "Step Defaults", link: "/writing-workflows/step-defaults" },
          { text: "Resource Limits", link: "/writing-workflows/resource-limits" },
          { text: "DAG Run Resource Limits", link: "/writing-workflows/dag-run-resource-limits" },
          { text: "Container", link: "/writing-workflows/container" },
        ],
      },
      {
        text: "Secrets",
        link: "/writing-workflows/secrets",
        collapsed: true,
        items: [
          { text: "Overview", link: "/writing-workflows/secrets" },
          { text: "Dotenv Loading", link: "/writing-workflows/secrets/dotenv" },
          { text: "Env Provider", link: "/writing-workflows/secrets/env-provider" },
          { text: "File Provider", link: "/writing-workflows/secrets/file-provider" },
          { text: "Vault Provider", link: "/writing-workflows/secrets/vault-provider" },
          { text: "Kubernetes Provider", link: "/writing-workflows/secrets/kubernetes-provider" },
        ],
      },
      {
        text: "Reference",
        collapsed: true,
        items: [
          { text: "YAML Specification", link: "/writing-workflows/yaml-specification" },
        ],
      },
    ],
  },
  {
    text: "Actions",
    items: [
      {
        text: "Built-in Actions",
        collapsed: false,
        items: [
          {
            text: "Execution",
            collapsed: true,
            items: [
              { text: "Shell", link: "/step-types/shell" },
              { text: "Shell (macOS / Linux)", link: "/step-types/shell-unix" },
              { text: "Shell (Windows)", link: "/step-types/shell-windows" },
              { text: "Docker", link: "/step-types/docker" },
              { text: "Kubernetes", link: "/step-types/kubernetes" },
              { text: "Wait", link: "/step-types/wait" },
              { text: "Router", link: "/step-types/router" },
              { text: "Log", link: "/step-types/log" },
            ],
          },
          {
            text: "Data & Files",
            collapsed: true,
            items: [
              { text: "Data", link: "/step-types/data" },
              { text: "Outputs", link: "/step-types/outputs" },
              { text: "Artifact", link: "/step-types/artifact" },
              { text: "File", link: "/step-types/file" },
              { text: "Archive", link: "/step-types/archive" },
              { text: "Template", link: "/step-types/template" },
            ],
          },
          {
            text: "Integrations",
            collapsed: true,
            items: [
              { text: "HTTP", link: "/step-types/http" },
              { text: "Mail", link: "/step-types/mail" },
              { text: "SSH", link: "/step-types/ssh" },
              { text: "SFTP", link: "/step-types/sftp" },
              { text: "Git", link: "/step-types/git" },
              { text: "S3", link: "/step-types/s3" },
              { text: "Redis", link: "/step-types/redis" },
              { text: "JQ", link: "/step-types/jq" },
            ],
          },
          {
            text: "LLM (chat.completion)",
            link: "/step-types/llm/",
            collapsed: true,
            items: llmItems,
          },
          {
            text: "SQL",
            link: "/step-types/sql/",
            collapsed: true,
            items: [
              { text: "Overview", link: "/step-types/sql/" },
              { text: "PostgreSQL", link: "/step-types/sql/postgresql" },
              { text: "SQLite", link: "/step-types/sql/sqlite" },
              { text: "DuckDB", link: "/step-types/sql/duckdb" },
            ],
          },
          {
            text: "Harness",
            link: "/step-types/harness/",
            collapsed: true,
            items: [
              { text: "Overview", link: "/step-types/harness/" },
              {
                text: "Agents",
                collapsed: true,
                items: [
                  { text: "Claude Code", link: "/step-types/harness/claude" },
                  { text: "Codex", link: "/step-types/harness/codex" },
                  { text: "Copilot", link: "/step-types/harness/copilot" },
                  { text: "Hermes Agent", link: "/step-types/harness/hermes" },
                  { text: "OpenCode", link: "/step-types/harness/opencode" },
                  { text: "Pi", link: "/step-types/harness/pi" },
                ],
              },
              {
                text: "Sandboxed Execution",
                link: "/step-types/harness/sandbox/",
                collapsed: true,
                items: [
                  { text: "Overview", link: "/step-types/harness/sandbox/" },
                  { text: "Docker", link: "/step-types/harness/sandbox/docker" },
                  { text: "Podman", link: "/step-types/harness/sandbox/podman" },
                  { text: "Runner Images", link: "/step-types/harness/sandbox/images" },
                  { text: "Credentials", link: "/step-types/harness/sandbox/credentials" },
                  { text: "Codex", link: "/step-types/harness/sandbox/codex" },
                  { text: "Claude Code", link: "/step-types/harness/sandbox/claude-code" },
                  { text: "OpenCode", link: "/step-types/harness/sandbox/opencode" },
                  { text: "Custom Provider", link: "/step-types/harness/sandbox/custom-provider" },
                ],
              },
            ],
          },
        ],
      },
      {
        text: "Dagu Actions",
        link: "/dagu-actions/",
        collapsed: true,
        items: [
          { text: "Overview", link: "/dagu-actions/" },
          {
            text: "Official Actions",
            link: "/dagu-actions/official",
            collapsed: true,
            items: [
              { text: "Overview", link: "/dagu-actions/official" },
              { text: "Node Script", link: "/dagu-actions/official/node-script" },
              { text: "Python Script", link: "/dagu-actions/official/python-script" },
              { text: "dbt", link: "/dagu-actions/official/dbt" },
              { text: "DuckDB", link: "/dagu-actions/official/duckdb" },
              { text: "FFmpeg", link: "/dagu-actions/official/ffmpeg" },
              { text: "GitHub CLI", link: "/dagu-actions/official/github-cli" },
              { text: "Rclone", link: "/dagu-actions/official/rclone" },
            ],
          },
          { text: "Third-Party Actions", link: "/dagu-actions/third-party" },
          { text: "Custom Actions", link: "/dagu-actions/custom" },
          { text: "Execution Model", link: "/dagu-actions/execution-model" },
        ],
      },
    ],
  },
  {
    text: "Operation",
    items: [
      { text: "Overview", link: "/server-admin/" },
      {
        text: "Configuration",
        collapsed: false,
        items: [
          { text: "Configuration", link: "/server-admin/configuration" },
          { text: "Server Configuration", link: "/server-admin/server" },
          { text: "Configuration Reference", link: "/server-admin/reference" },
          { text: "Queue Configuration", link: "/server-admin/queues" },
        ],
      },
      {
        text: "Authentication",
        link: "/server-admin/authentication/",
        collapsed: true,
        items: [
          { text: "Overview", link: "/server-admin/authentication/" },
          { text: "Builtin Auth (RBAC)", link: "/server-admin/authentication/builtin" },
          { text: "User Management", link: "/server-admin/authentication/user-management" },
          { text: "API Keys", link: "/server-admin/authentication/api-keys" },
          { text: "Webhooks", link: "/server-admin/authentication/webhooks" },
          { text: "Basic Auth", link: "/server-admin/authentication/basic" },
          { text: "OIDC", link: "/server-admin/authentication/oidc" },
          { text: "OIDC - Google", link: "/server-admin/authentication/oidc-google" },
          { text: "OIDC - Auth0", link: "/server-admin/authentication/oidc-auth0" },
          { text: "OIDC - Okta", link: "/server-admin/authentication/oidc-okta" },
          { text: "OIDC - Entra ID", link: "/server-admin/authentication/oidc-entra" },
          { text: "OIDC - Keycloak", link: "/server-admin/authentication/oidc-keycloak" },
          { text: "TLS/HTTPS", link: "/server-admin/authentication/tls" },
          { text: "Remote Nodes", link: "/server-admin/authentication/remote-nodes" },
        ],
      },
      {
        text: "Deployment",
        link: "/server-admin/deployment/",
        collapsed: true,
        items: [
          { text: "Overview", link: "/server-admin/deployment/" },
          { text: "Multi-Environment", link: "/server-admin/deployment/multi-environment" },
          { text: "macOS Service", link: "/server-admin/deployment/macos" },
          { text: "Linux Systemd", link: "/server-admin/deployment/systemd" },
          { text: "Docker Images", link: "/server-admin/deployment/docker-images" },
          { text: "Docker", link: "/server-admin/deployment/docker" },
          { text: "Docker Compose", link: "/server-admin/deployment/docker-compose" },
          { text: "Kubernetes (Helm)", link: "/server-admin/deployment/kubernetes" },
        ],
      },
      {
        text: "Distributed Execution",
        link: "/server-admin/distributed/",
        collapsed: true,
        items: [
          { text: "Overview", link: "/server-admin/distributed/" },
          { text: "Networking", link: "/server-admin/distributed/networking" },
          { text: "Transport Security", link: "/server-admin/distributed/transport-security" },
          {
            text: "Workers",
            link: "/server-admin/distributed/workers/",
            collapsed: true,
            items: [
              { text: "Overview", link: "/server-admin/distributed/workers/" },
              { text: "Shared Filesystem", link: "/server-admin/distributed/workers/shared-filesystem" },
              { text: "Shared Nothing", link: "/server-admin/distributed/workers/shared-nothing" },
            ],
          },
          { text: "Worker Labels", link: "/server-admin/distributed/worker-labels" },
        ],
      },
      {
        text: "Observability",
        collapsed: true,
        items: [
          { text: "Prometheus Metrics", link: "/server-admin/prometheus-metrics" },
          { text: "OpenTelemetry", link: "/server-admin/opentelemetry" },
          { text: "OpenTelemetry Testing", link: "/server-admin/opentelemetry-testing" },
        ],
      },
      {
        text: "Maintenance",
        collapsed: true,
        items: [
          { text: "Operations", link: "/server-admin/operations" },
          { text: "Git Sync", link: "/server-admin/git-sync" },
          { text: "Remote Nodes", link: "/server-admin/remote-nodes" },
          { text: "Tunnel (Tailscale)", link: "/server-admin/tunnel" },
          { text: "Self-Upgrade", link: "/server-admin/self-upgrade" },
        ],
      },
    ],
  },
  {
    text: "AI",
    items: [
      {
        text: "MCP Server",
        link: "/mcp/",
        collapsed: false,
        items: [
          { text: "Overview", link: "/mcp/" },
          { text: "Quickstart", link: "/mcp/quickstart" },
          { text: "Clients", link: "/mcp/clients" },
          { text: "Authentication", link: "/mcp/authentication" },
          { text: "Architecture", link: "/mcp/architecture" },
          { text: "Tools", link: "/mcp/tools" },
          { text: "Resources", link: "/mcp/resources" },
          { text: "Auditability", link: "/mcp/auditability" },
        ],
      },
      {
        text: "Chat & LLM",
        link: "/features/chat/",
        collapsed: true,
        items: llmItems,
      },
      {
        text: "Embedding Dagu",
        collapsed: true,
        items: [
          { text: "Go API", link: "/embedding/go-api" },
          { text: "Licensing", link: "/embedding/licensing" },
        ],
      },
    ],
  },
];

// "Kiln" code theme — phosphor amber keys, signal-green strings, violet
// functions on an ink panel. Used for both light and dark modes.
const kilnCodeTheme = {
  name: "kiln-ink",
  type: "dark",
  colors: {
    "editor.background": "#08090e",
    "editor.foreground": "#dddcd4",
  },
  settings: [
    { settings: { background: "#08090e", foreground: "#dddcd4" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#62656f" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "punctuation.definition.string",
        "markup.inline.raw",
      ],
      settings: { foreground: "#8fd9a8" },
    },
    {
      scope: [
        "keyword",
        "storage.type",
        "storage.modifier",
        "entity.name.tag",
        "support.type.property-name",
        "keyword.operator.assignment",
      ],
      settings: { foreground: "#e2a566" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character.escape",
        "keyword.other.unit",
      ],
      settings: { foreground: "#d8b4fe" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call.generic",
      ],
      settings: { foreground: "#a89ff8" },
    },
    {
      scope: ["variable", "variable.other", "variable.parameter"],
      settings: { foreground: "#dddcd4" },
    },
    {
      scope: ["variable.other.readwrite", "punctuation"],
      settings: { foreground: "#dddcd4" },
    },
    {
      scope: ["entity.name.type", "support.class", "support.type"],
      settings: { foreground: "#948af7" },
    },
    {
      scope: ["markup.heading"],
      settings: { foreground: "#e2a566" },
    },
    {
      scope: ["markup.bold"],
      settings: { fontStyle: "bold" },
    },
    {
      scope: ["markup.italic"],
      settings: { fontStyle: "italic" },
    },
  ],
};

export default withMermaid(
  defineConfig({
    title: "Dagu",
    description: "Local-first workflow orchestration that runs anywhere. Declarative YAML, single binary, air-gapped ready.",
    lang: "en-US",
    lastUpdated: true,
    cleanUrls: true,
    srcExclude: ["feature-request-*.md"],

    head: [
      [
        "meta",
        {
          name: "description",
          content: "Local-first workflow orchestration that runs anywhere. Declarative YAML, single binary, air-gapped ready.",
        },
      ],
      [
        "meta",
        {
          property: "og:description",
          content: "Local-first workflow orchestration that runs anywhere. Declarative YAML, single binary, air-gapped ready.",
        },
      ],
      ["meta", { property: "og:image", content: "https://docs.dagu.sh/og.png" }],
      ["meta", { property: "og:image:width", content: "1280" }],
      ["meta", { property: "og:image:height", content: "640" }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      ["meta", { name: "twitter:image", content: "https://docs.dagu.sh/og.png" }],
      ["link", { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
      ["link", { rel: "shortcut icon", href: "/favicon.ico" }],
      ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
      [
        "link",
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
      [
        "link",
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
        },
      ],
      [
        "script",
        {},
        `
          // Set dark mode as default
          ;(function() {
            const userMode = localStorage.getItem('vitepress-theme-appearance')
            if (!userMode || userMode === 'auto') {
              localStorage.setItem('vitepress-theme-appearance', 'dark')
              document.documentElement.classList.add('dark')
            }
          })()
        `,
      ],
      [
        "script",
        {},
        `
          !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
          posthog.init('phc_MqwcYt09eiG9BYkwCMLbYwL4yqgtDoyZqYnLRb5IZuT', {
            api_host:'https://us.i.posthog.com',
            defaults: '2025-11-30'
          })
        `,
      ],
    ],

    themeConfig: {
      logo: { light: "/logo-light.png", dark: "/logo-dark.png" },
      siteTitle: "Dagu",
      logoLink: "https://docs.dagu.sh/",

      appearance: {
        defaultTheme: "dark",
      },

      outline: {
        level: [2, 3],
        label: "On this page",
      },

      nav: [
        { text: "QuickStart", link: "/getting-started/quickstart", activeMatch: "^/(overview/(?:$|architecture|deployment-models|self-host-license|contributing|changelog)|getting-started/|migration/)" },
        { text: "Web UI", link: "/overview/web-ui", activeMatch: "^/(overview/web-ui|web-ui/)" },
        { text: "Workflows", link: "/writing-workflows/", activeMatch: "^/writing-workflows/(?!examples/)" },
        { text: "Examples", link: "/writing-workflows/examples/", activeMatch: "^/writing-workflows/examples/" },
        { text: "Actions", link: "/step-types/shell", activeMatch: "/(step-types|dagu-actions)/" },
        { text: "Operation", link: "/server-admin/", activeMatch: "/server-admin/" },
        { text: "AI", link: "/mcp/", activeMatch: "/(mcp|features|embedding)/" },
        { text: "llms.txt", link: "https://raw.githubusercontent.com/dagucloud/dagu/main/llms.txt" },
      ],

      sidebar: {
        "/": fullSidebar,
        "/overview/": fullSidebar,
        "/getting-started/": fullSidebar,
        "/mcp/": fullSidebar,
        "/writing-workflows/": fullSidebar,
        "/step-types/": fullSidebar,
        "/dagu-actions/": fullSidebar,
        "/features/": fullSidebar,
        "/embedding/": fullSidebar,
        "/web-ui/": fullSidebar,
        "/server-admin/": fullSidebar,
        "/migration/": fullSidebar,
      },

      socialLinks: [
        { icon: "github", link: "https://github.com/dagucloud/dagu" },
        {
          icon: {
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM8.75 9.5c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25-.56 1.25-1.25 1.25S8.75 10.19 8.75 9.5zm7.25 0c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25-.56 1.25-1.25 1.25-1.25-.56-1.25-1.25zm-8 4c0 2.21 1.79 4 4 4s4-1.79 4-4h-8z"/></svg>',
          },
          link: "https://bsky.app/profile/dagu-sh.bsky.social",
          ariaLabel: "Bluesky",
        },
      ],

      footer: {
        message: "Released under the MIT License.",
        copyright: "Copyright © 2024 Dagu Contributors",
      },

      search: {
        provider: "local",
      },

      editLink: {
        pattern: "https://github.com/dagucloud/docs/edit/main/:path",
        text: "Edit this page on GitHub",
      },

      lastUpdated: {
        text: "Last updated",
        formatOptions: {
          dateStyle: "medium",
          timeStyle: "short",
        },
      },
    },

    markdown: {
      // Code is an ink panel in both modes — same warm token set on an
      // ink background, so light mode renders dark code blocks too.
      theme: {
        light: kilnCodeTheme,
        dark: kilnCodeTheme,
      },
      lineNumbers: true,
      config: (md) => {
        // Add issue links plugin
        md.use(issueLinksPlugin);

        // Add custom link renderer to open external links in new tab
        const defaultLinkRender =
          md.renderer.rules.link_open ||
          function (tokens, idx, options, _env, self) {
            return self.renderToken(tokens, idx, options);
          };

        md.renderer.rules.link_open = function (
          tokens,
          idx,
          options,
          _env,
          self
        ) {
          const token = tokens[idx];
          const hrefIndex = token.attrIndex("href");
          if (hrefIndex >= 0) {
            const href = token.attrs[hrefIndex][1];
            if (
              href &&
              (href.startsWith("http://") || href.startsWith("https://"))
            ) {
              token.attrSet("target", "_blank");
              token.attrSet("rel", "noopener noreferrer");
            }
          }
          return defaultLinkRender(tokens, idx, options, _env, self);
        };
      },
    },

    // Mermaid plugin configuration
    mermaid: {
      theme: "base",
    },
    mermaidPlugin: {
      class: "mermaid my-class", // set additional css classes for parent container
    },
  })
);
