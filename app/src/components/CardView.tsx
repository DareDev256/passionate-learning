"use client";
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/content/types";
import type { Response } from "@/lib/round";
import { shuffle } from "@/lib/round";

interface Props {
  card: Card;
  /** Set once answered: the response and whether it was right. Locks the card and reveals the answer. */
  done: { r: Response; ok: boolean } | null;
  onAnswer: (r: Response) => void;
  seed: number;
}

/** Renders one card. Every type asks first; the reveal happens in-place once `done` is set. */
export function CardView({ card, done, onAnswer, seed }: Props) {
  switch (card.type) {
    case "choice":
      return (
        <>
          <h1 className="prompt">{card.prompt}</h1>
          <div className="options" role="group" aria-label="Answers">
            {card.options.map((o, i) => {
              const picked = done?.r.type === "choice" && done.r.index === i;
              const cls = done ? (i === card.answer ? "right" : picked ? "wrong" : "") : "";
              return <button key={i} className={`opt ${cls}`} disabled={!!done} onClick={() => onAnswer({ type: "choice", index: i })}>{o}</button>;
            })}
          </div>
        </>
      );
    case "cap": {
      const said = done?.r.type === "cap" ? done.r.saysCap : null;
      const cls = (isCapBtn: boolean) => (done ? (card.isCap === isCapBtn ? "right" : said === isCapBtn ? "wrong" : "") : "");
      return (
        <>
          <h1 className="prompt">Cap or facts?</h1>
          <p className="claim">{card.source && <span className="src">{card.source.toUpperCase()}</span>}&ldquo;{card.claim}&rdquo;</p>
          <div className="opt-row" role="group" aria-label="Cap or facts">
            <button className={`opt cap-btn ${cls(true)}`} disabled={!!done} onClick={() => onAnswer({ type: "cap", saysCap: true })}>🧢 CAP</button>
            <button className={`opt cap-btn ${cls(false)}`} disabled={!!done} onClick={() => onAnswer({ type: "cap", saysCap: false })}>✅ FACTS</button>
          </div>
        </>
      );
    }
    case "predict": {
      const order = shuffle(card.options.map((_, i) => i), seed);
      const top = card.options.reduce((b, o, i) => (o.p > card.options[b].p ? i : b), 0);
      return (
        <>
          <div className="kicker">Think like the model: what comes next?</div>
          <p className="context">{card.context.replace("___", "")}<span className="blank">{done ? card.options[top].token : "???"}</span></p>
          <div className="options" role="group" aria-label="Next token">
            {order.map((i) => {
              const o = card.options[i];
              const picked = done?.r.type === "predict" && done.r.index === i;
              const cls = done ? (i === top ? "right" : picked ? "wrong" : "") : "";
              return (
                <button key={i} className={`opt ${cls}`} disabled={!!done} onClick={() => onAnswer({ type: "predict", index: i })}>
                  {o.token}{done && <span className="p">{Math.round(o.p * 100)}%</span>}
                </button>
              );
            })}
          </div>
        </>
      );
    }
    case "spot":
      return (
        <>
          <h1 className="prompt">{card.prompt}</h1>
          <div role="group" aria-label="Sentences">
            {card.sentences.map((s, i) => {
              const picked = done?.r.type === "spot" && done.r.index === i;
              const cls = done ? (i === card.answer ? "right" : picked ? "wrong" : "") : "";
              return <button key={i} className={`sentence ${cls}`} disabled={!!done} onClick={() => onAnswer({ type: "spot", index: i })}>{s}</button>;
            })}
          </div>
        </>
      );
    case "order":
      return <OrderCard key={card.id} card={card} done={done} onAnswer={onAnswer} seed={seed} />;
    case "type":
      return <TypeCard key={card.id} card={card} done={done} onAnswer={onAnswer} />;
  }
}

function OrderCard({ card, done, onAnswer, seed }: { card: Extract<Card, { type: "order" }>; done: Props["done"]; onAnswer: Props["onAnswer"]; seed: number }) {
  const [placed, setPlaced] = useState<string[]>([]);
  const pool = shuffle(card.steps, seed).filter((s) => !placed.includes(s));
  const final = done?.r.type === "order" ? done.r.order : placed;
  return (
    <>
      <h1 className="prompt">{card.prompt}</h1>
      <div className="order-list" aria-label="Your order">
        {final.map((s, i) => (
          <button key={s} className={`order-item placed ${done ? (card.steps[i] === s ? "right" : "wrong") : ""}`} disabled={!!done} onClick={() => setPlaced(placed.filter((x) => x !== s))} aria-label={`Step ${i + 1}: ${s}. Tap to remove`}>
            <span className="n">{i + 1}</span><span style={{ textAlign: "left" }}>{s}</span><span aria-hidden="true">{done ? (card.steps[i] === s ? "✓" : "✗") : "↩"}</span>
          </button>
        ))}
      </div>
      {!done && (
        <>
          <div className="order-pool" aria-label="Steps to place">
            {pool.map((s) => <button key={s} className="pool-chip" onClick={() => setPlaced([...placed, s])}>{s}</button>)}
          </div>
          {placed.length === card.steps.length && <button className="btn block" style={{ marginTop: 16 }} onClick={() => onAnswer({ type: "order", order: placed })}>CHECK</button>}
          {placed.length === 0 && <p className="hint">Tap the steps in the order they happen.</p>}
        </>
      )}
    </>
  );
}

function TypeCard({ card, done, onAnswer }: { card: Extract<Card, { type: "type" }>; done: Props["done"]; onAnswer: Props["onAnswer"] }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <>
      <h1 className="prompt">{card.prompt}</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !done) onAnswer({ type: "type", text }); }}>
        <input ref={ref} className="type-in" value={text} onChange={(e) => setText(e.target.value)} disabled={!!done} placeholder="type it..." aria-label="Your answer" autoComplete="off" autoCapitalize="off" spellCheck={false} />
        {card.hint && !done && <p className="hint">hint: {card.hint}</p>}
        {!done && <button className="btn block" style={{ marginTop: 14 }} disabled={!text.trim()}>CHECK</button>}
      </form>
    </>
  );
}

/** The correct answer as plain text, for the feedback drawer after a miss. */
export function correctText(card: Card): string {
  switch (card.type) {
    case "choice": return card.options[card.answer];
    case "cap": return card.isCap ? "CAP" : "FACTS";
    case "predict": return card.options.reduce((b, o) => (o.p > b.p ? o : b)).token;
    case "spot": return card.sentences[card.answer];
    case "order": return card.steps.map((s, i) => `${i + 1}. ${s}`).join("  ");
    case "type": return card.accept[0];
  }
}
