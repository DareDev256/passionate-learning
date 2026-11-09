"use client";
import Link from "next/link";
import { useState } from "react";
import { Stick } from "@/art/Stick";
import { SystemWindow } from "./SystemWindow";
import { useSave } from "@/lib/useSave";
import { buyTheme, equipTheme, spendToken } from "@/lib/shop";
import { THEMES, type Theme } from "@/lib/themes";
import { applyTheme } from "@/lib/themeStore";
import { figure } from "@/art/kit";

/** A theme's hero on that theme's own ground, so the card previews the real thing before it is bought. */
function Swatch({ t }: { t: Theme }) {
  const svg = `<svg viewBox="-44 -126 88 134" width="64" height="96" xmlns="http://www.w3.org/2000/svg"><g filter="url(#rough)" style="--ink:${t.ink};--accent:${t.accent};--paper:${t.ground}">${figure({ pose: "cheer", face: "grin", wear: t.wear })}</g></svg>`;
  return <span className="swatch" style={{ background: t.ground, color: t.ink, borderColor: "var(--ink)" }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The reward break: a token from a finished round buys a session of What's Poppin, or a theme. Learning first, dopamine second. */
export function Arcade() {
  const { save, update, ready } = useSave();
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("");
  function start() {
    const r = spendToken(save);
    if (!r.ok) return;
    update(r.save);
    setPlaying(true);
  }
  function buy(t: Theme) {
    const r = buyTheme(save, t.id);
    if (!r.ok) { setNote(r.reason === "notEnough" ? `${t.name} needs ${r.need} more token${r.need === 1 ? "" : "s"}.` : ""); return; }
    const eq = equipTheme(r.save, t.id);
    update(eq.save);
    applyTheme(t.id);
    setNote(`${t.name} is yours and it is on.`);
  }
  function equip(t: Theme) {
    const r = equipTheme(save, t.id);
    if (!r.ok) return;
    update(r.save);
    applyTheme(t.id);
    setNote(`${t.name} is on.`);
  }
  const equipped = save.themes.equipped;
  return (
    <main className="wrap">
      <header className="topbar">
        <Link className="x" href="/" aria-label="Back to the map">←</Link>
        <span className="chip" aria-label={`${save.tokens} tokens`}>🎟 <span data-testid="tokens">{save.tokens}</span> token{save.tokens === 1 ? "" : "s"}</span>
      </header>
      {playing ? (
        <div className="arcade-full">
          <button className="arcade-exit" onClick={() => setPlaying(false)}>✕ BACK TO LEARNING</button>
          <iframe src={`/arcade/pop/index.html?theme=${equipped}`} title="What's Poppin" allow="autoplay" />
        </div>
      ) : (
        <>
          <div className="guide">
            <Stick pose="cheer" face="grin" size={92} />
            <p className="bubble">Arcade break. <em>One token</em> plays one round of What&apos;s Poppin. Or save up and spend tokens on a theme that changes the whole app.</p>
          </div>
          {ready && save.tokens < 1 ? (
            <SystemWindow title="NOT ENOUGH TOKENS" tone="alert">Finish a round to earn <b>1 token</b>. A perfect round gives <b>2</b>, and the daily chest gives <b>5</b>. Learning first, then the fun stuff.</SystemWindow>
          ) : null}
          <button className="btn block" onClick={start} disabled={!ready || save.tokens < 1}>🎟 SPEND 1 TOKEN · PLAY WHAT&apos;S POPPIN</button>
          <p className="foot">What&apos;s Poppin: match bubbles, build streaks, cheer on the crew.</p>

          <h2 className="h2">Themes <small>tokens buy a new look, yours to keep</small></h2>
          <p className="shop-note" role="status" aria-live="polite">{note}</p>
          <ul className="shop" aria-label="Theme shop">
            {THEMES.map((t) => {
              const owned = save.themes.owned.includes(t.id);
              const on = equipped === t.id;
              const short = t.price - save.tokens;
              return (
                <li key={t.id} className={`shop-card${on ? " on" : ""}`} data-theme-id={t.id}>
                  <Swatch t={t} />
                  <div className="shop-body">
                    <b className="shop-name">{t.name}</b>
                    <span className="shop-blurb">{t.blurb}</span>
                    {owned ? (
                      <button className="btn ink shop-btn" disabled={on} onClick={() => equip(t)}>{on ? "ON NOW" : "USE IT"}</button>
                    ) : (
                      <button className="btn shop-btn" disabled={!ready || short > 0} onClick={() => buy(t)}>
                        {short > 0 ? `${short} MORE TOKEN${short === 1 ? "" : "S"}` : `BUY · 🎟 ${t.price}`}
                      </button>
                    )}
                    {!owned && <span className="shop-price">🎟 {t.price} tokens</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
