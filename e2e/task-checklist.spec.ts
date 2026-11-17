import { expect, listTasks, openApp, row, seed, sidebar, test, setLanguage } from "./support";

const languages = [
  { code: "EN", checklist: "Checklist", add: "Add step", input: "New step", title: "Step title", save: "Save step", rename: "Rename step: ", remove: "Delete step: ", cancel: "Cancel", error: "Something went wrong. Try again." },
  { code: "PT", checklist: "Etapas", add: "Adicionar etapa", input: "Nova etapa", title: "Título da etapa", save: "Salvar etapa", rename: "Renomear etapa: ", remove: "Excluir etapa: ", cancel: "Cancelar", error: "Algo deu errado. Tente novamente." },
];

for (const language of languages) {
  test(`checklist lifecycle and progress in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Prepare release" }]);
    await openApp(page);
    await setLanguage(page, language.code);
    const task = row(page, "Prepare release");
    await expect(task.getByText(`${language.checklist} 0/0`, { exact: true })).toBeVisible();
    await task.getByText(`${language.checklist} 0/0`, { exact: true }).click();
    const input = task.getByRole("textbox", { name: language.input, exact: true });
    for (const title of ["Write draft", "Review draft"]) {
      await input.fill(title);
      await task.getByRole("button", { name: language.add, exact: true }).click();
      await expect(input).toHaveValue("");
    }
    await task.getByRole("checkbox", { name: "Write draft", exact: true }).check();
    await expect(task.getByText(`${language.checklist} 1/2`, { exact: true })).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].steps[0].done).toBe(true);
    expect((await listTasks(request))[0].done).toBe(false);
    await task.getByRole("button", { name: language.rename + "Review draft", exact: true }).click();
    await task.getByRole("textbox", { name: language.title, exact: true }).fill("Publish draft");
    await task.getByRole("button", { name: language.save, exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].steps[1].title).toBe("Publish draft");
    await page.reload();
    await expect(task.getByText(`${language.checklist} 1/2`, { exact: true })).toBeVisible();
    await task.getByText(`${language.checklist} 1/2`, { exact: true }).click();
    await task.getByRole("checkbox", { name: "Write draft", exact: true }).uncheck();
    await expect(task.getByText(`${language.checklist} 0/2`, { exact: true })).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].steps[0].done).toBe(false);
    await task.getByRole("button", { name: language.remove + "Publish draft", exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].steps.map((step) => step.title)).toEqual(["Write draft"]);
    await expect(task.getByText(`${language.checklist} 0/1`, { exact: true })).toBeVisible();
  });

  test(`checklist save failures preserve drafts and recover in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Retry checklist", steps: [{ id: "one", title: "Original", done: false }] }]);
    await openApp(page);
    await setLanguage(page, language.code);
    const task = row(page, "Retry checklist");
    await task.getByText(`${language.checklist} 0/1`, { exact: true }).click();
    const fail = async () => page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    const recover = async () => page.unroute("**/api/tasks/*");
    await fail();
    await task.getByRole("textbox", { name: language.input, exact: true }).fill("Keep this draft");
    await task.getByRole("button", { name: language.add, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(language.error);
    await expect(task.getByRole("textbox", { name: language.input, exact: true })).toHaveValue("Keep this draft");
    await expect(task.getByRole("checkbox", { name: "Keep this draft", exact: true })).toHaveCount(0);
    await recover();
    await task.getByRole("button", { name: language.add, exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].steps).toHaveLength(2);
    await expect(task.getByRole("textbox", { name: language.input, exact: true })).toHaveValue("");
    await fail();
    await task.getByRole("checkbox", { name: "Original", exact: true }).click();
    await expect(task.getByRole("checkbox", { name: "Original", exact: true })).not.toBeChecked();
    expect((await listTasks(request))[0].steps[0].done).toBe(false);
    await task.getByRole("button", { name: language.rename + "Original", exact: true }).click();
    await task.getByRole("textbox", { name: language.title, exact: true }).fill("Keep this rename");
    await task.getByRole("button", { name: language.save, exact: true }).click();
    await expect(task.getByRole("textbox", { name: language.title, exact: true })).toHaveValue("Keep this rename");
    await expect(task.getByRole("button", { name: language.save, exact: true })).toBeEnabled();
    expect((await listTasks(request))[0].steps[0].title).toBe("Original");
    await recover();
    await task.getByRole("button", { name: language.save, exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].steps[0].title).toBe("Keep this rename");
    await fail();
    await task.getByRole("button", { name: language.remove + "Keep this rename", exact: true }).click();
    await expect(task.getByRole("checkbox", { name: "Keep this rename", exact: true })).toBeVisible();
    expect((await listTasks(request))[0].steps).toHaveLength(2);
    await recover();
    await task.getByRole("button", { name: language.remove + "Keep this rename", exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].steps.map((step) => step.title)).toEqual(["Keep this draft"]);
  });

  test(`checklist keyboard editing, cancellation and phone layout in ${language.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Small screen", steps: [{ id: "one", title: "A very long step title that wraps across a narrow phone screen", done: false }] }]);
    await page.setViewportSize({ width: 320, height: 900 });
    await openApp(page);
    await setLanguage(page, language.code);
    const task = row(page, "Small screen");
    await task.getByText(`${language.checklist} 0/1`, { exact: true }).click();
    const input = task.getByRole("textbox", { name: language.input, exact: true });
    await expect(task.getByRole("button", { name: language.add, exact: true })).toBeDisabled();
    await input.fill("   ");
    await expect(task.getByRole("button", { name: language.add, exact: true })).toBeDisabled();
    await task.getByRole("button", { name: new RegExp(`^${language.rename}`) }).click();
    const edit = task.getByRole("textbox", { name: language.title, exact: true });
    await expect(edit).toBeFocused();
    await edit.fill("Discard this edit");
    await edit.press("Escape");
    await expect(task.getByRole("checkbox", { name: /A very long step/ })).toBeVisible();
    expect((await listTasks(request))[0].steps[0].title).toContain("A very long step");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`mocked AI capture returns a persisted checklist in ${language.code}`, async ({ page, request }) => {
    await page.route("**/api/ai/capture", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true } });
      const tasks = await seed(request, [{ title: "Captured plan", steps: [
        { id: "ai-one", title: "Draft", done: false }, { id: "ai-two", title: "Review", done: false },
      ] }]);
      await route.fulfill({ status: 201, json: { tasks } });
    });
    await openApp(page);
    await setLanguage(page, language.code);
    await page.getByRole("textbox").fill("Prepare the report: draft, then review");
    await page.getByRole("button", { name: language.code === "EN" ? "Create with AI" : "Criar com IA", exact: true }).click();
    const task = row(page, "Captured plan");
    await expect(task.getByText(`${language.checklist} 0/2`, { exact: true })).toBeVisible();
    await task.getByText(`${language.checklist} 0/2`, { exact: true }).click();
    await expect(task.getByRole("checkbox", { name: "Draft", exact: true })).toBeVisible();
    await expect.poll(async () => (await listTasks(request))[0].steps).toHaveLength(2);
  });
}

test("keeps task controls aligned with the title when a checklist expands", async ({ page, request }) => {
  await seed(request, [{ title: "Expanded task", steps: [{ id: "one", title: "First step", done: false }] }]);
  await openApp(page);
  const task = row(page, "Expanded task");
  await task.getByText("Checklist 0/1", { exact: true }).click();
  const checkbox = await task.getByRole("checkbox", { name: "Mark as done", exact: true }).boundingBox();
  const title = await task.getByRole("button", { name: "Expanded task", exact: true }).boundingBox();
  expect(checkbox).not.toBeNull();
  expect(title).not.toBeNull();
  expect(Math.abs(checkbox!.y - title!.y)).toBeLessThan(4);
});
