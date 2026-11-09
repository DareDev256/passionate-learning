"use client";
import { useRouter } from "next/navigation";
import { Logo } from "@/art/Logo";
import { Stick } from "@/art/Stick";
import { GOALS, startFor } from "@/lib/onboarding";
import { writeSave, type Goal, type Save } from "@/lib/save";

/** The first screen is a card: one question, four answers, and the answer starts the first lesson. Uses Home's save, so skipping shows Home at once. */
export function Onboarding({ save, update }: { save: Save; update: (next: Save) => void }) {
  const router = useRouter();
  const pick = (goal: Goal) => {
    // Written straight to storage and not through Home's state, so Home does not flash its full page before the round opens.
    writeSave({ ...save, profile: { goal, onboarded: true } });
    const { worldId, unitId } = startFor(goal);
    router.push(`/play/${worldId}/${unitId}/`);
  };
  const skip = () => update({ ...save, profile: { goal: null, onboarded: true } });
  return (
    <main className="wrap onb">
      <header className="topbar"><Logo size={54} /></header>
      <div className="onb-hero">
        <Stick pose="point" face="grin" size={110} label="Your guide, a stickman with a red headband" />
        <p className="bubble">Hey. One question, then you play. <em>No sign-up.</em></p>
      </div>
      <div className="kicker">FIRST CARD</div>
      <h1 className="prompt onb-q">What brought you here?</h1>
      <div className="options" role="group" aria-label="What brought you here?">
        {GOALS.map((g) => (
          <button key={g.id} type="button" className="opt onb-opt" onClick={() => pick(g.id)}>
            <span className="onb-label">{g.label}</span>
            <span className="onb-line">{g.line}</span>
          </button>
        ))}
      </div>
      <p className="foot onb-foot">One round is 60 seconds. That is the whole ask. <button type="button" className="onb-skip" onClick={skip}>Show me around first</button></p>
    </main>
  );
}
