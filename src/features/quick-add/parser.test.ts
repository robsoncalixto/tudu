import { describe, expect, it } from "vitest";
import { parseQuickTask } from "./parser";

const TODAY = "2026-11-17";

describe("quick-add shortcuts", () => {
  it("removes recognized tokens from the title and returns validated task fields", () => {
    expect(parseQuickTask("Fix login #bug !high tomorrow", TODAY)).toEqual({
      title: "Fix login", notes: "", priority: "high", due: "2026-11-18", tags: ["bug"],
      steps: [], projectId: null, repeat: null,
    });
  });
  it("normalizes whitespace and Unicode tags, deduplicating without translating content", () => {
    expect(parseQuickTask("  Preparar\n relatório\t#CAFÉ #cafe\u0301 #trabalho-2 !LOW HOJE  ", TODAY))
      .toMatchObject({ title: "Preparar relatório", tags: ["café", "trabalho-2"], priority: "low", due: TODAY });
  });
  it("leaves priority absent for the server default and allows an explicit medium priority", () => {
    expect(parseQuickTask("Call Ana", TODAY)).not.toHaveProperty("priority");
    expect(parseQuickTask("Call Ana !medium", TODAY).priority).toBe("medium");
  });
  it("uses the last priority and date, retaining tag insertion order", () => {
    expect(parseQuickTask("Report !high today #work !low tomorrow #client 2026-12-01 #work", TODAY))
      .toMatchObject({ title: "Report", priority: "low", due: "2026-12-01", tags: ["work", "client"] });
  });
  it("keeps unknown or invalid tokens and punctuation as title text", () => {
    const text = "Discuss C# owner#team # !urgent #work, tomorrow. 2026-02-30 constructor toString __proto__";
    expect(parseQuickTask(text, TODAY)).toMatchObject({ title: text, tags: [], due: null });
  });
  it("escapes valid shortcuts and preserves unrelated backslashes", () => {
    expect(parseQuickTask(String.raw`Discuss \#tag \!high \tomorrow \segunda-feira \2026-12-01 C:\work \literal`, TODAY))
      .toMatchObject({ title: String.raw`Discuss #tag !high tomorrow segunda-feira 2026-12-01 C:\work \literal`, tags: [], due: null });
    expect(parseQuickTask(String.raw`Keep \tomorrow`, "9999-12-31")).toMatchObject({ title: "Keep tomorrow", due: null });
  });
  it("rejects empty titles, oversized fields and invalid reference dates without truncating", () => {
    for (const text of [" ", "#work !high amanhã", "a".repeat(301), `Task #${"t".repeat(41)}`, `Task ${Array.from({ length: 11 }, (_, i) => `#tag${i}`).join(" ")}`]) {
      expect(() => parseQuickTask(text, TODAY)).toThrow();
    }
    expect(parseQuickTask("a".repeat(300), TODAY).title).toHaveLength(300);
    expect(parseQuickTask(`Task ${Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(" ")}`, TODAY).tags).toHaveLength(10);
    expect(() => parseQuickTask("Task", "2026-02-30")).toThrow();
  });
});

describe("quick-add dates", () => {
  it.each([
    ["today", TODAY], ["HOJE", TODAY], ["tomorrow", "2026-11-18"], ["amanhã", "2026-11-18"], ["AMANHA", "2026-11-18"],
    ["Monday", "2026-11-23"], ["segunda-feira", "2026-11-23"], ["segunda", "2026-11-23"],
    ["Tuesday", "2026-11-24"], ["terça-feira", "2026-11-24"], ["terca", "2026-11-24"],
    ["Wednesday", "2026-11-18"], ["quarta-feira", "2026-11-18"], ["quarta", "2026-11-18"],
    ["Thursday", "2026-11-19"], ["quinta-feira", "2026-11-19"], ["quinta", "2026-11-19"],
    ["Friday", "2026-11-20"], ["sexta-feira", "2026-11-20"], ["sexta", "2026-11-20"],
    ["Saturday", "2026-11-21"], ["sábado", "2026-11-21"], ["sabado", "2026-11-21"],
    ["Sunday", "2026-11-22"], ["domingo", "2026-11-22"], ["2028-02-29", "2028-02-29"],
  ])("resolves %s to %s without reading the system clock", (token, due) => {
    expect(parseQuickTask(`Task ${token}`, TODAY)).toMatchObject({ title: "Task", due });
  });
  it("advances across leap days, year ends and daylight-saving dates using calendar arithmetic", () => {
    expect(parseQuickTask("Task tomorrow", "2028-02-28").due).toBe("2028-02-29");
    expect(parseQuickTask("Task tomorrow", "2026-12-31").due).toBe("2027-01-01");
    expect(parseQuickTask("Task Sunday", "2026-03-07").due).toBe("2026-03-08");
    expect(() => parseQuickTask("Task tomorrow", "9999-12-31")).toThrow();
  });
});
