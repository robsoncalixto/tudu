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
`data/settings.json` in both storage modes. Assistant proposals and their
decision history live in `data/proposals.json` in both modes too. Task
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

Choose Anthropic, OpenAI or OpenRouter in **Settings**, then configure that
provider's key in the server's `.env` file and restart the app. Keys are never
entered or returned through the web interface. Without the selected provider's
key, the app works as a regular to-do list and AI controls explain what to set.
It does not silently switch to another configured provider.

| Provider | Server credential | Default model | Optional server default override |
| --- | --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`) | `claude-opus-5-5` | `TUDU_AI_MODEL` |
| OpenAI | `OPENAI_API_KEY` | `gpt-6.2-sol` | `TUDU_OPENAI_MODEL` |
| OpenRouter | `OPENROUTER_API_KEY` | `anthropic/claude-opus-5.5` | `TUDU_OPENROUTER_MODEL` |

The model field in Settings overrides the selected provider's default; leave
it blank to use the model shown as its placeholder. Switching provider clears
that field so a model from a different provider is not reused accidentally.
Capture and work-log summaries share this selection. Choose a model that
supports structured output. An unsupported model or invalid output shows a
stable error without saving tasks; there is no free-text parsing fallback.
Anthropic API keys take precedence if both Anthropic credentials are set.

The provider adapter uses the official Anthropic and OpenAI SDKs with Zod
schemas. OpenAI uses [Responses structured parsing](https://github.com/openai/openai-node/blob/main/docs/structured-outputs.md);
OpenRouter uses its compatible Chat Completions endpoint with strict JSON
Schema and [`require_parameters: true`](https://openrouter.ai/docs/guides/features/structured-outputs)
so routing requires structured-output support. All responses are validated
locally before use. Automated tests mock provider HTTP requests and never use
real keys or make paid model calls.

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
| Review suggestions | Open **Assistant**, ask for changes, then edit and accept or reject each proposal |

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
language. Press Escape to leave the composer without losing your draft: focus
moves to the first visible task, or the help button when the view is empty.

| Key | Action |
| --- | --- |
| `n` or `/` | Focus the composer |
| `j` or `↓` | Focus the next visible task |
| `k` or `↑` | Focus the previous visible task |
| `x` | Complete or reopen the focused task |
| Delete or Backspace | Ask to delete the focused task |
| `?` | Open shortcut help |
| Escape | Leave the composer, close help or cancel deletion |

Focus visibly selects the task. Navigation follows the current filter and sort
order; completed tasks join it only while **Done** is expanded. Confirmation
starts on Cancel for both the row's × button and the keyboard, and pending
deletion cannot be submitted twice. After a
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
the saved provider has a server credential. Provider/model choices are shared
preferences; credentials remain on the server.

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
copying. An optional AI summary uses the provider and model selected in Settings,
includes only the saved completed task titles, projects and tags for that day,
and never changes tasks. Review it before sharing; it is included in subsequent
exports. A large work log stays available for copying even if it exceeds the AI
input limit. Refresh reloads the latest tasks. This is a view of current task
data: reopened or deleted tasks no longer appear as completed work.

## Plan with the assistant

Open **Assistant** from the sidebar (on phones, use **More views** / **⋯**).
Describe new work or ask for priorities,
due dates, checklist steps, project organization or a plan for the day. The
selected provider receives the note plus saved open tasks and project names.
The assistant generates pending proposals; it has no tools that execute changes.
Task and project text stays in its original language. New explanations use
the interface language at request time; recorded explanations are preserved.

Review each proposal, edit its fields and deliberately activate **Accept and
save**, or choose **Reject proposal**. Enter while editing a field does not
approve it. Related changes to one task are grouped into one proposal so they
can be saved together. Planning a day does not change the due date. Existing
checklist progress is retained when adding steps. To use a newly suggested
project, approve the project first, then select it while reviewing a task.

The decision history keeps the original suggestion, the exact edited values
that were approved, rejected proposals, the request, provider/model and times.
It survives browser reloads and app restarts. Pending proposals can still be
reviewed if the provider key is removed. History is separate from current task
state: later manual edits or deletion do not rewrite a recorded decision.
Back up `data/proposals.json` along with the other data files and the task
database when using PostgreSQL.

Approval revalidates fields and project assignments. If a task or project has
changed since the suggestion, its newer version is preserved; reject the stale
proposal and request a fresh one. Duplicate approval requests return the saved
decision. New task/project IDs are assigned by the server and cannot be
redirected through an edited proposal.

If a write cannot be confirmed, the proposal shows **Save not confirmed**.
**Check save status** only reads the target and records success when its state
matches the approved change; it never repeats a mutation. Review your tasks
and projects before **Dismiss unresolved save**. Dismissing records an
unconfirmed outcome and does not undo any saved change. You can then request
a new proposal if needed.

Requests accept up to 8,000 characters and generate up to 20 suggestions.
Saved open-task/project context is limited to 60,000 characters rather than
silently dropping data. Invalid, invented-target or conflicting output is
rejected before proposals are saved. Normal task management remains available
without AI.

For a trusted OpenAI-compatible server gateway, an administrator may set
`OPENAI_BASE_URL` on the server. The selected OpenAI credential is sent to that
endpoint. It is never a browser preference. Browser tests use this option with
a loopback-only synthetic provider and a dummy key; no test makes a real AI call.

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
For an app on another machine, use an SSH tunnel and connect to the local URL.

The regular web interface and REST API have no authentication. Keep the app on
a trusted network and use forwarding for remote access; publishing its port
publicly would expose those routes even though MCP requires a token.

Create a local forwarded port:

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
  features/ai/         Provider selection contract and shared structured generation
  features/agent/      Reviewed proposals, explicit decisions and durable audit history
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
