import { expect, listTasks, openApp, row, seed, setLanguage, taskDetails, taskPanel, test } from "./support";

const languages = [
  { code: "en", estimate: "Estimate (minutes)", save: "Save estimate", heading: "Links & files", url: "Link URL",
    add: "Add link", remove: "Remove link: ", invalidUrl: "Enter a full http:// or https:// URL.",
    invalidEstimate: "Enter a whole number from 1 to 525600, or clear the field.", duplicate: "This link is already attached.",
    failed: "Couldn’t save. Try again." },
  { code: "pt-BR", estimate: "Estimativa (minutos)", save: "Salvar estimativa", heading: "Links e arquivos", url: "URL do link",
    add: "Adicionar link", remove: "Remover link: ", invalidUrl: "Insira uma URL completa com http:// ou https://.",
    invalidEstimate: "Insira um número inteiro de 1 a 525600 ou deixe o campo vazio.", duplicate: "Este link já foi adicionado.",
    failed: "Não foi possível salvar. Tente novamente." },
];

for (const l of languages) {
  test(`validates, retries and clears a time estimate in ${l.code}`, async ({ page, request }) => {
    const [before] = await seed(request, [{ title: "Estimate the release" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(page, before.title);
    await taskDetails(task).click();
    const panel = taskPanel(page);
    const estimate = panel.getByRole("spinbutton", { name: l.estimate, exact: true });
    const save = panel.getByRole("button", { name: l.save, exact: true });
    await expect(estimate).toHaveValue("");
    await estimate.fill("-1");
    await save.click();
    await expect(panel.getByRole("status").filter({ hasText: l.invalidEstimate })).toBeVisible();
    expect((await listTasks(request))[0].estimateMinutes).toBeNull();
    const endpoint = `**/api/tasks/${before.id}`;
    await page.route(endpoint, (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await estimate.fill("45");
    await save.click();
    await expect(panel.getByRole("status").filter({ hasText: l.failed })).toBeVisible();
    await expect(estimate).toHaveValue("45");
    expect((await listTasks(request))[0].estimateMinutes).toBeNull();
    await page.unroute(endpoint);
    await save.click();
    await expect.poll(async () => (await listTasks(request))[0].estimateMinutes).toBe(45);
    await page.reload();
    await taskDetails(task).click();
    await expect(estimate).toHaveValue("45");
    await estimate.fill("");
    await save.click();
    await expect.poll(async () => (await listTasks(request))[0].estimateMinutes).toBeNull();
  });

  test(`validates, saves and removes resource links in ${l.code}`, async ({ page, request }) => {
    const [before] = await seed(request, [{ title: "Review references" }]);
    await openApp(page);
    await setLanguage(page, l.code);
    const task = row(page, before.title);
    await taskDetails(task).click();
    const panel = taskPanel(page);
    await expect(panel.getByRole("heading", { name: l.heading, exact: true })).toBeVisible();
    const input = panel.getByRole("textbox", { name: l.url, exact: true });
    const add = panel.getByRole("button", { name: l.add, exact: true });
    for (const invalid of ["just a filename.pdf", "ftp://example.com/release.pdf"]) {
      await input.fill(invalid);
      await add.click();
      await expect(panel.getByRole("status").filter({ hasText: l.invalidUrl })).toBeVisible();
    }
    expect((await listTasks(request))[0].links).toEqual([]);
    const url = "https://example.com/release.pdf";
    const endpoint = `**/api/tasks/${before.id}`;
    await page.route(endpoint, (route) => route.fulfill({ status: 500, json: { error: "failed" } }));
    await input.fill(url);
    await add.click();
    await expect(panel.getByRole("status").filter({ hasText: l.failed })).toBeVisible();
    await expect(input).toHaveValue(url);
    expect((await listTasks(request))[0].links).toEqual([]);
    await page.unroute(endpoint);
    await add.click();
    const saved = panel.getByRole("link", { name: url, exact: true });
    await expect(saved).toHaveAttribute("href", url);
    await expect(input).toHaveValue("");
    await expect.poll(async () => (await listTasks(request))[0].links).toEqual([url]);
    await input.fill(url);
    await add.click();
    await expect(panel.getByRole("status").filter({ hasText: l.duplicate })).toBeVisible();
    expect((await listTasks(request))[0].links).toEqual([url]);
    await page.reload();
    await taskDetails(task).click();
    await expect(saved).toHaveAttribute("href", url);
    await panel.getByRole("button", { name: l.remove + url, exact: true }).click();
    await expect(saved).toBeHidden();
    await expect.poll(async () => (await listTasks(request))[0].links).toEqual([]);
  });
}
