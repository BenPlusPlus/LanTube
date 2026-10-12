# LanTube Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
pnpm i
pnpm dev
pnpm hmr
pnpm start
pnpm test
pnpm typecheck
```

Use `pnpm hmr` for live server and browser updates; `pnpm dev` only watches and restarts the server. `pnpm start` runs in production mode without a separate build step.

## Building Features

Refer to ./.agents/skills/remix/SKILL.md for the Remix mental model and how to find guides and API READMEs through `node_modules/remix/INDEX.md`.

## Starter Layout

- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs
- `app/router.ts` wires routes to controllers and installs the standard Remix component renderer used by actions
- Put top-level route actions in `app/actions/controller.tsx`; add `app/actions/<route-key>/controller.tsx` for nested route maps. `app/actions/controller.test.ts` is the root controller's router smoke test
- `app/actions/home-page.tsx` and `app/actions/document.tsx` render the route-owned starter UI
- `app/actions/public/` contains the browser runtime entry and interactive prompt button
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and render middleware
- Root `public/` contains static files served unchanged from the app root

This starter intentionally begins small; add directories like `app/data/`, `app/middleware/`, `app/ui/`, and `test/` only when you need them.

## Special Instructions

### Test writing
- When writing automated tests, do not create any tautological tests. Ensure unit and end-to-end tests meaningfully verify application logic or component interoperability.
- Do not write tests for connections to entities or services external to the app (database connections, third party APIs, etc.).

### When committing
- If you are going to commit changes, never do so on the default (main or master) branch; if the default branch is the current branch, make a new one named in a way relevant to your work.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for BenPlusPlus/LanTube. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles map 1:1 to `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

single-context: glossary in `CONTEXT.md`, ADRs in `docs/adr/`. See `docs/agents/domain.md`.

