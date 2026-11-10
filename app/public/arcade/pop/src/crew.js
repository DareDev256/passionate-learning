// What's Poppin: the crew, as pure logic (no Phaser, no canvas), so node tests can load it.
// Every bubble on the board is one crew member. Colour is only one of the identity cues: each member also has
// its own accessory and its own face habits (see heads.js), so a match reads as "three Heroes" without colour.

const CREW = [
  { key: 'hero',  name: 'Hero',  trait: 'headband' },
  { key: 'pro',   name: 'Pro',   trait: 'glasses' },
  { key: 'bolt',  name: 'Bolt',  trait: 'spikes' },
  { key: 'spark', name: 'Spark', trait: 'antenna' },
  { key: 'miso',  name: 'Miso',  trait: 'bun' },
  { key: 'dash',  name: 'Dash',  trait: 'cap' },
];

// Short lines the crew shout. Index 0 is a plain combo, 1 is a chain of 3 or more, 2 is a fever or huge chain.
const CREW_LINES = {
  hero:  [['Hero time!', 'Easy!', 'Too clean!'], ['Again!', 'Boom!', 'Heroic!'], ['UNSTOPPABLE!', 'HERO MODE!']],
  pro:   [['As planned.', 'Textbook.', 'Calculated.'], ['Told you.', 'Flawless.', 'Predicted.'], ['PERFECT!', 'PRO LEVEL!']],
  bolt:  [['Zap!', 'Quick!', 'Zoom!'], ['Too fast!', 'Lightning!', 'Zzzap!'], ['MAX VOLTS!', 'BOLT STORM!']],
  spark: [['Ooh!', 'Spark!', 'Shiny!'], ['Bright idea!', 'Pop pop!', 'Fizz!'], ['FIREWORKS!', 'SUPERNOVA!']],
  miso:  [['Yum!', 'Sweet!', 'Yay!'], ['Nice one!', 'Snack time!', 'Tasty!'], ['DELICIOUS!', 'FEAST!']],
  dash:  [['Go go!', 'Catch me!', 'Dash!'], ['Zoom zoom!', 'Speedy!', 'Whoosh!'], ['TURBO!', 'FULL SPEED!']],
};

/** One shout for a crew member. `level` 0..2, `rnd` is any 0..1 source so tests stay deterministic. */
function crewLine(crew, level, rnd) {
  const set = CREW_LINES[(CREW[crew] || CREW[0]).key];
  const lines = set[Math.max(0, Math.min(2, level | 0))];
  return lines[Math.min(lines.length - 1, Math.floor((rnd == null ? Math.random() : rnd) * lines.length))];
}

/** Which shout level a moment earns: plain, chain of 3+, or fever / chain of 5+. */
function shoutLevel(depth, fever) {
  if (fever || depth >= 5) return 2;
  return depth >= 3 ? 1 : 0;
}

/** The run of 3+ through (r, c) on a colour matrix, as a list of cells. Empty cells are -1 and never match. */
function runThrough(colors, r, c, rows, cols) {
  const v = colors[r] && colors[r][c];
  if (v === undefined || v < 0) return [];
  let l = c, rr = c;
  while (l - 1 >= 0 && colors[r][l - 1] === v) l--;
  while (rr + 1 < cols && colors[r][rr + 1] === v) rr++;
  let u = r, d = r;
  while (u - 1 >= 0 && colors[u - 1][c] === v) u--;
  while (d + 1 < rows && colors[d + 1][c] === v) d++;
  const out = [];
  const hRun = rr - l + 1 >= 3, vRun = d - u + 1 >= 3;
  if (hRun) for (let x = l; x <= rr; x++) out.push({ r, c: x });
  if (vRun) for (let y = u; y <= d; y++) if (!hRun || y !== r) out.push({ r: y, c });
  return out;
}

/**
 * Every swap of two neighbours that would make a match of 3+, with the cells that would match.
 * The crew uses this to lean toward a move that is waiting to happen. `colors[r][c]` is a colour index or -1.
 */
function findMoves(colors, rows, cols) {
  const moves = [];
  const swapped = (r1, c1, r2, c2) => {
    const t = colors[r1][c1]; colors[r1][c1] = colors[r2][c2]; colors[r2][c2] = t;
  };
  const test = (r1, c1, r2, c2) => {
    if (colors[r1][c1] < 0 || colors[r2][c2] < 0 || colors[r1][c1] === colors[r2][c2]) return;
    swapped(r1, c1, r2, c2);
    const lineA = runThrough(colors, r1, c1, rows, cols), lineB = runThrough(colors, r2, c2, rows, cols);
    swapped(r1, c1, r2, c2);
    // The head that started at b lands on a (and completes lineA), and the other way round for lineB.
    if (lineA.length) moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 }, line: lineA, mover: { r: r2, c: c2 }, dest: { r: r1, c: c1 } });
    if (lineB.length) moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 }, line: lineB, mover: { r: r1, c: c1 }, dest: { r: r2, c: c2 } });
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) test(r, c, r, c + 1);
      if (r + 1 < rows) test(r, c, r + 1, c);
    }
  }
  return moves;
}

/** Position in the dance: which beat, how far through it (0..1), and the step (0..3) of the four-step cycle. */
function beatPhase(ms, bpm) {
  const beatMs = 60000 / bpm;
  const n = Math.max(0, ms) / beatMs;
  const beat = Math.floor(n);
  return { beat, frac: n - beat, step: beat % 4 };
}

/**
 * One head's dance pose on the fever beat. Heads follow a four-step cycle (tilt left, tilt right, big hop, spin)
 * that is offset by column and row, so the board dances as a travelling wave. Every value is bounded.
 */
function danceState(beat, frac, col, row, reduce) {
  if (reduce) return { dy: 0, ang: 0, sx: 1, sy: 1, frame: 'cheer0' };
  const step = (((beat + col + (row >> 1)) % 4) + 4) % 4;
  const f = Math.max(0, Math.min(1, frac));
  const up = Math.sin(Math.PI * f);               // 0 -> 1 -> 0 across the beat
  const land = 1 - up;                            // heaviest at the start and end of the beat
  const ease = f * f * (3 - 2 * f);
  let dy = -up * 6, ang = 0, frame = step % 2 ? 'cheer1' : 'cheer0';
  if (step === 0) ang = -9 + 4 * up;
  else if (step === 1) ang = 9 - 4 * up;
  else if (step === 2) { dy = -up * 10; ang = 0; frame = 'cheer0'; }
  else { ang = 360 * ease; dy = -up * 8; frame = 'cheer1'; }
  return { dy, ang, sx: 1 + 0.07 * land * (step === 2 ? 1.6 : 1), sy: 1 - 0.09 * land * (step === 2 ? 1.6 : 1), frame };
}

/** The multiplier the player sees and scores with: streak up to 10, doubled in fever. */
function effectiveMultiplier(streak, fever) {
  const s = Number.isFinite(streak) ? Math.max(1, Math.min(streak, 10)) : 1;
  return s * (fever ? 2 : 1);
}

/** Points scored during one fever. Anything added while no fever is running is ignored, so the payoff is honest. */
class FeverTally {
  constructor() { this.active = false; this.total = 0; this.pops = 0; }
  start() { this.active = true; this.total = 0; this.pops = 0; }
  add(points, pops) {
    if (!this.active) return;
    if (!Number.isFinite(points) || points <= 0) return; // a junk score adds nothing, pops included
    this.total += points;
    if (Number.isFinite(pops) && pops > 0) this.pops += pops;
  }
  end() { const out = { total: this.total, pops: this.pops }; this.active = false; return out; }
}

/** Which frame of a timed frame sequence to show, or -1 once it has finished. */
function seqFrame(elapsedMs, msPerFrame, frames) {
  if (elapsedMs < 0 || msPerFrame <= 0) return 0;
  const i = Math.floor(elapsedMs / msPerFrame);
  return i >= frames ? -1 : i;
}

const _lumHex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

/** The candidate colour that stands out most against `fill` (by luminance). Used for every accessory and face line. */
function contrastPick(fill, candidates) {
  let best = candidates[0], bestD = -1;
  const lf = _lumHex(fill);
  for (const c of candidates) {
    const d = Math.abs(_lumHex(c) - lf);
    if (d > bestD) { bestD = d; best = c; }
  }
  return best;
}

if (typeof module !== 'undefined') {
  module.exports = { CREW, CREW_LINES, crewLine, shoutLevel, runThrough, findMoves, beatPhase, danceState, effectiveMultiplier, FeverTally, seqFrame, contrastPick };
}
