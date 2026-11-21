import { describe, expect, it } from "vitest";
import { parseQuickAdd, parseQuickEdit, partOfDayAt, quickTextTokens } from "./parser";

const TODAY = "2026-11-17";
const pessoal = { id: "00000000-0000-4000-8000-000000000001", name: "Pessoal" };
const financas = { id: "00000000-0000-4000-8000-000000000002", name: "Finanças" };
const site = { id: "00000000-0000-4000-8000-000000000003", name: "Website redesign" };
const context = { today: TODAY, projects: [pessoal, financas, site] };
const parse = (text: string) => parseQuickAdd(text, context);

describe("inline syntax", () => {
  it("reads the whole sentence from the acceptance criteria without a single control", () => {
    expect(parse("Revisar proposta #trabalho @amanha 14h !alta")).toMatchObject({
      title: "Revisar proposta", tags: ["trabalho"], due: "2026-11-18", time: "14:00", priority: "high",
      project: null, estimate: null, warnings: [],
    });
  });

  it.each([
    ["#trabalho", { tags: ["trabalho"] }], ["#casa", { tags: ["casa"] }],
    ["+pessoal", { project: pessoal.id }], ["+financas", { project: financas.id }], ["+FINANÇAS", { project: financas.id }],
    ["+website-redesign", { project: site.id }], ["@website-redesign", { project: site.id }],
    ["@hoje", { due: TODAY }], ["@today", { due: TODAY }],
    ["@amanha", { due: "2026-11-18" }], ["@amanhã", { due: "2026-11-18" }], ["@tomorrow", { due: "2026-11-18" }],
    ["@sex", { due: "2026-11-20" }], ["@sexta", { due: "2026-11-20" }], ["@sexta-feira", { due: "2026-11-20" }],
    ["@fri", { due: "2026-11-20" }], ["@FRIDAY", { due: "2026-11-20" }],
    ["@seg", { due: "2026-11-23" }], ["@ter", { due: "2026-11-24" }], ["@qua", { due: "2026-11-18" }],
    ["@qui", { due: "2026-11-19" }], ["@sab", { due: "2026-11-21" }], ["@sábado", { due: "2026-11-21" }], ["@dom", { due: "2026-11-22" }],
    ["@mon", { due: "2026-11-23" }], ["@tue", { due: "2026-11-24" }], ["@wed", { due: "2026-11-18" }],
    ["@thu", { due: "2026-11-19" }], ["@sat", { due: "2026-11-21" }], ["@sun", { due: "2026-11-22" }],
    ["@16:00", { due: TODAY, time: "16:00" }], ["@9h", { due: TODAY, time: "09:00" }],
    ["@14h30", { due: TODAY, time: "14:30" }], ["@2pm", { due: TODAY, time: "14:00" }], ["@12am", { due: TODAY, time: "00:00" }],
    ["@25/11", { due: "2026-11-25" }], ["@25/11 14h", { due: "2026-11-25", time: "14:00" }],
    ["@25/11/2026", { due: "2026-11-25" }], ["@5/1/27", { due: "2027-01-05" }], ["@2026-12-01", { due: "2026-12-01" }],
    ["@amanha 9:30", { due: "2026-11-18", time: "09:30" }], ["@sex 18h", { due: "2026-11-20", time: "18:00" }],
    ["!alta", { priority: "high" }], ["!media", { priority: "medium" }], ["!média", { priority: "medium" }], ["!baixa", { priority: "low" }],
    ["!1", { priority: "high" }], ["!2", { priority: "medium" }], ["!3", { priority: "low" }],
    ["!high", { priority: "high" }], ["!MEDIUM", { priority: "medium" }], ["!low", { priority: "low" }],
    ["t25m", { estimate: 25 / 60 }], ["t1h", { estimate: 1 }], ["t1h30m", { estimate: 1.5 }], ["t1h30", { estimate: 1.5 }], ["T2D", { estimate: 24 }], ["t1d2h", { estimate: 14 }],
    ["~30m", { estimate: 0.5 }], ["~1h30m", { estimate: 1.5 }], ["~1,5h", { estimate: 1.5 }],
  ])("understands %s", (token, expected) => {
    expect(parse(`Task ${token}`)).toMatchObject({ title: "Task", warnings: [], ...expected });
  });

  it("uses the next occurrence of a day and month that already passed", () => {
    expect(parse("Task @17/11").due).toBe(TODAY);
    expect(parse("Task @16/11").due).toBe("2027-11-16");
    expect(parse("Task @01/03").due).toBe("2027-03-01");
    expect(parseQuickAdd("Task @29/02", { today: "2027-03-01" }).due).toBe("2028-02-29");
  });

  it.each([
    "C#", "nome@email.com", "bla#bla", "a+b", "1+1", "wow!", "t25", "tm", "t0m", "t30m1h", "~0h", "#", "@", "+", "!", "@@amanha",
    "#tag,", "!urgente", "!0", "!4", "amanha.", "sex", "sexta", "seg", "ter", "sat", "sun", "16:00", "14h", "25/11",
  ])("leaves %s in the title", (word) => {
    const result = parse(`Falar com ${word} agora`);
    expect(result).toMatchObject({ title: `Falar com ${word} agora`, tags: [], project: null, due: null, priority: null, estimate: null, tokens: [] });
  });

  it("keeps an unknown @name as text without a warning, as before", () => {
    expect(parse("Falar com @ana")).toMatchObject({ title: "Falar com @ana", project: null, due: null, tokens: [], warnings: [] });
  });

  it("prefers a saved project when its name also reads as a date", () => {
    const hoje = { id: "00000000-0000-4000-8000-000000000009", name: "Hoje" };
    expect(parseQuickAdd("Task @hoje", { today: TODAY, projects: [hoje] })).toMatchObject({ project: hoje.id, due: null });
    expect(parseQuickAdd("Task hoje", { today: TODAY, projects: [hoje] })).toMatchObject({ project: null, due: TODAY });
  });

  it.each([
    [String.raw`\#tag`, "#tag"], [String.raw`\@amanha`, "@amanha"], [String.raw`\+pessoal`, "+pessoal"], [String.raw`\!alta`, "!alta"],
    [String.raw`\t25m`, "t25m"], [String.raw`\~2h`, "~2h"], [String.raw`\!`, "!"], [String.raw`\#`, "#"], [String.raw`\@16:00`, "@16:00"],
    [String.raw`C:\work`, String.raw`C:\work`], [String.raw`\literal`, String.raw`\literal`],
  ])("an escaped %s is saved as the literal %s", (typed, saved) => {
    expect(parse(`Discutir ${typed} hoje`)).toMatchObject({ title: `Discutir ${saved}`, due: TODAY, tags: [], project: null, priority: null, estimate: null });
  });

  it("accumulates tags and keeps the last date, project, priority and estimate", () => {
    expect(parse("Report #a !alta @hoje +pessoal t1h #b #A !baixa @sex +financas t2h")).toMatchObject({
      title: "Report", tags: ["a", "b"], priority: "low", due: "2026-11-20", project: financas.id, estimate: 2,
    });
  });

  it("keeps a typed date when a later token only adds a time", () => {
    expect(parse("Call @amanha @16:00")).toMatchObject({ due: "2026-11-18", time: "16:00" });
    expect(parse("Call @amanha 14h @sex")).toMatchObject({ due: "2026-11-20", time: null });
  });

  it("returns an empty title instead of throwing when only tokens were typed", () => {
    expect(parse("#trabalho !alta @amanha")).toMatchObject({ title: "", tags: ["trabalho"], priority: "high", due: "2026-11-18" });
    expect(parse("   ")).toMatchObject({ title: "", tokens: [] });
  });

  it.each([
    ["@31/02", "date"], ["@25/13", "date"], ["@99:99", "date"], ["@2026-02-30", "date"], ["@25h", "date"], ["@0/11", "date"],
    ["+inexistente", "project"],
  ])("keeps the invalid %s as text and reports it", (word, kind) => {
    const result = parse(`Pagar boleto ${word} !alta`);
    expect(result).toMatchObject({ title: `Pagar boleto ${word}`, due: null, project: null, priority: "high" });
    expect(result.warnings).toEqual([{ kind, text: word, start: 13, end: 13 + word.length }]);
  });

  it.each([
    ["Entregar depois de amanhã", "Entregar", "2026-11-19"], ["Entregar depois de amanha cedo", "Entregar cedo", "2026-11-19"],
    ["Ship the day after tomorrow", "Ship", "2026-11-19"], ["Ship day after tomorrow", "Ship", "2026-11-19"],
    ["Depois de amanhã", "", "2026-11-19"], ["Enviar @depois de amanhã", "Enviar", "2026-11-19"],
    ["Send @day after tomorrow now", "Send now", "2026-11-19"], ["Send @the day after tomorrow", "Send", "2026-11-19"],
    // Without the whole expression right before it, the day is the day itself.
    ["Entregar depois amanhã", "Entregar depois", "2026-11-18"], ["Falar de amanhã", "Falar de", "2026-11-18"],
    ["Call the day after #x tomorrow", "Call the day after", "2026-11-18"],
  ])("reads %s as the title %j due %s", (text, title, due) => {
    expect(parse(text)).toMatchObject({ title, due });
  });

  it("marks the whole day-after expression as one token, with the time that follows an @", () => {
    const text = "Entregar depois de amanhã cedo";
    const [token] = parse(text).tokens;
    expect(text.slice(token.start, token.end)).toBe("depois de amanhã");
    const timed = "Enviar @depois de amanhã 14h já";
    const result = parse(timed);
    expect(result).toMatchObject({ title: "Enviar já", due: "2026-11-19", time: "14:00", partOfDay: "afternoon" });
    expect(timed.slice(result.tokens[0].start, result.tokens[0].end)).toBe("@depois de amanhã 14h");
    // Written as plain words it is a date only, as every plain date word is.
    expect(parse("Enviar depois de amanhã 14h")).toMatchObject({ title: "Enviar 14h", due: "2026-11-19", time: null });
  });

  it("keeps the words of a saved title that only look like the expression", () => {
    expect(parseQuickAdd("Ligar depois de amanhã #x", { today: TODAY, literals: ["Ligar", "depois", "de", "amanhã"] }))
      .toMatchObject({ title: "Ligar depois de amanhã", due: null, tags: ["x"] });
  });

  it.each([["t45min", 0.75], ["~45min", 0.75], ["t90mins", 1.5], ["~1h30min", 1.5], ["t2h15min", 2.25]])("reads the estimate %s as %d hours", (token, hours) => {
    expect(parse(`Review ${token}`)).toMatchObject({ title: "Review", estimate: hours });
  });

  it("does not take a time that is out of range after a date", () => {
    expect(parse("Call @amanha 25h")).toMatchObject({ title: "Call 25h", due: "2026-11-18", time: null });
  });

  it("reports where each token sits, at the start, middle and end", () => {
    const text = "#bug Fix +pessoal login @amanha 14h now !alta t30m";
    const result = parse(text);
    expect(result.title).toBe("Fix login now");
    expect(result.tokens.map(({ type, value, start, end }) => [type, value, text.slice(start, end)])).toEqual([
      ["tag", "bug", "#bug"], ["project", pessoal.id, "+pessoal"], ["due", "2026-11-18", "@amanha 14h"],
      ["priority", "high", "!alta"], ["estimate", 0.5, "t30m"],
    ]);
  });

  it("collapses whitespace in the title and reads tokens split by tabs and line breaks", () => {
    expect(parse("  Preparar\n relatório\t#CAFÉ   hoje  ")).toMatchObject({ title: "Preparar relatório", tags: ["café"], due: TODAY });
  });

  it("returns nothing recognized when the reference day is missing", () => {
    expect(parseQuickAdd("Task #a @amanha !alta", { today: "" })).toMatchObject({ title: "Task @amanha", tags: ["a"], due: null, priority: "high" });
  });
});

describe("parts of the day", () => {
  it.each([["00:00", "morning"], ["11:59", "morning"], ["12:00", "afternoon"], ["17:59", "afternoon"], ["18:00", "evening"], ["23:59", "evening"]])(
    "%s is in the %s", (time, part) => expect(partOfDayAt(time)).toBe(part));
});

describe("token positions across lines", () => {
  it("offsets each line's tokens into the whole text and never joins lines", () => {
    const text = "Fix login #bug\n\nPlan trip @amanha\n14h !alta";
    expect(quickTextTokens(text, context).map(({ type, start, end }) => [type, text.slice(start, end)])).toEqual([
      ["tag", "#bug"], ["due", "@amanha"], ["priority", "!alta"],
    ]);
  });
});

describe("inline syntax while editing a saved title", () => {
  const edit = (original: string, edited: string) => parseQuickEdit(original, edited, context);

  it("applies only the tokens that were typed during the edit", () => {
    expect(edit("Call Ana", "Call Ana @sex !alta #cliente +pessoal t1h")).toEqual({
      title: "Call Ana", changes: { due: "2026-11-20", priority: "high", tags: ["cliente"], projectId: pessoal.id, estimateHours: 1 },
    });
  });

  it("keeps words that were already part of the saved title", () => {
    expect(edit("Discuss #bug tomorrow", "Discuss #bug tomorrow with Ana")).toEqual({ title: "Discuss #bug tomorrow with Ana", changes: {} });
    expect(edit("Discuss #bug tomorrow", "Discuss #bug tomorrow #bug")).toEqual({ title: "Discuss #bug tomorrow", changes: { tags: ["bug"] } });
    expect(edit("Reunião amanhã", "Reunião amanhã @sex 14h")).toEqual({
      title: "Reunião amanhã", changes: { due: "2026-11-20", partOfDay: "afternoon" },
    });
  });

  it("returns only a new title when no token was typed", () => {
    expect(edit("Old", "  New   title ")).toEqual({ title: "New title", changes: {} });
  });
});
