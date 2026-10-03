"use client";
import Link from "next/link";
import { useState } from "react";
import { Stick } from "@/art/Stick";
import { SystemWindow } from "./SystemWindow";
import { useSave } from "@/lib/useSave";

/** The reward break: a token from a finished round buys a session of What's Poppin. Learning first, dopamine second. */
export function Arcade() {
  const { save, update, ready } = useSave();
  const [playing, setPlaying] = useState(false);
  function start() {
    if (save.tokens < 1) return;
    update({ ...save, tokens: save.tokens - 1 });
    setPlaying(true);
  }
  return (
    <main className="wrap">
      <header className="topbar">
        <Link className="x" href="/" aria-label="Back to the map">←</Link>
        <span className="chip">🎟 {save.tokens} token{save.tokens === 1 ? "" : "s"}</span>
      </header>
      {playing ? (
        <iframe className="arcade-frame" src="/arcade/pop/index.html" title="What's Poppin" allow="autoplay" />
      ) : (
        <>
          <div className="guide">
            <Stick pose="cheer" face="grin" size={92} />
            <p className="bubble">Arcade break. <em>One token</em> = one round of What&apos;s Poppin. You earn tokens by finishing lessons.</p>
          </div>
          {ready && save.tokens < 1 ? (
            <SystemWindow title="NOT ENOUGH TOKENS" tone="alert">Finish a round to earn <b>1 token</b> (a perfect round gives <b>2</b>). Learning first, then the fun stuff.</SystemWindow>
          ) : null}
          <button className="btn block" onClick={start} disabled={!ready || save.tokens < 1}>🎟 SPEND 1 TOKEN · PLAY WHAT&apos;S POPPIN</button>
          <p className="foot">What&apos;s Poppin: match bubbles, build streaks, unleash characters.</p>
        </>
      )}
    </main>
  );
}
