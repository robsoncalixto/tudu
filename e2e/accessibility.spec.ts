import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { chip, composer, expect, openSection, row, saveSettings, seed, seedProjects, sidebar, taskDetails, taskPanel, test, TODAY } from "./support";

/** Fails on any issue axe rates serious or critical, naming the rule and the elements. */
async function audit(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(" ")).join(" | ")}`);
  expect(blocking, screen).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "pt-BR"] as const) {
    test(`the board and its layers have no serious accessibility issue in ${theme} ${locale}`, async ({ page, request }) => {
      await saveSettings(request, { locale, theme });
      const [project] = await seedProjects(request, ["Website redesign"]);
      await seed(request, [
        { title: "Prepare the quarterly report", priority: "high", due: "2026-11-16", tags: ["work"], projectId: project.id, notes: "Include the numbers.",
          steps: [{ id: "a", title: "Collect metrics", done: true }, { id: "b", title: "Write summary", done: false }] },
        { title: "Review pull requests", due: TODAY, plannedFor: TODAY, tags: ["work"] },
        { title: "Book flights", priority: "low", tags: ["travel"] },
      ]);
      await page.goto("/");
      await expect(row(openSection(page), "Book flights")).toBeVisible();
      await audit(page, "board");

      // The field with recognized tokens, a warning and the suggestion list open.
      await composer(page).fill("Pay the bill #work @amanha 14h !alta @31/02");
      await audit(page, "field with tokens");
      await composer(page).pressSequentially(" #");
      await expect(page.getByRole("listbox").first()).toBeVisible();
      await audit(page, "suggestions");
      await composer(page).press("Escape");

      for (const name of [locale === "en" ? "Priority" : "Prioridade", locale === "en" ? "Project" : "Projeto"]) {
        await chip(page, name).click();
        await expect(page.getByRole("menu", { name, exact: true })).toBeVisible();
        await audit(page, `${name} menu`);
        await page.keyboard.press("Escape");
      }
      await chip(page, locale === "en" ? "Tags" : "Etiquetas").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, "tag picker");
      await page.keyboard.press("Escape");
      await composer(page).fill("One\nTwo");
      await audit(page, "several lines");
      await composer(page).fill("");

      await row(openSection(page), "Book flights").getByRole("checkbox").click();
      await expect(page.getByRole("status")).not.toHaveText("");
      // Colours are measured once the notice has finished fading in.
      await expect(page.getByRole("status")).toHaveCSS("opacity", "1");
      await audit(page, "undo notice");

      await page.getByRole("button", { name: "Review pull requests", exact: true }).click();
      await audit(page, "title editor");
      await page.keyboard.press("Escape");
      await taskDetails(row(openSection(page), "Prepare the quarterly report")).click();
      await expect(taskPanel(page)).toBeVisible();
      await audit(page, "task details");
      await page.keyboard.press("Escape");

      await page.locator("main").focus();
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, "shortcut sheet");
      await page.keyboard.press("Escape");

      await sidebar(page).getByRole("button", { name: locale === "en" ? "New project" : "Novo projeto", exact: true }).click();
      await audit(page, "new project field");
      await page.keyboard.press("Escape");
    });
  }

  test(`the other screens and the phone layout have no serious accessibility issue in ${theme}`, async ({ page, request }) => {
    await saveSettings(request, { theme });
    await seed(request, [{ title: "Review pull requests", due: TODAY, tags: ["work"] }]);
    for (const path of ["/agent", "/work-log", "/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, path);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(row(openSection(page), "Review pull requests")).toBeVisible();
    await audit(page, "phone board");
    await composer(page).fill("Call Ana #work !alta");
    await audit(page, "phone field");
    // An emptied list shows the empty view.
    await composer(page).fill("");
    await sidebar(page).getByRole("button", { name: /^Today,/ }).click();
    await row(openSection(page), "Review pull requests").getByRole("checkbox").click();
    // The notice fades in; its colours are judged once it is fully there.
    await expect(page.getByRole("status")).toHaveCSS("opacity", "1");
    await audit(page, "phone empty view");
  });
}
