import { composer, expect, listTasks, openSection, row, saveSettings, seed, seedProjects, test } from "./support";

for (const l of [
  { locale: "en", edit: "Edit title", suggestions: "Suggestions", friday: /Friday · Nov 20/, error: "Something went wrong. Try again." },
  { locale: "pt-BR", edit: "Editar título", suggestions: "Sugestões", friday: /Sexta-feira · 20 de nov\./, error: "Algo deu errado. Tente novamente." },
] as const) {
  test(`tokens typed while editing a title set the task's fields in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    const [site] = await seedProjects(request, ["Site"]);
    const [task] = await seed(request, [{ title: "Call Ana tomorrow", tags: ["work"] }, { title: "Other", tags: ["client"] }]);
    await page.goto("/");
    const saved = async () => (await listTasks(request)).find((item) => item.id === task.id)!;
    await page.getByRole("button", { name: "Call Ana tomorrow", exact: true }).click();
    const edit = page.getByRole("combobox", { name: l.edit });
    await expect(edit).toBeFocused();
    await expect(edit).toHaveValue("Call Ana tomorrow");
    // The caret starts at the end, ready for a token.
    await edit.pressSequentially(" @fr");
    const list = page.getByRole("listbox", { name: l.suggestions });
    await expect(list.getByRole("option").first()).toHaveText(l.friday);
    await edit.press("Enter");
    await edit.pressSequentially("14h !alta #cl");
    await expect(list.getByRole("option").first()).toHaveText("#client");
    await edit.press("Tab");
    await edit.pressSequentially("+site t1h30");
    await edit.press("Enter");
    // "tomorrow" was already part of the saved title, so it stays text.
    await expect(row(openSection(page), "Call Ana tomorrow")).toBeVisible();
    await expect.poll(saved).toMatchObject({
      title: "Call Ana tomorrow", due: "2026-11-20", partOfDay: "afternoon", priority: "high", tags: ["work", "client"], projectId: site.id, estimateHours: 1.5,
    });

    // Escape closes the suggestions first and then leaves the edit without saving.
    await page.getByRole("button", { name: "Call Ana tomorrow", exact: true }).click();
    await edit.pressSequentially(" renamed @");
    await expect(list).toBeVisible();
    await edit.press("Escape");
    await expect(list).toBeHidden();
    await expect(edit).toBeFocused();
    await edit.press("Escape");
    await expect(page.getByRole("button", { name: "Call Ana tomorrow", exact: true })).toBeFocused();

    // A title made only of tokens is not saved, and neither are its tokens.
    await page.getByRole("button", { name: "Call Ana tomorrow", exact: true }).click();
    await edit.fill("!baixa #x");
    await edit.press("Enter");
    await expect(row(openSection(page), "Call Ana tomorrow")).toBeVisible();

    // Leaving the field saves, with the title and a token together.
    await page.getByRole("button", { name: "Call Ana tomorrow", exact: true }).click();
    await edit.fill("Call Ana about the report !baixa");
    await composer(page).click();
    await expect(row(openSection(page), "Call Ana about the report")).toBeVisible();
    await expect.poll(saved).toMatchObject({ title: "Call Ana about the report", priority: "low", due: "2026-11-20", tags: ["work", "client"] });
  });

  test(`a failed title edit restores the task in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await seed(request, [{ title: "Stable title" }]);
    await page.goto("/");
    await page.route("**/api/tasks/*", (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    await page.getByRole("button", { name: "Stable title", exact: true }).click();
    const edit = page.getByRole("combobox", { name: l.edit });
    await edit.fill("Changed title !alta");
    await edit.press("Enter");
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(row(openSection(page), "Stable title")).toBeVisible();
    expect((await listTasks(request))[0]).toMatchObject({ title: "Stable title", priority: "medium" });
  });
}
