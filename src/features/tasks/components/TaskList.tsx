import type { Dictionary, Locale } from "@/i18n";
import type { Task, TaskPatch } from "../schema";
import { TaskRow } from "./TaskRow";

export interface TaskActions {
  onPatch: (id: string, patch: TaskPatch) => Promise<boolean>;
  onDelete: (id: string) => void;
  onTag: (tag: string) => void;
}

interface Props extends TaskActions {
  tasks: Task[];
  today: string;
  locale: Locale;
  t: Dictionary;
  /** Show the column labels above the rows. */
  header?: boolean;
  /** Ids of tasks that were just created, to animate them in. */
  fresh?: ReadonlySet<string>;
}

export function TaskList({ tasks, header, fresh, ...row }: Props) {
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
          <TaskRow key={task.id} task={task} fresh={fresh?.has(task.id)} {...row} />
        ))}
      </ul>
    </div>
  );
}
