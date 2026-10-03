"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getUnit, getWorld } from "@/content";
import { Stick } from "@/art/Stick";
import { MemeCard } from "@/art/Meme";
import { CardView, correctText } from "./CardView";
import { SystemWindow } from "./SystemWindow";
import { useSave } from "@/lib/useSave";
import { applyRound, buildRound, grade, type Answer, type Response, type RoundResult, BASE_XP } from "@/lib/round";
import { isCleared, levelOf, recallMultiplier, unitKey } from "@/lib/save";
import { playCorrect, playIncorrect, playCelebration, playAchievement } from "@/lib/soundEngine";
import type { Face, Pose } from "@/content/types";

const YES = ["FACTS.", "Clean.", "Big brain.", "That's it.", "Too easy.", "Locked in."];
const NO = ["Not quite.", "The AI got you.", "Nope. Now you know.", "Close. Not it.", "Plot twist."];
const HMM: Record<string, string[]> = {
  choice: ["Take your time. Or don't.", "Trust your gut.", "One of these is the move."],
  cap: ["Sounds legit... or does it?", "AI says this with a straight face.", "Confident is not the same as correct."],
  predict: ["Think like the machine.", "What would the internet say next?", "Most likely, not most interesting."],
  spot: ["One of these is made up.", "Read every line. The fake hides.", "Spot the cap."],
  order: ["First things first.", "Tap them in order.", "Steps, not vibes."],
  type: ["Type it out. Spelling is chill.", "You know this one.", "Caps don't matter."],
};
const pick = (arr: string[], n: number) => arr[Math.abs(n) % arr.length];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export function RoundPlayer({ worldId, unitId }: { worldId: string; unitId: string }) {
  const world = getWorld(worldId)!;
  const unit = getUnit(worldId, unitId)!;
  const { save, update, ready } = useSave();
  const [seed] = useState(() => Date.now());
  const round = useMemo(() => (ready ? buildRound(world, unit, save, seed) : []), [ready, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [done, setDone] = useState<{ r: Response; ok: boolean } | null>(null);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);

  const rc = round[idx];
  const levelBefore = levelOf(save.xp);

  function answer(r: Response) {
    if (!rc || done) return;
    const ok = grade(rc.card, r);
    setDone({ r, ok });
    setCombo(ok ? combo + 1 : 0);
    setAnswers([...answers, { key: rc.key, correct: ok, review: rc.review }]);
    if (save.settings.sound) (ok ? playCorrect : playIncorrect)();
  }

  function next() {
    if (idx + 1 < round.length) { setIdx(idx + 1); setDone(null); return; }
    const res = applyRound(save, world, unit, answers);
    update(res.save);
    setResult(res);
    if (save.settings.sound) (res.rankAfter !== res.rankBefore ? playAchievement : playCelebration)();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (done && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!ready || !rc) return <main className="round"><p className="bubble">Shuffling cards...</p></main>;
  if (result) return <Recap world={world} unitId={unitId} result={result} levelBefore={levelBefore} />;

  const mult = done?.ok ? recallMultiplier(save.cards[rc.key]) : 1;
  const h = hash(rc.key);
  const react: { pose: Pose; face: Face } = !done ? { pose: "think", face: "happy" } : done.ok ? { pose: combo >= 3 ? "cheer" : "point", face: combo >= 3 ? "cool" : "grin" } : { pose: h % 2 ? "facepalm" : "shrug", face: h % 2 ? "spiral" : "shock" };

  return (
    <main className="round" style={{ ["--wa" as string]: world.accent } as React.CSSProperties}>
      <div className="round-top">
        <Link className="x" href={`/w/${world.id}/`} aria-label="Quit round">✕</Link>
        <div className="segs" aria-label={`Card ${idx + 1} of ${round.length}`}>
          {round.map((_, i) => <i key={i} className={i < answers.length ? (answers[i].correct ? "ok" : "no") : i === idx ? "now" : ""} />)}
        </div>
        <span className="combo" aria-label={`Combo ${combo}`}>{combo >= 2 ? <>🔥<b>{combo}</b></> : <>{idx + 1}/{round.length}</>}</span>
      </div>

      <div className="kicker">
        {world.title}{rc.review && <span className="rev">REVIEW</span>}
        {rc.review && rc.worldId !== world.id && <span>from {getWorld(rc.worldId)?.title}</span>}
      </div>
      <CardView key={rc.key} card={rc.card} done={done} onAnswer={answer} seed={seed + idx} />

      <div className={`react-zone ${done ? (done.ok ? "is-good" : "is-bad") : ""}`} aria-hidden="true">
        <span className="react-fig">
          <Stick pose={react.pose} face={react.face} size={104} />
          {done?.ok && <span className="burst">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 45}deg` } as React.CSSProperties} />)}</span>}
        </span>
        <span className="react-say">{done ? (done.ok ? pick(YES, h) : pick(NO, h)) : pick(HMM[rc.card.type], h)}</span>
      </div>

      {done && (
        <section className={`drawer ${done.ok ? "good" : "bad"}`} aria-live="assertive">
          <div className="drawer-in">
            <div>
              <div className="verdict">{done.ok ? pick(YES, h) : pick(NO, h)}</div>
              {done.ok && <div className="xp-pop">+{BASE_XP * mult} XP{mult > 1 ? `  ·  ${mult}x RECALL BONUS` : ""}</div>}
              {!done.ok && <div className="answer-was">ANSWER: {correctText(rc.card)}</div>}
              <p className="why">{rc.card.why}</p>
            </div>
            {rc.card.meme && <MemeCard meme={rc.card.meme} />}
            <button className="btn block ink" onClick={next} autoFocus>{idx + 1 < round.length ? "NEXT →" : "FINISH ROUND"}</button>
          </div>
        </section>
      )}
    </main>
  );
}

function Recap({ world, unitId, result, levelBefore }: { world: NonNullable<ReturnType<typeof getWorld>>; unitId: string; result: RoundResult; levelBefore: number }) {
  const pct = Math.round(result.accuracy * 100);
  const i = world.units.findIndex((u) => u.id === unitId);
  const nextUnit = world.units[i + 1];
  const opened = isCleared(result.save.units[unitKey(world.id, unitId)]);
  const leveled = levelOf(result.save.xp) > levelBefore;
  const title = pct === 100 ? "PERFECT." : pct >= 70 ? "CLEARED." : "GOOD TRY.";
  const face: Face = pct === 100 ? "cool" : pct >= 70 ? "grin" : "zen";
  const q = result.questDone;
  return (
    <main className="recap" style={{ ["--wa" as string]: world.accent } as React.CSSProperties}>
      <Stick pose={pct >= 70 ? "cheer" : "shrug"} face={face} size={110} />
      <h1 className="recap-title">{title}</h1>
      <p className="recap-sub">{pct >= 70 ? "That round counted. You're done for today if you want." : "Under 70% this time. Replay it, the cards are fresh in your head now."}</p>
      <div className="stats">
        <div className="stat"><b>{result.correct}/{result.total}</b><span>CORRECT</span></div>
        <div className="stat"><b>+{result.xpGained}</b><span>XP</span></div>
        <div className="stat"><b>+{result.tokensGained}</b><span>🎟 TOKENS</span></div>
      </div>
      {result.rankAfter !== result.rankBefore && (
        <SystemWindow title={`RANK UP: ${result.rankBefore} → ${result.rankAfter}`} tone="gold">You have been promoted to <b>Rank {result.rankAfter}</b>. The System is watching. Keep going.</SystemWindow>
      )}
      {leveled && <SystemWindow title="LEVEL UP">You reached <b>Level {levelOf(result.save.xp)}</b>.</SystemWindow>}
      {result.mastered && <SystemWindow title="UNIT MASTERED" tone="gold">90% across your last three rounds. This one is <b>locked in your brain</b>.</SystemWindow>}
      {result.bonusCards > 0 && <SystemWindow title="RECALL BONUS">You remembered <b>{result.bonusCards}</b> card{result.bonusCards === 1 ? "" : "s"} after a week or more. Long-term memory pays double.</SystemWindow>}
      {(q.round || q.review || q.perfect) && (
        <SystemWindow title="QUEST PROGRESS">
          {q.round && <div>✓ Finish 1 round. <b>Today counts.</b></div>}
          {q.review && <div>✓ Answer a review card.</div>}
          {q.perfect && <div>✓ Perfect round.</div>}
        </SystemWindow>
      )}
      <div className="recap-actions">
        {opened && nextUnit ? <Link className="btn block" href={`/play/${world.id}/${nextUnit.id}/`}>▶ NEXT: {nextUnit.title}</Link> : null}
        <button className={`btn block ${opened && nextUnit ? "ghost" : ""}`} onClick={() => location.reload()}>↻ REPLAY</button>
        <Link className="btn block ghost" href="/arcade/">🎟 ARCADE BREAK</Link>
        <Link className="btn block ghost" href="/">MAP</Link>
      </div>
    </main>
  );
}
