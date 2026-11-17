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
| Repeat a task | Open **Repeat** on a task, choose a schedule and due date, then **Save repeat rule** |
| Report completed work | Open **Work log**, choose a day and grouping, then copy plain text or Markdown |

**Today** includes tasks picked for the current local calendar day, plus tasks
due today or overdue. Its badge counts open tasks. Selections are saved with the
task and expire when the day changes; they never change the due date. Completed
tasks stay in the collapsed **Done** section when they match the selected view.

## Quick-add shortcuts

When adding one task, use shortcuts as separate words:
`Fix login #bug !high tomorrow` saves **Fix login**, tagged **bug**, with high
priority and tomorrow's due date. Tags are lowercase and deduplicated.
`!low`, `!medium` and `!high` work in either interface language. Without a
priority token, the server applies the saved default priority at save time.

Dates accept `today` / `hoje`, `tomorrow` / `amanhã` (also `amanha`), English
weekday names, Portuguese weekdays in their full forms (`segunda-feira`,
`terça-feira`, …, `sábado`, `domingo`), and valid `YYYY-MM-DD` dates.
Short forms such as `segunda`, `terça` and `quarta` stay as ordinary title text,
so phrases such as `segunda versão` or `quarta tentativa` are preserved.
Weekdays mean their next occurrence; use `today` or `hoje` for the current day.
The last priority or date token wins. Dates use the browser's current day,
independently of the server's time zone.

Unknown tokens and punctuation stay in the title. To keep a recognized token
literal, prefix it with a backslash: `Discuss \#bug \tomorrow` saves
**Discuss #bug tomorrow** without a tag or date. Open **Quick-add shortcuts**
in the composer for help. A shortcut-only task or a title/tag beyond the normal
limits shows an error and keeps the original text. AI capture still receives
the full note; explicit task fields sent to the JSON API are not parsed as
shortcuts.

## Keyboard shortcuts

Use the **?** button or press `?` outside a field for help in the current
language. Press Tab to leave the composer before using task shortcuts.

| Key | Action |
| --- | --- |
| `n` or `/` | Focus the composer |
| `j` or `↓` | Focus the next visible task |
| `k` or `↑` | Focus the previous visible task |
| `x` | Complete or reopen the focused task |
| Delete or Backspace | Ask to delete the focused task |
| `?` | Open shortcut help |
| Escape | Close help or cancel deletion |

Focus visibly selects the task. Navigation follows the current filter and sort
order; completed tasks join it only while **Done** is expanded. Confirmation
starts on Cancel, and pending deletion cannot be submitted twice. After a
successful change focus moves to a neighboring task, or the composer if none
remain. A failed change restores the task and offers a retry. Shortcuts are off
in inputs, selects, editable content and dialogs; modified browser shortcuts
and normal Tab/Enter behavior remain available.

## Settings

Choose English or Portuguese, the default priority for new tasks, the initial
view (All tasks or Today), and language-based or ISO (`YYYY-MM-DD`) dates.
ISO mode uses exact dates in due chips, including today, tomorrow and yesterday.
If a hand-edited preferences file is invalid, the app uses defaults until you
save valid settings; reading it leaves the original file untouched.
Preferences are shared by browsers using this installation and saved on the
server. They take effect when saved and when you return to the task board;
browser-only language settings are no longer used.

The default priority applies to title-only API requests and is supplied to AI
capture. Explicit task priorities are preserved. The AI section shows whether
capture is configured; provider configuration remains on the server.

## Repeating tasks

Repeating tasks support daily, weekdays (Monday–Friday), weekly on selected
days, and monthly on a chosen day. Completion saves the next task together with
the completed one. The next due date follows the scheduled date, even if you
complete it late; it can therefore still be overdue. Monthly dates clamp to the
last day of a shorter month while preserving the chosen day (January 31 →
February 28 → March 31).

New occurrences keep the title, notes, priority, project, tags and rule; they
start open with unchecked steps and no manual Today selection. Change or remove
the rule on the open occurrence to affect what comes next. Tasks already created
are independent. Reopening and completing the same occurrence, retrying its
request, or deleting its next task does not generate a second copy. Both storage
backends persist the rule and next-task link; PostgreSQL upgrades automatically.

## Work log

The **Work log** lists tasks completed on a selected day (today by default),
using the browser's time zone rather than the server's. Group by project, tag,
or neither. Tasks with multiple tags appear in each matching tag group; the
total counts each task once. Plain-text and Markdown exports include task
titles, group headings, and an unambiguous ISO date. Markdown escapes the
person's text so titles cannot introduce extra formatting.

Copying also works on LAN HTTP through a native selection fallback. If the
browser blocks both clipboard methods, the page offers the full text for manual
copying. An optional AI summary uses the configured Anthropic key and model,
includes only the saved completed task titles, projects and tags for that day,
and never changes tasks. Review it before sharing; it is included in subsequent
exports. A large work log stays available for copying even if it exceeds the AI
input limit. Refresh reloads the latest tasks. This is a view of current task
data: reopened or deleted tasks no longer appear as completed work.

## Connect an assistant with MCP

TUDU exposes a Streamable HTTP MCP server at `http://localhost:3000/api/mcp`.
It runs inside the app and uses the same task repository and write queue as the
browser, with either JSON or PostgreSQL storage. No separate server is needed.
It is disabled until you set `TUDU_MCP_TOKEN` in `.env`. Generate a token:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the result into `TUDU_MCP_TOKEN`, then restart the app (with Docker,
`docker compose up -d --build`). Tokens must contain 32–256 letters, digits,
underscores or hyphens. Keep the token private. Every MCP request requires
`Authorization: Bearer <token>`; tokens in URLs are not accepted.

For Claude Code, set `TUDU_MCP_TOKEN` in your shell to the same value and run:

```bash
claude mcp add --transport http tudu http://localhost:3000/api/mcp \
  --header "Authorization: Bearer ${TUDU_MCP_TOKEN}"
```

This stores the header in Claude Code's local configuration. Other clients
that support Streamable HTTP can use the same URL and authorization header.
The endpoint accepts loopback Host headers (`localhost`, `127.0.0.1`, `[::1]`)
and loopback browser Origins only; a client without an Origin is allowed.
For an app on another machine, use an SSH tunnel and connect to the local URL:

```bash
ssh -N -L 3001:localhost:3000 user@server
```

Then configure `http://localhost:3001/api/mcp` in the client. Host and Origin
validation are request checks, not a network firewall; bearer authentication
is required even through the tunnel. This endpoint uses a manually configured
token, with no OAuth discovery or login flow.

| Tool | Behavior |
| --- | --- |
| `list_projects` | Read existing project names and IDs for assignment or filtering |
| `list_tasks` | Filter by state, tag, project (including `null` for no project), priority, due range, planned date or title/notes query; paginate with `offset` and `limit` (maximum 200) |
| `add_tasks` | Add 1–50 structured tasks; omitted priority uses the saved default |
| `update_task` | Patch task fields; use `done: false` to reopen |
| `complete_task` | Complete a task and return its next repeating occurrence, if any |
| `delete_task` | Permanently delete one task, requiring `confirm: true` |

Filters combine with AND. The optional `today: "YYYY-MM-DD"` filter includes
tasks planned for that local day or due on/before it; use `state: "open"` for
open work. List results include `total` and `nextOffset`. Titles are literal,
so `#tags` and date words are not parsed as quick-add shortcuts. Completion and
repeat creation are atomic, and retries do not create duplicate occurrences.
Task and project text is user data, never instructions for an assistant.

The delete tool instructs clients to show the exact task and ask for explicit
confirmation before sending `confirm: true`. That field prevents accidental
omission; the client is responsible for obtaining the person's confirmation.
Deleting a repeating task leaves already-created occurrences in place.
Tool errors return stable codes without internal storage details.

The official MCP server SDK handles protocol negotiation and transport; its
client SDK is a development dependency for the protocol tests in `e2e/mcp.spec.ts`.
Those tests exercise discovery, every tool, persistence, validation, concurrent
browser/API writes and authentication against an isolated running app.

## Project layout

```
src/
  app/                 Routes: page, layout, API endpoints
  features/tasks/      Task schema, storage, hooks and components
  features/capture/    Turning a note into tasks with AI
  features/projects/   Project registry
  features/settings/   Shared preferences
  features/recurrence/ Repeat rule contract
  features/work-log/   Completed-day selection, exports and AI summary
  features/mcp/        Validated MCP tools, filtering and HTTP access checks
  i18n/                English and Portuguese strings
  lib/                 Shared helpers
e2e/                   End-to-end tests
design.md              Design system
```

See [AGENTS.md](AGENTS.md) for the architecture rules and conventions.

## License

MIT
