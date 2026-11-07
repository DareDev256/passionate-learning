import type { Answer } from "./round";

export const RESUME_KEY = "passionate-learning:round";
export const RESUME_MAX_MS = 30 * 60 * 1000;

export interface InProgress {
  world: string;
  unit: string;
  seed: number;
  idx: number;
  answers: Answer[];
  spentMs: number;
  roundXp: number;
  combo: number;
  savedAt: number;
}

export function saveInProgress(p: InProgress): void {
  try { localStorage.setItem(RESUME_KEY, JSON.stringify(p)); } catch { /* storage full or blocked: resuming is a nicety */ }
}

/** The stored round for any unit (Home offers to continue it), or null when missing, corrupt or older than RESUME_MAX_MS. */
export function peekInProgress(now = Date.now()): InProgress | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as InProgress;
    if (!p || typeof p.world !== "string" || typeof p.unit !== "string") return null;
    if (!Array.isArray(p.answers) || typeof p.seed !== "number" || typeof p.savedAt !== "number") return null;
    if (now - p.savedAt > RESUME_MAX_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function loadInProgress(world: string, unit: string, now = Date.now()): InProgress | null {
  const p = peekInProgress(now);
  return p && p.world === world && p.unit === unit ? p : null;
}

export function clearInProgress(): void {
  try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
}
