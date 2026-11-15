import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DeleteButton } from "@/components/DeleteButton";
import ReactMarkdown from "react-markdown";
import { deleteItem, listRejections } from "@/lib/store";
import { PassBadge } from "@/components/RubricTable";

export const Route = createFileRoute("/rejections")({
  ssr: false, // Firestore is read in the browser
  head: () => ({
    meta: [
      { title: "Rejection log — LessonForge" },
      { name: "description", content: "Every failed lesson attempt, what failed, why, and what changed." },
      { property: "og:title", content: "Rejection log — LessonForge" },
      { property: "og:description", content: "Every failed lesson attempt and what changed on retry." },
    ],
  }),
  component: Rejections,
});

function Rejections() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["rejections"], queryFn: () => listRejections() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["rejections"] });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="truncate text-3xl font-extrabold">Rejection log</h1>
        {!!data?.length && (
          <DeleteButton what="all rejection entries" label="Clear all"
            onConfirm={async () => { await Promise.all(data.map((r) => deleteItem("rejection_log", r.id))); await refresh(); }} />
        )}
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">Could not read Firestore: {(error as Error).message}</p>}
      {data?.length === 0 && <p className="text-muted-foreground">No failed attempts yet. Try a run with the error toggle on.</p>}
      {data?.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="min-w-0">
              <h2 className="font-bold">{r.topic} · Attempt {r.attempt}</h2>
              <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <DeleteButton what="this entry" onConfirm={async () => { await deleteItem("rejection_log", r.id); await refresh(); }} />
          </div>
          <ul className="space-y-2 text-sm">
            {r.failed.map((f) => (
              <li key={f.id} className="flex min-w-0 gap-2"><PassBadge pass={false} /><span><b>{f.id} {f.name}:</b> <span className="text-muted-foreground">{f.reason}</span></span></li>
            ))}
          </ul>
          <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
            <p className="font-semibold">What changed on retry</p>
            {r.whatChanged ? <div className="lesson-prose text-sm"><ReactMarkdown>{r.whatChanged}</ReactMarkdown></div>
              : <p className="text-muted-foreground">No retry followed (last attempt).</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
