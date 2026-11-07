import { describe, it, expect, beforeEach } from "vitest";
import { RESUME_KEY, peekInProgress, loadInProgress, clearInProgress } from "@/lib/roundResume";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const NOW = 1_000_000;
const good = () => ({ world: "prompt", unit: "say-it", seed: 7, idx: 1, answers: [{ key: "a", correct: true, review: false }], spentMs: 4000, roundXp: 10, combo: 1, savedAt: NOW });
const put = (p: unknown) => store.set(RESUME_KEY, JSON.stringify(p));

describe("roundResume validation", () => {
  it("accepts a well-formed record", () => {
    put(good());
    expect(peekInProgress(NOW)?.unit).toBe("say-it");
    expect(loadInProgress("prompt", "say-it", NOW)).not.toBeNull();
    expect(loadInProgress("prompt", "other", NOW)).toBeNull();
  });
  it("treats a malformed answer as corrupt", () => {
    put({ ...good(), answers: [{ correct: true, review: false }] });
    expect(peekInProgress(NOW)).toBeNull();
    put({ ...good(), answers: [null] });
    expect(peekInProgress(NOW)).toBeNull();
    put({ ...good(), answers: [{ key: "a", correct: "yes", review: false }] });
    expect(peekInProgress(NOW)).toBeNull();
  });
  it("treats a non-numeric spentMs as corrupt", () => {
    put({ ...good(), spentMs: "4000" });
    expect(peekInProgress(NOW)).toBeNull();
    put({ ...good(), roundXp: null });
    expect(peekInProgress(NOW)).toBeNull();
  });
  it("expires after 30 minutes and clears", () => {
    put(good());
    expect(peekInProgress(NOW + 31 * 60 * 1000)).toBeNull();
    clearInProgress();
    expect(peekInProgress(NOW)).toBeNull();
  });
});
