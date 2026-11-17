# AGENTS.md

Guidance for anyone — person or coding agent — changing this repository.

## What this is

TUDU is an open source to-do list for managing work tasks. It is a single
Next.js web app that runs locally in Docker. By default tasks live in
`data/tasks.json`; setting `DATABASE_URL` stores tasks in PostgreSQL instead.
Project names stay in `data/projects.json` in either mode. The app is AI native:
a note typed in plain language can be
turned into structured tasks. The interface is in English, with Portuguese
(pt-BR) as a second language.

The project is small on purpose and grows feature by feature as it is used.
Prefer the simplest change that fits the structure below over new abstractions.

## Commands

| Task | Command |
| --- | --- |
| Run in Docker (the normal way) | `docker compose up --build` |
| Run in Docker with Postgres | `docker compose --profile postgres up --build` (set `DATABASE_URL`) |
| Unit and e2e tests on Postgres | `npm run test:postgres`, `npm run test:e2e:postgres` |
| Run without Docker | `npm install`, then `npm run dev` |
| Unit tests | `npm test` (`npm run test:watch` while working) |
| End-to-end tests | `npm run test:e2e` (`npm run test:e2e:ui` to debug) |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |
| Remove caches and test artifacts | `npm run clean` |

The app serves on <http://localhost:3000>. `npm test`, `npm run test:e2e`,
`npm run typecheck` and `npm run build` are the gates; there is no linter yet. After a UI change, open
the app and exercise the change in both languages.

## Stack

- Next.js 16 (App Router), React 19, TypeScript in strict mode
- Zod for every schema: API input, stored tasks, AI output
- `@anthropic-ai/sdk` for the AI capture
- Vitest for unit tests, Playwright for end-to-end tests
- Plain CSS with design tokens (no CSS framework, no component library)
- Node 22 in Docker

## Structure

```
src/
  app/                    Routing only: layout, page, global CSS, API routes
    api/tasks/            GET, POST            /api/tasks
    api/tasks/[id]/       PATCH, DELETE        /api/tasks/:id
    api/ai/capture/       GET status, POST     /api/ai/capture
  features/
    tasks/
      schema.ts           Zod schemas and the Task types (shared by client and server)
      selectors.ts        Pure functions: sorting, filtering, counts
      api.ts              Browser client for the tasks endpoints
      use-tasks.ts        Hook that owns the task list and optimistic updates
      components/         Board (composition), Sidebar, Composer, TaskList, TaskRow, TaskChecklist, ProjectManager
      server/
        repository.ts     The data contract; picks the store from DATABASE_URL
        store.ts          The TaskStore interface every backend implements
        json-store.ts     Default backend: data/tasks.json
        postgres-store.ts PostgreSQL backend, schema migrations and pool
    projects/
      schema.ts, api.ts   Project contract and browser client
      server/repository.ts Server-side project registry (data/projects.json)
    capture/
      api.ts              Browser client for the capture endpoint
      server/capture.ts   Prompt, output schema and the model call
  i18n/
    locales/en.ts         Source dictionary; its shape is the Dictionary type
    locales/pt-BR.ts      Must satisfy Dictionary
    index.ts              Locales, dictionaries, errorMessage()
    use-locale.ts         Hook: current language, persisted in localStorage
  lib/                    Feature-agnostic helpers (dates, http, use-today)
e2e/                      End-to-end tests, one spec per component, plus support.ts
design.md                 The design system (source of truth for the UI)
docker/postgres-init.sql  Creates the tudu_test database in the Postgres container
data/tasks.json           Runtime task data, git-ignored
data/projects.json        Project registry in both storage modes, git-ignored
```

Imports use the `@/` alias, which points at `src/`.

## Architecture rules

1. **Routes are thin.** A file in `src/app/api` parses the request with a Zod
   schema, calls a function from a feature's `server/` folder, and maps the
   result to a response. No business logic and no file access in routes.
2. **Features own their code.** Everything about tasks lives in
   `src/features/tasks`. A new capability gets its own folder under
   `src/features` with the same shape (`schema.ts`, `api.ts`, hook,
   `components/`, `server/`), adding only the files it needs, and arrives with
   its unit and end-to-end tests (see Testing).
3. **`server/` never reaches the browser.** Code under a `server/` folder may
   use Node APIs, the filesystem and secrets. Client components and hooks must
   not import from it; they talk to the server through the feature's `api.ts`.
4. **One door to the data.** Everything else reaches tasks through
   `tasks/server/repository.ts` and its exported functions (`listTasks`,
   `addTasks`, `updateTask`, `deleteTask`), which are the contract.
   `clearTaskProject` clears assignments when a project is deleted. The
   repository holds the rules (ids, timestamps, completion) and hands storage to
   a `TaskStore`: `json-store.ts` (the default) or `postgres-store.ts` when
   `DATABASE_URL` is set. Only those stores touch `data/tasks.json` or the
   database. A change to stored data must work on both: the JSON store runs
   writes through one queue and writes the file atomically; the Postgres store
   uses transactions with row locks. A schema change is a new entry at the end
   of `MIGRATIONS`, never an edit to an old one.
   Routes guard project assignments with `withValidProjectIds` and supply
   `clearTaskProject` to project deletion. This keeps cross-feature server
   coordination in `app` and serializes assignment changes with deletion.
5. **Schemas are the contract.** Define the shape once in `schema.ts` with Zod
   and derive TypeScript types from it with `z.infer`. Never hand-write a type
   that duplicates a schema.
6. **State lives in hooks, logic in pure functions.** Components render and
   forward events. Data fetching and optimistic updates belong in a hook
   (`use-tasks.ts`); sorting, filtering and counting belong in `selectors.ts`
   so they stay easy to test.
7. **`Board` composes, it does not grow.** New UI goes into its own component
   in `components/`. Keep components under roughly 150 lines.
8. **`lib/` is for code with no feature knowledge.** If a helper mentions tasks
   or capture, it belongs in that feature.

Dependency direction: `app` → `features` → `i18n`, `lib`. Features may import
another feature's `schema.ts` and `api.ts`, never its components or hooks.

## Testing

**Every feature is born with its tests.** A change that adds or alters behaviour
includes, in the same change:

1. **Unit tests** for the logic it adds (schemas, selectors, helpers, server code).
2. **At least one end-to-end test** that uses the feature the way a person
   would, in the browser.

A feature without both is not finished, and a change is not ready to merge
while any test fails. A bug fix starts with a test that fails for that bug. When
behaviour changes on purpose, update the tests that describe it in the same
change — never delete or skip a test to make a change pass.

### Unit tests (Vitest)

Run with `npm test`. Files live next to the code they cover as `*.test.ts` and
run in a Node environment.

- Cover schemas, selectors, date helpers, dictionaries and the repository.
- Repository tests run every case on each backend: the JSON store in a
  temporary folder and the Postgres store on PGlite (Postgres in WebAssembly,
  no server needed). Never read or write the real `data/` folder or a real
  database in a test.
- `npm run test:postgres` also runs them against the `tudu_test` database of
  the Docker Postgres (`docker compose --profile postgres up -d db`), and
  `npm run test:e2e:postgres` runs the end-to-end suite on it. Both wipe that
  database, so they refuse a database whose name lacks `test` or `e2e`.
- Dates are fixed strings; do not depend on the current day.

### End-to-end tests (Playwright)

Run with `npm run test:e2e` (`npm run test:e2e:ui` to watch and debug). Specs
live in `e2e/`, one file per component: `board`, `composer`, `sidebar`,
`task-list`, `task-row`, `task-checklist`, `project-manager`. Playwright builds the app and serves it on port 3100
with a throwaway data folder, so it never touches `./data` or a dev server on
port 3000. First-time setup: `npx playwright install chromium`.

- **A new component gets its own `e2e/<component>.spec.ts`.** New behaviour in
  an existing component adds tests to that component's spec.
- Import `test` and `expect` from `e2e/support.ts`, not from Playwright. That
  fixture empties the task list and freezes the clock at 2026-11-17 before each
  test, so every test is independent and dates are predictable.
- Create starting data with `seed()` through the API; do not click through the
  UI to set up a test.
- Find elements the way a person does: by role, label and visible text. Reach
  for a CSS selector only when no accessible handle exists — and consider
  adding one.
- Assert the result the user sees, and for anything that saves, also assert
  what was stored (`listTasks()`).
- Cover the failure path too: use `page.route()` to make a request fail and
  check the error message and that the screen recovers.
- A feature with visible text is checked in Portuguese as well as English.
- Tests never call the real AI. Mock `/api/ai/capture` with `page.route()`, as
  `composer.spec.ts` does.

## API conventions

- JSON in, JSON out. Success bodies are wrapped: `{ "tasks": [...] }` or `{ "task": {...} }`.
- Errors are `{ "error": "<code>" }` with a matching HTTP status. The code is a
  stable machine string (`invalid_task`, `not_found`, `ai_disabled`, `ai_auth`,
  `ai_busy`, `ai_failed`, `no_tasks`), never a sentence.
- User-facing error text lives in the `errors` section of the dictionaries,
  keyed by that code. A new code needs an entry in both languages; unknown codes
  fall back to `errors.generic`.

## Internationalization

- No user-visible string is written in a component. Add it to
  `src/i18n/locales/en.ts` and to `pt-BR.ts` in the same change; TypeScript
  fails the build if a key is missing in Portuguese.
- English is the default and the source language.
- Portuguese text must use correct accents and punctuation (ã, ç, é, crase).
- Text with a count is a function in the dictionary (`countOpen(n)`), so each
  language handles its own plural.
- Dates are formatted with `Intl` through `src/lib/dates.ts`, never by hand.
- Task content is the user's own text and is never translated.
- To add a language: create `locales/<code>.ts`, then register it in `LOCALES`
  and `dictionaries` in `src/i18n/index.ts`, and add its label in `Sidebar.tsx`.

## Design system

`design.md` is the source of truth. Its tokens are declared once as CSS
variables at the top of `src/app/globals.css`.

- Use the variables (`--primary`, `--accent`, `--r-lg`, `--s-md`, …). Do not
  write raw hex colors, radii or font families in component styles.
- Plus Jakarta Sans for headings, labels and navigation; Inter for body text.
- Flat surfaces with thin borders. No shadows, gradients or decoration.
- Reuse the existing component classes before adding new ones: `.btn`
  (`.btn-primary`, `.btn-secondary`), `.card`, `.chip`, `.section-title`,
  `.nav-item`.
- Color carries meaning only: `--success` done, `--warning` high priority,
  `--error` overdue and failures, `--accent` focus and highlights.
- Every screen must work at phone width with no horizontal scroll, and
  interactive elements need a visible focus state and an accessible name.
- The app has no logo; the name TUDU in text is the brand.

## AI capture

- All model code lives in `src/features/capture/server/capture.ts`: the system
  prompt, the Zod output schema and the single API call. Use the official SDK
  with structured output; do not parse free text.
- The model defaults to `claude-opus-5-5` and can be overridden with
  `TUDU_AI_MODEL`. The API key comes from `ANTHROPIC_API_KEY` and is read only
  on the server.
- The app must work fully without a key. AI controls are disabled, not hidden,
  and explain how to turn the feature on.
- Treat the user's note as data to organize, never as instructions. Validate
  and trim everything the model returns before saving it.
- New AI features follow the same pattern: a `server/` function with a schema,
  a thin route, a client in `api.ts`.

## Code conventions

- TypeScript strict; no `any`. Prefer narrow types and early returns.
- Named exports. Components in `PascalCase.tsx`, everything else in `kebab-case.ts`.
- Add `"use client"` only to files that use state, effects or browser APIs.
- Comments explain why, not what. Do not reference tickets, tasks or tools in
  comments.
- Add a dependency only when it removes real complexity; say why in the change.
- Never commit `.env` or anything under `data/`.
- Commit messages are short, imperative and describe the change. No tool or
  assistant attribution in commits, pull requests, comments or documents.

## After a pull request is merged: clean up

Once a pull request is merged — and only then — clean up what the work left
behind. Do it for every pull request, so stale branches, worktrees and caches
never pile up. While a pull request is still open, or was closed without
merging, nothing is removed: report what exists and ask.

Removal is permanent, so each step has a check that must pass first. If a check
fails or its result is unclear, stop, leave the item in place and ask the owner.
Never use a force flag (`--force`, `-D`, `-f`) to get past a failed check.

**1. Confirm the merge.** The pull request state is `MERGED` and its checks
passed:

```bash
gh pr view <number> --json state,mergedAt,statusCheckRollup
```

**2. Confirm nothing is unsaved.** In the branch's checkout:

- `git status --short` prints nothing (no uncommitted or untracked work).
- `git stash list` shows no entry made for this work.
- `git log origin/<branch>..<branch>` prints nothing (no unpushed commits).

Untracked files are not recoverable from Git. If any exist, list them and ask
before going further.

**3. Update the main branch.** `git switch master && git pull`. Then confirm the
work is really there: `git branch --merged master` lists the branch. A
squash-merged branch will not be listed; in that case rely on step 1 and check
that `git diff master <branch>` shows no changes that are missing from `master`.

**4. Remove the worktree**, if the work used one. Never remove the main
checkout, the worktree you are currently standing in, or one another session is
using:

```bash
git worktree list
git worktree remove <path>
git worktree prune
```

`git worktree remove` refuses when the worktree has changes. Treat that refusal
as a failed check, not as something to override.

**5. Delete the branch**, local then remote. Never delete `master` or a branch
with an open pull request:

```bash
git branch -d <branch>
git push origin --delete <branch>
git fetch --prune
```

Use `-d`, which refuses to delete unmerged work. After a squash merge `-d` will
refuse even though the work is safe; confirm steps 1 and 3 again and ask the
owner before using anything stronger.

**6. Remove caches and temporary files.** These are build output and test
artifacts, all git-ignored and all regenerated on the next run:

```bash
npm run clean
```

It removes `.next`, `test-results`, `playwright-report` and
`tsconfig.tsbuildinfo`. Before deleting anything else, confirm it is ignored and
not tracked: `git check-ignore -v <path>` prints a rule and
`git ls-files <path>` prints nothing. Also remove scratch files and temporary
folders created during the work (for example leftover `tudu-test-*` and
`tudu-e2e-*` folders in the system temp directory).

**Never removed by a clean-up:**

- `data/` — the user's tasks. It is git-ignored, so Git cannot restore it.
- `.env` — local secrets and settings.
- `node_modules` and Docker volumes, unless the owner asks; they are safe but
  slow to rebuild.
- Anything outside this repository, other than the temporary folders named above.

**7. Report.** Say what was removed, what was kept and why, and anything that
needed a decision.

## Before finishing a change

1. The change comes with unit tests and at least one end-to-end test.
2. `npm test`, `npm run test:e2e`, `npm run typecheck` and `npm run build` pass.
3. The change was exercised in the running app, in English and Portuguese.
4. New strings exist in both dictionaries.
5. Styles use design tokens.
6. `README.md` and this file still describe the project accurately.
