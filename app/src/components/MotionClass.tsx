"use client";
import { useEffect } from "react";
import { type MotionPref, loadSave, motionClass } from "@/lib/save";

/** Puts the player's motion choice on `<html>` (class `reduce-motion`, attribute `data-motion`). */
export function applyMotion(m: MotionPref) {
  const el = document.documentElement;
  el.classList.toggle("reduce-motion", motionClass(m) === "reduce-motion");
  el.dataset.motion = m;
}

export function MotionClass() {
  useEffect(() => { applyMotion(loadSave().settings.motion); }, []);
  return null;
}
