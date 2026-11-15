import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RUBRIC } from "@/lib/checks";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteItem, listGuidance, listRejections, listRubricSuggestions, setGuidanceActive, setSuggestionStatus } from "@/lib/store";

export const Route = createFileRoute("/memory")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Memory — LessonForge" },
      { name: "description", content: "Learned guidance rules and failure counts per rubric check." },
      { property: "og:title", content: "Memory — LessonForge" },
      { property: "og:description", content: "What LessonForge has learned from past failures." },
    ],
  }),
  component: Memory,
});

const ALL_CHECKS = [...RUBRIC, { id: "R1", name: "Avg sentence ≤ 20 words" }, { id: "R2", name: "500–1200 words" }, { id: "R3", name: "Required sections" }];

function Memory() {
  const qc = useQueryClient();
  const guidance = useQuery({ queryKey: ["guidance"], queryFn: listGuidance });
  const rejections = useQuery({ queryKey: ["rejections"], queryFn: () => listRejections(500) });
  const suggestions = useQuery({ queryKey: ["suggestions"], queryFn: listRubricSuggestions });

  const counts: Record<string, number> = {};
  rejections.data?.forEach((r) => r.failed.forEach((f) => { counts[f.id] = (counts[f.id] ?? 0) + 1; }));
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold">Memory</h1>
      {(guidance.error || rejections.error) && <p className="text-destructive">Could not read Firestore. Check your Firestore rules.</p>}

      <section>
        <h2 className="mb-3 text-xl font-bold">Learned guidance</h2>
        {guidance.data?.length === 0 && <p className="text-muted-foreground">Nothing learned yet — run the pipeline.</p>}
        <ul className="space-y-2">
          {guidance.data?.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
              <span className={g.active ? "min-w-0" : "min-w-0 text-muted-foreground line-through"}>{g.rule}</span>
              <span className="flex shrink-0 items-center gap-1">
              <DeleteButton what="this rule" onConfirm={async () => { await deleteItem("learned_guidance", g.id); await qc.invalidateQueries({ queryKey: ["guidance"] }); }} />
              <Switch checked={g.active} onCheckedChange={async (v) => { await setGuidanceActive(g.id, v); void qc.invalidateQueries({ queryKey: ["guidance"] }); }} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Failure counts per check</h2>
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {ALL_CHECKS.map((c) => (
            <div key={c.id} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] sm:grid-cols-[minmax(0,16rem)_1fr_2rem] items-center gap-3 text-sm">
              <span className="truncate"><span className="font-mono text-xs text-muted-foreground">{c.id}</span> {c.name}</span>
              <div className="h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-forge" style={{ width: `${((counts[c.id] ?? 0) / max) * 100}%` }} /></div>
              <span className="text-right font-bold">{counts[c.id] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">Rubric wording suggestions</h2>
        <p className="mb-3 text-sm text-muted-foreground">Approved wording replaces that check in the evaluator on the next run.</p>
        {suggestions.data?.length === 0 && <p className="text-muted-foreground">No pending suggestions.</p>}
        <ul className="space-y-2">
          {suggestions.data?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
              <span><b>{s.checkId}:</b> {s.wording}</span>
              <span className="flex shrink-0 items-center gap-2">
                <DeleteButton what="this suggestion" onConfirm={async () => { await deleteItem("rubric_suggestions", s.id); await qc.invalidateQueries({ queryKey: ["suggestions"] }); }} />
                {(["approved", "dismissed"] as const).map((st) => (
                  <Button key={st} size="sm" variant={st === "approved" ? "default" : "outline"}
                    onClick={async () => { await setSuggestionStatus(s.id, st); void qc.invalidateQueries({ queryKey: ["suggestions"] }); }}>
                    {st === "approved" ? "Approve" : "Dismiss"}
                  </Button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
