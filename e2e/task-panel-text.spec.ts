import { expect, listTasks, openApp, row, seed, setLanguage, taskDetails, taskPanel, test } from "./support";

const languages = [
  { code: "en", editTitle: "Edit title", title: "Task title", notes: "Notes", editTags: "Edit tags", tags: "Tags",
    saved: "Saved.", limit: "Use up to 10 tags of 40 characters each.", retry: "Retry", error: "Something went wrong. Try again." },
  { code: "pt-BR", editTitle: "Editar título", title: "Título da tarefa", notes: "Anotações", editTags: "Editar etiquetas", tags: "Etiquetas",
    saved: "Salvo.", limit: "Use até 10 etiquetas de 40 caracteres cada.", retry: "Tentar novamente", error: "Algo deu errado. Tente novamente." },
];

for (const l of languages) {
  test(`saves the title, notes and tags without a save button and keeps them after reload in ${l.code}`, async ({ page, request }) => {
    await seed(request, [
      { title: "Release draft", notes: "Original notes", tags: ["work"] },
      { title: "Other task", notes: "Different notes" },
    ]);
    await openApp(page);
    await setLanguage(page, l.code);
    await taskDetails(row(page, "Release draft")).click();
    const panel = taskPanel(page);
    const stored = async () => (await listTasks(request))[0];
    const title = panel.getByRole("textbox", { name: l.title, exact: true });
    const editTitle = panel.getByRole("button", { name: l.editTitle, exact: true });
    await expect(panel.getByRole("button", { name: /^(Save|Salvar|Cancel|Cancelar)$/ })).toHaveCount(0);
    await editTitle.click();
    await title.fill("Discarded");
    await title.press("Escape");
    await expect(panel.getByRole("heading", { name: "Release draft", exact: true })).toBeVisible();
    await expect(editTitle).toBeFocused();
    await editTitle.click();
    await title.fill("Publish release");
    await title.press("Enter");
    const task = row(page, "Publish release");
    await expect(task).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Publish release", exact: true })).toBeVisible();
    await expect(panel.getByText(l.saved, { exact: true })).toBeVisible();
    await expect(editTitle).toBeFocused();

    // Notes are saved a moment after the typing stops, with the field still in use.
    const notes = panel.getByRole("textbox", { name: l.notes, exact: true });
    await expect(notes).toHaveValue("Original notes");
    await notes.fill("Check the build");
    await expect.poll(async () => (await stored()).notes).toBe("Check the build");
    await expect(notes).toBeFocused();
    await expect(panel.getByRole("group", { name: l.notes, exact: true }).getByText(l.saved, { exact: true })).toBeVisible();
    await expect(task.getByText("Check the build", { exact: true })).toBeVisible();
    // Moving to another task saves what was still waiting.
    await notes.pressSequentially(" first");
    await taskDetails(row(page, "Other task")).click();
    await expect(notes).toHaveValue("Different notes");
    await expect.poll(async () => (await stored()).notes).toBe("Check the build first");
    await taskDetails(task).click();
    await expect(notes).toHaveValue("Check the build first");
    // Escape goes back to the notes as they were when the edit began, even after a save.
    await notes.fill("Throwaway");
    await expect.poll(async () => (await stored()).notes).toBe("Throwaway");
    await notes.press("Escape");
    await expect(notes).toHaveValue("Check the build first");
    await expect.poll(async () => (await stored()).notes).toBe("Check the build first");
    await expect(panel).toBeVisible();

    // The button is named by what it shows, the tags, and described as the way to edit them.
    const editTags = panel.getByRole("button", { name: new RegExp(`^${l.tags}`) });
    await expect(editTags).toHaveAccessibleDescription(l.editTags);
    const tags = panel.getByRole("textbox", { name: l.tags, exact: true });
    await editTags.click();
    await tags.fill("release, work");
    await tags.press("Enter");
    await expect(task.getByRole("button", { name: "#release", exact: true })).toBeVisible();
    await expect(editTags).toBeFocused();
    await expect.poll(stored).toMatchObject({ title: "Publish release", notes: "Check the build first", tags: ["release", "work"] });
    // A list that cannot be saved says why and is dropped on leaving the field.
    await editTags.click();
    await tags.fill(Array.from({ length: 11 }, (_, index) => `t${index}`).join(", "));
    await expect(panel.getByText(l.limit, { exact: true })).toBeVisible();
    await panel.getByRole("heading", { name: "Publish release", exact: true }).click();
    await expect(tags).toBeHidden();
    await page.reload();
    await taskDetails(task).click();
    await expect(panel.getByRole("heading", { name: "Publish release", exact: true })).toBeVisible();
    await expect(notes).toHaveValue("Check the build first");
    await editTags.click();
    await tags.fill("discard");
    await tags.press("Escape");
    await expect(tags).toBeHidden();
    await expect(panel).toBeVisible();
    expect((await stored()).tags).toEqual(["release", "work"]);
  });

  test(`a failed notes save keeps the edit available to retry in ${l.code}`, async ({ page, request }) => {
    const [before] = await seed(request, [{ title: "Revision", notes: "Original" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    await taskDetails(row(page, before.title)).click();
    const panel = taskPanel(page);
    const notes = panel.getByRole("textbox", { name: l.notes, exact: true });
    const endpoint = `**/api/tasks/${before.id}`;
    await page.route(endpoint, (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await notes.fill("Keep my revision");
    await expect(panel.getByRole("alert")).toContainText(l.error);
    await expect(notes).toHaveValue("Keep my revision");
    await expect(panel.getByText(l.saved, { exact: true })).toHaveCount(0);
    expect((await listTasks(request))[0].notes).toBe("Original");
    await page.unroute(endpoint);
    await panel.getByRole("alert").getByRole("button", { name: l.retry, exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].notes).toBe("Keep my revision");
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(row(page, before.title).getByText("Keep my revision", { exact: true })).toBeVisible();
  });
}
