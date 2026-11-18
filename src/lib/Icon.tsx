const paths = {
  "panel-right": "M3 4h18v16H3zM15 4v16m-4-12-4 4 4 4",
  pencil: "m14 5 5 5M4 20l5-1L21 7l-4-4L5 15z",
  note: "M4 3h16v13l-5 5H4zM14 21v-6h6M8 8h8M8 12h5",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2",
  link: "m10 13 4-4m-2-2 2-2a4 4 0 0 1 6 6l-3 3a4 4 0 0 1-6 0m1 3-2 2a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0",
  "arrow-left": "M20 12H4m7-7-7 7 7 7",
  "list-checks": "m2 6 2 2 3-4m3 3h11M2 14l2 2 3-4m3 3h11",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 10h18m-14 5h3",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  moon: "M20.5 14a9 9 0 0 1-10.4-11 9 9 0 1 0 10.4 11Z",
  monitor: "M3 4h18v13H3zM12 17v4m-4 0h8",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-right": "m9 6 6 6-6 6",
  folder: "M3 6a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  repeat: "m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  check: "m4 12 5 5L20 6",
  flag: "M4 21V4c5-4 10 4 16 0v10c-6 4-11-4-16 0",
  plus: "M12 5v14M5 12h14",
  "subtask-add": "M4 3v9a3 3 0 0 0 3 3h3m6-5v10m-5-5h10",
  tag: "M20 13l-7 7a2 2 0 0 1-3 0l-8-8V3h9l9 8a1.5 1.5 0 0 1 0 2ZM7 7h.01",
  keyboard: "M3 5h18v14H3zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 15h8",
  "corner-down-left": "M20 5v7a2 2 0 0 1-2 2H4m5-5-5 5 5 5",
  info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v6m0-10h.01",
  book: "M5 3h14v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-1 15a2 2 0 0 1 2-2h13M8 7h7",
  assistant: "M21 13a3 3 0 0 1-3 3H9l-6 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3ZM7 8h10M7 12h6",
  settings: "m9 3 1-1h4l1 3 2 1 3-.4 2 3-2 2v3l2 2-2 3-3-.4-2 1-1 2h-4l-1-2-2-1-3 .4-2-3 2-2v-3l-2-2 2-3 3 .4 2-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  menu: "M3 6h18M3 12h18M3 18h18",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6",
  sort: "M8 4v16m-4-4 4 4 4-4M13 5h8m-8 5h6m-6 5h4",
  x: "m6 6 12 12M18 6 6 18",
  grid: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24"
    className={className} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}
