"use client";
import { SystemWindow } from "./SystemWindow";
import type { Save } from "@/lib/save";
import { CHEST_TOKENS, openChest, questsOf } from "@/lib/quests";

/** A hand-drawn chest: shut, ready (the lid hops), or open with a glow. */
function Chest({ state }: { state: "shut" | "ready" | "open" }) {
  const ink = "#0a0a0a";
  return (
    <svg className={`chest chest-${state}`} viewBox="0 0 120 100" width="96" height="80" aria-hidden="true" focusable="false">
      {state === "open" && <circle cx="60" cy="44" r="34" fill="#ffc531" opacity="0.35" className="chest-glow" />}
      <rect x="14" y="46" width="92" height="44" rx="6" fill="#d99a1e" stroke={ink} strokeWidth="5" />
      <path d="M14 62 H106" stroke={ink} strokeWidth="4" />
      <g className="chest-lid" style={{ transformOrigin: "14px 46px" }}>
        {state === "open"
          ? <path d="M14 46 L20 14 H100 L106 46 Z" fill="#f2b230" stroke={ink} strokeWidth="5" strokeLinejoin="round" transform="rotate(-18 14 46)" />
          : <path d="M14 46 C14 22 28 14 60 14 C92 14 106 22 106 46 Z" fill="#f2b230" stroke={ink} strokeWidth="5" strokeLinejoin="round" />}
      </g>
      <rect x="51" y="52" width="18" height="20" rx="3" fill="#ff3b1f" stroke={ink} strokeWidth="4" />
      <circle cx="60" cy="62" r="3" fill={ink} />
      {state === "open" && <g fill="#ffc531" stroke={ink} strokeWidth="2.5"><circle cx="44" cy="34" r="6" /><circle cx="64" cy="28" r="6" /><circle cx="82" cy="36" r="6" /></g>}
    </svg>
  );
}

/** Takes Home's save and update, so opening the chest also moves the token chip in the top bar. */
export function QuestsCard({ save, update, ready }: { save: Save; update: (next: Save) => void; ready: boolean }) {
  const q = questsOf(save);
  const rows: { done: boolean; text: React.ReactNode }[] = [
    { done: q.round, text: <>Finish 1 round <b>(that is a whole day)</b></> },
    { done: q.review, text: <>Clear a review</> },
    { done: q.second, text: <>Play a second round</> },
  ];
  const state = q.chestOpened ? "open" : q.allDone ? "ready" : "shut";
  return (
    <SystemWindow title="TODAY">
      <ul className="quest" aria-label="Today's quests">
        {rows.map((r, i) => (
          <li key={i} className={r.done ? "done" : ""}><span className="box">{r.done ? "✓" : ""}</span><span>{r.text}</span></li>
        ))}
      </ul>
      <div className="chest-row">
        <Chest state={state} />
        <div className="chest-text">
          {q.chestOpened ? <p>Chest opened. <b>+{CHEST_TOKENS} tokens</b> are in your pocket. A new one tomorrow.</p>
            : q.allDone ? <><p>All three done. The chest is ready.</p><button type="button" className="btn ink chest-btn" disabled={!ready} onClick={() => update(openChest(save))}>OPEN CHEST</button></>
            : <p>{q.done} of 3 done. Finish all three to open the chest. <span className="floor">One round already counts as your day. A missed day resets nothing.</span></p>}
        </div>
      </div>
    </SystemWindow>
  );
}
