import type { Dictionary, Locale } from "@/i18n";
import type { Task, TaskPatch } from "../schema";
import type { DayOrderControl } from "../use-day-order";
import type { Postponement } from "../planning";
import type { ContextProposal } from "../task-suggestions";
import { TaskRow } from "./TaskRow";
import type { Project } from "@/features/projects/schema";
import type { DateFormat } from "@/lib/dates";
import "./task-list.css";

export interface TaskActions {
  order?: DayOrderControl;
  suggestions: ReadonlyMap<string, ContextProposal[]>;
  onPatch: (id: string, patch: TaskPatch) => Promise<boolean>;
  onDelete: (id: string) => void;
  onPostpone: (id: string, when: Postponement) => Promise<void>;
  selectedId: string | null;
  onShowPanel: (id: string, trigger: HTMLButtonElement) => void;
  onTag: (tag: string) => void;
}

interface Props extends TaskActions {
  tasks: Task[];
  projects: Project[];
  savedTags: string[];
  dateFormat: DateFormat;
  today: string;
  locale: Locale;
  t: Dictionary;
  /** Show the column labels above the rows. */
  header?: boolean;
  /** Rows that were just created, to mark them where they landed. */
  fresh?: ReadonlySet<string>;
  /** The row a task holds: a saved task keeps the row it had while it was being saved. */
  rowKey: (id: string) => string;
}

export function TaskList({ tasks, header, fresh, rowKey, ...row }: Props) {
  return (
    <div className="card list">
      {header && (
        <div className="list-head" aria-hidden>
          <span />
          <span>{row.t.colTask}</span>
          <span>{row.t.colDue}</span>
          <span>{row.t.colPriority}</span>
          <span />
        </div>
      )}
      <ul className="tasks">
        {tasks.map((task) => (
          <TaskRow key={rowKey(task.id)} task={task} fresh={fresh?.has(rowKey(task.id))} {...row} />
        ))}
      </ul>
    </div>
  );
}
