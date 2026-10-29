export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mx-auto mt-24 max-w-sm text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-muted">{hint}</p>}
    </div>
  );
}
