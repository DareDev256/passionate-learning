import { figure } from "./kit";

/**
 * The suite mark: the headband stickman mid-leap out of an open book, inside a hand-drawn badge,
 * with a vermilion scribble under the wordmark. Drawn in code, no generated art.
 */
export function LogoMark({ size = 56 }: { size?: number }) {
  const book = `<path d="M-34 -6q17 -10 34 0q17 -10 34 0v-34q-17 -10 -34 0q-17 -10 -34 0z" fill="var(--paper)" stroke="var(--ink)" stroke-width="3.4" stroke-linejoin="round"/><path d="M0 -6v-34" stroke="var(--ink)" stroke-width="3"/>`;
  const sparks = `<path d="M-30 -96l2 -7 2 7 7 2 -7 2 -2 7 -2 -7 -7 -2z" fill="var(--accent)"/><path d="M30 -84l1.5 -5 1.5 5 5 1.5 -5 1.5 -1.5 5 -1.5 -5 -5 -1.5z" fill="var(--accent)"/>`;
  const fig = `<g transform="translate(0,-30) scale(0.8)">${figure({ pose: "cheer", legs: "jump", face: "grin", wear: ["hero"] })}</g>`;
  const svg = `<svg viewBox="-52 -132 104 136" width="${size}" height="${Math.round(size * 1.24)}" xmlns="http://www.w3.org/2000/svg"><g filter="url(#rough)">${book}${fig}${sparks}</g></svg>`;
  return <span className="logo-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Logo({ size = 56, stacked = false }: { size?: number; stacked?: boolean }) {
  return (
    <span className={`logo ${stacked ? "logo-stacked" : ""}`} aria-label="Passionate Learning">
      <LogoMark size={size} />
      <span className="logo-word">
        <span className="logo-top">PASSIONATE</span>
        <span className="logo-bottom">LEARNING<svg className="logo-scribble" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M3 9q40 -8 80 -2t80 -3q20 -1 34 3" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" /></svg></span>
      </span>
    </span>
  );
}
