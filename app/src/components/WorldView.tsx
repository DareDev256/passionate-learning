"use client";
import Link from "next/link";
import { getWorld } from "@/content";
import { Stick } from "@/art/Stick";
import { useSave } from "@/lib/useSave";
import { isCleared, isMastered, unitKey } from "@/lib/save";

export function WorldView({ worldId }: { worldId: string }) {
  const w = getWorld(worldId)!;
  const { save } = useSave();
  const style = { ["--wa" as string]: w.accent } as React.CSSProperties;
  return (
    <main className="wrap" style={style}>
      <header className="topbar">
        <Link className="x" href="/" aria-label="Back to the map">←</Link>
        <span className="chip">{w.from ? `remastered from ${w.from}` : "new world"}</span>
      </header>
      <div className="guide">
        <Stick {...w.guide} size={92} />
        <div>
          <h1 className="recap-title" style={{ textAlign: "left", fontSize: "clamp(30px,8vw,44px)" }}>{w.title}</h1>
          <p className="bubble" style={{ marginBottom: 0 }}>{w.tagline}</p>
        </div>
      </div>
      <h2 className="h2">Units <small>clear one at 70% to open the next</small></h2>
      <div className="units">
        {w.units.map((u, i) => {
          const p = save.units[unitKey(w.id, u.id)];
          const open = i === 0 || isCleared(save.units[unitKey(w.id, w.units[i - 1].id)]);
          const mastered = isMastered(p);
          return (
            <Link key={u.id} className={`unit ${open ? "" : "locked"}`} href={`/play/${w.id}/${u.id}/`} aria-disabled={!open} tabIndex={open ? 0 : -1}>
              <span className="unit-n">{open ? i + 1 : "🔒"}</span>
              <span>
                <span className="unit-title">{u.title}</span><br />
                <span className="unit-blurb">{u.blurb} · {u.cards.length} cards</span>
              </span>
              {mastered ? <span className="badge mastered">MASTERED</span> : isCleared(p) ? <span className="badge cleared">{Math.round(p!.best * 100)}%</span> : null}
            </Link>
          );
        })}
      </div>
      <p className="foot">Mastered = 90% across your last 3 rounds. Old cards come back later on purpose: that&apos;s how memory sticks.</p>
    </main>
  );
}
