import { composer, doneSection, expect, listTasks, openApp, openSection, seed, seedProjects, setLanguage, sidebar, test, TODAY } from "./support";

const languages = [
  { code: "en", help: "Keyboard shortcuts", close: "Close shortcuts", confirm: "Delete this task?", cancel: "Cancel", delete: "Delete task", markDone: "Mark as done", edit: "Edit title", project: "Project", checklist: "Checklist 0/0", step: "New step", error: "Something went wrong. Try again.", all: "All tasks", today: "Today" },
  { code: "pt-BR", help: "Atalhos de teclado", close: "Fechar atalhos", confirm: "Excluir esta tarefa?", cancel: "Cancelar", delete: "Excluir tarefa", markDone: "Marcar como concluída", edit: "Editar título", project: "Projeto", checklist: "Etapas 0/0", step: "Nova etapa", error: "Algo deu errado. Tente novamente.", all: "Todas as tarefas", today: "Hoje" },
];

for (const l of languages) {
  test(`focuses the composer and navigates visible tasks with the keyboard in ${l.code}`, async ({ page, request }) => {
    const tasks = await seed(request, [
      { title: "First task", due: TODAY }, { title: "Second task", due: "2026-11-18" },
      { title: "Third task", due: "2026-11-19" }, { title: "Already done", due: "2026-11-16" },
    ]);
    await request.patch(`/api/tasks/${tasks[3].id}`, { data: { done: true } });
    await openApp(page); await setLanguage(page, l.code);
    const help = sidebar(page).getByRole("button", { name: l.help, exact: true });
    await help.focus(); await page.keyboard.press("n");
    await expect(composer(page)).toBeFocused();
    await help.focus(); await page.keyboard.press("/");
    await expect(composer(page)).toBeFocused();
    await help.focus(); await page.keyboard.press("j");
    const first = page.getByRole("listitem", { name: "First task", exact: true });
    const second = page.getByRole("listitem", { name: "Second task", exact: true });
    const third = page.getByRole("listitem", { name: "Third task", exact: true });
    await expect(first).toBeFocused();
    expect(await first.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await page.keyboard.press("ArrowDown"); await expect(second).toBeFocused();
    await page.keyboard.press("k"); await expect(first).toBeFocused();
    await page.keyboard.press("ArrowUp"); await expect(first).toBeFocused();
    await page.keyboard.press("j"); await page.keyboard.press("j");
    await page.keyboard.press("j"); await expect(third).toBeFocused();
    await expect(page.getByRole("listitem", { name: "Already done", exact: true })).toBeHidden();
    await doneSection(page).locator(":scope > summary").click();
    await third.focus(); await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listitem", { name: "Already done", exact: true })).toBeFocused();
    await sidebar(page).getByRole("button", { name: new RegExp(`^${l.today}`) }).click();
    await doneSection(page).locator(":scope > summary").click();
    await help.focus(); await page.keyboard.press("j"); await expect(first).toBeFocused();
    await page.keyboard.press("j"); await expect(first).toBeFocused();
    expect((await listTasks(request)).filter((task) => task.done)).toHaveLength(1);
  });

  test(`completes, reopens and recovers failed changes with focus in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "First task", due: TODAY }, { title: "Second task", due: "2026-11-18" }]);
    await openApp(page); await setLanguage(page, l.code);
    const first = page.getByRole("listitem", { name: "First task", exact: true });
    const second = page.getByRole("listitem", { name: "Second task", exact: true });
    await first.focus();
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await page.keyboard.press("x");
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(first).toBeFocused();
    expect((await listTasks(request)).every((task) => !task.done)).toBe(true);
    await page.unroute("**/api/tasks/*");
    await page.keyboard.press("x");
    await expect(second).toBeFocused();
    await expect(first).toBeHidden();
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
    await doneSection(page).locator(":scope > summary").click();
    await first.focus(); await page.keyboard.press("x");
    await expect(openSection(page).getByRole("listitem", { name: "First task", exact: true })).toBeVisible();
    await expect(second).toBeFocused();
    await expect.poll(async () => (await listTasks(request))[0].done).toBe(false);
  });

  test(`deletion requires confirmation and recovers in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "First task", due: TODAY }, { title: "Second task", due: "2026-11-18" }]);
    await openApp(page); await setLanguage(page, l.code);
    const first = page.getByRole("listitem", { name: "First task", exact: true });
    await first.focus(); await page.keyboard.press("Delete");
    const dialog = page.getByRole("dialog", { name: l.confirm, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: l.cancel, exact: true })).toBeFocused();
    expect(await listTasks(request)).toHaveLength(2);
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(first).toBeFocused();
    await page.keyboard.press("Backspace");
    await dialog.getByRole("button", { name: l.cancel, exact: true }).click();
    await expect(first).toBeFocused();
    await page.keyboard.press("Delete");
    await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await dialog.getByRole("button", { name: l.delete, exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(l.error);
    expect(await listTasks(request)).toHaveLength(2);
    await page.unroute("**/api/tasks/*");
    await dialog.getByRole("button", { name: l.delete, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("listitem", { name: "Second task", exact: true })).toBeFocused();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Second task"]);
    await page.keyboard.press("Delete");
    await dialog.getByRole("button", { name: l.delete, exact: true }).click();
    await expect(composer(page)).toBeFocused();
    expect(await listTasks(request)).toEqual([]);
  });

  test(`help is modal, localized and fits a phone in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Task" }]);
    await page.setViewportSize({ width: 320, height: 812 });
    await openApp(page); await setLanguage(page, l.code);
    const task = page.getByRole("listitem", { name: "Task", exact: true });
    await task.focus(); await page.keyboard.press("?");
    const dialog = page.getByRole("dialog", { name: l.help, exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: l.close, exact: true });
    const heading = dialog.getByRole("heading", { name: l.help, exact: true });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    await page.keyboard.press("j"); await page.keyboard.press("x"); await page.keyboard.press("Delete");
    await page.keyboard.press("n"); await expect(heading).toBeFocused();
    await page.keyboard.press("Tab"); await expect(close).toBeFocused();
    expect((await listTasks(request))[0].done).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.keyboard.press("Escape"); await expect(task).toBeFocused();
    await sidebar(page).getByRole("button", { name: l.help, exact: true }).click();
    await expect(dialog).toBeVisible(); await close.click(); await expect(dialog).toBeHidden();
  });

  test(`shortcuts stay off in text, date, select and editable fields in ${l.code}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Acme"]);
    await seed(request, [{ title: "Task", due: TODAY, projectId: project.id }]);
    await openApp(page); await setLanguage(page, l.code);
    await composer(page).fill("draft"); await composer(page).pressSequentially("xjkn/?");
    await expect(composer(page)).toHaveValue("draftxjkn/?");
    const task = page.getByRole("listitem", { name: "Task", exact: true });
    await task.getByRole("button", { name: "Task", exact: true }).click();
    const title = task.getByRole("textbox", { name: l.edit, exact: true });
    await title.fill("Draft"); await title.press("x"); await title.press("Delete");
    await expect(title).toHaveValue("Draftx"); await title.press("Escape");
    await task.getByRole("combobox", { name: l.project, exact: true }).focus();
    await page.keyboard.press("x"); await page.keyboard.press("/");
    await task.getByLabel(l.code === "en" ? "Due date" : "Prazo", { exact: true }).focus();
    await page.keyboard.press("x");
    await task.getByText(l.checklist, { exact: true }).click();
    await task.getByRole("textbox", { name: l.step, exact: true }).fill("draft");
    await task.getByRole("textbox", { name: l.step, exact: true }).pressSequentially("xjkn/?");
    await expect(task.getByRole("textbox", { name: l.step, exact: true })).toHaveValue("draftxjkn/?");
    await page.evaluate(() => {
      const editor = document.createElement("div"); editor.contentEditable = "true"; editor.setAttribute("aria-label", "Scratch area");
      editor.setAttribute("role", "textbox"); document.body.append(editor); editor.focus();
    });
    await page.keyboard.type("xjkn/?");
    await expect(page.getByRole("textbox", { name: "Scratch area", exact: true })).toHaveText("xjkn/?");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await listTasks(request))[0]).toMatchObject({ title: "Task", done: false });
  });
}

test("a pending keyboard change blocks repeated mutations and preserves later navigation", async ({ page, request }) => {
  await seed(request, [{ title: "First", due: TODAY }, { title: "Second", due: "2026-11-18" }]);
  await openApp(page);
  let release = () => {};
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let changes = 0;
  await page.route("**/api/tasks/*", async (route) => { changes++; await wait; await route.continue(); });
  await page.getByRole("listitem", { name: "First", exact: true }).focus();
  await page.keyboard.press("x"); await expect.poll(() => changes).toBe(1);
  await page.keyboard.press("j");
  const second = page.getByRole("listitem", { name: "Second", exact: true });
  await expect(second).toBeFocused(); await page.keyboard.press("x");
  release(); await expect.poll(async () => (await listTasks(request))[0].done).toBe(true);
  await expect(second).toBeFocused(); expect(changes).toBe(1);
  expect((await listTasks(request))[1].done).toBe(false);
});

test("delete confirmation stays open while saving and restores keyboard focus after success", async ({ page, request }) => {
  await seed(request, [{ title: "Only task" }]);
  await openApp(page);
  let release = () => {};
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route("**/api/tasks/*", async (route) => { requested = true; await wait; await route.continue(); });
  await page.getByRole("listitem", { name: "Only task", exact: true }).focus();
  await page.keyboard.press("Delete");
  const dialog = page.getByRole("dialog", { name: "Delete this task?", exact: true });
  await dialog.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  release(); await expect(dialog).toBeHidden();
  await expect(composer(page)).toBeFocused();
  expect(await listTasks(request)).toEqual([]);
});

for (const action of ["complete", "delete"]) {
  test(`closed Done tasks cannot receive focus after ${action} even when the browser reports their layout rectangles`, async ({ page, request }) => {
    const tasks = await seed(request, [{ title: "Open task" }, { title: "Hidden completed task" }]);
    await request.patch(`/api/tasks/${tasks[1].id}`, { data: { done: true } });
    await openApp(page);
    // WebKit can report layout rectangles for descendants of closed details.
    await doneSection(page).getByRole("listitem", { name: "Hidden completed task", exact: true, includeHidden: true }).evaluate((element) => {
      Object.defineProperty(element, "getClientRects", { value: () => [new DOMRect(0, 0, 200, 80)] });
    });
    await page.getByRole("listitem", { name: "Open task", exact: true }).focus();
    if (action === "complete") await page.keyboard.press("x");
    else {
      await page.keyboard.press("Delete");
      await page.getByRole("dialog").getByRole("button", { name: "Delete task", exact: true }).click();
    }
    await expect(composer(page)).toBeFocused();
    const saved = await listTasks(request);
    expect(saved.every((task) => task.done)).toBe(true);
    expect(saved).toHaveLength(action === "complete" ? 2 : 1);
  });
}
