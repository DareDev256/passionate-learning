import { scene, PROPS } from "./kit";
import type { Meme } from "@/content/types";

// Original stickman versions of common meme formats, ported from the AI for Idiots book (src/blocks.js).
// Scenes are SVG strings from the kit; captions are React text, so content is always escaped.

const Svg = ({ html, className = "" }: { html: string; className?: string }) => (
  <span className={`meme-art ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
);

const hero = (pose: string, face: string, extra: string[] = []) => ({ pose, face, wear: ["hero", ...extra] });

export function MemeCard({ meme }: { meme: Meme }) {
  switch (meme.kind) {
    case "drake":
      return (
        <figure className="meme drake" aria-label={`Meme: not "${meme.no}", yes "${meme.yes}"`}>
          <div className="dr-row">
            <Svg html={scene({ w: 120, h: 120, groundLine: false, items: [{ ...hero("nope", "angry"), x: 60, y: 118, s: 0.95, look: -1 }] })} />
            <p className="dr-t no">{meme.no}</p>
          </div>
          <div className="dr-row">
            <Svg html={scene({ w: 120, h: 120, groundLine: false, items: [{ ...hero("point", "grin", ["sparkle"]), x: 60, y: 118, s: 0.95 }] })} />
            <p className="dr-t yes">{meme.yes}</p>
          </div>
        </figure>
      );
    case "galaxy": {
      const faces = ["flat", "happy", "grin", "cool", "zen"];
      return (
        <figure className="meme galaxy" aria-label={`Galaxy brain meme: ${meme.levels.join(", then ")}`}>
          {meme.levels.map((t, i) => (
            <div className={`gx-row lv${i}`} key={i}>
              <p className="gx-t">{t}</p>
              <Svg
                className="gx-art"
                html={scene({
                  w: 110, h: 90, groundLine: false,
                  items: [{ pose: "stand", face: faces[Math.min(i, 4)], x: 55, y: 150, s: 1 }],
                  extra: `<g transform="translate(55,58)">${Array.from({ length: 4 + i * 4 }, (_, k) => {
                    const a = (k / (4 + i * 4)) * Math.PI * 2, r1 = 18, r2 = 22 + i * 7;
                    return `<path d="M${Math.cos(a) * r1} ${Math.sin(a) * r1}L${Math.cos(a) * r2} ${Math.sin(a) * r2}" stroke="var(--accent)" stroke-width="${1 + i * 0.5}"/>`;
                  }).join("")}</g>`,
                })}
              />
            </div>
          ))}
        </figure>
      );
    }
    case "buttons":
      return (
        <figure className="meme buttons" aria-label={`Two buttons meme: ${meme.a} or ${meme.b}`}>
          <div className="btns"><span>{meme.a}</span><span>{meme.b}</span></div>
          <Svg html={scene({ w: 300, h: 150, items: [{ ...hero("think", "shock", ["sweat"]), x: 150, s: 1.15 }] })} />
          {meme.caption && <figcaption>{meme.caption}</figcaption>}
        </figure>
      );
    case "expect":
      return (
        <figure className="meme expect" aria-label={`Expectation: ${meme.expectation}. Reality: ${meme.reality}`}>
          <div className="ex-col">
            <div className="ex-h">EXPECTATION</div>
            <Svg html={scene({ w: 160, h: 150, items: [{ ...hero("cheer", "grin", ["sparkle"]), x: 80 }] })} />
            <p>{meme.expectation}</p>
          </div>
          <div className="ex-col real">
            <div className="ex-h">REALITY</div>
            <Svg html={scene({ w: 160, h: 150, items: [PROPS.fire(125, 0.9), { ...hero("panic", "dead", ["sweat"]), x: 70 }] })} />
            <p>{meme.reality}</p>
          </div>
        </figure>
      );
    case "fine":
      return (
        <figure className="meme fine" aria-label={`This is fine meme: ${meme.caption}`}>
          <Svg html={scene({ w: 340, h: 160, items: [PROPS.fire(30, 1.5), PROPS.fire(300, 1.7), PROPS.desk(175, 80), PROPS.coffee(195), { ...hero("stand", "happy"), legs: "sit", x: 150 }, PROPS.chair(142), PROPS.fire(250, 1.1)] })} />
          <div className="fine-b">This is fine.</div>
          <figcaption>{meme.caption}</figcaption>
        </figure>
      );
  }
}
