import { request } from "@/lib/http";
import { summarySchema, type WorkLogQuery } from "./schema";

export const workLogApi = {
  summarize: (query: WorkLogQuery) => request<unknown>("/api/work-log/summary", { method: "POST", body: query })
    .then((data) => summarySchema.parse(data).summary),
};
