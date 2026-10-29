import { useQuery } from "@tanstack/react-query";
import { getDb } from "../../db/client";
import { PageHeader } from "../../ui/PageHeader";
import { EmptyState } from "../../ui/EmptyState";

// Placeholder: feat/02-today-scheduler replaces this. For now it proves the DB + seed work in the real app.
export function Today() {
  const { data } = useQuery({
    queryKey: ["seed-counts"],
    queryFn: async () => {
      const db = await getDb();
      const [r] = await db.select<{ sessions: number; modules: number }>(
        "SELECT (SELECT COUNT(*) FROM sessions) sessions, (SELECT COUNT(*) FROM modules) modules",
      );
      return r;
    },
  });
  return (
    <>
      <PageHeader title="Today" subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
      <EmptyState
        title="Your daily plan lands here"
        hint={data ? `Roadmap loaded: ${data.sessions} sessions across ${data.modules} modules.` : "Loading roadmap…"}
      />
    </>
  );
}
