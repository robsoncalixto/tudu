# TUDU

An open source to-do list for managing work tasks. Add tasks one at a time, or
paste a free-form note and let AI turn it into separate tasks with priorities,
due dates and tags.

- Next.js app that runs locally in Docker
- Tasks stored in a JSON file by default, or in PostgreSQL
- Optional AI capture, work-log summaries and a reviewed planning assistant
  (Anthropic, OpenAI or OpenRouter)
- Optional MCP endpoint for connecting AI assistants
- English and Portuguese (pt-BR) interface

## Getting started

### With Docker

```bash
cp .env.example .env
```

```bash
docker compose up --build
```

Open <http://localhost:3000>. Source changes reload automatically, and data is
kept in `./data` on your machine.

### Without Docker

Requires Node 22.

```bash
npm install
```

```bash
npm run dev
```

## Data storage

By default, tasks are stored in `data/tasks.json`. To use PostgreSQL, set
`DATABASE_URL` in `.env`. With Docker, uncomment `DATABASE_URL` and start the
bundled database:

```bash
docker compose --profile postgres up --build
```

TUDU creates its tables on first start. A new database is seeded with the tasks
already in `data/tasks.json`, which is left unchanged. Remove `DATABASE_URL` to
return to the file.

In both modes, projects, settings and assistant proposals are stored in
`data/projects.json`, `data/settings.json` and `data/proposals.json`. Back up
the whole `data/` directory, plus the database when using PostgreSQL.

## Configuration

All configuration lives in `.env`; see [.env.example](.env.example).

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` | Anthropic credential |
| `OPENAI_API_KEY` | OpenAI credential |
| `OPENROUTER_API_KEY` | OpenRouter credential |
| `TUDU_AI_MODEL`, `TUDU_OPENAI_MODEL`, `TUDU_OPENROUTER_MODEL` | Override each provider's default model |
| `OPENAI_BASE_URL` | Trusted OpenAI-compatible gateway (the OpenAI key is sent to it) |
| `DATABASE_URL` | Store tasks in PostgreSQL |
| `TUDU_MCP_TOKEN` | Enable the MCP endpoint |

Restart the app after changing `.env`.

## AI features

AI is optional. Without a key, TUDU works as a regular to-do list and AI
controls explain how to enable them.

Choose a provider in **Settings** and set its key in `.env`. Keys stay on the
server and are never entered or shown in the browser. The app does not fall
back to another provider.

| Provider | Default model |
| --- | --- |
| Anthropic | `claude-opus-5-5` |
| OpenAI | `gpt-6.2-sol` |
| OpenRouter | `anthropic/claude-opus-5.5` |

The model field in Settings overrides the default. The model must support
structured output.

- **Capture.** Paste a note and press `Ctrl`/`⌘` + `Enter`, or choose
  **Create with AI**. A note such as "Send Ana the Q1 draft by Friday, book a
  room for the review, and clean up the old dashboards" becomes three tasks with
  due dates, priorities and tags. Tasks keep the language they were written in.
- **Work log summary.** Summarizes the tasks completed on a given day. It reads
  only titles, projects and tags, and never changes tasks.
- **Assistant.** Describe new work or ask for priorities, due dates, subtasks
  or a plan for the day. The assistant only proposes changes: review and edit
  each proposal, then accept or reject it. Decisions are kept in a history that
  survives restarts.

## Using TUDU

The sidebar opens **All tasks**, **Today**, projects, tags, **Work log** and
**Assistant**. On a phone, use **More views**. **Today** shows tasks planned
for today plus tasks due today or overdue; use the sun button on a task to plan
it for today.

Open the task panel (the icon at the right of a row, or `i`) to edit the title,
notes, subtasks, priority, project, tags, planned day, due date, repeat rule,
time estimate and links.

Repeating tasks can be daily, on weekdays, weekly on selected days, or monthly.
Completing one creates the next occurrence.

**Work log** lists the tasks completed on a chosen day, grouped by project or
tag, and copies them as plain text or Markdown.

**Settings** controls language, appearance (System, Light or Dark), initial
view, default priority, date format and the AI provider and model.

### Quick-add shortcuts

When adding a single task, write shortcuts as separate words.
`Fix login #bug !high tomorrow` creates **Fix login**, tagged `bug`, with high
priority, due tomorrow.

| Shortcut | Meaning |
| --- | --- |
| `#tag` | Add a tag |
| `!low`, `!medium`, `!high` | Set the priority |
| `today` / `hoje`, `tomorrow` / `amanhã` | Set the due date |
| Weekday (`friday`, `sexta-feira`) | Due on its next occurrence |
| `YYYY-MM-DD` | Due on that date |

Prefix a token with a backslash to keep it as text: `Discuss \#bug` saves
**Discuss #bug**. Open **Quick-add shortcuts** in the composer for details.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `n` or `/` | Focus the composer |
| `j` / `↓`, `k` / `↑` | Move to the next or previous task |
| `a` | Add a subtask to the focused task |
| `i` | Open or close the task panel |
| `x` | Complete or reopen the focused task |
| Delete or Backspace | Delete the focused task (asks for confirmation) |
| `?` | Show shortcut help |
| Escape | Leave the composer, clear search, or close a dialog |

## MCP server

TUDU exposes a Streamable HTTP MCP endpoint at `http://localhost:3000/api/mcp`.
It is disabled until `TUDU_MCP_TOKEN` is set. Generate a token (32–256 letters,
digits, `_` or `-`):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set it in `.env`, restart the app, and send it as
`Authorization: Bearer <token>` with every request. For example, with Claude
Code:

```bash
claude mcp add --transport http tudu http://localhost:3000/api/mcp \
  --header "Authorization: Bearer ${TUDU_MCP_TOKEN}"
```

| Tool | Description |
| --- | --- |
| `list_projects` | List project names and IDs |
| `list_tasks` | Filter and paginate tasks |
| `add_tasks` | Add 1–50 tasks |
| `update_task` | Update task fields, or reopen a task; pass `expected` to refuse changes made since the last read |
| `complete_task` | Complete a task and return its next occurrence, if any |
| `delete_task` | Delete a task; requires `confirm: true` |

Every tool declares an output schema. New subtasks may omit their `id`; the
server assigns one.

The endpoint accepts loopback hosts only. To reach it from another machine, use
an SSH tunnel:

```bash
ssh -N -L 3001:localhost:3000 user@server
```

## Security

The web interface and REST API have no authentication. Docker Compose
publishes port 3000 on this machine only (`127.0.0.1`). Do not expose it
publicly; use an SSH tunnel for remote access.

## Development

| Task | Command |
| --- | --- |
| Unit tests | `npm test` |
| End-to-end tests | `npm run test:e2e` (run `npx playwright install chromium` once first) |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |

To run the tests against PostgreSQL, start the bundled database and run the
Postgres variants. They use a separate `tudu_test` database.

```bash
docker compose --profile postgres up -d db
```

```bash
npm run test:postgres && npm run test:e2e:postgres
```

Tests never call a real AI provider. See [AGENTS.md](AGENTS.md) for the
project structure, architecture rules and contribution guidelines, and
[design.md](design.md) for the design system.

## License

[MIT](LICENSE)
