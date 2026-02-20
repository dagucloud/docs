# Dagu Documentation

This repository contains the VitePress site that powers the Dagu documentation. It includes guides, references, and workflow authoring tutorials for Dagu users.

## Prerequisites
- Node.js 18 or newer
- pnpm 8 or newer

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
- `getting-started/` — onboarding material for new Dagu users.
- `features/` — feature-focused guides.
- `reference/` — API and configuration references.
- `writing-workflows/` — authoring workflows and best practices.
- `public/` — static assets served by VitePress.

Mermaid diagrams are supported via `vitepress-plugin-mermaid`; author diagrams by using fenced code blocks with the `mermaid` language tag.

## Contributing
1. Fork or branch from `main`.
2. Make documentation updates in Markdown (MDX is not enabled).
3. Run `pnpm build` to ensure the site still compiles before opening a pull request.
