"use client";
import { useEffect } from "react";
import { loadSave } from "@/lib/save";
import { applyTheme } from "@/lib/themeStore";

/** Puts the player's equipped theme on `<html data-theme>` after mount. */
export function ThemeClass() {
  useEffect(() => { applyTheme(loadSave().themes.equipped); }, []);
  return null;
}
