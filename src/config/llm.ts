/**
 * LLM configuration. Change MODEL here to switch the Gemini model everywhere.
 * (No secrets in this file — it is safe for the browser bundle.)
 */
export const MODEL = "gemini-3.5-flash";
export const MAX_RETRIES = 2; // 2 retries = 3 attempts total
export const DEFAULT_TOPIC = "Introduction to RAG (Retrieval-Augmented Generation)";
export const LEARNER_PROFILE =
  "A 12th-grade graduate from India with limited English vocabulary, from a non-English-medium school, starting from zero, who wants to start a career in AI.";
/** Used automatically if MODEL is overloaded (503/429). */
export const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest"];
