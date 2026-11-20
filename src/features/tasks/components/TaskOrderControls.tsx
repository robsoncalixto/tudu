import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { TASK_ORDER_DRAG_TYPE, type DayOrderControl } from "../use-day-order";

export function TaskOrderControls({ order, id, t }: { order: DayOrderControl; id: string; t: Dictionary }) {
  const position = order.positions.get(id);
  if (position === undefined) return null;
  return <div className="task-order-control">
    <span className="chip task-order-rank" role="img" aria-label={t.taskOrderPosition(position + 1)}
      draggable={order.ready} title={t.taskOrderPosition(position + 1)}
      onDragStart={(event) => {
        event.dataTransfer.setData(TASK_ORDER_DRAG_TYPE, id);
        event.dataTransfer.effectAllowed = "move";
      }}>{position + 1}</span>
    <button type="button" className="icon-btn task-order-up" aria-label={t.moveTaskUp} title={t.moveTaskUp}
      aria-disabled={!order.ready || position === 0} onClick={() => { if (order.ready) order.move(id, position - 1); }}><Icon name="chevron-down" size={16} /></button>
    <button type="button" className="icon-btn" aria-label={t.moveTaskDown} title={t.moveTaskDown}
      aria-disabled={!order.ready || position + 1 === order.size} onClick={() => { if (order.ready) order.move(id, position + 1); }}><Icon name="chevron-down" size={16} /></button>
  </div>;
}
