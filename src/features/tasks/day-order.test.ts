import { describe, expect, it } from "vitest";
import { rankDayTasks, moveDayTask, orderVisibleDayTasks } from "./day-order";
import { taskSchema } from "./schema";

const day = "2026-11-17";
const task = (id: string, options = {}) => taskSchema.parse({ id, title: id, done: false,
  completedAt: null, createdAt: "2026-11-15T00:00:00.000Z", ...options });

describe("execution order", () => {
  it("puts saved positions first and carried-over tasks after the original day picks", () => {
    const carried = task("carried", { plannedFor: "2026-11-16" });
    const planned = task("planned", { plannedFor: day });
    const rank = task("rank", { dayRanks: { [day]: 0 } });
    const newTask = task("new", { plannedFor: day, planChangedAt: "2026-11-17T14:00:00.000Z" });
    expect(rankDayTasks([carried, newTask, planned, rank], day).map(({ id }) => id)).toEqual(["rank", "planned", "carried", "new"]);
  });
  it("moves by id and leaves invalid requests unchanged", () => {
    const ids = ["a", "b", "c"];
    expect(moveDayTask(ids, "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveDayTask(ids, "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveDayTask(ids, "a", "nope")).toBe(ids);
  });
  it("keeps temporarily hidden tasks in the server order when the visible tasks move", () => {
    expect(orderVisibleDayTasks(["a", "held", "b", "c"], ["c", "a", "b"])).toEqual(["c", "held", "a", "b"]);
  });
});
