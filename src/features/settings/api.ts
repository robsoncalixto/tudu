import { request } from "@/lib/http";
import type { Settings, SettingsPatch } from "./schema";

export const settingsApi = {
  get: () => request<{ settings: Settings }>("/api/settings").then((data) => data.settings),
  update: (patch: SettingsPatch) => request<{ settings: Settings }>("/api/settings", {
    method: "PATCH", body: patch,
  }).then((data) => data.settings),
};
