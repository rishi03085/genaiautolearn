/**
 * Firebase / Firestore setup. Firebase web config is public by design
 * (security comes from Firestore rules), so it is fine to keep in code.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDjQ3u3hS5bu-u1BleDFnIknxOoJt42cTI",
  authDomain: "genaiproject-eeb9a.firebaseapp.com",
  databaseURL: "https://genaiproject-eeb9a-default-rtdb.firebaseio.com",
  projectId: "genaiproject-eeb9a",
  storageBucket: "genaiproject-eeb9a.firebasestorage.app",
  messagingSenderId: "261586369723",
  appId: "1:261586369723:web:0fc41e7f86d5a6c88cbd9e",
  measurementId: "G-1M6LXJG3GP",
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

/** Lazily create the Firestore client (call only in the browser). */
export function getDb(): Firestore {
  if (!db) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

/** Analytics only works in the browser; load it lazily. */
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  getDb();
  if (app && (await isSupported())) getAnalytics(app);
}
