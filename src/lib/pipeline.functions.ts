/**
 * Server functions for every LLM stage. Each runs on the server, so the key
 * (imported from src/server/llm-key.server.ts) never reaches the browser.
 * The browser drives the loop stage-by-stage, which keeps each request short
 * (important on Netlify, where functions have time limits) and gives live progress.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MODEL, FALLBACK_MODELS, LEARNER_PROFILE } from "@/config/llm";
import { RUBRIC } from "@/lib/checks";
import { getLlmApiKey } from "@/server/llm-key.server";

/** One Gemini call with retry on overload (429/503). */
async function callGemini(system: string, user: string, json = false): Promise<string> {
  const key = getLlmApiKey();
  const models = [MODEL, ...FALLBACK_MODELS];
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: json ? 0 : 0.7, ...(json ? { responseMimeType: "application/json" } : {}) },
  };
  let lastErr = "";
  for (let i = 0; i < 4; i++) {
    // Attempts 1-2 use MODEL, then fall back to lighter models if overloaded.
    const model = models[Math.min(Math.max(0, i - 1), models.length - 1)];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      // Network error or timeout → retry
      lastErr = `Could not reach Gemini: ${e instanceof Error ? e.message : String(e)}`;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (text) return text;
      lastErr = "Empty response from model";
    } else {
      lastErr = `Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (res.status !== 429 && res.status !== 503 && res.status !== 500) break;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(lastErr);
}

const GEN_SYSTEM = `You are an expert teacher writing beginner lessons.
Learner: ${LEARNER_PROFILE}
Rules:
- Use short sentences (under 15 words on average). Use simple, common English words.
- Define every technical term in plain words the first time you use it.
- Order ideas from simple to complex.
- Give at least 2 real-life examples or analogies (e.g. a student looking in a textbook before answering).
- Length: 600 to 1000 words.
- Output Markdown with EXACTLY these headings in this order:
  # <Lesson title>
  ## What is it?
  ## Why it matters
  ## How it works
  ## Examples
  ## Summary
- In "How it works", use a numbered list of steps (retrieve → augment → generate when relevant).
Output only the lesson markdown.`;

export const generateLesson = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      topic: z.string().min(2).max(300),
      guidance: z.array(z.string()).max(30),
      previousFailures: z.array(z.object({ id: z.string(), name: z.string(), reason: z.string() })),
      previousLesson: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    let user = `Topic: ${data.topic}\n`;
    if (data.guidance.length) user += `\nLearned guidance from past runs (follow these):\n${data.guidance.map((g) => `- ${g}`).join("\n")}\n`;
    if (data.previousFailures.length) {
      user += `\nYour previous version FAILED these checks. Fix every one:\n${data.previousFailures
        .map((f) => `- ${f.id} ${f.name}: ${f.reason}`).join("\n")}\n`;
      if (data.previousLesson) user += `\nPrevious version:\n"""\n${data.previousLesson}\n"""\nRewrite the full lesson.`;
    }
    return { lesson: (await callGemini(GEN_SYSTEM, user)).trim() };
  });

const evalSystem = (o: Record<string, string>) => `You are a strict, independent lesson reviewer. You did NOT write this lesson.
Learner: ${LEARNER_PROFILE}
Grade the lesson against each check. Pass/fail only, no partial credit. If in doubt, fail.
Checks:
${RUBRIC.map((r) => `${r.id}: ${o[r.id] ?? r.name}`).join("\n")}
For C6, fail on ANY factual error (e.g. claiming RAG retrains or changes model weights is wrong).
For C5, fail if any technical term (e.g. embedding, vector database, LLM, token) is used before it is explained.
Return ONLY JSON: {"checks":[{"id":"C1","pass":true,"reason":"one short sentence"}, ...]} with all 8 checks.`;

const evalSchema = z.object({
  checks: z.array(z.object({ id: z.string(), pass: z.boolean(), reason: z.string() })).min(8),
});

export const evaluateLesson = createServerFn({ method: "POST" })
  .validator((d) => z.object({ topic: z.string(), lesson: z.string(), rubricOverrides: z.record(z.string()).optional() }).parse(d))
  .handler(async ({ data }) => {
    // Approved rubric wording (from the Reflector, approved on the Memory page) replaces the default.
    const overrides = data.rubricOverrides ?? {};
    const user = `Topic: ${data.topic}\n\nLesson:\n"""\n${data.lesson}\n"""`;
    // Invalid JSON from evaluator → retry once.
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await callGemini(evalSystem(overrides), user, true);
      try {
        const cleaned = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
        const parsed = evalSchema.parse(JSON.parse(cleaned));
        return {
          checks: RUBRIC.map((r) => {
            const c = parsed.checks.find((x) => x.id === r.id);
            return { id: r.id, name: overrides[r.id] ?? r.name, kind: "llm" as const, pass: c?.pass ?? false, reason: c?.reason ?? "Evaluator gave no result." };
          }),
        };
      } catch {
        if (attempt === 1) throw new Error("Evaluator returned invalid JSON twice.");
      }
    }
    throw new Error("unreachable");
  });

export const summarizeChange = createServerFn({ method: "POST" })
  .validator((d) => z.object({ oldLesson: z.string(), newLesson: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const text = await callGemini(
      "You compare two versions of a lesson. In 2-3 short bullet points, say what changed in the new version. Be concrete. Output only the bullets.",
      `OLD:\n"""\n${data.oldLesson}\n"""\n\nNEW:\n"""\n${data.newLesson}\n"""`,
    );
    return { summary: text.trim() };
  });

export const reflect = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      logs: z.array(z.object({ failed: z.array(z.object({ id: z.string(), name: z.string(), reason: z.string() })) })).max(50),
      existing: z.array(z.string()).max(50),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.logs.length) return { rules: [] as string[], rubricSuggestion: null };
    const raw = await callGemini(
      `You improve a lesson generator by studying its past failures. Write 1-3 NEW short, actionable guidance rules (max 20 words each) that would prevent these failures. Do not repeat existing rules. Optionally suggest sharper wording for one rubric check.
Return ONLY JSON: {"rules":["..."],"rubricSuggestion":{"checkId":"C5","wording":"..."} or null}`,
      `Existing rules:\n${data.existing.map((e) => `- ${e}`).join("\n") || "(none)"}\n\nRecent failures:\n${data.logs
        .flatMap((l) => l.failed.map((f) => `- ${f.id} ${f.name}: ${f.reason}`)).join("\n")}`,
      true,
    );
    try {
      const p = z.object({
        rules: z.array(z.string()).max(3),
        rubricSuggestion: z.object({ checkId: z.string(), wording: z.string() }).nullable().optional(),
      }).parse(JSON.parse(raw));
      return { rules: p.rules, rubricSuggestion: p.rubricSuggestion ?? null };
    } catch {
      return { rules: [] as string[], rubricSuggestion: null };
    }
  });
