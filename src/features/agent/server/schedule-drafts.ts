import { dictionaries, type Locale } from "@/i18n";
import { calendarDayOrNull, dueLabel } from "@/lib/dates";
import { taskSchema, type Task } from "@/features/tasks/schema";
import { proposalDraftSchema, type ProposalDraft } from "../schema";
import { DEFAULT_EFFORT, recommendPlacement, upcomingWorkload, type CapacitySettings } from "../workload";

type Placement = NonNullable<ReturnType<typeof recommendPlacement>>;

function explain(placement: Placement, locale: Locale, today: string, settings: CapacitySettings) {
  const t = dictionaries[locale];
  const day = dueLabel(placement.day, today, locale, t, settings.dateFormat);
  const free = Math.max(0, placement.free);
  const details = free < placement.effort
    ? t.agentOverCapacityPlacement(day, free, placement.effort)
    : t.agentLoadReason(day, free, placement.effort);
  return placement.usedDefault ? `${details} ${t.agentDefaultEffort(DEFAULT_EFFORT)}` : details;
}

export function scheduleNewDrafts(drafts: ProposalDraft[], tasks: Task[], today: string, settings: CapacitySettings, locale: Locale): ProposalDraft[] {
  const pool = [...tasks];
  return drafts.map((draft, index) => {
    if (draft.action.kind !== "create_task") return draft;
    const task = draft.action.task;
    const workload = upcomingWorkload(pool, today, settings);
    const placement = task.due === null && task.plannedFor === null ? recommendPlacement(task, workload, { allowOverCapacity: true }) : null;
    const proposed = placement ? { ...task, due: placement.day, plannedFor: placement.day, partOfDay: placement.partOfDay } : task;
    pool.push(taskSchema.parse({
      ...proposed, id: `proposed-${index}`, done: false, createdAt: `${today}T00:00:00.000Z`, completedAt: null,
    }));
    return placement ? proposalDraftSchema.parse({ ...draft, reason: `${draft.reason}\n${explain(placement, locale, today, settings)}`,
      action: { kind: "create_task", task: proposed } }) : draft;
  });
}

export function scheduleReviewDrafts(drafts: ProposalDraft[], tasks: Task[], today: string, settings: CapacitySettings, locale: Locale) {
  const pool = [...tasks];
  const pending = new Set(drafts.flatMap(({ action }) => action.kind === "flag_duplicate" ? [action.taskId, action.otherTaskId]
    : action.kind === "update_task" ? [action.taskId] : []));
  const initial = upcomingWorkload(pool, today, settings, 14);
  const overCapacity = initial.filter(({ capacity, hours }) => hours > capacity);
  const scheduled: ProposalDraft[] = [];
  function append(task: Task, patch: { plannedFor: string; partOfDay: Task["partOfDay"] }, reason: string) {
    scheduled.push(proposalDraftSchema.parse({ action: { kind: "update_task", taskId: task.id, patch },
      reason, taskBefore: task, projectBefore: null }));
    pending.add(task.id);
    pool[pool.findIndex(({ id }) => id === task.id)] = { ...task, ...patch };
  }

  for (const overloaded of overCapacity) {
    if (scheduled.length >= 3) break;
    const movable = pool.filter((task) => {
      const plan = calendarDayOrNull(task.plannedFor);
      const due = calendarDayOrNull(task.due);
      return !task.done && plan && (plan < today ? today : plan) === overloaded.day
        && (!due || due > overloaded.day) && !pending.has(task.id);
    })
      .sort((a, b) => (["low", "medium", "high"].indexOf(a.priority) - ["low", "medium", "high"].indexOf(b.priority)));
    for (const task of movable) {
      const due = calendarDayOrNull(task.due);
      const future = upcomingWorkload(pool, today, settings, 35).filter((day) => day.day > overloaded.day && (!due || day.day <= due));
      const placement = recommendPlacement(task, future, { deferLow: false });
      if (!placement) continue;
      const t = dictionaries[locale];
      const overload = t.agentOverloaded(dueLabel(overloaded.day, today, locale, t, settings.dateFormat), overloaded.hours, overloaded.capacity);
      append(task, { plannedFor: placement.day, partOfDay: placement.partOfDay }, `${overload} ${explain(placement, locale, today, settings)}`);
      break;
    }
  }
  for (const task of tasks) {
    if (scheduled.length >= 3) break;
    if (task.done || calendarDayOrNull(task.due) || calendarDayOrNull(task.plannedFor) || pending.has(task.id)) continue;
    const placement = recommendPlacement(task, upcomingWorkload(pool, today, settings));
    if (placement) append(task, { plannedFor: placement.day, partOfDay: placement.partOfDay }, explain(placement, locale, today, settings));
  }

  return { drafts: [...drafts, ...scheduled], overloaded: overCapacity.length };
}
