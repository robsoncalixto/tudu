import { dictionaries, type Locale } from "@/i18n";
import type { Task } from "@/features/tasks/schema";
import { proposalDraftSchema, type ProposalDraft } from "../schema";
import { DEFAULT_EFFORT, recommendPlacement, upcomingWorkload, type CapacitySettings } from "../workload";

type Placement = NonNullable<ReturnType<typeof recommendPlacement>>;

function explain(placement: Placement, locale: Locale) {
  const t = dictionaries[locale];
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const details = t.agentLoadReason(placement.day, number.format(placement.free), number.format(placement.effort));
  return placement.usedDefault ? `${details} ${t.agentDefaultEffort(number.format(DEFAULT_EFFORT))}` : details;
}

export function scheduleNewDrafts(drafts: ProposalDraft[], tasks: Task[], today: string, settings: CapacitySettings, locale: Locale): ProposalDraft[] {
  const pool = [...tasks];
  return drafts.map((draft, index) => {
    if (draft.action.kind !== "create_task") return draft;
    const task = draft.action.task;
    const workload = upcomingWorkload(pool, today, settings);
    const placement = task.due === null && task.plannedFor === null ? recommendPlacement(task, workload) : null;
    const proposed = placement ? { ...task, due: placement.day, plannedFor: placement.day, partOfDay: placement.partOfDay } : task;
    pool.push({
      ...proposed, id: `proposed-${index}`, done: false, createdAt: "", completedAt: null,
      partOfDay: proposed.partOfDay ?? null, estimateHours: proposed.estimateHours ?? null,
      nextOccurrenceId: null, realTimeHours: null, links: [],
    });
    return placement ? proposalDraftSchema.parse({ ...draft, reason: `${draft.reason}\n${explain(placement, locale)}`,
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
  function append(task: Task, patch: { plannedFor: string; partOfDay: Task["partOfDay"]; due?: string }, reason: string) {
    scheduled.push(proposalDraftSchema.parse({ action: { kind: "update_task", taskId: task.id, patch },
      reason, taskBefore: task, projectBefore: null }));
    pending.add(task.id);
    pool[pool.findIndex(({ id }) => id === task.id)] = { ...task, ...patch };
  }

  for (const overloaded of overCapacity) {
    if (scheduled.length >= 3) break;
    const movable = pool.filter((task) => !task.done && task.plannedFor === overloaded.day && task.due !== overloaded.day && !pending.has(task.id))
      .sort((a, b) => (["low", "medium", "high"].indexOf(a.priority) - ["low", "medium", "high"].indexOf(b.priority)));
    for (const task of movable) {
      const future = upcomingWorkload(pool, overloaded.day, settings).filter((day) => day.day > overloaded.day && (!task.due || day.day <= task.due));
      const placement = recommendPlacement(task, future);
      if (!placement) continue;
      const t = dictionaries[locale];
      const overload = t.agentOverloaded(overloaded.day, new Intl.NumberFormat(locale).format(overloaded.hours), new Intl.NumberFormat(locale).format(overloaded.capacity));
      append(task, { plannedFor: placement.day, partOfDay: placement.partOfDay }, `${overload} ${explain(placement, locale)}`);
      break;
    }
  }
  for (const task of tasks) {
    if (scheduled.length >= 3) break;
    if (task.done || task.due || task.plannedFor || pending.has(task.id)) continue;
    const placement = recommendPlacement(task, upcomingWorkload(pool, today, settings));
    if (placement) append(task, { due: placement.day, plannedFor: placement.day, partOfDay: placement.partOfDay }, explain(placement, locale));
  }

  return { drafts: [...drafts, ...scheduled], overloaded: overCapacity.length };
}
