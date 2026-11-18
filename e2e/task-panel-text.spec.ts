import { expect, listTasks, openApp, row, seed, setLanguage, taskDetails, taskPanel, test } from "./support";

const languages = [
  { code: "en", editTitle: "Edit title", title: "Task title", notes: "Notes", editTags: "Edit tags", tags: "Tags",
    save: "Save", cancel: "Cancel", error: "Something went wrong. Try again." },
  { code: "pt-BR", editTitle: "Editar título", title: "Título da tarefa", notes: "Anotações", editTags: "Editar etiquetas", tags: "Etiquetas",
    save: "Salvar", cancel: "Cancelar", error: "Algo deu errado. Tente novamente." },
];

for (const l of languages) {
  test(`edits the title, notes and tags and preserves them after reload in ${l.code}`, async ({ page, request }) => {
    await seed(request, [
      { title: "Release draft", notes: "Original notes", tags: ["work"] },
      { title: "Other task", notes: "Different notes" },
    ]);
    await openApp(page);
    await setLanguage(page, l.code);
    await taskDetails(row(page, "Release draft")).click();
    const panel = taskPanel(page);
    const save = panel.getByRole("button", { name: l.save, exact: true });
    const title = panel.getByRole("textbox", { name: l.title, exact: true });
    const editTitle = panel.getByRole("button", { name: l.editTitle, exact: true });
    await editTitle.click();
    await title.fill("Discarded");
    await title.press("Escape");
    await expect(panel.getByRole("heading", { name: "Release draft", exact: true })).toBeVisible();
    await editTitle.click();
    await title.fill("Publish release");
    await save.click();
    const task = row(page, "Publish release");
    await expect(task).toBeVisible();
    const notes = panel.getByRole("textbox", { name: l.notes, exact: true });
    await expect(notes).toHaveValue("Original notes");
    await notes.fill("Check the build");
    await taskDetails(row(page, "Other task")).click();
    await expect(notes).toHaveValue("Different notes");
    await taskDetails(task).click();
    await expect(notes).toHaveValue("Check the build");
    await save.click();
    await expect(task.getByText("Check the build", { exact: true })).toBeVisible();
    const editTags = panel.getByRole("button", { name: l.editTags, exact: true });
    const tags = panel.getByRole("textbox", { name: l.tags, exact: true });
    await editTags.click();
    await tags.fill("release, work");
    await save.click();
    await expect(task.getByRole("button", { name: "#release", exact: true })).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({
      title: "Publish release", notes: "Check the build", tags: ["release", "work"],
    });
    await page.reload();
    await taskDetails(task).click();
    await expect(panel.getByRole("heading", { name: "Publish release", exact: true })).toBeVisible();
    await expect(notes).toHaveValue("Check the build");
    await editTags.click();
    await tags.fill("discard");
    await panel.getByRole("button", { name: l.cancel, exact: true }).click();
    await expect(tags).toBeHidden();
    expect((await listTasks(request))[0].tags).toEqual(["release", "work"]);
  });

  test(`a failed notes save keeps the edit available to retry in ${l.code}`, async ({ page, request }) => {
    const [before] = await seed(request, [{ title: "Revision", notes: "Original" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    await taskDetails(row(page, before.title)).click();
    const panel = taskPanel(page);
    const notes = panel.getByRole("textbox", { name: l.notes, exact: true });
    const save = panel.getByRole("button", { name: l.save, exact: true });
    const endpoint = `**/api/tasks/${before.id}`;
    await page.route(endpoint, (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await notes.fill("Keep my revision");
    await save.click();
    await expect(panel.getByRole("alert")).toHaveText(l.error);
    await expect(notes).toHaveValue("Keep my revision");
    await expect(save).toBeEnabled();
    expect((await listTasks(request))[0].notes).toBe("Original");
    await page.unroute(endpoint);
    await save.click();
    await expect.poll(async () => (await listTasks(request))[0].notes).toBe("Keep my revision");
    await expect(row(page, before.title).getByText("Keep my revision", { exact: true })).toBeVisible();
  });
}
