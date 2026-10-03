"use client";
import Link from "next/link";
import { WORLDS, liveWorlds } from "@/content";
import type { World } from "@/content/types";
import { Logo } from "@/art/Logo";
import { Stick } from "@/art/Stick";
import { SystemWindow } from "./SystemWindow";
import { useSave } from "@/lib/useSave";
import { type Save, dueKeys, isCleared, isMastered, levelOf, rankOf, unitKey } from "@/lib/save";

/** The first unit that isn't cleared yet, in map order. */
function nextUp(save: Save) {
  for (const w of liveWorlds()) for (const u of w.units) if (!isCleared(save.units[unitKey(w.id, u.id)])) return { w, u };
  const w = liveWorlds()[0];
  return { w, u: w.units[0] };
}

function worldProgress(w: World, save: Save) {
  if (!w.units.length) return 0;
  const done = w.units.filter((u) => isCleared(save.units[unitKey(w.id, u.id)])).length;
  return done / w.units.length;
}

function guideLine(save: Save, due: number) {
  const quest = save.quest;
  if (save.days.length === 0) return <>Yo. I&apos;m your guide. One round is <em>60 seconds</em>. That&apos;s the whole ask.</>;
  if (quest.round && quest.review && quest.perfect) return <>Daily quest <em>cleared</em>. Everything else today is bonus. Go touch grass, or keep going.</>;
  if (due > 0) return <><em>{due} card{due === 1 ? "" : "s"}</em> about to slip out of your brain. One round saves {due === 1 ? "it" : "them"}.</>;
  if (quest.round) return <>Round done today. That counts. A missed day <em>resets nothing</em> here.</>;
  return <>Back again. Pick a world. Or don&apos;t. I&apos;m a <em>drawing</em>.</>;
}

export function Home() {
  const { save, ready } = useSave();
  const r = rankOf(save.xp);
  const due = dueKeys(save).length;
  const up = nextUp(save);
  const span = r.next ? r.next - r.floor : 1;
  const pct = r.next ? Math.min(100, ((save.xp - r.floor) / span) * 100) : 100;
  const face = save.quest.round ? "cool" : due > 0 ? "shock" : "grin";

  return (
    <main className="wrap">
      <header className="topbar">
        <Logo size={54} />
        <div className="chips" aria-label="Your stats">
          <span className="chip rank" title="Rank">RANK <b>{r.rank}</b></span>
          <span className="chip lv" title="Level">LV {levelOf(save.xp)}</span>
          <Link className="chip" href="/arcade/" title="Arcade tokens">🎟 {save.tokens}</Link>
        </div>
      </header>

      <div className="guide">
        <Stick pose={save.days.length ? "wave" : "point"} face={face} size={84} label="Your guide, a stickman with a red headband" />
        <p className="bubble">{ready ? guideLine(save, due) : <>Loading your brain...</>}</p>
      </div>

      <Link className="btn block play-cta" href={`/play/${up.w.id}/${up.u.id}/`}>
        ▶ PLAY: {up.w.title} · {up.u.title}
      </Link>

      {save.xp === 0 ? (
        <SystemWindow title="DAILY QUEST"><span>Finish <b>1 round</b>. That&apos;s a full day. That&apos;s it.</span></SystemWindow>
      ) : (
        <SystemWindow title="DAILY QUEST">
        <ul className="quest">
          <li className={save.quest.round ? "done" : ""}><span className="box">{save.quest.round ? "✓" : ""}</span><span>Finish 1 round <b>(counts as a full day)</b></span></li>
          <li className={save.quest.review ? "done" : ""}><span className="box">{save.quest.review ? "✓" : ""}</span><span>Answer 1 review card</span></li>
          <li className={save.quest.perfect ? "done" : ""}><span className="box">{save.quest.perfect ? "✓" : ""}</span><span>Get a perfect round</span></li>
        </ul>
        <div className="sys-meter" aria-label={`Rank progress ${Math.round(pct)}%`}><i style={{ width: `${pct}%` }} /></div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
          {r.next ? <>RANK {r.rank} → next at <b>{r.next} XP</b> · you have {save.xp}</> : <>RANK S. You cleared the System.</>} · days played <b>{save.days.length}</b>
        </div>
      </SystemWindow>
      )}


      <h2 className="h2">Worlds <small>pick one, any one</small></h2>
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

      <h2 className="h2">Unlocking soon <small>new worlds keep dropping</small></h2>
      <div className="soon-strip" aria-label="Worlds coming soon">
        {WORLDS.filter((w) => w.status !== "live").map((w) => (
          <div key={w.id} className="soon-card" style={{ ["--wa" as string]: w.accent } as React.CSSProperties}>
            <Stick {...w.guide} size={40} label={`${w.title} guide`} />
            <span className="world-title">{w.title}</span>
            <span className="world-tagline">{w.tagline}</span>
          </div>
        ))}
      </div>

      <footer className="foot">
        Free, open source, made with <a href="https://github.com/DareDev256/passionate-learning">the community</a> by DareDev256 ·{" "}
        <Link href="/about/">about</Link>
      </footer>
    </main>
  );
}
