import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { issueLinksPlugin } from "./theme/plugins/issueLinks.js";

// Define the complete sidebar structure
const fullSidebar = [
  {
    text: "Overview",
    items: [
      { text: "What is Dagu?", link: "/overview/" },
      { text: "Contributing", link: "/overview/contributing" },
      { text: "Architecture", link: "/overview/architecture" },
      { text: "CLI", link: "/overview/cli" },
      { text: "Web UI", link: "/overview/web-ui" },
      { text: "API", link: "/overview/api" },
      { text: "Changelog", link: "/reference/changelog" },
    ],
  },
  {
    text: "Getting Started",
    items: [
      { text: "Quickstart", link: "/getting-started/quickstart" },
      { text: "Installation", link: "/getting-started/installation" },
      { text: "Core Concepts", link: "/getting-started/concepts" },
    ],
  },
  {
    text: "Migration",
    items: [
      { text: "From Cron", link: "/features/exec" },
    ],
  },
  {
    text: "Writing Workflows",
    items: [
      { text: "Introduction", link: "/writing-workflows/" },
      { text: "Basics", link: "/writing-workflows/basics" },
      { text: "Container", link: "/writing-workflows/container" },
      { text: "Examples", link: "/writing-workflows/examples/" },
      { text: "Parameters", link: "/writing-workflows/parameters" },
      { text: "Control Flow", link: "/writing-workflows/control-flow" },
      { text: "Data & Variables", link: "/writing-workflows/data-variables" },
      {
        text: "Environment Variables",
        link: "/writing-workflows/environment-variables",
      },
      { text: "Secrets", link: "/writing-workflows/secrets" },
      { text: "Resource Limits", link: "/writing-workflows/resource-limits" },
      {
        text: "Lifecycle Handlers",
        link: "/writing-workflows/lifecycle-handlers",
      },
      { text: "Error Handling", link: "/writing-workflows/error-handling" },
    ],
  },
  {
    text: "Features",
    items: [
      { text: "Overview", link: "/features/" },
      {
        text: "Step Types",
        collapsed: false,
        items: [
          { text: "Shell", link: "/features/executors/shell" },
          { text: "Shell (macOS / Linux)", link: "/features/executors/shell-unix" },
          { text: "Shell (Windows)", link: "/features/executors/shell-windows" },
          { text: "Router", link: "/features/executors/router" },
          { text: "Docker", link: "/features/executors/docker" },
          { text: "SSH", link: "/features/executors/ssh" },
          { text: "SFTP", link: "/features/executors/sftp" },
          { text: "S3", link: "/features/executors/s3" },
          { text: "HTTP", link: "/features/executors/http" },
          { text: "Archive", link: "/features/executors/archive" },
          { text: "Mail", link: "/features/executors/mail" },
          { text: "JQ", link: "/features/executors/jq" },
          { text: "Redis", link: "/features/executors/redis" },
          { text: "HITL (Human in the Loop)", link: "/features/executors/hitl" },
          {
            text: "GitHub Actions",
            link: "/features/executors/github-actions",
          },
        ],
      },
      {
        text: "ETL",
        collapsed: false,
        items: [
          { text: "Overview", link: "/features/etl/" },
          { text: "PostgreSQL", link: "/features/etl/postgresql" },
          { text: "SQLite", link: "/features/etl/sqlite" },
        ],
      },
      {
        text: "Chat & AI Agents",
        collapsed: false,
        items: [
          { text: "Overview", link: "/features/chat/" },
          { text: "Basic Chat", link: "/features/chat/basics" },
          { text: "Tool Calling", link: "/features/chat/tool-calling" },
        ],
      },
      {
        text: "Agent",
        collapsed: false,
        items: [
          { text: "Overview", link: "/features/agent/" },
          { text: "Tools Reference", link: "/features/agent/tools" },
        ],
      },
      { text: "Scheduling", link: "/features/scheduling" },
      { text: "Execution Control", link: "/features/execution-control" },
      { text: "Data Flow", link: "/features/data-flow" },
      { text: "DAG Run Outputs", link: "/features/outputs" },
      { text: "Queue System", link: "/features/queues" },
      { text: "Tags", link: "/features/tags" },
      { text: "Email Notifications", link: "/features/email-notifications" },
      { text: "Prometheus Metrics", link: "/features/prometheus-metrics" },
      { text: "OpenTelemetry", link: "/features/opentelemetry" },
      { text: "Git Sync", link: "/features/git-sync" },
      { text: "Self-Upgrade", link: "/features/upgrade" },
      {
        text: "Distributed Execution",
        collapsed: false,
        items: [
          { text: "Overview", link: "/features/distributed-execution" },
          {
            text: "Workers",
            collapsed: false,
            items: [
              { text: "Overview", link: "/features/workers/" },
              { text: "Shared Filesystem", link: "/features/workers/shared-filesystem" },
              { text: "Shared Nothing", link: "/features/workers/shared-nothing" },
            ],
          },
          { text: "Worker Labels", link: "/features/worker-labels" },
        ],
      },
    ],
  },
  {
    text: "Configurations",
    items: [
      { text: "Overview", link: "/configurations/" },
      { text: "Server Configuration", link: "/configurations/server" },
      { text: "Base Configuration", link: "/configurations/base-config" },
      {
        text: "Authentication",
        collapsed: false,
        items: [
          { text: "Overview", link: "/configurations/authentication" },
          { text: "Builtin Auth (RBAC)", link: "/configurations/authentication/builtin" },
          { text: "API Keys", link: "/configurations/authentication/api-keys" },
          { text: "Webhooks", link: "/configurations/authentication/webhooks" },
          { text: "Basic Auth", link: "/configurations/authentication/basic" },
          { text: "Token Auth", link: "/configurations/authentication/token" },
          { text: "OIDC", link: "/configurations/authentication/oidc" },
          {
            text: "OIDC - Google",
            link: "/configurations/authentication/oidc-google",
          },
          {
            text: "OIDC - Auth0",
            link: "/configurations/authentication/oidc-auth0",
          },
          {
            text: "OIDC - Keycloak",
            link: "/configurations/authentication/oidc-keycloak",
          },
          { text: "TLS/HTTPS", link: "/configurations/authentication/tls" },
          {
            text: "Remote Nodes",
            link: "/configurations/authentication/remote-nodes",
          },
        ],
      },
      {
        text: "Deployment",
        collapsed: false,
        items: [
          { text: "Overview", link: "/configurations/deployment" },
          { text: "macOS Service", link: "/configurations/deployment/macos" },
          { text: "Linux Systemd", link: "/configurations/deployment/systemd" },
          { text: "Docker Images", link: "/configurations/deployment/docker-images" },
          { text: "Docker", link: "/configurations/deployment/docker" },
          {
            text: "Docker Compose",
            link: "/configurations/deployment/docker-compose",
          },
        ],
      },
      { text: "Operations", link: "/configurations/operations" },
      { text: "Remote Nodes", link: "/configurations/remote-nodes" },
      { text: "Tunnel (Tailscale)", link: "/configurations/tunnel" },
      { text: "Reference", link: "/configurations/reference" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "CLI Commands", link: "/reference/cli" },
      { text: "YAML Specification", link: "/reference/yaml" },
      { text: "REST API", link: "/reference/api" },
      { text: "Configuration", link: "/reference/config" },
      { text: "Variables", link: "/reference/variables" },
      {
        text: "Special Variables",
        link: "/reference/special-environment-variables",
      },
      { text: "Step Types", link: "/reference/executors" },
    ],
  },
];

export default withMermaid(
  defineConfig({
    title: "Dagu",
    description: "Modern workflow orchestration made simple",
    lang: "en-US",
    lastUpdated: true,
    cleanUrls: true,

    head: [
      [
        "meta",
        {
          name: "description",
          content: "A Powerful, Portable, Local-First Workflow Engine",
        },
      ],
      [
        "meta",
        {
          property: "og:description",
          content: "A Powerful, Portable, Local-First Workflow Engine",
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
      logoLink: "https://docs.daguit.dev/",

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
        {
          text: "Quickstart",
          link: "/getting-started/quickstart",
          activeMatch: "/getting-started",
        },
        {
          text: "Writing Workflows",
          link: "/writing-workflows/",
          activeMatch: "/writing-workflows/",
        },
        { text: "Features", link: "/features/", activeMatch: "/features/" },
        {
          text: "Configurations",
          link: "/configurations/",
          activeMatch: "/configurations/",
        },
        {
          text: "Reference",
          link: "/reference/cli",
          activeMatch: "/reference/",
        },
      ],

      sidebar: {
        "/": fullSidebar,
        "/overview/": fullSidebar,
        "/getting-started/": fullSidebar,
        "/writing-workflows/": fullSidebar,
        "/features/": fullSidebar,
        "/configurations/": fullSidebar,
        "/reference/": fullSidebar,
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
        provider: "algolia",
        options: {
          appId: "LCN0T5A9XG",
          apiKey: "5a4999c265d0c05512d852903a1174e1",
          indexName: "docs.daguit.dev",
        },
      },

      editLink: {
        pattern: "https://github.com/dagu-org/dagu/edit/main/docs-next/:path",
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
