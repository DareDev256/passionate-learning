"use client";
import Link from "next/link";
import { Logo } from "@/art/Logo";
import { Stick } from "@/art/Stick";
import { useSave } from "@/lib/useSave";
import { levelOf, rankOf } from "@/lib/save";
import { achievementsOf } from "@/lib/achievements";
import { totals, worldAccuracy } from "@/lib/stats";

/** A hand-drawn badge: a filled star when earned, a dotted ring when not. */
function Badge({ earned }: { earned: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" focusable="false" className={`badge-ic ${earned ? "on" : "off"}`}>
      <circle cx="24" cy="24" r="20" fill={earned ? "#ffc531" : "none"} stroke="var(--ink)" strokeWidth="3.5" strokeDasharray={earned ? undefined : "3 6"} strokeLinecap="round" />
      {earned && <path d="M24 10 l4.2 8.6 9.4 1.3 -6.8 6.6 1.6 9.4 L24 31.5 l-8.4 4.4 1.6 -9.4 -6.8 -6.6 9.4 -1.3 Z" fill="#ff3b1f" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />}
    </svg>
  );
}

export function Profile() {
  const { save, ready } = useSave();
  const r = rankOf(save.xp);
  const pct = r.next ? Math.min(100, ((save.xp - r.floor) / (r.next - r.floor)) * 100) : 100;
  const t = totals(save);
  const worlds = worldAccuracy(save);
  const ach = achievementsOf(save);
  const earned = ach.filter((a) => a.earned).length;
  const name = save.settings.name.trim() || "You";

  return (
    <main className="wrap profile">
      <header className="topbar"><Link className="x" href="/" aria-label="Back to Home">{"←"}</Link><Logo size={40} /></header>
      {!ready ? <p aria-busy="true">Loading...</p> : (
        <>
          <section className="pf-hero" aria-label="Rank">
            <Stick pose="cheer" face="cool" size={92} label="You, a stickman with a red headband" />
            <div className="pf-id">
              <h1 className="pf-name">{name}</h1>
              <p className="pf-lv">LEVEL {levelOf(save.xp)} · {save.xp} XP</p>
            </div>
            <span className="pf-rank" aria-label={`Rank ${r.rank}`}>{r.rank}</span>
          </section>
          <div className="rs-bar pf-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          <p className="pf-next">{r.next ? <>{r.next - save.xp} XP to the next rank.</> : <>Rank S. You cleared the System.</>}</p>
          {save.imported && <p className="pf-note">Your XP from an earlier version came with you. It counts for your rank here.</p>}

          <section className="pf-stats" aria-label="Your numbers">
            <div className="stat"><b>{t.days}</b><span>DAYS PLAYED</span></div>
            <div className="stat"><b>{t.rounds}</b><span>ROUNDS</span></div>
            <div className="stat"><b>{t.cardsLearned}</b><span>CARDS MET</span></div>
            <div className="stat"><b>{t.accuracy === null ? "n/a" : `${Math.round(t.accuracy * 100)}%`}</b><span>RIGHT</span></div>
          </section>
          <p className="pf-floor">Days played only ever counts up. A missed day resets nothing.</p>

          <h2 className="h2">Accuracy by world</h2>
          <ul className="pf-worlds">
            {worlds.map(({ world, seen, accuracy }) => (
              <li key={world.id} style={{ ["--wa" as string]: world.accent } as React.CSSProperties}>
                <span className="pf-wname">{world.title}</span>
                <span className="bar" role="img" aria-label={accuracy === null ? `${world.title}: not played yet` : `${world.title}: ${Math.round(accuracy * 100)}% right`}><i style={{ width: `${(accuracy ?? 0) * 100}%` }} /></span>
                <span className="pf-wpct">{accuracy === null ? "not yet" : `${Math.round(accuracy * 100)}%`}</span>
                <span className="sr">{seen} answers</span>
              </li>
            ))}
          </ul>

          <h2 className="h2">Achievements <small>{earned} of {ach.length}</small></h2>
          <ul className="pf-ach">
            {ach.map((a) => (
              <li key={a.id} className={a.earned ? "earned" : "locked"}>
                <Badge earned={a.earned} />
                <span className="pf-at"><b>{a.label}</b><small>{a.how}</small></span>
                <span className="sr">{a.earned ? "Earned" : "Not yet"}</span>
              </li>
            ))}
          </ul>
          <p className="foot"><Link href="/settings/">Settings</Link> · <Link href="/worlds/">All worlds</Link></p>
        </>
      )}
    </main>
  );
}
