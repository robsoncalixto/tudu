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
| `TUDU_MCP_ALLOWED_ORIGINS` | Comma-separated HTTP(S) origins allowed to reach MCP in addition to loopback |

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
for today, unfinished tasks planned earlier, and tasks due today or overdue.
Use the sun button to plan a task for today or clear its existing plan.
The task actions menu can move the planned day to tomorrow or the next Monday
while keeping the deadline. Your open-task sort is remembered on the device.

Open the task panel (the icon at the right of a row) to edit the title,
notes, subtasks, priority, project, tags, planned day, due date, repeat rule,
time estimate, real execution time and links. Both time fields offer a unit selector
before the value: Minutes, Hours or Days. Fractional hours are supported, and
**1 day equals 12 hours**. Clear a field to remove its value. Changing units
converts the duration; both values are stored as decimal hours (`estimateHours`
and `realTimeHours` in the API). Existing minute estimates are converted to hours
automatically. New repeating occurrences keep the estimate and start with no real
execution time.

Repeating tasks can be daily, on weekdays, weekly on selected days, or monthly.
Completing one creates the next occurrence.

**Assistant** can review open tasks with **Review my tasks**, with or without a
note. It summarizes what it reviewed and proposes changes with reasons. Every
change requires approval. Possible duplicate flags record the decision without
modifying either task. The Assistant uses the working days and daily capacity
from Settings to suggest dates and a part of the day. Work without an estimate
counts as one hour. All suggested changes still require approval.

**Work log** lists the tasks completed on a chosen day, grouped by project or
tag, with recorded time, estimates alongside recorded time, and totals per
group and for the day. Both plain-text and Markdown copies include the times and totals.
The daily total counts a multi-tag task once.

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
| `create_project` | Create a project by name and return its ID and name |
| `list_tasks` | Filter and paginate tasks. The Today filter includes unfinished earlier plans. |
| `add_tasks` | Add 1–50 tasks |
| `update_task` | Update task fields, or reopen a task; pass `expected` to refuse changes made since the last read |
| `complete_task` | Complete a task and return its next occurrence, if any |
| `delete_task` | Delete a task; requires `confirm: true` |

Every tool declares an output schema. New subtasks may omit their `id`; the
server assigns one.

### Remote access

The default configuration accepts loopback hosts only. To connect through SSH,
run this command on the client machine and point the MCP client at
`http://localhost:3001/api/mcp`.

```bash
ssh -N -L 3001:localhost:3000 user@server
```

For direct access on a trusted LAN, add the exact origin used by the client to
the server's `.env`. For example, a client connecting to
`http://tudu.home.arpa:3000/api/mcp` needs this setting.

```dotenv
TUDU_MCP_ALLOWED_ORIGINS=http://tudu.home.arpa:3000
```

Separate multiple origins with commas. Each entry includes the scheme, host
and any non-default port. Omit paths such as `/api/mcp`. TUDU checks the
request's `Host` and, when present, its `Origin`. For a browser client served
from a different origin, list both the TUDU address and the browser app's
origin. An approved browser can send a CORS preflight without a token. The
MCP request itself requires the bearer token.

The default Compose port binding accepts only local connections. For direct
LAN access, publish the web port on the server's trusted LAN address and
recreate the web service with `docker compose up -d web` to load the settings.

## Security

The web interface and REST API have no authentication. Publishing TUDU's web
port on a LAN gives anyone who can reach that port access to both. Keep the
port off the public internet. Plain HTTP also sends the MCP bearer token
unencrypted. Use the SSH tunnel above or an HTTPS reverse proxy when the
network is untrusted.

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
