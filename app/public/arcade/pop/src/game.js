// What's Poppin — Bubble Pop Game
// Cultural sauce meets addictive gameplay

// =============================================================
// CONSTANTS
// =============================================================
const GRID_COLS = 8;
const GRID_ROWS = 10;
const BUBBLE_SIZE = 44;
const BUBBLE_PAD = 4;
const GRID_OFFSET_X = 40;
const GRID_OFFSET_Y = 140;
const HYPE_BAR_HEIGHT = 120;
const MIN_MATCH = 3;
const GAME_TIME = 90; // seconds

const COLORS = [
  0x9b59b6, // Royal purple
  0xe74c3c, // Fire red
  0x2ecc71, // Neon green
  0xf1c40f, // Gold
  0x3498db, // Electric blue
  0xff6b35, // Orange flame
];

const COLOR_NAMES = ['purple', 'red', 'green', 'gold', 'blue', 'orange'];

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
  { min: 3,  label: 'NICE',         color: '#2ecc71', size: 28, char: 'kira' },
  { min: 5,  label: 'FIRE',          color: '#f1c40f', size: 34, char: 'blaze' },
  { min: 8,  label: 'GODLIKE',      color: '#e74c3c', size: 42, char: 'ronin' },
  { min: 12, label: 'LEGENDARY',    color: '#9b59b6', size: 50, char: 'empress' },
];

const ADLIBS = {
  3:  ['Aye!', 'Sheesh', 'Let\'s go', 'Vibe check', 'Clean', 'Smooth'],
  5:  ['ON SIGHT', 'No cap', 'DIFFERENT', 'Say less', 'Gang gang', 'HEAT CHECK'],
  8:  ['WENT CRAZY', 'DEMON TIME', 'Main character', 'Built different', 'UNREAL'],
  12: ['LEGENDARY', 'GOD MODE', 'Anime protagonist', 'UNMATCHED', 'TRANSCENDENT'],
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
  { grade: 'S', minScore: 5000, minStreak: 8, color: '#ffd700', label: 'SUPREME' },
  { grade: 'A', minScore: 3000, minStreak: 5, color: '#2ecc71', label: 'EXCELLENT' },
  { grade: 'B', minScore: 1500, minStreak: 3, color: '#3498db', label: 'GREAT' },
  { grade: 'C', minScore: 500,  minStreak: 0, color: '#ff6b35', label: 'DECENT' },
  { grade: 'D', minScore: 100,  minStreak: 0, color: '#e74c3c', label: 'ROOKIE' },
];

// =============================================================
// ACHIEVEMENTS — Progression milestones that drive replay value
// =============================================================
const ACHIEVEMENTS = [
  { id: 'first_blood',  name: 'FIRST BLOOD',  desc: 'Pop your first bubble',           color: '#3498db', threshold: () => true },
  { id: 'streak_5',     name: 'ON FIRE',       desc: 'Hit a 5× streak',                 color: '#f1c40f', threshold: (s) => s.bestStreak >= 5 },
  { id: 'streak_8',     name: 'DEMON TIME',    desc: 'Hit an 8× streak',                color: '#e74c3c', threshold: (s) => s.bestStreak >= 8 },
  { id: 'streak_12',    name: 'TRANSCENDENT',  desc: 'Hit a 12× streak',                color: '#9b59b6', threshold: (s) => s.bestStreak >= 12 },
  { id: 'score_5k',     name: 'BIG MONEY',     desc: 'Score 5,000+ in one game',        color: '#f1c40f', threshold: (s) => s.score >= 5000 },
  { id: 'score_10k',    name: 'UNTOUCHABLE',   desc: 'Score 10,000+ in one game',       color: '#ff6b35', threshold: (s) => s.score >= 10000 },
  { id: 'pops_500',     name: 'POP MACHINE',   desc: 'Pop 500 lifetime bubbles',        color: '#2ecc71', threshold: (_, lt) => lt.totalPops >= 500 },
  { id: 'games_10',     name: 'DEDICATED',      desc: 'Play 10 games',                   color: '#3498db', threshold: (_, lt) => lt.totalGames >= 10 },
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
  return { grade: 'F', minScore: 0, minStreak: 0, color: '#666666', label: 'TRY AGAIN' };
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
  heading:  { fontFamily: UI_FONT, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4, fontSize: '28px', color: '#ffffff' },
  /** Stats row — centered muted text for stat summaries */
  stat:     { fontFamily: UI_FONT, fontSize: '14px', color: '#aaaaaa', align: 'center' },
  /** Tiny uppercase label — stat keys, captions */
  label:    { fontFamily: UI_FONT, fontSize: '10px', color: '#666666', letterSpacing: 2 },
  /** Subtle secondary text — credits, sub-values, skip links */
  muted:    { fontFamily: UI_FONT, fontSize: '12px', color: '#444444' },
  /** Prominent score/value — bold, gold, stroked */
  accent:   { fontFamily: UI_FONT, fontStyle: 'bold', fontSize: '20px', color: '#f1c40f', stroke: '#000000', strokeThickness: 3 },
  /** Body / description — readable, muted, wrappable */
  body:     { fontFamily: UI_FONT, fontSize: '14px', color: '#bbbbbb', align: 'center', lineSpacing: 6 },
  /** Floating score/power-up popup — bold, heavy stroke */
  popup:    { fontFamily: UI_FONT, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 },
  /** Badge — small bold accent with light stroke */
  badge:    { fontFamily: UI_FONT, fontSize: '13px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 },
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
  const { width, height } = scene.scale;
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a0a1a, 1);
  bg.fillRect(0, 0, width, height);
  bg.lineStyle(1, 0x1a1a2e, 0.3);
  for (let x = 0; x < width; x += 30) bg.lineBetween(x, 0, x, height);
  for (let y = 0; y < height; y += 30) bg.lineBetween(0, y, width, y);
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
  bg.fillStyle(0x1a1a2e, 0.8);
  bg.fillRoundedRect(x - half, y - half, size, size, 8);
  bg.lineStyle(1, 0x3a3a5e, 0.6);
  bg.strokeRoundedRect(x - half, y - half, size, size, 8);
  bg.setDepth(depth);

  let icon = null;
  if (iconFn) {
    icon = iconFn(scene, x, y);
    if (icon) icon.setDepth(depth + 1);
  }

  const hit = scene.add.rectangle(x, y, size, size)
    .setInteractive().setAlpha(0.001).setDepth(depth + 2);
  if (callback) hit.on('pointerdown', callback);

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
 * @param {number} [opts.onColor=0x888888]  — color when unmuted
 * @param {number} [opts.offColor=0x666666] — color when muted
 * @param {number|null} [opts.depth=null]   — explicit depth (null = default)
 * @returns {{ update: (muted: boolean) => void }}
 */
function createMuteToggle(scene, x, y, opts = {}) {
  const { size = 18, onColor = 0x888888, offColor = 0x666666, depth = null } = opts;
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
    color = '#ffffff', iconFn, callback,
    container, radius = 10,
  } = opts;
  const borderColor = color.startsWith('#')
    ? Phaser.Display.Color.HexStringToColor(color).color
    : 0x3a3a5e;
  const defaultBorder = borderColor === 0x3a3a5e;

  const bg = scene.add.graphics();
  const drawBg = (fill, border, borderAlpha) => {
    bg.clear();
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    bg.lineStyle(defaultBorder ? 2 : 1.5, border, borderAlpha);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  };
  drawBg(0x1a1a2e, defaultBorder ? 0x3a3a5e : borderColor, defaultBorder ? 0.8 : 0.4);
  if (container) container.add(bg);

  if (iconFn) {
    const icon = iconFn(scene, x - w / 2 + (subtext ? 30 : 25), y - (subtext ? 4 : 0));
    if (container && icon) container.add(icon);
  }

  const textOffset = iconFn ? (subtext ? 12 : 8) : 0;
  const label = scene.add.text(x + textOffset, y - (subtext ? 8 : 0), text, {
    fontSize: subtext ? '20px' : '16px', fontFamily: UI_FONT,
    fontStyle: 'bold', color: defaultBorder ? '#ffffff' : color,
  }).setOrigin(0.5);
  if (container) container.add(label);

  if (subtext) {
    const sub = scene.add.text(x + textOffset, y + 14, subtext, {
      fontSize: '11px', fontFamily: UI_FONT, color: '#555555',
    }).setOrigin(0.5);
    if (container) container.add(sub);
  }

  const hitZone = scene.add.rectangle(x, y, w, h).setInteractive()
    .setAlpha(0.001);
  if (container) hitZone.setDepth(101);
  if (container) container.add(hitZone);

  hitZone.on('pointerover', () => {
    drawBg(0x2a2a4e, defaultBorder ? 0xf1c40f : borderColor, 0.8);
  });
  hitZone.on('pointerout', () => {
    drawBg(0x1a1a2e, defaultBorder ? 0x3a3a5e : borderColor, defaultBorder ? 0.8 : 0.4);
  });
  hitZone.on('pointerdown', callback);
}

const TIPS = [
  'Swipe a bubble toward a neighbor to swap — or tap two adjacent bubbles',
  'Match 3 or more same-colored bubbles in a row or column',
  'Chain reactions keep your streak alive — plan for cascades',
  'Match 4 in a row to create a LINE CLEAR power-up',
  'Match 5+ in a row to create a BOMB — clears a 3x3 area',
  'L-shaped or T-shaped matches create a COLOR NUKE — wipes all of one color',
  'Streaks multiply your score — keep the chain going for big points',
  'Hit 3x streak to meet Kira, 5x for Blaze, 8x for Ronin, 12x for Empress',
  'Look at the bottom of the board first — matches there create more cascades',
  'In Timed mode, speed matters more than perfection — keep moving',
  'Power-up bubbles activate when matched — save them for the right moment',
  'No valid moves? The board auto-shuffles — no penalty',
];

// =============================================================
// BOOT SCENE
// =============================================================
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    COLORS.forEach((color, i) => {
      const gfx = this.add.graphics();
      gfx.fillStyle(color, 0.3);
      gfx.fillCircle(BUBBLE_SIZE / 2, BUBBLE_SIZE / 2, BUBBLE_SIZE / 2);
      gfx.fillStyle(color, 1);
      gfx.fillCircle(BUBBLE_SIZE / 2, BUBBLE_SIZE / 2, BUBBLE_SIZE / 2 - 3);
      gfx.fillStyle(0xffffff, 0.3);
      gfx.fillCircle(BUBBLE_SIZE / 2 - 6, BUBBLE_SIZE / 2 - 6, 6);
      gfx.generateTexture(`bubble_${i}`, BUBBLE_SIZE, BUBBLE_SIZE);
      gfx.destroy();
    });

    // Colorblind bubble textures — same base bubble + unique geometric symbol
    const half = BUBBLE_SIZE / 2;
    COLORS.forEach((color, i) => {
      const g = this.add.graphics();
      g.fillStyle(color, 0.3);
      g.fillCircle(half, half, half);
      g.fillStyle(color, 1);
      g.fillCircle(half, half, half - 3);
      CB_SYMBOLS[i](g, half, half, 7);
      g.fillStyle(0xffffff, 0.2);
      g.fillCircle(half - 6, half - 6, 6);
      g.generateTexture(`bubble_cb_${i}`, BUBBLE_SIZE, BUBBLE_SIZE);
      g.destroy();
    });

    const pGfx = this.add.graphics();
    pGfx.fillStyle(0xffffff, 1);
    pGfx.fillCircle(4, 4, 4);
    pGfx.generateTexture('particle', 8, 8);
    pGfx.destroy();

    const sGfx = this.add.graphics();
    sGfx.fillStyle(0xf1c40f, 1);
    sGfx.fillCircle(6, 6, 6);
    sGfx.fillStyle(0xffffff, 0.7);
    sGfx.fillCircle(4, 4, 3);
    sGfx.generateTexture('star', 12, 12);
    sGfx.destroy();

    this.scene.start('TitleScene');
  }
}

// =============================================================
// TITLE SCENE
// =============================================================
class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    const { width, height } = this.scale;

    // Background
    drawDarkGridBg(this);

    // Floating bubbles in background
    for (let i = 0; i < 20; i++) {
      const bx = Phaser.Math.Between(20, width - 20);
      const by = Phaser.Math.Between(50, height - 50);
      const colorIdx = Phaser.Math.Between(0, COLORS.length - 1);
      const bubble = this.add.image(bx, by, bubbleKey(colorIdx));
      bubble.setAlpha(0.15);
      bubble.setScale(Phaser.Math.FloatBetween(0.5, 1.2));
      this.tweens.add({
        targets: bubble,
        y: by + Phaser.Math.Between(-30, 30),
        x: bx + Phaser.Math.Between(-20, 20),
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Title
    const title = this.add.text(width / 2, height * 0.18, 'WHAT\'S', {
      fontSize: '40px',
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height * 0.27, 'POPPIN', {
      fontSize: '64px',
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      color: '#e74c3c',
      stroke: '#000000',
      strokeThickness: 7,
    }).setOrigin(0.5);

    // Pulsing title
    this.tweens.add({
      targets: subtitle,
      scale: 1.05,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tagline
    this.add.text(width / 2, height * 0.36, 'match  /  combo  /  dominate',
      textStyle('label', { fontSize: '14px' })).setOrigin(0.5);

    // Mode buttons
    const btnY = height * 0.47;

    const btnWidth = width - 60;
    const btnHeight = 56;

    // Timed mode button
    createButton(this, { x: width / 2, y: btnY, width: btnWidth, height: btnHeight, radius: 12,
      text: 'TIMED MODE', subtext: '90 seconds — chase the high score',
      iconFn: (s, bx, by) => Icons.timer(s, bx, by, 18, 0xffffff),
      callback: () => this.scene.start('GameScene', { mode: 'timed' }),
    });

    // Zen mode button
    createButton(this, { x: width / 2, y: btnY + 80, width: btnWidth, height: btnHeight, radius: 12,
      text: 'ZEN MODE', subtext: 'No timer — pure vibes',
      iconFn: (s, bx, by) => Icons.zen(s, bx, by, 18, 0xffffff),
      callback: () => this.scene.start('GameScene', { mode: 'zen' }),
    });

    // Daily Challenge button — pulsing accent, shows today's date + completion
    const dailyDone = DailyChallenge.isCompleted();
    const dailyBest = DailyChallenge.bestScore();
    const dailySub = dailyDone
      ? `✓ Best: ${dailyBest.toLocaleString()} — tap to beat it`
      : `${DailyChallenge.displayDate()} — same board for everyone`;
    createButton(this, { x: width / 2, y: btnY + 160, width: btnWidth, height: btnHeight, radius: 12,
      text: 'DAILY CHALLENGE', subtext: dailySub,
      iconFn: (s, bx, by) => Icons.fire(s, bx, by, 18, 0xff6b35),
      callback: () => this.scene.start('GameScene', { mode: 'daily' }),
    });

    // How to Play button
    createButton(this, { x: width / 2, y: btnY + 240, width: btnWidth, height: btnHeight, radius: 12,
      text: 'HOW TO PLAY', subtext: 'Tips, controls, power-ups',
      iconFn: (s, bx, by) => Icons.help(s, bx, by, 18, 0xffffff),
      callback: () => this.scene.start('TipsScene'),
    });

    // Stats button
    createButton(this, { x: width / 2, y: btnY + 320, width: btnWidth, height: btnHeight, radius: 12,
      text: 'YOUR LEGACY', subtext: 'Lifetime stats & records',
      iconFn: (s, bx, by) => Icons.trophy(s, bx, by, 18, 0xf1c40f),
      callback: () => this.scene.start('StatsScene'),
    });

    // First-time tutorial check
    if (!SafeStorage.get(SK.PLAYED, null)) {
      createButton(this, { x: width / 2, y: btnY + 400, width: btnWidth, height: btnHeight, radius: 12,
        text: 'TUTORIAL', subtext: 'Learn the basics step by step',
        callback: () => this.scene.start('TutorialScene'),
      });
    }

    // High score display + run history sparkline
    const highScore = SafeStorage.getInt(SK.HIGH_SCORE, 0);
    const hasHistory = typeof drawRunSparkline === 'function' && RunHistory.load().length >= 2;
    if (hasHistory) {
      // Sparkline replaces plain high score with richer visualization
      drawRunSparkline(this, width / 2, height * 0.82, width - 80, 50);
    } else if (highScore > 0) {
      // Fallback: plain high score when not enough history
      Icons.star(this, width / 2 - 100, height * 0.85, 14, 0xf1c40f);
      this.add.text(width / 2, height * 0.85, `HIGH SCORE: ${highScore.toLocaleString()}`,
        textStyle('accent', { fontSize: '18px' })).setOrigin(0.5);
    }

    // Best grade badges (per mode)
    const bestGradeTimed = SafeStorage.get(SK.BEST_GRADE('timed'), null);
    const bestGradeZen = SafeStorage.get(SK.BEST_GRADE('zen'), null);
    if (bestGradeTimed || bestGradeZen) {
      let badgeX = width / 2 - 60;
      const badgeY = height * 0.89;
      if (bestGradeTimed) {
        const gInfo = GRADES.find(g => g.grade === bestGradeTimed) || getGrade(0, 0);
        this.add.text(badgeX, badgeY, `TIMED: ${bestGradeTimed}`,
          textStyle('badge', { color: gInfo.color })).setOrigin(0.5);
        badgeX += 70;
      }
      if (bestGradeZen) {
        const gInfo = GRADES.find(g => g.grade === bestGradeZen) || getGrade(0, 0);
        this.add.text(badgeX, badgeY, `ZEN: ${bestGradeZen}`,
          textStyle('badge', { color: gInfo.color })).setOrigin(0.5);
      }
    }

    // ---- MUTE TOGGLE (bottom-right) ----
    const mute = createMuteToggle(this, width - 30, height * 0.93);
    const muteHit = this.add.rectangle(width - 30, height * 0.93, 36, 36).setInteractive().setAlpha(0.001);
    muteHit.on('pointerdown', () => {
      window.audioEngine.init();
      window.audioEngine.resume();
      mute.update(window.audioEngine.toggleMute());
    });

    // ---- COLORBLIND TOGGLE (bottom-left) ----
    const cbOn = SafeStorage.get(SK.COLORBLIND, '0') === '1';
    const cbColor = cbOn ? 0x2ecc71 : 0x555555;
    let cbIcon = Icons.a11y(this, 30, height * 0.93, 18, cbColor);
    const cbLabel = this.add.text(30, height * 0.93 + 14, cbOn ? 'ON' : 'OFF',
      textStyle('label', { fontSize: '8px', color: cbOn ? '#2ecc71' : '#555555' })).setOrigin(0.5);
    const cbHit = this.add.rectangle(30, height * 0.93, 36, 36).setInteractive().setAlpha(0.001);
    cbHit.on('pointerdown', () => {
      const next = SafeStorage.get(SK.COLORBLIND, '0') === '1' ? '0' : '1';
      SafeStorage.set(SK.COLORBLIND, next);
      this.scene.restart(); // rebuild with new textures
    });

    // Credits
    this.add.text(width / 2, height * 0.93, 'by DareDev256', textStyle('muted')).setOrigin(0.5);

    // Init audio on first interaction
    this.input.once('pointerdown', () => {
      window.audioEngine.init();
      window.audioEngine.resume();
      window.audioEngine.restoreMuteState();
      mute.update(window.audioEngine.muted);
    });
  }

}

// =============================================================
// GAME OVER SCENE
// =============================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create(data) {
    const { width, height } = this.scale;
    const safe = data || {};
    const score = Number.isFinite(safe.score) ? safe.score : 0;
    const bestStreak = Number.isFinite(safe.bestStreak) ? safe.bestStreak : 0;
    const moves = Number.isFinite(safe.moves) ? safe.moves : 0;
    const isNewHigh = !!safe.isNewHigh;
    const mode = GameScene.VALID_MODES.has(safe.mode) ? safe.mode : 'timed';
    const feverCount = Number.isFinite(safe.feverCount) ? safe.feverCount : 0;
    const bestChain = Number.isFinite(safe.bestChain) ? safe.bestChain : 0;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.95);
    bg.fillRect(0, 0, width, height);

    // Game Over text
    const goLabel = mode === 'daily' ? 'DAILY COMPLETE' : 'TIME\'S UP';
    const goColor = mode === 'daily' ? '#ff6b35' : '#e74c3c';
    const goText = this.add.text(width / 2, height * 0.12, goLabel,
      textStyle('heading', { fontSize: '42px', color: goColor, strokeThickness: 5 }),
    ).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: goText,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Score card
    const cardY = height * 0.30;
    const cardH = 200;
    bg.fillStyle(0x12121f, 1);
    bg.fillRoundedRect(20, cardY, width - 40, cardH, 16);
    bg.lineStyle(2, 0x2a2a4a, 0.8);
    bg.strokeRoundedRect(20, cardY, width - 40, cardH, 16);

    // Score
    this.add.text(width / 2, cardY + 30, 'FINAL SCORE', textStyle('stat', { color: '#888888' })).setOrigin(0.5);

    const scoreText = this.add.text(width / 2, cardY + 65, '0',
      textStyle('popup', { fontSize: '48px', color: '#f1c40f' })).setOrigin(0.5);

    // Animate score counting up
    let displayScore = 0;
    this.tweens.addCounter({
      from: 0, to: score, duration: 1500, delay: 500,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        displayScore = Math.floor(tween.getValue());
        scoreText.setText(displayScore.toLocaleString());
      },
    });

    // New high score badge
    if (isNewHigh) {
      Icons.star(this, width / 2 - 95, cardY + 100, 12, 0xf1c40f);
      Icons.star(this, width / 2 + 95, cardY + 100, 12, 0xf1c40f);
      const badge = this.add.text(width / 2, cardY + 100, 'NEW HIGH SCORE',
        textStyle('badge', { fontSize: '18px', color: '#f1c40f', stroke: '', strokeThickness: 0 })).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: badge, alpha: 1, duration: 300, delay: 1800,
      });
      this.tweens.add({
        targets: badge, scale: 1.05, duration: 800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: 2000,
      });
    }

    // Stats — dynamic column count based on active features
    const statsY = cardY + 140;
    const statItems = [
      { label: 'MOVES', value: `${moves}` },
      { label: 'BEST STREAK', value: `${bestStreak}x` },
      { label: 'AVG/MOVE', value: `${Math.round(safeDiv(score, moves))}` },
    ];
    if (bestChain >= 2) statItems.push({ label: 'BEST CHAIN', value: `×${bestChain}` });
    if (feverCount > 0) statItems.push({ label: 'FEVERS', value: `${feverCount}🔥` });
    const statW = safeDiv(1, statItems.length + 1, 0.25);
    statItems.forEach((s, i) => {
      this.add.text(width * statW * (i + 1), statsY, `${s.label}\n${s.value}`, textStyle('stat')).setOrigin(0.5);
    });

    // ---- PERFORMANCE GRADE ----
    const gradeInfo = getGrade(score, bestStreak);
    const gradeColor = Phaser.Display.Color.HexStringToColor(gradeInfo.color).color;
    const gradeY = cardY + cardH + 44;

    // Glow ring behind grade letter
    const gradeGlow = this.add.graphics().setDepth(8);
    gradeGlow.fillStyle(gradeColor, 0.06);
    gradeGlow.fillCircle(width / 2, gradeY, 42);
    gradeGlow.lineStyle(2, gradeColor, 0.25);
    gradeGlow.strokeCircle(width / 2, gradeY, 42);
    gradeGlow.setAlpha(0);

    // Grade letter
    const gradeLetter = this.add.text(width / 2, gradeY, gradeInfo.grade,
      textStyle('heading', { fontSize: '56px', color: gradeInfo.color, strokeThickness: 5 }),
    ).setOrigin(0.5).setDepth(9).setScale(0);

    // Grade label below
    const gradeLabel = this.add.text(width / 2, gradeY + 36, gradeInfo.label,
      textStyle('badge', { fontSize: '12px', color: gradeInfo.color, letterSpacing: 3, stroke: '', strokeThickness: 0 }),
    ).setOrigin(0.5).setDepth(9).setAlpha(0);

    // Dramatic reveal — scale in with bounce after score counts up
    this.tweens.add({
      targets: gradeLetter, scale: 1, duration: 500, delay: 2000,
      ease: 'Back.easeOut',
      onStart: () => gradeGlow.setAlpha(1),
    });
    this.tweens.add({
      targets: gradeLabel, alpha: 1, duration: 300, delay: 2300,
    });

    // S-grade gets pulsing glow
    if (gradeInfo.grade === 'S') {
      this.tweens.add({
        targets: gradeGlow, alpha: 0.4, duration: 800, delay: 2500,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: gradeLetter, scale: 1.06, duration: 1000, delay: 2500,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Persist best grade per mode
    const gradeKey = SK.BEST_GRADE(mode);
    const prevBest = SafeStorage.get(gradeKey, 'F');
    const gradeRank = 'SABCDF';
    if (gradeRank.indexOf(gradeInfo.grade) < gradeRank.indexOf(prevBest)) {
      SafeStorage.set(gradeKey, gradeInfo.grade);
    }

    // Daily Challenge badge — show daily-specific info
    if (mode === 'daily') {
      const dailyBest = DailyChallenge.bestScore();
      const dailyTotal = DailyChallenge.totalCompleted();
      const dailyY = gradeY + 56;
      this.add.text(width / 2, dailyY, `DAILY — ${DailyChallenge.displayDate()}`,
        textStyle('badge', { fontSize: '14px', color: '#ff6b35', stroke: '', strokeThickness: 0 })).setOrigin(0.5);
      if (dailyTotal > 1) {
        this.add.text(width / 2, dailyY + 18, `${dailyTotal} dailies completed`,
          textStyle('label', { color: '#555555' })).setOrigin(0.5);
      }
    }

    // Streak tier character (compact, beside grade)
    const tierLevel = getStreakLevel(bestStreak);
    if (tierLevel && window.characters) {
      const char = window.characters[tierLevel.char];
      if (char) {
        const charGfx = this.add.graphics();
        char.draw(charGfx, width - 55, gradeY - 8, 0.65);
        this.add.text(width - 55, gradeY + 30, char.name, {
          fontSize: '10px', fontFamily: UI_FONT,
          fontStyle: 'italic', color: tierLevel.color,
        }).setOrigin(0.5);
      }
    }

    // Buttons
    const btnY1 = height * 0.78;
    const btnW = width - 80;
    createButton(this, { x: width / 2, y: btnY1, width: btnW, height: 42,
      text: 'PLAY AGAIN', color: '#2ecc71',
      iconFn: (s, bx, by) => Icons.play(s, bx, by, 14, 0x2ecc71),
      callback: () => this.scene.start('GameScene', { mode: mode || 'timed' }),
    });
    createButton(this, { x: width / 2, y: btnY1 + 50, width: btnW, height: 42,
      text: 'SHARE SCORE', color: '#3498db',
      iconFn: (s, bx, by) => Icons.share(s, bx, by, 14, 0x3498db),
      callback: () => this.shareScore(score, bestStreak, moves, mode, feverCount, bestChain),
    });
    createButton(this, { x: width / 2, y: btnY1 + 100, width: btnW, height: 42,
      text: 'MENU', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
      callback: () => this.scene.start('TitleScene'),
    });

    // Confetti on new high
    if (isNewHigh) {
      this.time.addEvent({
        delay: 100, repeat: 30,
        callback: () => {
          const p = this.add.image(
            Phaser.Math.Between(0, width),
            -10, 'star'
          );
          p.setTint(COLORS[Phaser.Math.Between(0, COLORS.length - 1)]);
          p.setScale(Phaser.Math.FloatBetween(0.3, 0.8));
          this.tweens.add({
            targets: p,
            y: height + 20,
            x: p.x + Phaser.Math.Between(-60, 60),
            rotation: Phaser.Math.FloatBetween(-3, 3),
            duration: Phaser.Math.Between(1500, 3000),
            onComplete: () => p.destroy(),
          });
        }
      });
    }
  }

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
    const { width, height } = this.scale;
    const bg = this.add.graphics().setDepth(60);
    bg.fillStyle(0x2ecc71, 0.9);
    bg.fillRoundedRect(width / 2 - 100, height - 50, 200, 32, 8);
    const text = this.add.text(width / 2, height - 34, message, {
      fontSize: '14px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#ffffff',
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
    const { width, height } = this.scale;
    this.stepIndex = 0;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, width, height);

    const steps = [
      {
        title: 'SWAP BUBBLES',
        desc: 'Swipe a bubble in any direction to swap it with its neighbor.\n\nOr tap one bubble, then tap an adjacent one.',
        draw: (scene) => {
          // Draw two bubbles with an arrow between them
          const cx = width / 2;
          const cy = height * 0.45;
          const b1 = scene.add.image(cx - 35, cy, 'bubble_0').setScale(1.2);
          const b2 = scene.add.image(cx + 35, cy, 'bubble_3').setScale(1.2);
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
            const b = scene.add.image(cx - 50 + i * 50, cy, 'bubble_1').setScale(1.1);
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
            items.push(scene.add.image(cx - 72 + i * 48, cy, 'bubble_4').setScale(0.9));
          }
          // Arrow pointing to power-up result
          const arrow = scene.add.graphics();
          arrow.lineStyle(2, 0xffffff, 0.5);
          arrow.lineBetween(cx + 60, cy, cx + 80, cy);
          arrow.fillStyle(0xffffff, 0.5);
          arrow.fillTriangle(cx + 80, cy - 4, cx + 80, cy + 4, cx + 86, cy);
          items.push(arrow);
          // Result bubble with overlay
          const result = scene.add.image(cx + 105, cy, 'bubble_4').setScale(1.1);
          items.push(result);
          scene.tweens.add({
            targets: result, scale: 1.3, duration: 800, yoyo: true, repeat: -1,
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
          const colors = ['#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'];
          labels.forEach((label, i) => {
            const t = scene.add.text(cx, cy - 30 + i * 28, label, {
              fontSize: '16px', fontFamily: UI_FONT,
              fontStyle: 'bold', color: colors[i],
              stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);
            items.push(t);
          });
          return items;
        }
      },
      {
        title: 'YOU\'RE READY',
        desc: 'Start with Zen Mode to practice, or jump into Timed Mode for the challenge.\n\nChase high scores. Unlock characters. Go crazy.',
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
      dot.fillStyle(i === 0 ? 0xf1c40f : 0x333333, 1);
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
        dot.fillStyle(i === idx ? 0xf1c40f : 0x333333, 1);
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
      nextBg.fillStyle(0x1a1a2e, 1);
      nextBg.fillRoundedRect(width / 2 - nextW / 2, navY - 20, nextW, 40, 10);
      nextBg.lineStyle(2, 0xf1c40f, 0.5);
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
      textStyle('muted', { fontSize: '13px', color: '#555555' })).setOrigin(1, 0).setInteractive();
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
    const { width, height } = this.scale;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add.text(width / 2, 30, 'HOW TO PLAY', textStyle('heading')).setOrigin(0.5);

    const sections = [
      {
        title: 'CONTROLS',
        color: '#3498db',
        items: [
          'Swipe a bubble to swap with its neighbor',
          'Or tap two adjacent bubbles to swap them',
          'Match 3+ same-color bubbles to pop them',
        ]
      },
      {
        title: 'POWER-UPS',
        color: '#f1c40f',
        items: [
          'Match 4 → LINE CLEAR (entire row/column)',
          'Match 5+ → BOMB (3x3 explosion)',
          'L or T shape → COLOR NUKE (all of one color)',
          'Match a power-up bubble to activate it',
        ]
      },
      {
        title: 'STREAKS',
        color: '#e74c3c',
        items: [
          'Chain matches without missing to build streaks',
          'Higher streaks = bigger score multiplier',
          '3x Kira / 5x Blaze / 8x Ronin / 12x Empress',
        ]
      },
      {
        title: 'FEVER MODE',
        color: '#ffd700',
        items: [
          'Chain matches to fill the FEVER meter (left bar)',
          'At 100% → FEVER MODE activates (2× score!)',
          'Keep matching during fever to extend the timer',
          'Meter drains when idle — stay aggressive',
        ]
      },
      {
        title: 'STRATEGY',
        color: '#2ecc71',
        items: [
          'Focus on the bottom — more cascade potential',
          'Save power-ups for chain moments',
          'In Timed mode, speed > perfection',
        ]
      },
    ];

    let yPos = 70;
    sections.forEach(section => {
      // Section card
      const cardH = 16 + section.items.length * 22 + 10;
      bg.fillStyle(0x12121f, 0.9);
      bg.fillRoundedRect(15, yPos, width - 30, cardH, 10);
      bg.lineStyle(1, Phaser.Display.Color.HexStringToColor(section.color).color, 0.3);
      bg.strokeRoundedRect(15, yPos, width - 30, cardH, 10);

      this.add.text(25, yPos + 8, section.title,
        textStyle('badge', { color: section.color, stroke: '', strokeThickness: 0 }));

      section.items.forEach((item, i) => {
        this.add.text(25, yPos + 28 + i * 22, `•  ${item}`,
          textStyle('muted', { color: '#bbbbbb', wordWrap: { width: width - 60 } }));
      });

      yPos += cardH + 8;
    });

    // Back button — uses shared createButton factory
    createButton(this, { x: width / 2, y: height - 40, width: 160, height: 36, radius: 8,
      text: 'BACK', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xffffff),
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
    const { width, height } = this.scale;
    drawDarkGridBg(this);

    // Header
    this.add.text(width / 2, height * 0.07, 'YOUR LEGACY',
      textStyle('heading', { color: '#f1c40f' })).setOrigin(0.5);

    this.add.text(width / 2, height * 0.12, 'lifetime stats',
      textStyle('muted', { color: '#555555', letterSpacing: 3 })).setOrigin(0.5);

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
    g.fillStyle(0x12121f, 1);
    g.fillRoundedRect(cardX, cardTop, cardW, 300, 12);
    g.lineStyle(1.5, 0x2a2a4a, 0.6);
    g.strokeRoundedRect(cardX, cardTop, cardW, 300, 12);

    // Stat rows — each with label, value, and animated bar
    const rows = [
      { label: 'GAMES PLAYED', value: stats.totalGames, sub: `${stats.gamesTimed} timed / ${stats.gamesZen} zen`, color: '#3498db', max: Math.max(stats.totalGames, 1) },
      { label: 'HIGH SCORE', value: stats.highScore, sub: null, color: '#f1c40f', max: Math.max(stats.highScore, 1) },
      { label: 'TOTAL SCORE', value: stats.totalScore, sub: stats.totalGames > 0 ? `avg ${Math.round(safeDiv(stats.totalScore, stats.totalGames))}/game` : null, color: '#2ecc71', max: Math.max(stats.totalScore, 1) },
      { label: 'BUBBLES POPPED', value: stats.totalPops, sub: stats.totalGames > 0 ? `avg ${Math.round(safeDiv(stats.totalPops, stats.totalGames))}/game` : null, color: '#e74c3c', max: Math.max(stats.totalPops, 1) },
      { label: 'BEST STREAK', value: `${stats.bestStreak}x`, sub: null, color: '#9b59b6', max: Math.max(stats.bestStreak, 1), raw: stats.bestStreak },
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
        this.add.text(cardX + 16, ry + 18, row.sub, textStyle('label', { color: '#444444' }));
      }

      // Animated bar
      const barY = ry + 34;
      g.fillStyle(0x1a1a2e, 1);
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
        fontSize: '10px', fontFamily: UI_FONT, color: '#555555', letterSpacing: 2,
      }).setOrigin(0.5);
      const gInfo = GRADES.find(g => g.grade === b.grade) || { color: '#333333' };
      const gl = this.add.text(bx, badgeY + 22, b.grade, {
        fontSize: '30px', fontFamily: UI_FONT, fontStyle: 'bold',
        color: gInfo.color || '#333333', stroke: '#000000', strokeThickness: 3,
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
      textStyle('heading', { fontSize: '20px', color: '#f1c40f' })).setOrigin(0.5);
    this.add.text(width / 2, achTop + 24, `${unlocked} / ${total} unlocked`,
      textStyle('muted', { color: unlocked === total ? '#2ecc71' : '#555555' })).setOrigin(0.5);

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
      dot.fillStyle(done ? Phaser.Display.Color.HexStringToColor(ach.color).color : 0x2a2a4a, done ? 0.9 : 0.4);
      dot.fillCircle(ax - achColW / 2 + 12, ay + 6, 5);
      if (done) {
        dot.fillStyle(0xffffff, 0.7);
        dot.fillCircle(ax - achColW / 2 + 12, ay + 5, 1.5);
      }

      // Name + description
      this.add.text(ax - achColW / 2 + 24, ay - 2, ach.name,
        textStyle('badge', { fontSize: '11px', color: done ? ach.color : '#444444', stroke: '', strokeThickness: 0 }));
      this.add.text(ax - achColW / 2 + 24, ay + 12, ach.desc,
        textStyle('label', { fontSize: '8px', color: done ? '#777777' : '#333333', letterSpacing: 0 }));
    });

    // Back button
    createButton(this, { x: width / 2, y: height * 0.92, width: width - 60, height: 44, radius: 12,
      text: 'BACK TO MENU', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
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
    const { width, height } = this.scale;

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

    // ---- HYPE BAR ----
    this.hypeBar = this.add.container(0, 0);

    const hypeBackground = this.add.graphics();
    hypeBackground.fillStyle(0x12121f, 0.9);
    hypeBackground.fillRoundedRect(10, 8, width - 20, HYPE_BAR_HEIGHT - 16, 12);
    hypeBackground.lineStyle(2, 0x2a2a4a, 0.6);
    hypeBackground.strokeRoundedRect(10, 8, width - 20, HYPE_BAR_HEIGHT - 16, 12);
    this.hypeBar.add(hypeBackground);

    this.streakText = this.add.text(width / 2, 35, '',
      textStyle('heading')).setOrigin(0.5).setAlpha(0);
    this.hypeBar.add(this.streakText);

    this.adlibText = this.add.text(width / 2, 75, '',
      textStyle('stat', { fontSize: '20px', fontStyle: 'italic' })).setOrigin(0.5).setAlpha(0);
    this.hypeBar.add(this.adlibText);

    // Character name display
    this.charNameText = this.add.text(20, 95, '',
      textStyle('muted', { color: '#666666', fontStyle: 'italic' })).setAlpha(0);
    this.hypeBar.add(this.charNameText);

    this.characterGfx = this.add.graphics();
    this.characterGfx.setAlpha(0);
    this.hypeBar.add(this.characterGfx);

    // ---- TIMER (timed + daily modes) ----
    if (this.gameMode === 'timed' || this.gameMode === 'daily') {
      this.timerBg = this.add.graphics();
      this.timerBg.fillStyle(0x2ecc71, 1);
      this.timerBg.fillRect(0, HYPE_BAR_HEIGHT, width, 4);

      this.timerText = this.add.text(width / 2, HYPE_BAR_HEIGHT + 12, `${GAME_TIME}s`,
        textStyle('badge', { fontSize: '16px', color: '#2ecc71' })).setOrigin(0.5, 0);

      // Timer event
      this.timerEvent = this.time.addEvent({
        delay: 1000, repeat: GAME_TIME - 1,
        callback: () => {
          this.timeLeft--;
          this.updateTimer();
          if (this.timeLeft <= 0) this.endGame();
        }
      });
    }

    // ---- SCORE / UI ----
    // Score bar background
    const scoreBg = this.add.graphics();
    scoreBg.fillStyle(0x0d0d1a, 0.9);
    scoreBg.fillRect(0, height - 65, width, 65);
    scoreBg.lineStyle(1, 0x1a1a2e, 0.5);
    scoreBg.lineBetween(0, height - 65, width, height - 65);

    this.scoreText = this.add.text(20, height - 55, 'SCORE: 0', textStyle('accent'));

    this.streakCounter = this.add.text(width - 20, height - 55, '',
      textStyle('stat', { fontSize: '16px', color: '#888888' })).setOrigin(1, 0);

    this.bestStreakText = this.add.text(width - 20, height - 33, '',
      textStyle('muted', { color: '#555555' })).setOrigin(1, 0);

    // Mode indicator
    if (this.gameMode === 'zen') {
      this.add.text(width / 2, HYPE_BAR_HEIGHT + 12, 'ZEN MODE',
        textStyle('muted', { color: '#3498db' })).setOrigin(0.5, 0);
    } else if (this.gameMode === 'daily') {
      const dailyLabel = this.add.text(width / 2, HYPE_BAR_HEIGHT + 12,
        `DAILY — ${DailyChallenge.displayDate()}`,
        textStyle('badge', { fontSize: '12px', color: '#ff6b35' })).setOrigin(0.5, 0);
      this.tweens.add({ targets: dailyLabel, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // ---- POWER-UP OVERLAY (drawn each frame for pulsing effects) ----
    this.powerUpOverlay = this.add.graphics();
    this.powerUpOverlay.setDepth(3);

    // ---- BUILD GRID ----
    this.bubbleContainer = this.add.container(0, 0);
    this.buildGrid();

    // ---- INPUT ----
    this.swipeStart = null;
    this.swipeBubble = null;
    this.input.on('gameobjectdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);

    // Ambient particles
    this.spawnAmbientParticles();

    // ---- HUD TOOLBAR (pause / hint / mute) ----
    const tbSize = 36;
    const tbY = HYPE_BAR_HEIGHT + 18;
    const pauseBtnX = width - 30;
    const hintBtnX = pauseBtnX - tbSize - 8;
    const muteBtnX = pauseBtnX - (tbSize + 8) * 2;

    // Pause
    const pauseBtn = createToolbarBtn(this, {
      x: pauseBtnX, y: tbY, size: tbSize,
      iconFn: (s, bx, by) => Icons.pause(s, bx, by, 20, 0xaaaaaa),
      callback: () => this.togglePause(),
    });
    this.pauseBtnBg = pauseBtn.bg;
    this.pauseIconGfx = pauseBtn.icon;

    // Hint
    this.maxHints = this.gameMode === 'zen' ? Infinity : 3;
    const hintBtn = createToolbarBtn(this, {
      x: hintBtnX, y: tbY, size: tbSize,
      iconFn: (s, bx, by) => Icons.hint(s, bx, by, 20, 0xf1c40f),
      callback: () => this.triggerHint(),
    });
    this.hintBtnBg = hintBtn.bg;
    this.hintIconGfx = hintBtn.icon;

    this.hintCountText = this.add.text(hintBtnX + 12, tbY + 10, this.maxHints === Infinity ? '∞' : `${this.maxHints}`,
      textStyle('badge', { fontSize: '10px', color: '#f1c40f' })).setOrigin(0.5).setDepth(42);

    // Mute — uses shared createMuteToggle for icon swap
    const gameMute = createMuteToggle(this, muteBtnX, tbY, { onColor: 0xaaaaaa, depth: 41 });
    const muteBtn = createToolbarBtn(this, {
      x: muteBtnX, y: tbY, size: tbSize,
      callback: () => gameMute.update(window.audioEngine.toggleMute()),
    });
    this.muteBtnBg = muteBtn.bg;

    // Hint overlay graphics (drawn in update loop)
    this.hintGfx = this.add.graphics().setDepth(4);

    // Idle timer — auto-hint after 5s of inactivity
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

    // ---- TIPS DISPLAY (shows rotating tips at bottom) ----
    this.tipIndex = Phaser.Math.Between(0, TIPS.length - 1);
    this.tipText = this.add.text(width / 2, height - 12, TIPS[this.tipIndex],
      textStyle('label', { color: '#444444', fontStyle: 'italic', wordWrap: { width: width - 40 } }),
    ).setOrigin(0.5, 1).setDepth(1);

    // Rotate tips every 8 seconds
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

    // ---- MULTIPLIER BADGE (visible during active streaks) ----
    const mbX = width / 2;
    const mbY = height - 82;
    this.multBadge = this.add.container(mbX, mbY).setDepth(30).setAlpha(0);
    this.multRing = this.add.graphics();
    this.multBadge.add(this.multRing);
    this.multText = this.add.text(0, -1, '',
      textStyle('heading', { fontSize: '22px' })).setOrigin(0.5);
    this.multBadge.add(this.multText);
    this.multLabel = this.add.text(0, 18, 'MULTIPLIER',
      textStyle('label', { fontSize: '8px' })).setOrigin(0.5);
    this.multBadge.add(this.multLabel);

    // ---- FEVER METER (left-edge vertical bar) ----
    this.feverGfx = this.add.graphics().setDepth(35);
    const fmX = 6;
    const fmTop = GRID_OFFSET_Y;
    const fmH = GRID_ROWS * (BUBBLE_SIZE + BUBBLE_PAD) - 8;
    this.feverBarBounds = { x: fmX, y: fmTop, w: 8, h: fmH };
    this.feverLabelText = this.add.text(fmX + 4, fmTop - 14, 'FEVER',
      textStyle('label', { fontSize: '7px', color: '#444444', letterSpacing: 1 }))
      .setOrigin(0.5, 1).setDepth(36);
    this.feverPctText = this.add.text(fmX + 4, fmTop + fmH + 10, '',
      textStyle('badge', { fontSize: '9px', color: '#555555', stroke: '', strokeThickness: 0 }))
      .setOrigin(0.5, 0).setDepth(36);

    // Fever drain timer — meter decays when not matching
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
    const goText = this.add.text(width / 2, height / 2, 'GO!',
      textStyle('heading', { fontSize: '64px', color: '#f1c40f', strokeThickness: 6 })).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: goText, scale: 2, alpha: 0,
      duration: 800, ease: 'Quad.easeOut', delay: 300,
      onComplete: () => goText.destroy(),
    });
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

    const { width, height } = this.scale;

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
    card.fillStyle(0x12121f, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    card.lineStyle(2, 0x3a3a5e, 0.8);
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
      textStyle('label', { fontSize: '11px', color: '#555555', fontStyle: 'bold' })).setOrigin(0.5);
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
      text: 'RESUME', color: '#2ecc71', container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.play(s, bx, by, 14, 0x2ecc71),
      callback: () => this.resumeGame(),
    });

    // Restart
    createButton(this, { x: btnX, y: cardY + 270, width: btnW, height: btnH,
      text: 'RESTART', color: '#f1c40f', container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.restart(s, bx, by, 14, 0xf1c40f),
      callback: () => { this.cleanupPause(); window.audioEngine.stopBgBeat(); this.scene.restart({ mode: this.gameMode }); },
    });

    // Exit to menu
    createButton(this, { x: btnX, y: cardY + 330, width: btnW, height: btnH,
      text: 'EXIT TO MENU', color: '#e74c3c', container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.close(s, bx, by, 14, 0xe74c3c),
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

  update(time) {
    // Skip per-frame rendering while paused — avoids GPU work behind the
    // pause overlay and prevents visual flicker from animated effects.
    if (this.isPaused) return;
    this.renderPowerUpOverlays(time);
    this.renderFeverMeter(time);
    this.renderHintGlow(time);
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

    // Track background
    this.feverGfx.fillStyle(0x1a1a2e, 0.6);
    this.feverGfx.fillRoundedRect(fb.x, fb.y, fb.w, fb.h, 4);

    // Fill bar (bottom-up) with color stages
    if (fill > 0) {
      const fillH = (fill / 100) * fb.h;
      const fillY = fb.y + fb.h - fillH;
      const barColor = this.feverActive ? 0xffd700
        : fill > 80 ? 0xe74c3c
        : fill > 50 ? 0xf1c40f
        : fill > 25 ? 0x2ecc71
        : 0x3498db;

      const pulse = this.feverActive ? 0.7 + 0.3 * Math.sin(time * 0.008) : 0.85;
      this.feverGfx.fillStyle(barColor, pulse);
      this.feverGfx.fillRoundedRect(fb.x, fillY, fb.w, fillH, 4);

      // Bright edge highlight
      this.feverGfx.fillStyle(0xffffff, 0.15 * pulse);
      this.feverGfx.fillRect(fb.x + 1, fillY, 2, fillH);
    }

    // Fever active: pulsing gold border around entire game area
    if (this.feverActive) {
      const { width, height } = this.scale;
      const glow = 0.2 + 0.15 * Math.sin(time * 0.006);
      this.feverGfx.lineStyle(3, 0xffd700, glow);
      this.feverGfx.strokeRect(1, 1, width - 2, height - 2);
      this.feverGfx.lineStyle(1.5, 0xffd700, glow * 0.5);
      this.feverGfx.strokeRect(4, 4, width - 8, height - 8);
    }

    // Update percentage / countdown text
    if (!this.feverActive && fill > 0) {
      this.feverPctText.setText(`${Math.floor(fill)}%`);
      const pctColor = fill > 80 ? '#e74c3c' : fill > 50 ? '#f1c40f' : '#555555';
      this.feverPctText.setColor(pctColor);
    } else if (this.feverActive) {
      const secs = Math.ceil(this.feverTimer / 1000);
      this.feverPctText.setText(`${secs}s`);
      this.feverPctText.setColor('#ffd700');
    } else {
      this.feverPctText.setText('');
    }
    this.feverLabelText.setColor(this.feverActive ? '#ffd700' : '#444444');
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
    const hintColor = 0xf1c40f;

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
    const { width } = this.scale;
    const pct = this.timeLeft / GAME_TIME;

    // Color transition: green → yellow → red
    let color;
    if (pct > 0.5) color = '#2ecc71';
    else if (pct > 0.25) color = '#f1c40f';
    else color = '#e74c3c';

    this.timerText.setText(`${this.timeLeft}s`);
    this.timerText.setColor(color);

    // Timer bar
    this.timerBg.clear();
    const barColor = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf1c40f : 0xe74c3c;
    this.timerBg.fillStyle(barColor, 1);
    this.timerBg.fillRect(0, HYPE_BAR_HEIGHT, width * pct, 4);

    // Urgency shake when low
    if (this.timeLeft <= 10 && this.timeLeft > 0) {
      this.cameras.main.shake(50, 0.001);
    }
  }

  // -----------------------------------------------------------
  // LIVE MILESTONES — fire once per game when records are broken
  // -----------------------------------------------------------
  checkMilestones() {
    // New high score — only fires if there was a previous record to beat
    if (!this.highScoreNotified && this.prevHighScore > 0 && this.score > this.prevHighScore) {
      this.highScoreNotified = true;
      this.showMilestoneBanner('NEW HIGH SCORE!', '#f1c40f', 0xf1c40f);
    }
    // New best streak — only fires if there was a previous record to beat
    if (!this.bestStreakNotified && this.prevBestStreak > 0 && this.bestStreak > this.prevBestStreak) {
      this.bestStreakNotified = true;
      // Stagger if both fire on the same match
      const delay = this.highScoreNotified && this.score > this.prevHighScore ? 1800 : 0;
      this.time.delayedCall(delay, () => {
        this.showMilestoneBanner(`BEST STREAK: ${this.bestStreak}x`, '#e74c3c', 0xe74c3c);
      });
    }
  }

  /**
   * Achievement toast — slides in from the top with icon + text, auto-dismisses.
   * Staggered via delay param so multiple unlocks don't overlap.
   */
  showAchievementToast(ach, delay = 0) {
    const { width } = this.scale;
    const toastY = HYPE_BAR_HEIGHT + 48;
    const toastW = Math.min(width - 30, 280);
    const toastX = width / 2;

    const container = this.add.container(toastX, toastY - 50).setDepth(70).setAlpha(0);

    // Background card
    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 0.95);
    bg.fillRoundedRect(-toastW / 2, -18, toastW, 36, 10);
    const borderColor = Phaser.Display.Color.HexStringToColor(ach.color).color;
    bg.lineStyle(1.5, borderColor, 0.6);
    bg.strokeRoundedRect(-toastW / 2, -18, toastW, 36, 10);
    container.add(bg);

    // Star icon (left side)
    const star = Icons.star(this, -toastW / 2 + 20, 0, 14, borderColor);
    star.setDepth(71);
    container.add(star);

    // Achievement text
    const label = this.add.text(4, -1, ach.name, textStyle('badge', { fontSize: '14px', color: ach.color })).setOrigin(0.5);
    container.add(label);

    // Slide in + fade
    this.tweens.add({
      targets: container, y: toastY, alpha: 1,
      duration: 400, delay, ease: 'Back.easeOut',
    });
    // Dismiss
    this.tweens.add({
      targets: container, y: toastY - 30, alpha: 0,
      duration: 300, delay: delay + 2200, ease: 'Quad.easeIn',
      onComplete: () => container.destroy(true),
    });

    // Play a satisfying unlock sound
    if (window.audioEngine?.initialized) {
      const t = window.audioEngine.ctx.currentTime + delay / 1000;
      window.audioEngine._tone(t, { type: 'triangle', freq: 880, vol: 0.12, dur: 0.15 });
      window.audioEngine._tone(t + 0.08, { type: 'triangle', freq: 1174.66, vol: 0.1, dur: 0.2 });
    }
  }

  showMilestoneBanner(text, colorStr, colorHex) {
    const { width, height } = this.scale;
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
      p.setScale(Phaser.Math.FloatBetween(0.2, 0.5));
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

    const bubble = this.add.image(pos.x, animate ? -50 : pos.y, bubbleKey(colorIdx));
    bubble.setInteractive();
    bubble.setData('row', row);
    bubble.setData('col', col);
    bubble.setData('colorIdx', colorIdx);
    bubble.setData('powerUp', POWERUP_TYPES.NONE);
    bubble.setScale(0.95);

    this.bubbleContainer.add(bubble);
    this.grid[row][col] = bubble;

    if (animate) {
      bubble.setAlpha(0);
      this.tweens.add({
        targets: bubble, y: pos.y, alpha: 1,
        duration: 300 + row * 40, ease: 'Bounce.easeOut',
        delay: col * 30 + row * 20,
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

    const dx = pointer.x - this.swipeStart.x;
    const dy = pointer.y - this.swipeStart.y;
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
    this.tweens.add({
      targets: bubble, scale: on ? 1.15 : 0.95,
      duration: 150, ease: 'Back.easeOut',
    });
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
          this.cameras.main.shake(100, 0.003);
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
    trail.setScale(0.6);
    trail.setDepth(1);
    this.tweens.add({
      targets: trail, x: to.x, y: to.y, alpha: 0, scale: 0.2,
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
          this.popBubble(bubble);
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
          this.popBubble(b);
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
          targets: bubble, scale: 1.3, duration: 150,
          yoyo: true, ease: 'Back.easeOut',
        });
        // Show power-up name
        const pos = this.gridToWorld(pu.row, pu.col);
        const label = this.add.text(pos.x, pos.y - 30, POWERUP_NAMES[pu.type],
          textStyle('accent', { fontSize: '14px', color: '#ffd700' })).setOrigin(0.5).setDepth(25);
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
    this.scoreText.setText(`SCORE: ${this.score.toLocaleString()}`);

    // Score popup — append fever indicator when active
    if (matchGroups[0] && matchGroups[0][0]) {
      const first = matchGroups[0][0];
      const label = this.feverActive ? `+${points} 🔥` : `+${points}`;
      this.showScorePopup(first.x, first.y, label, this.streak);
    }

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
    this.cameras.main.shake(120 + this.streak * 20, shakeIntensity);

    // Full-screen flash on 8+ streak
    if (this.streak >= 8) {
      this.screenFlash(this.streak >= 12 ? 0x9b59b6 : 0xe74c3c);
    }

    this.updateStreakUI();
    this.triggerHypeBar();

    // Drop + refill cycle
    this.time.delayedCall(300, () => {
      this.dropBubbles();
      this.time.delayedCall(350, () => {
        this.refillGrid();
        this.time.delayedCall(400, () => {
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
    const { width } = this.scale;

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
      ring.lineStyle(4, 0xff4444, 1);
      ring.strokeCircle(pos.x, pos.y, 10);
      this.tweens.add({
        targets: ring, scale: 4, alpha: 0, duration: 400,
        onComplete: () => ring.destroy(),
      });
      this.cameras.main.shake(200, 0.015);
    } else if (type === POWERUP_TYPES.NUKE) {
      // Full screen color flash
      this.screenFlash(0xffd700);
      this.cameras.main.shake(300, 0.02);
    }
  }

  screenFlash(color) {
    const { width, height } = this.scale;
    const flash = this.add.graphics();
    flash.setDepth(50);
    flash.fillStyle(color, 0.3);
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

    // Announce
    const { width, height } = this.scale;
    const banner = this.add.text(width / 2, height * 0.4, 'FEVER MODE',
      textStyle('heading', { fontSize: '38px', color: '#ffd700', strokeThickness: 6 }),
    ).setOrigin(0.5).setDepth(55).setScale(0);

    const sub = this.add.text(width / 2, height * 0.4 + 38, '2× SCORE',
      textStyle('badge', { fontSize: '16px', color: '#ffd700', stroke: '', strokeThickness: 0 }),
    ).setOrigin(0.5).setDepth(55).setAlpha(0);

    this.tweens.add({
      targets: banner, scale: 1.1, duration: 350, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner, scale: 1.6, alpha: 0,
          duration: 600, delay: 600, ease: 'Quad.easeIn',
          onComplete: () => banner.destroy(),
        });
      },
    });
    this.tweens.add({
      targets: sub, alpha: 1, duration: 200, delay: 200,
      onComplete: () => {
        this.tweens.add({
          targets: sub, alpha: 0, y: sub.y - 20,
          duration: 400, delay: 800, ease: 'Quad.easeIn',
          onComplete: () => sub.destroy(),
        });
      },
    });

    this.screenFlash(0xffd700);
    this.cameras.main.shake(200, 0.012);
    window.audioEngine.playStreakHit(12);
  }

  deactivateFever() {
    this.feverActive = false;
    this.feverTimer = 0;
    this.feverMeter = 0;

    // Fade-out notice
    const { width, height } = this.scale;
    const endText = this.add.text(width / 2, height * 0.38, 'FEVER ENDED',
      textStyle('badge', { fontSize: '14px', color: '#888888', stroke: '', strokeThickness: 0 }),
    ).setOrigin(0.5).setDepth(55);
    this.tweens.add({
      targets: endText, alpha: 0, y: endText.y - 20,
      duration: 800, delay: 400, ease: 'Quad.easeOut',
      onComplete: () => endText.destroy(),
    });
  }

  popBubble(bubble) {
    if (!bubble || !bubble.active) return;
    const row = bubble.getData('row');
    const col = bubble.getData('col');
    const colorIdx = bubble.getData('colorIdx');

    this.spawnPopParticles(bubble.x, bubble.y, COLORS[colorIdx]);

    this.tweens.add({
      targets: bubble, scale: 1.4, alpha: 0, duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => bubble.destroy(),
    });

    if (this.grid[row] && this.grid[row][col] === bubble) {
      this.grid[row][col] = null;
    }
  }

  spawnPopParticles(x, y, color) {
    const feverBoost = this.feverActive ? 1.5 : 1;
    const count = Math.floor((6 + this.streak * 2) * feverBoost);
    for (let i = 0; i < Math.min(count, 32); i++) {
      const p = this.add.image(x, y, (this.streak >= 8 || this.feverActive) ? 'star' : 'particle');
      p.setTint(this.feverActive ? Phaser.Math.RND.pick([color, 0xffd700, 0xffaa00]) : color);
      p.setScale(Phaser.Math.FloatBetween(0.3, 0.8) * feverBoost);
      p.setDepth(10);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(60, 150 + this.streak * 15);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scale: 0,
        duration: Phaser.Math.Between(300, 600),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  showScorePopup(x, y, text, streak) {
    const level = getStreakLevel(streak);
    const color = level ? level.color : '#ffffff';
    const size = level ? Math.min(level.size, 40) : 22;

    const popup = this.add.text(x, y, text,
      textStyle('popup', { fontSize: `${size}px`, color })).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: popup, y: y - 60, alpha: 0, scale: 1.3,
      duration: 800, ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  /**
   * Cascade Chain Banner — graffiti-style "CHAIN ×N" with glitch offset.
   * Fires when gravity-induced matches chain (depth ≥ 2).
   * Visual intensity scales with chain depth:
   *   ×2 = cyan, ×3 = gold, ×4+ = magenta with stronger shake.
   */
  showChainBanner(depth) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2 - 40;
    const label = `CHAIN ×${depth}`;

    // Escalating color tiers — cyan → gold → magenta
    const tierColors = ['#00e5ff', '#ffd700', '#ff00ff'];
    const color = tierColors[Math.min(depth - 2, tierColors.length - 1)];
    const fontSize = Math.min(28 + depth * 4, 48);

    // Glitch shadow — offset duplicate behind the main text
    const glitch = this.add.text(cx + 3, cy + 2, label,
      textStyle('popup', { fontSize: `${fontSize}px`, color, fontStyle: 'bold italic' })
    ).setOrigin(0.5).setAlpha(0.4).setDepth(29);

    // Main chain text
    const main = this.add.text(cx, cy, label,
      textStyle('popup', { fontSize: `${fontSize}px`, color: '#ffffff', fontStyle: 'bold italic' })
    ).setOrigin(0.5).setDepth(30);

    // Chain bonus indicator below
    const bonus = this.add.text(cx, cy + fontSize * 0.7, `+${(depth - 1) * 25} CHAIN BONUS`,
      textStyle('badge', { fontSize: '13px', color })
    ).setOrigin(0.5).setAlpha(0).setDepth(30);

    // Scale-in with spring ease
    main.setScale(0.3);
    glitch.setScale(0.3);
    this.tweens.add({
      targets: [main, glitch], scale: 1, duration: 300, ease: 'Back.easeOut',
    });

    // Bonus text fade in
    this.tweens.add({
      targets: bonus, alpha: 1, y: cy + fontSize * 0.6,
      duration: 250, delay: 150, ease: 'Quad.easeOut',
    });

    // Glitch jitter — rapid offset oscillation
    this.tweens.add({
      targets: glitch, x: cx + Phaser.Math.Between(-4, 4),
      duration: 60, yoyo: true, repeat: 3,
    });

    // Extra camera punch for deep chains (×3+)
    if (depth >= 3) {
      this.cameras.main.shake(200, 0.006 + depth * 0.003);
    }

    // Fade out together
    this.tweens.add({
      targets: [main, glitch, bonus],
      alpha: 0, y: cy - 30, scale: 1.15,
      duration: 600, delay: 700, ease: 'Quad.easeIn',
      onComplete: () => { main.destroy(); glitch.destroy(); bonus.destroy(); },
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
              duration: 200 + dropDist * 30, ease: 'Bounce.easeOut',
              onComplete: () => window.audioEngine.playLand(dropDist * 0.02),
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
  // HYPE BAR — Characters + streak reactions
  // -----------------------------------------------------------
  triggerHypeBar() {
    const level = getStreakLevel(this.streak);
    if (!level) {
      this.streakText.setAlpha(0);
      this.adlibText.setAlpha(0);
      this.charNameText.setAlpha(0);
      return;
    }

    const { width } = this.scale;

    // Streak label
    this.streakText.setText(`${this.streak}x STREAK — ${level.label}`);
    this.streakText.setFontSize(level.size + 'px');
    this.streakText.setColor(level.color);
    this.streakText.setAlpha(1);
    this.streakText.setScale(0.5);
    this.tweens.add({
      targets: this.streakText, scale: 1, duration: 300, ease: 'Back.easeOut',
    });

    // Ad-lib
    const tier = getAdlibTier(this.streak);
    const lines = ADLIBS[tier];
    const adlib = lines[Phaser.Math.Between(0, lines.length - 1)];
    this.adlibText.setText(adlib);
    this.adlibText.setColor(level.color);
    this.adlibText.setAlpha(0);
    this.tweens.add({ targets: this.adlibText, alpha: 1, duration: 200, delay: 150 });

    // Character from characters.js
    this.characterGfx.clear();
    this.characterGfx.setAlpha(0);

    if (window.characters && window.characters[level.char]) {
      const char = window.characters[level.char];
      char.draw(this.characterGfx, width - 60, 10, 0.8);
      this.tweens.add({
        targets: this.characterGfx, alpha: 1, duration: 300, ease: 'Back.easeOut',
      });

      // Character name
      this.charNameText.setText(`${char.name}`);
      this.charNameText.setColor(level.color);
      this.charNameText.setAlpha(0);
      this.tweens.add({ targets: this.charNameText, alpha: 1, duration: 200, delay: 200 });
    } else {
      // Fallback placeholder
      const charColor = Phaser.Display.Color.HexStringToColor(level.color).color;
      this.characterGfx.setPosition(width - 80, 20);
      this.characterGfx.fillStyle(charColor, 0.8);
      this.characterGfx.fillCircle(30, 25, 18);
      this.characterGfx.fillRoundedRect(15, 45, 30, 35, 6);
      this.tweens.add({
        targets: this.characterGfx, alpha: 1, duration: 300, ease: 'Back.easeOut',
      });
    }

    // Fade out
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: [this.characterGfx, this.adlibText, this.charNameText],
        alpha: 0, duration: 400,
      });
    });

    if (this.streak >= 5) this.flashHypeBar(level.color);
    if (this.streak >= 8) this.spawnStreakParticles(level.color);
  }

  flashHypeBar(colorStr) {
    const { width } = this.scale;
    const flash = this.add.graphics();
    const color = Phaser.Display.Color.HexStringToColor(colorStr).color;
    flash.lineStyle(3, color, 0.8);
    flash.strokeRoundedRect(10, 8, width - 20, HYPE_BAR_HEIGHT - 16, 12);
    flash.setDepth(5);
    this.hypeBar.add(flash);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 600,
      onComplete: () => flash.destroy(),
    });
  }

  spawnStreakParticles(colorStr) {
    const { width } = this.scale;
    const color = Phaser.Display.Color.HexStringToColor(colorStr).color;
    for (let i = 0; i < 15; i++) {
      const p = this.add.image(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(10, HYPE_BAR_HEIGHT), 'star'
      );
      p.setTint(color);
      p.setScale(Phaser.Math.FloatBetween(0.2, 0.6));
      p.setDepth(6);
      p.setAlpha(0);
      this.tweens.add({
        targets: p, alpha: 1, y: p.y - 40, scale: 0,
        duration: Phaser.Math.Between(500, 1000), delay: i * 50,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  updateStreakUI() {
    if (this.streak > 1) {
      this.streakCounter.setText(`STREAK: ${this.streak}x`);
      const level = getStreakLevel(this.streak);
      this.streakCounter.setColor(level ? level.color : '#888888');
    } else {
      this.streakCounter.setText('');
    }
    if (this.bestStreak > 2) {
      this.bestStreakText.setText(`BEST: ${this.bestStreak}x`);
    }
    this.updateMultiplierBadge();
  }

  // -----------------------------------------------------------
  // MULTIPLIER BADGE — prominent visual for active score multiplier
  // -----------------------------------------------------------
  updateMultiplierBadge() {
    const mult = Math.min(this.streak, 10);
    if (mult < 2) {
      // Fade out when streak breaks
      if (this.multBadge.alpha > 0) {
        this.tweens.add({
          targets: this.multBadge, alpha: 0, scale: 0.6,
          duration: 300, ease: 'Quad.easeIn',
        });
        // Kill any active glow tween
        if (this._multGlowTween) { this._multGlowTween.stop(); this._multGlowTween = null; }
      }
      return;
    }

    // Resolve tier color
    const level = getStreakLevel(this.streak);
    const tierColor = level
      ? Phaser.Display.Color.HexStringToColor(level.color).color
      : 0x3a3a5e;
    const tierHex = level ? level.color : '#888888';

    // Redraw ring with tier color
    this.multRing.clear();
    const radius = 22 + Math.min(mult - 2, 8) * 1.5;  // grows slightly
    this.multRing.fillStyle(0x0a0a1a, 0.85);
    this.multRing.fillCircle(0, 0, radius);
    this.multRing.lineStyle(2, tierColor, 0.8);
    this.multRing.strokeCircle(0, 0, radius);
    // Inner glow ring on high multipliers
    if (mult >= 5) {
      this.multRing.lineStyle(1, tierColor, 0.3);
      this.multRing.strokeCircle(0, 0, radius + 4);
    }

    // Update text
    this.multText.setText(`×${mult}`);
    this.multText.setColor(tierHex);
    this.multText.setFontSize(mult >= 8 ? '28px' : mult >= 5 ? '25px' : '22px');

    // Show badge with bounce-in animation
    if (this.multBadge.alpha < 0.5) {
      this.multBadge.setScale(0.3).setAlpha(1);
      this.tweens.add({
        targets: this.multBadge, scale: 1,
        duration: 350, ease: 'Back.easeOut',
      });
    } else {
      // Punch scale on increment
      this.tweens.add({
        targets: this.multBadge, scale: 1.25,
        duration: 120, yoyo: true, ease: 'Quad.easeOut',
      });
    }

    // Pulsing glow at high multipliers (8+)
    if (mult >= 8 && !this._multGlowTween) {
      this._multGlowTween = this.tweens.add({
        targets: this.multBadge, scale: 1.08,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (mult < 8 && this._multGlowTween) {
      this._multGlowTween.stop();
      this._multGlowTween = null;
      this.multBadge.setScale(1);
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
    if (this.hintsUsed >= this.maxHints) {
      // Flash the counter red to signal exhaustion
      this.hintCountText.setColor('#e74c3c');
      this.time.delayedCall(400, () => this.hintCountText.setColor('#666666'));
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
      this.hintCountText.setColor('#666666');
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

    const { width, height } = this.scale;
    const shuffleText = this.add.text(width / 2, height / 2, 'SHUFFLE!',
      textStyle('heading', { fontSize: '36px', color: '#f1c40f', strokeThickness: 5 })).setOrigin(0.5).setDepth(30);

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
    const { width, height } = this.scale;
    this.time.addEvent({
      delay: 2000, loop: true,
      callback: () => {
        const p = this.add.image(Phaser.Math.Between(0, width), height + 10, 'particle');
        p.setTint(COLORS[Phaser.Math.Between(0, COLORS.length - 1)]);
        p.setAlpha(0.15);
        p.setScale(Phaser.Math.FloatBetween(0.3, 0.8));
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
const gameWidth = GRID_COLS * (BUBBLE_SIZE + BUBBLE_PAD) + GRID_OFFSET_X * 2;
const gameHeight = GRID_OFFSET_Y + GRID_ROWS * (BUBBLE_SIZE + BUBBLE_PAD) + 80;

const config = {
  type: Phaser.AUTO,
  width: gameWidth,
  height: gameHeight,
  parent: 'game-container',
  backgroundColor: '#0a0a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, StatsScene, TutorialScene, TipsScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);
