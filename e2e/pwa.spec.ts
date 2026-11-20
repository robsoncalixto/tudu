import { expect, saveSettings, seed, test } from "./support";

for (const l of [
  { locale: "en", today: "Today", offline: "You’re offline" },
  { locale: "pt-BR", today: "Hoje", offline: "Você está sem conexão" },
] as const) {
  test(`installs TUDU and opens its offline shell in ${l.locale}`, async ({ page, request, context }) => {
    await saveSettings(request, { locale: l.locale, startView: "today" });
    await seed(request, [{ title: "Online only" }]);
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.today);
    const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifest).toBeTruthy();
    const response = await request.get(manifest!);
    expect(response.ok()).toBe(true);
    const app = await response.json();
    expect(app).toMatchObject({ name: "TUDU", short_name: "TUDU", display: "standalone", start_url: "/" });
    expect(app.icons).toEqual(expect.arrayContaining([{ src: "/brand/tudu-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }]));
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/brand/tudu-touch-icon.png");
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("/sw.js");
    await expect.poll(() => page.evaluate(async () => (await (await caches.match("/offline-preferences"))?.json())?.locale)).toBe(l.locale);
    expect(await (await request.get("/sw.js")).text()).not.toContain("tudu-shell-development");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator('meta[name="theme-color"][media*="dark"]')).toHaveAttribute("content", "#191a1e");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator('meta[name="theme-color"][media*="light"]')).toHaveAttribute("content", "#ffffff");
    await saveSettings(request, { theme: "dark" });
    const initial = await (await request.get("/")).text();
    expect(initial).toContain('name="theme-color" content="#191a1e"');
    await page.reload();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#191a1e");
    await expect.poll(() => page.evaluate(async () => (await (await caches.match("/offline-preferences"))?.json())?.theme)).toBe("dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.evaluate(() => fetch("/api/tasks"));
    const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (name) => (
      (await (await caches.open(name)).keys()).map((entry) => new URL(entry.url).pathname)
    )))).flat());
    expect(cached).toContain("/offline");
    expect(cached.some((pathname) => pathname.startsWith("/api/"))).toBe(false);
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.offline);
      await expect(page.getByText("Online only")).toHaveCount(0);
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(25, 26, 30)");
    } finally { await context.setOffline(false); }
  });
}
