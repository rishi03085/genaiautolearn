/**
 * The generate → evaluate → regenerate loop, driven from the browser.
 * Each LLM stage is a separate server call so progress updates live.
 */
import { MAX_RETRIES } from "@/config/llm";
import { ruleChecks, type CheckResult } from "./checks";
import { evaluateLesson, generateLesson, reflect, summarizeChange } from "./pipeline.functions";
import * as store from "./store";

export type Stage = "generating" | "sabotaging" | "evaluating" | "comparing" | "done" | "failed";
export type AttemptState = { n: number; stage: Stage; lesson?: string; checks?: CheckResult[]; passed?: boolean; whatChanged?: string };
export type RunState = {
  status: "idle" | "running" | "passed" | "failed" | "error";
  attempts: AttemptState[];
  finalLesson?: string;
  reflecting?: boolean;
  newRules?: string[];
  error?: string;
  storageWarning?: string;
};

/** Sabotage: inject a wrong fact and unexplained jargon. */
export function sabotage(lesson: string) {
  const wrong =
    "\n\nImportant: RAG works by retraining the model's weights every time you ask a question, using cosine-similarity over HNSW-indexed dense embeddings in a vector DB.\n";
  const i = lesson.indexOf("## How it works");
  return i === -1 ? lesson + wrong : lesson.slice(0, i) + wrong.trim() + "\n\n" + lesson.slice(i);
}

/** Wraps a Firestore call so storage problems never stop the pipeline. */
async function safe<T>(fn: () => Promise<T>, onErr: (m: string) => void): Promise<T | undefined> {
  try { return await fn(); } catch (e) { onErr(e instanceof Error ? e.message : String(e)); return undefined; }
}

export async function runPipeline(topic: string, useSabotage: boolean, onUpdate: (s: RunState) => void) {
  const state: RunState = { status: "running", attempts: [] };
  const push = () => onUpdate(structuredClone(state));
  const warn = (m: string) => { state.storageWarning = `Saving to Firestore failed: ${m}`; push(); };
  push();

  const runId = (await safe(() => store.createRun(topic, useSabotage), warn)) ?? `local-${Date.now()}`;
  const guidance = (await safe(() => store.activeGuidance(), warn)) ?? [];
  const rubricOverrides = (await safe(() => store.approvedRubricOverrides(), warn)) ?? {};
  const runRejections: { failed: store.FailedCheck[] }[] = [];

  let prevLesson: string | undefined;
  let prevFailures: store.FailedCheck[] = [];
  let pendingRejectionId: string | undefined;

  try {
    for (let n = 1; n <= MAX_RETRIES + 1; n++) {
      const a: AttemptState = { n, stage: "generating" };
      state.attempts.push(a); push();

      let { lesson } = await generateLesson({ data: { topic, guidance, previousFailures: prevFailures, ...(prevLesson ? { previousLesson: prevLesson } : {}) } });
      if (useSabotage && n === 1) { a.stage = "sabotaging"; push(); lesson = sabotage(lesson); }
      a.lesson = lesson;

      // On retries, describe what changed vs the previous version (stored on the previous rejection).
      if (prevLesson && pendingRejectionId !== undefined) {
        a.stage = "comparing"; push();
        const { summary } = await summarizeChange({ data: { oldLesson: prevLesson, newLesson: lesson } });
        a.whatChanged = summary;
        const id = pendingRejectionId;
        await safe(() => store.setRejectionChange(id, summary), warn);
      }

      a.stage = "evaluating"; push();
      const { checks: llm } = await evaluateLesson({ data: { topic, lesson, rubricOverrides } });
      const checks = [...llm, ...ruleChecks(lesson)];
      const passed = checks.every((c) => c.pass);
      Object.assign(a, { checks, passed, stage: passed ? "done" : "failed" }); push();
      await safe(() => store.saveAttempt(runId, n, lesson, checks, passed), warn);

      if (passed) { state.status = "passed"; state.finalLesson = lesson; break; }

      const failed = checks.filter((c) => !c.pass).map(({ id, name, reason }) => ({ id, name, reason }));
      runRejections.push({ failed });
      pendingRejectionId = await safe(() => store.saveRejection({ runId, topic, attempt: n, failed, whatChanged: null }), warn) ?? "";
      prevLesson = lesson; prevFailures = failed;
    }
    if (state.status !== "passed") { state.status = "failed"; if (prevLesson) state.finalLesson = prevLesson; }
  } catch (e) {
    state.status = "error";
    state.error = e instanceof Error ? e.message : String(e);
  }
  push();
  await safe(() => store.finishRun(runId, state.status === "running" ? "error" : (state.status as "passed"), state.attempts.length, state.finalLesson ?? null), warn);

  // Reflector: learn from recent failures (this run + recent history).
  state.reflecting = true; push();
  try {
    const recent = (await safe(() => store.listRejections(20), warn)) ?? [];
    const logs = recent.length ? recent.map((r) => ({ failed: r.failed })) : runRejections;
    const { rules, rubricSuggestion } = await reflect({ data: { logs, existing: guidance } });
    for (const r of rules) await safe(() => store.addGuidance(r), warn);
    if (rubricSuggestion) await safe(() => store.addRubricSuggestion(rubricSuggestion.checkId, rubricSuggestion.wording), warn);
    state.newRules = rules;
  } catch { /* reflection is best-effort */ }
  state.reflecting = false; push();
}
