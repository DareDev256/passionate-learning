"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getWorld } from "@/content";
import type { Unit, World } from "@/content/types";
import { Logo } from "@/art/Logo";
import { Stick } from "@/art/Stick";
import { useSave } from "@/lib/useSave";
import { type Save, dueKeys, levelOf, rankOf } from "@/lib/save";
import { needsOnboarding } from "@/lib/onboarding";
import { Onboarding } from "./Onboarding";
import { HomePath } from "./HomePath";
import { peekInProgress } from "@/lib/roundResume";
import { questsOf } from "@/lib/quests";
import { QuestsCard } from "./QuestsCard";

/**
 * A round iOS closed while it was in progress. The app always relaunches at Home, so the offer to pick it up lives here.
 * Read after mount: the static HTML is rendered without localStorage.
 */
function ContinueRound() {
  const [open, setOpen] = useState<{ w: World; u: Unit; answered: number } | null>(null);
  useEffect(() => {
    const p = peekInProgress();
    const w = p ? getWorld(p.world) : undefined;
    const u = p && w?.status === "live" ? w.units.find((x) => x.id === p.unit) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(p && w && u && p.answers.length ? { w, u, answered: p.answers.length } : null);
  }, []);
  if (!open) return null;
  const { w, u, answered } = open;
  return (
    <section className="resume" aria-label="Continue your round" style={{ ["--wa" as string]: w.accent } as React.CSSProperties}>
      <span className="world-tag">CONTINUE YOUR ROUND</span>
      <div className="resume-body">
        <Stick {...w.guide} size={56} label={`${w.title} guide`} />
        <div>
          <span className="world-title">{w.title} · {u.title}</span>
          <p className="resume-line">You answered {answered} card{answered === 1 ? "" : "s"} so far. Pick up right where you left off.</p>
        </div>
        <Link className="btn block" href={`/play/${w.id}/${u.id}/`}>{"\u25B6\uFE0E"} CONTINUE</Link>
      </div>
    </section>
  );
}

function guideLine(save: Save, due: number) {
  const quest = questsOf(save);
  if (save.days.length === 0) return <>Ready when you are. One round is <em>60 seconds</em>. That&apos;s the whole ask.</>;
  if (quest.allDone) return <>Daily quest <em>cleared</em>. Everything else today is bonus. Go touch grass, or keep going.</>;
  if (due > 0) return <><em>{due} card{due === 1 ? " is" : "s are"}</em> ready for review. One round brings {due === 1 ? "it" : "them"} back.</>;
  if (quest.round) return <>Round done today. That counts. A missed day <em>resets nothing</em> here.</>;
  return <>Back again. Pick a world. Or don&apos;t. I&apos;m a <em>drawing</em>.</>;
}

export function Home() {
  const { save, update, ready } = useSave();
  const r = rankOf(save.xp);
  const due = dueKeys(save).length;
  const span = r.next ? r.next - r.floor : 1;
  const pct = r.next ? Math.min(100, ((save.xp - r.floor) / span) * 100) : 100;
  const face = questsOf(save).round ? "cool" : due > 0 ? "shock" : "grin";

  // The static HTML has no save. Hold the page until it is read so a returning player never sees the first-launch card flash.
  if (!ready) return <main className="wrap" aria-busy="true"><header className="topbar"><Logo size={54} /></header></main>;
  // A round already under way (deep link, or iOS closed the app) means they have started: offer to continue, not the first question.
  if (needsOnboarding(save) && !peekInProgress()) return <Onboarding save={save} update={update} />;

  return (
    <main className="wrap">
      <header className="topbar">
        <Logo size={54} />
        <div className="chips" aria-label="Your stats">
          <Link className="chip rank" href="/profile/" title="Your profile">RANK <b>{r.rank}</b></Link>
          <span className="chip lv" title="Level">LV {levelOf(save.xp)}</span>
          <Link className="chip" href="/arcade/" title="Arcade tokens">🎟 {save.tokens}</Link>
          <Link className="chip chip-btn" href="/settings/" aria-label="Settings" title="Settings">⚙</Link>
        </div>
      </header>
      <Link className="rank-strip" href="/profile/" aria-label={`Rank ${r.rank}, ${save.xp} XP. Open your profile.`}>
        <span className="rs-t">{r.next ? <>{save.xp} / {r.next} XP to rank <b>{rankAfter(r.rank)}</b></> : <>Rank S. You cleared the System.</>}</span>
        <span className="rs-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      </Link>

      <ContinueRound />

      <div className="guide">
        <span className="guide-bob"><Stick pose={save.days.length ? "wave" : "point"} face={face} size={84} label="Your guide, a stickman with a red headband" /></span>
        <p className="bubble">{guideLine(save, due)}</p>
      </div>

      <HomePath save={save} />
      <QuestsCard save={save} update={update} ready={ready} />

      <nav className="home-links" aria-label="More">
        <Link className="btn ghost" href="/worlds/">ALL WORLDS</Link>
        <Link className="btn ghost" href="/profile/">YOUR PROFILE</Link>
      </nav>

      <footer className="foot">
        Free, open source, made with <a href="https://github.com/DareDev256/passionate-learning">the community</a> by DareDev256 ·{" "}
        <Link href="/about/">about</Link>
      </footer>
    </main>
  );
}

const RANK_ORDER = ["E", "D", "C", "B", "A", "S"];
const rankAfter = (rank: string) => RANK_ORDER[RANK_ORDER.indexOf(rank) + 1] ?? "S";
