"use client";
import { useEffect, useRef } from "react";

/** A bottom sheet that asks one question. The safe choice is focused first and Escape takes it. */
export function ConfirmSheet({ title, body, keepLabel, leaveLabel, onKeep, onLeave }: {
  title: string; body: string; keepLabel: string; leaveLabel: string; onKeep: () => void; onLeave: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  // The parent re-renders every 200 ms with a fresh onKeep; the effect must run once or it steals focus back.
  const onKeepRef = useRef(onKeep);
  useEffect(() => { onKeepRef.current = onKeep; });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onKeepRef.current(); }
      if (e.key === "Tab") { // two buttons: keep focus inside the dialog
        const els = [...document.querySelectorAll<HTMLElement>(".sheet button")];
        const i = els.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        els[(i + (e.shiftKey ? els.length - 1 : 1)) % els.length].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);
  return (
    <div className="sheet-back" onClick={onKeep}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" aria-describedby="sheet-body" onClick={(e) => e.stopPropagation()}>
        <h2 id="sheet-title">{title}</h2>
        <p id="sheet-body">{body}</p>
        <button ref={keepRef} className="btn block ink" onClick={onKeep}>{keepLabel}</button>
        <button className="btn block ghost" onClick={onLeave}>{leaveLabel}</button>
      </div>
    </div>
  );
}
