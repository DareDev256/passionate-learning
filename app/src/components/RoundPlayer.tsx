"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getUnit, getWorld } from "@/content";
import { Stick } from "@/art/Stick";
import { MemeCard } from "@/art/Meme";
import { CardView, correctText } from "./CardView";
import { SystemWindow } from "./SystemWindow";
import { useSave } from "@/lib/useSave";
import { applyRound, buildRound, grade, type Answer, type Response, type RoundResult, BASE_XP, TARGET_SECONDS, SPEED_BONUS } from "@/lib/round";
import { isCleared, levelOf, recallMultiplier, unitKey } from "@/lib/save";
import { playCorrect, playIncorrect, playCelebration, playAchievement } from "@/lib/soundEngine";
import type { Face, Pose } from "@/content/types";

const YES = ["FACTS.", "Clean.", "Big brain.", "That's it.", "Too easy.", "Locked in."];
const NO = ["Not quite.", "The AI got you.", "Nope. Now you know.", "Close. Not it.", "Plot twist."];
const HMM: Record<string, string[]> = {
  choice: ["Take your time. Or don't.", "Trust your gut.", "One of these is the move."],
  cap: ["Sounds legit... or does it?", "Read it twice.", "Your call, detective."],
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
  const [roundXp, setRoundXp] = useState(0);
  // Thinking time only: the clock runs while a card is waiting for an answer, never while you read the feedback.
  const spent = useRef(0);
  const askStart = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsedMs(spent.current + (askStart.current !== null ? performance.now() - askStart.current : 0)), 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (ready && !done && !result) askStart.current = performance.now(); }, [ready, idx, done, result]);

  const rc = round[idx];
  const levelBefore = levelOf(save.xp);

  function answer(r: Response) {
    if (!rc || done) return;
    const ok = grade(rc.card, r);
    if (askStart.current !== null) { spent.current += performance.now() - askStart.current; askStart.current = null; }
    if (ok) setRoundXp(roundXp + BASE_XP * recallMultiplier(save.cards[rc.key]));
    setDone({ r, ok });
    setCombo(ok ? combo + 1 : 0);
    setAnswers([...answers, { key: rc.key, correct: ok, review: rc.review }]);
    if (save.settings.sound) (ok ? playCorrect : playIncorrect)();
  }

  function next() {
    if (idx + 1 < round.length) { setIdx(idx + 1); setDone(null); return; }
    const res = applyRound(save, world, unit, answers, new Date(), spent.current / 1000);
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
        <span className={`xp-chip ${done?.ok ? "bump" : ""}`} key={roundXp} aria-label={`${roundXp} XP this round`}>+<CountUp to={roundXp} ms={450} /></span>
        <span className="combo" aria-label={`Combo ${combo}`}>{combo >= 2 ? <span className="flame" style={{ fontSize: `${Math.min(16 + combo * 3, 30)}px` }}>🔥<b>{combo}</b></span> : <>{idx + 1}/{round.length}</>}</span>
      </div>
      <Timer spentMs={elapsedMs} />

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
        <section className={`drawer ${done.ok ? "good" : "bad"} ${rc.card.meme ? "has-meme" : ""}`} aria-live="assertive">
          <div className="drawer-in">
            <div>
              <div className="verdict">{done.ok ? pick(YES, h) : pick(NO, h)}</div>
              {done.ok && <div className="xp-pop">+<CountUp to={BASE_XP * mult} /> XP{mult > 1 ? `  ·  ${mult}x RECALL BONUS` : ""}{combo >= 3 ? `  ·  COMBO x${combo}` : ""}</div>}
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
  const title = pct === 100 ? "PERFECT." : pct >= 70 ? "CLEARED." : "ROUND DONE.";
  const sub = pct === 100 ? "Flawless. The System noticed." : pct >= 70 ? "That counts as your whole day. Anything else is bonus." : "That still counts as a day. Replay it now while it's fresh and watch the number jump.";
  const q = result.questDone;
  const R = 34, C = 2 * Math.PI * R;
  return (
    <main className="recap" style={{ ["--wa" as string]: world.accent } as React.CSSProperties}>
      <div className="recap-hero">
        <Stick pose={pct >= 70 ? "cheer" : "point"} face={pct === 100 ? "cool" : "grin"} wear={pct === 100 ? ["hero", "sparkle"] : ["hero"]} size={110} />
        <svg className="acc-ring" viewBox="0 0 80 80" aria-label={`${pct}% correct`}>
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--soft)" strokeWidth="9" />
          <circle cx="40" cy="40" r={R} fill="none" stroke={pct >= 70 ? "var(--good)" : "var(--accent)"} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - result.accuracy)} transform="rotate(-90 40 40)" className="ring-fill" style={{ ["--c" as string]: `${C}` } as React.CSSProperties} />
          <text x="40" y="46" textAnchor="middle" className="ring-t">{pct}%</text>
        </svg>
      </div>
      <h1 className="recap-title">{title}</h1>
      <p className="recap-sub">{sub}</p>
      <div className="stats">
        <div className="stat"><b>{result.correct}/{result.total}</b><span>CORRECT</span></div>
        <div className="stat"><b>+<CountUp to={result.xpGained} ms={900} /></b><span>XP</span></div>
        <div className="stat"><b>+{result.tokensGained}</b><span>🎟 TOKENS</span></div>
      </div>
      {result.rankAfter !== result.rankBefore && (
        <SystemWindow title={`RANK UP: ${result.rankBefore} → ${result.rankAfter}`} tone="gold">You have been promoted to <b>Rank {result.rankAfter}</b>. The System is watching. Keep going.</SystemWindow>
      )}
      {leveled && <SystemWindow title="LEVEL UP">You reached <b>Level {levelOf(result.save.xp)}</b>.</SystemWindow>}
      {result.speedBonus > 0 && <SystemWindow title="SPEED BONUS">Under {TARGET_SECONDS} seconds of thinking time. <b>+{result.speedBonus} XP</b>.</SystemWindow>}
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
        <button className={`btn block ${opened && nextUnit ? "ghost" : ""}`} onClick={() => location.reload()}>↻ {pct >= 70 ? "AGAIN" : "REPLAY IT NOW"}</button>
        <Link className="btn block ghost" href="/arcade/">🎟 ARCADE BREAK</Link>
        <Link className="btn block ghost" href="/">MAP</Link>
      </div>
    </main>
  );
}

/** The 60-second target, draining. Beat it for a bonus; run past it and nothing bad happens. */
function Timer({ spentMs }: { spentMs: number }) {
  const left = Math.max(0, TARGET_SECONDS - spentMs / 1000);
  const pct = (left / TARGET_SECONDS) * 100;
  return (
    <div className={`timer ${left === 0 ? "over" : left < 15 ? "low" : ""}`} aria-label={`${Math.ceil(left)} seconds left for the speed bonus`}>
      <i style={{ width: `${pct}%` }} />
      <span>{left > 0 ? `${Math.ceil(left)}s · beat it for +${SPEED_BONUS} XP` : "no rush now: take your time"}</span>
    </div>
  );
}

/** Counts a number up from 0 for that slot-machine feel. */
function CountUp({ to, ms = 500 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}
