import { figure, DEFS, PROPS } from "./kit";
import type { Face, Pose } from "@/content/types";

export interface StickProps {
  pose?: Pose;
  face?: Face;
  wear?: string[];
  robot?: boolean;
  flip?: boolean;
  /** Rendered width in px; height follows the figure's 4:5 box. */
  size?: number;
  className?: string;
  label?: string;
}

/** One stickman, cropped tight. The SVG is built from the kit's internal data, never from user input. */
export function Stick({ pose = "stand", face = "happy", wear = ["hero"], robot = false, flip = false, size = 96, className = "", label }: StickProps) {
  const pad = robot ? 124 : 118;
  const svg = `<svg viewBox="-44 ${-pad} 88 ${pad + 8}" width="${size}" height="${Math.round(size * 1.43)}" xmlns="http://www.w3.org/2000/svg"><g filter="url(#rough)">${figure({ pose, face, wear, robot, flip })}</g></svg>`;
  return <span className={`stick ${className}`} role="img" aria-label={label ?? `stickman, ${face}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The hand-drawn wobble filter, mounted once in the root layout. */
export function StickDefs() {
  return <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: DEFS }} />;
}

export { PROPS };
