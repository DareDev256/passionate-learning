// What's Poppin: view size, render scale and the colour roles every scene draws from.
// Everything is derived from the equipped theme (theme.js) so a theme changes the whole game, not a tint.

/** Logical size. All game code works in these units; the camera zooms them up to the canvas. */
const LW = 464;
const LH = 868;
/** Render scale: the canvas is Z times bigger than the logical view so lines and text stay sharp on a phone. */
const Z = (() => {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return dpr >= 2.5 ? 2.5 : 2;
})();
const VIEW = { width: LW, height: LH };
/** True when the player asked their device for less motion. Shake, zoom punches, slow-mo and confetti all check it. */
const REDUCE_MOTION = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
})();

const _toInt = (h) => parseInt(h.slice(1), 16);
const _rgb = (h) => [(_toInt(h) >> 16) & 255, (_toInt(h) >> 8) & 255, _toInt(h) & 255];
const _hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** Blend colour a toward colour b by t (0..1); both '#rrggbb'. */
function mixHex(a, b, t) {
  const A = _rgb(a), B = _rgb(b);
  return _hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
const _lum = (h) => { const c = _rgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };

const P = (() => {
  const T = window.WP_THEME;
  const ground = T.ground, ink = T.ink, hot = T.accent;
  const inkIsLight = _lum(ink) > 0.5;
  const p = {
    id: T.id, name: T.name, wear: T.wear,
    bg: ground, ink, hot,
    // The panel behind a score card or the stage; a touch off the ground toward the ink.
    panel: mixHex(ground, ink, inkIsLight ? 0.1 : 0.06),
    // Button and card fill: white on a dark-ink theme, a deeper ground on a light-ink theme.
    card: inkIsLight ? mixHex(ground, '#000000', 0.45) : '#ffffff',
    line: mixHex(ground, ink, 0.28),
    text2: mixHex(ground, ink, 0.82),
    muted: mixHex(ground, ink, 0.62),
    faint: mixHex(ground, ink, 0.45),
    bubbles: T.bubbles,
    inkIsLight,
  };
  for (const k of ['bg', 'ink', 'hot', 'panel', 'card', 'line', 'text2', 'muted', 'faint']) p[k + 'N'] = _toInt(p[k]);
  p.bubblesN = p.bubbles.map(_toInt);
  return p;
})();

// The page behind the canvas matches the theme so the letterbox never shows a different colour.
try { document.documentElement.style.background = P.bg; document.body.style.background = P.bg; } catch (_) { /* no DOM */ }
