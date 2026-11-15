/**
 * THE API KEY LIVES HERE (server-only).
 *
 * The real key value is NOT written in the code. It is stored as the secret /
 * environment variable `LLM_API_KEY`:
 *   - Local development: .env.local
 *   - Netlify: Project configuration → Environment variables → LLM_API_KEY
 *
 * Every LLM call imports `getLlmApiKey` from this file. It is a server-only
 * function, so the key never reaches the browser.
 */
import { createServerOnlyFn } from "@tanstack/react-start";

export const getLlmApiKey = createServerOnlyFn(() => {
  const key = process.env['LLM_API_KEY'];
  if (!key) throw new Error("LLM_API_KEY is not set. Add it as an environment variable.");
  return key;
});
