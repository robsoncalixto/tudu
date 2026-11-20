import { dictionaries } from "@/i18n";
import { appColors } from "@/features/pwa/theme";

export function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("lang") === "pt-BR" ? "pt-BR" : "en";
  const t = dictionaries[locale];
  return new Response(`<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>TUDU · ${t.offlineTitle}</title>
  <style>
    body { margin: 0; background: light-dark(${appColors.light}, ${appColors.dark});
      color: light-dark(${appColors.ink}, ${appColors.lightInk}); font: 16px/1.5 system-ui, sans-serif; }
    main { box-sizing: border-box; max-width: 42rem; margin: auto;
      padding: max(3rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right))
        max(1.5rem, env(safe-area-inset-bottom)) max(1.5rem, env(safe-area-inset-left)); }
    a { color: inherit; }
  </style>
</head>
<body><main>
  <img src="/brand/tudu-icon-192.png" width="48" height="48" alt="TUDU">
  <h1>${t.offlineTitle}</h1>
  <p>${t.offlineHint}</p>
  <a href="/">${t.retry}</a>
</main></body>
</html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
