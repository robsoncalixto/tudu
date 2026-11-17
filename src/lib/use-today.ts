"use client";

import { useEffect, useState } from "react";
import { toISODate } from "./dates";

/** Local calendar date (YYYY-MM-DD). Null until mounted so server and client markup match. */
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(toISODate(new Date())), []);
  return today;
}
