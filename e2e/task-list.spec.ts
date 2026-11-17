import { expect, openApp, openSection, doneSection, row, rowTitles, seed, test, TODAY, TOMORROW, YESTERDAY } from "./support";

test.describe("TaskList", () => {
  test("labels the columns of the open list only", async ({ page, request }) => {
    await seed(request, [{ title: "Open one" }, { title: "Done one" }]);
    await openApp(page);
    await row(page, "Done one").getByRole("checkbox").click();
    await doneSection(page).locator(":scope > summary").click();

    const head = openSection(page).locator(".list-head");
    await expect(head).toContainText("Task");
    await expect(head).toContainText("Due");
    await expect(head).toContainText("Priority");
    await expect(doneSection(page).locator(".list-head")).toHaveCount(0);
  });

  test("orders open tasks by due date, then priority, then age", async ({ page, request }) => {
    await seed(request, [
      { title: "No date, low", priority: "low" },
      { title: "No date, high", priority: "high" },
      { title: "Tomorrow", due: TOMORROW },
      { title: "Today, medium", due: TODAY },
      { title: "Today, high", due: TODAY, priority: "high" },
      { title: "Overdue", due: YESTERDAY, priority: "low" },
    ]);
    await openApp(page);

    expect(await rowTitles(openSection(page))).toEqual([
      "Overdue",
      "Today, high",
      "Today, medium",
      "Tomorrow",
      "No date, high",
      "No date, low",
    ]);
  });

  test("re-sorts a task when its priority changes", async ({ page, request }) => {
    await seed(request, [{ title: "Older" }, { title: "Newer" }]);
    await openApp(page);
    expect(await rowTitles(openSection(page))).toEqual(["Older", "Newer"]);

    await row(page, "Newer").getByRole("button", { name: "Priority: Medium" }).click();

    await expect(row(page, "Newer").getByRole("button", { name: "Priority: High" })).toBeVisible();
    expect(await rowTitles(openSection(page))).toEqual(["Newer", "Older"]);
  });

  test("lists the most recently completed task first", async ({ page, request }) => {
    await seed(request, [{ title: "Finished first" }, { title: "Finished second" }]);
    await openApp(page);

    await row(page, "Finished first").getByRole("checkbox").click();
    await expect(doneSection(page).locator(":scope > summary")).toHaveText("Done 1");
    await row(openSection(page), "Finished second").getByRole("checkbox").click();
    await expect(doneSection(page).locator(":scope > summary")).toHaveText("Done 2");

    await doneSection(page).locator(":scope > summary").click();
    expect(await rowTitles(doneSection(page))).toEqual(["Finished second", "Finished first"]);
  });
});
