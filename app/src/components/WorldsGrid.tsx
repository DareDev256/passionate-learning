"use client";
import Link from "next/link";
import { liveWorlds } from "@/content";
import type { World } from "@/content/types";
import { Logo } from "@/art/Logo";
import { Stick } from "@/art/Stick";
import { useSave } from "@/lib/useSave";
import { type Save, isCleared, isMastered, unitKey } from "@/lib/save";

function worldProgress(w: World, save: Save) {
  if (!w.units.length) return 0;
  return w.units.filter((u) => isCleared(save.units[unitKey(w.id, u.id)])).length / w.units.length;
}

/** Every live world, one tap deeper than Home. */
export function WorldsGrid() {
  const { save } = useSave();
  return (
    <main className="wrap">
      <header className="topbar"><Link className="x" href="/" aria-label="Back to Home">{"←"}</Link><Logo size={40} /></header>
      <h1 className="h2">Worlds <small>pick one, any one</small></h1>
      <div className="worlds">
        {liveWorlds().map((w) => {
          const prog = worldProgress(w, save);
          const mastered = w.units.every((u) => isMastered(save.units[unitKey(w.id, u.id)]));
          return (
            <Link key={w.id} className="world" href={`/w/${w.id}/`} style={{ ["--wa" as string]: w.accent } as React.CSSProperties}>
              <span className="world-tag">{w.units.length} UNITS{mastered ? " · MASTERED" : prog > 0 ? ` · ${Math.round(prog * 100)}%` : ""}</span>
              <span className="world-art"><Stick {...w.guide} size={64} label={`${w.title} guide`} /></span>
              <span className="world-body">
                <span className="world-title">{w.title}</span>
                <span className="world-tagline">{w.tagline}</span>
                <span className="bar" aria-label={`${Math.round(prog * 100)}% cleared`}><i style={{ width: `${prog * 100}%` }} /></span>
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
