"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getWorld } from "@/content";
import { Stick } from "@/art/Stick";
import { useSave } from "@/lib/useSave";
import { isCleared, isMastered, unitKey } from "@/lib/save";
import { blockingUnit, isUnitOpen } from "@/lib/unlock";

/** A winding path of unit nodes. The guide stands at the next node to play; it pulses. */
export function WorldView({ worldId }: { worldId: string }) {
  const w = getWorld(worldId)!;
  const { save } = useSave();
  const [shaking, setShaking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function pressLocked(unitId: string) {
    const blocker = blockingUnit(w, unitId, save);
    if (!blocker) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShaking(unitId);
      timers.current.push(window.setTimeout(() => setShaking(null), 400));
    }
    setToast(`Finish "${blocker.title}" first`);
    timers.current.push(window.setTimeout(() => setToast(null), 2500));
  }
  const style = { ["--wa" as string]: w.accent } as React.CSSProperties;
  const xs = [50, 74, 50, 26, 50, 74, 50]; // percent across, a gentle S
  const STEP = 150;
  const states = w.units.map((u, i) => {
    const p = save.units[unitKey(w.id, u.id)];
    const open = isUnitOpen(w, u.id, save);
    return { u, p, open, cleared: isCleared(p), mastered: isMastered(p) };
  });
  const here = states.findIndex((s) => s.open && !s.cleared);
  const current = here === -1 ? states.length - 1 : here;
  const height = w.units.length * STEP + 40;
  const path = states.map((_, i) => `${i === 0 ? "M" : "L"}${xs[i % xs.length]} ${i * STEP + 70}`).join(" ");

  return (
    <main className="wrap" style={style}>
      <header className="topbar">
        <Link className="x" href="/" aria-label="Back to the map">←</Link>
        <span className="chip">{w.from && w.from !== "new" ? `remastered from ${w.from}` : "new world"}</span>
      </header>
      <h1 className="world-h1">{w.title}</h1>
      <p className="world-sub">{w.tagline}</p>

      <div className="path" style={{ height }}>
        <svg className="path-line" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={path} fill="none" stroke="var(--ink)" strokeDasharray="2 7" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
        </svg>
        {states.map((s, i) => {
          const x = xs[i % xs.length];
          const isHere = i === current;
          const label = s.mastered ? "★" : s.cleared ? "✓" : s.open ? String(i + 1) : "🔒";
          return (
            <div key={s.u.id} className="node-wrap" style={{ left: `${x}%`, top: i * STEP + 30 }}>
              {isHere && (
                <span className={`node-guide ${x > 50 ? "left" : "right"}`} aria-hidden="true">
                  <Stick {...w.guide} size={58} />
                </span>
              )}
              {s.open ? (
                <Link
                  href={`/play/${w.id}/${s.u.id}/`}
                  className={`node ${s.cleared ? "cleared" : ""} ${s.mastered ? "mastered" : ""} ${isHere ? "here" : ""}`}
                  aria-label={`Unit ${i + 1}: ${s.u.title}${s.mastered ? ", mastered" : s.cleared ? ", cleared" : ""}`}
                >
                  {label}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`node locked ${shaking === s.u.id ? "shake" : ""}`}
                  onClick={() => pressLocked(s.u.id)}
                  aria-label={`Unit ${i + 1}: ${s.u.title}, locked`}
                >
                  {label}
                </button>
              )}
              <span className="node-title">{s.u.title}</span>
              <span className="node-blurb">{isHere ? "you are here" : s.p ? `best ${Math.round(s.p.best * 100)}%` : s.u.blurb}</span>
            </div>
          );
        })}
      </div>
      <p className="foot">Clear a unit at 70% to open the next. ★ = mastered (90% over your last 3 rounds). Old cards come back on purpose: that&apos;s how memory sticks.</p>
      {toast && <div className="locked-toast" role="status">{toast}</div>}
    </main>
  );
}
