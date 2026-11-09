"use client";
import Link from "next/link";
import { Stick } from "@/art/Stick";
import { pathWindow, type PathNode } from "@/lib/path";
import type { Save } from "@/lib/save";

const accent = (n: PathNode) => ({ ["--wa" as string]: n.world.accent }) as React.CSSProperties;

/** One path: what is done folds into a chip, the next node is lit, and a few more wait ahead. */
export function HomePath({ save }: { save: Save }) {
  const v = pathWindow(save);
  if (!v.current) {
    return (
      <section className="hp" aria-label="Your path">
        <div className="hp-done">
          <Stick pose="cheer" face="cool" size={72} label="Your guide, cheering" />
          <p>You have cleared every unit. Reviews keep it all fresh, and new worlds will land here.</p>
        </div>
      </section>
    );
  }
  const c = v.current;
  return (
    <section className="hp" aria-label="Your path">
      {v.cleared > 0 && <p className="hp-cleared"><span aria-hidden="true">{"✓"}</span> {v.cleared} unit{v.cleared === 1 ? "" : "s"} cleared</p>}
      <div className="hp-now" style={accent(c)}>
        <span className="world-tag">UP NEXT</span>
        <div className="hp-now-body">
          <Stick {...c.world.guide} size={64} label={`${c.world.title} guide`} />
          <div>
            <span className="world-title">{c.unit.title}</span>
            <span className="hp-sub">{c.world.title}</span>
            <p className="hp-blurb">{c.unit.blurb}</p>
          </div>
        </div>
        <Link className="btn block play-cta" href={`/play/${c.world.id}/${c.unit.id}/`}>{"▶︎"} PLAY</Link>
      </div>
      {v.ahead.length > 0 && (
        <ol className="hp-ahead" aria-label="Coming up">
          {v.ahead.map((n) => (
            <li key={`${n.world.id}/${n.unit.id}`} className={n.open ? "open" : "locked"} style={accent(n)}>
              <span className="hp-dot" aria-hidden="true">{n.open ? "●" : "🔒"}</span>
              <span className="hp-t"><b>{n.unit.title}</b><small>{n.world.title}{n.open ? "" : ", opens after the one above"}</small></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
