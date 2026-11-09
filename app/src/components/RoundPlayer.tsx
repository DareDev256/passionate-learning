"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { findCard, getUnit, getWorld } from "@/content";
import { Stick } from "@/art/Stick";
import { MemeCard } from "@/art/Meme";
import { CardView, cardPrompt, correctText } from "./CardView";
import { SystemWindow } from "./SystemWindow";
import { useSave } from "@/lib/useSave";
import { applyFix, applyRound, buildRound, grade, missedKeys, type Answer, type FixResult, type Response, type RoundCard, type RoundResult, BASE_XP, FIX_XP, TARGET_SECONDS, SPEED_BONUS } from "@/lib/round";
import { dueLabel } from "@/lib/due";
import { LockedScreen } from "./LockedScreen";
import { ConfirmSheet } from "./ConfirmSheet";
import { clearInProgress, loadInProgress, saveInProgress } from "@/lib/roundResume";
import { blockingUnit, unlockMessage } from "@/lib/unlock";
import { isCleared, levelOf, recallMultiplier, reviewCard, unitKey, type Save } from "@/lib/save";
import { questsOf } from "@/lib/quests";
import { haptic } from "@/lib/native";
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
  const router = useRouter();
  // A round the app was backgrounded in is restored before the round is built, so the same seed rebuilds the same cards.
  const [stored] = useState(() => (typeof window === "undefined" ? null : loadInProgress(worldId, unitId)));
  const [seed, setSeed] = useState(() => stored?.seed ?? Date.now());
  const blocker = ready ? blockingUnit(world, unitId, save) : null;
  const blocked = !!blocker;
  // Built once per (ready, blocked, seed): a save update mid-round (XP, recall) must not reshuffle the cards.
  const round = useMemo(() => (ready && !blocked ? buildRound(world, unit, save, seed) : []), [ready, blocked, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  // Restore to the next unanswered card: an answered card whose NEXT was never pressed would otherwise count twice.
  const [idx, setIdx] = useState(stored?.answers.length ?? 0);
  const [answers, setAnswers] = useState<Answer[]>(stored?.answers ?? []);
  const [done, setDone] = useState<{ r: Response; ok: boolean } | null>(null);
  const [combo, setCombo] = useState(stored?.combo ?? 0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [roundXp, setRoundXp] = useState(stored?.roundXp ?? 0);
  const [confirming, setConfirming] = useState(false);
  // "Fix your mistakes": a short pass over the cards missed in the round just finished. It is practice on top of the round.
  const [fixCards, setFixCards] = useState<RoundCard[] | null>(null);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);
  const wasCleared = useRef(false);
  const [dueNote, setDueNote] = useState<string | null>(null);
  // Thinking time only: the clock runs while a card is waiting for an answer, never while you read the feedback.
  const spent = useRef(stored?.spentMs ?? 0);
  const askStart = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsedMs(spent.current + (askStart.current !== null ? performance.now() - askStart.current : 0)), 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (ready && !done && (!result || fixCards)) askStart.current = performance.now(); }, [ready, idx, done, result, fixCards]);

  // A stored round that no longer matches the rebuilt one (content changed, or it is longer than the round) starts fresh.
  // One that was answered to the last card but never finished is applied now, through the same finish() as a normal round.
  const applied = useRef(false);
  useEffect(() => {
    if (!stored || !ready || blocker || !round.length || result || applied.current) return;
    if (seed !== stored.seed || answers !== stored.answers) return;
    const mismatch = stored.answers.some((a, i) => !round[i] || a.key !== round[i].key);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!mismatch && stored.answers.length === round.length) {
      applied.current = true;
      setIdx(round.length - 1);
      finish(stored.answers);
    } else if (mismatch || stored.answers.length > round.length) {
      clearInProgress(); spent.current = 0; setSeed(Date.now()); setIdx(0); setAnswers([]); setCombo(0); setRoundXp(0);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [stored, ready, blocker, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Latest values for the backgrounding listener, which must not re-subscribe on every render.
  // A locked unit can't be resumed, so a stored round for it must not keep offering Continue on Home.
  useEffect(() => { if (blocker && loadInProgress(worldId, unitId)) clearInProgress(); }, [blocker, worldId, unitId]);

  const live = useRef({ seed, answers, combo, roundXp, active: false });
  useEffect(() => { live.current = { seed, answers, combo, roundXp, active: ready && !blocker && !result && !fixCards && round.length > 0 }; });
  function persist(p: Partial<typeof live.current> = {}) {
    const l = { ...live.current, ...p };
    if (!l.active || !l.answers.length) return;
    const think = askStart.current !== null ? performance.now() - askStart.current : 0;
    saveInProgress({ world: worldId, unit: unitId, seed: l.seed, idx: l.answers.length, answers: l.answers, spentMs: spent.current + think, roundXp: l.roundXp, combo: l.combo, savedAt: Date.now() });
  }
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") persist(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads live.current, so one subscription is enough

  // The drawer is fixed, so the page reserves its height (--drawer-h) and the options scroll clear of it.
  const mainRef = useRef<HTMLElement>(null);
  const drawerUp = !!done;
  useEffect(() => {
    const main = mainRef.current;
    const drawer = main?.querySelector<HTMLElement>(".drawer");
    if (!main) return;
    if (!drawer) { main.style.removeProperty("--drawer-h"); return; }
    const set = () => main.style.setProperty("--drawer-h", `${drawer.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(drawer);
    const reduce = document.documentElement.classList.contains("reduce-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const opts = main.querySelectorAll<HTMLElement>(".options .opt, .opt-row .opt, [aria-label='Sentences'] .sentence");
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    opts[opts.length - 1]?.scrollIntoView({ block: "nearest", behavior });
    const chosen = main.querySelector<HTMLElement>(".opt.right, .opt.wrong, .sentence.right, .sentence.wrong");
    if (chosen && chosen.getBoundingClientRect().top < 0) chosen.scrollIntoView({ block: "nearest", behavior });
    return () => ro.disconnect();
  }, [drawerUp, idx, ready, !!blocker, !!result]); // eslint-disable-line react-hooks/exhaustive-deps

  function leave() { clearInProgress(); router.push(`/w/${world.id}/`); }

  const cards = fixCards ?? round;
  const rc = cards[idx];
  const levelBefore = levelOf(save.xp);

  function answer(r: Response) {
    if (!rc || done) return;
    const ok = grade(rc.card, r);
    if (askStart.current !== null) { spent.current += performance.now() - askStart.current; askStart.current = null; }
    const newXp = ok ? roundXp + (fixCards ? FIX_XP : BASE_XP * recallMultiplier(save.cards[rc.key])) : roundXp;
    const newAnswers = [...answers, { key: rc.key, correct: ok, review: rc.review }];
    const newCombo = ok ? combo + 1 : 0;
    setRoundXp(newXp);
    // When a wrong card comes back, from the same seeded schedule the save will store when the round ends.
    setDueNote(ok ? null : dueLabel(new Date(reviewCard(save.cards[rc.key], false, new Date(), rc.key).due)));
    setDone({ r, ok });
    setCombo(newCombo);
    setAnswers(newAnswers);
    persist({ answers: newAnswers, roundXp: newXp, combo: newCombo });
    if (save.settings.sound) (ok ? playCorrect : playIncorrect)();
    void haptic(ok ? "success" : "error", save.settings.haptics);
  }

  function startFix() {
    const keys = missedKeys(answers);
    const list = keys.map((k) => findCard(k)).filter((x): x is NonNullable<typeof x> => !!x).map(({ key, card, world: w }) => ({ key, card, worldId: w.id, review: false }));
    if (!list.length) return;
    spent.current = 0; askStart.current = null;
    setFixCards(list); setFixResult(null); setResult(null);
    setIdx(0); setAnswers([]); setDone(null); setCombo(0); setRoundXp(0); setDueNote(null);
  }

  function finish(finalAnswers: Answer[]) {
    if (fixCards) {
      const fx = applyFix(save, unitKey(world.id, unit.id), finalAnswers, new Date(), spent.current / 1000);
      update(fx.save);
      setFixResult(fx);
      if (save.settings.sound) playCelebration();
      return;
    }
    wasCleared.current = isCleared(save.units[unitKey(world.id, unit.id)]);
    const res = applyRound(save, world, unit, finalAnswers, new Date(), spent.current / 1000);
    update(res.save);
    clearInProgress();
    setResult(res);
    if (save.settings.sound) (res.rankAfter !== res.rankBefore ? playAchievement : playCelebration)();
  }

  function next() {
    if (idx + 1 < cards.length) { setIdx(idx + 1); setDone(null); setDueNote(null); return; }
    finish(answers);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (done && !confirming && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (blocker) return <LockedScreen world={world} unit={unit} blocker={blocker} />;
  if (!ready || !rc) return <main className="round"><p className="bubble">Shuffling cards...</p></main>;
  if (fixResult) return <FixRecap world={world} unitId={unitId} fix={fixResult} save={save} />;
  if (result && !fixCards) return <Recap world={world} unitId={unitId} result={result} levelBefore={levelBefore} answers={answers} wasCleared={wasCleared.current} onFix={startFix} />;

  const mult = done?.ok && !fixCards ? recallMultiplier(save.cards[rc.key]) : 1;
  const h = hash(rc.key);
  const react: { pose: Pose; face: Face } = !done ? { pose: "think", face: "happy" } : done.ok ? { pose: combo >= 3 ? "cheer" : "point", face: combo >= 3 ? "cool" : "grin" } : { pose: h % 2 ? "facepalm" : "shrug", face: h % 2 ? "spiral" : "shock" };

  return (
    <main className="round" ref={mainRef} style={{ ["--wa" as string]: world.accent } as React.CSSProperties}>
      <div className="round-top">
        <button type="button" className="x" aria-label="Quit round" onClick={() => (answers.length ? setConfirming(true) : leave())}>✕</button>
        <div className="segs" aria-label={`Card ${idx + 1} of ${cards.length}`}>
          {cards.map((_, i) => <i key={i} className={i < answers.length ? (answers[i].correct ? "ok" : "no") : i === idx ? "now" : ""} />)}
        </div>
        <span className={`xp-chip ${done?.ok ? "bump" : ""}`} key={roundXp} aria-label={`${roundXp} XP this round`}>+<CountUp to={roundXp} ms={450} /></span>
        <span className="combo" aria-label={`Combo ${combo}`}>{combo >= 2 ? <span className="flame" style={{ fontSize: `${Math.min(16 + combo * 3, 30)}px` }}>🔥<b>{combo}</b></span> : <>{idx + 1}/{cards.length}</>}</span>
      </div>
      {fixCards ? <p className="fix-banner">FIX YOUR MISTAKES: no timer, no pressure.</p> : <Timer spentMs={elapsedMs} />}

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
              {done.ok && <div className="xp-pop">+<CountUp to={fixCards ? FIX_XP : BASE_XP * mult} /> XP{mult > 1 ? `  ·  ${mult}x RECALL BONUS` : ""}{combo >= 3 ? `  ·  COMBO x${combo}` : ""}</div>}
              {!done.ok && <div className="answer-was">ANSWER: {correctText(rc.card)}</div>}
              <p className="why">{rc.card.why}</p>
              {!done.ok && dueNote && <p className="again">You will see this again {dueNote}.</p>}
            </div>
            {rc.card.meme && <MemeCard meme={rc.card.meme} />}
            <button className="btn block ink" onClick={next} autoFocus>{idx + 1 < cards.length ? "NEXT →" : fixCards ? "FINISH" : "FINISH ROUND"}</button>
          </div>
        </section>
      )}
      {confirming && <ConfirmSheet title="Leave this round?" body="Your answers so far won't count." keepLabel="Keep playing" leaveLabel="Leave" onKeep={() => setConfirming(false)} onLeave={leave} />}
    </main>
  );
}

function Recap({ world, unitId, result, levelBefore, answers, wasCleared, onFix }: { world: NonNullable<ReturnType<typeof getWorld>>; unitId: string; result: RoundResult; levelBefore: number; answers: Answer[]; wasCleared: boolean; onFix: () => void }) {
  const pct = Math.round(result.accuracy * 100);
  const i = world.units.findIndex((u) => u.id === unitId);
  const nextUnit = world.units[i + 1];
  const opened = isCleared(result.save.units[unitKey(world.id, unitId)]);
  const leveled = levelOf(result.save.xp) > levelBefore;
  const title = pct === 100 ? "PERFECT." : pct >= 70 ? "CLEARED." : "ROUND DONE.";
  const sub = pct === 100 ? "Flawless. The System noticed." : pct >= 70 ? "That counts as your whole day. Anything else is bonus." : "That still counts as a day. Fix the ones you missed while they are fresh, or replay the unit.";
  const q = result.questDone;
  const unlock = unlockMessage(world, unitId, result.accuracy, result.total, wasCleared);
  const missed = missedKeys(answers).map((k) => findCard(k)).filter((x): x is NonNullable<typeof x> => !!x);
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
      <p className={`unlock-line unlock-${unlock.kind}`} data-testid="unlock-line"><span className="unlock-ic" aria-hidden="true">{unlock.kind === "need" ? "🔒" : "🔓"}</span>{unlock.text}</p>
      {missed.length > 0 && <button type="button" className="btn block ink fix-cta" onClick={onFix}>🛠 FIX YOUR MISTAKES</button>}
      {result.rankAfter !== result.rankBefore && (
        <SystemWindow title={`RANK UP: ${result.rankBefore} → ${result.rankAfter}`} tone="gold">You have been promoted to <b>Rank {result.rankAfter}</b>. The System is watching. Keep going.</SystemWindow>
      )}
      {leveled && <SystemWindow title="LEVEL UP">You reached <b>Level {levelOf(result.save.xp)}</b>.</SystemWindow>}
      {result.speedBonus > 0 && <SystemWindow title="SPEED BONUS">Under {TARGET_SECONDS} seconds of thinking time. <b>+{result.speedBonus} XP</b>.</SystemWindow>}
      {result.mastered && <SystemWindow title="UNIT MASTERED" tone="gold">90% across your last three rounds. This one is <b>locked in your brain</b>.</SystemWindow>}
      {result.bonusCards > 0 && <SystemWindow title="RECALL BONUS">You remembered <b>{result.bonusCards}</b> card{result.bonusCards === 1 ? "" : "s"} after a week or more. Long-term memory pays double.</SystemWindow>}
      {(q.round || q.review || q.second) && (
        <SystemWindow title="QUEST PROGRESS">
          {q.round && <div>✓ Finish 1 round. <b>Today counts.</b></div>}
          {q.review && <div>✓ Clear a review.</div>}
          {q.second && <div>✓ Play a second round.</div>}
          {questsOf(result.save).allDone && !questsOf(result.save).chestOpened && <div>The chest is ready on Home.</div>}
        </SystemWindow>
      )}
      {missed.length > 0 && (
        <section className="missed" aria-label="Cards you missed">
          <h2 className="h2">Missed <small>{missed.length} card{missed.length === 1 ? "" : "s"}</small></h2>
          <ul>
            {missed.map(({ key, card }) => (
              <li key={key} className="missed-card">
                <span className="missed-q">{cardPrompt(card)}</span>
                <span className="missed-a">ANSWER: {correctText(card)}</span>
                <span className="missed-why">{card.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="recap-actions">
        {opened && nextUnit ? <Link className="btn block" href={`/play/${world.id}/${nextUnit.id}/`}>{"\u25B6\uFE0E"} NEXT: {nextUnit.title}</Link> : null}
        <button className={`btn block ${opened && nextUnit ? "ghost" : ""}`} onClick={() => location.reload()}>↻ {pct >= 70 ? "AGAIN" : "REPLAY IT NOW"}</button>
        <Link className="btn block ghost" href="/arcade/">🎟 ARCADE BREAK</Link>
        <Link className="btn block ghost" href="/">HOME</Link>
      </div>
    </main>
  );
}

/** The short screen after a fix pass. */
function FixRecap({ world, unitId, fix, save }: { world: NonNullable<ReturnType<typeof getWorld>>; unitId: string; fix: FixResult; save: Save }) {
  const nextUnit = world.units[world.units.findIndex((u) => u.id === unitId) + 1];
  const nextOpen = !!nextUnit && isCleared(save.units[unitKey(world.id, unitId)]);
  const all = fix.correct === fix.total;
  return (
    <main className="recap" style={{ ["--wa" as string]: world.accent } as React.CSSProperties}>
      <div className="recap-hero"><Stick pose={all ? "cheer" : "point"} face={all ? "cool" : "grin"} size={110} /></div>
      <h1 className="recap-title">{all ? "FIXED." : "GOOD TRY."}</h1>
      <p className="recap-sub">{all ? "Every one of them is right now. They will come back later to make sure it stuck." : `${fix.correct} of ${fix.total} put right. The rest will come back, and that is how they stick.`}</p>
      <div className="stats">
        <div className="stat"><b>{fix.correct}/{fix.total}</b><span>FIXED</span></div>
        <div className="stat"><b>+{fix.xpGained}</b><span>XP</span></div>
        <div className="stat"><b>{levelOf(save.xp)}</b><span>LEVEL</span></div>
      </div>
      <div className="recap-actions">
        {nextOpen ? <Link className="btn block" href={`/play/${world.id}/${nextUnit.id}/`}>{"\u25B6\uFE0E"} NEXT: {nextUnit.title}</Link> : null}
        <Link className={`btn block ${nextOpen ? "ghost" : ""}`} href={`/w/${world.id}/`}>BACK TO {world.title.toUpperCase()}</Link>
        <Link className="btn block ghost" href="/">HOME</Link>
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
