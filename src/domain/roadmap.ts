export interface Filters {
  q: string;
  status: "all" | "todo" | "done" | "skipped";
  kind: "all" | "study" | "project";
  level: number | null;
}
export const NO_FILTERS: Filters = { q: "", status: "all", kind: "all", level: null };

export interface Searchable {
  title: string;
  module_title: string;
  module_code: string;
  status: string;
  kind: string;
  level_num: number;
}

export const isFiltering = (f: Filters) => f.q.trim() !== "" || f.status !== "all" || f.kind !== "all" || f.level !== null;

export function matches(s: Searchable, f: Filters) {
  if (f.status !== "all" && s.status !== f.status) return false;
  if (f.kind !== "all" && s.kind !== f.kind) return false;
  if (f.level !== null && s.level_num !== f.level) return false;
  const q = f.q.trim().toLowerCase();
  return !q || [s.title, s.module_title, s.module_code].some((t) => t.toLowerCase().includes(q));
}

/** Soft gating: a level carries "project debt" when a project is unshipped but the learner is done with it or has moved past it. */
export function hasProjectDebt(level: { num: number; unshipped: number; total: number; done: number }, highestStarted: number) {
  return level.unshipped > 0 && ((level.total > 0 && level.done === level.total) || level.num < highestStarted);
}
