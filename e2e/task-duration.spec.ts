import { expect, listTasks, openApp, row, seed, setLanguage, taskDetails, taskPanel, test } from "./support";

const languages = [
  { code: "en", estimate: "Estimate", realTime: "Real time execution", estimateUnit: "Estimate unit",
    realTimeUnit: "Real time execution unit", saveEstimate: "Save estimate", saveRealTime: "Save real time execution",
    hint: "1 day = 12 hours. Fractional hours are supported.", failed: "Couldn’t save. Try again.",
    invalid: "Enter a time greater than 0 and up to 8760 hours, or clear the field.",
    units: ["Minutes", "Hours", "Days"] },
  { code: "pt-BR", estimate: "Estimativa", realTime: "Tempo real de execução", estimateUnit: "Unidade de estimativa",
    realTimeUnit: "Unidade de tempo real de execução", saveEstimate: "Salvar estimativa", saveRealTime: "Salvar tempo real de execução",
    hint: "1 dia = 12 horas. Aceita horas fracionadas.", failed: "Não foi possível salvar. Tente novamente.",
    invalid: "Insira um tempo maior que 0 e de até 8760 horas ou deixe o campo vazio.",
    units: ["Minutos", "Horas", "Dias"] },
];

for (const l of languages) {
  for (const field of ["estimateHours", "realTimeHours"] as const) {
    test(`saves ${field} in hours from all three units in ${l.code}`, async ({ page, request }) => {
      await seed(request, [{ title: "Time the release" }]);
      await openApp(page);
      await setLanguage(page, l.code);
      await taskDetails(row(page, "Time the release")).click();
      const panel = taskPanel(page);
      const label = field === "estimateHours" ? l.estimate : l.realTime;
      const form = panel.getByRole("form", { name: label, exact: true });
      const unit = form.getByRole("combobox");
      const input = form.getByRole("spinbutton", { name: label, exact: true });
      const save = form.getByRole("button");
      await expect(unit).toHaveAccessibleName(field === "estimateHours" ? l.estimateUnit : l.realTimeUnit);
      await expect(unit).toHaveValue("hours");
      await expect(unit.getByRole("option")).toHaveText(l.units);
      await expect(form.getByText(l.hint, { exact: true })).toBeVisible();
      expect(await unit.evaluate((select) => Boolean(select.compareDocumentPosition(select.parentElement!.querySelector("input")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

      for (const [selected, value, hours] of [["hours", "1.5", 1.5], ["minutes", "45", 0.75], ["days", "1", 12]] as const) {
        await unit.selectOption(selected);
        await input.fill(value);
        await save.click();
        await expect.poll(async () => (await listTasks(request))[0][field]).toBe(hours);
        const other = field === "estimateHours" ? "realTimeHours" : "estimateHours";
        expect((await listTasks(request))[0][other]).toBeNull();
      }
      await unit.selectOption("hours");
      await expect(input).toHaveValue("12");
      await unit.selectOption("minutes");
      await expect(input).toHaveValue("720");
      expect((await listTasks(request))[0][field]).toBe(12);
      await page.reload();
      await taskDetails(row(page, "Time the release")).click();
      await expect(unit).toHaveValue("hours");
      await expect(input).toHaveValue("12");
      await input.fill("");
      await save.click();
      await expect.poll(async () => (await listTasks(request))[0][field]).toBeNull();
    });

    test(`validates and retries ${field} without losing its unit in ${l.code}`, async ({ page, request }) => {
      const [task] = await seed(request, [{ title: "Retry time" }]);
      await openApp(page);
      await setLanguage(page, l.code);
      await taskDetails(row(page, task.title)).click();
      const form = taskPanel(page).getByRole("form", { name: field === "estimateHours" ? l.estimate : l.realTime, exact: true });
      const unit = form.getByRole("combobox");
      const input = form.getByRole("spinbutton");
      const save = form.getByRole("button");
      await unit.selectOption("days");
      for (const invalid of ["-1", "0", "731"]) {
        await input.fill(invalid);
        await save.click();
        await expect(form.getByRole("status")).toHaveText(l.invalid);
        expect((await listTasks(request))[0][field]).toBeNull();
      }
      const endpoint = `**/api/tasks/${task.id}`;
      await page.route(endpoint, (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
      await input.fill("0.5");
      await save.click();
      await expect(form.getByRole("status")).toHaveText(l.failed);
      await expect(unit).toHaveValue("days");
      await expect(input).toHaveValue("0.5");
      expect((await listTasks(request))[0][field]).toBeNull();
      await page.unroute(endpoint);
      await save.click();
      await expect.poll(async () => (await listTasks(request))[0][field]).toBe(6);
    });
  }

  test(`preserves independent time drafts and units when switching tasks in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "First timed task" }, { title: "Second timed task", estimateHours: 2, realTimeHours: 3 }]);
    await openApp(page);
    await setLanguage(page, l.code);
    await taskDetails(row(page, "First timed task")).click();
    const panel = taskPanel(page);
    const estimate = panel.getByRole("form", { name: l.estimate, exact: true });
    const realTime = panel.getByRole("form", { name: l.realTime, exact: true });
    await estimate.getByRole("combobox").selectOption("days");
    await estimate.getByRole("spinbutton").fill("0.5");
    await realTime.getByRole("combobox").selectOption("minutes");
    await realTime.getByRole("spinbutton").fill("45");
    await taskDetails(row(page, "Second timed task")).click();
    await expect(estimate.getByRole("spinbutton")).toHaveValue("2");
    await expect(realTime.getByRole("spinbutton")).toHaveValue("3");
    await taskDetails(row(page, "First timed task")).click();
    await expect(estimate.getByRole("combobox")).toHaveValue("days");
    await expect(estimate.getByRole("spinbutton")).toHaveValue("0.5");
    await expect(realTime.getByRole("combobox")).toHaveValue("minutes");
    await expect(realTime.getByRole("spinbutton")).toHaveValue("45");
    await estimate.getByRole("button").click();
    await realTime.getByRole("button").click();
    await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({ estimateHours: 6, realTimeHours: 0.75 });
  });

  test(`keeps both time controls usable at phone width in ${l.code}`, async ({ page, request }) => {
    await seed(request, [{ title: "Mobile timing" }]);
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);
    await setLanguage(page, l.code);
    await taskDetails(row(page, "Mobile timing")).click();
    const panel = taskPanel(page);
    for (const label of [l.estimate, l.realTime]) {
      const form = panel.getByRole("form", { name: label, exact: true });
      await form.getByRole("combobox").selectOption("hours");
      await form.getByRole("spinbutton").fill("1.5");
      await form.getByRole("button").click();
      await expect(form.getByRole("status")).toHaveText(l.code === "en" ? "Saved." : "Salvo.");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(async () => (await listTasks(request))[0]).toMatchObject({ estimateHours: 1.5, realTimeHours: 1.5 });
  });
}
