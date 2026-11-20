import { sidebar, addTask, composer, expect, listTasks, openApp, openSection, taskRows, row, rowTitles, saveSettings, seed, seedProjects, taskDetails, taskPanel, test, TODAY, TOMORROW, setLanguage } from "./support";

test.describe("Composer", () => {
  test("Portuguese ordinals stay in ordinary task titles without adding a due date", async ({ page, request }) => {
    await openApp(page); await setLanguage(page, "pt-BR");
    for (const title of ["Revisar a segunda versão do relatório", "Revisar a quarta tentativa"]) {
      await composer(page).fill(title); await composer(page).press("Enter");
      await expect(row(openSection(page), title)).toBeVisible();
    }
    expect((await listTasks(request)).map(({ title, due }) => ({ title, due }))).toEqual([
      { title: "Revisar a segunda versão do relatório", due: null }, { title: "Revisar a quarta tentativa", due: null },
    ]);
  });
  test("adds a task with Enter and clears the field", async ({ page, request }) => {
    await openApp(page);
    await composer(page).fill("Call the supplier");
    await composer(page).press("Enter");

    await expect(row(openSection(page), "Call the supplier")).toBeVisible();
    await expect(composer(page)).toHaveValue("");
    await expect(composer(page)).toBeFocused();

    const [saved] = await listTasks(request);
    expect(saved).toMatchObject({ title: "Call the supplier", priority: "medium", due: null, done: false });
  });

  test("adds a task with the Add button", async ({ page }) => {
    await openApp(page);
    await composer(page).fill("Review the budget");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(row(openSection(page), "Review the budget")).toBeVisible();
  });

  test("does not add an empty task", async ({ page, request }) => {
    await openApp(page);
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();

    await composer(page).fill("   ");
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
    await composer(page).press("Enter");

    await expect(taskRows(openSection(page))).toHaveCount(0);
    expect(await listTasks(request)).toEqual([]);
  });

  test("Shift+Enter adds a line break instead of submitting", async ({ page, request }) => {
    await openApp(page);
    await composer(page).fill("line one");
    await composer(page).press("Shift+Enter");
    await composer(page).pressSequentially("line two");

    await expect(composer(page)).toHaveValue("line one\nline two");
    expect(await listTasks(request)).toEqual([]);
  });

  test("creates one task per nonempty line", async ({ page }) => {
    await openApp(page);
    await composer(page).fill("first line\nsecond line");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(row(openSection(page), "first line")).toBeVisible();
    await expect(row(openSection(page), "second line")).toBeVisible();
  });

  test("keeps the text and shows an error when saving fails", async ({ page }) => {
    await openApp(page);
    await page.route("**/api/tasks", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, json: { error: "boom" } })
        : route.fallback(),
    );

    await composer(page).fill("Will not save");
    await composer(page).press("Enter");

    await expect(page.getByRole("status")).toHaveText("Something went wrong. Try again.");
    await expect(composer(page)).toHaveValue("Will not save");
    await expect(taskRows(openSection(page))).toHaveCount(0);
  });

  test("explains how to turn AI on when there is no key", async ({ page }) => {
    await openApp(page);

    await composer(page).fill("some note");
    await page.getByRole("button", { name: "Set up AI capture" }).click();
    await expect(page.getByText("AI is off. Configure the selected provider's API key in the server's .env file.")).toBeVisible();
    const guide = page.getByRole("region", { name: "Set up AI capture" });
    await expect(guide.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("href", "/settings?from=tasks#ai-settings-heading");
    await expect(composer(page)).toHaveValue("some note");
    await expect(page.getByRole("button", { name: "Create with AI" })).toBeDisabled();
  });

  test.describe("with AI available", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/ai/capture", async (route) => {
        if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true } });
        const body = route.request().postDataJSON();
        expect(body).toEqual({ text: "Send Ana the draft by tomorrow and book a room", today: TODAY });
        return route.fulfill({
          status: 201,
          json: {
            tasks: [
              {
                id: "ai-1",
                title: "Send Ana the draft",
                notes: "",
                priority: "high",
                due: "2026-11-18",
                tags: ["ana"],
                done: false,
                createdAt: "2026-11-17T15:00:00.000Z",
                completedAt: null,
              },
              {
                id: "ai-2",
                title: "Book a room",
                notes: "For the review",
                priority: "medium",
                due: null,
                tags: [],
                done: false,
                createdAt: "2026-11-17T15:00:00.001Z",
                completedAt: null,
              },
            ],
          },
        });
      });
    });

    test("turns a note into several tasks with the button", async ({ page }) => {
      await openApp(page);
      await expect(page.getByRole("button", { name: "Create with AI" })).toHaveAttribute("title", /Enter adds tasks/);

      await composer(page).fill("Send Ana the draft by tomorrow and book a room");
      await page.getByRole("button", { name: "Create with AI" }).click();

      await expect(page.getByRole("status")).toHaveText("2 tasks added");
      expect(await rowTitles(openSection(page))).toEqual(["Send Ana the draft", "Book a room"]);
      const first = row(openSection(page), "Send Ana the draft");
      await expect(first.getByText("Tomorrow")).toBeVisible();
      await expect(first.getByRole("combobox", { name: "Priority", exact: true })).toHaveValue("high");
      await expect(first.getByRole("button", { name: "#ana" })).toBeVisible();
      await expect(row(openSection(page), "Book a room").getByText("For the review")).toBeVisible();
      await expect(composer(page)).toHaveValue("");
    });

    test("turns a note into tasks with Ctrl+Enter", async ({ page }) => {
      await openApp(page);
      await expect(page.getByRole("button", { name: "Create with AI" })).toHaveAttribute("title", /Enter adds tasks/);
      await composer(page).fill("Send Ana the draft by tomorrow and book a room");
      await composer(page).press("Control+Enter");

      await expect(page.getByRole("status")).toHaveText("2 tasks added");
      await expect(row(openSection(page), "Book a room")).toBeVisible();
    });
  });

  test("keeps the note and explains when AI finds no task", async ({ page }) => {
    await page.route("**/api/ai/capture", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { enabled: true } })
        : route.fulfill({ status: 422, json: { error: "no_tasks" } }),
    );
    await openApp(page);
    await expect(page.getByRole("button", { name: "Create with AI" })).toHaveAttribute("title", /Enter adds tasks/);

    await composer(page).fill("just thinking out loud");
    await page.getByRole("button", { name: "Create with AI" }).click();

    await expect(page.getByRole("status")).toHaveText("I couldn't find a task in that note.");
    await expect(composer(page)).toHaveValue("just thinking out loud");
  });

  test("a new task inherits the active tag and stays in view", async ({ page, request }) => {
    await request.post("/api/tasks", { data: [{ title: "Tagged", tags: ["work"] }] });
    await openApp(page);
    await sidebar(page).getByRole("button", { name: "#work" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("#work");
    await expect(page.locator("#open-heading")).toHaveText("Open 1");

    await addTask(page, "New assignment");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("#work");
    await expect(page.locator("#open-heading")).toHaveText("Open 2");
    expect((await listTasks(request)).find((task) => task.title === "New assignment")?.tags).toEqual(["work"]);
  });
});

for (const code of ["EN", "PT"]) {
  test(`AI capture selects an existing project in ${code}`, async ({ page, request }) => {
    const [project] = await seedProjects(request, ["Acme"]);
    await page.route("**/api/ai/capture", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true } });
      const saved = await request.post("/api/tasks", { data: { title: "Acme report", projectId: project.id } });
      await route.fulfill({ status: 201, json: await saved.json() });
    });
    await openApp(page);
    await setLanguage(page, code);
    await composer(page).fill("Write the report for Acme");
    await page.getByRole("button", { name: code === "EN" ? "Create with AI" : "Criar com IA", exact: true }).click();
    const report = row(page, "Acme report");
    await taskDetails(report).click();
    await expect(taskPanel(page).getByRole("combobox", { name: code === "EN" ? "Project" : "Projeto", exact: true })).toHaveValue(project.id);
    await expect.poll(async () => (await listTasks(request))[0].projectId).toBe(project.id);
  });
}

for (const l of [
  { code: "en", add: "Add", ai: "Create with AI", hint: "Quick-add shortcuts", preview: "Quick-add preview", high: "High", raw: "Fix login #BUG !high tomorrow", title: "Fix login", tomorrow: "tomorrow", today: "today", weekday: "Tuesday", invalid: "Add a title of up to 300 characters, with at most 10 tags of up to 40 characters each. Your text is still here.", error: "Something went wrong. Try again." },
  { code: "pt-BR", add: "Adicionar", ai: "Criar com IA", hint: "Atalhos de criação", preview: "Prévia da tarefa", high: "Alta", raw: "Corrigir login #BUG !high amanhã", title: "Corrigir login", tomorrow: "amanhã", today: "hoje", weekday: "terça-feira", invalid: "Adicione um título com até 300 caracteres e no máximo 10 etiquetas com até 40 caracteres cada. Seu texto continua aqui.", error: "Algo deu errado. Tente novamente." },
]) {
  test(`quick-add parses tags, priority and date without AI in ${l.code}`, async ({ page, request }) => {
    await openApp(page);
    await setLanguage(page, l.code);
    await expect(page.getByRole("button", { name: l.ai, exact: true })).toBeDisabled();
    await composer(page).fill(l.raw);
    const preview = page.getByRole("list", { name: l.preview });
    await expect(preview).toContainText("#bug");
    await expect(preview).toContainText(l.high);
    await expect(preview).toContainText(new RegExp(l.tomorrow, "i"));
    expect(await listTasks(request)).toEqual([]);
    await composer(page).press("Enter");
    await expect(row(openSection(page), l.title)).toBeVisible();
    await expect(preview).toHaveCount(0);
    expect((await listTasks(request))[0]).toMatchObject({ title: l.title, tags: ["bug"], priority: "high", due: "2026-11-18" });
    await page.reload();
    await expect(row(openSection(page), l.title).getByRole("button", { name: "#bug", exact: true })).toBeVisible();
    expect((await listTasks(request))[0].title).not.toMatch(/#BUG|!high|tomorrow|amanhã/);
  });

  test(`quick-add uses server defaults and all date forms in ${l.code}`, async ({ page, request }) => {
    await openApp(page);
    await setLanguage(page, l.code);
    // A changed server preference must apply even while this board is already open.
    await saveSettings(request, { defaultPriority: "high" });
    const outgoing = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/tasks"));
    await composer(page).fill(`Daily review #work ${l.today}`);
    await page.getByRole("button", { name: l.add, exact: true }).click();
    expect((await outgoing).postDataJSON()).not.toHaveProperty("priority");
    for (const [input, title, due, priority] of [
      [`Weekly report !low ${l.weekday}`, "Weekly report", "2026-11-24", "low"],
      ["Invoice !medium 2026-12-01", "Invoice", "2026-12-01", "medium"],
    ]) {
      await composer(page).fill(input);
      await page.getByRole("button", { name: l.add, exact: true }).click();
      await expect(row(openSection(page), title)).toBeVisible();
      expect((await listTasks(request)).find((task) => task.title === title)).toMatchObject({ due, priority });
    }
    expect((await listTasks(request)).find((task) => task.title === "Daily review")).toMatchObject({ due: TODAY, priority: "high", tags: ["work"] });
  });

  test(`quick-add validation and save failure keep the original text in ${l.code}`, async ({ page, request }) => {
    await openApp(page);
    await setLanguage(page, l.code);
    let saves = 0;
    await page.route("**/api/tasks", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      saves++;
      return route.fulfill({ status: 500, json: { error: "failed" } });
    });
    for (const invalid of [`#bug !high ${l.tomorrow}`, "x".repeat(301)]) {
      await composer(page).fill(invalid);
      await composer(page).press("Enter");
      await expect(page.getByRole("status")).toHaveText(l.invalid);
      await expect(composer(page)).toHaveValue(invalid);
    }
    expect(saves).toBe(0);
    expect(await listTasks(request)).toEqual([]);
    await composer(page).fill(l.raw);
    await composer(page).press("Enter");
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(composer(page)).toHaveValue(l.raw);
    expect(saves).toBe(1);
    await page.unroute("**/api/tasks");
    await composer(page).press("Enter");
    await expect(row(openSection(page), l.title)).toBeVisible();
    expect((await listTasks(request))[0]).toMatchObject({ title: l.title, tags: ["bug"], priority: "high", due: "2026-11-18" });
  });

  test(`quick-add escape and help work on a phone in ${l.code}`, async ({ page, request }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await openApp(page);
    await setLanguage(page, l.code);
    const input = composer(page);
    const field = await input.boundingBox();
    expect(field).not.toBeNull();
    // The inset beside the writing area also focuses the field on a phone.
    await page.mouse.click(field!.x - 4, field!.y + field!.height / 2);
    await expect(input).toBeFocused();
    const hint = page.getByRole("button", { name: l.hint, exact: true });
    expect((await hint.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await page.getByRole("button", { name: l.add, exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await hint.focus(); await hint.press("Enter");
    await expect(page.getByText(/#bug !high (tomorrow|amanhã) @[^ ]+ ~2h/)).toBeVisible();
    await expect(hint).toHaveAttribute("aria-expanded", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await composer(page).fill(String.raw`Discuss \#bug \!high \tomorrow`);
    await page.getByRole("button", { name: l.add, exact: true }).click();
    await expect(row(openSection(page), "Discuss #bug !high tomorrow")).toBeVisible();
    expect((await listTasks(request))[0]).toMatchObject({ title: "Discuss #bug !high tomorrow", tags: [], due: null, priority: "medium" });
  });

  test(`AI receives the full note without quick-add parsing in ${l.code}`, async ({ page, request }) => {
    await page.route("**/api/ai/capture", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true } });
      expect(route.request().postDataJSON()).toEqual({ text: l.raw, today: TODAY });
      const response = await request.post("/api/tasks", { data: { title: "AI result" } });
      return route.fulfill({ status: 201, json: await response.json() });
    });
    await openApp(page);
    await setLanguage(page, l.code);
    await composer(page).fill(l.raw);
    await page.getByRole("button", { name: l.ai, exact: true }).click();
    await expect(row(openSection(page), "AI result")).toBeVisible();
    expect((await listTasks(request))[0].title).toBe("AI result");
  });
}

for (const l of [
  { locale: "en", details: "New task details", priority: "New task priority", due: "New task due date", tag: "New task tag", preview: "Quick-add preview",
    project: /^Project: Other,/, error: "Something went wrong. Try again.", ai: "Create with AI", minute: "30 minutes" },
  { locale: "pt-BR", details: "Detalhes da nova tarefa", priority: "Prioridade da nova tarefa", due: "Prazo da nova tarefa", tag: "Etiqueta da nova tarefa", preview: "Prévia da tarefa",
    project: /^Projeto: Other,/, error: "Algo deu errado. Tente novamente.", ai: "Criar com IA", minute: "30 minutos" },
] as const) {
  test(`combines shortcuts and task controls with view defaults in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale, defaultPriority: "high" });
    const [other, site] = await seedProjects(request, ["Other", "Révisão do Site"]);
    await seed(request, [{ title: "Seed tag", tags: ["team"] }]);
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto("/");
    await page.getByRole("button", { name: l.details }).click();
    const priority = page.getByRole("combobox", { name: l.priority });
    const due = page.getByLabel(l.due);
    const tag = page.getByLabel(l.tag);
    await expect(priority).toHaveValue("high");
    await composer(page).fill("Review !low tomorrow #bug @REVISAO-DO-SITE ~30m");
    await expect(priority).toHaveValue("low");
    await expect(due).toHaveValue(TOMORROW);
    const preview = page.getByRole("list", { name: l.preview });
    await expect(preview).toContainText("Révisão do Site");
    await expect(preview).toContainText(l.minute);
    await expect(preview).toContainText("#bug");
    await page.setViewportSize({ width: 1280, height: 800 });
    await sidebar(page).getByRole("button", { name: l.project }).click();
    await priority.selectOption("medium");
    await due.fill("2026-11-20");
    await expect(page.locator('#composer-tag-suggestions option[value="team"]')).toHaveCount(1);
    await tag.fill("team");
    await tag.press("Enter");
    await composer(page).press("End");
    await composer(page).press("Shift+Enter");
    await composer(page).pressSequentially("Plan @unknown ~1d");
    await page.route("**/api/tasks", (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.continue());
    await composer(page).press("Enter");
    await expect(page.getByRole("status")).toHaveText(l.error);
    await expect(composer(page)).toHaveValue(/Review.*\nPlan @unknown ~1d/s);
    await expect(priority).toHaveValue("medium");
    await expect(due).toHaveValue("2026-11-20");
    await expect(preview).toContainText("#team");
    await page.unroute("**/api/tasks");
    await composer(page).press("Enter");
    await expect(composer(page)).toHaveValue("");
    await expect(priority).toHaveValue("high");
    await expect(due).toHaveValue("");
    await expect(preview).toHaveCount(0);
    expect((await listTasks(request)).filter((task) => task.title !== "Seed tag")).toMatchObject([
      { title: "Review", priority: "medium", due: "2026-11-20", tags: ["bug", "team"], projectId: site.id, estimateHours: 0.5 },
      { title: "Plan @unknown", priority: "medium", due: "2026-11-20", tags: ["team"], projectId: other.id, estimateHours: 12 },
    ]);
  });

  test(`passes composer defaults and the Today plan to AI capture in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale, startView: "today" });
    const defaults = { plannedFor: TODAY, priority: "low", due: TOMORROW, tags: ["team"] };
    await page.route("**/api/ai/capture", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true } });
      expect(route.request().postDataJSON()).toEqual({ text: "Capture this note", today: TODAY, defaults });
      const response = await request.post("/api/tasks", { data: [{ title: "Captured action", ...defaults }] });
      await route.fulfill({ response });
    });
    await page.goto("/");
    await composer(page).fill("Capture this note");
    await page.getByRole("combobox", { name: l.priority }).selectOption("low");
    await page.getByLabel(l.due).fill(TOMORROW);
    await page.getByLabel(l.tag).fill("team");
    await page.getByRole("button", { name: l.ai, exact: true }).click();
    await expect(row(openSection(page), "Captured action")).toBeVisible();
    expect(await listTasks(request)).toMatchObject([{ title: "Captured action", ...defaults }]);
    await expect(composer(page)).toHaveValue("");
  });
}

for (const l of [
  { locale: "en", tag: "New task tag", lineLimit: "Add up to 50 task lines at a time.", overflow: /^Line 2 has too many tags/ },
  { locale: "pt-BR", tag: "Etiqueta da nova tarefa", lineLimit: "Adicione até 50 linhas de tarefas por vez.", overflow: /^A linha 2 tem etiquetas demais/ },
] as const) {
  test(`identifies the line that exceeds the task or tag limits in ${l.locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale: l.locale });
    await page.goto("/");
    await composer(page).fill(Array.from({ length: 51 }, (_, i) => `Task ${i}`).join("\n"));
    await composer(page).press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: l.lineLimit })).toBeVisible();
    const tags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(" ");
    await composer(page).fill(`First\nSecond ${tags}`);
    await page.getByLabel(l.tag).fill("#Team");
    await composer(page).press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: l.overflow })).toBeVisible();
    await expect(page.getByLabel(l.tag)).toHaveValue("#Team");
    expect(await listTasks(request)).toEqual([]);
  });
}
