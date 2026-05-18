# Dagu Documentation

This repository contains the VitePress site that powers the Dagu documentation. It includes guides, references, and workflow authoring tutorials for Dagu users.

## Prerequisites
- Node.js 20 or newer
- pnpm 9 or newer

## Install
```bash
pnpm install
```

## Local Development
```bash
pnpm dev
```
This launches VitePress at `http://localhost:5173` with hot-reload enabled.

## Building & Previewing
```bash
pnpm build
pnpm preview
```
`pnpm build` generates the static site into `.vitepress/dist`, and `pnpm preview` serves the built assets locally for final checks.

## Directory Overview
- `index.md` — landing page for the documentation.
- `overview/` — high-level concepts, CLI, API, and project references.
- `getting-started/` — onboarding material for new Dagu users.
- `features/` — feature-focused guides.
- `writing-workflows/` — authoring workflows and best practices.
- `step-types/` — built-in step type references.
- `web-ui/` — Cockpit, workspace, documents, and REST API guides.
- `server-admin/` — server configuration, operations, authentication, and deployment guides.
- `github-integration/` — GitHub integration setup and examples.
- `embedding/` — embedded Dagu API and licensing notes.
- `migration/` — migration guides from other schedulers.
- `public/` — static assets served by VitePress.

Mermaid diagrams are supported via `vitepress-plugin-mermaid`; author diagrams by using fenced code blocks with the `mermaid` language tag.

## Contributing
1. Fork or branch from `main`.
2. Make documentation updates in Markdown (MDX is not enabled).
3. Run `pnpm build` to ensure the site still compiles before opening a pull request.
