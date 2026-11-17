import { expect, listTasks, openApp, openSection, doneSection, row, seed, test, TODAY } from "./support";

test.describe("Board", () => {
  test("shows the app name, today's date and an empty state", async ({ page }) => {
    await openApp(page);

    await expect(page).toHaveTitle("TUDU");
    await expect(page.getByText("Tuesday", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("November 17");
    await expect(page.getByText("0 open")).toBeVisible();
    await expect(page.getByText("0 done")).toBeVisible();
    await expect(page.getByText("Nothing open.")).toBeVisible();
    await expect(page.getByText("Write the first thing on your mind above.")).toBeVisible();
    await expect(doneSection(page)).toHaveCount(0);
  });

  test("keeps the open and done counts in step with the lists", async ({ page, request }) => {
    await seed(request, [{ title: "First" }, { title: "Second" }, { title: "Third" }]);
    await openApp(page);
    await expect(page.getByText("3 open")).toBeVisible();

    await row(page, "Second").getByRole("checkbox").click();

    await expect(page.getByText("2 open")).toBeVisible();
    await expect(page.getByText("1 done")).toBeVisible();
    await expect(page.locator("#open-heading")).toHaveText("Open 2");
  });

  test("keeps completed tasks in a collapsed Done section", async ({ page, request }) => {
    await seed(request, [{ title: "Ship it" }]);
    await openApp(page);
    await row(page, "Ship it").getByRole("checkbox").click();

    await expect(row(openSection(page), "Ship it")).toHaveCount(0);
    await expect(doneSection(page).locator("summary")).toHaveText("Done 1");
    await expect(row(doneSection(page), "Ship it")).toBeHidden();

    await doneSection(page).locator("summary").click();
    await expect(row(doneSection(page), "Ship it")).toBeVisible();
  });

  test("still shows saved tasks after a reload", async ({ page, request }) => {
    await openApp(page);
    await page.getByRole("textbox", { name: /Write a task/ }).fill("Survive a reload");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(row(page, "Survive a reload")).toBeVisible();

    await page.reload();

    await expect(row(page, "Survive a reload")).toBeVisible();
    expect((await listTasks(request)).map((task) => task.title)).toEqual(["Survive a reload"]);
  });

  test("fits a phone screen without horizontal scrolling", async ({ page, request }) => {
    await seed(request, [
      { title: "A task with a fairly long title that has to wrap on a narrow screen", due: TODAY, tags: ["mobile"] },
    ]);
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);

    await expect(row(page, "A task with a fairly long title")).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows).toBe(false);
    await expect(page.getByRole("button", { name: "Add" })).toBeInViewport();
  });
});
