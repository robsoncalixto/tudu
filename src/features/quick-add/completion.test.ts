import { describe, expect, it } from "vitest";
import { completionAt, isTyped, quickSuggestions } from "./completion";
import type { SuggestionSources } from "./schema";

const projects = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Website redesign" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Finanças" },
  { id: "00000000-0000-4000-8000-000000000003", name: "Sexta feira" },
];
const sources: SuggestionSources = { today: "2026-11-17", language: "en", tags: ["bug", "docs", "home", "work"], projects };
const pt: SuggestionSources = { ...sources, language: "pt-BR" };
const at = (text: string, caret = text.length) => completionAt(text, caret);
const suggest = (text: string, from = sources, used: string[] = []) => quickSuggestions(at(text)!, from, used);

describe("finding the token being typed", () => {
  it.each([
    ["#", { trigger: "#", query: "", start: 0, end: 1 }],
    ["Call #wo", { trigger: "#", query: "wo", start: 5, end: 8 }],
    ["Call\n+fin", { trigger: "+", query: "fin", start: 5, end: 9 }],
    ["Pay @25/11", { trigger: "@", query: "25/11", start: 4, end: 10 }],
    ["Pay !a", { trigger: "!", query: "a", start: 4, end: 6 }],
  ])("%j", (text, expected) => expect(at(text)).toEqual(expected));

  it.each(["", "Call", "Call ", "C#", "nome@email.com", String.raw`Keep \#tag`, "a+b", "wow!", "#tag "])("offers nothing for %j", (text) => {
    expect(at(text)).toBeNull();
  });

  it("needs the caret at the end of the word", () => {
    expect(at("Call #work now", 10)).toEqual({ trigger: "#", query: "work", start: 5, end: 10 });
    expect(at("Call #work now", 8)).toBeNull();
    expect(at("Call #work now", 4)).toBeNull();
  });
});

describe("suggestions", () => {
  it("offers saved tags by any part of the name, prefix matches first, and a new tag", () => {
    expect(suggest("#").map(({ kind, insert }) => [kind, insert])).toEqual([["tag", "#bug"], ["tag", "#docs"], ["tag", "#home"], ["tag", "#work"]]);
    expect(suggest("#o").map(({ insert }) => insert)).toEqual(["#docs", "#home", "#work", "#o"]);
    expect(suggest("#wo")).toEqual([{ kind: "tag", insert: "#work", label: "work", value: "work" }, { kind: "create", insert: "#wo", label: "wo", value: "wo" }]);
    expect(suggest("#WORK")).toEqual([{ kind: "tag", insert: "#work", label: "work", value: "work" }]);
    expect(suggest("#Café")).toEqual([{ kind: "create", insert: "#café", label: "café", value: "café" }]);
  });

  it("leaves out tags the draft already has and names that cannot be a tag", () => {
    expect(suggest("#", sources, ["bug", "work"]).map(({ insert }) => insert)).toEqual(["#docs", "#home"]);
    // The tag being typed is itself part of the draft and must still be offered.
    expect(suggest("#work", sources, ["work"]).map(({ insert }) => insert)).toEqual(["#work"]);
    expect(suggest("#wo", sources, ["wo", "bug"]).map(({ kind, insert }) => [kind, insert])).toEqual([["tag", "#work"], ["create", "#wo"]]);
    expect(suggest("#b", sources, ["b", "bug"])).toEqual([{ kind: "create", insert: "#b", label: "b", value: "b" }]);
    expect(suggest("#a,b")).toEqual([]);
    expect(suggest(`#${"t".repeat(41)}`)).toEqual([]);
  });

  it("caps a long tag list and keeps room for creating one", () => {
    const many = { ...sources, tags: Array.from({ length: 12 }, (_, index) => `tag${index}`) };
    expect(quickSuggestions(at("#")!, many)).toHaveLength(7);
    const typed = quickSuggestions(at("#tag")!, many);
    expect(typed).toHaveLength(7);
    expect(typed.at(-1)).toEqual({ kind: "create", insert: "#tag", label: "tag", value: "tag" });
  });

  it("offers only saved projects after +, written the way the parser reads them", () => {
    expect(suggest("+")).toEqual([
      { kind: "project", insert: "+finanças", label: "Finanças", value: projects[1].id },
      { kind: "project", insert: "+sexta-feira", label: "Sexta feira", value: projects[2].id },
      { kind: "project", insert: "+website-redesign", label: "Website redesign", value: projects[0].id },
    ]);
    expect(suggest("+FINANC").map(({ insert }) => insert)).toEqual(["+finanças"]);
    expect(suggest("+redesign").map(({ insert }) => insert)).toEqual(["+website-redesign"]);
    expect(suggest("+nope")).toEqual([]);
    const twins = { ...sources, projects: [...projects, { id: "00000000-0000-4000-8000-000000000004", name: "Financas" }] };
    expect(quickSuggestions(at("+fin")!, twins)).toEqual([]);
  });

  it("offers days in order after @, with the date each one means", () => {
    expect(suggest("@")).toEqual([
      { kind: "due", insert: "@today", label: "today", value: "2026-11-17" },
      { kind: "due", insert: "@tomorrow", label: "tomorrow", value: "2026-11-18" },
      { kind: "due", insert: "@thursday", label: "thursday", value: "2026-11-19" },
      { kind: "due", insert: "@friday", label: "friday", value: "2026-11-20" },
      { kind: "due", insert: "@saturday", label: "saturday", value: "2026-11-21" },
      { kind: "due", insert: "@sunday", label: "sunday", value: "2026-11-22" },
      { kind: "due", insert: "@monday", label: "monday", value: "2026-11-23" },
    ]);
    // Days come first; projects follow, matched by any part of the name.
    expect(suggest("@t").map(({ insert }) => insert)).toEqual(["@today", "@tomorrow", "@thursday", "@tuesday", "@sexta-feira", "@website-redesign"]);
    expect(suggest("@w")).toEqual([
      { kind: "due", insert: "@wednesday", label: "wednesday", value: "2026-11-18" },
      { kind: "project", insert: "@website-redesign", label: "Website redesign", value: projects[0].id },
    ]);
  });

  it("writes days in the interface language and still reads the other one", () => {
    expect(suggest("@", pt).map(({ insert }) => insert)).toEqual(["@hoje", "@amanhã", "@quinta", "@sexta", "@sábado", "@domingo", "@segunda"]);
    expect(suggest("@sex", pt)).toEqual([
      { kind: "due", insert: "@sexta", label: "sexta", value: "2026-11-20" },
      { kind: "project", insert: "@sexta-feira", label: "Sexta feira", value: projects[2].id },
    ]);
    expect(suggest("@ama", pt).map(({ insert }) => insert)).toEqual(["@amanhã"]);
    expect(suggest("@fri", pt).map(({ insert, value }) => [insert, value])).toEqual([["@friday", "2026-11-20"]]);
    expect(suggest("@amanh").map(({ insert }) => insert)).toEqual(["@amanhã"]);
  });

  it("shows how a typed date or time will be read, and nothing for one that does not exist", () => {
    expect(suggest("@25/11")).toEqual([{ kind: "due", insert: "@25/11", label: "@25/11", value: "2026-11-25" }]);
    expect(suggest("@16:00")).toEqual([{ kind: "due", insert: "@16:00", label: "@16:00", value: "2026-11-17", time: "16:00" }]);
    expect(suggest("@31/02")).toEqual([]);
    expect(suggest("@zzz")).toEqual([]);
    expect(quickSuggestions(at("@")!, { ...sources, today: "" })).toEqual([]);
  });

  it("offers priorities highest first, by word in either language or by number", () => {
    expect(suggest("!")).toEqual([
      { kind: "priority", insert: "!high", label: "high", value: "high" }, { kind: "priority", insert: "!medium", label: "medium", value: "medium" },
      { kind: "priority", insert: "!low", label: "low", value: "low" },
    ]);
    expect(suggest("!", pt).map(({ insert }) => insert)).toEqual(["!alta", "!média", "!baixa"]);
    expect(suggest("!m", pt).map(({ insert }) => insert)).toEqual(["!média"]);
    expect(suggest("!al").map(({ insert }) => insert)).toEqual(["!high"]);
    expect(suggest("!3", pt).map(({ insert }) => insert)).toEqual(["!baixa"]);
    expect(suggest("!x")).toEqual([]);
  });
});

describe("a token that is already complete", () => {
  const context = { today: sources.today, projects };
  const typed = (text: string, from = sources) => isTyped(text, suggest(text, from)[0], context);

  it("is recognized whatever language or shorthand it was typed in", () => {
    for (const text of ["!alta", "!high", "!1", "#work", "#novo", "@amanha", "@tomorrow", "@25/11", "@16:00", "+website-redesign", "+financas"]) {
      expect(typed(text), text).toBe(true);
    }
    expect(typed("@sexta", pt)).toBe(true);
  });

  it("is not claimed for a word that the suggestion would change", () => {
    for (const text of ["!al", "#wo", "@tom", "+web", "@fin", "#"]) expect(typed(text), text).toBe(false);
  });
});
