import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Clock3, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteRun, listRunAttempts, listRuns } from "@/lib/store";

export const Route = createFileRoute("/history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "History — LessonForge" },
      { name: "description", content: "Reopen previous lesson generation runs and attempts." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const runs = useQuery({ queryKey: ["history-runs"], queryFn: () => listRuns() });
  const visibleRuns = useMemo(
    () => (runs.data ?? []).filter((run) => run.topic.toLowerCase().includes(search.toLowerCase())),
    [runs.data, search],
  );

  useEffect(() => {
    if (!selectedId && visibleRuns.length) setSelectedId(visibleRuns[0].id);
    if (selectedId && runs.data && !runs.data.some((run) => run.id === selectedId)) setSelectedId(null);
  }, [selectedId, visibleRuns, runs.data]);

  const selectedRun = runs.data?.find((run) => run.id === selectedId);
  const attempts = useQuery({
    queryKey: ["history-attempts", selectedId],
    queryFn: () => listRunAttempts(selectedId!),
    enabled: !!selectedId,
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary"><Clock3 className="h-4 w-4" /> Past runs</p>
        <h1 className="mt-2 text-3xl font-extrabold">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open a past topic to see its generated lessons, checks, and retries.</p>
      </header>

      <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-card p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search topics" aria-label="Search past topics" />
          </label>
          <div className="mt-3 max-h-[65vh] space-y-1 overflow-y-auto">
            {runs.isLoading && <p className="p-3 text-sm text-muted-foreground">Loading history…</p>}
            {runs.error && <p className="p-3 text-sm text-destructive">Could not load history. Check Firestore access.</p>}
            {!runs.isLoading && !runs.error && visibleRuns.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">{search ? "No matching topics." : "No saved runs yet. Generate a lesson to start your history."}</p>
            )}
            {visibleRuns.map((run) => (
              <div key={run.id} className={`flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-muted ${selectedId === run.id ? "bg-muted ring-1 ring-primary/30" : ""}`}>
                <button type="button" onClick={() => setSelectedId(run.id)} className="min-w-0 flex-1 p-3 text-left">
                  <span className="block truncate text-sm font-semibold">{run.topic}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(run.createdAt).toLocaleString()} · {run.attempts || 0} {(run.attempts || 0) === 1 ? "attempt" : "attempts"}
                  </span>
                </button>
                <DeleteButton what="this saved run and its attempts" onConfirm={async () => {
                  await deleteRun(run.id);
                  await queryClient.invalidateQueries({ queryKey: ["history-runs"] });
                  await queryClient.invalidateQueries({ queryKey: ["history-attempts", run.id] });
                  await queryClient.invalidateQueries({ queryKey: ["rejections"] });
                }} />
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {!selectedRun && <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Choose a past run to reopen it.</div>}
          {selectedRun && <>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved conversation</p>
                  <h2 className="mt-1 text-xl font-bold">{selectedRun.topic}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{new Date(selectedRun.createdAt).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedRun.status === "passed" ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {selectedRun.status}
                </span>
              </div>
            </div>

            {attempts.isLoading && <p className="text-sm text-muted-foreground">Loading lesson attempts…</p>}
            {attempts.error && <p className="text-sm text-destructive">Could not load lesson attempts.</p>}
            {attempts.data?.map((attempt) => {
              const passedChecks = attempt.checks.filter((check) => check.pass).length;
              return (
                <article key={attempt.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                    <h3 className="font-bold">Attempt {attempt.attempt}</h3>
                    <span className={`text-sm font-semibold ${attempt.passed ? "text-success" : "text-destructive"}`}>
                      {attempt.passed ? "Passed" : "Failed"} · {passedChecks}/{attempt.checks.length} checks
                    </span>
                  </div>
                  <div className="space-y-3 p-5">
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold">Show evaluation results</summary>
                      <ul className="mt-3 space-y-2 text-sm">
                        {attempt.checks.map((check) => (
                          <li key={check.id} className="flex gap-2">
                            <span aria-label={check.pass ? "Passed" : "Failed"}>{check.pass ? "✓" : "✗"}</span>
                            <span><b>{check.id} {check.name}:</b> <span className="text-muted-foreground">{check.reason}</span></span>
                          </li>
                        ))}
                      </ul>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold">Show lesson</summary>
                      <div className="lesson-prose mt-4 rounded-lg bg-background p-4"><ReactMarkdown>{attempt.lesson}</ReactMarkdown></div>
                    </details>
                  </div>
                </article>
              );
            })}
            {attempts.data?.length === 0 && selectedRun.finalLesson && (
              <article className="lesson-prose rounded-xl border border-border bg-card p-5"><ReactMarkdown>{selectedRun.finalLesson}</ReactMarkdown></article>
            )}
          </>}
        </section>
      </div>
    </div>
  );
}
