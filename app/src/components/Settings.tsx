"use client";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/art/Logo";
import { type MotionPref, type Settings as Prefs, forgetLegacy, freshSave } from "@/lib/save";
import { useSave } from "@/lib/useSave";
import { applyMotion } from "./MotionClass";
import { clearInProgress } from "@/lib/roundResume";

const MOTIONS: { id: MotionPref; label: string }[] = [{ id: "system", label: "SYSTEM" }, { id: "reduce", label: "REDUCE" }, { id: "full", label: "FULL" }];

function Switch({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="set-row">
      <span className="set-label">{label}{hint && <span className="set-hint">{hint}</span>}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />
    </div>
  );
}

export function Settings() {
  const { save, update, ready } = useSave();
  const [typed, setTyped] = useState("");
  const [didReset, setDidReset] = useState(false);
  const set = (patch: Partial<Prefs>) => update({ ...save, settings: { ...save.settings, ...patch } });

  const reset = () => {
    // A progress reset, not a preferences wipe: the player keeps their settings.
    update({ ...freshSave(), settings: save.settings });
    forgetLegacy();
    clearInProgress(); // a half-played round belongs to the progress that was just reset
    setTyped("");
    setDidReset(true);
  };

  return (
    <main className="wrap">
      <header className="topbar"><Link className="x" href="/" aria-label="Back to the map">←</Link><Logo size={40} /></header>
      <h1 className="h2">Settings</h1>
      {!ready ? <p>Loading...</p> : (
        <>
          <h2 className="h2">Play</h2>
          <section className="set-group" aria-label="Play">
            <Switch label="Sound" on={save.settings.sound} onChange={(v) => set({ sound: v })} />
            <Switch label="Haptics" hint="Little buzzes on answers, on iPhone." on={save.settings.haptics} onChange={(v) => set({ haptics: v })} />
            <div className="set-row">
              <span className="set-label">Motion<span className="set-hint">System follows your phone&apos;s setting.</span></span>
              <div className="seg" role="group" aria-label="Motion">
                {MOTIONS.map((m) => (
                  <button key={m.id} type="button" aria-pressed={save.settings.motion === m.id} onClick={() => { set({ motion: m.id }); applyMotion(m.id); }}>{m.label}</button>
                ))}
              </div>
            </div>
          </section>

          <h2 className="h2">You</h2>
          <section className="set-group" aria-label="You">
            <div className="set-row">
              <label className="set-label" htmlFor="set-name">Display name</label>
              <input id="set-name" className="set-input" maxLength={24} value={save.settings.name} placeholder="Optional" onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="set-reset">
              <span className="set-label">Reset progress</span>
              <p className="set-hint">Starts you back at rank E with 0 XP. Your settings stay. Type RESET to confirm.</p>
              <div className="set-row" style={{ borderBottom: 0, padding: 0 }}>
                <input className="set-input" aria-label="Type RESET to confirm" value={typed} autoCapitalize="characters" autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
                <button type="button" className="btn ink" disabled={typed !== "RESET"} onClick={reset}>RESET</button>
              </div>
              {didReset && <p role="status" className="set-hint">Progress reset. Fresh start.</p>}
            </div>
          </section>

          <h2 className="h2">About</h2>
          <section className="set-group" aria-label="About">
            <Link className="set-row set-link" href="/about/">About</Link>
            <Link className="set-row set-link" href="/privacy/">Privacy</Link>
            <Link className="set-row set-link" href="/support/">Support</Link>
          </section>
          <p className="foot">Passionate Learning v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
        </>
      )}
    </main>
  );
}
