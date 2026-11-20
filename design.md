---
version: alpha
name: TUDU
description: Design system for TUDU's task board and settings.
---

# TUDU design system

The board helps people find a task, plan it for today and finish it. Keep these
actions visible in the list. Show subtasks directly under their parent. Keep
project assignment and repeat settings in task details. The charcoal sidebar uses
the Two Beats logo with white lettering in both themes. Use its two indigo strokes
alone for the collapsed sidebar and browser tab.

## Color

Charcoal and indigo anchor both appearances. Use the roles below through the
custom properties in `src/app/globals.css`. Settings offers **System**,
**Light** and **Dark**. System follows the device, including changes while the
app is open. The server applies the saved choice on the first render.

| CSS token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--primary` | `#202020` | `#202020` | Navigation rail |
| `--brand-accent` | `#5F55EE` | `#5F55EE` | Indigo used to tint active navigation |
| `--neutral` | `#FFFFFF` | `#FFFFFF` | Light lettering on the rail |
| `--action` | `#202020` | `#E8E7ED` | Primary button fill |
| `--on-action` | `#FFFFFF` | `#202020` | Primary button text |
| `--primary-hover` | `#373739` | `#FFFFFF` | Primary button hover |
| `--accent` | `#5F55EE` | `#B3AAFF` | Focus, selected actions and progress |
| `--secondary` | `#F0F0F0` | `#303137` | Secondary buttons and count backgrounds |
| `--surface` | `#FFFFFF` | `#191A1E` | Page, cards and dialogs |
| `--surface-muted` | `#F8F8F8` | `#222328` | Search, column headers and metadata |
| `--border` | `#E8E8E8` | `#393A42` | Dividers and container outlines |
| `--control-border` | `#85858C` | `#85858E` | Form control outlines |
| `--text` | `#202020` | `#F1F1F4` | Headings and task titles |
| `--text-muted` | `#646464` | `#B0B0B9` | Dates, notes and supporting text |
| `--on-surface` | `#292D34` | `#DEDEE5` | Panel text |
| `--success` | `#227344` | `#76CE94` | Checked tasks and successful saves |
| `--warning` | `#C45827` | `#FFA372` | High priority |
| `--error` | `#BE3838` | `#FF9696` | Overdue dates and errors |

The rail mixes white with charcoal in both appearances. Use `--rail-text`
(79% white) for navigation, `--rail-muted` (60%) for counts and
`--rail-rule` (14%) for dividers.

Pair status colors with a label, icon or checked state. For example, a late task
shows its date and the word “overdue.” Use flat surfaces, thin borders and
background changes to distinguish controls.

## Type, shape and spacing

Use `--heading` (Plus Jakarta Sans) for headings, navigation and task titles.
Use `--body` (Inter) for dates, notes, form values and instructions.

| Element | Type |
| --- | --- |
| Board heading | 650 weight, 33–50px, 1.15 line height |
| Section heading on the board | 650 weight, 17px/25px |
| Task title | 600 weight, 15px/23px |
| Navigation | 500 weight, 14px/20px |
| Body text | 400 weight, 16px/24px |
| Hints | 400 weight, 14px/20px |
| Row metadata | 400 weight, 12px/18px |

| Scale | Tokens and values |
| --- | --- |
| Radius | `--r-sm` 4px, `--r-md` 8px, `--r-lg` 12px, `--r-xl` 15px, `--r-full` 9999px |
| Spacing | `--s-xs` 2px, `--s-sm` 10px, `--s-md` 18px, `--s-lg` 30px, `--s-xl` 80px |

## Workspace

- **Navigation.** The charcoal sidebar has expanded and compact desktop modes. Projects and Tags each have a disclosure. Keep project creation beside the Projects heading and identify the selected view in either mode. At 820px and below, the rail becomes a top bar with All tasks and Today visible. More views opens the remaining lists and tools.
- **Current view.** Place the localized date above the view name. Show its open and completed totals together, with a progress bar where space permits. Search filters this view. Keep the totals tied to the whole view as the results change.
- **Entry.** Keep the task field and Add button on one line. Put the priority, due date and tag controls below the field. Use a single preview for the values that will be saved, including typed projects and estimates. Put shortcut help and optional AI capture beneath the main action. A failed submission keeps the draft available.
- **List.** Give the task title the flexible column. Align due date, priority and row controls on desktop. At narrow list widths, wrap scheduling information below the title. The sun button plans an open task for Today. Task details holds the notes, project assignment, repeat rule and delete action.
- **Subtasks.** Indent children one level below their parent. Each child has a completion control and an editable title. The parent exposes inline entry and a completed/total count. Its visibility control can show all children, hide completed children, or collapse the list.
- **Task panel.** Reveal the panel icon on row hover and keyboard focus. Keep it visible on touchscreens and on the selected row. Anchor the inspector to the right and mark its task with the accent color. On narrow screens, show it in a modal sheet with a reachable close button. Keep planned day and deadline separate. Use editable controls for task properties, with collapsible sections for longer content.
- **Search and recovery.** Reveal matching completed tasks during a search. An empty list offers to add a task. An empty search offers to clear it. A failed load offers a retry.
- **Settings.** Put a labeled back arrow at the upper left. Name its destination and keep it within reach while scrolling. Appearance choices use labeled radio controls with visible selection and keyboard focus. Changes preview in the form. Keep Save and its result together and within reach on a phone.

## Controls and accessibility

Use shared `.btn`, `.card`, `.chip` and `.section-title` styles where they fit.
The shared form button is 52px tall with a 15px radius. The inline Add button
is 40px tall on desktop and 44px on phones, with an 8px radius. A standard card has a 1px border, a 12px
radius and 20px padding. Task lists supply their own row padding.

Use `.back-link` for return navigation and `.form-control` and `.select-control` for form fields.
Give phone controls a 44px touch target, including the full row of each dropdown option.
Use the native select menu with rounded corners, a checked option and visible keyboard focus
in browsers that support picker styling. Other browsers use their system picker.
Use native controls for dates, choices and disclosures where practical. Give
icon-only buttons a localized accessible name. Decorative icons inherit text
color and stay out of the accessibility tree. Show a visible focus outline
for keyboard interaction and honor reduced-motion preferences. Check both
languages at phone width with long task and project names.
