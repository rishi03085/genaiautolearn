import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture — LessonForge" },
      { name: "description", content: "How the generate, evaluate, regenerate and memory loop works." },
      { property: "og:title", content: "Architecture — LessonForge" },
      { property: "og:description", content: "How LessonForge's self-evaluating loop works." },
    ],
  }),
  component: Architecture,
});

const STEPS = [
  { t: "Generator", d: "Writes the lesson using learned guidance and previous failure reasons." },
  { t: "Evaluator", d: "Separate LLM call, strict JSON, 8 pass/fail checks + 3 code checks." },
  { t: "Regenerate", d: "Any fail → feed reasons back. Max 2 retries, always stops." },
  { t: "Memory", d: "Firestore stores runs, attempts, rejections; Reflector writes new rules." },
];

function Architecture() {
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold">Architecture</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.t} className="relative rounded-xl border border-border bg-card p-4">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-forge font-bold text-primary-foreground">{i + 1}</span>
            <h2 className="mt-3 font-bold">{s.t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
      <pre className="overflow-x-auto rounded-xl bg-ink p-5 text-sm text-ink-foreground">{`topic + learned guidance
        │
        ▼
  ┌───────────┐   lesson   ┌───────────┐  all pass  ┌──────────┐
  │ Generator │ ─────────▶ │ Evaluator │ ─────────▶ │  Ship it │
  └───────────┘            └───────────┘            └──────────┘
        ▲                        │ any fail (≤ 2 retries)
        └── failed checks ◀──────┘
                                 │
                                 ▼
                 rejection_log ─▶ Reflector ─▶ learned_guidance
                                                (used next run)`}</pre>
      <section className="max-w-2xl space-y-3">
        <h2 className="text-xl font-bold">Why this design</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li><b className="text-foreground">Separate evaluator.</b> A different prompt with no memory of writing the lesson judges it more honestly.</li>
          <li><b className="text-foreground">Hard pass/fail.</b> No partial credit means "good enough" is a clear, checkable decision.</li>
          <li><b className="text-foreground">Code checks.</b> Length and sentence size are measured, not guessed by the model.</li>
          <li><b className="text-foreground">Bounded loop.</b> 3 attempts max, so it always finishes and costs stay predictable.</li>
          <li><b className="text-foreground">Memory.</b> The reflector turns repeated failures into rules, so later runs fail less.</li>
          <li><b className="text-foreground">Key safety.</b> The AI key is read only on the server; the browser never sees it.</li>
        </ul>
      </section>
    </div>
  );
}
