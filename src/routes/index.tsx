import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy, Download, Loader2, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RubricTable } from "@/components/RubricTable";
import { DEFAULT_TOPIC, MAX_RETRIES } from "@/config/llm";
import { runPipeline, type RunState, type Stage } from "@/lib/runner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LessonForge — self-evaluating lesson generator" },
      { name: "description", content: "Generate, evaluate and regenerate beginner lessons until they pass an 8-point rubric." },
      { property: "og:title", content: "LessonForge — self-evaluating lesson generator" },
      { property: "og:description", content: "Generate, evaluate and regenerate beginner lessons until they pass." },
    ],
  }),
  component: Home,
});

const STAGE_LABEL: Record<Stage, string> = {
  generating: "Generating", sabotaging: "Injecting error", comparing: "Comparing versions",
  evaluating: "Evaluating", done: "Passed", failed: "Failed — regenerating",
};

function Home() {
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [sabotage, setSabotage] = useState(false);
  const [run, setRun] = useState<RunState>({ status: "idle", attempts: [] });
  const running = run.status === "running" || !!run.reflecting;

  const start = () => { if (topic.trim()) void runPipeline(topic.trim(), sabotage, setRun); };

  const download = () => {
    if (!run.finalLesson) return;
    const url = URL.createObjectURL(new Blob([run.finalLesson], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${topic.slice(0, 40).replace(/\W+/g, "-").toLowerCase()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground shadow-forge sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-forge opacity-40 blur-3xl" />
        <p className="relative text-sm font-semibold uppercase tracking-widest text-primary">Generate → Evaluate → Regenerate</p>
        <h1 className="relative mt-2 text-3xl font-extrabold sm:text-5xl">Forge a lesson that passes on its own.</h1>
        <p className="relative mt-2 max-w-2xl text-ink-foreground/70">
          Written for a 12th-grade graduate in India starting AI from zero. Up to {MAX_RETRIES + 1} attempts, 11 hard checks.
        </p>
        <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={running} className="h-12 border-ink-foreground/20 bg-ink-foreground/10 text-base text-ink-foreground placeholder:text-ink-foreground/50" aria-label="Topic" />
          <Button onClick={start} disabled={running} className="h-12 shrink-0 bg-forge px-6 text-primary-foreground shadow-forge hover:opacity-90">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Run pipeline
          </Button>
        </div>
        <label className="relative mt-4 flex w-fit items-center gap-3 text-sm">
          <Switch checked={sabotage} onCheckedChange={setSabotage} disabled={running} />
          Inject deliberate error on attempt 1
        </label>
      </section>

      {run.storageWarning && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {run.storageWarning} — check your Firestore rules. The pipeline still runs.
        </p>
      )}
      {run.error && <p className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">Error: {run.error}</p>}

      {run.attempts.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold">Progress</h2>
          {run.attempts.map((a) => (
            <div key={a.n} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <h3 className="text-lg font-bold">Attempt {a.n} / {MAX_RETRIES + 1}</h3>
                <StageChip stage={a.stage} />
              </div>
              {a.whatChanged && (
                <div className="mb-4 rounded-lg bg-muted p-3 text-sm">
                  <p className="mb-1 font-semibold">What changed on retry</p>
                  <div className="lesson-prose text-sm"><ReactMarkdown>{a.whatChanged}</ReactMarkdown></div>
                </div>
              )}
              {a.checks && <RubricTable checks={a.checks} />}
            </div>
          ))}
          {run.reflecting && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reflector is learning from failures…</p>}
          {run.newRules && run.newRules.length > 0 && (
            <div className="rounded-xl border border-border bg-accent/40 p-4 text-sm">
              <p className="mb-1 font-semibold">New guidance learned</p>
              <ul className="list-disc pl-5">{run.newRules.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {run.finalLesson && run.status !== "running" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">
              {run.status === "passed" ? "Final lesson — passed all checks" : "Best attempt — did not pass all checks"}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(run.finalLesson!); toast.success("Copied"); }}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
              <Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" /> Download .md</Button>
            </div>
          </div>
          <article className="lesson-prose rounded-2xl border border-border bg-card p-6 sm:p-10">
            <ReactMarkdown>{run.finalLesson}</ReactMarkdown>
          </article>
        </section>
      )}
    </div>
  );
}

function StageChip({ stage }: { stage: Stage }) {
  const active = !["done", "failed"].includes(stage);
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold",
      stage === "done" ? "bg-success text-success-foreground" : stage === "failed" ? "bg-destructive text-destructive-foreground" : "bg-secondary")}>
      {active && <span className="h-2 w-2 rounded-full bg-primary animate-ember" />}
      {stage === "done" && <Check className="h-3 w-3" />}
      {stage === "failed" && <X className="h-3 w-3" />}
      {STAGE_LABEL[stage]}
    </span>
  );
}
