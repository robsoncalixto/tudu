# TUDU

An open source to-do list for managing your work tasks. Write a task, or paste a
free-form note and let the app turn it into separate tasks with priorities,
due dates and tags.

- **Next.js** (App Router, TypeScript)
- **No database needed** — tasks live in a single JSON file (`data/tasks.json`),
  or in PostgreSQL if you prefer
- **AI native** — optional capture box that turns notes into structured tasks
- **English and Portuguese** — English by default, choose the language in Settings
- **Docker** for local development

## Run with Docker

```bash
cp .env.example .env
```

```bash
docker compose up --build
```

Open <http://localhost:3000>. Source changes reload automatically and tasks are
kept in `./data` on your machine.

## Run without Docker

```bash
npm install
```

```bash
npm run dev
```

## Store tasks in PostgreSQL

Tasks are kept in `data/tasks.json` until you set `DATABASE_URL`. With Docker,
uncomment `DATABASE_URL` in `.env` and start the bundled database too:

```bash
docker compose --profile postgres up --build
```

Without Docker, point `DATABASE_URL` at any PostgreSQL server. TUDU creates its
table on first start, and a brand-new database begins with the tasks already in
`data/tasks.json` (the file is left untouched). Remove `DATABASE_URL` to go back
to the file.

Project names are stored in `data/projects.json` and app preferences in
`data/settings.json` in both storage modes. Task
assignments use the selected task backend. Keep the whole `data/` directory
when backing up an installation. Deleting a project preserves its tasks and
removes their assignments. AI capture can select an existing project when a
note names it; it does not invent projects.

## Tests

Unit tests:

```bash
npm test
```

End-to-end tests, which drive the real app in a browser (run `npx playwright install chromium` once first):

```bash
npm run test:e2e
```

To run both against the Docker Postgres (it uses a separate `tudu_test`
database, never your tasks):

```bash
docker compose --profile postgres up -d db
```

```bash
npm run test:postgres && npm run test:e2e:postgres
```

Every new feature ships with both kinds of test; see [AGENTS.md](AGENTS.md).

## AI capture

Set `ANTHROPIC_API_KEY` in `.env` to turn on **Create with AI**. Without a key
the app works as a regular to-do list. `TUDU_AI_MODEL` overrides the model.

Paste something like:

> Met with Ana about the Q1 report. I need to send her the draft by Friday,
> book a room for the review, and at some point clean up the old dashboards.

and it becomes three tasks, each with its own due date, priority and tags. The
tasks stay in the language you wrote them in. When a note explicitly breaks an
action into steps, AI capture can keep those steps as a checklist on the task.

## Using it

| Action | How |
| --- | --- |
| Add one task | Type and press `Enter` |
| Turn a note into tasks | `Ctrl`/`⌘` + `Enter`, or the **Create with AI** button |
| Complete a task | Click its checkbox — it moves to **Done** |
| Rename a task | Click the title |
| Break a task into steps | Open **Checklist** on its row, then add steps |
| Update a checklist | Check steps, rename them with **Edit**, or remove them with **×** |
| Change priority | Click the priority label to cycle low → medium → high |
| Set a due date | Click the date label |
| Plan today | Click **Add to today** on a task, then **Today** in the sidebar |
| Remove a daily selection | Click **Remove from today**; tasks due today or overdue remain visible |
| Filter by tag | Click a `#tag` |
| Manage projects | Open **Manage projects** to create, rename or delete a project |
| Assign a project | Choose a project or **No project** on a task row |
| Filter by project | Click its name in the sidebar |
| Change preferences | Open **Settings** from the sidebar, choose values, then **Save settings** |

**Today** includes tasks picked for the current local calendar day, plus tasks
due today or overdue. Its badge counts open tasks. Selections are saved with the
task and expire when the day changes; they never change the due date. Completed
tasks stay in the collapsed **Done** section when they match the selected view.

## Settings

Choose English or Portuguese, the default priority for new tasks, the initial
view (All tasks or Today), and language-based or ISO (`YYYY-MM-DD`) dates.
Preferences are shared by browsers using this installation and saved on the
server. They take effect when saved and when you return to the task board;
browser-only language settings are no longer used.

The default priority applies to title-only API requests and is supplied to AI
capture. Explicit task priorities are preserved. The AI section shows whether
capture is configured; provider configuration remains on the server.

## Project layout

```
src/
  app/                 Routes: page, layout, API endpoints
  features/tasks/      Task schema, storage, hooks and components
  features/capture/    Turning a note into tasks with AI
  i18n/                English and Portuguese strings
  lib/                 Shared helpers
e2e/                   End-to-end tests
design.md              Design system
```

See [AGENTS.md](AGENTS.md) for the architecture rules and conventions.

## License

MIT
