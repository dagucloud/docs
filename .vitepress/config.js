import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { issueLinksPlugin } from "./theme/plugins/issueLinks.js";

// Define the complete sidebar structure
const fullSidebar = [
  {
    text: "Overview",
    items: [
      { text: "What is Dagu?", link: "/overview/" },
      { text: "Architecture", link: "/overview/architecture" },
      { text: "CLI", link: "/overview/cli" },
      { text: "Web UI", link: "/overview/web-ui" },
      { text: "API", link: "/overview/api" },
      { text: "Contributing", link: "/overview/contributing" },
      { text: "Changelog", link: "/overview/changelog" },
    ],
  },
  {
    text: "Getting Started",
    items: [
      { text: "Quickstart", link: "/getting-started/quickstart" },
      { text: "Installation", link: "/getting-started/installation" },
      { text: "Core Concepts", link: "/getting-started/concepts" },
      { text: "CLI Commands", link: "/getting-started/cli" },
      { text: "AI Agent", link: "/getting-started/ai-agent" },
    ],
  },
  {
    text: "Writing Workflows",
    items: [
      { text: "Introduction", link: "/writing-workflows/" },
      { text: "Basics", link: "/writing-workflows/basics" },
      { text: "Parameters", link: "/writing-workflows/parameters" },
      { text: "Environment Variables", link: "/writing-workflows/environment-variables" },
      { text: "Secrets", link: "/writing-workflows/secrets" },
      { text: "Data & Variables", link: "/writing-workflows/data-variables" },
      { text: "Control Flow", link: "/writing-workflows/control-flow" },
      { text: "Scheduling", link: "/writing-workflows/scheduling" },
      { text: "Execution Control", link: "/writing-workflows/execution-control" },
      { text: "Durable Execution", link: "/writing-workflows/durable-execution" },
      { text: "Queue Assignment", link: "/writing-workflows/queues" },
      { text: "Approval Gates", link: "/writing-workflows/approval" },
      { text: "Error Handling", link: "/writing-workflows/error-handling" },
      { text: "Continue On", link: "/writing-workflows/continue-on" },
      { text: "Lifecycle Handlers", link: "/writing-workflows/lifecycle-handlers" },
      { text: "Email Notifications", link: "/writing-workflows/email-notifications" },
      { text: "Step Defaults", link: "/writing-workflows/step-defaults" },
      { text: "Resource Limits", link: "/writing-workflows/resource-limits" },
      { text: "Container", link: "/writing-workflows/container" },
      { text: "Data Flow", link: "/writing-workflows/data-flow" },
      { text: "DAG Run Outputs", link: "/writing-workflows/outputs" },
      { text: "Tags", link: "/writing-workflows/tags" },
      { text: "Examples", link: "/writing-workflows/examples/" },
      { text: "YAML Specification", link: "/writing-workflows/yaml-specification" },
      { text: "Template Variables", link: "/writing-workflows/template-variables" },
      { text: "Runtime Variables", link: "/writing-workflows/runtime-variables" },
    ],
  },
  {
    text: "Step Types",
    items: [
      { text: "Shell", link: "/step-types/shell" },
      { text: "Shell (macOS / Linux)", link: "/step-types/shell-unix" },
      { text: "Shell (Windows)", link: "/step-types/shell-windows" },
      { text: "Docker", link: "/step-types/docker" },
      { text: "HTTP", link: "/step-types/http" },
      { text: "SSH", link: "/step-types/ssh" },
      { text: "SFTP", link: "/step-types/sftp" },
      { text: "Router", link: "/step-types/router" },
      { text: "Mail", link: "/step-types/mail" },
      { text: "JQ", link: "/step-types/jq" },
      { text: "Template", link: "/step-types/template" },
      { text: "S3", link: "/step-types/s3" },
      { text: "Redis", link: "/step-types/redis" },
      { text: "Archive", link: "/step-types/archive" },
      { text: "GitHub Actions", link: "/step-types/github-actions" },
      {
        text: "SQL",
        collapsed: false,
        items: [
          { text: "Overview", link: "/step-types/sql/" },
          { text: "PostgreSQL", link: "/step-types/sql/postgresql" },
          { text: "SQLite", link: "/step-types/sql/sqlite" },
        ],
      },
    ],
  },
  {
    text: "AI Agent",
    items: [
      { text: "Overview", link: "/features/agent/" },
      { text: "Settings", link: "/features/agent/settings" },
      { text: "Agent Step", link: "/features/agent/step" },
      { text: "Tools Reference", link: "/features/agent/tools" },
      { text: "Memory", link: "/features/agent/memory" },
      { text: "Souls", link: "/features/agent/souls" },
      { text: "Scheduling", link: "/features/agent/scheduling" },
      { text: "Nesting", link: "/features/agent/nesting" },
      {
        text: "Workflow Operator",
        collapsed: false,
        items: [
          { text: "Overview", link: "/features/bots/" },
          { text: "Telegram", link: "/features/bots/telegram" },
          { text: "Slack", link: "/features/bots/slack" },
        ],
      },
    ],
  },
  {
    text: "Chat & LLM",
    items: [
      { text: "Overview", link: "/features/chat/" },
      { text: "Basic Chat", link: "/features/chat/basics" },
      { text: "Local AI", link: "/features/chat/local-ai" },
      { text: "Tool Calling", link: "/features/chat/tool-calling" },
    ],
  },
  {
    text: "Web UI & Tools",
    items: [
      { text: "Cockpit", link: "/web-ui/cockpit" },
      { text: "Workspaces", link: "/web-ui/workspaces" },
      { text: "Documents", link: "/web-ui/documents" },
      { text: "REST API", link: "/web-ui/api" },
    ],
  },
  {
    text: "Server Administration",
    items: [
      { text: "Overview", link: "/server-admin/" },
      { text: "Server Configuration", link: "/server-admin/server" },
      { text: "Base Configuration", link: "/server-admin/base-config" },
      { text: "Reference", link: "/server-admin/reference" },
      { text: "Operations", link: "/server-admin/operations" },
      { text: "Queue Configuration", link: "/server-admin/queues" },
      {
        text: "Authentication",
        collapsed: false,
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
          { text: "OIDC - Keycloak", link: "/server-admin/authentication/oidc-keycloak" },
          { text: "TLS/HTTPS", link: "/server-admin/authentication/tls" },
          { text: "Remote Nodes", link: "/server-admin/authentication/remote-nodes" },
        ],
      },
      { text: "Prometheus Metrics", link: "/server-admin/prometheus-metrics" },
      { text: "OpenTelemetry", link: "/server-admin/opentelemetry" },
      { text: "Git Sync", link: "/server-admin/git-sync" },
      { text: "Remote Nodes", link: "/server-admin/remote-nodes" },
      { text: "Tunnel (Tailscale)", link: "/server-admin/tunnel" },
      {
        text: "Distributed Execution",
        collapsed: false,
        items: [
          { text: "Overview", link: "/server-admin/distributed/" },
          {
            text: "Workers",
            collapsed: false,
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
        text: "Deployment",
        collapsed: false,
        items: [
          { text: "Overview", link: "/server-admin/deployment/" },
          { text: "macOS Service", link: "/server-admin/deployment/macos" },
          { text: "Linux Systemd", link: "/server-admin/deployment/systemd" },
          { text: "Docker Images", link: "/server-admin/deployment/docker-images" },
          { text: "Docker", link: "/server-admin/deployment/docker" },
          { text: "Docker Compose", link: "/server-admin/deployment/docker-compose" },
          { text: "Kubernetes (Helm)", link: "/server-admin/deployment/kubernetes" },
        ],
      },
      { text: "Self-Upgrade", link: "/server-admin/self-upgrade" },
    ],
  },
  {
    text: "Migration",
    items: [
      { text: "From Cron", link: "/migration/from-cron" },
    ],
  },
];

export default withMermaid(
  defineConfig({
    title: "Dagu",
    description: "Local-first CLI and AI-agent orchestration that runs anywhere. Declarative YAML, single binary, air-gapped ready.",
    lang: "en-US",
    lastUpdated: true,
    cleanUrls: true,
    srcExclude: ["feature-request-*.md"],

    head: [
      [
        "meta",
        {
          name: "description",
          content: "Local-first CLI and AI-agent orchestration that runs anywhere. Declarative YAML, single binary, air-gapped ready.",
        },
      ],
      [
        "meta",
        {
          property: "og:description",
          content: "Local-first CLI and AI-agent orchestration that runs anywhere. Declarative YAML, single binary, air-gapped ready.",
        },
      ],
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
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
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
      logo: "/logo.webp",
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
        { text: "Home", link: "/" },
        { text: "Overview", link: "/overview/", activeMatch: "/overview/" },
        { text: "Quickstart", link: "/getting-started/quickstart", activeMatch: "/getting-started" },
        { text: "Writing Workflows", link: "/writing-workflows/", activeMatch: "/writing-workflows/" },
        { text: "Step Types", link: "/step-types/shell", activeMatch: "/step-types/" },
        { text: "AI Agent", link: "/features/agent/", activeMatch: "/features/agent/" },
        { text: "Server Admin", link: "/server-admin/", activeMatch: "/server-admin/" },
      ],

      sidebar: {
        "/": fullSidebar,
        "/overview/": fullSidebar,
        "/getting-started/": fullSidebar,
        "/writing-workflows/": fullSidebar,
        "/step-types/": fullSidebar,
        "/features/": fullSidebar,
        "/web-ui/": fullSidebar,
        "/server-admin/": fullSidebar,
        "/migration/": fullSidebar,
      },

      socialLinks: [
        { icon: "github", link: "https://github.com/dagu-org/dagu" },
        {
          icon: {
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM8.75 9.5c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25-.56 1.25-1.25 1.25S8.75 10.19 8.75 9.5zm7.25 0c0-.69.56-1.25 1.25-1.25s1.25.56 1.25 1.25-.56 1.25-1.25 1.25-1.25-.56-1.25-1.25zm-8 4c0 2.21 1.79 4 4 4s4-1.79 4-4h-8z"/></svg>',
          },
          link: "https://bsky.app/profile/dagu-org.bsky.social",
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
        pattern: "https://github.com/dagu-org/docs/edit/main/:path",
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
      theme: {
        light: "github-light",
        dark: "github-dark",
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
      darkMode: false,
      themeVariables: {
        primaryColor: "#25b3c0",
        primaryTextColor: "#333",
        primaryBorderColor: "#0085a3",
        lineColor: "#666",
        secondaryColor: "#f3f3f3",
        tertiaryColor: "#eee",
        background: "#ffffff",
        mainBkg: "#ffffff",
        secondaryBkg: "#f8f9fa",
        tertiaryBkg: "#ffffff",
        secondaryBorderColor: "#ccc",
        tertiaryBorderColor: "#ccc",
        secondaryTextColor: "#333",
        tertiaryTextColor: "#333",
        textColor: "#333",
        taskBkgColor: "#ffffff",
        taskTextColor: "#333",
        taskTextLightColor: "#333",
        taskTextOutsideColor: "#333",
        taskTextClickableColor: "#333",
        activeTaskBkgColor: "#f0f0f0",
        activeTaskBorderColor: "#0085a3",
        gridColor: "#e1e5e9",
        section0: "#ffffff",
        section1: "#f8f9fa",
        section2: "#ffffff",
        section3: "#f8f9fa",
        altBackground: "#f8f9fa",
        altBackgroundSecondary: "#ffffff",
        fillType0: "#ffffff",
        fillType1: "#f8f9fa",
        fillType2: "#ffffff",
        fillType3: "#f8f9fa",
        fillType4: "#ffffff",
        fillType5: "#f8f9fa",
        fillType6: "#ffffff",
        fillType7: "#f8f9fa",
      },
    },
    mermaidPlugin: {
      class: "mermaid my-class", // set additional css classes for parent container
    },
  })
);
