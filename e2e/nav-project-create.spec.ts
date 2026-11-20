import { dictionaries } from "../src/i18n";
import { expect, listProjects, saveSettings, seedProjects, sidebar, test } from "./support";

for (const locale of ["en", "pt-BR"] as const) {
  const t = dictionaries[locale];
  test(`a project is created in place from the sidebar in ${locale}`, async ({ page, request }) => {
    await seedProjects(request, ["Existing"]);
    await saveSettings(request, { locale });
    await page.goto("/");
    const rail = sidebar(page);
    const names = async () => (await listProjects(request)).map((project) => project.name);
    const projects = rail.getByRole("button", { name: t.projects, exact: true });
    await projects.click();
    await expect(projects).toHaveAttribute("aria-expanded", "false");
    const create = rail.getByRole("button", { name: t.newProject, exact: true });
    await create.click();
    // The field appears where the project will be listed, with no dialog in the way.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(projects).toHaveAttribute("aria-expanded", "true");
    await expect(create).toHaveAttribute("aria-expanded", "true");
    const field = rail.getByRole("textbox", { name: t.newProject, exact: true });
    await expect(field).toBeFocused();
    await field.fill("Abandoned");
    await field.press("Escape");
    await expect(field).toHaveCount(0);
    await expect(create).toBeFocused();
    expect(await names()).toEqual(["Existing"]);

    await create.press("Enter");
    await field.fill("Existing");
    await field.press("Enter");
    await expect(rail.getByRole("alert")).toHaveText(t.errors.duplicate_project);
    await expect(field).toHaveValue("Existing");
    await expect(field).toBeFocused();
    await field.fill("Launch");
    await expect(rail.getByRole("alert")).toHaveCount(0);
    await field.press("Enter");
    await expect(field).toHaveCount(0);
    await expect(create).toBeFocused();
    const link = rail.getByRole("button", { name: new RegExp(`^${t.project}: Launch,`) });
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Launch");
    expect(await names()).toEqual(["Existing", "Launch"]);

    // An empty field goes away when the person moves on; a typed name stays.
    await create.click();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(field).toHaveCount(0);
    await create.click();
    await field.fill("Half typed");
    await page.getByRole("heading", { level: 1 }).click();
    await expect(field).toHaveValue("Half typed");
    expect(await names()).toEqual(["Existing", "Launch"]);
  });

  test(`a failed creation keeps the name and the field fits a phone in ${locale}`, async ({ page, request }) => {
    await saveSettings(request, { locale });
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto("/");
    const rail = sidebar(page);
    await rail.getByRole("button", { name: t.moreViews, exact: true }).click();
    await rail.getByRole("button", { name: t.newProject, exact: true }).click();
    const field = rail.getByRole("textbox", { name: t.newProject, exact: true });
    await expect(field).toBeFocused();
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.route("**/api/projects", (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "generic" } }) : route.fallback());
    await field.fill("Phone project");
    await field.press("Enter");
    await expect(rail.getByRole("alert")).toHaveText(t.errors.generic);
    await expect(field).toHaveValue("Phone project");
    expect(await listProjects(request)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.unroute("**/api/projects");
    await field.press("Enter");
    await expect(field).toHaveCount(0);
    await expect(rail.getByRole("button", { name: new RegExp(`^${t.project}: Phone project,`) })).toBeVisible();
    expect((await listProjects(request)).map((project) => project.name)).toEqual(["Phone project"]);
  });
}
