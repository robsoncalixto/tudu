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
  or a plan for the day. Enter sends the note, Shift+Enter starts a new line and
  the up arrow in an empty field brings back your last note. The assistant only
  proposes changes: review and edit each proposal, then accept or reject it.
  Decisions are kept in a history that survives restarts.

## Install TUDU

Open TUDU on `localhost` or over HTTPS. On desktop, use the browser’s
**Install app** option. On a phone, use **Add to Home Screen** or **Install**
from your browser menu. The installed app opens in its own window and follows
your **Start view** setting. When the connection drops, it shows an offline
page until it can reach the server again.

## Using TUDU

The same sidebar on every screen opens **All tasks**, **Today**, projects,
tags, **Work log**, **Assistant** and **Settings**. On a phone, use **More views**.
The plus beside **Projects** names a new project right in the sidebar: Enter
creates it and Escape gives up. **Today** shows tasks planned
for today, unfinished tasks planned earlier, and tasks due today or overdue.
Use the sun button to plan a task for today or clear its existing plan.
The task actions menu moves the planned day without changing the deadline.
Your open-task sort is remembered on the device. **Today** starts in **My
order**. Drag a task’s position or use **Move up** and **Move down** to save
the order for that day.
The board refreshes tasks and projects on focus and periodically while the
tab is visible.

Click a task's title to edit it in place: Enter or leaving the field saves,
Escape cancels, and the [writing syntax](#writing-tasks) works there too, so
typing `@fri` at the end of a title moves its due date. Completing, reopening
or deleting a task acts at once and shows a notice with **Undo** for a few
seconds. A deleted task is only removed when that notice is gone.

Open the task panel (the icon at the right of a row, or a double click on the
row) to edit the title,
notes, subtasks, priority, project, tags, planned day, due date, part of day,
repeat rule, time estimate, real execution time and links. Notes are saved a
moment after you stop typing; a title or tag list is saved on Enter or on
leaving the field. Both time fields offer a unit selector
before the value: Minutes, Hours or Days. Fractional hours are supported, and
**1 day equals 12 hours**. Clear a field to remove its value. Changing units
converts the duration; both values are stored as decimal hours (`estimateHours`
and `realTimeHours` in the API). Existing minute estimates are converted to hours
automatically. New repeating occurrences keep the estimate and start with no real
execution time.

Repeating tasks can be daily, on weekdays, weekly on selected days, or monthly.
Completing one creates the next occurrence.

### Assistant

Choose **Review my tasks** on the Assistant screen for a summary and
suggestions based on the open list. An optional note can guide the review.
The Assistant screen shows pending suggestions and decision history. Every
suggested change requires approval.

Suggestions for an existing task appear beside the affected fields and
subtasks in its details. Accept or reject each proposal there or on the
Assistant screen. An order suggestion shows the full Today sequence with a
reason for each position and applies as one decision. A possible duplicate
flag records the decision without modifying either task.

Set your working days and daily hours in **Settings**. The Assistant counts an
open task against its planned day, or its due date when it has no plan, and
carries earlier work into today's load. Work without an estimate counts as one
hour. For a new task with no date, the Assistant suggests a deadline, planned
day and morning, afternoon or evening. The reason shows the available hours and
estimated effort. A review flags days over capacity and can propose moving work
within its existing deadlines.

Automatic review starts off. In **Settings**, enable it and choose a local
time. The review runs once per day at most while TUDU is running and can use a
paid model. It records a skip when there are no open tasks, the task list has
not changed, or the selected provider is unavailable. Suggestions wait for
approval.

### Work log and settings

**Work log** lists the tasks completed on a chosen day, grouped by project or
tag, with recorded time, estimates alongside recorded time, and totals per
group and for the day. Both plain-text and Markdown copies include the times and totals.
The daily total counts a multi-tag task once.

**Settings** controls language, appearance (System, Light or Dark), initial
view, default priority, date format, work capacity, automatic review, and the
AI provider and model.

### Writing tasks

One field writes a task and everything about it. Enter adds it and leaves the
field ready for the next one; Shift+Enter starts another task on a new line.
`Review proposal #work @tomorrow 14h !high` creates **Review proposal**, tagged
`work`, with high priority, due tomorrow afternoon.

| Write | Meaning |
| --- | --- |
| `#tag` | Add a tag. A new tag is created when you save. |
| `+website-redesign`, `@website-redesign` | Assign an existing project. Use hyphens for spaces. An unknown `+name` stays in the title and is pointed out. |
| `@today`, `@tomorrow`, `@fri`, `@25/11`, `@2026-12-01` | Set the due date. Portuguese works too: `@hoje`, `@amanha`, `@sex`. |
| `today` / `hoje`, `tomorrow` / `amanhã`, a full weekday, `YYYY-MM-DD` | The same, without the `@`. |
| `@tomorrow 14h`, `@16:00` | Add a time. A due date keeps the day, so the time is saved as morning, afternoon or evening. |
| `!high`, `!medium`, `!low` | Set the priority. Also `!alta`, `!media`, `!baixa` and `!1`, `!2`, `!3`. |
| `~30m`, `~2h`, `~1d`, `t1h30m` | Set an estimate. One day is 12 hours. |

A token is a whole word, so `C#` and `name@example.com` are left alone. Prefix
a token with a backslash to keep it as text: `Discuss \#bug` saves
**Discuss #bug**. The field marks each token it recognizes, underlines a date
it cannot read, and offers saved tags, projects, days and priorities as you
type `#`, `+`, `@` or `!`.

The chips under the field show the same values and can set them with the
pointer: project, planned day, due date, priority, estimate and tags. A chip
takes its field over from the text. In **Today**, in a project or in a tag, a
new task starts with that view's value, which the chip can clear. With several
lines, the chips are defaults for every line.

### Keyboard shortcuts

Press `?` anywhere for the full list, which the app builds from the same
registry its key handlers use. Shortcuts never fire while you type in a field.

| Key | Action |
| --- | --- |
| `N` or `Shift`+`A` | Write a new task, from any screen |
| `/` | Search the current list |
| `G` then `A`, `T`, `W`, `I`, `S` | All tasks, Today, Work log, Assistant, Settings |
| `J` / `↓`, `K` / `↑` | Next or previous task |
| `Space` or `D` | Complete or reopen the focused task |
| `Enter`, `E` | Edit its title, open its details |
| `Delete` | Delete it |
| `Z` or `Ctrl`/`⌘`+`Z` | Undo the last completion or deletion |
| `Esc` in the task field | Close suggestions, then clear the field, then leave it |

Single-key shortcuts can be switched off in that list, per device. Arrows,
Enter, Space, Esc and shortcuts with `Ctrl` or `⌘` keep working.

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
| `get_day_order` | Read the saved order for a day |
| `set_day_order` | Set the order for a day using every current open task ID. Pass `expected` to reject a concurrent reorder. |
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
| End-to-end tests, with accessibility checks | `npm run test:e2e` (run `npx playwright install chromium` once first) |
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
