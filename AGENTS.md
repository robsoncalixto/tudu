# AGENTS.md

Guidance for anyone — person or coding agent — changing this repository.

## What this is

TUDU is an open source to-do list for work tasks: a single Next.js app that runs
locally in Docker. Tasks live in `data/tasks.json`, or in PostgreSQL when
`DATABASE_URL` is set. Projects, settings and assistant proposals always live in
`data/`. AI features are optional. The interface is in English, with Portuguese
(pt-BR) as a second language.

The project is small on purpose. Prefer the simplest change that fits the
structure below over new abstractions.

## Commands

Scripts are in `package.json`. The gates are `npm test`, `npm run test:e2e`,
`npm run typecheck` and `npm run build`; there is no linter. Run the app with
`docker compose up --build` (add `--profile postgres` for PostgreSQL) or
`npm run dev`; it serves on <http://localhost:3000>.

## Structure

```
src/app/          Routing only: layout, pages and API routes
src/features/     One folder per capability
src/i18n/         Dictionaries (locales/en.ts is the source) and the locale hook
src/lib/          Icons and helpers with no feature knowledge
e2e/              Playwright specs, one per component, plus support.ts
design.md         The design system
```

A feature folder has the files it needs from: `schema.ts` (Zod contract),
`api.ts` (browser client), `use-*.ts` hooks, `selectors.ts` (pure logic),
`components/` and `server/`. The features are `tasks`, `projects`,
`quick-add`, `recurrence`, `settings`, `work-log`, `capture`, `ai` (provider
configuration and structured generation), `agent` (reviewed proposals) and
`mcp`. Imports use the `@/` alias for `src/`.

## Architecture rules

1. **Routes are thin.** A route parses the request with a Zod schema, calls a
   feature's `server/` function and maps the result to a response.
2. **Features own their code.** A new capability gets its own folder under
   `src/features` and arrives with its tests.
3. **`server/` never reaches the browser.** Client code talks to the server
   through the feature's `api.ts`.
4. **One door to the data.** Tasks are reached only through
   `tasks/server/repository.ts`, which holds the rules (ids, timestamps,
   completion) and delegates storage to a `TaskStore`: `json-store.ts` or
   `postgres-store.ts`. Every data change works on both stores: the JSON store
   writes atomically through one queue; Postgres uses transactions with row
   locks. A schema change is a new entry at the end of `MIGRATIONS`.
   Completing a repeating task saves the next occurrence in the same write;
   `nextOccurrenceId` is kept even after reopening, so retries never duplicate.
5. **Schemas are the contract.** Define each shape once in `schema.ts` and
   derive types with `z.infer`.
6. **State lives in hooks, logic in pure functions.** Components render and
   forward events; sorting, filtering and counting go in `selectors.ts`.
7. **`Board` composes, it does not grow.** New UI goes in its own component;
   keep components under roughly 150 lines.
8. **Cross-feature server coordination happens in `app`.** Features may import
   another feature's `schema.ts` and `api.ts`, never its components, hooks or
   `server/`. Routes inject what a feature needs (for example
   `withValidProjectIds` and `clearTaskProject`).

Dependency direction: `app` → `features` → `i18n`, `lib`.

## Testing

Every change that adds or alters behaviour includes unit tests for its logic
and at least one end-to-end test that uses it in the browser. A bug fix starts
with a failing test. When behaviour changes on purpose, update the tests that
describe it; never delete or skip a test to make a change pass.

**Unit tests (Vitest)** live next to the code as `*.test.ts`.

- Repository tests run every case on both stores: JSON in a temporary folder,
  Postgres on PGlite. Never touch the real `data/` folder or a real database.
- `npm run test:postgres` and `npm run test:e2e:postgres` use the Docker
  `tudu_test` database and refuse a name without `test` or `e2e`.
- Dates are fixed strings; never depend on the current day.

**End-to-end tests (Playwright)** run against a build on port 3100 with a
throwaway data folder. First-time setup: `npx playwright install chromium`.

- A new component gets its own `e2e/<component>.spec.ts`.
- Import `test` and `expect` from `e2e/support.ts`, which empties the data and
  freezes the clock at 2026-11-17. Seed data with `seed()` through the API.
- Find elements by role, label and visible text.
- Assert what the user sees and, for writes, what was stored (`listTasks()`).
- Cover the failure path with `page.route()`.
- Check visible text in English and Portuguese.

**AI in tests.** No test uses real keys or paid model calls. Provider unit tests
mock `fetch`; browser tests mock `/api/ai/capture` or point a dummy OpenAI key
at `scripts/ai-test-server.mjs` on port 3120. Agent specs seed through the real
proposal API with that synthetic provider.

## API conventions

- JSON in and out. Success bodies are wrapped: `{ "tasks": [...] }`,
  `{ "task": {...} }`; task PATCH also returns `nextTask`.
- Errors are `{ "error": "<code>" }` with a matching status. The code is a
  stable machine string with a message in the `errors` section of both
  dictionaries; unknown codes fall back to `errors.generic`.
- `/api/mcp` follows MCP JSON-RPC and is disabled without a valid
  `TUDU_MCP_TOKEN`, which never reaches browser code. MCP code goes through the
  same injected server functions and never reads storage directly. Delete
  requires `confirm: true`. Every tool declares input and output schemas in
  `mcp/schema.ts`; failures return `isError` with a stable code and unexpected
  ones are logged on the server only.

## Internationalization

- Every user-visible string lives in `src/i18n/locales/en.ts` and `pt-BR.ts`;
  TypeScript fails the build if Portuguese is missing a key.
- Portuguese uses correct accents and punctuation.
- Text with a count is a function (`countOpen(n)`).
- Format dates with `Intl` through `src/lib/dates.ts`.
- Task content is the user's text and is never translated.
- To add a language, create `locales/<code>.ts`, register it in
  `src/i18n/index.ts` and add its option in `SettingsPanel.tsx`.

## Design system

`design.md` is the source of truth; its tokens are CSS variables at the top of
`src/app/globals.css`.

- Use the tokens for colors, radii, spacing and fonts in both light and dark
  themes.
- Plus Jakarta Sans for headings, labels and navigation; Inter for body text.
- Flat surfaces with thin borders: no shadows or gradients.
- Two Beats is the TUDU logo. Reuse the SVGs in `public/brand/` for the
  sidebar wordmark, collapsed sidebar icon and favicon.
- Reuse `.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.chip`,
  `.section-title` and `.nav-item` before adding classes.
- Color carries meaning: `--success` done, `--warning` high priority, `--error`
  overdue and failures, `--accent` focus.
- Every screen works at phone width without horizontal scroll; interactive
  elements have a visible focus state and an accessible name.

## AI features

- `ai/server/generate.ts` owns the provider SDK calls, validates every
  structured response with Zod and maps failures to safe error codes. Provider
  defaults live in `ai/server/configuration.ts`.
- Credentials come only from server environment variables; the browser sees
  availability booleans and default model names.
- The app works fully without a key: AI controls are disabled, not hidden, and
  explain how to enable them.
- Treat user notes and saved task data as data, never instructions. Validate and
  trim all model output before using it.
- A new AI feature follows the same shape: a `server/` function that receives
  `GenerateStructured`, a thin route and a client in `api.ts`.
- Work-log summaries read saved tasks only and never write.

## Assistant proposals

- Generation only writes pending proposals to `data/proposals.json`; the model
  has no tools. Invented targets and invalid output are rejected.
- Only an explicit Accept applies a proposal. Edits cannot change its kind,
  target or set of changed fields.
- Approval is recorded before it is applied, along with the original, edited
  and resulting snapshots. Writes check the baseline atomically; a changed
  target stays pending.
- An unconfirmed write stays `applying`. Recheck only reads; it never replays.
- Journal writes are serialized, atomic and mode 0600. Invalid history is never
  silently dropped or overwritten.

## Code conventions

- TypeScript strict, no `any`. Named exports.
- Components in `PascalCase.tsx`; everything else in `kebab-case.ts`.
- `"use client"` only on files that use state, effects or browser APIs.
- Comments explain why. Do not reference tickets, tasks or tools.
- Add a dependency only when it removes real complexity, and say why.
- Never commit `.env` or anything under `data/`.
- Commit messages are short and imperative, with no tool or assistant
  attribution in commits, pull requests, comments or documents.

## Branches

Branch from `master` and name the branch `<type>/<short-description>` in
kebab-case, for example `feature/work-log-export` or `fix/overdue-badge-count`.
The type is one of:

| Type | Use for |
| --- | --- |
| `feature` | A new capability or a change in behaviour |
| `fix` | A bug fix |
| `refact` | Restructuring code without changing behaviour |
| `remove` | Removing a feature, code or a dependency |

## Before finishing a change

1. The change has unit tests and at least one end-to-end test.
2. The four gates pass.
3. The change was exercised in the running app, in English and Portuguese.
4. `README.md` and this file still describe the project accurately.

## After a pull request is merged

Clean up only after the pull request is merged. Each step has a check; if a
check fails or is unclear, leave the item in place and ask the owner. Never use
`--force`, `-D` or `-f` to get past a check.

1. **Confirm the merge.** `gh pr view <number> --json state,statusCheckRollup`
   shows `MERGED` and passing checks.
2. **Confirm nothing is unsaved.** In the branch's checkout, `git status
   --short` and `git log origin/<branch>..<branch>` print nothing, and no stash
   belongs to this work. List any untracked files and ask before continuing.
3. **Update master.** `git switch master && git pull`. Confirm the branch is in
   `git branch --merged master`, or for a squash merge that `git diff master
   <branch>` shows nothing missing from master.
4. **Remove the worktree**, if any, with `git worktree remove <path>` and
   `git worktree prune`. Never remove the main checkout, the one you are in, or
   one another session uses.
5. **Delete the branch** with `git branch -d <branch>`,
   `git push origin --delete <branch>` and `git fetch --prune`. Ask the owner if
   `-d` refuses after a squash merge.
6. **Clear caches** with `npm run clean`, plus leftover `tudu-test-*` and
   `tudu-e2e-*` folders in the system temp directory. Anything else must be
   git-ignored and untracked first.
7. **Report** what was removed, what was kept and why.

Clean-up always keeps `data/`, `.env`, `node_modules`, Docker volumes and
anything outside the repository.
