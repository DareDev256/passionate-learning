"use client";
// The equipped theme as a tiny client store, so every Stickman can wear the theme's outfit without prop drilling.
// The server snapshot is always Notebook, so static HTML and first hydration agree; the saved theme lands right after mount.
import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, themeOrDefault } from "./themes";

let current = DEFAULT_THEME;
const subs = new Set<() => void>();

/** Sets the theme app-wide: the store, `<html data-theme>`, and the browser theme colour. */
export function applyTheme(id: string) {
  const t = themeOrDefault(id);
  current = t.id;
  if (typeof document !== "undefined") {
    const el = document.documentElement;
    el.dataset.theme = t.id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.ground);
  }
  subs.forEach((f) => f());
}

export function useThemeId(): string {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current, () => DEFAULT_THEME);
}
