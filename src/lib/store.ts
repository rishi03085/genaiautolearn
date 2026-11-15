/**
 * Memory layer in Firestore. Collections:
 *  runs, attempts, rejection_log, learned_guidance, rubric_suggestions
 */
import {
  addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { CheckResult } from "./checks";

export type FailedCheck = { id: string; name: string; reason: string };
export type RejectionEntry = {
  id: string; runId: string; topic: string; attempt: number; failed: FailedCheck[]; whatChanged: string | null; createdAt: number;
};
export type Guidance = { id: string; rule: string; active: boolean; createdAt: number };
export type RubricSuggestion = { id: string; checkId: string; wording: string; status: string; createdAt: number };
export type RunRecord = {
  id: string;
  topic: string;
  status: "running" | "passed" | "failed" | "error";
  attempts: number;
  finalLesson: string | null;
  createdAt: number;
};
export type SavedAttempt = {
  id: string;
  runId: string;
  attempt: number;
  lesson: string;
  checks: CheckResult[];
  passed: boolean;
  createdAt: number;
};

const c = (name: string) => collection(getDb(), name);

/** Recent saved lesson runs for the History page. */
export async function listRuns(max = 100): Promise<RunRecord[]> {
  const s = await getDocs(query(c("runs"), orderBy("createdAt", "desc"), limit(max)));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RunRecord, "id">) }));
}

/** Every generated attempt belonging to one saved run. */
export async function listRunAttempts(runId: string): Promise<SavedAttempt[]> {
  const s = await getDocs(query(c("attempts"), where("runId", "==", runId), limit(20)));
  return s.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SavedAttempt, "id">) }))
    .sort((a, b) => a.attempt - b.attempt);
}

/** Delete a run and its saved lesson attempts and rejection records. */
export async function deleteRun(runId: string): Promise<void> {
  const db = getDb();
  const [attempts, rejections] = await Promise.all([
    getDocs(query(collection(db, "attempts"), where("runId", "==", runId))),
    getDocs(query(collection(db, "rejection_log"), where("runId", "==", runId))),
  ]);
  await Promise.all([
    ...attempts.docs.map((entry) => deleteDoc(entry.ref)),
    ...rejections.docs.map((entry) => deleteDoc(entry.ref)),
    deleteDoc(doc(db, "runs", runId)),
  ]);
}

export async function createRun(topic: string, sabotage: boolean) {
  const ref = await addDoc(c("runs"), { topic, sabotage, status: "running", createdAt: Date.now(), ts: serverTimestamp() });
  return ref.id;
}
export async function finishRun(runId: string, status: "passed" | "failed" | "error", attempts: number, finalLesson: string | null) {
  await updateDoc(doc(getDb(), "runs", runId), { status, attempts, finalLesson, finishedAt: Date.now() });
}
export async function saveAttempt(runId: string, attempt: number, lesson: string, checks: CheckResult[], passed: boolean) {
  await addDoc(c("attempts"), { runId, attempt, lesson, checks, passed, createdAt: Date.now() });
}
export async function saveRejection(e: Omit<RejectionEntry, "id" | "createdAt">) {
  const ref = await addDoc(c("rejection_log"), { ...e, createdAt: Date.now() });
  return ref.id;
}
export async function setRejectionChange(id: string, whatChanged: string) {
  await updateDoc(doc(getDb(), "rejection_log", id), { whatChanged });
}
export async function listRejections(max = 100): Promise<RejectionEntry[]> {
  const s = await getDocs(query(c("rejection_log"), orderBy("createdAt", "desc"), limit(max)));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RejectionEntry, "id">) }));
}
export async function listGuidance(): Promise<Guidance[]> {
  const s = await getDocs(query(c("learned_guidance"), orderBy("createdAt", "desc"), limit(50)));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Guidance, "id">) }));
}
export async function activeGuidance(): Promise<string[]> {
  return (await listGuidance()).filter((g) => g.active).slice(0, 15).map((g) => g.rule);
}
export async function addGuidance(rule: string) {
  await addDoc(c("learned_guidance"), { rule, active: true, createdAt: Date.now() });
}
export async function setGuidanceActive(id: string, active: boolean) {
  await updateDoc(doc(getDb(), "learned_guidance", id), { active });
}
export async function addRubricSuggestion(checkId: string, wording: string) {
  await addDoc(c("rubric_suggestions"), { checkId, wording, status: "pending", createdAt: Date.now() });
}
export async function listRubricSuggestions(): Promise<RubricSuggestion[]> {
  const s = await getDocs(query(c("rubric_suggestions"), where("status", "==", "pending"), limit(20)));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RubricSuggestion, "id">) }));
}
export async function setSuggestionStatus(id: string, status: "approved" | "dismissed") {
  await updateDoc(doc(getDb(), "rubric_suggestions", id), { status });
}

/** Latest approved wording per rubric check — the evaluator grades with these. */
export async function approvedRubricOverrides(): Promise<Record<string, string>> {
  const s = await getDocs(query(c("rubric_suggestions"), where("status", "==", "approved"), limit(50)));
  const rows = s.docs.map((d) => d.data() as Omit<RubricSuggestion, "id">).sort((a, b) => a.createdAt - b.createdAt);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.checkId] = r.wording; // newest wins
  return out;
}

/** Delete one document from a LessonForge collection. */
export async function deleteItem(
  col: "rejection_log" | "learned_guidance" | "rubric_suggestions",
  id: string,
) {
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(getDb(), col, id));
}
