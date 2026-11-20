import { describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n";
import { taskSchema } from "@/features/tasks/schema";
import { formatWorkLog, groupLabel } from "./format";
import { groupWorkLog } from "./selectors";

const task = taskSchema.parse({ id: "t1", title: "Review *draft* [link]\n#Heading <script>", done: true,
  completedAt: "2026-11-17T15:00:00.000Z", createdAt: "2026-11-01T12:00:00.000Z" });

describe("work-log export", () => {
  it("copies exact task content as one plain-text list item, with an optional summary", () => {
    expect(formatWorkLog("2026-11-17", groupWorkLog([task], [], "project"), "text", dictionaries.en, "en", "Reviewed the draft.")).toBe(
      "Work log — 2026-11-17\n\nReviewed the draft.\n\nTotal time: 0 hr (1 task without recorded time)\n\nNo project\n- Review *draft* [link] #Heading <script>\n\nTotal time: 0 hr (1 task without recorded time)",
    );
  });
  it("escapes user Markdown and HTML while preserving the export's own headings and list", () => {
    expect(formatWorkLog("2026-11-17", groupWorkLog([task], [], "none"), "markdown", dictionaries.en, "en")).toBe(
      "# Work log — 2026-11-17\n\nTotal time: 0 hr (1 task without recorded time)\n\n- Review \\*draft\\* \\[link\\] \\#Heading \\<script\\>",
    );
  });
  it("localizes labels without translating a person's task text", () => {
    const groups = groupWorkLog([task], [], "tag");
    expect(formatWorkLog("2026-11-17", groups, "text", dictionaries["pt-BR"], "pt-BR")).toContain("Resumo diário — 2026-11-17\n\nTempo total: 0 h (1 tarefa sem tempo registrado)\n\nSem etiquetas\n- Review");
    expect(groupLabel(groupWorkLog([task], [], "none")[0], dictionaries.en)).toBeNull();
  });
});
