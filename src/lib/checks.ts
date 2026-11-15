/** Rule-based (non-LLM) lesson checks. Pure functions, unit-tested. */
export type CheckResult = { id: string; name: string; pass: boolean; reason: string; kind: "llm" | "rule" };

export const RUBRIC: { id: string; name: string }[] = [
  { id: "C1", name: "Defines the topic in one plain sentence" },
  { id: "C2", name: "Explains why it matters (hallucination / outdated knowledge)" },
  { id: "C3", name: "Explains how it works in clear ordered steps" },
  { id: "C4", name: "Has at least 2 concrete examples or analogies" },
  { id: "C5", name: "Every technical term is defined when first used" },
  { id: "C6", name: "No factual errors / grounded in how it really works" },
  { id: "C7", name: "Beginner-friendly language for a non-native English reader" },
  { id: "C8", name: "Logical teaching flow from simple to complex" },
];

export const REQUIRED_SECTIONS = ["what", "why", "how", "example", "summary"];

function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/[*_`>#|-]/g, " ");
}

export function wordCount(md: string) {
  return stripMarkdown(md).split(/\s+/).filter(Boolean).length;
}

export function avgSentenceLength(md: string) {
  const sentences = stripMarkdown(md)
    .split(/[.!?]+|\n\s*\n|\n/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
  if (!sentences.length) return 0;
  const words = sentences.reduce((n, s) => n + s.split(/\s+/).filter(Boolean).length, 0);
  return words / sentences.length;
}

export function missingSections(md: string) {
  const headings = (md.match(/^#{1,3}\s.*$/gm) ?? []).map((h) => h.toLowerCase());
  return REQUIRED_SECTIONS.filter((k) => !headings.some((h) => h.includes(k)));
}

export function ruleChecks(md: string): CheckResult[] {
  const avg = avgSentenceLength(md);
  const wc = wordCount(md);
  const missing = missingSections(md);
  return [
    {
      id: "R1", kind: "rule", name: "Average sentence length ≤ 20 words",
      pass: avg <= 20, reason: `Average is ${avg.toFixed(1)} words per sentence.`,
    },
    {
      id: "R2", kind: "rule", name: "Lesson length 500–1200 words",
      pass: wc >= 500 && wc <= 1200, reason: `Lesson has ${wc} words.`,
    },
    {
      id: "R3", kind: "rule", name: "Has required sections",
      pass: missing.length === 0,
      reason: missing.length ? `Missing headings containing: ${missing.join(", ")}.` : "All sections present.",
    },
  ];
}
