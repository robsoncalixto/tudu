import { addTask, composer, expect, listTasks, openApp, openSection, row, rowTitles, saveSettings, seedProjects, test, TODAY, setLanguage } from "./support";

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
    await page.getByRole("button", { name: "Add" }).click();

    await expect(row(openSection(page), "Review the budget")).toBeVisible();
  });

  test("does not add an empty task", async ({ page, request }) => {
    await openApp(page);
    await expect(page.getByRole("button", { name: "Add" })).toBeDisabled();

    await composer(page).fill("   ");
    await expect(page.getByRole("button", { name: "Add" })).toBeDisabled();
    await composer(page).press("Enter");

    await expect(page.getByText("Nothing open.")).toBeVisible();
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

  test("collapses line breaks into a single-line title", async ({ page }) => {
    await openApp(page);
    await composer(page).fill("first line\nsecond line");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(row(openSection(page), "first line second line")).toBeVisible();
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
    await expect(page.getByText("Nothing open.")).toBeVisible();
  });

  test("explains how to turn AI on when there is no key", async ({ page }) => {
    await openApp(page);

    await expect(page.getByText("AI is off. Configure the selected provider's API key in the server's .env file.")).toBeVisible();
    await composer(page).fill("some note");
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
      await expect(page.getByText(/Enter adds one task/)).toBeVisible();

      await composer(page).fill("Send Ana the draft by tomorrow and book a room");
      await page.getByRole("button", { name: "Create with AI" }).click();

      await expect(page.getByRole("status")).toHaveText("2 tasks added");
      expect(await rowTitles(openSection(page))).toEqual(["Send Ana the draft", "Book a room"]);
      const first = row(openSection(page), "Send Ana the draft");
      await expect(first.getByText("Tomorrow")).toBeVisible();
      await expect(first.getByRole("button", { name: "Priority: High" })).toBeVisible();
      await expect(first.getByRole("button", { name: "#ana" })).toBeVisible();
      await expect(row(openSection(page), "Book a room").getByText("For the review")).toBeVisible();
      await expect(composer(page)).toHaveValue("");
    });

    test("turns a note into tasks with Ctrl+Enter", async ({ page }) => {
      await openApp(page);
      await expect(page.getByText(/Enter adds one task/)).toBeVisible();
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
    await expect(page.getByText(/Enter adds one task/)).toBeVisible();

    await composer(page).fill("just thinking out loud");
    await page.getByRole("button", { name: "Create with AI" }).click();

    await expect(page.getByRole("status")).toHaveText("I couldn't find a task in that note.");
    await expect(composer(page)).toHaveValue("just thinking out loud");
  });

  test("a new task clears the active tag filter so it is visible", async ({ page, request }) => {
    await request.post("/api/tasks", { data: [{ title: "Tagged", tags: ["work"] }] });
    await openApp(page);
    await page.getByRole("complementary").getByRole("button", { name: "#work" }).click();
    await expect(page.locator("#open-heading")).toHaveText("#work 1");

    await addTask(page, "Untagged newcomer");

    await expect(page.locator("#open-heading")).toHaveText("Open 2");
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
    await expect(row(page, "Acme report").getByRole("combobox")).toHaveValue(project.id);
    await expect.poll(async () => (await listTasks(request))[0].projectId).toBe(project.id);
  });
}

for (const l of [
  { code: "en", add: "Add", ai: "Create with AI", hint: "Quick-add shortcuts", raw: "Fix login #BUG !high tomorrow", title: "Fix login", tomorrow: "tomorrow", today: "today", weekday: "Tuesday", invalid: "Add a title of up to 300 characters, with at most 10 tags of up to 40 characters each. Your text is still here.", error: "Something went wrong. Try again." },
  { code: "pt-BR", add: "Adicionar", ai: "Criar com IA", hint: "Atalhos para adicionar tarefas", raw: "Corrigir login #BUG !high amanhã", title: "Corrigir login", tomorrow: "amanhã", today: "hoje", weekday: "terça-feira", invalid: "Adicione um título com até 300 caracteres e no máximo 10 etiquetas com até 40 caracteres cada. Seu texto continua aqui.", error: "Algo deu errado. Tente novamente." },
]) {
  test(`quick-add parses tags, priority and date without AI in ${l.code}`, async ({ page, request }) => {
    await openApp(page);
    await setLanguage(page, l.code);
    await expect(page.getByRole("button", { name: l.ai, exact: true })).toBeDisabled();
    await composer(page).fill(l.raw);
    await composer(page).press("Enter");
    await expect(row(openSection(page), l.title)).toBeVisible();
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
    const hint = page.getByText(l.hint, { exact: true });
    await hint.focus(); await hint.press("Enter");
    await expect(page.getByText(/Fix login #bug !high tomorrow|Corrigir login #bug !high amanhã/)).toBeVisible();
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
