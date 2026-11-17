import { promises as fs } from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { settingsPatchSchema, settingsSchema, type Settings, type SettingsPatch } from "../schema";

const state = globalThis as typeof globalThis & { __tuduSettingsQueues?: Map<string, Promise<unknown>> };

export function createSettingsRepository(dataDir: string) {
  const file = path.join(dataDir, "settings.json");
  function locked<T>(operation: () => Promise<T>): Promise<T> {
    state.__tuduSettingsQueues ??= new Map();
    const run = (state.__tuduSettingsQueues.get(file) ?? Promise.resolve()).then(operation, operation);
    state.__tuduSettingsQueues.set(file, run.catch(() => undefined));
    return run;
  }
  async function read(): Promise<Settings> {
    try { return settingsSchema.parse(JSON.parse(await fs.readFile(file, "utf8"))); }
    catch (error) {
      // Keep the original file for inspection; only an explicit save replaces it.
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError || error instanceof ZodError) {
        return settingsSchema.parse({});
      }
      throw error;
    }
  }
  return {
    getSettings: () => locked(read),
    updateSettings: (patch: SettingsPatch) => locked(async () => {
      const saved = await read();
      const changes = settingsPatchSchema.parse(patch);
      const resetModel = changes.aiProvider !== undefined && changes.aiProvider !== saved.aiProvider;
      const next = settingsSchema.parse({ ...saved, ...(resetModel ? { aiModel: "" } : {}), ...changes });
      await fs.mkdir(dataDir, { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
      await fs.rename(temporary, file);
      return next;
    }),
  };
}

export const { getSettings, updateSettings } = createSettingsRepository(
  process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
);
