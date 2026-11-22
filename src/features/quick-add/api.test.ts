import { afterEach, describe, expect, it, vi } from "vitest";
import { tasksApi } from "@/features/tasks/api";
import { quickAddApi } from "./api";

const today = "2026-11-17";

describe("quick-add preview", () => {
  it("shows the normalized date, priority and tags of a valid draft", () => {
    expect(quickAddApi.preview("Corrigir login #BUG !high amanhã", today))
      .toMatchObject({ title: "Corrigir login", tags: ["bug"], priority: "high", due: "2026-11-18" });
  });

  it("leaves escaped and missing shortcuts out of the preview", () => {
    const preview = quickAddApi.preview(String.raw`Discuss \#bug \today`, today);
    expect(preview).toMatchObject({ tags: [], due: null });
    expect(preview).not.toHaveProperty("priority");
  });

  it("waits for valid input and a known local day", () => {
    expect(quickAddApi.preview(" ", today)).toBeNull();
    expect(quickAddApi.preview("#bug tomorrow", today)).toBeNull();
    expect(quickAddApi.preview("Report tomorrow", "")).toBeNull();
  });
});

describe("quick-add in the active list", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves an explicit due date when a task is added to Today", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    await quickAddApi.create("Draft notes tomorrow", today, { plannedFor: today });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft notes", due: "2026-11-18", plannedFor: today }));
  });

  it("assigns the active project and leaves the default priority to the server", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    const projectId = "00000000-0000-4000-8000-000000000001";
    await quickAddApi.create("Draft notes", today, { projectId });
    const [input] = create.mock.calls[0];
    expect(input).toMatchObject({ projectId, title: "Draft notes", tags: [] });
    expect(input).not.toHaveProperty("priority");
  });

  it("combines typed tags with the active tag, counting each tag once", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    await quickAddApi.create("Draft notes #work", today, { tag: "writing" });
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["work", "writing"] }));
    await quickAddApi.create("Draft notes #WORK #client", today, { tag: "work" });
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["work", "client"] }));
  });

  it("rejects an eleventh distinct tag before saving", async () => {
    const create = vi.spyOn(tasksApi, "create").mockResolvedValue([]);
    const tags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(" ");
    await expect(quickAddApi.create(`Draft notes ${tags}`, today, { tag: "writing" }))
      .rejects.toMatchObject({ code: "invalid_quick_task" });
    expect(create).not.toHaveBeenCalled();
    await quickAddApi.create(`Draft notes ${tags}`, today, { tag: "tag0" });
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("controlled quick-add details", () => {
  it("applies common defaults to each line and lets recognized text override them", () => {
    const project = { id: "00000000-0000-4000-8000-000000000002", name: "Acme Web" };
    const defaults = { priority: "low", due: today, tags: ["team"], tag: "work",
      projectId: "00000000-0000-4000-8000-000000000001" } as const;
    expect(quickAddApi.previewDrafts("First !high tomorrow @acme-web ~30m #bug\n\nSecond @unknown", today, {
      ...defaults, tags: [...defaults.tags], plannedFor: today, estimateHours: 2,
    }, [project])).toMatchObject([
      { title: "First", priority: "high", due: "2026-11-18", estimateHours: 0.5, projectId: project.id, tags: ["bug", "team", "work"], plannedFor: today },
      { title: "Second @unknown", priority: "low", due: today, projectId: defaults.projectId, tags: ["team", "work"], plannedFor: today, estimateHours: 2 },
    ]);
    expect(quickAddApi.previewDrafts("Call @amanha 9h", today, { plannedFor: null, projectId: null }, [project]))
      .toMatchObject([{ title: "Call", due: "2026-11-18", partOfDay: "morning", projectId: null }]);
  });

  it("removes only the shortcuts that correspond to the control being edited", () => {
    expect(quickAddApi.stripTokens(String.raw`!high Draft \!low #work`, today, [], "priority")).toBe(String.raw`Draft \!low #work`);
    expect(quickAddApi.stripTokens(String.raw`tomorrow Draft \tomorrow #work`, today, [], "due")).toBe(String.raw`Draft \tomorrow #work`);
    expect(quickAddApi.stripTokens(String.raw`#work Draft \#work #docs`, today, [], "tag", "work")).toBe(String.raw`Draft \#work #docs`);
  });
});

it("turns a picked frequency into a rule that repeats from each line's own date", () => {
  expect(quickAddApi.previewDrafts("Stand-up\nReview @sex\nRent 2026-12-05", today, { repeat: "weekly" }, [])).toMatchObject([
    { title: "Stand-up", due: today, repeat: { frequency: "weekly", days: [2] } },
    { title: "Review", due: "2026-11-20", repeat: { frequency: "weekly", days: [5] } },
    { title: "Rent", due: "2026-12-05", repeat: { frequency: "weekly", days: [6] } },
  ]);
  expect(quickAddApi.previewDrafts("Rent 2026-12-05", today, { repeat: "monthly" }, [])?.[0].repeat).toEqual({ frequency: "monthly", day: 5 });
  expect(quickAddApi.previewDrafts("Stretch", today, { repeat: "daily", due: "2026-11-19" }, [])?.[0]).toMatchObject({ due: "2026-11-19", repeat: { frequency: "daily" } });
  expect(quickAddApi.previewDrafts("Stretch", today, { repeat: "weekdays" }, [])?.[0].repeat).toEqual({ frequency: "weekdays" });
  expect(quickAddApi.previewDrafts("Stretch", today, {}, [])?.[0].repeat).toBeNull();
});

it("gives every line the part of the day that was picked, on its own date or today", () => {
  expect(quickAddApi.previewDrafts("Call Ana\nPlan @sex\nReview @amanha 9h", today, { partOfDay: "afternoon" }, [])).toMatchObject([
    { title: "Call Ana", due: today, partOfDay: "afternoon" },
    { title: "Plan", due: "2026-11-20", partOfDay: "afternoon" },
    { title: "Review", due: "2026-11-18", partOfDay: "morning" },
  ]);
  expect(quickAddApi.previewDrafts("Call Ana", today, {}, [])?.[0]).toMatchObject({ due: null });
});

it("removes a token with one neighbouring space, wherever it sits and on every line", () => {
  const project = { id: "00000000-0000-4000-8000-000000000002", name: "Acme Web" };
  expect(quickAddApi.stripTokens("Draft @amanha 14h now\nPlan @sex", today, [], "due")).toBe("Draft now\nPlan");
  expect(quickAddApi.stripTokens("Draft !alta", today, [], "priority")).toBe("Draft");
  expect(quickAddApi.stripTokens("Draft +acme-web today @acme-web t30m", today, [project], "project")).toBe("Draft today t30m");
  expect(quickAddApi.stripTokens("Draft ~2h notes t30m", today, [], "estimate")).toBe("Draft notes");
  expect(quickAddApi.stripTokens("Draft #a #b", today, [], "tag")).toBe("Draft");
});

it("exposes what was typed for the field highlight, the chips and the row editor", () => {
  expect(quickAddApi.parse("Plan #a @amanha", today)).toMatchObject({ title: "Plan", tags: ["a"], due: "2026-11-18" });
  expect(quickAddApi.tokens("One #a\nTwo !alta", today).map(({ type, start }) => [type, start])).toEqual([["tag", 4], ["priority", 11]]);
  expect(quickAddApi.warnings("One\nPay @31/02", today)).toEqual([{ kind: "date", text: "@31/02", start: 8, end: 14 }]);
  expect(quickAddApi.edit("Pay", "Pay @amanha", today)).toEqual({ title: "Pay", changes: { due: "2026-11-18" } });
});

it("holds a warning back while its word is still being typed", () => {
  const text = "Pay @25/ now +nope";
  const [date, project] = quickAddApi.warnings(text, today);
  expect([date.text, project.text]).toEqual(["@25/", "+nope"]);
  // Inside the word or right after its last character, the next key may still turn it into a date.
  expect(quickAddApi.warnings(text, today, [], { caret: 6 })).toEqual([project]);
  expect(quickAddApi.warnings(text, today, [], { caret: date.end })).toEqual([project]);
  expect(quickAddApi.warnings(text, today, [], { caret: text.length })).toEqual([date]);
  // Before the word, after a space past it, or with the field left, it is reported.
  expect(quickAddApi.warnings(text, today, [], { caret: date.start })).toEqual([date, project]);
  expect(quickAddApi.warnings(text, today, [], { caret: date.end + 1 })).toEqual([date, project]);
  expect(quickAddApi.warnings(text, today, [], { caret: null })).toEqual([date, project]);
});

it("leaves the words of the title being edited unmarked", () => {
  expect(quickAddApi.tokens("Ligar hoje #casa", today, [], "Ligar hoje").map(({ type }) => type)).toEqual(["tag"]);
  expect(quickAddApi.tokens("Ligar hoje #casa", today).map(({ type }) => type)).toEqual(["due", "tag"]);
  expect(quickAddApi.warnings("Pagar +velho +nope", today, [], { editing: "Pagar +velho" }).map(({ text }) => text)).toEqual(["+nope"]);
});

it("reports the actual input line and validates the batch limits before writing", () => {
  expect(quickAddApi.problem(Array.from({ length: 51 }, (_, i) => `Task ${i}`).join("\n"), today, {}, []))
    .toEqual({ kind: "line_limit" });
  const tags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(" ");
  expect(quickAddApi.problem(`Valid\n\nSecond ${tags}`, today, { tags: ["# TEAM "] }, []))
    .toEqual({ kind: "tag_limit", line: 3 });
  expect(quickAddApi.previewDrafts("Plan #team", today, { tags: [" TEAM ", "#team"] }, [])?.[0].tags).toEqual(["team"]);
});

it("drops the bullets, numbers and checkboxes of a pasted list, and leaves a single line as written", () => {
  const pasted = "- Comprar leite\n1. Enviar relatório #work\n2) Ligar\n[ ] Pagar boleto\n- [x] Arquivar\n• Rever\n* Testar\n2026 planos";
  expect(quickAddApi.previewDrafts(pasted, today, {}, [])?.map(({ title }) => title))
    .toEqual(["Comprar leite", "Enviar relatório", "Ligar", "Pagar boleto", "Arquivar", "Rever", "Testar", "2026 planos"]);
  expect(quickAddApi.previewDrafts("- Comprar leite", today, {}, [])?.[0].title).toBe("- Comprar leite");
  expect(quickAddApi.previewDrafts("1.5h de reunião\n-sem espaço", today, {}, [])?.map(({ title }) => title)).toEqual(["1.5h de reunião", "-sem espaço"]);
  // A line that is only a marker keeps it, so the line still says what it is.
  expect(quickAddApi.previewDrafts("Um\n- [ ] ", today, {}, [])?.map(({ title }) => title)).toEqual(["Um", "- [ ]"]);
});

it("says what is wrong with the line that cannot be saved", () => {
  expect(quickAddApi.problem("First\n#tag !alta @amanha", today, {}, [])).toEqual({ kind: "title_missing", line: 2 });
  expect(quickAddApi.problem(`${"a".repeat(301)} #tag`, today, {}, [])).toEqual({ kind: "title_long", line: 1 });
  // A day the calendar cannot hold is the one refusal without a reason of its own.
  expect(quickAddApi.problem("Pay\n\nRent tomorrow", "9999-12-31", {}, [])).toEqual({ kind: "line_invalid", line: 3 });
  expect(quickAddApi.problem(`Plan #${"t".repeat(41)}`, today, {}, [])).toEqual({ kind: "tag_limit", line: 1 });
  expect(quickAddApi.problem("Plan", "not-a-day", {}, [])).toBeNull();
});
