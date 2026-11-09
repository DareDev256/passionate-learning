// What's Poppin: bubble match game, restyled as part of Passionate Learning.
// Doodle bubbles on the equipped theme's ground, with the stickman cast reacting on a stage above the board.

// =============================================================
// CONSTANTS
// =============================================================
const GRID_COLS = 8;
const GRID_ROWS = 10;
const BUBBLE_SIZE = 44;
const BUBBLE_PAD = 4;
const GRID_OFFSET_X = 40;
// Layout, top to bottom (logical units; the view is LW x LH):
// HUD row 0-60, timer bar 62-68, stage 72-282 (the cast lives here), board 296-776, footer 776-868.
const HUD_H = 60;
const TIMER_Y = 62;
const STAGE_Y = 72;
const STAGE_H = 210;
const GRID_OFFSET_Y = 296;
const MIN_MATCH = 3;
const GAME_TIME = 90; // seconds

// Phaser Text rasterises at 1x unless told otherwise, which looks soft once the camera zooms. Every text gets the render scale.
(function sharpText() {
  const proto = Phaser.GameObjects.GameObjectFactory.prototype;
  const orig = proto.text;
  proto.text = function (x, y, text, style) { return orig.call(this, x, y, text, Object.assign({ resolution: Z }, style)); };
})();

/** First line of every scene's create(): zoom the camera so logical units fill the Z-times-bigger canvas. */
function setupScene(scene) {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(Z);
  cam.setBackgroundColor(P.bg);
}

/**
 * Draw a texture on a canvas at Z times its logical size and register it so that images made from it are
 * logical-sized (w x h) but sample the sharp pixels. drawFn(ctx) draws in logical units.
 */
/** Images made from a crisp texture are Z times too big until scaled by BS. Every size in the game code is written in logical units times BS. */
const BS = 1 / Z;
function crispTexture(scene, key, w, h, drawFn) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.round(w * Z), Math.round(h * Z));
  const ctx = tex.getContext();
  ctx.scale(Z, Z);
  drawFn(ctx);
  tex.refresh();
  return tex;
}

const COLORS = P.bubblesN;

const COLOR_NAMES = ['one', 'two', 'three', 'four', 'five', 'six'];

/**
 * Colorblind symbol drawers — each renders a unique geometric shape
 * on top of the bubble to distinguish colors without relying on hue.
 * Shapes: diamond, cross, ring, triangle, square, star.
 * @type {Array<(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) => void>}
 */
const CB_SYMBOLS = [
  (g, cx, cy, s) => { // purple — diamond
    g.fillStyle(0xffffff, 0.9);
    g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.7, cy);
    g.lineTo(cx, cy + s); g.lineTo(cx - s * 0.7, cy); g.closePath(); g.fillPath();
  },
  (g, cx, cy, s) => { // red — cross
    g.lineStyle(3.5, 0xffffff, 0.9);
    g.lineBetween(cx - s, cy - s, cx + s, cy + s);
    g.lineBetween(cx + s, cy - s, cx - s, cy + s);
  },
  (g, cx, cy, s) => { // green — ring
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(cx, cy, s * 0.85);
  },
  (g, cx, cy, s) => { // gold — triangle
    g.fillStyle(0xffffff, 0.9);
    g.beginPath(); g.moveTo(cx, cy - s);
    g.lineTo(cx + s, cy + s * 0.7); g.lineTo(cx - s, cy + s * 0.7);
    g.closePath(); g.fillPath();
  },
  (g, cx, cy, s) => { // blue — square
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(cx - s * 0.7, cy - s * 0.7, s * 1.4, s * 1.4);
  },
  (g, cx, cy, s) => { // orange — 6-point star
    g.fillStyle(0xffffff, 0.9);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const r = i % 2 === 0 ? s : s * 0.45;
      g[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath(); g.fillPath();
  },
];

/** Return the correct bubble texture key based on colorblind mode setting. */
function bubbleKey(colorIdx) {
  return SafeStorage.get(SK.COLORBLIND, '0') === '1'
    ? `bubble_cb_${colorIdx}` : `bubble_${colorIdx}`;
}

const STREAK_LEVELS = [
  { min: 3,  label: 'NICE',      color: P.ink, size: 28 },
  { min: 5,  label: 'FIRE',      color: P.hot, size: 34 },
  { min: 8,  label: 'UNREAL',    color: P.hot, size: 42 },
  { min: 12, label: 'LEGENDARY', color: P.hot, size: 50 },
];

const ADLIBS = {
  3:  ['Nice!', 'Clean!', 'Smooth!', 'Sweet!', 'Let\'s go!'],
  5:  ['On fire!', 'Heating up!', 'Big pop!', 'Keep going!', 'Sharp!'],
  8:  ['Unreal!', 'So good!', 'Locked in!', 'Unstoppable!', 'Wow!'],
  12: ['Legendary!', 'Perfect!', 'Superstar!', 'Untouchable!'],
};

const UI_FONT = '"Segoe UI", system-ui, sans-serif';

// =============================================================
// STORAGE KEYS — single source of truth for all SafeStorage keys
// =============================================================
const SK = {
  HIGH_SCORE:    'whatspoppin_highscore',
  BEST_STREAK:   'whatspoppin_best_streak',
  COLORBLIND:    'whatspoppin_colorblind',
  PLAYED:        'whatspoppin_played',
  TOTAL_POPS:    'whatspoppin_total_pops',
  TOTAL_SCORE:   'whatspoppin_total_score',
  GAMES_TIMED:   'whatspoppin_games_timed',
  GAMES_ZEN:     'whatspoppin_games_zen',
  DAILY_TOTAL:   'whatspoppin_daily_total',
  BEST_GRADE:    (mode) => `whatspoppin_bestgrade_${mode}`,
  GAMES:         (mode) => `whatspoppin_games_${mode}`,
  DAILY:         (dateKey) => `whatspoppin_daily_${dateKey}`,
  ACHIEVEMENT:   (id) => `whatspoppin_ach_${id}`,
};

// =============================================================
// GRID HELPERS — eliminate repeated nested loop boilerplate
// =============================================================

/**
 * Iterate every cell in the grid, invoking callback(r, c) for each.
 * Replaces the 5+ copies of `for(r) for(c)` scattered across GameScene.
 */
function forEachCell(callback) {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      callback(r, c);
    }
  }
}

const GRADES = [
  { grade: 'S', minScore: 5000, minStreak: 8, color: P.hot, label: 'SUPREME' },
  { grade: 'A', minScore: 3000, minStreak: 5, color: P.ink, label: 'EXCELLENT' },
  { grade: 'B', minScore: 1500, minStreak: 3, color: P.ink, label: 'GREAT' },
  { grade: 'C', minScore: 500,  minStreak: 0, color: P.hot, label: 'DECENT' },
  { grade: 'D', minScore: 100,  minStreak: 0, color: P.hot, label: 'ROOKIE' },
];

// =============================================================
// ACHIEVEMENTS — Progression milestones that drive replay value
// =============================================================
const ACHIEVEMENTS = [
  { id: 'first_blood',  name: 'FIRST POP',  desc: 'Pop your first bubble',           color: P.ink, threshold: () => true },
  { id: 'streak_5',     name: 'ON FIRE',       desc: 'Hit a 5× streak',                 color: P.hot, threshold: (s) => s.bestStreak >= 5 },
  { id: 'streak_8',     name: 'UNSTOPPABLE',    desc: 'Hit an 8× streak',                color: P.hot, threshold: (s) => s.bestStreak >= 8 },
  { id: 'streak_12',    name: 'LEGENDARY',  desc: 'Hit a 12× streak',                color: P.hot, threshold: (s) => s.bestStreak >= 12 },
  { id: 'score_5k',     name: '5K CLUB',     desc: 'Score 5,000+ in one game',        color: P.hot, threshold: (s) => s.score >= 5000 },
  { id: 'score_10k',    name: 'UNTOUCHABLE',   desc: 'Score 10,000+ in one game',       color: P.hot, threshold: (s) => s.score >= 10000 },
  { id: 'pops_500',     name: 'POP MACHINE',   desc: 'Pop 500 lifetime bubbles',        color: P.ink, threshold: (_, lt) => lt.totalPops >= 500 },
  { id: 'games_10',     name: 'DEDICATED',      desc: 'Play 10 games',                   color: P.ink, threshold: (_, lt) => lt.totalGames >= 10 },
];

/**
 * Achievement persistence layer — unlock, query, iterate.
 * Stores each unlock as `whatspoppin_ach_<id>` = '1' via SafeStorage.
 */
const Achievements = {
  _key(id) { return SK.ACHIEVEMENT(id); },
  isUnlocked(id) { return SafeStorage.get(this._key(id), '0') === '1'; },
  unlock(id) {
    if (this.isUnlocked(id)) return false;
    SafeStorage.set(this._key(id), '1');
    return true; // newly unlocked
  },
  /** Check all achievements against session + lifetime stats, return newly unlocked. */
  check(session, lifetime) {
    const fresh = [];
    for (const ach of ACHIEVEMENTS) {
      if (!this.isUnlocked(ach.id) && ach.threshold(session, lifetime)) {
        if (this.unlock(ach.id)) fresh.push(ach);
      }
    }
    return fresh;
  },
  countUnlocked() { return ACHIEVEMENTS.filter(a => this.isUnlocked(a.id)).length; },
};

// =============================================================
// DAILY CHALLENGE — Seeded puzzle, same board for everyone each day
// =============================================================

/**
 * Mulberry32 seeded PRNG — deterministic 32-bit pseudo-random.
 * Given the same seed, produces the same sequence every time.
 * @param {number} seed — 32-bit integer seed
 * @returns {() => number} function returning [0, 1) floats
 */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Daily Challenge persistence + seeding layer.
 * Uses the current UTC date as a seed so every player gets the same grid.
 * Tracks today's best score and completion state via SafeStorage.
 */
const DailyChallenge = {
  /** @returns {string} UTC date key, e.g. '2026-04-08' */
  todayKey() {
    return new Date().toISOString().slice(0, 10);
  },

  /** @returns {number} deterministic seed from today's date */
  todaySeed() {
    const key = this.todayKey();
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = Math.imul(31, h) + key.charCodeAt(i) | 0;
    }
    return h;
  },

  /** @returns {() => number} seeded PRNG for today's grid */
  createRng() {
    return mulberry32(this.todaySeed());
  },

  /** @returns {number} today's best score (0 if unplayed) */
  bestScore() {
    return SafeStorage.getInt(SK.DAILY(this.todayKey()), 0);
  },

  /** Save score if it beats today's record. @returns {boolean} true if new daily best */
  saveScore(score) {
    const key = SK.DAILY(this.todayKey());
    const prev = SafeStorage.getInt(key, 0);
    if (score > prev) {
      SafeStorage.set(key, score.toString());
      return true;
    }
    return false;
  },

  /** @returns {boolean} true if player has completed today's challenge */
  isCompleted() {
    return this.bestScore() > 0;
  },

  /** @returns {number} total daily challenges completed (lifetime) */
  totalCompleted() {
    return SafeStorage.getInt(SK.DAILY_TOTAL, 0);
  },

  /** Increment the lifetime daily challenge counter. */
  incrementTotal() {
    const prev = SafeStorage.getInt(SK.DAILY_TOTAL, 0);
    SafeStorage.set(SK.DAILY_TOTAL, (prev + 1).toString());
  },

  /** @returns {string} formatted display date, e.g. 'APR 8' */
  displayDate() {
    const d = new Date();
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  },
};

/** Calculate performance grade from score and best streak. */
function getGrade(score, bestStreak) {
  for (const g of GRADES) {
    if (score >= g.minScore && bestStreak >= g.minStreak) return g;
  }
  return { grade: 'F', minScore: 0, minStreak: 0, color: P.muted, label: 'TRY AGAIN' };
}

// =============================================================
// SHARED HELPERS
// =============================================================

/** Resolve the highest streak level reached for a given streak count. */
function getStreakLevel(streak) {
  let best = null;
  for (const level of STREAK_LEVELS) {
    if (streak >= level.min) best = level;
  }
  return best;
}

/** Resolve the ad-lib tier key for a given streak count. */
function getAdlibTier(streak) {
  let best = 3;
  for (const key of Object.keys(ADLIBS)) {
    const k = Number(key);
    if (streak >= k && k > best) best = k;
  }
  return best;
}

/**
 * Safe division — returns fallback when divisor is zero, NaN, or result is non-finite.
 * Centralises the defensive pattern used across scoring and stats display.
 * @param {number} numerator
 * @param {number} divisor
 * @param {number} [fallback=0]
 * @returns {number}
 */
function safeDiv(numerator, divisor, fallback = 0) {
  if (!divisor || !Number.isFinite(divisor)) return fallback;
  const result = numerator / divisor;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Clamp a value to a safe, finite, non-negative number.
 * Prevents NaN / Infinity from propagating through the scoring pipeline.
 * @param {number} n
 * @param {number} [max=999999999]
 * @returns {number}
 */
function safeScore(n, max = 999999999) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/**
 * Scan the grid along one axis for consecutive same-color runs.
 * @param {Array[]} grid        — 2D grid of bubbles
 * @param {number}  outerLen    — outer loop bound (rows for horizontal, cols for vertical)
 * @param {number}  innerLen    — inner loop bound (cols for horizontal, rows for vertical)
 * @param {Function} cellAt     — (outer, inner) => grid cell
 * @param {Function} coordOf    — (outer, inner) => { r, c }
 * @returns {Set<string>} matched coordinate keys ("r,c")
 */
function scanRuns(grid, outerLen, innerLen, cellAt, coordOf) {
  const matched = new Set();
  for (let o = 0; o < outerLen; o++) {
    for (let i = 0; i <= innerLen - MIN_MATCH; i++) {
      const color = cellAt(o, i)?.getData('colorIdx');
      if (color === undefined) continue;
      const run = [coordOf(o, i)];
      for (let k = 1; i + k < innerLen; k++) {
        if (cellAt(o, i + k)?.getData('colorIdx') === color) run.push(coordOf(o, i + k));
        else break;
      }
      if (run.length >= MIN_MATCH) run.forEach(p => matched.add(`${p.r},${p.c}`));
    }
  }
  return matched;
}

// =============================================================
// TEXT STYLE PRESETS
// =============================================================

/**
 * Named typography presets — single source of truth for all text styles.
 * Each preset captures a recurring visual pattern (heading, label, etc.)
 * so individual add.text() calls stay lean and consistent.
 */
const TEXT_PRESETS = {
  /** Bold stroked heading — titles, section headers, milestone banners */
  heading:  { fontFamily: UI_FONT, fontStyle: 'bold', stroke: P.bg, strokeThickness: 4, fontSize: '28px', color: P.ink },
  /** Stats row — centered muted text for stat summaries */
  stat:     { fontFamily: UI_FONT, fontSize: '14px', color: P.text2, align: 'center' },
  /** Tiny uppercase label — stat keys, captions */
  label:    { fontFamily: UI_FONT, fontSize: '10px', color: P.muted, letterSpacing: 2 },
  /** Subtle secondary text — credits, sub-values, skip links */
  muted:    { fontFamily: UI_FONT, fontSize: '12px', color: P.faint },
  /** Prominent score/value — bold, gold, stroked */
  accent:   { fontFamily: UI_FONT, fontStyle: 'bold', fontSize: '20px', color: P.hot, stroke: P.bg, strokeThickness: 3 },
  /** Body / description — readable, muted, wrappable */
  body:     { fontFamily: UI_FONT, fontSize: '14px', color: P.text2, align: 'center', lineSpacing: 6 },
  /** Floating score/power-up popup — bold, heavy stroke */
  popup:    { fontFamily: UI_FONT, fontStyle: 'bold', stroke: P.bg, strokeThickness: 4 },
  /** Badge — small bold accent with light stroke */
  badge:    { fontFamily: UI_FONT, fontSize: '13px', fontStyle: 'bold', stroke: P.bg, strokeThickness: 2 },
};

/**
 * Build a Phaser text style object from a named preset + optional overrides.
 * Eliminates repeated fontFamily / stroke / fontStyle boilerplate.
 * @param {string} preset — key in TEXT_PRESETS
 * @param {object} [overrides] — per-call property overrides
 * @returns {object} merged style config for this.add.text()
 */
function textStyle(preset, overrides) {
  const base = TEXT_PRESETS[preset];
  if (!base) throw new Error(`Unknown text preset: "${preset}"`);
  return overrides ? { ...base, ...overrides } : { ...base };
}

// =============================================================
// SHARED UI UTILITIES
// =============================================================

/**
 * Draw the dark grid background shared by TitleScene and GameScene.
 * Renders a deep navy fill overlaid with a subtle grid of thin lines.
 * @param {Phaser.Scene} scene — target scene
 * @returns {Phaser.GameObjects.Graphics} the background graphics object
 */
function drawDarkGridBg(scene) {
  const { width, height } = VIEW;
  const bg = scene.add.graphics().setDepth(-20);
  bg.fillStyle(P.bgN, 1);
  bg.fillRect(0, 0, width, height);
  // Notebook dots, as on the app's pages.
  bg.fillStyle(P.inkN, P.inkIsLight ? 0.12 : 0.1);
  for (let x = 11; x < width; x += 22) for (let y = 11; y < height; y += 22) bg.fillRect(x, y, 1.4, 1.4);
  return bg;
}

/**
 * Toolbar icon-button factory — square icon buttons for the in-game HUD.
 * Eliminates per-button bg/stroke/hitzone duplication in GameScene.create().
 * @param {Phaser.Scene} scene
 * @param {object} opts - { x, y, size, iconFn, callback, depth }
 * @returns {{ bg: Phaser.GameObjects.Graphics, hit: Phaser.GameObjects.Rectangle }}
 */
function createToolbarBtn(scene, opts) {
  const { x, y, size = 36, iconFn, callback, depth = 40 } = opts;
  const half = size / 2;

  const bg = scene.add.graphics();
  const draw = (down) => {
    bg.clear();
    const dy = down ? 3 : 0;
    if (!down) { bg.fillStyle(P.inkN, 1); bg.fillRoundedRect(x - half, y - half + 3, size, size, 10); }
    bg.fillStyle(P.cardN, 1);
    bg.fillRoundedRect(x - half, y - half + dy, size, size, 10);
    bg.lineStyle(2.5, P.inkN, 1);
    bg.strokeRoundedRect(x - half, y - half + dy, size, size, 10);
  };
  draw(false);
  bg.setDepth(depth);

  let icon = null;
  if (iconFn) {
    icon = iconFn(scene, x, y);
    if (icon) icon.setDepth(depth + 1);
  }

  const hit = scene.add.rectangle(x, y, size + 6, size + 6)
    .setInteractive().setAlpha(0.001).setDepth(depth + 2);
  if (callback) hit.on('pointerdown', () => { draw(true); scene.time.delayedCall(110, () => draw(false)); callback(); });

  return { bg, icon, hit };
}

/**
 * Mute toggle factory — shared icon-swap + toggle logic for any scene.
 * Eliminates the duplicated drawMuteBtn / drawMuteIcon closures that
 * existed independently in TitleScene and GameScene.
 *
 * @param {Phaser.Scene} scene — target scene
 * @param {number} x — icon center X
 * @param {number} y — icon center Y
 * @param {object} [opts]
 * @param {number} [opts.size=18]       — icon size
 * @param {number} [opts.onColor=P.mutedN]  — color when unmuted
 * @param {number} [opts.offColor=P.mutedN] — color when muted
 * @param {number|null} [opts.depth=null]   — explicit depth (null = default)
 * @returns {{ update: (muted: boolean) => void }}
 */
function createMuteToggle(scene, x, y, opts = {}) {
  const { size = 18, onColor = P.mutedN, offColor = P.mutedN, depth = null } = opts;
  let iconGfx = null;

  const update = (muted) => {
    if (iconGfx) iconGfx.destroy();
    iconGfx = muted
      ? Icons.soundOff(scene, x, y, size, offColor)
      : Icons.sound(scene, x, y, size, onColor);
    if (depth !== null) iconGfx.setDepth(depth);
  };

  update(window.audioEngine.muted);
  return { update };
}

/**
 * Unified button factory — replaces 3 duplicated button methods.
 * @param {Phaser.Scene} scene
 * @param {object} opts - { x, y, width, height, text, subtext, color, iconFn, callback, container, radius }
 */
function createButton(scene, opts) {
  const {
    x, y, width: w, height: h, text, subtext,
    color, iconFn, callback,
    container, radius = 12,
  } = opts;
  const bg = scene.add.graphics();
  const drawBg = (down, hot) => {
    bg.clear();
    const dy = down ? 3 : 0;
    if (!down) { bg.fillStyle(P.inkN, 1); bg.fillRoundedRect(x - w / 2, y - h / 2 + 4, w, h, radius); }
    bg.fillStyle(hot ? P.hotN : P.cardN, 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2 + dy, w, h, radius);
    bg.lineStyle(3, P.inkN, 1);
    bg.strokeRoundedRect(x - w / 2, y - h / 2 + dy, w, h, radius);
  };
  // A button can ask to be the loud one (the accent fill); its label then reads on the accent.
  const loud = color === 'hot';
  drawBg(false, loud);
  if (container) container.add(bg);

  // Text colour: the ink on a card; on the accent fill, whichever of ink or ground reads.
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  const onCard = P.inkIsLight ? P.ink : P.ink; // the card is chosen so the ink always reads on it
  const label0 = loud ? (lum(P.hot) > 0.55 ? '#0a0a0a' : '#ffffff') : onCard;
  const icons = [];
  if (iconFn) {
    const icon = iconFn(scene, x - w / 2 + (subtext ? 30 : 25), y - (subtext ? 4 : 0));
    if (container && icon) container.add(icon);
    icons.push(icon);
  }

  const textOffset = iconFn ? (subtext ? 12 : 8) : 0;
  const label = scene.add.text(x + textOffset, y - (subtext ? 8 : 0), text, {
    fontSize: subtext ? '19px' : '17px', fontFamily: UI_FONT,
    fontStyle: 'bold', color: label0,
  }).setOrigin(0.5);
  if (container) container.add(label);

  let sub = null;
  if (subtext) {
    sub = scene.add.text(x + textOffset, y + 13, subtext, {
      fontSize: '11px', fontFamily: UI_FONT, color: loud ? label0 : P.muted,
    }).setOrigin(0.5);
    if (container) container.add(sub);
  }

  const hitZone = scene.add.rectangle(x, y, w, h).setInteractive()
    .setAlpha(0.001);
  if (container) hitZone.setDepth(101);
  if (container) container.add(hitZone);

  const press = (down) => {
    drawBg(down, loud);
    const dy = down ? 3 : 0;
    label.y = y - (subtext ? 8 : 0) + dy;
    if (sub) sub.y = y + 13 + dy;
    icons.forEach((ic) => { if (ic && ic.setY) ic.y = dy; });
  };
  hitZone.on('pointerdown', () => { press(true); scene.time.delayedCall(90, () => press(false)); callback(); });
  hitZone.on('pointerout', () => press(false));
}

const TIPS = [
  'Swipe a bubble to swap it, or tap two neighbours',
  'Line up 3 or more of one colour',
  'Chain reactions keep your streak alive',
  'Match 4 in a row to make a LINE CLEAR',
  'Match 5 in a row to make a BOMB (3x3 area)',
  'An L or T match makes a COLOR NUKE',
  'Streaks multiply your score',
  'Streaks bring the crew in: 3x, 5x, 8x, then everyone at 12x',
  'Match low on the board to set up cascades',
  'In Timed mode, keep moving',
  'Power-up bubbles fire when matched',
  'No moves left? The board shuffles for free',
];

// =============================================================
// BOOT SCENE
// =============================================================
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    const S = BUBBLE_SIZE;
    const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
    // A doodle bubble: flat colour, ink outline, a hard under-shadow on light themes, a white glint.
    const drawBubble = (ctx, hex, symbol) => {
      const cx = S / 2, cy = S / 2 - 1.2, r = S / 2 - 3.2;
      if (!P.inkIsLight) { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(cx, cy + 2.6, r + 1, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx, cy + 2.2, r + 1, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Under-curve shade
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.arc(cx + 3, cy + 5, r, 0, Math.PI * 2); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
      ctx.restore();
      ctx.lineWidth = 2.6; ctx.strokeStyle = P.ink; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      // Glint
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, r - 5, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx - r * 0.5, cy - r * 0.18, 1.5, 0, Math.PI * 2); ctx.fill();
      if (symbol) symbol(ctx, cx, cy + 1, 7, lum(hex) > 0.55 ? '#0a0a0a' : '#ffffff');
    };
    // Colourblind symbols: one distinct shape per colour, drawn on top.
    const SYMBOLS = [
      (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.7, y); c.closePath(); c.fill(); },
      (c, x, y, s, col) => { c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y + s); c.moveTo(x + s, y - s); c.lineTo(x - s, y + s); c.stroke(); },
      (c, x, y, s, col) => { c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(x, y, s * 0.85, 0, Math.PI * 2); c.stroke(); },
      (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y + s * 0.7); c.lineTo(x - s, y + s * 0.7); c.closePath(); c.fill(); },
      (c, x, y, s, col) => { c.fillStyle = col; c.fillRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4); },
      (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; const rr = i % 2 === 0 ? s : s * 0.45; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); },
    ];
    P.bubbles.forEach((hex, i) => {
      crispTexture(this, `bubble_${i}`, S, S, (ctx) => drawBubble(ctx, hex, null));
      crispTexture(this, `bubble_cb_${i}`, S, S, (ctx) => drawBubble(ctx, hex, SYMBOLS[i]));
    });
    crispTexture(this, 'particle', 8, 8, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(4, 4, 3.6, 0, Math.PI * 2); c.fill(); });
    crispTexture(this, 'star', 14, 14, (c) => {
      c.fillStyle = '#fff'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 3.2 : 7; c[i ? 'lineTo' : 'moveTo'](7 + Math.cos(a) * r, 7 + Math.sin(a) * r); }
      c.closePath(); c.fill();
    });
    crispTexture(this, 'conf', 8, 5, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 8, 5); });
    crispTexture(this, 'ring', 64, 64, (c) => { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 28, 0, Math.PI * 2); c.stroke(); });

    this.scene.start('TitleScene');
  }
}

// =============================================================
// TITLE SCENE
// =============================================================
class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    setupScene(this);
    const { width, height } = VIEW;
    this.reduce = REDUCE_MOTION;
    drawDarkGridBg(this);

    // Drifting bubbles behind everything.
    for (let i = 0; i < 12; i++) {
      const bx = Phaser.Math.Between(20, width - 20);
      const by = Phaser.Math.Between(40, height - 40);
      const bubble = this.add.image(bx, by, bubbleKey(Phaser.Math.Between(0, COLORS.length - 1)));
      bubble.setAlpha(0.22).setScale(Phaser.Math.FloatBetween(0.5, 1.0) * BS).setDepth(-3);
      if (!this.reduce) this.tweens.add({ targets: bubble, y: by + Phaser.Math.Between(-24, 24), x: bx + Phaser.Math.Between(-16, 16), duration: Phaser.Math.Between(3000, 6000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Logo: a sticker, like the app's.
    this.add.text(width / 2, 52, "WHAT'S", textStyle('heading', { fontSize: '34px', color: P.ink, stroke: P.bg, strokeThickness: 0 })).setOrigin(0.5);
    const pop = this.add.text(width / 2, 104, 'POPPIN', textStyle('heading', { fontSize: '68px', color: P.hot, stroke: P.ink, strokeThickness: 8 })).setOrigin(0.5);
    if (!this.reduce) this.tweens.add({ targets: pop, scale: 1.04, angle: -1.5, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(width / 2, 154, 'match bubbles  /  build streaks  /  meet the crew', textStyle('label', { fontSize: '11px', letterSpacing: 1, color: P.muted })).setOrigin(0.5);

    // The cast waits on a little stage.
    const sx = 10, sy = 172, sw = width - 20, sh = 190;
    const stage = this.add.graphics();
    stage.fillStyle(P.inkN, 1); stage.fillRoundedRect(sx, sy + 4, sw, sh, 14);
    stage.fillStyle(P.panelN, 1); stage.fillRoundedRect(sx, sy, sw, sh, 14);
    stage.lineStyle(3, P.inkN, 1); stage.strokeRoundedRect(sx, sy, sw, sh, 14);
    const gy = sy + sh - 26;
    stage.fillStyle(P.inkN, 0.55);
    for (let x = sx + 14; x < sx + sw - 10; x += 9) stage.fillRect(x, gy + 1, 3, 2);
    this.cast = new Cast(this, sx, sy, sw, sh);
    this.cast.hero.setPose('wave', 200); this.cast.hero.setFace('grin');
    this.cast.pro.setPose('present', 200); this.cast.pro.setFace('smug');
    this.cast.bolt.setPose('cheer', 200); this.cast.bolt.setFace('grin');
    this.cast.spark.setPose('hips', 200);
    this.cast.revert = 0;
    this.time.addEvent({ delay: 2600, loop: true, callback: () => { const m = Phaser.Math.RND.pick(this.cast.members); m.hop(1); } });

    // Buttons: three modes, then two small ones.
    const bw = width - 60, bh = 54, x = width / 2;
    let y = 410;
    createButton(this, { x, y, width: bw, height: bh, text: 'TIMED MODE', subtext: '90 seconds. Chase the high score.', color: 'hot', callback: () => this.scene.start('GameScene', { mode: 'timed' }) });
    y += 72;
    createButton(this, { x, y, width: bw, height: bh, text: 'ZEN MODE', subtext: 'No timer. Just pop.', callback: () => this.scene.start('GameScene', { mode: 'zen' }) });
    y += 72;
    const dailyDone = DailyChallenge.isCompleted();
    createButton(this, { x, y, width: bw, height: bh, text: 'DAILY CHALLENGE',
      subtext: dailyDone ? `Best ${DailyChallenge.bestScore().toLocaleString()}. Tap to beat it.` : `${DailyChallenge.displayDate()}. Same board for everyone.`, callback: () => this.scene.start('GameScene', { mode: 'daily' }) });
    y += 72;
    const half = (bw - 12) / 2;
    createButton(this, { x: x - half / 2 - 6, y, width: half, height: 46, text: 'HOW TO PLAY', callback: () => this.scene.start(SafeStorage.get(SK.PLAYED, null) ? 'TipsScene' : 'TutorialScene') });
    createButton(this, { x: x + half / 2 + 6, y, width: half, height: 46, text: 'YOUR STATS', callback: () => this.scene.start('StatsScene') });

    // Best score line, or the run sparkline.
    const highScore = SafeStorage.getInt(SK.HIGH_SCORE, 0);
    const hasHistory = typeof drawRunSparkline === 'function' && RunHistory.load().length >= 2;
    if (hasHistory) drawRunSparkline(this, width / 2, 640, width - 80, 50);
    else if (highScore > 0) this.add.text(width / 2, 650, `HIGH SCORE ${highScore.toLocaleString()}`, textStyle('accent', { fontSize: '20px', strokeThickness: 0, color: P.ink })).setOrigin(0.5);

    // Footer row: colour-blind toggle left, sound right, both clear of the buttons.
    const fy = height - 52;
    const mute = createMuteToggle(this, width - 34, fy, { onColor: P.inkN });
    const muteHit = this.add.rectangle(width - 34, fy, 44, 44).setInteractive().setAlpha(0.001);
    muteHit.on('pointerdown', () => { window.audioEngine.init(); window.audioEngine.resume(); mute.update(window.audioEngine.toggleMute()); });
    const cbOn = SafeStorage.get(SK.COLORBLIND, '0') === '1';
    Icons.a11y(this, 34, fy - 6, 18, cbOn ? P.hotN : P.mutedN);
    this.add.text(34, fy + 12, cbOn ? 'SHAPES ON' : 'SHAPES OFF', textStyle('label', { fontSize: '7px', letterSpacing: 1, color: cbOn ? P.hot : P.muted })).setOrigin(0.5);
    const cbHit = this.add.rectangle(34, fy, 44, 44).setInteractive().setAlpha(0.001);
    cbHit.on('pointerdown', () => { SafeStorage.set(SK.COLORBLIND, cbOn ? '0' : '1'); this.scene.restart(); });
    this.add.text(width / 2, fy + 4, `${P.name} theme`, textStyle('muted', { fontSize: '11px', color: P.muted })).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      window.audioEngine.init(); window.audioEngine.resume(); window.audioEngine.restoreMuteState(); mute.update(window.audioEngine.muted);
    });
  }

  update(time, delta) { if (this.cast) this.cast.update(time, delta); }
}

// =============================================================
// GAME OVER SCENE
// =============================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create(data) {
    setupScene(this);
    const { width, height } = VIEW;
    this.reduce = REDUCE_MOTION;
    const safe = data || {};
    const score = Number.isFinite(safe.score) ? safe.score : 0;
    const bestStreak = Number.isFinite(safe.bestStreak) ? safe.bestStreak : 0;
    const moves = Number.isFinite(safe.moves) ? safe.moves : 0;
    const isNewHigh = !!safe.isNewHigh;
    const mode = GameScene.VALID_MODES.has(safe.mode) ? safe.mode : 'timed';
    const feverCount = Number.isFinite(safe.feverCount) ? safe.feverCount : 0;
    const bestChain = Number.isFinite(safe.bestChain) ? safe.bestChain : 0;
    const gradeInfo = getGrade(score, bestStreak);
    const good = gradeInfo.grade === 'S' || gradeInfo.grade === 'A' || gradeInfo.grade === 'B' || isNewHigh;

    drawDarkGridBg(this);

    // Title sticker
    const goLabel = mode === 'daily' ? 'DAILY DONE' : mode === 'zen' ? 'NICE SESSION' : 'TIME\'S UP';
    const goText = this.add.text(width / 2, 46, goLabel,
      textStyle('heading', { fontSize: '44px', color: P.hot, stroke: P.ink, strokeThickness: 7 })).setOrigin(0.5).setScale(0);
    this.tweens.add({ targets: goText, scale: 1, duration: 450, ease: 'Back.easeOut' });

    // Cast on the stage, reacting to the result.
    const sx = 10, sy = 84, sw = width - 20, sh = 190;
    const stage = this.add.graphics();
    stage.fillStyle(P.inkN, 1); stage.fillRoundedRect(sx, sy + 4, sw, sh, 14);
    stage.fillStyle(P.panelN, 1); stage.fillRoundedRect(sx, sy, sw, sh, 14);
    stage.lineStyle(3, P.inkN, 1); stage.strokeRoundedRect(sx, sy, sw, sh, 14);
    const gy = sy + sh - 26;
    stage.fillStyle(P.inkN, 0.55);
    for (let x = sx + 14; x < sx + sw - 10; x += 9) stage.fillRect(x, gy + 1, 3, 2);
    this.cast = new Cast(this, sx, sy, sw, sh);
    this.cast.finish(good);
    if (good) this.time.addEvent({ delay: 900, loop: true, callback: () => this.cast.members.forEach((m, i) => this.time.delayedCall(i * 90, () => m.hop(1.2))) });

    // Score card
    const cardY = 296, cardH = 188;
    const card = this.add.graphics();
    card.fillStyle(P.inkN, 1); card.fillRoundedRect(20, cardY + 4, width - 40, cardH, 16);
    card.fillStyle(P.cardN, 1); card.fillRoundedRect(20, cardY, width - 40, cardH, 16);
    card.lineStyle(3, P.inkN, 1); card.strokeRoundedRect(20, cardY, width - 40, cardH, 16);

    this.add.text(width / 2, cardY + 22, 'FINAL SCORE', textStyle('label', { fontSize: '11px', letterSpacing: 3, color: P.muted })).setOrigin(0.5);
    const scoreText = this.add.text(width / 2, cardY + 62, '0', textStyle('popup', { fontSize: '52px', color: P.ink, strokeThickness: 0 })).setOrigin(0.5);
    this.tweens.addCounter({
      from: 0, to: score, duration: this.reduce ? 1 : 1400, delay: 400, ease: 'Quad.easeOut',
      onUpdate: (tw) => scoreText.setText(Math.floor(tw.getValue()).toLocaleString()),
      onComplete: () => { scoreText.setText(score.toLocaleString()); if (!this.reduce) this.tweens.add({ targets: scoreText, scale: 1.18, duration: 120, yoyo: true }); },
    });
    if (isNewHigh) {
      const badge = this.add.text(width / 2, cardY + 98, 'NEW HIGH SCORE', textStyle('badge', { fontSize: '16px', color: P.hot, stroke: '', strokeThickness: 0, letterSpacing: 2 })).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: badge, alpha: 1, duration: 300, delay: 1700 });
      if (!this.reduce) this.tweens.add({ targets: badge, scale: 1.06, duration: 700, yoyo: true, repeat: -1, delay: 2000 });
    }

    const stats = [{ l: 'MOVES', v: `${moves}` }, { l: 'BEST STREAK', v: `${bestStreak}×` }, { l: 'AVG / MOVE', v: `${Math.round(safeDiv(score, moves))}` }, { l: 'BEST CHAIN', v: `×${Math.max(1, bestChain)}` }];
    if (feverCount > 0) stats.push({ l: 'FEVERS', v: `${feverCount}` });
    const colW = (width - 70) / stats.length;
    stats.forEach((s, i) => {
      const cx = 35 + colW * (i + 0.5);
      this.add.text(cx, cardY + 134, s.v, textStyle('heading', { fontSize: '22px', color: P.ink, strokeThickness: 0 })).setOrigin(0.5);
      this.add.text(cx, cardY + 160, s.l, textStyle('label', { fontSize: '8px', letterSpacing: 1, color: P.muted })).setOrigin(0.5);
    });

    // Grade stamp, slammed on after the score lands.
    const gradeY = cardY + cardH + 52;
    const stamp = this.add.container(width / 2, gradeY).setScale(0).setAngle(-10);
    const ring = this.add.graphics();
    ring.fillStyle(P.inkN, 1); ring.fillCircle(0, 4, 42);
    ring.fillStyle(gradeInfo.grade === 'S' || gradeInfo.grade === 'A' ? P.hotN : P.cardN, 1); ring.fillCircle(0, 0, 42);
    ring.lineStyle(3, P.inkN, 1); ring.strokeCircle(0, 0, 42);
    const fillHex = gradeInfo.grade === 'S' || gradeInfo.grade === 'A' ? P.hot : P.card;
    const fn = parseInt(fillHex.slice(1), 16);
    const light = (0.2126 * ((fn >> 16) & 255) + 0.7152 * ((fn >> 8) & 255) + 0.0722 * (fn & 255)) / 255 > 0.55;
    const letter = this.add.text(0, -2, gradeInfo.grade, textStyle('heading', { fontSize: '52px', color: light ? '#0a0a0a' : '#ffffff', strokeThickness: 0 })).setOrigin(0.5);
    stamp.add([ring, letter]);
    this.tweens.add({ targets: stamp, scale: 1, angle: -4, duration: 360, delay: this.reduce ? 0 : 1700, ease: 'Back.easeOut',
      onStart: () => { if (!this.reduce) this.cameras.main.shake(120, 0.004); } });
    this.add.text(width / 2, gradeY + 54, `${gradeInfo.label}  ·  ${mode.toUpperCase()}`, textStyle('badge', { fontSize: '13px', color: P.ink, stroke: '', strokeThickness: 0, letterSpacing: 3 })).setOrigin(0.5, 0.5);

    const cheer = good ? 'The crew is proud of that one.' : 'The crew says go again. You were close.';
    this.add.text(width / 2, 626, cheer, textStyle('stat', { fontSize: '14px', color: P.muted, fontStyle: 'italic' })).setOrigin(0.5);
    const gradeKey = SK.BEST_GRADE(mode);
    const prevBest = SafeStorage.get(gradeKey, 'F');
    if ('SABCDF'.indexOf(gradeInfo.grade) < 'SABCDF'.indexOf(prevBest)) SafeStorage.set(gradeKey, gradeInfo.grade);
    if (mode === 'daily') {
      const total = DailyChallenge.totalCompleted();
      if (total > 1) this.add.text(width / 2, gradeY + 76, `${total} dailies completed`, textStyle('label', { fontSize: '10px', color: P.muted })).setOrigin(0.5);
    }

    // Buttons
    const btnW = width - 80, y1 = 664;
    createButton(this, { x: width / 2, y: y1, width: btnW, height: 48, text: 'PLAY AGAIN', color: 'hot',
      iconFn: (s, bx, by) => Icons.play(s, bx, by, 14, P.inkN), callback: () => this.scene.start('GameScene', { mode }) });
    createButton(this, { x: width / 2 - (btnW / 2 - 4) / 2 - 4, y: y1 + 62, width: btnW / 2 - 4, height: 44, text: 'SHARE',
      iconFn: (s, bx, by) => Icons.share(s, bx, by, 14, P.inkN), callback: () => this.shareScore(score, bestStreak, moves, mode, feverCount, bestChain) });
    createButton(this, { x: width / 2 + (btnW / 2 - 4) / 2 + 4, y: y1 + 62, width: btnW / 2 - 4, height: 44, text: 'MENU',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, P.inkN), callback: () => this.scene.start('TitleScene') });

    if (isNewHigh && !this.reduce) {
      this.time.addEvent({ delay: 90, repeat: 34, callback: () => {
        const p = this.add.image(Phaser.Math.Between(0, width), -10, 'conf').setScale(Phaser.Math.FloatBetween(0.8, 1.6) * BS).setDepth(-2);
        p.setTint(Phaser.Math.RND.pick([...P.bubblesN, P.hotN]));
        this.tweens.add({ targets: p, y: height + 20, x: p.x + Phaser.Math.Between(-60, 60), rotation: Phaser.Math.FloatBetween(-6, 6), duration: Phaser.Math.Between(1500, 2800), onComplete: () => p.destroy() });
      } });
    }
  }

  update(time, delta) { if (this.cast) this.cast.update(time, delta); }

  shareScore(score, bestStreak, moves, mode, feverCount, bestChain) {
    // Use distinct names to avoid shadowing the module-level safeScore() function
    const cleanScore = Number.isFinite(score) ? score : 0;
    const cleanStreak = Number.isFinite(bestStreak) ? bestStreak : 0;
    const cleanMoves = Number.isFinite(moves) ? moves : 0;
    const cleanChain = Number.isFinite(bestChain) ? bestChain : 0;
    const tierLevel = getStreakLevel(cleanStreak);
    const tierLabel = tierLevel ? ` — ${tierLevel.label}` : '';
    const modeLabel = mode === 'daily' ? `Daily (${DailyChallenge.displayDate()})` : mode === 'zen' ? 'Zen' : 'Timed';
    const avgPerMove = Math.round(safeDiv(cleanScore, cleanMoves));

    const gradeInfo = getGrade(cleanScore, cleanStreak);
    const feverLine = feverCount > 0 ? `Fevers: ${feverCount} 🔥\n` : '';
    const chainLine = cleanChain >= 2 ? `Best Chain: ×${cleanChain}\n` : '';
    const card = [
      `WHAT'S POPPIN`,
      `━━━━━━━━━━━━━━━━━`,
      `Grade: ${gradeInfo.grade} — ${gradeInfo.label}`,
      `Score: ${cleanScore.toLocaleString()}`,
      `Best Streak: ${cleanStreak}x${tierLabel}`,
      `Moves: ${cleanMoves}  |  Avg: ${avgPerMove}/move`,
      chainLine + feverLine + `Mode: ${modeLabel}`,
      `━━━━━━━━━━━━━━━━━`,
      `#WhatsPoppin`,
    ].join('\n');

    // Try Web Share API first (mobile), fall back to clipboard
    if (navigator.share) {
      navigator.share({ title: "What's Poppin Score", text: card }).catch(() => {});
      this.showToast('Shared!');
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(card).then(
        () => this.showToast('Copied to clipboard!'),
        () => this.showToast('Could not copy')
      );
    } else {
      this.showToast('Sharing not available');
    }
  }

  showToast(message) {
    const { width, height } = VIEW;
    const bg = this.add.graphics().setDepth(60);
    bg.fillStyle(P.inkN, 0.9);
    bg.fillRoundedRect(width / 2 - 100, height - 50, 200, 32, 8);
    const text = this.add.text(width / 2, height - 34, message, {
      fontSize: '14px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: P.ink,
    }).setOrigin(0.5).setDepth(61);

    this.tweens.add({
      targets: [bg, text], alpha: 0, y: '-=20',
      duration: 600, delay: 1200, ease: 'Quad.easeIn',
      onComplete: () => { bg.destroy(); text.destroy(); },
    });
  }
}

// =============================================================
// TUTORIAL SCENE — Interactive walkthrough
// =============================================================
class TutorialScene extends Phaser.Scene {
  constructor() { super({ key: 'TutorialScene' }); }

  create() {
    setupScene(this);
    const { width, height } = VIEW;
    this.stepIndex = 0;

    const bg = this.add.graphics();
    bg.fillStyle(P.bgN, 1);
    bg.fillRect(0, 0, width, height);

    const steps = [
      {
        title: 'SWAP BUBBLES',
        desc: 'Swipe a bubble in any direction to swap it with its neighbor.\n\nOr tap one bubble, then tap an adjacent one.',
        draw: (scene) => {
          // Draw two bubbles with an arrow between them
          const cx = width / 2;
          const cy = height * 0.45;
          const b1 = scene.add.image(cx - 35, cy, 'bubble_0').setScale(1.2 * BS);
          const b2 = scene.add.image(cx + 35, cy, 'bubble_3').setScale(1.2 * BS);
          // Animated arrow
          const arrow = scene.add.graphics();
          arrow.lineStyle(3, 0xffffff, 0.8);
          arrow.lineBetween(cx - 10, cy, cx + 10, cy);
          arrow.fillStyle(0xffffff, 0.8);
          arrow.fillTriangle(cx + 10, cy - 5, cx + 10, cy + 5, cx + 18, cy);
          scene.tweens.add({
            targets: [b1, b2, arrow], alpha: 0.5,
            duration: 800, yoyo: true, repeat: -1,
          });
          return [b1, b2, arrow];
        }
      },
      {
        title: 'MATCH 3+',
        desc: 'Line up 3 or more bubbles of the same color in a row or column to pop them.',
        draw: (scene) => {
          const cx = width / 2;
          const cy = height * 0.45;
          const bubbles = [];
          for (let i = 0; i < 3; i++) {
            const b = scene.add.image(cx - 50 + i * 50, cy, 'bubble_1').setScale(1.1 * BS);
            bubbles.push(b);
          }
          // Highlight glow
          const glow = scene.add.graphics();
          glow.lineStyle(2, 0xffffff, 0.6);
          glow.strokeRoundedRect(cx - 80, cy - 28, 160, 56, 8);
          scene.tweens.add({
            targets: glow, alpha: 0.2, duration: 600, yoyo: true, repeat: -1,
          });
          bubbles.push(glow);
          return bubbles;
        }
      },
      {
        title: 'POWER-UPS',
        desc: 'Match 4 = Line Clear\nMatch 5+ = Bomb\nL or T shape = Color Nuke\n\nPower-up bubbles glow in the grid. Match them to activate.',
        draw: (scene) => {
          const cx = width / 2;
          const cy = height * 0.42;
          const items = [];
          // Draw 4 in a row
          for (let i = 0; i < 4; i++) {
            items.push(scene.add.image(cx - 72 + i * 48, cy, 'bubble_4').setScale(0.9 * BS));
          }
          // Arrow pointing to power-up result
          const arrow = scene.add.graphics();
          arrow.lineStyle(2, 0xffffff, 0.5);
          arrow.lineBetween(cx + 60, cy, cx + 80, cy);
          arrow.fillStyle(0xffffff, 0.5);
          arrow.fillTriangle(cx + 80, cy - 4, cx + 80, cy + 4, cx + 86, cy);
          items.push(arrow);
          // Result bubble with overlay
          const result = scene.add.image(cx + 105, cy, 'bubble_4').setScale(1.1 * BS);
          items.push(result);
          scene.tweens.add({
            targets: result, scale: 1.3 * BS, duration: 800, yoyo: true, repeat: -1,
          });
          return items;
        }
      },
      {
        title: 'STREAKS',
        desc: 'Keep matching without missing to build a streak.\n\nHigher streaks = bigger multiplier = more points.\n\nCharacters appear at 3x, 5x, 8x, and 12x streaks.',
        draw: (scene) => {
          const cx = width / 2;
          const cy = height * 0.44;
          const items = [];
          const labels = ['3x NICE', '5x FIRE', '8x GODLIKE', '12x LEGENDARY'];
          const colors = [P.ink, P.hot, P.hot, P.hot];
          labels.forEach((label, i) => {
            const t = scene.add.text(cx, cy - 30 + i * 28, label, {
              fontSize: '16px', fontFamily: UI_FONT,
              fontStyle: 'bold', color: colors[i],
              stroke: P.bg, strokeThickness: 2,
            }).setOrigin(0.5);
            items.push(t);
          });
          return items;
        }
      },
      {
        title: 'YOU\'RE READY',
        desc: 'Start with Zen Mode to practice, or jump into Timed Mode for the challenge.\n\nChase high scores and watch the crew cheer you on.',
        draw: () => []
      }
    ];

    // Step container
    this.stepContainer = this.add.container(0, 0);
    this.stepObjects = [];

    // Progress dots
    this.dots = [];
    const dotY = height * 0.08;
    steps.forEach((_, i) => {
      const dot = this.add.graphics();
      dot.fillStyle(i === 0 ? P.hotN : P.faintN, 1);
      dot.fillCircle(width / 2 - (steps.length - 1) * 10 + i * 20, dotY, 4);
      this.dots.push(dot);
    });

    const renderStep = (idx) => {
      // Clear previous
      this.stepObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
      this.stepObjects = [];

      const step = steps[idx];

      const title = this.add.text(width / 2, height * 0.15, step.title,
        textStyle('heading')).setOrigin(0.5);
      this.stepObjects.push(title);

      const desc = this.add.text(width / 2, height * 0.62, step.desc,
        textStyle('body', { wordWrap: { width: width - 60 } })).setOrigin(0.5, 0);
      this.stepObjects.push(desc);

      const drawn = step.draw(this);
      this.stepObjects.push(...drawn);

      // Update dots
      this.dots.forEach((dot, i) => {
        dot.clear();
        dot.fillStyle(i === idx ? P.hotN : P.faintN, 1);
        dot.fillCircle(width / 2 - (steps.length - 1) * 10 + i * 20, dotY, i === idx ? 5 : 4);
      });
    };

    renderStep(0);

    // Navigation
    const navY = height - 45;

    // Next / Skip buttons
    const nextBg = this.add.graphics();
    const nextW = 140;
    const drawNextBtn = (isLast) => {
      nextBg.clear();
      nextBg.fillStyle(P.cardN, 1);
      nextBg.fillRoundedRect(width / 2 - nextW / 2, navY - 20, nextW, 40, 10);
      nextBg.lineStyle(2, P.hotN, 0.5);
      nextBg.strokeRoundedRect(width / 2 - nextW / 2, navY - 20, nextW, 40, 10);
      this.nextLabel.setText(isLast ? 'LET\'S GO' : 'NEXT');
    };

    this.nextLabel = this.add.text(width / 2, navY, 'NEXT',
      textStyle('accent', { fontSize: '16px', stroke: '', strokeThickness: 0 })).setOrigin(0.5);

    drawNextBtn(false);

    const nextHit = this.add.rectangle(width / 2, navY, nextW, 40).setInteractive().setAlpha(0.001);
    nextHit.on('pointerdown', () => {
      this.stepIndex++;
      if (this.stepIndex >= steps.length) {
        SafeStorage.set(SK.PLAYED, '1');
        this.scene.start('TitleScene');
        return;
      }
      renderStep(this.stepIndex);
      drawNextBtn(this.stepIndex === steps.length - 1);
    });

    // Skip
    const skip = this.add.text(width - 20, 25, 'SKIP',
      textStyle('muted', { fontSize: '13px', color: P.faint })).setOrigin(1, 0).setInteractive();
    skip.on('pointerdown', () => {
      SafeStorage.set(SK.PLAYED, '1');
      this.scene.start('TitleScene');
    });
  }
}

// =============================================================
// TIPS SCENE — How to Play
// =============================================================
class TipsScene extends Phaser.Scene {
  constructor() { super({ key: 'TipsScene' }); }

  create() {
    setupScene(this);
    const { width, height } = VIEW;

    const bg = this.add.graphics();
    bg.fillStyle(P.bgN, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add.text(width / 2, 30, 'HOW TO PLAY', textStyle('heading')).setOrigin(0.5);

    const sections = [
      {
        title: 'CONTROLS',
        color: P.ink,
        items: [
          'Swipe a bubble to swap with its neighbor',
          'Or tap two adjacent bubbles to swap them',
          'Match 3+ same-color bubbles to pop them',
        ]
      },
      {
        title: 'POWER-UPS',
        color: P.hot,
        items: [
          'Match 4 → LINE CLEAR (entire row/column)',
          'Match 5+ → BOMB (3x3 explosion)',
          'L or T shape → COLOR NUKE (all of one color)',
          'Match a power-up bubble to activate it',
        ]
      },
      {
        title: 'STREAKS',
        color: P.hot,
        items: [
          'Chain matches without missing to build streaks',
          'Higher streaks = bigger score multiplier',
          '3x Spark joins in, 5x Pro, 8x Bolt, 12x all four',
        ]
      },
      {
        title: 'FEVER MODE',
        color: P.hot,
        items: [
          'Chain matches to fill the FEVER meter (left bar)',
          'At 100% → FEVER MODE activates (2× score!)',
          'Keep matching during fever to extend the timer',
          'The meter drains when you stop, so keep going',
        ]
      },
      {
        title: 'STRATEGY',
        color: P.ink,
        items: [
          'Match low on the board for more cascades',
          'Save power-ups for chain moments',
          'In Timed mode, speed beats perfection',
        ]
      },
    ];

    let yPos = 70;
    sections.forEach(section => {
      // Section card
      const cardH = 16 + section.items.length * 22 + 10;
      bg.fillStyle(P.panelN, 0.9);
      bg.fillRoundedRect(15, yPos, width - 30, cardH, 10);
      bg.lineStyle(1, Phaser.Display.Color.HexStringToColor(section.color).color, 0.3);
      bg.strokeRoundedRect(15, yPos, width - 30, cardH, 10);

      this.add.text(25, yPos + 8, section.title,
        textStyle('badge', { color: section.color, stroke: '', strokeThickness: 0 }));

      section.items.forEach((item, i) => {
        this.add.text(25, yPos + 28 + i * 22, `•  ${item}`,
          textStyle('muted', { color: P.text2, wordWrap: { width: width - 60 } }));
      });

      yPos += cardH + 8;
    });

    // Back button — uses shared createButton factory
    createButton(this, { x: width / 2, y: height - 40, width: 160, height: 36, radius: 8,
      text: 'BACK', color: P.text2,
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, P.inkN),
      callback: () => this.scene.start('TitleScene'),
    });
  }
}

// =============================================================
// STATS SCENE — Lifetime player stats dashboard
// =============================================================
class StatsScene extends Phaser.Scene {
  constructor() { super({ key: 'StatsScene' }); }

  create() {
    setupScene(this);
    const { width, height } = VIEW;
    drawDarkGridBg(this);

    // Header
    this.add.text(width / 2, height * 0.07, 'YOUR LEGACY',
      textStyle('heading', { color: P.hot })).setOrigin(0.5);

    this.add.text(width / 2, height * 0.12, 'lifetime stats',
      textStyle('muted', { color: P.faint, letterSpacing: 3 })).setOrigin(0.5);

    // Load all stats from SafeStorage
    const stats = {
      gamesTimed: SafeStorage.getInt(SK.GAMES_TIMED, 0),
      gamesZen: SafeStorage.getInt(SK.GAMES_ZEN, 0),
      highScore: SafeStorage.getInt(SK.HIGH_SCORE, 0),
      bestStreak: SafeStorage.getInt(SK.BEST_STREAK, 0),
      totalPops: SafeStorage.getInt(SK.TOTAL_POPS, 0),
      totalScore: SafeStorage.getInt(SK.TOTAL_SCORE, 0),
      gradeTimed: SafeStorage.get(SK.BEST_GRADE('timed'), '—'),
      gradeZen: SafeStorage.get(SK.BEST_GRADE('zen'), '—'),
    };
    stats.totalGames = stats.gamesTimed + stats.gamesZen;

    const cardX = 20;
    const cardW = width - 40;
    const cardTop = height * 0.17;
    const g = this.add.graphics();

    // Main stat card
    g.fillStyle(P.panelN, 1);
    g.fillRoundedRect(cardX, cardTop, cardW, 300, 12);
    g.lineStyle(1.5, P.lineN, 0.6);
    g.strokeRoundedRect(cardX, cardTop, cardW, 300, 12);

    // Stat rows — each with label, value, and animated bar
    const rows = [
      { label: 'GAMES PLAYED', value: stats.totalGames, sub: `${stats.gamesTimed} timed / ${stats.gamesZen} zen`, color: P.ink, max: Math.max(stats.totalGames, 1) },
      { label: 'HIGH SCORE', value: stats.highScore, sub: null, color: P.hot, max: Math.max(stats.highScore, 1) },
      { label: 'TOTAL SCORE', value: stats.totalScore, sub: stats.totalGames > 0 ? `avg ${Math.round(safeDiv(stats.totalScore, stats.totalGames))}/game` : null, color: P.ink, max: Math.max(stats.totalScore, 1) },
      { label: 'BUBBLES POPPED', value: stats.totalPops, sub: stats.totalGames > 0 ? `avg ${Math.round(safeDiv(stats.totalPops, stats.totalGames))}/game` : null, color: P.hot, max: Math.max(stats.totalPops, 1) },
      { label: 'BEST STREAK', value: `${stats.bestStreak}x`, sub: null, color: P.hot, max: Math.max(stats.bestStreak, 1), raw: stats.bestStreak },
    ];

    const rowH = 52;
    const startY = cardTop + 20;
    const barMaxW = cardW - 50;

    rows.forEach((row, i) => {
      const ry = startY + i * rowH;
      const hexColor = Phaser.Display.Color.HexStringToColor(row.color).color;

      // Label
      this.add.text(cardX + 16, ry, row.label, textStyle('label'));

      // Value (animate counting up)
      const numericVal = typeof row.value === 'number' ? row.value : row.raw;
      const valText = this.add.text(cardX + cardW - 16, ry, '0',
        textStyle('accent', { fontSize: '18px', color: row.color, stroke: '', strokeThickness: 0 })).setOrigin(1, 0);

      if (typeof row.value === 'number' && row.value > 0) {
        this.tweens.addCounter({
          from: 0, to: row.value, duration: 1000, delay: 200 + i * 150,
          ease: 'Quad.easeOut',
          onUpdate: (tw) => valText.setText(Math.floor(tw.getValue()).toLocaleString()),
        });
      } else {
        valText.setText(String(row.value));
      }

      // Subtitle
      if (row.sub) {
        this.add.text(cardX + 16, ry + 18, row.sub, textStyle('label', { color: P.faint }));
      }

      // Animated bar
      const barY = ry + 34;
      g.fillStyle(P.cardN, 1);
      g.fillRoundedRect(cardX + 16, barY, barMaxW, 6, 3);

      const bar = this.add.graphics();
      const barW = numericVal > 0 ? barMaxW * 0.85 : 0; // relative fill (capped at 85% for visual)
      bar.fillStyle(hexColor, 0.7);
      bar.fillRoundedRect(cardX + 16, barY, 0, 6, 3);

      if (numericVal > 0) {
        this.tweens.addCounter({
          from: 0, to: barW, duration: 800, delay: 400 + i * 150,
          ease: 'Quad.easeOut',
          onUpdate: (tw) => {
            bar.clear();
            bar.fillStyle(hexColor, 0.7);
            bar.fillRoundedRect(cardX + 16, barY, tw.getValue(), 6, 3);
          },
        });
      }
    });

    // Grade badges at bottom of card
    const badgeY = startY + rows.length * rowH + 8;
    const gradeRank = 'SABCDF—';
    [{ mode: 'TIMED', grade: stats.gradeTimed }, { mode: 'ZEN', grade: stats.gradeZen }].forEach((b, i) => {
      const bx = cardX + cardW * (i === 0 ? 0.25 : 0.75);
      this.add.text(bx, badgeY, b.mode, {
        fontSize: '10px', fontFamily: UI_FONT, color: P.faint, letterSpacing: 2,
      }).setOrigin(0.5);
      const gInfo = GRADES.find(g => g.grade === b.grade) || { color: P.faint };
      const gl = this.add.text(bx, badgeY + 22, b.grade, {
        fontSize: '30px', fontFamily: UI_FONT, fontStyle: 'bold',
        color: gInfo.color || P.faint, stroke: P.bg, strokeThickness: 3,
      }).setOrigin(0.5).setScale(0);
      this.tweens.add({ targets: gl, scale: 1, duration: 400, delay: 800 + i * 200, ease: 'Back.easeOut' });
    });

    // Streak character display
    const tierLevel = getStreakLevel(stats.bestStreak);
    if (tierLevel && window.characters) {
      const char = window.characters[tierLevel.char];
      if (char) {
        const charGfx = this.add.graphics();
        char.draw(charGfx, width - 40, height * 0.07, 0.5);
      }
    }

    // ---- ACHIEVEMENTS SECTION ----
    const achTop = cardTop + 340;
    const unlocked = Achievements.countUnlocked();
    const total = ACHIEVEMENTS.length;

    this.add.text(width / 2, achTop, 'ACHIEVEMENTS',
      textStyle('heading', { fontSize: '20px', color: P.hot })).setOrigin(0.5);
    this.add.text(width / 2, achTop + 24, `${unlocked} / ${total} unlocked`,
      textStyle('muted', { color: unlocked === total ? P.ink : P.faint })).setOrigin(0.5);

    const achStartY = achTop + 48;
    const achColW = (width - 40) / 2;
    ACHIEVEMENTS.forEach((ach, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax = cardX + col * achColW + achColW / 2;
      const ay = achStartY + row * 42;
      const done = Achievements.isUnlocked(ach.id);

      // Dot indicator
      const dot = this.add.graphics();
      dot.fillStyle(done ? Phaser.Display.Color.HexStringToColor(ach.color).color : P.lineN, done ? 0.9 : 0.4);
      dot.fillCircle(ax - achColW / 2 + 12, ay + 6, 5);
      if (done) {
        dot.fillStyle(0xffffff, 0.7);
        dot.fillCircle(ax - achColW / 2 + 12, ay + 5, 1.5);
      }

      // Name + description
      this.add.text(ax - achColW / 2 + 24, ay - 2, ach.name,
        textStyle('badge', { fontSize: '11px', color: done ? ach.color : P.faint, stroke: '', strokeThickness: 0 }));
      this.add.text(ax - achColW / 2 + 24, ay + 12, ach.desc,
        textStyle('label', { fontSize: '8px', color: done ? P.muted : P.faint, letterSpacing: 0 }));
    });

    // Back button
    createButton(this, { x: width / 2, y: height * 0.92, width: width - 60, height: 44, radius: 12,
      text: 'BACK TO MENU', color: P.text2,
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, P.text2N),
      callback: () => this.scene.start('TitleScene'),
    });
  }
}

// =============================================================
// GAME SCENE — Core gameplay
// =============================================================
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  /** @type {ReadonlySet<string>} Allowed game mode values — rejects tampered scene data. */
  static VALID_MODES = Object.freeze(new Set(['timed', 'zen', 'daily']));

  init(data) {
    const rawMode = data?.mode || 'timed';
    this.gameMode = GameScene.VALID_MODES.has(rawMode) ? rawMode : 'timed';
    this.grid = [];
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.isProcessing = false;
    this.selected = null;
    this.moveCount = 0;
    this.timeLeft = GAME_TIME;
    this.gameOver = false;
    this.isPaused = false;
    this.powerUpOverlay = null;
    this.pauseContainer = null;
    this.totalPopped = 0;      // lifetime pop counter for this round
    this.hintPair = null;      // { a: {r,c}, b: {r,c} } — current hint targets
    this.hintGfx = null;       // Graphics object for hint rings
    this.hintActive = false;
    this.idleTime = 0;         // ms since last input
    this.hintsUsed = 0;
    this.maxHints = 3;         // timed mode limit; zen = unlimited

    // Fever Meter — fills with consecutive matches, triggers bonus mode at 100%
    this.feverMeter = 0;         // 0–100 fill percentage
    this.feverActive = false;    // true during fever bonus window
    this.feverTimer = 0;         // remaining fever duration (ms)
    this.feverGfx = null;        // graphics layer for meter + border
    this.feverLabelText = null;  // "FEVER" text object
    this.feverPctText = null;    // percentage readout
    this.feverCount = 0;         // times fever activated this game

    // Live milestone tracking — loaded records from SafeStorage
    this.prevHighScore = SafeStorage.getInt(SK.HIGH_SCORE, 0);
    this.prevBestStreak = SafeStorage.getInt(SK.BEST_STREAK, 0);
    this.highScoreNotified = false;   // fire once per game
    this.bestStreakNotified = false;
    this._multGlowTween = null;      // multiplier badge pulsing tween ref

    // Cascade chain tracking — counts gravity-induced chain reactions per move
    this.chainDepth = 0;       // current cascade depth (1 = initial match, 2+ = chain)
    this.bestChain = 0;        // best chain this game (for stats)

    // Daily Challenge — seeded PRNG for deterministic grid
    this.dailyRng = this.gameMode === 'daily' ? DailyChallenge.createRng() : null;
  }

  create() {
    setupScene(this);
    const { width, height } = VIEW;

    // Audio
    this.audioStarted = false;
    this.input.on('pointerdown', () => {
      if (!this.audioStarted) {
        window.audioEngine.init();
        window.audioEngine.resume();
        window.audioEngine.startBgBeat();
        this.audioStarted = true;
      }
    }, this);

    // Background
    drawDarkGridBg(this);
    this.reduce = REDUCE_MOTION;

    // ---- HUD ROW: score left, clock centre, buttons right ----
    this.add.text(18, 9, 'SCORE', textStyle('label', { fontSize: '10px', color: P.muted, letterSpacing: 3 })).setOrigin(0, 0);
    this.scoreText = this.add.text(18, 20, '0', textStyle('accent', { fontSize: '32px', strokeThickness: 0, color: P.ink })).setOrigin(0, 0);

    const timed = this.gameMode === 'timed' || this.gameMode === 'daily';
    this.timerText = this.add.text(width / 2 + 4, 8, timed ? `${GAME_TIME}` : 'ZEN', textStyle('accent', { fontSize: '34px', strokeThickness: 0, color: P.ink })).setOrigin(0.5, 0);
    this.timerSub = this.add.text(width / 2 + 4, 44, timed ? (this.gameMode === 'daily' ? `DAILY ${DailyChallenge.displayDate().toUpperCase()}` : 'SECONDS') : 'NO CLOCK', textStyle('label', { fontSize: '9px', color: P.muted, letterSpacing: 2 })).setOrigin(0.5, 0);

    // Timer bar: a track and a fill, in the ink, turning to the accent in the last quarter.
    this.timerTrack = this.add.graphics();
    this.timerTrack.fillStyle(P.inkN, 0.14);
    this.timerTrack.fillRect(0, TIMER_Y, width, 6);
    this.timerBg = this.add.graphics();
    if (timed) {
      this.timerBg.fillStyle(P.inkN, 1);
      this.timerBg.fillRect(0, TIMER_Y, width, 6);
      this.timerEvent = this.time.addEvent({
        delay: 1000, repeat: GAME_TIME - 1,
        callback: () => {
          this.timeLeft--;
          this.updateTimer();
          if (this.timeLeft <= 0) this.endGame();
        }
      });
    }

    // ---- STAGE: the cast lives here ----
    const stageX = 10, stageW = width - 20;
    this.stagePanel = this.add.graphics();
    this.stagePanel.fillStyle(P.inkN, 1);
    this.stagePanel.fillRoundedRect(stageX, STAGE_Y + 4, stageW, STAGE_H, 14);
    this.stagePanel.fillStyle(P.panelN, 1);
    this.stagePanel.fillRoundedRect(stageX, STAGE_Y, stageW, STAGE_H, 14);
    this.stagePanel.lineStyle(3, P.inkN, 1);
    this.stagePanel.strokeRoundedRect(stageX, STAGE_Y, stageW, STAGE_H, 14);
    // A dashed ground line, as in the app's scenes, and a couple of doodle clouds.
    const groundY = STAGE_Y + STAGE_H - 26;
    this.stageDeco = this.add.graphics().setDepth(1);
    this.stageDeco.fillStyle(P.inkN, 0.55);
    for (let x = stageX + 14; x < stageX + stageW - 10; x += 9) this.stageDeco.fillRect(x, groundY + 1, 3, 2);

    this.cast = new Cast(this, stageX, STAGE_Y, stageW, STAGE_H);
    // Name tags under the ground line.
    [this.cast.spark, this.cast.hero, this.cast.pro, this.cast.bolt].forEach((m) => {
      this.add.text(stageX + m.x, groundY + 9, m.name.toUpperCase(), textStyle('label', { fontSize: '9px', color: P.muted, letterSpacing: 2 })).setOrigin(0.5, 0).setDepth(5);
    });

    // Streak banner lives in the top band of the stage; no figure reaches it at rest.
    this.hypeBar = this.add.container(0, 0).setDepth(6);
    this.streakText = this.add.text(stageX + 14, STAGE_Y + 9, '', textStyle('heading', { fontSize: '24px', strokeThickness: 0, color: P.hot })).setOrigin(0, 0).setAlpha(0);
    this.adlibText = this.add.text(stageX + stageW - 14, STAGE_Y + 13, '', textStyle('stat', { fontSize: '18px', fontStyle: 'bold italic', color: P.ink })).setOrigin(1, 0).setAlpha(0);
    this.charNameText = this.add.text(-100, -100, '').setAlpha(0);
    this.characterGfx = this.add.graphics().setAlpha(0);
    this.hypeBar.add([this.streakText, this.adlibText]);

    // ---- BOARD PANEL ----
    const boardX = GRID_OFFSET_X - 10, boardY = GRID_OFFSET_Y - 6;
    const boardW = GRID_COLS * (BUBBLE_SIZE + BUBBLE_PAD) + 16, boardH = GRID_ROWS * (BUBBLE_SIZE + BUBBLE_PAD) + 8;
    const board = this.add.graphics().setDepth(-5);
    board.fillStyle(P.inkN, 1);
    board.fillRoundedRect(boardX, boardY + 4, boardW, boardH, 14);
    board.fillStyle(P.cardN, 1);
    board.fillRoundedRect(boardX, boardY, boardW, boardH, 14);
    board.lineStyle(3, P.inkN, 1);
    board.strokeRoundedRect(boardX, boardY, boardW, boardH, 14);
    this.boardRect = { x: boardX, y: boardY, w: boardW, h: boardH };

    // ---- FOOTER: multiplier badge, streak, best, tip ----
    const footY = boardY + boardH + 14;
    this.footY = footY;
    this.streakCounter = this.add.text(96, footY + 4, '', textStyle('stat', { fontSize: '16px', color: P.ink, fontStyle: 'bold' })).setOrigin(0, 0);
    this.bestStreakText = this.add.text(96, footY + 26, '', textStyle('muted', { fontSize: '12px', color: P.muted })).setOrigin(0, 0);
    this.modeText = this.add.text(width - 18, footY + 6, this.gameMode === 'zen' ? 'ZEN MODE' : this.gameMode === 'daily' ? 'DAILY CHALLENGE' : 'TIMED MODE',
      textStyle('label', { fontSize: '10px', color: P.muted, letterSpacing: 2 })).setOrigin(1, 0);

    // ---- POWER-UP OVERLAY (drawn each frame for pulsing effects) ----
    this.powerUpOverlay = this.add.graphics();
    this.powerUpOverlay.setDepth(3);

    // ---- BUILD GRID ----
    this.bubbleContainer = this.add.container(0, 0);
    // Bubbles enter from above the board; clip them to the panel so nothing draws over the stage.
    const clip = this.make.graphics({ x: 0, y: 0, add: false });
    clip.fillStyle(0xffffff, 1);
    clip.fillRoundedRect(this.boardRect.x + 2, this.boardRect.y + 2, this.boardRect.w - 4, this.boardRect.h - 4, 12);
    this.bubbleContainer.setMask(clip.createGeometryMask());
    this.buildGrid();

    // ---- INPUT ----
    this.swipeStart = null;
    this.swipeBubble = null;
    this.input.on('gameobjectdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);

    // Ambient particles
    this.spawnAmbientParticles();
    // The board breathes: one random bubble wiggles now and then.
    if (!this.reduce) this.time.addEvent({ delay: 900, loop: true, callback: () => {
      if (this.isPaused || this.gameOver || this.isProcessing) return;
      const b = this.grid[Phaser.Math.Between(0, GRID_ROWS - 1)]?.[Phaser.Math.Between(0, GRID_COLS - 1)];
      if (!b || !b.active || b.getData('wob')) return;
      this.tweens.add({ targets: b, angle: { from: -9, to: 9 }, scaleY: 0.95 * BS * 1.07, scaleX: 0.95 * BS * 0.96, duration: 130, yoyo: true, repeat: 1, ease: 'Sine.easeInOut', onComplete: () => { if (b.active) { b.angle = 0; b.setScale(0.95 * BS); } } });
    } });

    // ---- HUD TOOLBAR (pause / hint / mute) ----
    const tbSize = 40;
    const tbY = 30;
    const pauseBtnX = width - 16 - tbSize / 2;
    const hintBtnX = pauseBtnX - tbSize - 8;
    const muteBtnX = hintBtnX - tbSize - 8;

    const pauseBtn = createToolbarBtn(this, {
      x: pauseBtnX, y: tbY, size: tbSize,
      iconFn: (s, bx, by) => Icons.pause(s, bx, by, 20, P.inkN),
      callback: () => this.togglePause(),
    });
    this.pauseBtnBg = pauseBtn.bg;
    this.pauseIconGfx = pauseBtn.icon;

    this.maxHints = this.gameMode === 'zen' ? Infinity : 3;
    const hintBtn = createToolbarBtn(this, {
      x: hintBtnX, y: tbY, size: tbSize,
      iconFn: (s, bx, by) => Icons.hint(s, bx, by, 20, P.inkN),
      callback: () => this.triggerHint(),
    });
    this.hintBtnBg = hintBtn.bg;
    this.hintIconGfx = hintBtn.icon;

    this.hintCountText = this.add.text(hintBtnX + 15, tbY + 13, this.maxHints === Infinity ? '∞' : `${this.maxHints}`,
      textStyle('badge', { fontSize: '11px', color: P.ink, stroke: P.bg, strokeThickness: 3 })).setOrigin(0.5).setDepth(42);

    const gameMute = createMuteToggle(this, muteBtnX, tbY, { onColor: P.inkN, depth: 41 });
    const muteBtn = createToolbarBtn(this, {
      x: muteBtnX, y: tbY, size: tbSize,
      callback: () => gameMute.update(window.audioEngine.toggleMute()),
    });
    this.muteBtnBg = muteBtn.bg;

    // Hint overlay graphics (drawn in update loop)
    this.hintGfx = this.add.graphics().setDepth(4);

    // Idle timer: auto-hint after 5s of inactivity
    this.idleTime = 0;
    this.time.addEvent({
      delay: 500, loop: true,
      callback: () => {
        if (this.isPaused || this.gameOver || this.isProcessing || this.hintActive) return;
        this.idleTime += 500;
        if (this.idleTime >= 5000) {
          this.showAutoHint();
        }
      }
    });

    // ---- TIPS DISPLAY (one line at the bottom) ----
    this.tipIndex = Phaser.Math.Between(0, TIPS.length - 1);
    this.tipText = this.add.text(width / 2, height - 9, TIPS[this.tipIndex],
      textStyle('label', { fontSize: '11px', letterSpacing: 0, color: P.muted, fontStyle: 'italic' }),
    ).setOrigin(0.5, 1).setDepth(1);
    this.time.addEvent({
      delay: 8000, loop: true,
      callback: () => {
        if (this.isPaused || this.gameOver) return;
        this.tipIndex = (this.tipIndex + 1) % TIPS.length;
        this.tweens.add({
          targets: this.tipText, alpha: 0, duration: 300,
          onComplete: () => {
            this.tipText.setText(TIPS[this.tipIndex]);
            this.tweens.add({ targets: this.tipText, alpha: 1, duration: 300 });
          }
        });
      }
    });

    // ---- MULTIPLIER BADGE (bottom left, visible during active streaks) ----
    this.multBadge = this.add.container(52, footY + 26).setDepth(30).setAlpha(0);
    this.multRing = this.add.graphics();
    this.multBadge.add(this.multRing);
    this.multText = this.add.text(0, -2, '',
      textStyle('heading', { fontSize: '22px', strokeThickness: 0 })).setOrigin(0.5);
    this.multBadge.add(this.multText);
    this.multLabel = this.add.text(0, 14, 'MULT',
      textStyle('label', { fontSize: '7px', letterSpacing: 1, color: P.muted })).setOrigin(0.5);
    this.multBadge.add(this.multLabel);

    // ---- FEVER METER (left-edge vertical bar beside the board) ----
    this.feverGfx = this.add.graphics().setDepth(35);
    const fmX = 9;
    const fmTop = GRID_OFFSET_Y + 14;
    const fmH = GRID_ROWS * (BUBBLE_SIZE + BUBBLE_PAD) - 30;
    this.feverBarBounds = { x: fmX, y: fmTop, w: 14, h: fmH };
    this.feverLabelText = this.add.text(fmX + 7, fmTop - 6, 'HOT',
      textStyle('label', { fontSize: '8px', color: P.muted, letterSpacing: 0 }))
      .setOrigin(0.5, 1).setDepth(36);
    this.feverPctText = this.add.text(fmX + 7, fmTop + fmH + 6, '',
      textStyle('badge', { fontSize: '11px', color: P.muted, stroke: '', strokeThickness: 0 }))
      .setOrigin(0.5, 0).setDepth(36);

    // Fever drain timer: the meter decays when not matching
    this.time.addEvent({
      delay: 200, loop: true,
      callback: () => {
        if (this.isPaused || this.gameOver) return;
        if (this.feverActive) {
          this.feverTimer -= 200;
          if (this.feverTimer <= 0) this.deactivateFever();
        } else if (this.feverMeter > 0 && !this.isProcessing) {
          this.feverMeter = Math.max(0, this.feverMeter - 0.8);
        }
      },
    });

    // "GO!" flash
    const goText = this.add.text(width / 2, GRID_OFFSET_Y + 200, 'GO!',
      textStyle('heading', { fontSize: '72px', color: P.hot, stroke: P.ink, strokeThickness: 6 })).setOrigin(0.5).setDepth(50).setScale(0.4);
    this.tweens.add({ targets: goText, scale: 1.1, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: goText, scale: 1.8, alpha: 0,
      duration: 520, ease: 'Quad.easeIn', delay: 520,
      onComplete: () => goText.destroy(),
    });
    this.cast.hero.setPose('pointUp', 120); this.cast.hero.hop(1.2); this.cast.hero.setFace('grin'); this.cast._hold(900);
  }

  // -----------------------------------------------------------
  // PAUSE SYSTEM
  // -----------------------------------------------------------
  togglePause() {
    if (this.gameOver) return;
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  pauseGame() {
    this.isPaused = true;

    // Pause timer
    if (this.timerEvent) this.timerEvent.paused = true;

    // Pause all tweens
    this.tweens.pauseAll();

    const { width, height } = VIEW;

    // Build pause overlay
    this.pauseContainer = this.add.container(0, 0).setDepth(100);

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.75);
    dimBg.fillRect(0, 0, width, height);
    this.pauseContainer.add(dimBg);

    // Pause card
    const cardW = width - 40;
    const cardH = 380;
    const cardX = 20;
    const cardY = (height - cardH) / 2;

    const card = this.add.graphics();
    card.fillStyle(P.panelN, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    card.lineStyle(3, P.inkN, 1);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);
    this.pauseContainer.add(card);

    // PAUSED title
    const pauseTitle = this.add.text(width / 2, cardY + 30, 'PAUSED',
      textStyle('heading', { fontSize: '32px' })).setOrigin(0.5);
    this.pauseContainer.add(pauseTitle);

    // Current score
    const scoreLabel = this.add.text(width / 2, cardY + 70, `SCORE: ${this.score.toLocaleString()}`,
      textStyle('accent', { fontSize: '18px', stroke: '', strokeThickness: 0 })).setOrigin(0.5);
    this.pauseContainer.add(scoreLabel);

    // Tip in pause screen
    const tipLabel = this.add.text(width / 2, cardY + 105, 'TIP',
      textStyle('label', { fontSize: '11px', color: P.faint, fontStyle: 'bold' })).setOrigin(0.5);
    this.pauseContainer.add(tipLabel);

    const pauseTip = TIPS[Phaser.Math.Between(0, TIPS.length - 1)];
    const tipDisplay = this.add.text(width / 2, cardY + 130, pauseTip,
      textStyle('stat', { fontStyle: 'italic', wordWrap: { width: cardW - 40 } })).setOrigin(0.5, 0);
    this.pauseContainer.add(tipDisplay);

    // Buttons
    const btnW = cardW - 40;
    const btnH = 48;
    const btnX = width / 2;

    // Resume
    createButton(this, { x: btnX, y: cardY + 210, width: btnW, height: btnH,
      text: 'RESUME', color: 'hot', container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.play(s, bx, by, 14, P.inkN),
      callback: () => this.resumeGame(),
    });

    // Restart
    createButton(this, { x: btnX, y: cardY + 270, width: btnW, height: btnH,
      text: 'RESTART', color: P.hot, container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.restart(s, bx, by, 14, P.hotN),
      callback: () => { this.cleanupPause(); window.audioEngine.stopBgBeat(); this.scene.restart({ mode: this.gameMode }); },
    });

    // Exit to menu
    createButton(this, { x: btnX, y: cardY + 330, width: btnW, height: btnH,
      text: 'EXIT TO MENU', color: P.hot, container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.close(s, bx, by, 14, P.hotN),
      callback: () => { this.cleanupPause(); window.audioEngine.stopBgBeat(); this.scene.start('TitleScene'); },
    });
  }

  resumeGame() {
    this.isPaused = false;
    if (this.timerEvent) this.timerEvent.paused = false;
    this.tweens.resumeAll();
    if (this.pauseContainer) {
      this.pauseContainer.destroy(true);
      this.pauseContainer = null;
    }
  }

  cleanupPause() {
    this.isPaused = false;
    if (this.pauseContainer) {
      this.pauseContainer.destroy(true);
      this.pauseContainer = null;
    }
  }

  update(time, delta) {
    // Skip per-frame rendering while paused — avoids GPU work behind the
    // pause overlay and prevents visual flicker from animated effects.
    if (this.isPaused) return;
    this.renderPowerUpOverlays(time);
    this.renderFeverMeter(time);
    this.renderHintGlow(time);
    if (this.cast) this.cast.update(time, delta);
  }

  // -----------------------------------------------------------
  // RENDER SUBSYSTEMS — Each per-frame visual concern is isolated
  // so individual effects can be modified, disabled, or tested
  // without touching unrelated rendering code.
  // -----------------------------------------------------------

  /**
   * Draw pulsing power-up icons on special bubbles each frame.
   * Iterates the full grid, delegating to PowerUpRenderer for each
   * bubble that carries a non-NONE power-up data key.
   * @param {number} time — game clock in ms (drives pulse animation)
   */
  renderPowerUpOverlays(time) {
    if (!this.powerUpOverlay) return;
    this.powerUpOverlay.clear();
    forEachCell((r, c) => {
      const bubble = this.grid[r]?.[c];
      if (!bubble) return;
      const pType = bubble.getData('powerUp');
      if (pType && pType !== POWERUP_TYPES.NONE) {
        PowerUpRenderer.draw(
          this.powerUpOverlay, pType,
          bubble.x, bubble.y, BUBBLE_SIZE, time
        );
      }
    });
  }

  /**
   * Render the fever meter bar, percentage text, and active-fever border glow.
   *
   * The bar fills bottom-up through four color stages:
   *   blue (0-25%) → green (25-50%) → gold (50-80%) → red (80-100%).
   * During fever mode the bar locks at 100% gold with a sin-wave pulse,
   * and a double-stroke gold border frames the entire game area.
   *
   * @param {number} time — game clock in ms (drives pulse/glow animation)
   */
  renderFeverMeter(time) {
    if (!this.feverGfx) return;
    this.feverGfx.clear();
    const fb = this.feverBarBounds;
    const fill = this.feverActive ? 100 : this.feverMeter;

    // Track: a rounded tube with an ink outline.
    this.feverGfx.fillStyle(P.cardN, 1);
    this.feverGfx.fillRoundedRect(fb.x, fb.y, fb.w, fb.h, 6);
    if (fill > 0) {
      const fillH = Math.max(8, (fill / 100) * fb.h);
      const fillY = fb.y + fb.h - fillH;
      const pulse = this.feverActive ? 0.75 + 0.25 * Math.sin(time * 0.012) : 1;
      this.feverGfx.fillStyle(P.hotN, pulse);
      this.feverGfx.fillRoundedRect(fb.x + 1.5, fillY, fb.w - 3, fillH - 1.5, 4);
    }
    this.feverGfx.lineStyle(2.5, P.inkN, 1);
    this.feverGfx.strokeRoundedRect(fb.x, fb.y, fb.w, fb.h, 6);
    if (this.feverActive && !this.reduce && Math.random() < 0.5) {
      const sp = this.add.image(Phaser.Math.Between(50, 420), this.boardRect.y + this.boardRect.h - 8, 'particle').setTint(P.hotN).setScale(Phaser.Math.FloatBetween(0.8, 1.6) * BS).setDepth(9);
      this.tweens.add({ targets: sp, y: sp.y - Phaser.Math.Between(120, 320), alpha: 0, duration: Phaser.Math.Between(700, 1200), onComplete: () => sp.destroy() });
    }

    // Fever active: the board glows in the accent and an accent frame wraps the screen.
    if (this.feverActive) {
      const br = this.boardRect;
      this.feverGfx.lineStyle(6, P.hotN, 0.55 + 0.35 * Math.sin(time * 0.012));
      this.feverGfx.strokeRoundedRect(br.x - 2, br.y - 2, br.w + 4, br.h + 4, 15);
      const glow = 0.45 + 0.3 * Math.sin(time * 0.008);
      this.feverGfx.lineStyle(6, P.hotN, glow);
      this.feverGfx.strokeRect(3, 3, VIEW.width - 6, VIEW.height - 6);
    }

    if (!this.feverActive && fill > 0) {
      this.feverPctText.setText(`${Math.floor(fill)}`);
      this.feverPctText.setColor(fill > 80 ? P.hot : P.muted);
    } else if (this.feverActive) {
      this.feverPctText.setText(`${Math.ceil(this.feverTimer / 1000)}s`);
      this.feverPctText.setColor(P.hot);
    } else {
      this.feverPctText.setText('');
    }
    this.feverLabelText.setColor(this.feverActive ? P.hot : P.muted);
  }

  /**
   * Draw animated hint rings around the suggested swap pair.
   * Each bubble gets a double-ring glow (outer diffuse + inner sharp),
   * connected by a faded midpoint line to suggest the swap direction.
   * Auto-clears if either target bubble has been destroyed.
   *
   * @param {number} time — game clock in ms (drives ring oscillation)
   */
  renderHintGlow(time) {
    if (!this.hintGfx) return;
    this.hintGfx.clear();
    if (!this.hintActive || !this.hintPair) return;

    const pulse = 0.5 + 0.5 * Math.sin(time * 0.004); // 0→1 oscillation
    const alpha = 0.3 + pulse * 0.5;
    const radius = (BUBBLE_SIZE / 2) + 2 + pulse * 4;
    const hintColor = P.hotN;

    [this.hintPair.a, this.hintPair.b].forEach(cell => {
      const b = this.grid[cell.r]?.[cell.c];
      if (!b || !b.active) { this.clearHint(); return; }
      const pos = this.gridToWorld(cell.r, cell.c);
      // Outer glow
      this.hintGfx.lineStyle(3, hintColor, alpha * 0.4);
      this.hintGfx.strokeCircle(pos.x, pos.y, radius + 3);
      // Inner ring
      this.hintGfx.lineStyle(2, hintColor, alpha);
      this.hintGfx.strokeCircle(pos.x, pos.y, radius);
    });

    // Connecting arrow line between the two hint bubbles
    const posA = this.gridToWorld(this.hintPair.a.r, this.hintPair.a.c);
    const posB = this.gridToWorld(this.hintPair.b.r, this.hintPair.b.c);
    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;
    this.hintGfx.lineStyle(1.5, hintColor, alpha * 0.3);
    this.hintGfx.lineBetween(posA.x, posA.y, midX, midY);
  }

  // -----------------------------------------------------------
  // TIMER
  // -----------------------------------------------------------
  updateTimer() {
    const { width } = VIEW;
    const pct = Math.max(0, this.timeLeft / GAME_TIME);
    const low = pct <= 0.25;

    this.timerText.setText(`${this.timeLeft}`);
    this.timerText.setColor(low ? P.hot : P.ink);

    // Timer bar: ink, then the accent in the last quarter.
    this.timerBg.clear();
    this.timerBg.fillStyle(low ? P.hotN : P.inkN, 1);
    this.timerBg.fillRect(0, TIMER_Y, width * pct, 6);

    // The last ten seconds: the clock ticks bigger on every second and the whole cast panics.
    if (this.timeLeft <= 10 && this.timeLeft > 0) {
      if (!this.reduce) {
        this.tweens.add({ targets: this.timerText, scale: 1.3, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
        this.shake(60, 0.0012);
      }
      this.cast.setPanic(true);
    }
  }

  // -----------------------------------------------------------
  // LIVE MILESTONES — fire once per game when records are broken
  // -----------------------------------------------------------
  checkMilestones() {
    // New high score — only fires if there was a previous record to beat
    if (!this.highScoreNotified && this.prevHighScore > 0 && this.score > this.prevHighScore) {
      this.highScoreNotified = true;
      this.showMilestoneBanner('NEW HIGH SCORE!', P.hot, P.hotN);
    }
    // New best streak — only fires if there was a previous record to beat
    if (!this.bestStreakNotified && this.prevBestStreak > 0 && this.bestStreak > this.prevBestStreak) {
      this.bestStreakNotified = true;
      // Stagger if both fire on the same match
      const delay = this.highScoreNotified && this.score > this.prevHighScore ? 1800 : 0;
      this.time.delayedCall(delay, () => {
        this.showMilestoneBanner(`BEST STREAK: ${this.bestStreak}x`, P.hot, P.hotN);
      });
    }
  }

  /**
   * Achievement toast — slides in from the top with icon + text, auto-dismisses.
   * Staggered via delay param so multiple unlocks don't overlap.
   */
  showAchievementToast(ach, delay = 0) {
    const toastW = 214;
    const toastX = VIEW.width - 18 - toastW / 2;
    const toastY = this.footY + 24;
    if (this.modeText) this.modeText.setAlpha(0);
    const container = this.add.container(toastX + 40, toastY).setDepth(70).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(P.inkN, 1); bg.fillRoundedRect(-toastW / 2, -15, toastW, 38, 10);
    bg.fillStyle(P.cardN, 1); bg.fillRoundedRect(-toastW / 2, -19, toastW, 38, 10);
    bg.lineStyle(2.5, P.inkN, 1); bg.strokeRoundedRect(-toastW / 2, -19, toastW, 38, 10);
    container.add(bg);
    const star = Icons.star(this, -toastW / 2 + 20, 0, 14, P.inkN); star.setDepth(71); container.add(star);
    container.add(this.add.text(10, -1, ach.name, textStyle('badge', { fontSize: '14px', color: P.ink, stroke: '', strokeThickness: 0 })).setOrigin(0.5));
    this.tweens.add({ targets: container, x: toastX, alpha: 1, duration: 260, delay, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: container, x: toastX + 40, alpha: 0, duration: 260, delay: delay + 2400, ease: 'Quad.easeIn',
      onComplete: () => { container.destroy(true); if (this.modeText && this.modeText.active) this.modeText.setAlpha(1); },
    });
    if (window.audioEngine?.initialized) {
      const t = window.audioEngine.ctx.currentTime + delay / 1000;
      window.audioEngine._tone(t, { type: 'triangle', freq: 880, vol: 0.12, dur: 0.15 });
      window.audioEngine._tone(t + 0.08, { type: 'triangle', freq: 1174.66, vol: 0.1, dur: 0.2 });
    }
  }

  showMilestoneBanner(text, colorStr, colorHex) {
    const { width, height } = VIEW;
    const cy = height * 0.42; // center of the grid area

    // Glow backdrop — horizontal band
    const glow = this.add.graphics().setDepth(55);
    glow.fillStyle(colorHex, 0.12);
    glow.fillRect(0, cy - 28, width, 56);
    glow.lineStyle(1.5, colorHex, 0.35);
    glow.lineBetween(0, cy - 28, width, cy - 28);
    glow.lineBetween(0, cy + 28, width, cy + 28);

    // Main text — scales in with bounce
    const label = this.add.text(width / 2, cy, text,
      textStyle('heading', { fontSize: '26px', color: colorStr, strokeThickness: 5 }),
    ).setOrigin(0.5).setDepth(56).setScale(0);

    this.tweens.add({
      targets: label, scale: 1, duration: 400, ease: 'Back.easeOut',
    });

    // Pulsing glow
    this.tweens.add({
      targets: glow, alpha: 0.25, duration: 400, yoyo: true, repeat: 2,
      ease: 'Sine.easeInOut',
    });

    // Sparkle burst — small stars shoot outward from the banner
    for (let i = 0; i < 12; i++) {
      const sx = width / 2 + Phaser.Math.Between(-100, 100);
      const p = this.add.image(sx, cy, 'star');
      p.setTint(colorHex);
      p.setScale(Phaser.Math.FloatBetween(0.2, 0.5) * BS);
      p.setDepth(54).setAlpha(0);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(40, 100);
      this.tweens.add({
        targets: p, alpha: 0.8, duration: 150, delay: i * 30,
        onComplete: () => {
          this.tweens.add({
            targets: p,
            x: sx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            alpha: 0, scale: 0,
            duration: 500, ease: 'Quad.easeOut',
            onComplete: () => p.destroy(),
          });
        },
      });
    }

    // Fade out the banner
    this.time.delayedCall(1400, () => {
      this.tweens.add({
        targets: [label, glow], alpha: 0, duration: 400,
        ease: 'Quad.easeIn',
        onComplete: () => { label.destroy(); glow.destroy(); },
      });
    });
  }

  endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.isProcessing = true;

    window.audioEngine.stopBgBeat();
    this.tweens.timeScale = 1; this.time.timeScale = 1;
    this.cast.setPanic(false); this.cast.finish(this.score >= 1500);

    // Play final sound
    window.audioEngine.playStreakHit(12);

    const highScore = SafeStorage.getInt(SK.HIGH_SCORE, 0);
    const finalScore = Number.isFinite(this.score) ? this.score : 0;
    const isNewHigh = finalScore > highScore;
    if (isNewHigh) {
      SafeStorage.set(SK.HIGH_SCORE, Math.max(0, Math.floor(finalScore)).toString());
    }

    // Persist lifetime stats
    const gamesKey = SK.GAMES(this.gameMode);
    SafeStorage.set(gamesKey, (SafeStorage.getInt(gamesKey, 0) + 1).toString());
    const lifetimePops = SafeStorage.getInt(SK.TOTAL_POPS, 0) + (this.totalPopped || 0);
    SafeStorage.set(SK.TOTAL_POPS, lifetimePops.toString());
    const lifetimeScore = SafeStorage.getInt(SK.TOTAL_SCORE, 0) + finalScore;
    SafeStorage.set(SK.TOTAL_SCORE, Math.max(0, Math.floor(lifetimeScore)).toString());
    const allTimeBest = SafeStorage.getInt(SK.BEST_STREAK, 0);
    if ((this.bestStreak || 0) > allTimeBest) {
      SafeStorage.set(SK.BEST_STREAK, this.bestStreak.toString());
    }

    // Daily Challenge — save daily best and track completion
    if (this.gameMode === 'daily') {
      const isNewDaily = DailyChallenge.saveScore(finalScore);
      if (isNewDaily && finalScore > 0) DailyChallenge.incrementTotal();
    }

    // End-of-game achievement check (lifetime stats like games_10, pops_500)
    const endSession = { score: finalScore, bestStreak: this.bestStreak || 0 };
    const endLifetime = {
      totalPops: lifetimePops,
      totalGames: SafeStorage.getInt(SK.GAMES_TIMED, 0) + SafeStorage.getInt(SK.GAMES_ZEN, 0),
    };
    Achievements.check(endSession, endLifetime);

    // Record run for sparkline history
    const gradeInfo = getGrade(finalScore, this.bestStreak || 0);
    RunHistory.record({
      score: finalScore,
      grade: gradeInfo.grade,
      mode: this.gameMode,
      streak: this.bestStreak || 0,
    });

    // Transition — safeScore() catches NaN/Infinity that || 0 would miss
    this.time.delayedCall(1000, () => {
      this.scene.start('GameOverScene', {
        score: safeScore(this.score),
        bestStreak: safeScore(this.bestStreak),
        moves: safeScore(this.moveCount),
        isNewHigh,
        mode: this.gameMode || 'timed',
        feverCount: this.feverCount || 0,
        bestChain: this.bestChain || 0,
      });
    });
  }

  // -----------------------------------------------------------
  // GRID
  // -----------------------------------------------------------
  buildGrid() {
    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        this.spawnBubble(row, col, true);
      }
    }
    this.resolveInitialMatches();
  }

  spawnBubble(row, col, animate = false) {
    const colorIdx = this.dailyRng
      ? Math.floor(this.dailyRng() * COLORS.length)
      : Phaser.Math.Between(0, COLORS.length - 1);
    const pos = this.gridToWorld(row, col);

    const bubble = this.add.image(pos.x, animate ? GRID_OFFSET_Y - 70 : pos.y, bubbleKey(colorIdx));
    bubble.setInteractive();
    bubble.setData('row', row);
    bubble.setData('col', col);
    bubble.setData('colorIdx', colorIdx);
    bubble.setData('powerUp', POWERUP_TYPES.NONE);
    bubble.setScale(0.95 * BS);

    this.bubbleContainer.add(bubble);
    this.grid[row][col] = bubble;

    if (animate) {
      bubble.setAlpha(0);
      this.tweens.add({
        targets: bubble, y: pos.y, alpha: { value: 1, duration: 120 },
        duration: 280 + row * 24, ease: 'Back.easeOut',
        delay: col * 22 + row * 12,
      });
    }

    return bubble;
  }

  gridToWorld(row, col) {
    return {
      x: GRID_OFFSET_X + col * (BUBBLE_SIZE + BUBBLE_PAD) + BUBBLE_SIZE / 2,
      y: GRID_OFFSET_Y + row * (BUBBLE_SIZE + BUBBLE_PAD) + BUBBLE_SIZE / 2,
    };
  }

  resolveInitialMatches() {
    let safety = 0;
    while (this.findAllMatches().length > 0 && safety < 200) {
      const matches = this.findAllMatches();
      matches.forEach(group => {
        const b = group[group.length - 1];
        const newColor = this.getColorWithoutMatch(b.getData('row'), b.getData('col'));
        b.setData('colorIdx', newColor);
        b.setTexture(bubbleKey(newColor));
      });
      safety++;
    }
  }

  getColorWithoutMatch(row, col) {
    const avoid = new Set();
    if (col >= 2) {
      const c1 = this.grid[row][col - 1]?.getData('colorIdx');
      const c2 = this.grid[row][col - 2]?.getData('colorIdx');
      if (c1 !== undefined && c1 === c2) avoid.add(c1);
    }
    if (row >= 2) {
      const c1 = this.grid[row - 1]?.[col]?.getData('colorIdx');
      const c2 = this.grid[row - 2]?.[col]?.getData('colorIdx');
      if (c1 !== undefined && c1 === c2) avoid.add(c1);
    }
    const available = [];
    for (let i = 0; i < COLORS.length; i++) {
      if (!avoid.has(i)) available.push(i);
    }
    return available[Phaser.Math.Between(0, available.length - 1)];
  }

  // -----------------------------------------------------------
  // INPUT — Tap + Swipe
  // -----------------------------------------------------------
  onPointerDown(pointer, bubble) {
    if (this.isProcessing || this.gameOver || this.isPaused) return;
    this.idleTime = 0;
    this.clearHint();
    this.swipeStart = { x: pointer.x, y: pointer.y };
    this.swipeBubble = bubble;
    window.audioEngine.playSelect();
    this.highlightBubble(bubble, true);
  }

  onPointerUp(pointer) {
    if (this.isProcessing || !this.swipeBubble || this.gameOver || this.isPaused) return;

    const dx = (pointer.x - this.swipeStart.x) / Z;
    const dy = (pointer.y - this.swipeStart.y) / Z;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const SWIPE_THRESHOLD = 20;

    if (dist > SWIPE_THRESHOLD) {
      // SWIPE
      this.highlightBubble(this.swipeBubble, false);
      if (this.selected) {
        this.highlightBubble(this.selected, false);
        this.selected = null;
      }

      const row = this.swipeBubble.getData('row');
      const col = this.swipeBubble.getData('col');
      let targetRow = row, targetCol = col;
      if (Math.abs(dx) > Math.abs(dy)) {
        targetCol += dx > 0 ? 1 : -1;
      } else {
        targetRow += dy > 0 ? 1 : -1;
      }

      if (targetRow >= 0 && targetRow < GRID_ROWS && targetCol >= 0 && targetCol < GRID_COLS) {
        const targetBubble = this.grid[targetRow][targetCol];
        if (targetBubble) {
          this.isProcessing = true;
          this.swapBubbles(this.swipeBubble, targetBubble);
        }
      }
      this.swipeBubble = null;
      this.swipeStart = null;
    } else {
      // TAP
      this.highlightBubble(this.swipeBubble, false);

      if (!this.selected) {
        this.selected = this.swipeBubble;
        this.highlightBubble(this.swipeBubble, true);
      } else if (this.selected === this.swipeBubble) {
        this.highlightBubble(this.selected, false);
        this.selected = null;
      } else {
        const r1 = this.selected.getData('row'), c1 = this.selected.getData('col');
        const r2 = this.swipeBubble.getData('row'), c2 = this.swipeBubble.getData('col');
        const isAdjacent = (Math.abs(r1 - r2) === 1 && c1 === c2) || (Math.abs(c1 - c2) === 1 && r1 === r2);

        if (isAdjacent) {
          this.highlightBubble(this.selected, false);
          this.isProcessing = true;
          this.swapBubbles(this.selected, this.swipeBubble);
        } else {
          this.highlightBubble(this.selected, false);
          this.selected = this.swipeBubble;
          this.highlightBubble(this.swipeBubble, true);
        }
      }
      this.swipeBubble = null;
      this.swipeStart = null;
    }
  }

  highlightBubble(bubble, on) {
    if (!bubble || !bubble.active) return;
    const old = bubble.getData('wob');
    if (old) { old.stop(); bubble.setData('wob', null); }
    this.tweens.add({
      targets: bubble, scale: (on ? 1.15 : 0.95) * BS, angle: 0,
      duration: 150, ease: 'Back.easeOut',
    });
    bubble.setDepth(on ? 6 : 0);
    if (on && !this.reduce) {
      // A selected bubble wobbles like it wants to go.
      bubble.setData('wob', this.tweens.add({ targets: bubble, angle: { from: -5, to: 5 }, duration: 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 150 }));
    }
  }

  // -----------------------------------------------------------
  // SWAP + MATCH
  // -----------------------------------------------------------
  swapBubbles(a, b) {
    this.clearHint();
    this.idleTime = 0;
    const r1 = a.getData('row'), c1 = a.getData('col');
    const r2 = b.getData('row'), c2 = b.getData('col');

    // Bounds guard — reject tampered row/col data to prevent OOB grid access
    if (
      r1 < 0 || r1 >= GRID_ROWS || c1 < 0 || c1 >= GRID_COLS ||
      r2 < 0 || r2 >= GRID_ROWS || c2 < 0 || c2 >= GRID_COLS
    ) {
      this.isProcessing = false;
      return;
    }

    const pos1 = this.gridToWorld(r1, c1);
    const pos2 = this.gridToWorld(r2, c2);

    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    a.setData('row', r2); a.setData('col', c2);
    b.setData('row', r1); b.setData('col', c1);

    // Swap trail effect
    this.spawnSwapTrail(a, pos1, pos2);
    this.spawnSwapTrail(b, pos2, pos1);

    this.tweens.add({ targets: a, x: pos2.x, y: pos2.y, duration: 180, ease: 'Quad.easeInOut' });
    this.tweens.add({
      targets: b, x: pos1.x, y: pos1.y, duration: 180, ease: 'Quad.easeInOut',
      onComplete: () => {
        const matches = this.findAllMatches();

        // Check if swapped bubbles have power-ups that should activate
        const aPower = a.getData('powerUp');
        const bPower = b.getData('powerUp');

        if (matches.length === 0 && aPower === POWERUP_TYPES.NONE && bPower === POWERUP_TYPES.NONE) {
          this.grid[r1][c1] = a; this.grid[r2][c2] = b;
          a.setData('row', r1); a.setData('col', c1);
          b.setData('row', r2); b.setData('col', c2);
          this.tweens.add({ targets: a, x: pos1.x, y: pos1.y, duration: 180, ease: 'Quad.easeInOut' });
          this.tweens.add({
            targets: b, x: pos2.x, y: pos2.y, duration: 180, ease: 'Quad.easeInOut',
            onComplete: () => {
              this.streak = 0;
              this.updateStreakUI();
              this.isProcessing = false;
            }
          });
          window.audioEngine.playInvalid();
          this.cast.onInvalid();
          this.shake(100, 0.003);
        } else {
          this.moveCount++;
          this.processMatches(matches);
        }
      }
    });

    this.selected = null;
  }

  spawnSwapTrail(bubble, from, to) {
    const trail = this.add.image(from.x, from.y, bubbleKey(bubble.getData('colorIdx')));
    trail.setAlpha(0.4);
    trail.setScale(0.6 * BS);
    trail.setDepth(1);
    this.tweens.add({
      targets: trail, x: to.x, y: to.y, alpha: 0, scale: 0.2 * BS,
      duration: 200, ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  findAllMatches() {
    // Scan horizontal runs (iterate rows, sweep columns)
    const hMatched = scanRuns(
      this.grid, GRID_ROWS, GRID_COLS,
      (r, c) => this.grid[r][c],
      (r, c) => ({ r, c }),
    );

    // Scan vertical runs (iterate columns, sweep rows)
    const vMatched = scanRuns(
      this.grid, GRID_COLS, GRID_ROWS,
      (c, r) => this.grid[r]?.[c],
      (c, r) => ({ r, c }),
    );

    // Merge both directions
    const matched = new Set([...hMatched, ...vMatched]);

    // Group connected matches
    const groups = [];
    const visited = new Set();
    matched.forEach(key => {
      if (visited.has(key)) return;
      const [r, c] = key.split(',').map(Number);
      const group = [];
      const stack = [{ r, c }];
      while (stack.length) {
        const p = stack.pop();
        const k = `${p.r},${p.c}`;
        if (visited.has(k) || !matched.has(k)) continue;
        visited.add(k);
        group.push(this.grid[p.r][p.c]);
        const color = this.grid[p.r][p.c]?.getData('colorIdx');
        [{ r: p.r - 1, c: p.c }, { r: p.r + 1, c: p.c }, { r: p.r, c: p.c - 1 }, { r: p.r, c: p.c + 1 }]
          .forEach(n => {
            const nk = `${n.r},${n.c}`;
            if (matched.has(nk) && !visited.has(nk) && this.grid[n.r]?.[n.c]?.getData('colorIdx') === color) {
              stack.push(n);
            }
          });
      }
      if (group.length > 0) groups.push(group);
    });

    return groups;
  }

  // -----------------------------------------------------------
  // MATCH PROCESSING — Power-ups, pop, score, drop, refill
  // -----------------------------------------------------------

  /**
   * Core game loop orchestrator — processes matched bubble groups through
   * an 8-stage pipeline, then recurses via a timed cascade to handle
   * chain reactions from gravity refills.
   *
   * ## Pipeline stages (in execution order)
   *
   * | # | Stage              | Side effect                                              |
   * |---|--------------------|----------------------------------------------------------|
   * | 1 | Power-up detection | Scans each group via `PowerUpSystem.analyze()` for       |
   * |   |                    | LINE/BOMB/NUKE creation; collects existing power-ups     |
   * |   |                    | on matched cells for detonation                          |
   * | 2 | Pop & destroy      | Removes non-power-up bubbles from grid, plays melodic    |
   * |   |                    | pop SFX (pitch rises with `popIdx`)                      |
   * | 3 | Power-up activate  | Detonates collected power-ups → `getAffectedCells()` →   |
   * |   |                    | area pop + VFX via `spawnPowerUpEffect()`                |
   * | 4 | Power-up create    | Transforms center bubble of qualifying matches into a    |
   * |   |                    | new power-up with flash animation + floating label       |
   * | 5 | Fever meter        | Adds energy (8% base + 3%/streak + 5%/power-up).        |
   * |   |                    | Triggers `activateFever()` at 100%; extends timer by     |
   * |   |                    | 1.5s per match while fever is active (max 10s)           |
   * | 6 | Scoring            | `(base + sizeBonus + powerUpBonus) × streak × fever`.    |
   * |   |                    | All values pass through `safeScore()` to block           |
   * |   |                    | NaN/Infinity propagation. Shows floating popup           |
   * | 7 | Milestones & Achs  | `checkMilestones()` fires live "NEW HIGH SCORE!" /       |
   * |   |                    | "BEST STREAK!" banners. `Achievements.check()` tests     |
   * |   |                    | all 8 progression thresholds and shows toast on unlock    |
   * | 8 | Gravity cascade    | After 300ms: `dropBubbles()` → 350ms: `refillGrid()` →  |
   * |   |                    | 400ms: `findAllMatches()`. If new matches found,         |
   * |   |                    | **recurses** into `processMatches()` (chain reaction).   |
   * |   |                    | Otherwise unlocks input via `isProcessing = false`       |
   *
   * ## Recursion & timing
   *
   * The gravity cascade (stage 8) uses staggered `time.delayedCall()` to
   * let drop/refill animations play before scanning for new matches.
   * Each recursive call increments `this.streak`, so chain reactions
   * naturally escalate scoring multipliers and visual intensity.
   * Input is blocked (`isProcessing = true`) for the entire cascade depth.
   *
   * ## Scoring formula
   *
   * ```
   * base       = totalPopped × 10
   * sizeBonus  = max(0, totalPopped - 4) × 15
   * powerUp    = activatedPowerUps × 50
   * multiplier = min(streak, 10)
   * fever      = feverActive ? 2 : 1
   * points     = safeScore((base + sizeBonus + powerUp) × multiplier × fever)
   * ```
   *
   * @param {Array<Phaser.GameObjects.Image[]>} matchGroups — Arrays of matched
   *   bubble sprites, each group representing one contiguous run of 3+ same-color
   *   bubbles. Produced by `findAllMatches()`. Each bubble carries `row`, `col`,
   *   `colorIdx`, and optionally `powerUp` data keys.
   *
   * @returns {void} All effects are side-effects on scene state (`this.score`,
   *   `this.streak`, `this.grid`, `this.feverMeter`, etc.) and the Phaser
   *   display list.
   *
   * @fires AudioEngine#playPop — Per-bubble pop with ascending pitch
   * @fires AudioEngine#playStreakHit — Streak-tier celebration SFX
   * @fires Phaser.Cameras.Scene2D.Camera#shake — Intensity scales with streak
   *
   * @see findAllMatches — Produces the `matchGroups` input
   * @see PowerUpSystem.analyze — Determines power-up type from match shape
   * @see safeScore — Guards against NaN/Infinity in score accumulation
   * @see Achievements.check — Tests all 8 milestone thresholds
   */
  /** Maximum cascade recursion depth — prevents stack overflow from runaway chains. */
  static MAX_CHAIN_DEPTH = 20;

  processMatches(matchGroups, depth = 1) {
    // Guard: cap recursion depth to prevent stack overflow on degenerate grids
    if (depth > GameScene.MAX_CHAIN_DEPTH) {
      this.isProcessing = false;
      return;
    }
    this.streak++;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    this.chainDepth = depth;
    if (depth > this.bestChain) this.bestChain = depth;

    let totalPopped = 0;
    let popIdx = 0;
    const powerUpsToActivate = [];
    const powerUpsToCreate = [];

    matchGroups.forEach(group => {
      // Check for power-up creation from this match
      const powerUpType = PowerUpSystem.analyze(group, this.grid);

      // Check if any matched bubble IS a power-up (activate it)
      group.forEach(bubble => {
        const existingPower = bubble.getData('powerUp');
        if (existingPower && existingPower !== POWERUP_TYPES.NONE) {
          powerUpsToActivate.push({
            type: existingPower,
            row: bubble.getData('row'),
            col: bubble.getData('col'),
            colorIdx: bubble.getData('colorIdx'),
          });
        }
      });

      // Create new power-up at the center of the match
      if (powerUpType !== POWERUP_TYPES.NONE) {
        const centerBubble = group[Math.floor(group.length / 2)];
        powerUpsToCreate.push({
          type: powerUpType,
          row: centerBubble.getData('row'),
          col: centerBubble.getData('col'),
          colorIdx: centerBubble.getData('colorIdx'),
        });
      }

      group.forEach(bubble => {
        // Skip if this bubble will become a power-up — it stays alive on the grid
        const isNewPowerUp = powerUpsToCreate.find(
          p => p.row === bubble.getData('row') && p.col === bubble.getData('col')
        );
        if (!isNewPowerUp) {
          window.audioEngine.playPop(this.streak, popIdx);
          this.popBubble(bubble, Math.min(popIdx * 26, 150));
          popIdx++;
          totalPopped++;
        }
      });
    });

    // Activate existing power-ups that were matched
    powerUpsToActivate.forEach(pu => {
      const cells = PowerUpSystem.getAffectedCells(
        pu.type, pu.row, pu.col, pu.colorIdx,
        this.grid, GRID_ROWS, GRID_COLS
      );
      cells.forEach(cell => {
        const b = this.grid[cell.r]?.[cell.c];
        if (b && b.active) {
          this.popBubble(b, Math.min(totalPopped * 12, 200));
          totalPopped++;
        }
      });

      // Power-up activation effect
      this.spawnPowerUpEffect(pu.type, pu.row, pu.col);
    });

    // Transform center bubbles into power-ups
    powerUpsToCreate.forEach(pu => {
      const bubble = this.grid[pu.row]?.[pu.col];
      if (bubble && bubble.active) {
        bubble.setData('powerUp', pu.type);
        // Flash effect
        this.tweens.add({
          targets: bubble, scale: 1.3 * BS, duration: 150,
          yoyo: true, ease: 'Back.easeOut',
        });
        // Show power-up name
        const pos = this.gridToWorld(pu.row, pu.col);
        const label = this.add.text(pos.x, pos.y - 30, POWERUP_NAMES[pu.type],
          textStyle('accent', { fontSize: '14px', color: P.hot })).setOrigin(0.5).setDepth(25);
        this.tweens.add({
          targets: label, y: pos.y - 60, alpha: 0,
          duration: 800, ease: 'Quad.easeOut',
          onComplete: () => label.destroy(),
        });
      }
    });

    // ---- FEVER METER FILL ----
    // Each match adds energy: base 8% + 3% per streak level + 5% per power-up
    const feverGain = 8 + Math.min(this.streak, 10) * 3 + powerUpsToActivate.length * 5;
    if (!this.feverActive) {
      this.feverMeter = Math.min(100, this.feverMeter + feverGain);
      if (this.feverMeter >= 100) this.activateFever();
    } else {
      // Extend fever by 1.5s per match while active (max 10s total)
      this.feverTimer = Math.min(10000, this.feverTimer + 1500);
    }

    // Score — safeScore() prevents NaN/Infinity from corrupting the running total
    const baseScore = totalPopped * 10;
    const streakMultiplier = Math.max(1, Math.min(Number.isFinite(this.streak) ? this.streak : 1, 10));
    const sizeBonus = totalPopped > 4 ? (totalPopped - 4) * 15 : 0;
    const powerUpBonus = powerUpsToActivate.length * 50;
    const chainBonus = depth >= 2 ? (depth - 1) * 25 : 0;
    const feverMultiplier = this.feverActive ? 2 : 1;
    const points = safeScore((baseScore + sizeBonus + powerUpBonus + chainBonus) * streakMultiplier * feverMultiplier);
    this.score = safeScore(this.score + points);
    this.totalPopped += totalPopped;
    this.scoreText.setText(this.score.toLocaleString());
    this.bumpScore(points);

    // Score popup — append fever indicator when active
    if (matchGroups[0] && matchGroups[0][0]) {
      const first = matchGroups[0][0];
      const label = this.feverActive ? `+${points} 🔥` : `+${points}`;
      this.showScorePopup(first.x, first.y, label, this.streak);
    }

    // ---- THE CAST REACTS ----
    const px = matchGroups[0] && matchGroups[0][0] ? (matchGroups[0][0].x - GRID_OFFSET_X) / (GRID_COLS * (BUBBLE_SIZE + BUBBLE_PAD)) : 0.5;
    this.cast.onPop(totalPopped, this.streak, px);
    if (powerUpsToCreate.length) this.cast.onPowerUpMade();
    if (powerUpsToActivate.length) this.cast.onBlast();
    if (depth >= 2) this.cast.onChain(depth);
    if (!this.reduce) this.shake(70, 0.0016 + Math.min(totalPopped, 8) * 0.0004);
    // A big hit freezes the frame for a breath before it lands.
    if (totalPopped >= 6 || depth >= 3 || powerUpsToActivate.length) this.hitStop(depth >= 3 ? 130 : 85);

    // ---- CASCADE CHAIN BANNER ----
    if (depth >= 2) this.showChainBanner(depth);

    // ---- LIVE MILESTONES ----
    this.checkMilestones();

    // ---- ACHIEVEMENT CHECKS (streak + first pop) ----
    const sessionSnap = { score: this.score, bestStreak: this.bestStreak };
    const ltSnap = {
      totalPops: SafeStorage.getInt(SK.TOTAL_POPS, 0) + this.totalPopped,
      totalGames: SafeStorage.getInt(SK.GAMES_TIMED, 0) + SafeStorage.getInt(SK.GAMES_ZEN, 0),
    };
    const freshAchs = Achievements.check(sessionSnap, ltSnap);
    freshAchs.forEach((ach, i) => this.showAchievementToast(ach, i * 2600));

    // Streak sound + visual
    window.audioEngine.playStreakHit(this.streak);
    const shakeIntensity = Math.min(0.003 + this.streak * 0.002, 0.02);
    this.shake(120 + this.streak * 20, shakeIntensity);

    // Full-screen flash on 8+ streak
    if (this.streak >= 8) {
      this.screenFlash(P.hotN);
    }

    this.updateStreakUI();
    this.triggerHypeBar();

    // Drop + refill cycle
    this.time.delayedCall(170, () => {
      this.dropBubbles();
      this.time.delayedCall(120, () => {
        this.refillGrid();
        this.time.delayedCall(330, () => {
          const newMatches = this.findAllMatches();
          if (newMatches.length > 0) {
            this.processMatches(newMatches, depth + 1);
          } else {
            if (!this.hasPossibleMoves()) this.reshuffleGrid();
            this.isProcessing = false;
          }
        });
      });
    });
  }

  spawnPowerUpEffect(type, row, col) {
    const pos = this.gridToWorld(row, col);
    const { width } = VIEW;

    if (type === POWERUP_TYPES.LINE_H || type === POWERUP_TYPES.LINE_V) {
      // Line flash
      const line = this.add.graphics();
      line.setDepth(15);
      if (type === POWERUP_TYPES.LINE_H) {
        line.fillStyle(0xffffff, 0.6);
        line.fillRect(0, pos.y - 3, width, 6);
      } else {
        line.fillStyle(0xffffff, 0.6);
        line.fillRect(pos.x - 3, GRID_OFFSET_Y, 6, GRID_ROWS * (BUBBLE_SIZE + BUBBLE_PAD));
      }
      this.tweens.add({
        targets: line, alpha: 0, duration: 400,
        onComplete: () => line.destroy(),
      });
    } else if (type === POWERUP_TYPES.BOMB) {
      // Shockwave ring
      const ring = this.add.graphics();
      ring.setDepth(15);
      ring.lineStyle(4, P.hotN, 1);
      ring.strokeCircle(pos.x, pos.y, 10);
      this.tweens.add({
        targets: ring, scale: 4, alpha: 0, duration: 400,
        onComplete: () => ring.destroy(),
      });
      this.shake(200, 0.015);
    } else if (type === POWERUP_TYPES.NUKE) {
      // Full screen color flash
      this.screenFlash(P.hotN);
      this.shake(300, 0.02);
    }
  }

  /** The score number thumps when it changes, harder for bigger scores. */
  bumpScore(points) {
    if (this.reduce || !this.scoreText) return;
    this.tweens.add({ targets: this.scoreText, scale: points >= 200 ? 1.35 : 1.15, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  screenFlash(color) {
    const { width, height } = VIEW;
    const flash = this.add.graphics();
    flash.setDepth(50);
    flash.fillStyle(color, this.reduce ? 0.12 : 0.3);
    flash.fillRect(0, 0, width, height);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  // -----------------------------------------------------------
  // FEVER MODE — 2× score bonus with visual spectacle
  // -----------------------------------------------------------
  activateFever() {
    this.feverActive = true;
    this.feverTimer = 6000; // 6 seconds base duration
    this.feverMeter = 100;
    this.feverCount++;

    const { width } = VIEW;
    const cy = GRID_OFFSET_Y + 170;
    // The moment: a slow-motion beat, a hard flash, a banner on a starburst, and the whole cast erupts.
    const banner = this.add.text(width / 2, cy, 'FEVER!',
      textStyle('heading', { fontSize: '54px', color: P.hot, stroke: P.bg, strokeThickness: 0 }),
    ).setOrigin(0.5).setDepth(55).setScale(0);
    const sub = this.add.text(width / 2, cy + 42, 'DOUBLE POINTS',
      textStyle('badge', { fontSize: '16px', color: P.ink, stroke: '', strokeThickness: 0, letterSpacing: 3 }),
    ).setOrigin(0.5).setDepth(55).setAlpha(0);

    this.tweens.add({
      targets: banner, scale: 1.1, duration: 350, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner, scale: 1.6, alpha: 0,
          duration: 600, delay: 500, ease: 'Quad.easeIn',
          onComplete: () => banner.destroy(),
        });
      },
    });
    this.tweens.add({
      targets: sub, alpha: 1, duration: 200, delay: 200,
      onComplete: () => {
        this.tweens.add({
          targets: sub, alpha: 0, y: sub.y - 20,
          duration: 400, delay: 700, ease: 'Quad.easeIn',
          onComplete: () => sub.destroy(),
        });
      },
    });

    // Dim the board under the banner so the title reads and the moment takes over the screen.
    const plate = this.add.graphics().setDepth(54);
    plate.fillStyle(P.inkN, 1); plate.fillRoundedRect(width / 2 - 170, cy - 52, 340, 124, 18);
    plate.fillStyle(P.cardN, 1); plate.fillRoundedRect(width / 2 - 170, cy - 56, 340, 124, 18);
    plate.lineStyle(4, P.inkN, 1); plate.strokeRoundedRect(width / 2 - 170, cy - 56, 340, 124, 18);
    plate.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: plate, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: plate, alpha: 0, duration: 400, delay: 1100, onComplete: () => plate.destroy() });
    this.screenFlash(P.hotN);
    this.shake(260, 0.014);
    this.hitStop(320, 0.15);
    this.cast.setFever(true);
    this.confettiBurst(34);
    window.audioEngine.playStreakHit(12);
  }

  deactivateFever() {
    this.feverActive = false;
    this.feverTimer = 0;
    this.feverMeter = 0;
    this.cast.setFever(false);

    const { width } = VIEW;
    const endText = this.add.text(width / 2, GRID_OFFSET_Y + 150, 'FEVER OVER',
      textStyle('badge', { fontSize: '14px', color: P.ink, stroke: P.bg, strokeThickness: 4, letterSpacing: 2 }),
    ).setOrigin(0.5).setDepth(55);
    this.tweens.add({
      targets: endText, alpha: 0, y: endText.y - 20,
      duration: 800, delay: 400, ease: 'Quad.easeOut',
      onComplete: () => endText.destroy(),
    });
  }

  /** Paper confetti from the top of the board: the payoff for a fever. Skipped under reduced motion. */
  confettiBurst(n = 30) {
    if (this.reduce) return;
    const { width } = VIEW;
    for (let i = 0; i < n; i++) {
      const p = this.add.image(Phaser.Math.Between(20, width - 20), STAGE_Y + 20, 'conf');
      p.setTint(Phaser.Math.RND.pick([...P.bubblesN, P.hotN]));
      p.setScale(Phaser.Math.FloatBetween(0.8, 1.6) * BS).setDepth(52);
      this.tweens.add({
        targets: p, y: p.y + Phaser.Math.Between(200, 520), x: p.x + Phaser.Math.Between(-70, 70),
        rotation: Phaser.Math.FloatBetween(-6, 6), alpha: { value: 0, delay: 600, duration: 500 },
        duration: Phaser.Math.Between(900, 1500), delay: i * 14, ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  /**
   * Pop one bubble. A pop has three beats: a squash (anticipation), the burst (impact), and the aftermath
   * (droplets, a ring, a nudge to every neighbour). `delay` ripples a match from one end to the other.
   */
  popBubble(bubble, delay = 0) {
    if (!bubble || !bubble.active) return;
    const row = bubble.getData('row');
    const col = bubble.getData('col');
    const colorIdx = bubble.getData('colorIdx');
    const x = bubble.x, y = bubble.y;

    if (this.grid[row] && this.grid[row][col] === bubble) {
      this.grid[row][col] = null;
    }
    bubble.disableInteractive();
    bubble.setDepth(8);

    const burst = () => {
      if (!bubble.active) return;
      this.spawnPopParticles(x, y, COLORS[colorIdx]);
      this.spawnPopRing(x, y, COLORS[colorIdx]);
      this.nudgeNeighbours(row, col);
      this.tweens.add({
        targets: bubble, scale: 1.7 * BS, alpha: 0, duration: 140, ease: 'Quad.easeOut',
        onComplete: () => bubble.destroy(),
      });
    };
    if (this.reduce) { this.time.delayedCall(delay, burst); return; }
    // Anticipation: the bubble swells and squashes before it goes, so the pop reads as a release.
    this.tweens.add({
      targets: bubble, scaleX: 1.22 * BS, scaleY: 0.82 * BS, duration: 80, delay, ease: 'Quad.easeOut',
      onComplete: burst,
    });
  }

  /** A quick ring of shock that grows and fades where a bubble went. */
  spawnPopRing(x, y, color) {
    if (this.reduce) return;
    const ring = this.add.image(x, y, 'ring').setTint(color).setScale(0.35 * BS).setAlpha(0.9).setDepth(9);
    ring.setBlendMode(Phaser.BlendModes.NORMAL);
    this.tweens.add({
      targets: ring, scale: 1.1 * BS, alpha: 0, duration: 260, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** The neighbours of a popped bubble lean away for a beat: it makes the board feel like one soft thing. */
  nudgeNeighbours(row, col) {
    if (this.reduce) return;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      const n = this.grid[row + dr]?.[col + dc];
      if (!n || !n.active || n.getData('nudging')) return;
      n.setData('nudging', true);
      const px = this.gridToWorld(row + dr, col + dc);
      this.tweens.add({
        targets: n, x: px.x + dc * 3, y: px.y + dr * 3, duration: 70, yoyo: true, ease: 'Quad.easeOut',
        onComplete: () => { if (n.active) { n.x = px.x; n.y = px.y; n.setData('nudging', false); } },
      });
    });
  }

  spawnPopParticles(x, y, color) {
    const feverBoost = this.feverActive ? 1.5 : 1;
    const count = Math.floor((8 + this.streak * 1.5) * feverBoost);
    const n = Math.min(count, this.reduce ? 4 : 22);
    for (let i = 0; i < n; i++) {
      const star = this.streak >= 6 || this.feverActive;
      const p = this.add.image(x, y, star && i % 2 ? 'star' : 'particle');
      p.setTint(this.feverActive && i % 3 === 0 ? P.hotN : color);
      p.setScale(Phaser.Math.FloatBetween(0.8, 1.5) * feverBoost * BS);
      p.setDepth(10);
      const angle = (i / n) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const speed = Phaser.Math.FloatBetween(40, 84 + this.streak * 7);
      // Droplets arc: out fast, then gravity.
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        duration: Phaser.Math.Between(320, 560),
        ease: 'Quad.easeOut',
      });
      this.tweens.add({
        targets: p,
        y: y + Math.sin(angle) * speed * 0.6 + 38,
        alpha: 0,
        scale: 0,
        rotation: Phaser.Math.FloatBetween(-2, 2),
        duration: Phaser.Math.Between(420, 620),
        ease: (t) => 1.45 * t * t - 0.45 * t,
        onComplete: () => p.destroy(),
      });
    }
  }

  showScorePopup(x, y, text, streak) {
    const level = getStreakLevel(streak);
    const size = level ? Math.min(level.size - 4, 36) : 22;
    // A sticker: ink outline, the accent inside on streaks, the ink otherwise.
    y = Math.max(y, GRID_OFFSET_Y + 34);
    const popup = this.add.text(x, y, text,
      textStyle('popup', { fontSize: `${size}px`, color: level ? P.hot : P.ink, stroke: P.bg, strokeThickness: 5 })).setOrigin(0.5).setDepth(20).setScale(0.4);
    this.tweens.add({ targets: popup, scale: 1.15, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: popup, y: y - 56, alpha: 0,
      duration: 800, delay: 140, ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  /** Screen shake that respects the player's reduced-motion setting. */
  shake(duration, intensity) {
    if (this.reduce) return;
    this.cameras.main.shake(duration, intensity);
  }

  /** A short freeze-frame on a big hit: everything slows to a crawl for `ms` of real time, then resumes. */
  hitStop(ms, scale = 0.12) {
    if (this.reduce || this.gameOver) return;
    this.tweens.timeScale = scale; this.time.timeScale = scale;
    window.setTimeout(() => {
      if (!this.sys || !this.sys.isActive()) return;
      this.tweens.timeScale = 1; this.time.timeScale = 1;
    }, ms);
  }

  /**
   * Cascade chain banner: "CHAIN x3" as a sticker over the board with a starburst behind it.
   * Fires when gravity-induced matches chain (depth 2 or more). Bigger chains get a bigger banner and more shake.
   */
  showChainBanner(depth) {
    const { width } = VIEW;
    const cx = width / 2;
    const cy = GRID_OFFSET_Y + 150;
    const label = `CHAIN ×${depth}`;
    const fontSize = Math.min(34 + depth * 4, 54);

    const burst = this.add.graphics().setDepth(28);
    burst.fillStyle(P.hotN, 0.95);
    const spikes = 14, rIn = 52 + depth * 3, rOut = 96 + depth * 8;
    burst.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 ? rIn : rOut;
      burst[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    burst.closePath(); burst.fillPath();
    burst.lineStyle(3, P.inkN, 1); burst.strokePath();
    burst.setPosition(cx, cy).setScale(0.2).setAlpha(0.95);

    const main = this.add.text(cx, cy, label,
      textStyle('popup', { fontSize: `${fontSize}px`, color: P.ink, stroke: P.bg, strokeThickness: 7, fontStyle: 'bold italic' })
    ).setOrigin(0.5).setDepth(30).setScale(0.3);
    const bonus = this.add.text(cx, cy + fontSize * 0.75, `+${(depth - 1) * 25} CHAIN BONUS`,
      textStyle('badge', { fontSize: '13px', color: P.ink, stroke: P.bg, strokeThickness: 4 })
    ).setOrigin(0.5).setAlpha(0).setDepth(30);

    this.tweens.add({ targets: [main, burst], scale: 1, duration: 320, ease: 'Back.easeOut' });
    if (!this.reduce) this.tweens.add({ targets: burst, angle: 24, duration: 1100, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: bonus, alpha: 1, y: cy + fontSize * 0.68, duration: 250, delay: 150, ease: 'Quad.easeOut' });
    if (depth >= 3) this.shake(200, 0.006 + depth * 0.002);

    this.tweens.add({
      targets: [main, burst, bonus],
      alpha: 0, y: '-=26', scale: 1.15,
      duration: 500, delay: 800, ease: 'Quad.easeIn',
      onComplete: () => { main.destroy(); burst.destroy(); bonus.destroy(); },
    });
  }

  dropBubbles() {
    for (let col = 0; col < GRID_COLS; col++) {
      let emptyRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== emptyRow) {
            const bubble = this.grid[row][col];
            this.grid[emptyRow][col] = bubble;
            this.grid[row][col] = null;
            bubble.setData('row', emptyRow);
            bubble.setData('col', col);
            const pos = this.gridToWorld(emptyRow, col);
            const dropDist = emptyRow - row;
            this.tweens.add({
              targets: bubble, y: pos.y,
              duration: 240 + dropDist * 28, ease: 'Back.easeOut',
              onComplete: () => {
                window.audioEngine.playLand(dropDist * 0.02);
                if (!this.reduce && bubble.active) this.tweens.add({ targets: bubble, scaleX: 1.06 * BS, scaleY: 0.84 * BS, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
              },
            });
          }
          emptyRow--;
        }
      }
    }
  }

  refillGrid() {
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] === null) {
          this.spawnBubble(row, col, true);
        }
      }
    }
  }

  // -----------------------------------------------------------
  // HYPE: the cast reacts, the streak shows in the stage banner
  // -----------------------------------------------------------
  triggerHypeBar() {
    const level = getStreakLevel(this.streak);
    if (!level) {
      this.streakText.setAlpha(0);
      this.adlibText.setAlpha(0);
      return;
    }
    const tier = STREAK_LEVELS.indexOf(level) + 1;

    this.streakText.setText(`${this.streak}× ${level.label}`);
    this.streakText.setFontSize(Math.min(level.size - 4, 30) + 'px');
    this.streakText.setAlpha(1);
    this.streakText.setScale(0.5);
    this.tweens.add({ targets: this.streakText, scale: 1, duration: 280, ease: 'Back.easeOut' });

    const lines = ADLIBS[getAdlibTier(this.streak)];
    this.adlibText.setText(lines[Phaser.Math.Between(0, lines.length - 1)]);
    this.adlibText.setAlpha(0);
    this.tweens.add({ targets: this.adlibText, alpha: 1, duration: 200, delay: 140 });

    this.cast.onStreak(tier);

    this.hypeToken = (this.hypeToken || 0) + 1;
    const token = this.hypeToken;
    this.time.delayedCall(1700, () => {
      if (token !== this.hypeToken || !this.streakText.active) return; // a newer match took over the banner
      this.tweens.add({ targets: [this.adlibText, this.streakText], alpha: 0, duration: 400 });
    });

    if (this.streak >= 5) this.flashHypeBar(P.hot);
    if (this.streak >= 8) this.spawnStreakParticles(P.hot);
  }

  flashHypeBar() {
    if (this.reduce) return;
    const flash = this.add.graphics();
    flash.lineStyle(5, P.hotN, 1);
    flash.strokeRoundedRect(10, STAGE_Y, VIEW.width - 20, STAGE_H, 14);
    flash.setDepth(7);
    this.tweens.add({ targets: flash, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
  }

  spawnStreakParticles() {
    if (this.reduce) return;
    const { width } = VIEW;
    for (let i = 0; i < 14; i++) {
      const p = this.add.image(Phaser.Math.Between(30, width - 30), STAGE_Y + STAGE_H - 40, 'star');
      p.setTint(i % 2 ? P.hotN : P.inkN);
      p.setScale(Phaser.Math.FloatBetween(0.5, 1.1) * BS);
      p.setDepth(7).setAlpha(0);
      this.tweens.add({
        targets: p, alpha: 1, y: p.y - Phaser.Math.Between(60, 130), x: p.x + Phaser.Math.Between(-30, 30), rotation: Phaser.Math.FloatBetween(-2, 2), scale: 0,
        duration: Phaser.Math.Between(600, 1000), delay: i * 40,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  updateStreakUI() {
    if (this.streak > 1) {
      this.streakCounter.setText(`STREAK ${this.streak}×`);
      this.streakCounter.setColor(this.streak >= 5 ? P.hot : P.ink);
    } else {
      this.streakCounter.setText('');
    }
    if (this.bestStreak > 2) {
      this.bestStreakText.setText(`best this round ${this.bestStreak}×`);
    }
    this.updateMultiplierBadge();
  }

  // -----------------------------------------------------------
  // MULTIPLIER BADGE: the score multiplier, bottom left
  // -----------------------------------------------------------
  updateMultiplierBadge() {
    const mult = Math.min(this.streak, 10);
    if (mult < 2) {
      if (this.multBadge.alpha > 0) {
        this.tweens.add({ targets: this.multBadge, alpha: 0, scale: 0.6, duration: 260, ease: 'Quad.easeIn' });
        if (this._multGlowTween) { this._multGlowTween.stop(); this._multGlowTween = null; }
      }
      return;
    }
    const radius = 24 + Math.min(mult - 2, 8) * 0.5;
    this.multRing.clear();
    this.multRing.fillStyle(P.inkN, 1);
    this.multRing.fillCircle(0, 3, radius);
    this.multRing.fillStyle(mult >= 5 ? P.hotN : P.cardN, 1);
    this.multRing.fillCircle(0, 0, radius);
    this.multRing.lineStyle(3, P.inkN, 1);
    this.multRing.strokeCircle(0, 0, radius);

    // Text colour that reads on whichever fill the ring has.
    const fill = mult >= 5 ? P.hot : P.card;
    const n = parseInt(fill.slice(1), 16);
    const light = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.55;
    this.multText.setText(`×${mult}`);
    this.multText.setColor(light ? '#0a0a0a' : '#ffffff');
    this.multText.setFontSize(mult >= 8 ? '26px' : '22px');
    this.multLabel.setColor(light ? '#0a0a0a' : '#ffffff');

    if (this.multBadge.alpha < 0.5) {
      this.multBadge.setScale(0.3).setAlpha(1);
      this.tweens.add({ targets: this.multBadge, scale: 1, duration: 320, ease: 'Back.easeOut' });
    } else {
      this.tweens.add({ targets: this.multBadge, scale: 1.25, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    }
    if (mult >= 8 && !this._multGlowTween && !this.reduce) {
      this._multGlowTween = this.tweens.add({ targets: this.multBadge, scale: 1.1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (mult < 8 && this._multGlowTween) {
      this._multGlowTween.stop(); this._multGlowTween = null; this.multBadge.setScale(1);
    }
  }

  // -----------------------------------------------------------
  // HINT SYSTEM
  // -----------------------------------------------------------

  /**
   * Core swap-search: try every adjacent swap, return the first that produces a match.
   * Both findHintMove() and hasPossibleMoves() delegate here to eliminate duplication.
   * @returns {{a:{r:number,c:number}, b:{r:number,c:number}}|null}
   * @private
   */
  _findValidSwap() {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (c + 1 < GRID_COLS) {
          this.swapGridData(r, c, r, c + 1);
          const has = this.findAllMatches().length > 0;
          this.swapGridData(r, c, r, c + 1);
          if (has) return { a: { r, c }, b: { r, c: c + 1 } };
        }
        if (r + 1 < GRID_ROWS) {
          this.swapGridData(r, c, r + 1, c);
          const has = this.findAllMatches().length > 0;
          this.swapGridData(r, c, r + 1, c);
          if (has) return { a: { r, c }, b: { r: r + 1, c } };
        }
      }
    }
    return null;
  }

  /** Find a valid swap pair. Returns {a:{r,c}, b:{r,c}} or null. */
  findHintMove() {
    return this._findValidSwap();
  }

  /** Player-triggered hint (costs a hint charge in timed mode). */
  triggerHint() {
    if (this.isPaused || this.gameOver || this.isProcessing) return;
    if (this.hintActive) { this.clearHint(); return; }
    this.cast.onHint();
    if (this.hintsUsed >= this.maxHints) {
      // Flash the counter red to signal exhaustion
      this.hintCountText.setColor(P.hot);
      this.time.delayedCall(400, () => this.hintCountText.setColor(P.muted));
      return;
    }
    const move = this.findHintMove();
    if (!move) return;
    this.hintPair = move;
    this.hintActive = true;
    this.hintsUsed++;
    const remaining = this.maxHints === Infinity ? '∞' : `${this.maxHints - this.hintsUsed}`;
    this.hintCountText.setText(remaining);
    if (this.maxHints !== Infinity && this.hintsUsed >= this.maxHints) {
      this.hintCountText.setColor(P.muted);
    }
  }

  /** Auto-hint from idle timer (free, doesn't cost charges). */
  showAutoHint() {
    if (this.hintActive) return;
    const move = this.findHintMove();
    if (!move) return;
    this.hintPair = move;
    this.hintActive = true;
  }

  /** Clear any active hint visualization. */
  clearHint() {
    this.hintPair = null;
    this.hintActive = false;
    if (this.hintGfx) this.hintGfx.clear();
  }

  // -----------------------------------------------------------
  // POSSIBLE MOVES + RESHUFFLE
  // -----------------------------------------------------------
  hasPossibleMoves() {
    return this._findValidSwap() !== null;
  }

  swapGridData(r1, c1, r2, c2) {
    const a = this.grid[r1][c1];
    const b = this.grid[r2][c2];
    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    if (a) { a.setData('row', r2); a.setData('col', c2); }
    if (b) { b.setData('row', r1); b.setData('col', c1); }
  }

  reshuffleGrid() {
    const colors = [];
    forEachCell((r, c) => {
      if (this.grid[r][c]) colors.push(this.grid[r][c].getData('colorIdx'));
    });

    Phaser.Utils.Array.Shuffle(colors);

    let idx = 0;
    forEachCell((r, c) => {
      if (this.grid[r][c]) {
        const newColor = colors[idx++];
        this.grid[r][c].setData('colorIdx', newColor);
        this.grid[r][c].setTexture(bubbleKey(newColor));
        this.grid[r][c].setData('powerUp', POWERUP_TYPES.NONE);
      }
    });

    this.resolveInitialMatches();
    window.audioEngine.playShuffle();

    const { width, height } = VIEW;
    const shuffleText = this.add.text(width / 2, height / 2, 'SHUFFLE!',
      textStyle('heading', { fontSize: '36px', color: P.hot, strokeThickness: 5 })).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: shuffleText, scale: 1.5, alpha: 0,
      duration: 800, ease: 'Quad.easeOut',
      onComplete: () => shuffleText.destroy(),
    });
  }

  // -----------------------------------------------------------
  // AMBIENT PARTICLES
  // -----------------------------------------------------------
  spawnAmbientParticles() {
    const { width, height } = VIEW;
    this.time.addEvent({
      delay: 2000, loop: true,
      callback: () => {
        const p = this.add.image(Phaser.Math.Between(0, width), height + 10, 'particle');
        p.setTint(COLORS[Phaser.Math.Between(0, COLORS.length - 1)]);
        p.setAlpha(0.15);
        p.setScale(Phaser.Math.FloatBetween(0.3, 0.8) * BS);
        p.setDepth(-1);
        this.tweens.add({
          targets: p, y: -10, x: p.x + Phaser.Math.Between(-40, 40),
          duration: Phaser.Math.Between(6000, 10000), ease: 'Sine.easeInOut',
          onComplete: () => p.destroy(),
        });
      }
    });
  }
}

// =============================================================
// GAME CONFIG
// =============================================================
const config = {
  type: Phaser.AUTO,
  width: LW * Z,
  height: LH * Z,
  parent: 'game-container',
  backgroundColor: P.bg,
  render: { antialias: true, roundPixels: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, StatsScene, TutorialScene, TipsScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);
