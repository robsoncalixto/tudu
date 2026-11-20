import { composer, expect, listTasks, openApp, openSection, row, seed, setLanguage, taskDetails, taskRows, test } from "./support";

const languages = [
  {
    code: "en", subtasks: "Subtasks", add: "Add subtask", submit: "Add", input: "New subtask",
    title: "Subtask title", save: "Save subtask", rename: "Rename subtask: ", remove: "Delete subtask: ",
    show: "Show subtasks", hide: "Hide subtasks", hideDone: "Hide completed subtasks",
    cancel: "Cancel", capture: "Create with AI", error: "Something went wrong. Try again.",
  },
  {
    code: "pt-BR", subtasks: "Subtarefas", add: "Adicionar subtarefa", submit: "Adicionar", input: "Nova subtarefa",
    title: "Título da subtarefa", save: "Salvar subtarefa", rename: "Renomear subtarefa: ", remove: "Excluir subtarefa: ",
    show: "Mostrar subtarefas", hide: "Ocultar subtarefas", hideDone: "Ocultar subtarefas concluídas",
    cancel: "Cancelar", capture: "Criar com IA", error: "Algo deu errado. Tente novamente.",
  },
];

for (const l of languages) {
  test(`adds and edits inline subtasks and cycles their visibility in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Prepare release" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(page, "Prepare release");
    const add = task.getByRole("button", { name: l.add, exact: true });
    const input = task.getByRole("textbox", { name: l.input, exact: true });
    const children = task.getByRole("list", { name: l.subtasks, exact: true });
    await expect(taskDetails(task)).toHaveAttribute("aria-expanded", "false");
    await expect(input).toBeHidden();
    await add.click();
    await expect(input).toBeFocused();
    for (const title of ["Write draft", "Review draft"]) {
      await input.fill(title);
      await input.press("Enter");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
    }
    await input.press("Escape");
    await expect(add).toBeFocused();
    await expect(taskRows(openSection(page))).toHaveCount(1);
    await expect(children.getByRole("listitem")).toHaveCount(2);
    const written = children.getByRole("checkbox", { name: "Write draft", exact: true });
    const review = children.getByRole("checkbox", { name: "Review draft", exact: true });
    await written.check();
    await expect.poll(async () => (await listTasks(request))[0].steps[0].done).toBe(true);
    expect((await listTasks(request))[0].done).toBe(false);

    const hideDone = task.getByRole("button", { name: new RegExp(`^${l.hideDone} \\d+/\\d+$`) });
    await expect(hideDone).toHaveText("1/2");
    await hideDone.click();
    await expect(written).toBeHidden();
    await expect(review).toBeVisible();
    const hide = task.getByRole("button", { name: new RegExp(`^${l.hide} \\d+/\\d+$`) });
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    await hide.click();
    await expect(review).toBeHidden();
    const show = task.getByRole("button", { name: new RegExp(`^${l.show} \\d+/\\d+$`) });
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await expect(show).toHaveText("1/2");
    await show.click();
    await expect(written).toBeChecked();
    await expect(review).toBeVisible();

    await children.getByRole("button", { name: l.rename + "Review draft", exact: true }).click();
    await children.getByRole("textbox", { name: l.title, exact: true }).fill("Publish draft");
    await children.getByRole("button", { name: l.save, exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].steps[1].title).toBe("Publish draft");
    await page.reload();
    await expect(hideDone).toHaveText("1/2");
    await expect(written).toBeChecked();
    await hideDone.click();
    const publish = children.getByRole("checkbox", { name: "Publish draft", exact: true });
    await publish.focus();
    await publish.press("Space");
    await expect(show).toHaveText("2/2");
    await expect(show).toBeFocused();
    await expect(publish).toBeHidden();
    expect((await listTasks(request))[0].done).toBe(false);
    await show.press("Enter");
    await expect(publish).toBeChecked();
    await publish.uncheck();
    await written.uncheck();
    await expect(hide).toHaveText("0/2");
    await expect.poll(async () => (await listTasks(request))[0].steps[0].done).toBe(false);
    await children.getByRole("button", { name: l.remove + "Publish draft", exact: true }).click();
    await expect.poll(async () => (await listTasks(request))[0].steps.map((step) => step.title)).toEqual(["Write draft"]);
    await expect(hide).toHaveText("0/1");
    await expect(taskDetails(task)).toHaveAttribute("aria-expanded", "false");
  });

  test(`subtask save failures preserve drafts and recover in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Retry checklist", steps: [{ id: "one", title: "Original", done: false }] }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(page, "Retry checklist");
    const input = task.getByRole("textbox", { name: l.input, exact: true });
    const submit = task.getByRole("button", { name: l.submit, exact: true });
    const children = task.getByRole("list", { name: l.subtasks, exact: true });
    const edit = children.getByRole("textbox", { name: l.title, exact: true });
    const save = children.getByRole("button", { name: l.save, exact: true });
    const fail = () => page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    const recover = () => page.unroute("**/api/tasks/*");
    await task.getByRole("button", { name: l.add, exact: true }).click();
    await fail();
    await input.fill("Keep this draft");
    await submit.click();
    await expect(page.getByRole("status")).toContainText(l.error);
    await expect(input).toHaveValue("Keep this draft");
    await expect(children.getByRole("checkbox", { name: "Keep this draft", exact: true })).toHaveCount(0);
    await recover();
    await submit.click();
    await expect.poll(async () => (await listTasks(request))[0].steps).toHaveLength(2);
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await input.press("Escape");

    await fail();
    const original = children.getByRole("checkbox", { name: "Original", exact: true });
    await original.click();
    await expect(original).not.toBeChecked();
    expect((await listTasks(request))[0].steps[0].done).toBe(false);
    await children.getByRole("button", { name: l.rename + "Original", exact: true }).click();
    await edit.fill("Keep this rename");
    await save.click();
    await expect(edit).toHaveValue("Keep this rename");
    await expect(save).toBeEnabled();
    expect((await listTasks(request))[0].steps[0].title).toBe("Original");
    await recover();
    await save.click();
    await expect.poll(async () => (await listTasks(request))[0].steps[0].title).toBe("Keep this rename");
    const remove = children.getByRole("button", { name: l.remove + "Keep this rename", exact: true });
    await fail();
    await remove.click();
    await expect(children.getByRole("checkbox", { name: "Keep this rename", exact: true })).toBeVisible();
    expect((await listTasks(request))[0].steps).toHaveLength(2);
    await recover();
    await remove.click();
    await expect.poll(async () => (await listTasks(request))[0].steps.map((step) => step.title)).toEqual(["Keep this draft"]);
  });

  test.describe(`subtasks on a phone in ${l.code}`, () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 812 } });
    test("child actions are touch-sized and editing can be canceled", async ({ page, request }) => {
      const longTitle = "A very long subtask title that wraps across a narrow phone screen";
      await seed(request, [{ title: "Small screen", steps: [{ id: "one", title: longTitle, done: false }] }]);
      await openApp(page);
      await setLanguage(page, l.code);
      const task = row(page, "Small screen");
      const add = task.getByRole("button", { name: l.add, exact: true });
      const toggle = task.getByRole("button", { name: new RegExp(`^${l.hide} \\d+/\\d+$`) });
      const children = task.getByRole("list", { name: l.subtasks, exact: true });
      const completed = children.getByRole("checkbox", { name: longTitle, exact: true });
      const rename = children.getByRole("button", { name: l.rename + longTitle, exact: true });
      const remove = children.getByRole("button", { name: l.remove + longTitle, exact: true });
      for (const control of [add, toggle, completed, rename, remove]) {
        const box = await control.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
      await toggle.tap({ position: { x: 3, y: 3 } });
      await expect(completed).toBeHidden();
      await add.tap({ position: { x: 3, y: 3 } });
      await expect(completed).toBeVisible();
      const input = task.getByRole("textbox", { name: l.input, exact: true });
      const submit = task.getByRole("button", { name: l.submit, exact: true });
      await expect(input).toBeFocused();
      await expect(submit).toBeDisabled();
      await input.fill("   ");
      await expect(submit).toBeDisabled();
      await task.getByRole("button", { name: l.cancel, exact: true }).tap();
      await rename.tap();
      const edit = children.getByRole("textbox", { name: l.title, exact: true });
      await expect(edit).toBeFocused();
      await edit.fill("Discard this edit");
      await edit.press("Escape");
      await expect(completed).toBeVisible();
      expect((await listTasks(request))[0].steps).toEqual([{ id: "one", title: longTitle, done: false }]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    });
  });

  test(`mocked AI capture displays persisted inline subtasks in ${l.code}`, async ({ page, request }) => {
    await page.route("**/api/ai/capture", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true } });
      const tasks = await seed(request, [{ title: "Captured plan", steps: [
        { id: "ai-one", title: "Draft", done: false }, { id: "ai-two", title: "Review", done: false },
      ] }]);
      await route.fulfill({ status: 201, json: { tasks } });
    });
    await openApp(page);
    await setLanguage(page, l.code);
    await composer(page).fill("Prepare the report: draft, then review");
    await page.getByRole("button", { name: l.capture, exact: true }).click();
    const task = row(page, "Captured plan");
    await expect(task.getByRole("button", { name: new RegExp(`^${l.hide} \\d+/\\d+$`) })).toHaveText("0/2");
    const children = task.getByRole("list", { name: l.subtasks, exact: true });
    await expect(children.getByRole("checkbox", { name: "Draft", exact: true })).toBeVisible();
    await expect(taskDetails(task)).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => (await listTasks(request))[0].steps).toHaveLength(2);
  });
}

test("keeps the parent completion control aligned with its title above inline subtasks", async ({ page, request }) => {
  await seed(request, [{ title: "Expanded task", steps: [{ id: "one", title: "First step", done: false }] }]);
  await openApp(page);
  const task = row(page, "Expanded task");
  await expect(task.getByRole("checkbox", { name: "First step", exact: true })).toBeVisible();
  const checkbox = await task.getByRole("checkbox", { name: "Mark as done", exact: true }).boundingBox();
  const title = await task.getByRole("button", { name: "Expanded task", exact: true }).boundingBox();
  expect(checkbox).not.toBeNull();
  expect(title).not.toBeNull();
  expect(Math.abs(checkbox!.y - title!.y)).toBeLessThan(4);
});
