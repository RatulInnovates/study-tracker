import { RoadmapImport } from "../features/settings/RoadmapImport";
import { AiSettings } from "../features/settings/AiSettings";

/** First run: nothing is loaded until the user picks a roadmap. */
export function Welcome({ onLoaded }: { onLoaded: () => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-8 px-6 py-16">
        <header>
          <h1 className="text-[22px] font-semibold tracking-tight">Welcome to Study Tracker</h1>
          <p className="mt-1 text-muted">Turn any roadmap into daily tasks, then check your work with quizzes and AI review. Everything stays on this computer.</p>
        </header>
        <section aria-labelledby="pick" className="space-y-3">
          <h2 id="pick" className="font-semibold">1. Choose your roadmap</h2>
          <RoadmapImport hasProgress={false} onLoaded={onLoaded} />
        </section>
        <section aria-labelledby="ai" className="space-y-3">
          <h2 id="ai" className="font-semibold">2. Connect an AI (optional)</h2>
          <AiSettings />
        </section>
      </div>
    </div>
  );
}
