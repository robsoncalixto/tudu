import { describe, expect, it } from "vitest";
import manifest from "./manifest";
import { GET } from "./offline/route";

describe("installable TUDU", () => {
  it("starts inside the normal board entry point and includes the required icon sizes", () => {
    expect(manifest()).toMatchObject({
      name: "TUDU", short_name: "TUDU", start_url: "/", scope: "/", display: "standalone",
      icons: [
        { sizes: "192x192", purpose: "any" },
        { sizes: "512x512", purpose: "any" },
        { sizes: "512x512", purpose: "maskable" },
      ],
    });
  });

  it.each([["en", "You’re offline"], ["pt-BR", "Você está sem conexão"]])("returns a standalone offline page in %s", async (locale, title) => {
    const response = GET(new Request(`https://tudu.example/offline?lang=${locale}`));
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toContain(`<h1>${title}</h1>`);
  });
});
