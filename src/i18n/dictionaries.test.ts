import { describe, expect, it } from "vitest";
import { dictionaries, errorMessage, isLocale, LOCALES } from "./index";

describe("dictionaries", () => {
  it("has no empty strings in any language", () => {
    for (const locale of LOCALES) {
      const walk = (value: unknown, path: string) => {
        if (typeof value === "string") expect(value.trim(), `${locale}.${path}`).not.toBe("");
        else if (value && typeof value === "object") {
          for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
        }
      };
      walk(dictionaries[locale], "t");
    }
  });

  it.each(LOCALES)("keeps the logo's accessible name in %s", (locale) => {
    expect(dictionaries[locale].brandName).toBe("TUDU");
  });

  it("handles singular and plural counts", () => {
    expect(dictionaries.en.added(1)).toBe("1 task added");
    expect(dictionaries.en.added(3)).toBe("3 tasks added");
    expect(dictionaries["pt-BR"].countOpen(1)).toBe("1 aberta");
    expect(dictionaries["pt-BR"].countOpen(2)).toBe("2 abertas");
  });
});

describe("errorMessage", () => {
  it("returns the text for a known code", () => {
    expect(errorMessage(dictionaries.en, "ai_busy")).toBe(dictionaries.en.errors.ai_busy);
  });

  it("falls back to the generic message for an unknown code", () => {
    expect(errorMessage(dictionaries.en, "something_new")).toBe(dictionaries.en.errors.generic);
  });
});

describe("isLocale", () => {
  it("accepts supported codes only", () => {
    expect(isLocale("pt-BR")).toBe(true);
    expect(isLocale("pt")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});
