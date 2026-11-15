import { describe, it, expect } from "vitest";
import { ruleChecks, avgSentenceLength, wordCount } from "./checks";

const sections = "# What is it\n## Why it matters\n## How it works\n## Examples\n## Summary\n";

describe("rule checks", () => {
  it("fails when lesson is under 500 words", () => {
    const r = ruleChecks(sections + "Short text here. ".repeat(10));
    expect(r.find((c) => c.id === "R2")!.pass).toBe(false);
  });
  it("passes 500-1200 words", () => {
    expect(wordCount("word ".repeat(600))).toBe(600);
    const r = ruleChecks(sections + "This is a simple short line. ".repeat(100));
    expect(r.find((c) => c.id === "R2")!.pass).toBe(true);
    expect(r.find((c) => c.id === "R3")!.pass).toBe(true);
  });
  it("fails average sentence length above 20 words", () => {
    const long = ("word ".repeat(25) + ". ").repeat(5);
    expect(avgSentenceLength(long)).toBeGreaterThan(20);
    expect(ruleChecks(long).find((c) => c.id === "R1")!.pass).toBe(false);
  });
  it("reports missing sections", () => {
    expect(ruleChecks("# What is it\ntext").find((c) => c.id === "R3")!.pass).toBe(false);
  });
});
