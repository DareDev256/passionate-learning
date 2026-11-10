// What's Poppin: bubble match game, restyled as part of Passionate Learning.
// Doodle bubbles on the equipped theme's ground, with the stickman cast reacting on a stage above the board.

// =============================================================
// CONSTANTS
// =============================================================
const GRID_COLS = 8;
const GRID_ROWS = 10;
// The crew IS the board: one head per cell, 52 wide on a 54 pitch, so a head and its neighbours almost touch.
const BUBBLE_SIZE = 52;
const BUBBLE_PAD = 2;
const CELL = BUBBLE_SIZE + BUBBLE_PAD;
const GRID_OFFSET_X = 16;
// Layout, top to bottom (logical units; the view is LW x LH):
// HUD row 0-60, timer bar 62-68, combo band 74-140 (multiplier, HOT meter, streak), board 148-710,
// crew tally strip 720-800, tip line at the bottom. There is no stage: the heads on the board are the cast.
const HUD_H = 60;
const TIMER_Y = 62;
const BAND_Y = 74;
const BAND_H = 66;
const BOARD_Y = 148;
const GRID_OFFSET_Y = BOARD_Y + 14;
const FEVER_BPM = 126;
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
    // The crew heads and the pop frames are drawn once, here, into two atlases for this theme.
    buildHeadAtlas(this, SafeStorage.get(SK.COLORBLIND, '0') === '1');
    buildPopAtlas(this);
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

    // Drifting crew heads behind everything.
    this.drifters = [];
    for (let i = 0; i < 12; i++) {
      const bx = Phaser.Math.Between(20, width - 20);
      const by = Phaser.Math.Between(40, height - 40);
      const h = addHead(this, bx, by, i % CREW.length, 'idle0');
      h.setAlpha(0.2).setScale(Phaser.Math.FloatBetween(0.5, 0.9) * BS).setDepth(-3);
      if (!this.reduce) this.tweens.add({ targets: h, y: by + Phaser.Math.Between(-24, 24), x: bx + Phaser.Math.Between(-16, 16), duration: Phaser.Math.Between(3000, 6000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Logo: a sticker, like the app's.
    this.add.text(width / 2, 52, "WHAT'S", textStyle('heading', { fontSize: '34px', color: P.ink, stroke: P.bg, strokeThickness: 0 })).setOrigin(0.5);
    const pop = this.add.text(width / 2, 104, 'POPPIN', textStyle('heading', { fontSize: '68px', color: P.hot, stroke: P.ink, strokeThickness: 8 })).setOrigin(0.5);
    if (!this.reduce) this.tweens.add({ targets: pop, scale: 1.04, angle: -1.5, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(width / 2, 154, 'match the crew  /  build streaks  /  hit fever', textStyle('label', { fontSize: '11px', letterSpacing: 1, color: P.muted })).setOrigin(0.5);

    // The crew waits on a little stage: six heads, each with its own name and habits.
    const sx = 10, sy = 172, sw = width - 20, sh = 190;
    const stage = this.add.graphics();
    stage.fillStyle(P.inkN, 1); stage.fillRoundedRect(sx, sy + 4, sw, sh, 14);
    stage.fillStyle(P.panelN, 1); stage.fillRoundedRect(sx, sy, sw, sh, 14);
    stage.lineStyle(3, P.inkN, 1); stage.strokeRoundedRect(sx, sy, sw, sh, 14);
    const gy = sy + sh - 44;
    stage.fillStyle(P.inkN, 0.55);
    for (let x = sx + 14; x < sx + sw - 10; x += 9) stage.fillRect(x, gy + 1, 3, 2);
    this.lineup = CREW.map((m, i) => {
      const x = sx + 37 + i * ((sw - 74) / 5), baseY = gy - 36;
      const shadow = this.add.ellipse(x, gy - 3, 40, 8, P.inkN, 0.35);
      const img = addHead(this, x, baseY, i, 'idle0').setScale(1.3 * BS);
      this.add.text(x, gy + 12, m.name.toUpperCase(), textStyle('label', { fontSize: '10px', color: P.muted, letterSpacing: 1 })).setOrigin(0.5, 0);
      return { crew: i, img, shadow, x, baseY, life: newLife(i + 1), mood: 'idle', moodEnd: 0, hop: 0 };
    });
    this.time.addEvent({ delay: 1800, loop: true, callback: () => {
      const m = Phaser.Math.RND.pick(this.lineup);
      m.mood = 'cheer0'; m.moodEnd = this.time.now + 800;
      if (!this.reduce) this.tweens.add({ targets: m, hop: 22, duration: 170, yoyo: true, ease: 'Quad.easeOut' });
    } });

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

  update(time) {
    const ptr = this.input.activePointer;
    (this.lineup || []).forEach((m) => {
      if (m.mood !== 'idle' && time > m.moodEnd) m.mood = 'idle';
      const px = ptr && ptr.x ? ptr.x / Z : null;
      const look = px !== null && Math.abs(px - m.x) > 30 ? Math.sign(px - m.x) : 0;
      m.img.setFrame(`${m.crew}_${lifeFrame(m.life, time, m.mood, look, this.reduce)}`);
      m.img.y = m.baseY - m.hop;
      m.shadow.setScale(1 - m.hop / 70, 1 - m.hop / 70);
    });
  }
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

    // The crew on the stage, reacting to the result: cheering if it went well, worried and then waving if not.
    const sx = 10, sy = 84, sw = width - 20, sh = 190;
    const stage = this.add.graphics();
    stage.fillStyle(P.inkN, 1); stage.fillRoundedRect(sx, sy + 4, sw, sh, 14);
    stage.fillStyle(P.panelN, 1); stage.fillRoundedRect(sx, sy, sw, sh, 14);
    stage.lineStyle(3, P.inkN, 1); stage.strokeRoundedRect(sx, sy, sw, sh, 14);
    const gy = sy + sh - 30;
    stage.fillStyle(P.inkN, 0.55);
    for (let x = sx + 14; x < sx + sw - 10; x += 9) stage.fillRect(x, gy + 1, 3, 2);
    this.good = good;
    this.fx = new PopFx(this);
    this.lineup = CREW.map((m, i) => {
      const x = sx + 37 + i * ((sw - 74) / 5), baseY = gy - 40;
      const shadow = this.add.ellipse(x, gy - 3, 40, 8, P.inkN, 0.35);
      const img = addHead(this, x, baseY, i, 'idle0').setScale(1.3 * BS);
      return { crew: i, img, shadow, x, baseY, life: newLife(i + 5), mood: good ? 'cheer0' : 'worry', moodEnd: good ? 1e9 : 1400, hop: 0 };
    });
    if (good) this.time.addEvent({ delay: 520, loop: true, callback: () => this.lineup.forEach((m, i) => this.time.delayedCall(i * 70, () => { m.mood = m.mood === 'cheer0' ? 'cheer1' : 'cheer0'; if (!this.reduce) this.tweens.add({ targets: m, hop: 26, duration: 160, yoyo: true, ease: 'Quad.easeOut' }); })) });

    // Score card
    const cardY = 296, cardH = 188;
    const card = this.add.graphics();
    card.fillStyle(P.inkN, 1); card.fillRoundedRect(20, cardY + 4, width - 40, cardH, 16);
    card.fillStyle(P.cardN, 1); card.fillRoundedRect(20, cardY, width - 40, cardH, 16);
    card.lineStyle(3, P.inkN, 1); card.strokeRoundedRect(20, cardY, width - 40, cardH, 16);

    this.add.text(width / 2, cardY + 22, 'FINAL SCORE', textStyle('label', { fontSize: '11px', letterSpacing: 3, color: P.muted })).setOrigin(0.5);
    const scoreText = this.add.text(width / 2, cardY + 62, '0', textStyle('popup', { fontSize: '52px', color: P.ink, strokeThickness: 0 })).setOrigin(0.5);
    // The count-up has weight: it ticks and thumps in chunks, slows as it nears the total, then slams.
    const sfx = this.fx;
    const finish = () => {
      if (this.countDone) return;
      this.countDone = true;
      scoreText.setText(score.toLocaleString());
      if (this.reduce) return;
      this.tweens.killTweensOf(scoreText);
      scoreText.setScale(1);
      this.tweens.add({ targets: scoreText, scale: 1.4, duration: 110, ease: 'Quad.easeOut', yoyo: true });
      this.cameras.main.shake(150, 0.006);
      sfx.stars(width / 2, cardY + 62, 14, 230, 1.3);
      if (this.good) sfx.headRain(isNewHigh ? 34 : 18, 20, width - 20, -20, height, -2);
      this.lineup.forEach((m, i) => this.tweens.add({ targets: m, hop: 28, duration: 150, delay: i * 40, yoyo: true, ease: 'Quad.easeOut' }));
      window.audioEngine.playStreakHit(this.good ? 12 : 3);
    };
    let lastChunk = -1;
    const countMs = this.reduce || score < 1 ? 1 : Math.min(2300, 900 + Math.log10(score + 10) * 380);
    const counter = this.tweens.addCounter({
      from: 0, to: score, duration: countMs, delay: 400, ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        const v = Math.floor(tw.getValue());
        scoreText.setText(v.toLocaleString());
        const chunk = Math.floor(v / Math.max(1, score / 22));
        if (chunk !== lastChunk && !this.reduce) {
          lastChunk = chunk;
          scoreText.setScale(1.1);
          this.tweens.add({ targets: scoreText, scale: 1, duration: 90, ease: 'Quad.easeOut' });
          window.audioEngine.playSelect();
        }
      },
      onComplete: finish,
    });
    // A tap skips to the total.
    this.input.once('pointerdown', () => { counter.stop(); finish(); });
    if (isNewHigh) {
      const badge = this.add.text(width / 2, cardY + 98, 'NEW HIGH SCORE', textStyle('badge', { fontSize: '16px', color: P.hot, stroke: '', strokeThickness: 0, letterSpacing: 2 })).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: badge, alpha: 1, duration: 300, delay: this.reduce ? 0 : 400 + countMs + 150 });
      if (!this.reduce) this.tweens.add({ targets: badge, scale: 1.06, duration: 700, yoyo: true, repeat: -1, delay: 2000 });
    }

    const stats = [{ l: 'MOVES', v: `${moves}` }, { l: 'STREAK', v: `${bestStreak}×` }, { l: 'PER MOVE', v: `${Math.round(safeDiv(score, moves))}` }, { l: 'CHAIN', v: `×${Math.max(1, bestChain)}` }];
    if (feverCount > 0) stats.push({ l: 'FEVERS', v: `${feverCount}` });
    const colW = (width - 70) / stats.length;
    stats.forEach((s, i) => {
      const cx = 35 + colW * (i + 0.5);
      this.add.text(cx, cardY + 132, s.v, textStyle('heading', { fontSize: '26px', color: P.ink, strokeThickness: 0 })).setOrigin(0.5);
      this.add.text(cx, cardY + 160, s.l, textStyle('label', { fontSize: '10px', letterSpacing: 1, color: P.muted })).setOrigin(0.5);
    });

    // Grade stamp, slammed on after the score lands.
    const gradeY = cardY + cardH + 52;
    const stamp = this.add.container(width / 2, gradeY).setScale(this.reduce ? 0 : 2.6).setAngle(-14).setAlpha(0);
    if (this.reduce) stamp.setScale(1).setAlpha(1).setAngle(-4);
    const ring = this.add.graphics();
    ring.fillStyle(P.inkN, 1); ring.fillCircle(0, 4, 42);
    ring.fillStyle(gradeInfo.grade === 'S' || gradeInfo.grade === 'A' ? P.hotN : P.cardN, 1); ring.fillCircle(0, 0, 42);
    ring.lineStyle(3, P.inkN, 1); ring.strokeCircle(0, 0, 42);
    const fillHex = gradeInfo.grade === 'S' || gradeInfo.grade === 'A' ? P.hot : P.card;
    const fn = parseInt(fillHex.slice(1), 16);
    const light = (0.2126 * ((fn >> 16) & 255) + 0.7152 * ((fn >> 8) & 255) + 0.0722 * (fn & 255)) / 255 > 0.55;
    const letter = this.add.text(0, -2, gradeInfo.grade, textStyle('heading', { fontSize: '52px', color: light ? '#0a0a0a' : '#ffffff', strokeThickness: 0 })).setOrigin(0.5);
    stamp.add([ring, letter]);
    this.tweens.add({ targets: stamp, scale: 1, alpha: 1, angle: -4, duration: 300, delay: this.reduce ? 0 : 400 + countMs + 200, ease: 'Back.easeOut',
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

  }

  update(time, delta) {
    if (this.fx) this.fx.update(delta);
    (this.lineup || []).forEach((m) => {
      if (m.mood === 'worry' && time > m.moodEnd) m.mood = 'idle';
      const frame = lifeFrame(m.life, time, m.mood, 0, this.reduce);
      m.img.setFrame(`${m.crew}_${frame}`);
      m.img.y = m.baseY - m.hop;
      const sc = 1 - m.hop / 80;
      m.shadow.setScale(sc, sc);
    });
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
    this.stopMs = 0;
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
    this.scoreLabel = this.add.text(18, 8, 'SCORE', textStyle('label', { fontSize: '11px', color: P.muted, letterSpacing: 2 })).setOrigin(0, 0);
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

    // ---- FEVER GROUND: hidden until fever, then the whole page changes under the board ----
    this.fx = new PopFx(this);
    this.feverBg = this.add.container(0, 0).setDepth(-19).setAlpha(0);
    {
      const feverGround = this.feverGroundHex();
      const rayCol = P.inkIsLight ? mixHex(P.bg, P.hot, 0.3) : (feverGround === P.hot ? mixHex(P.hot, P.ink, 0.13) : mixHex(P.bg, P.ink, 0.35));
      const g = this.add.graphics();
      g.fillStyle(_toInt(feverGround), 1); g.fillRect(0, 0, width, height);
      const rays = this.add.graphics().setPosition(width / 2, BOARD_Y + 280);
      rays.fillStyle(_toInt(rayCol), 1);
      for (let i = 0; i < 22; i += 2) {
        const a0 = (i / 22) * Math.PI * 2, a1 = ((i + 1) / 22) * Math.PI * 2;
        rays.beginPath(); rays.moveTo(0, 0); rays.lineTo(Math.cos(a0) * 900, Math.sin(a0) * 900); rays.lineTo(Math.cos(a1) * 900, Math.sin(a1) * 900); rays.closePath(); rays.fillPath();
      }
      this.feverRays = rays;
      this.feverBg.add([g, rays]);
    }
    // The multiplier, huge, behind the heads: readable across the room, never covering a face.
    this.bigMult = this.add.text(width / 2, BOARD_Y + 290, '', textStyle('heading', { fontSize: '300px', color: P.hot, strokeThickness: 0 })).setOrigin(0.5).setAlpha(0).setDepth(-3);

    // ---- COMBO BAND: multiplier sticker, HOT meter, streak line ----
    this.hypeBar = this.add.container(0, 0).setDepth(6);
    this.streakText = this.add.text(0, 0, '').setAlpha(0);
    this.adlibText = this.add.text(0, 0, '').setAlpha(0);
    this.charNameText = this.add.text(-100, -100, '').setAlpha(0);
    this.characterGfx = this.add.graphics().setAlpha(0);

    // ---- BOARD PANEL ----
    const boardX = GRID_OFFSET_X - 8, boardY = BOARD_Y;
    const boardW = GRID_COLS * CELL + 16, boardH = GRID_ROWS * CELL + 22;
    this.boardGfx = this.add.graphics().setDepth(-5);
    this.boardRect = { x: boardX, y: boardY, w: boardW, h: boardH };
    this.hudInk = P.ink;
    this.drawBoard(false);
    this.boardMid = { x: boardX + boardW / 2, y: boardY + boardH / 2 };

    // ---- CREW TALLY STRIP: who has popped how many. The legend and the scoreboard in one. ----
    const stripY = boardY + boardH + 10;
    this.footY = stripY;
    const strip = this.add.graphics();
    strip.fillStyle(P.inkN, 1); strip.fillRoundedRect(boardX, stripY + 3, boardW, 70, 12);
    strip.fillStyle(P.panelN, 1); strip.fillRoundedRect(boardX, stripY, boardW, 70, 12);
    strip.lineStyle(3, P.inkN, 1); strip.strokeRoundedRect(boardX, stripY, boardW, 70, 12);
    this.crewTally = CREW.map((m, i) => {
      const slot = boardW / CREW.length, cx = boardX + slot * (i + 0.5);
      const img = addHead(this, cx - 12, stripY + 28, i, 'idle0').setScale(0.62 * BS).setDepth(2);
      const tally = this.add.text(cx + 15, stripY + 24, '0', textStyle('heading', { fontSize: '19px', color: P.ink, strokeThickness: 0 })).setOrigin(0, 0.5).setDepth(2);
      this.add.text(cx, stripY + 56, m.name.toUpperCase(), textStyle('label', { fontSize: '11px', color: P.muted, letterSpacing: 1 })).setOrigin(0.5).setDepth(2);
      return { img, tally, count: 0, life: newLife(i + 40), mood: 'idle', moodEnd: 0, hop: 0, baseY: stripY + 28, crew: i };
    });
    this.modeText = this.add.text(width - 18, stripY + 84, this.gameMode === 'zen' ? 'ZEN MODE' : this.gameMode === 'daily' ? 'DAILY CHALLENGE' : 'TIMED MODE',
      textStyle('label', { fontSize: '12px', color: P.muted, letterSpacing: 2 })).setOrigin(1, 0);
    this.bestStreakText = this.add.text(18, stripY + 83, '', textStyle('muted', { fontSize: '13px', color: P.muted })).setOrigin(0, 0);

    // The band: a multiplier sticker at left, the HOT meter beside it, the streak line under the meter.
    this.streakCounter = this.add.text(82, BAND_Y + 42, '', textStyle('stat', { fontSize: '17px', color: P.ink, fontStyle: 'bold', align: 'left' })).setOrigin(0, 0);
    this.tierText = this.add.text(width - 14, BAND_Y + 42, '', textStyle('stat', { fontSize: '17px', color: P.hot, fontStyle: 'bold italic', align: 'right' })).setOrigin(1, 0);

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
    // The crew's idle life (blinks, glances, leaning toward a move) runs in updateHeads(), once per frame.
    this.sinceInput = 0; this.tell = null; this.nextTell = 0; this.feverClock = 0; this.lastBeat = -1; this.pulse = 0; this.panic = false;
    this.feverTally = new FeverTally();

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
      textStyle('label', { fontSize: '13px', letterSpacing: 0, color: P.text2, fontStyle: 'italic' }),
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

    // ---- MULTIPLIER STICKER (band, left): always on, so the layout never jumps ----
    this.multBadge = this.add.container(44, BAND_Y + 33).setDepth(30);
    this.multRing = this.add.graphics();
    this.multBadge.add(this.multRing);
    this.multText = this.add.text(0, -1, '',
      textStyle('heading', { fontSize: '30px', strokeThickness: 0 })).setOrigin(0.5);
    this.multBadge.add(this.multText);
    this.multLabel = this.add.text(0, 40, '', textStyle('label', { fontSize: '1px', color: P.muted })).setOrigin(0.5).setAlpha(0);
    this.multBadge.add(this.multLabel);
    this.updateMultiplierBadge();

    // ---- HOT METER (band, right of the sticker) ----
    this.feverGfx = this.add.graphics().setDepth(35);
    this.feverBarBounds = { x: 86, y: BAND_Y + 6, w: width - 86 - 14, h: 30 };
    this.feverLabelText = this.add.text(98, BAND_Y + 21, 'HOT',
      textStyle('badge', { fontSize: '14px', color: P.muted, stroke: '', strokeThickness: 0, letterSpacing: 2 }))
      .setOrigin(0, 0.5).setDepth(36);
    this.feverPctText = this.add.text(width - 24, BAND_Y + 21, '',
      textStyle('badge', { fontSize: '15px', color: P.muted, stroke: '', strokeThickness: 0 }))
      .setOrigin(1, 0.5).setDepth(36);

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
    this.crewCheer(900);
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
    // Skip per-frame rendering while paused: no GPU work behind the pause overlay.
    if (this.isPaused) return;
    if (this.stopMs > 0) {
      this.stopMs -= delta;
      if (this.stopMs <= 0) { this.stopMs = 0; this.tweens.timeScale = 1; this.time.timeScale = 1; }
    }
    this.renderPowerUpOverlays(time);
    this.renderFeverMeter(time);
    this.renderHintGlow(time);
    if (this.fx) this.fx.update(delta);
    this.updateFever(time, delta);
    this.updateHeads(time, delta);
    this.updateTally(time);
  }

  // -----------------------------------------------------------
  // THE CREW'S LIFE: every head blinks, glances, leans and reacts
  // -----------------------------------------------------------

  /** Upper rows draw over lower rows, so an accessory poking up (spikes, antenna) tucks behind the head above it. */
  headDepth(b) { if (b && b.active) b.setDepth(20 - b.getData('row')); }
  resortHeads() { if (this.bubbleContainer) this.bubbleContainer.sort('depth'); }

  /** Make a head show crew member `idx` (data and frame together). */
  applyCrew(b, idx) {
    b.setData('colorIdx', idx);
    b.hd.frame = '';
    b.setFrame(`${idx}_idle0`);
  }

  /** Force a face for a while: 'squeeze', 'peek', 'hit', 'cheer0', 'worry'. It reverts on its own. */
  setMood(b, mood, ms) {
    if (!b || !b.active || !b.hd) return;
    b.hd.mood = mood; b.hd.moodEnd = this.time.now + ms;
  }

  /** Everyone cheers for `ms`: the GO! beat, a fever start, a chain. */
  crewCheer(ms) {
    forEachCell((r, c) => { const b = this.grid[r]?.[c]; if (b && b.active) this.setMood(b, (r + c) % 2 ? 'cheer1' : 'cheer0', ms); });
  }

  /** Pick one move the board is waiting for and make its heads lean toward it. Rotates every couple of seconds. */
  chooseTell(time) {
    const colors = this.grid.map((row) => row.map((b) => (b && b.active ? b.getData('colorIdx') : -1)));
    const moves = findMoves(colors, GRID_ROWS, GRID_COLS);
    this.nextTell = time + 2400;
    if (!moves.length) { this.tell = null; return; }
    const m = Phaser.Math.RND.pick(moves);
    const cells = new Map();
    const dir = (from, to) => ({ dx: Math.sign(to.c - from.c), dy: Math.sign(to.r - from.r) });
    m.line.forEach((cell) => {
      if (cell.r === m.dest.r && cell.c === m.dest.c) return;
      cells.set(`${cell.r},${cell.c}`, { kind: 'friend', ...dir(cell, m.dest) });
    });
    cells.set(`${m.mover.r},${m.mover.c}`, { kind: 'mover', ...dir(m.mover, m.dest) });
    this.tell = { cells, until: time + 2200 };
  }

  updateHeads(time, delta) {
    if (this.gameOver) return;
    const fever = this.feverActive;
    const idle = !this.isProcessing;
    const bp = fever ? beatPhase(this.feverClock, FEVER_BPM) : null;
    // The crew's "tell": after a beat of quiet, heads beside a possible match lean toward it.
    if (idle && !fever && !this.hintActive) {
      this.sinceInput += delta;
      if (this.sinceInput > 1800 && time >= this.nextTell) this.chooseTell(time);
    } else { this.sinceInput = idle ? this.sinceInput : 0; if (this.tell) this.tell = null; }
    if (this.tell && time > this.tell.until) this.tell = null;
    const tell = this.tell;
    const sw = this.swipeBubble;
    const now = this.time.now;
    for (let r = 0; r < GRID_ROWS; r++) {
      const row = this.grid[r];
      for (let c = 0; c < GRID_COLS; c++) {
        const b = row[c];
        if (!b || !b.active || !b.hd) continue;
        const hd = b.hd;
        if (hd.mood !== 'idle' && now > hd.moodEnd) hd.mood = 'idle';
        let mood = hd.mood, look = 0, ang = 0, sx = 1, sy = 1, dy = 0, ox = 0;
        if (idle) {
          if (fever) {
            const ds = danceState(bp.beat, bp.frac, c, r, this.reduce);
            if (mood === 'idle') mood = ds.frame;
            ang = ds.ang; sx = ds.sx; sy = ds.sy; dy = ds.dy;
          } else {
            if (sw && sw !== b && Math.abs(sw.getData('col') - c) <= 2 && Math.abs(sw.getData('row') - r) <= 2) look = Math.sign(sw.getData('col') - c) || (c % 2 ? 1 : -1);
            const t = tell && tell.cells.get(`${r},${c}`);
            if (t && mood === 'idle') {
              const k = 0.55 + 0.45 * Math.sin(time / 210);
              if (t.kind === 'mover') { mood = 'peek'; ox = t.dx * 5 * k; dy = t.dy * 5 * k; ang = (t.dx || t.dy) * 10 * k; }
              else { look = t.dx || (t.dy ? (c % 2 ? 1 : -1) : 0); ang = (t.dx || t.dy) * 7 * k; dy = t.dy * 3 * k; ox = t.dx * 3 * k; if (!look) mood = 'peek'; }
            }
            if (this.panic && mood === 'idle' && ((r * 7 + c * 3 + Math.floor(time / 700)) % 5 === 0)) mood = 'worry';
            if (this.panic && !this.reduce) ang += Math.sin(time / 38 + r + c) * 1.4;
          }
          if (b !== this.selected && b !== sw && b.getData('wob') == null) {
            const base = this.gridToWorld(r, c);
            b.setPosition(base.x + ox, base.y + dy);
            b.setAngle(ang);
            b.setScale(BS * sx, BS * sy);
          }
        }
        const frame = `${b.getData('colorIdx')}_${lifeFrame(hd.life, time, mood, look, this.reduce)}`;
        if (frame !== hd.frame) { hd.frame = frame; b.setFrame(frame); }
      }
    }
  }

  /** The crew tally strip: each member blinks, and bounces when its colour pops. */
  updateTally(time) {
    if (!this.crewTally) return;
    const now = this.time.now;
    for (const m of this.crewTally) {
      if (m.mood !== 'idle' && now > m.moodEnd) m.mood = 'idle';
      const frame = `${m.crew}_${lifeFrame(m.life, time, this.feverActive && m.mood === 'idle' ? 'cheer0' : m.mood, 0, this.reduce)}`;
      if (frame !== m.frame) { m.frame = frame; m.img.setFrame(frame); }
      m.img.y = m.baseY - m.hop;
    }
  }

  /** Credit a colour for pops: the tally ticks up and that crew member hops. */
  tallyPop(crew, n) {
    const m = this.crewTally && this.crewTally[crew];
    if (!m) return;
    m.count += n;
    m.tally.setText(`${m.count}`);
    m.mood = 'cheer0'; m.moodEnd = this.time.now + 420;
    if (!this.reduce) {
      this.tweens.add({ targets: m, hop: 10, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: m.tally, scale: 1.3, duration: 90, yoyo: true });
    }
  }

  /** A speech bubble over a head: the crew shouts. Sticker style: ink outline, hard shadow, a little tail. */
  shout(text, x, y, big) {
    const fs = big ? 20 : 16;
    const t = this.add.text(0, 0, text, textStyle('badge', { fontSize: `${fs}px`, color: '#0a0a0a', stroke: '', strokeThickness: 0 })).setOrigin(0.5);
    const w = t.width + 22, h = t.height + 12;
    const cx = Phaser.Math.Clamp(x, 8 + w / 2, VIEW.width - 8 - w / 2), cy = Math.max(y, BOARD_Y + 10 + h / 2);
    const g = this.add.graphics();
    g.fillStyle(P.inkN, 1); g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 10);
    g.fillStyle(0xffffff, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(3, P.inkN, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.fillStyle(0xffffff, 1); g.fillTriangle(-6 + (x - cx) * 0.3, h / 2 - 1, 8 + (x - cx) * 0.3, h / 2 - 1, (x - cx) * 0.5, h / 2 + 11);
    g.lineStyle(3, P.inkN, 1); g.lineBetween(-6 + (x - cx) * 0.3, h / 2 - 1, (x - cx) * 0.5, h / 2 + 11); g.lineBetween(8 + (x - cx) * 0.3, h / 2 - 1, (x - cx) * 0.5, h / 2 + 11);
    if (this._shoutBox && this._shoutBox.active) { const old = this._shoutBox; this.tweens.add({ targets: old, alpha: 0, duration: 120, onComplete: () => old.destroy() }); }
    const box = this.add.container(cx, cy, [g, t]).setDepth(40).setScale(0.3).setAngle(this.reduce ? 0 : Phaser.Math.Between(-6, 6));
    this._shoutBox = box;
    this.tweens.add({ targets: box, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: box, alpha: 0, y: cy - 22, duration: 300, delay: 820, ease: 'Quad.easeIn', onComplete: () => box.destroy() });
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
  /** The HOT meter fill: the accent, unless the accent blends into the card (Redline), then the ink. */
  meterFillHex() {
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
    return Math.abs(lum(P.hot) - lum(P.card)) >= 0.28 ? P.hot : P.ink;
  }

  renderFeverMeter(time) {
    if (!this.feverGfx) return;
    const g = this.feverGfx;
    g.clear();
    const fb = this.feverBarBounds;
    const fever = this.feverActive;
    const frac = fever ? Phaser.Math.Clamp(this.feverTimer / 6000, 0.04, 1) : Phaser.Math.Clamp(this.feverMeter / 100, 0, 1);

    // Track: a rounded tube with a hard shadow and an ink outline, like every card in the game.
    g.fillStyle(P.inkN, 1); g.fillRoundedRect(fb.x, fb.y + 3, fb.w, fb.h, 10);
    g.fillStyle(P.cardN, 1); g.fillRoundedRect(fb.x, fb.y, fb.w, fb.h, 10);
    if (frac > 0) {
      const w = Math.max(14, frac * (fb.w - 6));
      const beatK = fever ? 0.78 + 0.22 * Math.sin(time * 0.016) : 1;
      const fillHex = this.meterFillHex();
      g.fillStyle(_toInt(fillHex), beatK);
      g.fillRoundedRect(fb.x + 3, fb.y + 3, w, fb.h - 6, 7);
    }
    g.lineStyle(3, P.inkN, 1); g.strokeRoundedRect(fb.x, fb.y, fb.w, fb.h, 10);

    // Fever: ink frames around the screen and the board, thicker on the beat.
    if (fever) {
      const k = 0.55 + 0.45 * this.pulse;
      const br = this.boardRect;
      g.lineStyle(5 + this.pulse * 5, P.inkN, k);
      g.strokeRoundedRect(br.x - 3, br.y - 3, br.w + 6, br.h + 6, 16);
      g.lineStyle(7, P.inkN, 0.9);
      g.strokeRect(3, 3, VIEW.width - 6, VIEW.height - 6);
    }

    // Text sits on the card or on the hot fill: pick whichever reads on what is under it.
    const onHot = contrastPick(this.meterFillHex(), ['#0a0a0a', '#ffffff']), onCard = contrastPick(P.card, ['#0a0a0a', '#ffffff']);
    const labelCovered = frac * (fb.w - 6) > 76;
    this.feverLabelText.setText(fever ? 'FEVER' : 'HOT');
    this.feverLabelText.setColor(labelCovered ? onHot : onCard);
    if (fever) { this.feverPctText.setText(`${Math.ceil(this.feverTimer / 1000)}s`); this.feverPctText.setColor(frac > 0.94 ? onHot : onCard); }
    else if (frac > 0.04) { this.feverPctText.setText(`${Math.floor(frac * 100)}%`); this.feverPctText.setColor(frac > 0.94 ? onHot : onCard); }
    else this.feverPctText.setText('');
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
    this.timerText.setColor(this.feverActive ? this.hudInk : low ? P.hot : P.ink);

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
      this.panic = true;
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
    const toastY = this.footY + 98;
    if (this.modeText) this.modeText.setAlpha(0);
    if (this.tipText) this.tipText.setAlpha(0);
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
      onComplete: () => { container.destroy(true); if (this.modeText && this.modeText.active) this.modeText.setAlpha(1); if (this.tipText && this.tipText.active) this.tipText.setAlpha(1); },
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
    this.panic = false;
    this.scoreText.setText(this.score.toLocaleString());
    // The crew takes a bow (or winces) before the result screen.
    { const good = this.score >= 1500; forEachCell((r, c) => { const b = this.grid[r]?.[c]; if (b && b.active) this.setMood(b, good ? ((r + c) % 2 ? 'cheer1' : 'cheer0') : 'worry', 1200); }); }

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
        this.spawnBubble(row, col, true, (GRID_ROWS + 1) * CELL, (GRID_ROWS - 1 - row) * 38 + col * 22);
      }
    }
    this.resolveInitialMatches();
  }

  /**
   * Add one head to the board. With `fall` it drops in from above the board: a stretched falling face, then a landing
   * with squash and a small bounce (see landHead). `delay` staggers a refill from the bottom up.
   */
  spawnBubble(row, col, animate = false, fall = 0, delay = 0) {
    const colorIdx = this.dailyRng
      ? Math.floor(this.dailyRng() * COLORS.length)
      : Phaser.Math.Between(0, COLORS.length - 1);
    const pos = this.gridToWorld(row, col);

    const bubble = addHead(this, pos.x, animate ? pos.y - fall : pos.y, colorIdx, 'idle0');
    bubble.setInteractive(headHitArea(CELL), Phaser.Geom.Circle.Contains);
    bubble.hd = { life: newLife(row * GRID_COLS + col + Math.random() * 5), mood: 'idle', moodEnd: 0, frame: '' };
    bubble.setData('row', row);
    bubble.setData('col', col);
    bubble.setData('colorIdx', colorIdx);
    bubble.setData('powerUp', POWERUP_TYPES.NONE);
    bubble.setScale(BS);

    this.bubbleContainer.add(bubble);
    this.grid[row][col] = bubble;
    this.headDepth(bubble);
    this.resortHeads();

    if (animate) {
      bubble.setAlpha(0);
      bubble.hd.mood = 'peek'; bubble.hd.moodEnd = this.time.now + 99999;
      const cells = fall / CELL;
      const dur = this.reduce ? 1 : 120 + Math.sqrt(Math.max(1, cells)) * 125;
      this.tweens.add({
        targets: bubble, y: pos.y, alpha: { value: 1, duration: 80 },
        duration: dur, ease: 'Quad.easeIn', delay,
        onStart: () => { if (!this.reduce) bubble.setScale(BS * 0.92, BS * 1.1); },
        onComplete: () => this.landHead(bubble, cells),
      });
    }

    return bubble;
  }

  /** A head lands: squash flat, stretch back up with a little hop, settle. Heavier for longer falls. */
  landHead(bubble, cells) {
    if (!bubble.active) return;
    bubble.hd.mood = 'idle'; bubble.hd.moodEnd = 0;
    window.audioEngine.playLand(0);
    if (this.reduce) { bubble.setScale(BS); return; }
    const h = Math.min(cells, 4);
    const row = bubble.getData('row'), col = bubble.getData('col');
    const base = this.gridToWorld(row, col);
    if (cells >= 2) this.fx.puff(base.x, base.y + 20, 0.7 + h * 0.12);
    this.tweens.add({
      targets: bubble, scaleX: BS * (1.1 + 0.035 * h), scaleY: BS * (0.82 - 0.03 * h), y: base.y + 2, duration: 60, ease: 'Quad.easeOut',
      onComplete: () => {
        if (!bubble.active) return;
        this.tweens.add({
          targets: bubble, scaleX: BS * 0.95, scaleY: BS * 1.07, y: base.y - 2 - h * 1.6, duration: 80, ease: 'Quad.easeOut',
          onComplete: () => {
            if (!bubble.active) return;
            this.tweens.add({ targets: bubble, scaleX: BS, scaleY: BS, y: base.y, duration: 110, ease: 'Bounce.easeOut' });
          },
        });
      },
    });
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
        this.applyCrew(b, newColor);
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
      targets: bubble, scale: (on ? 1.16 : 1) * BS, angle: 0,
      duration: 150, ease: 'Back.easeOut',
    });
    if (on) bubble.setDepth(30); else this.headDepth(bubble);
    this.resortHeads();
    if (bubble.hd) { bubble.hd.mood = on ? 'peek' : 'idle'; bubble.hd.moodEnd = on ? 99999 + this.time.now : 0; }
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
    this.headDepth(a); this.headDepth(b); this.resortHeads();

    // Swap trail effect
    this.spawnSwapTrail(a, pos1, pos2);
    this.spawnSwapTrail(b, pos2, pos1);

    if (!this.reduce) {
      // One head hops over, the other slides under: stretch along the move, a tilt, and a bigger hop for the one on top.
      const horiz = r1 === r2;
      a.setDepth(32); b.setDepth(31);
      this.tweens.add({ targets: a, scaleX: (horiz ? 1.2 : 0.88) * BS, scaleY: (horiz ? 0.88 : 1.2) * BS, angle: (c2 - c1 || r2 - r1) * 8, duration: 90, yoyo: true, ease: 'Sine.easeOut', onComplete: () => { a.angle = 0; } });
      this.tweens.add({ targets: b, scaleX: (horiz ? 1.12 : 0.92) * BS, scaleY: (horiz ? 0.92 : 1.12) * BS, angle: -(c2 - c1 || r2 - r1) * 6, duration: 90, yoyo: true, ease: 'Sine.easeOut', onComplete: () => { b.angle = 0; } });
    }
    this.slideHead(a, pos1, pos2, 200, -13);
    this.slideHead(b, pos2, pos1, 200, 5, {
      onComplete: () => {
        const matches = this.findAllMatches();

        // Check if swapped bubbles have power-ups that should activate
        const aPower = a.getData('powerUp');
        const bPower = b.getData('powerUp');

        if (matches.length === 0 && aPower === POWERUP_TYPES.NONE && bPower === POWERUP_TYPES.NONE) {
          this.grid[r1][c1] = a; this.grid[r2][c2] = b;
          a.setData('row', r1); a.setData('col', c1);
          b.setData('row', r2); b.setData('col', c2);
          this.slideHead(a, pos2, pos1, 200, 5);
          this.slideHead(b, pos1, pos2, 200, -13, {
            onComplete: () => {
              this.streak = 0;
              this.updateStreakUI();
              this.isProcessing = false;
            }
          });
          window.audioEngine.playInvalid();
          [a, b].forEach((h) => { this.setMood(h, 'worry', 520); if (!this.reduce) this.tweens.add({ targets: h, angle: { from: -10, to: 10 }, duration: 70, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => { if (h.active) h.angle = 0; } }); });
          this.shake(100, 0.003);
        } else {
          this.moveCount++;
          this.processMatches(matches);
        }
      }
    });

    this.selected = null;
  }

  /** Slide a head from one cell to the next along a small arc (negative lift = over the top), so swapped heads pass around each other. */
  slideHead(h, from, to, ms, lift, cb) {
    if (this.reduce) { h.setPosition(to.x, to.y); if (cb && cb.onComplete) this.time.delayedCall(ms * 0.5, cb.onComplete); return; }
    this.tweens.addCounter({
      from: 0, to: 1, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        if (!h.active) return;
        const t = tw.getValue();
        h.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t + Math.sin(Math.PI * t) * lift);
      },
      onComplete: () => { if (h.active) h.setPosition(to.x, to.y); if (cb && cb.onComplete) cb.onComplete(); },
    });
  }

  spawnSwapTrail(bubble, from, to) {
    const trail = addHead(this, from.x, from.y, bubble.getData('colorIdx'), 'lookR');
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
    // How big this moment is: drives the splat size, drops, stars and the hit-stop. Bigger matches and deeper chains hit harder.
    this.popBiggest = matchGroups.reduce((m, g) => Math.max(m, g.length), 3);
    this.popPower = Math.min(2.4, 1 + (this.popBiggest - 3) * 0.2 + (depth - 1) * 0.3 + (this.feverActive ? 0.3 : 0));
    this._stopDone = false;
    this.sinceInput = 0; this.tell = null;
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
    this.feverTally.add(points, totalPopped);
    this.totalPopped += totalPopped;
    // During fever the HUD score holds still while the fever's points pile up beside the meter; the payoff banks them.
    if (!this.feverActive) { this.scoreText.setText(this.score.toLocaleString()); this.bumpScore(points); }

    // Score popup — append fever indicator when active
    if (matchGroups[0] && matchGroups[0][0]) {
      const first = matchGroups[0][0];
      const label = `+${points}`;
      this.showScorePopup(first.x, first.y, label, this.streak);
    }

    // ---- THE CREW REACTS: the heads that matched shout, the tally strip credits them ----
    if (powerUpsToCreate.length || powerUpsToActivate.length || depth >= 2 || totalPopped >= 5) {
      const lead = matchGroups.slice().sort((x, y) => y.length - x.length)[0];
      const mid = lead && lead[Math.floor(lead.length / 2)];
      if (mid && mid.active && this.time.now - (this._lastShout || 0) > 450) {
        this._lastShout = this.time.now;
        this.shout(crewLine(mid.getData('colorIdx'), shoutLevel(depth, this.feverActive)), mid.x, mid.y - 38, depth >= 3 || this.feverActive);
      }
    }
    if (!this.reduce) this.shake(70, 0.0016 + Math.min(totalPopped, 8) * 0.0004);
    // A big hit freezes the frame for a breath before it lands.
    if (totalPopped >= 6 || depth >= 3 || powerUpsToActivate.length) this.hitStop(depth >= 3 ? 130 : 85);

    // ---- CASCADE CHAIN BANNER ----
    if (depth >= 2) this.showChainBanner(depth);
    if (depth >= 3 && !this.reduce) { this.crewCheer(650); this.fx.headRain(Math.min(5 + depth * 2, 16), 20, VIEW.width - 20, BOARD_Y - 20, VIEW.height, -4); }

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
    // Heads above the gap drop and the new ones fall in at the same time, so the board never sits with holes in it.
    this.time.delayedCall(170, () => {
      this.dropBubbles();
      this.refillGrid();
      this.time.delayedCall(480, () => {
        const newMatches = this.findAllMatches();
        if (newMatches.length > 0) {
          this.processMatches(newMatches, depth + 1);
        } else {
          if (!this.hasPossibleMoves()) this.reshuffleGrid();
          this.isProcessing = false;
        }
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
    this.clearBanners();
    this._feverStartAt = this.time.now;
    this.feverClock = 0; this.lastBeat = -1;
    this.feverTally.start();
    this.scoreShown = Math.max(0, this.score - 0);
    this.setHudInk(true);

    const { width } = VIEW;
    const cy = this.boardMid.y - 30;
    // The takeover: a slow-motion beat, a hard flash, the ground changes, the whole crew dances on the beat.
    const banner = this.add.text(width / 2, cy, 'FEVER!',
      textStyle('heading', { fontSize: '92px', color: P.hot, stroke: P.ink, strokeThickness: 12 }),
    ).setOrigin(0.5).setDepth(55).setScale(0).setAngle(-5);
    const sub = this.add.text(width / 2, cy + 64, 'DOUBLE POINTS',
      textStyle('badge', { fontSize: '22px', color: contrastPick(P.hot, ['#0a0a0a', '#ffffff']), stroke: P.ink, strokeThickness: 5, letterSpacing: 4 }),
    ).setOrigin(0.5).setDepth(55).setAlpha(0);
    this.tweens.add({
      targets: banner, scale: 1.12, duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: banner, scale: 1, duration: 160 });
        this.tweens.add({ targets: banner, scale: 1.9, alpha: 0, duration: 520, delay: 640, ease: 'Quad.easeIn', onComplete: () => banner.destroy() });
      },
    });
    this.tweens.add({
      targets: sub, alpha: 1, duration: 180, delay: 180,
      onComplete: () => this.tweens.add({ targets: sub, alpha: 0, y: sub.y - 24, duration: 360, delay: 760, ease: 'Quad.easeIn', onComplete: () => sub.destroy() }),
    });
    this.screenFlash(P.inkIsLight ? P.hotN : 0xffffff);
    this.shake(260, 0.009);
    this.hitStop(300, 0.12);
    this.setPageGround(this.feverGroundHex());
    this.crewCheer(1100);
    this.confettiBurst(26);
    this.boardWave(1.8);
    this.pulse = 1;
    const rays = this.add.graphics().setDepth(53).setPosition(width / 2, cy + 4);
    rays.fillStyle(P.hotN, 0.9);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, a2 = a + 0.11; rays.beginPath(); rays.moveTo(0, 0); rays.lineTo(Math.cos(a) * 260, Math.sin(a) * 260); rays.lineTo(Math.cos(a2) * 260, Math.sin(a2) * 260); rays.closePath(); rays.fillPath(); }
    rays.setScale(0.2).setAlpha(0.9);
    this.tweens.add({ targets: rays, scale: 1, alpha: 0, angle: 30, duration: 900, ease: 'Quad.easeOut', onComplete: () => rays.destroy() });
    window.audioEngine.playStreakHit(12);
    this.updateMultiplierBadge();
  }

  /** The board panel: the card colour, tinted toward the fever ground while fever runs so the board itself changes too. */
  drawBoard(fever) {
    const { x, y, w, h } = this.boardRect;
    const fill = fever ? _toInt(mixHex(P.card, this.feverGroundHex(), 0.3)) : P.cardN;
    const g = this.boardGfx;
    g.clear();
    g.fillStyle(P.inkN, 1); g.fillRoundedRect(x, y + 4, w, h, 14);
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(3, P.inkN, 1); g.strokeRoundedRect(x, y, w, h, 14);
  }

  /** The fever ground: the accent, unless the accent is near white (Redline), then true black so the ground still changes. */
  feverGroundHex() {
    if (P.inkIsLight) return P.bg;
    const n = parseInt(P.hot.slice(1), 16);
    const l = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return l > 0.85 ? '#0a0a0a' : P.hot;
  }

  /** The page behind the canvas follows the fever ground too, so the letterbox never shows a different colour. */
  setPageGround(hex) { try { document.documentElement.style.background = hex; document.body.style.background = hex; } catch (_) { /* no DOM */ } }

  /** On the fever ground the small grey labels lose contrast, so they switch to the full ink colour. */
  setHudInk(on) {
    const ground = on ? this.feverGroundHex() : P.bg;
    const onG = on ? contrastPick(ground, ['#0a0a0a', '#ffffff']) : P.ink;
    this.hudInk = onG;
    const c = on ? onG : P.muted;
    [this.scoreLabel, this.timerSub, this.tipText, this.modeText, this.bestStreakText].forEach((t) => { if (t && t.active) t.setColor(c); });
    [this.scoreText, this.timerText].forEach((t) => { if (t && t.active) t.setColor(on ? onG : P.ink); });
    if (this.tierText) this.tierText.setColor(on ? onG : P.hot);
    if (this.streakCounter) { this.streakCounter.setX(on ? 104 : 82); this.streakCounter.setColor(on ? onG : P.ink); }
    this.drawBoard(on);
  }

  /** Count the HUD score up from what it showed during fever to the real score, thumping on the way. */
  bankScore(from) {
    const to = this.score;
    this.scoreHeld = false;
    if (this.reduce || !(to > from)) { this.scoreText.setText(to.toLocaleString()); this.scoreShown = to; return; }
    this.tweens.addCounter({ from, to, duration: 950, ease: 'Sine.easeOut',
      onUpdate: (tw) => { this.scoreShown = Math.floor(tw.getValue()); this.scoreText.setText(this.scoreShown.toLocaleString()); this.scoreText.setScale(1.12); },
      onComplete: () => { this.scoreShown = to; this.scoreText.setText(to.toLocaleString()); this.tweens.add({ targets: this.scoreText, scale: 1.4, duration: 120, yoyo: true, ease: 'Quad.easeOut' }); } });
  }

  /** Once per beat of the fever groove: the board kicks, a drum plays, the crew throws a few stars, now and then shouts. */
  onFeverBeat(bp) {
    if (!this.reduce) this.pulse = 1;
    window.audioEngine.playBeat(bp.step);
    if (!this.reduce && (bp.step === 0 || bp.step === 2)) {
      for (let i = 0; i < 2; i++) {
        const pos = this.gridToWorld(Phaser.Math.Between(0, GRID_ROWS - 1), Phaser.Math.Between(0, GRID_COLS - 1));
        this.fx.stars(pos.x, pos.y, 3, 150, 0.9);
      }
    }
    if (bp.step === 0 && bp.beat % 8 === 4) {
      const b = this.grid[Phaser.Math.Between(0, GRID_ROWS - 1)]?.[Phaser.Math.Between(0, GRID_COLS - 1)];
      if (b && b.active) this.shout(crewLine(b.getData('colorIdx'), 2), b.x, b.y - 34, true);
    }
    if (!this.reduce) this.tweens.add({ targets: this.multBadge, scale: (this.multBase || 1.22) * 1.14, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
    if (this.bigMult && this.bigMult.active && !this.reduce) { this.bigMult.setScale(1.06); this.tweens.add({ targets: this.bigMult, scale: 1, duration: 200, ease: 'Quad.easeOut' }); }
  }

  /** Per-frame fever work: the ground fades in and out, the rays turn, the board pulses on the beat. */
  updateFever(time, delta) {
    if (!this.feverBg) return;
    const fever = this.feverActive;
    const target = fever ? 1 : 0;
    const speed = this.reduce ? 1 : delta / (fever ? 200 : 450);
    const a = this.feverBg.alpha;
    this.feverBg.setAlpha(a < target ? Math.min(target, a + speed) : Math.max(target, a - speed));
    if (this.feverBg.alpha > 0 && !this.reduce) this.feverRays.angle += delta * 0.014;
    const pile = fever ? `SCORE   +${this.feverTally.total.toLocaleString()} IN FEVER` : 'SCORE';
    if (this.scoreLabel.text !== pile) this.scoreLabel.setText(pile);
    if (fever) {
      this.feverClock += delta;
      const bp = beatPhase(this.feverClock, FEVER_BPM);
      if (bp.beat !== this.lastBeat) { this.lastBeat = bp.beat; this.onFeverBeat(bp); }
      this.bigMult.setText(`×${effectiveMultiplier(this.streak, true)}`);
      this.bigMult.setAlpha(0.2 + (this.reduce ? 0 : 0.1 * this.pulse));
      if (!this.reduce && Math.random() < delta / 150) {
        this.fx.spawn({ frame: Math.random() < 0.5 ? 'star_hot' : 'star_ink', x: Phaser.Math.Between(30, VIEW.width - 30), y: this.boardRect.y + this.boardRect.h - 6, vy: -170 - Math.random() * 150, vx: Phaser.Math.Between(-20, 20), rot: Math.random() * 60, vr: Phaser.Math.Between(-240, 240), s0: 0.3 + Math.random() * 0.2, s1: 0.1, dur: 1000, depth: 4, fadeAt: 0.6 });
      }
    } else if (this.bigMult.alpha > 0) {
      this.bigMult.setAlpha(Math.max(0, this.bigMult.alpha - delta / 300));
    }
    // The board kicks on the beat, scaling about its centre.
    if (this.pulse > 0.003) {
      this.pulse *= Math.exp(-delta / 115);
      const k = 1 + this.pulse * 0.024;
      const m = this.boardMid;
      this.bubbleContainer.setScale(k).setPosition(m.x * (1 - k), m.y * (1 - k));
      this.boardGfx.setScale(k).setPosition(m.x * (1 - k), m.y * (1 - k));
      this.pulsed = true;
    } else if (this.pulsed) {
      this.pulse = 0; this.pulsed = false;
      this.bubbleContainer.setScale(1).setPosition(0, 0);
      this.boardGfx.setScale(1).setPosition(0, 0);
    }
  }

  deactivateFever() {
    this.feverActive = false;
    this.feverTimer = 0;
    this.feverMeter = 0;
    const res = this.feverTally.end();
    this.setHudInk(false);
    this.time.delayedCall(450, () => this.setPageGround(P.bg));
    this.updateMultiplierBadge();

    // The payoff: a plate lands on the board with what the fever earned, counting up, while the crew cheers once more.
    const { width } = VIEW;
    const cy = this.boardMid.y - 20;
    const box = this.add.container(width / 2, cy).setDepth(58).setScale(this.reduce ? 1 : 0.2).setAlpha(this.reduce ? 1 : 0);
    const bw = 330, bh = 170;
    const g = this.add.graphics();
    g.fillStyle(P.inkN, 1); g.fillRoundedRect(-bw / 2, -bh / 2 + 6, bw, bh, 20);
    g.fillStyle(P.cardN, 1); g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    g.lineStyle(5, P.inkN, 1); g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    const onCard = contrastPick(P.card, ['#0a0a0a', '#ffffff']);
    const word = res.total >= 2500 ? 'MEGA FEVER' : res.total >= 1000 ? 'HOT FEVER' : res.total > 0 ? 'FEVER PAYOFF' : 'FEVER OVER';
    const head = this.add.text(0, -bh / 2 + 28, word, textStyle('badge', { fontSize: '20px', color: onCard, stroke: '', strokeThickness: 0, letterSpacing: 4 })).setOrigin(0.5);
    const num = this.add.text(0, -2, res.total > 0 ? '+0' : '', textStyle('heading', { fontSize: '76px', color: P.hot, stroke: P.ink, strokeThickness: 9 })).setOrigin(0.5);
    const line = this.add.text(0, bh / 2 - 30, res.total > 0 ? `${res.pops} heads popped in fever` : 'Match more to go again', textStyle('stat', { fontSize: '16px', color: onCard, fontStyle: 'bold' })).setOrigin(0.5);
    // A starburst behind the plate and two cheering crew members on its corners make it an event, not a dialog.
    const sun = this.add.graphics();
    sun.fillStyle(P.hotN, 1);
    sun.beginPath();
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const r = i % 2 ? 150 : 215; sun.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.78); }
    sun.closePath(); sun.fillPath(); sun.lineStyle(5, P.inkN, 1); sun.strokePath();
    const crewA = addHead(this, -bw / 2 + 4, -bh / 2 + 4, Phaser.Math.Between(0, 2), 'cheer0').setScale(1.15 * BS).setAngle(-14);
    const crewB = addHead(this, bw / 2 - 4, -bh / 2 + 4, Phaser.Math.Between(3, 5), 'cheer1').setScale(1.15 * BS).setAngle(14);
    box.add([sun, g, head, num, line, crewA, crewB]);
    if (!this.reduce) {
      this.tweens.add({ targets: sun, angle: 14, duration: 2200, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: [crewA, crewB], y: '-=10', duration: 220, yoyo: true, repeat: 6, ease: 'Quad.easeOut' });
    }
    if (!this.reduce) this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    if (res.total > 0) {
      this.tweens.addCounter({ from: 0, to: res.total, duration: this.reduce ? 1 : 700, delay: 120, ease: 'Cubic.easeOut',
        onUpdate: (tw) => { num.setText(`+${Math.floor(tw.getValue()).toLocaleString()}`); },
        onComplete: () => { num.setText(`+${res.total.toLocaleString()}`); if (!this.reduce) this.tweens.add({ targets: num, scale: 1.25, duration: 110, yoyo: true }); } });
      this.crewCheer(1000);
      if (!this.reduce) { this.fx.headRain(22, 20, width - 20, BOARD_Y - 20, VIEW.height, -4); this.fx.stars(width / 2, cy, 12, 260, 1.2); this.shake(160, 0.006); }
      window.audioEngine.playStreakHit(12);
    }
    // The plate then flies up into the SCORE and the score thumps: the fever's points visibly bank.
    const shownFrom = this.scoreShown;
    const bank = () => {
      this.tweens.add({ targets: box, x: 60, y: 30, scale: 0.1, alpha: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => {
        box.destroy();
        this.bankScore(shownFrom);
        if (res.total > 0) { this.fx.stars(60, 40, 8, 160, 0.8); window.audioEngine.playStreakHit(8); }
      } });
    };
    if (this.reduce) this.time.delayedCall(1700, () => box.destroy()); else this.time.delayedCall(1800, bank);
  }

  /** Mini cheering heads rain from the top: the payoff for fever and big moments. Skipped under reduced motion. */
  confettiBurst(n = 30) {
    if (this.reduce) return;
    this.fx.headRain(n, 20, VIEW.width - 20, BOARD_Y - 20, VIEW.height, -4);
  }

  /**
   * Pop one head. A pop has four beats: the face squeezes and the body squashes (anticipation), the head stretches
   * (wind-up), the splat frames burst out in the crew colour with drops and stars (impact), and the neighbours
   * flinch (aftermath). `delay` ripples a match from one end to the other.
   */
  popBubble(bubble, delay = 0) {
    if (!bubble || !bubble.active) return;
    const row = bubble.getData('row');
    const col = bubble.getData('col');
    const colorIdx = bubble.getData('colorIdx');
    const power = this.popPower || 1;

    if (this.grid[row] && this.grid[row][col] === bubble) {
      this.grid[row][col] = null;
    }
    bubble.disableInteractive();
    bubble.setDepth(40);
    this.resortHeads();
    const squeeze = () => { if (bubble.active) bubble.setFrame(`${colorIdx}_squeeze`); };

    const burst = () => {
      if (!bubble.active) return;
      const x = bubble.x, y = bubble.y;
      this.crewImpact(x, y, colorIdx, power, row, col);
      bubble.destroy();
    };
    if (this.reduce) { this.time.delayedCall(delay, squeeze); this.time.delayedCall(delay + 110, burst); return; }
    // Anticipation: squash and squeeze, then stretch up like a held breath, then it goes.
    this.tweens.add({
      targets: bubble, scaleX: 1.2 * BS, scaleY: 0.8 * BS, duration: 70, delay, ease: 'Quad.easeOut',
      onStart: squeeze,
      onComplete: () => {
        if (!bubble.active) return;
        this.tweens.add({ targets: bubble, scaleX: 0.84 * BS, scaleY: 1.26 * BS, y: bubble.y - 5, duration: 60, ease: 'Quad.easeOut', onComplete: burst });
      },
    });
  }

  /** The moment a head bursts: ink splat frames, drops, stars and a ring, scaled by how big the match or chain is. */
  crewImpact(x, y, crew, power, row, col) {
    this.tallyPop(crew, 1);
    const size = 1.1 + 0.4 * power;
    this.fx.splat(x, y, crew, size);
    this.fx.drops(x, y, crew, this.reduce ? 3 : Math.round(6 + power * 4 + (this.feverActive ? 3 : 0)), 150 + power * 60, 1.1 + power * 0.25);
    if (!this.reduce && (power >= 1.3 || this.feverActive)) this.fx.stars(x, y, Math.round(2 + power * 2), 190 + power * 40, 0.8 + power * 0.25);
    if (power >= 1.3) this.spawnPopRing(x, y, COLORS[crew]);
    this.nudgeNeighbours(row, col, x, y);
    // One hit-stop per move, on the first head to go, and longer for bigger moments.
    if (!this._stopDone) {
      this._stopDone = true;
      const ms = Math.min(150, 34 + 22 * (this.popBiggest - 3) + 26 * (this.chainDepth - 1));
      if (ms >= 40) this.hitStop(ms, 0.05);
    }
  }

  /** A quick ring of shock that grows and fades where a head went. */
  spawnPopRing(x, y, color) {
    if (this.reduce) return;
    const ring = this.add.image(x, y, 'ring').setTint(P.inkN).setScale(0.35 * BS).setAlpha(1).setDepth(9);
    ring.setBlendMode(Phaser.BlendModes.NORMAL);
    this.tweens.add({
      targets: ring, scale: 1.9 * BS, alpha: 0, duration: 300, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** The neighbours of a popped head flinch: wide eyes, a lean away, a quick settle. The board feels like one soft thing. */
  nudgeNeighbours(row, col, x, y) {
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      const n = this.grid[row + dr]?.[col + dc];
      if (!n || !n.active || n.getData('nudging')) return;
      this.setMood(n, 'peek', 380);
      if (this.reduce) return;
      n.setData('nudging', true);
      const px = this.gridToWorld(row + dr, col + dc);
      this.tweens.add({
        targets: n, x: px.x + dc * 5, y: px.y + dr * 5, duration: 70, yoyo: true, ease: 'Quad.easeOut',
        onComplete: () => { if (n.active) { n.x = px.x; n.y = px.y; n.setData('nudging', false); } },
      });
    });
  }

  showScorePopup(x, y, text, streak) {
    const level = getStreakLevel(streak);
    const size = level ? Math.min(level.size, 44) : 28;
    // A sticker: ink outline, the accent inside on streaks, the ink otherwise.
    y = Math.max(y, GRID_OFFSET_Y + 40);
    x = Phaser.Math.Clamp(x, 48, VIEW.width - 48);
    const popup = this.add.text(x, y, text,
      textStyle('popup', { fontSize: `${size}px`, color: P.ink, stroke: level && P.inkIsLight === false ? '#ffffff' : P.bg, strokeThickness: 7 })).setOrigin(0.5).setDepth(20).setScale(0.4);
    this.tweens.add({ targets: popup, scale: 1.15, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: popup, y: y - 56, alpha: 0,
      duration: 800, delay: 140, ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  /** A colour wave: every bubble swells in turn from the left, so the whole board answers a big moment. */
  boardWave(strength = 1) {
    if (this.reduce) return;
    forEachCell((r, c) => {
      const b = this.grid[r]?.[c];
      if (!b || !b.active) return;
      this.tweens.add({ targets: b, scale: BS * (1 + 0.14 * strength), duration: 120, delay: c * 24 + r * 5, yoyo: true, ease: 'Sine.easeOut' });
    });
  }

  /** The tier-up sticker: FIRE, UNREAL, LEGENDARY. It lands with a hit-stop and a shake, holds, then goes. */
  showTierBanner(label, tier) {
    if (this.time.now - (this._feverStartAt || -9999) < 1500) return;
    const { width } = VIEW;
    const cy = GRID_OFFSET_Y + 70;
    const t = this.add.text(width / 2, cy, label + '!',
      textStyle('heading', { fontSize: `${46 + tier * 6}px`, color: P.hot, stroke: P.ink, strokeThickness: 9 })).setOrigin(0.5).setDepth(56).setScale(0.4).setAngle(-6);
    this._tierBanner = t;
    const fit = Math.min(1, 380 / (t.width * 1.2)); // a long word like LEGENDARY must never run off the screen
    this.tweens.add({ targets: t, scale: 1.2 * fit, angle: -3, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, scale: fit, duration: 200, delay: 220 });
    this.tweens.add({ targets: t, alpha: 0, y: cy - 34, duration: 320, delay: 760, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    if (tier >= 2) { this.hitStop(150, 0.18); this.shake(180, 0.008); }
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
    // Counted down in update() with the real frame delta, so it ends on time even if the tab stalls.
    this.stopMs = Math.max(this.stopMs || 0, ms);
  }

  /**
   * Cascade chain banner: "CHAIN x3" as a sticker over the board with a starburst behind it.
   * Fires when gravity-induced matches chain (depth 2 or more). Bigger chains get a bigger banner and more shake.
   */
  showChainBanner(depth) {
    if (this.time.now - (this._feverStartAt || -9999) < 1500) return; // the fever banner owns the screen for a moment
    const { width } = VIEW;
    const cx = width / 2;
    const cy = GRID_OFFSET_Y + 200;
    const label = `CHAIN ×${depth}`;
    const fontSize = Math.min(32 + depth * 6, 60);
    const mega = depth >= 4;
    const fill = P.hotN;
    const textCol = P.ink;

    this.clearBanners();
    const burst = this.add.graphics().setDepth(28);
    burst.fillStyle(fill, 0.97);
    const spikes = 12 + depth * 2, rIn = 46 + depth * 5, rOut = Math.min(150, 84 + depth * 14);
    burst.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 ? rIn : rOut;
      burst[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    burst.closePath(); burst.fillPath();
    burst.lineStyle(4, P.inkN, 1); burst.strokePath();
    burst.setPosition(cx, cy).setScale(0.2).setAlpha(0.97);

    const main = this.add.text(cx, cy, label,
      textStyle('popup', { fontSize: `${fontSize}px`, color: textCol, stroke: '#ffffff', strokeThickness: 8, fontStyle: 'bold italic' })
    ).setOrigin(0.5).setDepth(30).setScale(0.3);
    const bonus = this.add.text(cx, cy + fontSize * 0.75, `+${(depth - 1) * 25} CHAIN BONUS`,
      textStyle('badge', { fontSize: '14px', color: textCol, stroke: '#ffffff', strokeThickness: 5 })
    ).setOrigin(0.5).setAlpha(0).setDepth(30);

    this._banners = [main, burst, bonus];
    this.tweens.add({ targets: [main, burst], scale: 1, duration: 320, ease: 'Back.easeOut' });
    if (!this.reduce) this.tweens.add({ targets: burst, angle: 24, duration: 1100, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: bonus, alpha: 1, y: cy + fontSize * 0.68, duration: 250, delay: 150, ease: 'Quad.easeOut' });
    if (depth >= 3) this.chainShockwave(cx, cy, depth);
    if (depth >= 3) this.shake(200, 0.006 + depth * 0.002);

    this.tweens.add({
      targets: [main, burst, bonus],
      alpha: 0, y: '-=26', scale: 1.15,
      duration: 500, delay: 900, ease: 'Quad.easeIn',
      onComplete: () => { main.destroy(); burst.destroy(); bonus.destroy(); },
    });
  }

  /** Remove any chain or tier banner still on screen (a fever starting must not print over one). */
  clearBanners() {
    (this._banners || []).forEach((o) => { if (o && o.active) { this.tweens.killTweensOf(o); o.destroy(); } });
    this._banners = [];
    if (this._tierBanner && this._tierBanner.active) { this.tweens.killTweensOf(this._tierBanner); this._tierBanner.destroy(); }
  }

  /** From chain 3 on, a ring of ink sweeps across the whole board and every head leans away from the middle. */
  chainShockwave(cx, cy, depth) {
    if (this.reduce) return;
    const ring = this.add.graphics().setDepth(27).setPosition(cx, cy);
    ring.lineStyle(10, P.inkN, 1); ring.strokeCircle(0, 0, 40);
    ring.lineStyle(5, P.hotN, 1); ring.strokeCircle(0, 0, 52);
    this.tweens.add({ targets: ring, scale: 5 + depth, alpha: 0, duration: 520 + depth * 40, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    forEachCell((r, c) => {
      const b = this.grid[r]?.[c];
      if (!b || !b.active) return;
      const d = Math.hypot(b.x - cx, b.y - cy);
      this.time.delayedCall(Math.min(420, d * 0.9), () => { this.setMood(b, 'peek', 300); });
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
            this.headDepth(bubble);
            const pos = this.gridToWorld(emptyRow, col);
            const dropDist = emptyRow - row;
            bubble.hd.mood = 'peek'; bubble.hd.moodEnd = this.time.now + 99999;
            this.tweens.add({
              targets: bubble, y: pos.y,
              duration: this.reduce ? 1 : 110 + Math.sqrt(dropDist) * 115, delay: col * 14, ease: 'Quad.easeIn',
              onStart: () => { if (!this.reduce && bubble.active) bubble.setScale(BS * 0.93, BS * 1.09); },
              onComplete: () => this.landHead(bubble, dropDist),
            });
          }
          emptyRow--;
        }
      }
    }
    this.resortHeads();
  }

  refillGrid() {
    for (let col = 0; col < GRID_COLS; col++) {
      let empties = 0;
      for (let row = 0; row < GRID_ROWS; row++) if (this.grid[row][col] === null) empties++;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] === null) {
          // Every new head in a column falls the same distance (past the top edge), so they land in order, bottom first.
          this.spawnBubble(row, col, true, (empties + 0.6) * CELL, col * 14);
        }
      }
    }
  }

  // -----------------------------------------------------------
  // HYPE: the streak shows in the combo band, tier-ups slam across the board
  // -----------------------------------------------------------
  triggerHypeBar() {
    const level = getStreakLevel(this.streak);
    if (!level) {
      this.tierText.setText('');
      this.lastTier = 0;
      return;
    }
    const tier = STREAK_LEVELS.indexOf(level) + 1;
    this.tierText.setText('');

    if (tier !== this.lastTier) { this.lastTier = tier; this.showTierBanner(level.label, tier); }
    if (this.streak >= 5) this.boardWave(this.streak >= 8 ? 1.4 : 1);
    if (this.streak >= 5) this.flashHypeBar();
    if (this.streak >= 8) this.spawnStreakParticles();
  }

  /** The board border flashes in the accent on a hot streak. */
  flashHypeBar() {
    if (this.reduce) return;
    const br = this.boardRect;
    const bf = this.add.graphics().setDepth(7);
    bf.lineStyle(7, P.hotN, 1); bf.strokeRoundedRect(br.x - 3, br.y - 3, br.w + 6, br.h + 6, 16);
    this.tweens.add({ targets: bf, alpha: 0, duration: 520, onComplete: () => bf.destroy() });
  }

  /** Doodle stars shoot up from the bottom of the board on a big streak. */
  spawnStreakParticles() {
    if (this.reduce) return;
    const { width } = VIEW;
    for (let i = 0; i < 12; i++) {
      this.fx.spawn({ frame: i % 2 ? 'star_hot' : 'star_ink', x: Phaser.Math.Between(40, width - 40), y: this.boardRect.y + this.boardRect.h - 10, vy: -(200 + Math.random() * 180), vx: Phaser.Math.Between(-40, 40), g: 260, rot: Math.random() * 60, vr: Phaser.Math.Between(-300, 300), s0: 0.34 + Math.random() * 0.3, s1: 0.1, dur: 900, depth: 7, fadeAt: 0.6 });
    }
  }

  updateStreakUI() {
    if (this.streak > 1) {
      this.streakCounter.setText(`STREAK ${this.streak}×`);
      this.streakCounter.setColor(this.feverActive ? this.hudInk : this.streak >= 5 ? P.hot : P.ink);
      this.streakCounter.setX(this.feverActive ? 104 : 82);
    } else {
      this.streakCounter.setText('');
    }
    if (this.bestStreak > 2) {
      this.bestStreakText.setText(`best this round ${this.bestStreak}×`);
    }
    this.updateMultiplierBadge();
  }

  // -----------------------------------------------------------
  // MULTIPLIER STICKER: the multiplier the score really uses (streak up to 10, doubled in fever), always visible
  // -----------------------------------------------------------
  updateMultiplierBadge() {
    if (!this.multBadge) return;
    const fever = this.feverActive;
    const mult = effectiveMultiplier(this.streak, fever);
    const radius = 26 + Math.min(mult - 1, 10) * 0.35;
    const hot = mult >= 5 || fever;
    this.multRing.clear();
    this.multRing.fillStyle(P.inkN, 1);
    this.multRing.fillCircle(0, 3, radius);
    this.multRing.fillStyle(hot ? P.hotN : P.cardN, 1);
    this.multRing.fillCircle(0, 0, radius);
    this.multRing.lineStyle(3.5, P.inkN, 1);
    this.multRing.strokeCircle(0, 0, radius);

    const onFill = contrastPick(hot ? P.hot : P.card, ['#0a0a0a', '#ffffff']);
    this.multText.setText(`×${mult}`);
    this.multText.setColor(onFill);
    this.multText.setFontSize(mult >= 10 ? '28px' : '32px');
    this.multLabel.setColor(onFill);

    this.multBase = fever ? 1.22 : 1;
    this.multBadge.setPosition(fever ? 56 : 44, BAND_Y + (fever ? 36 : 33));
    if (mult !== this._lastMult) {
      this._lastMult = mult;
      if (!this.reduce) { this.multBadge.setScale(this.multBase * 1.4); this.tweens.add({ targets: this.multBadge, scale: this.multBase, duration: 260, ease: 'Back.easeOut' }); }
      else this.multBadge.setScale(this.multBase);
    } else if (!this.reduce) {
      this.tweens.add({ targets: this.multBadge, scale: this.multBase, duration: 160, ease: 'Quad.easeOut' });
    } else this.multBadge.setScale(this.multBase);
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
        this.applyCrew(this.grid[r][c], newColor);
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
