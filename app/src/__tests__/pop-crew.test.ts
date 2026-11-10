import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

// The crew logic of What's Poppin is plain JS in public/arcade/pop/src/crew.js (the game is a separate vanilla page).
const req = createRequire(import.meta.url);
const crew = req("../../public/arcade/pop/src/crew.js") as {
  CREW: { key: string; name: string; trait: string }[];
  CREW_LINES: Record<string, string[][]>;
  crewLine: (c: number, level: number, rnd?: number) => string;
  shoutLevel: (depth: number, fever: boolean) => number;
  runThrough: (colors: number[][], r: number, c: number, rows: number, cols: number) => { r: number; c: number }[];
  findMoves: (colors: number[][], rows: number, cols: number) => { a: { r: number; c: number }; b: { r: number; c: number }; line: { r: number; c: number }[]; mover: { r: number; c: number }; dest: { r: number; c: number } }[];
  beatPhase: (ms: number, bpm: number) => { beat: number; frac: number; step: number };
  danceState: (beat: number, frac: number, col: number, row: number, reduce?: boolean) => { dy: number; ang: number; sx: number; sy: number; frame: string };
  effectiveMultiplier: (streak: number, fever: boolean) => number;
  FeverTally: new () => { active: boolean; total: number; pops: number; start(): void; add(p: number, n?: number): void; end(): { total: number; pops: number } };
  seqFrame: (elapsed: number, per: number, frames: number) => number;
  contrastPick: (fill: string, c: string[]) => string;
};

describe("the crew", () => {
  it("has six members with distinct names and distinct accessories (shape carries identity, not only colour)", () => {
    expect(crew.CREW).toHaveLength(6);
    expect(new Set(crew.CREW.map((m) => m.name)).size).toBe(6);
    expect(new Set(crew.CREW.map((m) => m.trait)).size).toBe(6);
  });
  it("every member has shouts for all three levels, in plain words with no dashes", () => {
    for (const m of crew.CREW) {
      const set = crew.CREW_LINES[m.key];
      expect(set).toHaveLength(3);
      for (const lines of set) {
        expect(lines.length).toBeGreaterThan(0);
        for (const l of lines) expect(l).not.toMatch(/[–—]|--/);
      }
    }
  });
  it("crewLine is deterministic for a given roll and clamps its level", () => {
    expect(crew.crewLine(0, 0, 0)).toBe(crew.CREW_LINES.hero[0][0]);
    expect(crew.crewLine(0, 9, 0.99)).toBe(crew.CREW_LINES.hero[2].at(-1));
    expect(crew.crewLine(99, 0, 0)).toBe(crew.CREW_LINES.hero[0][0]);
  });
  it("shoutLevel escalates with chain depth and fever", () => {
    expect(crew.shoutLevel(1, false)).toBe(0);
    expect(crew.shoutLevel(3, false)).toBe(1);
    expect(crew.shoutLevel(5, false)).toBe(2);
    expect(crew.shoutLevel(1, true)).toBe(2);
  });
});

describe("findMoves", () => {
  // 3 rows x 4 cols. Swapping (0,2) with (0,3) lines up three 1s in row 0.
  const board = () => [
    [1, 1, 2, 1],
    [3, 4, 3, 4],
    [4, 3, 4, 3],
  ];
  it("finds the one swap that makes a match and says which head moves where", () => {
    const moves = crew.findMoves(board(), 3, 4);
    const m = moves.find((x) => x.line.length === 3)!;
    expect(m).toBeDefined();
    expect(m.dest).toEqual({ r: 0, c: 2 });
    expect(m.mover).toEqual({ r: 0, c: 3 });
    expect(m.line.map((c) => c.c).sort()).toEqual([0, 1, 2]);
  });
  it("leaves the board exactly as it found it", () => {
    const b = board();
    crew.findMoves(b, 3, 4);
    expect(b).toEqual(board());
  });
  it("never treats empty cells (-1) as a colour, and finds nothing on a dead board", () => {
    expect(crew.findMoves([[-1, -1, -1], [-1, -1, -1], [-1, -1, -1]], 3, 3)).toEqual([]);
    expect(crew.findMoves([[0, 1, 0], [2, 3, 2], [0, 1, 0]], 3, 3)).toEqual([]);
  });
  it("a swap of two equal heads is never a move", () => {
    const moves = crew.findMoves([[1, 1, 0, 0], [0, 0, 1, 1]], 2, 4);
    for (const m of moves) expect(m.a).not.toEqual(m.b);
  });
  it("runThrough returns a vertical run without double counting the centre cell", () => {
    const run = crew.runThrough([[2], [2], [2], [1]], 1, 0, 4, 1);
    expect(run).toHaveLength(3);
    expect(new Set(run.map((c) => `${c.r},${c.c}`)).size).toBe(3);
  });
});

describe("fever", () => {
  it("the multiplier is the streak (cap 10), doubled in fever, and never below 1", () => {
    expect(crew.effectiveMultiplier(0, false)).toBe(1);
    expect(crew.effectiveMultiplier(4, false)).toBe(4);
    expect(crew.effectiveMultiplier(40, false)).toBe(10);
    expect(crew.effectiveMultiplier(40, true)).toBe(20);
    expect(crew.effectiveMultiplier(NaN, true)).toBe(2);
  });
  it("the payoff tally counts only while a fever runs, and ignores junk", () => {
    const t = new crew.FeverTally();
    t.add(500, 3); // no fever yet: ignored
    t.start();
    t.add(120, 3);
    t.add(NaN, 2);
    t.add(-50, 1);
    t.add(80, 4);
    expect(t.end()).toEqual({ total: 200, pops: 7 });
    t.add(999, 9); // fever over: ignored
    expect(t.total).toBe(200);
  });
  it("a new fever starts from zero", () => {
    const t = new crew.FeverTally();
    t.start(); t.add(100, 1); t.end();
    t.start();
    expect(t.end()).toEqual({ total: 0, pops: 0 });
  });
  it("beatPhase cycles four steps and the dance stays bounded", () => {
    const bpm = 120; // 500 ms a beat
    expect(crew.beatPhase(0, bpm)).toEqual({ beat: 0, frac: 0, step: 0 });
    expect(crew.beatPhase(1750, bpm).step).toBe(3);
    expect(crew.beatPhase(2000, bpm).step).toBe(0);
    for (let beat = 0; beat < 8; beat++) {
      for (let f = 0; f <= 1; f += 0.1) {
        const d = crew.danceState(beat, f, beat % 8, beat % 10);
        expect(Math.abs(d.dy)).toBeLessThanOrEqual(10.01);
        expect(Math.abs(d.ang)).toBeLessThanOrEqual(360);
        expect(d.sx).toBeGreaterThan(0.8);
        expect(d.sy).toBeGreaterThan(0.8);
        expect(["cheer0", "cheer1"]).toContain(d.frame);
      }
    }
  });
  it("reduced motion keeps the cheer face but no movement", () => {
    expect(crew.danceState(2, 0.5, 3, 4, true)).toEqual({ dy: 0, ang: 0, sx: 1, sy: 1, frame: "cheer0" });
  });
});

describe("pop frames and colour", () => {
  it("seqFrame walks the frames and reports -1 once the sequence is done", () => {
    expect(crew.seqFrame(0, 50, 6)).toBe(0);
    expect(crew.seqFrame(149, 50, 6)).toBe(2);
    expect(crew.seqFrame(299, 50, 6)).toBe(5);
    expect(crew.seqFrame(300, 50, 6)).toBe(-1);
  });
  it("contrastPick takes the candidate furthest from the fill in luminance", () => {
    expect(crew.contrastPick("#ffffff", ["#0a0a0a", "#ffffff"])).toBe("#0a0a0a");
    expect(crew.contrastPick("#0a0a0a", ["#0a0a0a", "#ffffff"])).toBe("#ffffff");
    expect(crew.contrastPick("#ff3b1f", ["#ff3b1f", "#ffffff", "#0a0a0a"])).not.toBe("#ff3b1f");
  });
});
