// What's Poppin: the stickman cast.
// The same figures as the app (src/art/stickKit.ts): same joints, same poses, same faces, same accessories,
// same ink and vermilion. They are drawn on a 2D canvas every frame instead of baked as SVG, so limbs tween
// between poses, bodies bob and squash, eyes blink, and a hand-drawn "boil" wobbles the lines like a flipbook.
// Feet sit at (0,0); the head centre is at (0,-92). Units match the kit.

const STICK_LEGS = {
  stand: [[-6, -19, -13, 0], [6, -19, 13, 0]],
  wide: [[-10, -19, -22, 0], [10, -19, 22, 0]],
  run: [[-12, -22, -26, -12], [10, -20, 10, 0]],
  kneel: [[-4, -20, -18, -18], [10, -20, 10, 0]],
  jump: [[-10, -26, -16, -10], [10, -26, 16, -10]],
};
// [elbowX, elbowY, handX, handY] for the viewer-left and viewer-right arms.
const STICK_ARMS = {
  stand: [[-10, -55, -14, -40], [10, -55, 14, -40]],
  point: [[-10, -55, -14, -40], [18, -72, 38, -78]],
  pointUp: [[-10, -55, -14, -40], [14, -80, 16, -104]],
  shrug: [[-17, -62, -24, -76], [17, -62, 24, -76]],
  panic: [[-14, -84, -22, -102], [14, -84, 22, -102]],
  cheer: [[-18, -84, -30, -100], [18, -84, 30, -100]],
  think: [[-10, -55, -14, -40], [14, -60, 6, -80]],
  facepalm: [[-10, -55, -14, -40], [15, -68, 3, -92]],
  wave: [[-10, -55, -14, -40], [18, -78, 22, -100]],
  hips: [[-14, -56, -6, -40], [14, -56, 6, -40]],
  present: [[-16, -60, -30, -58], [16, -60, 30, -58]],
  holdOut: [[-10, -55, -14, -40], [14, -58, 30, -56]],
  hold: [[-14, -86, -18, -106], [14, -86, 18, -106]],
};
// Which legs a pose stands on, as the kit chooses.
const STICK_POSE_LEGS = { cheer: 'wide', panic: 'wide', hold: 'wide' };

const _ease = (t) => t * t * (3 - 2 * t);
const _lerp = (a, b, t) => a + (b - a) * t;
const _lerpSet = (a, b, t) => a.map((limb, i) => limb.map((v, j) => _lerp(v, b[i][j], t)));
function _rnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

class StickFigure {
  /**
   * @param {object} o
   * @param {string[]} [o.wear] accessory names (hero, glasses, tie, bun, hair, steam, sparkle, sweat, bang, question)
   * @param {boolean} [o.robot]
   * @param {number} [o.scale]
   * @param {boolean} [o.flip]
   * @param {string} [o.name]
   * @param {number} [o.seed] makes each figure's idle and boil different
   */
  constructor(o) {
    this.wear = o.wear || [];
    this.robot = !!o.robot;
    this.scale = o.scale || 1;
    this.flip = !!o.flip;
    this.name = o.name || '';
    this.seed = o.seed || 1;
    this.x = 0; this.y = 0;
    this.pose = 'stand'; this.face = 'happy';
    this.arms = STICK_ARMS.stand.map((l) => l.slice());
    this.legs = STICK_LEGS.stand.map((l) => l.slice());
    this.from = null; this.to = null; this.tweenT = 1; this.tweenMs = 1;
    this.hopY = 0; this.vy = 0; this.squash = 0; // squash: + = squashed (landing), - = stretched (take-off)
    this.look = 0; this.mouthOpen = null;
    this.blinkAt = 1500 + _rnd(this.seed) * 2500; this.blinking = 0;
    this.extras = {}; // transient accessories: sweat, bang, question, sparkle
    this.holdUntil = 0;
  }

  /** Move to a pose over `ms` (default a quick snap). The legs follow the pose unless `legs` is named. */
  setPose(name, ms = 140, legs) {
    if (!STICK_ARMS[name]) name = 'stand';
    const legName = legs || STICK_POSE_LEGS[name] || 'stand';
    this.pose = name;
    this.from = { arms: this.arms.map((l) => l.slice()), legs: this.legs.map((l) => l.slice()) };
    this.to = { arms: STICK_ARMS[name], legs: STICK_LEGS[legName] };
    this.tweenT = 0; this.tweenMs = Math.max(1, ms);
  }

  setFace(kind) { this.face = kind; }

  /** Jump. Power 1 is a small bounce; 3 is a leap. */
  hop(power = 1) {
    if (this.hopY < 2) { this.vy = -170 * Math.sqrt(Math.min(power, 2.2)); this.squash = -0.18; }
  }

  update(dtMs, tMs, reduce) {
    const dt = Math.min(dtMs, 50);
    if (this.tweenT < 1) {
      this.tweenT = Math.min(1, this.tweenT + dt / this.tweenMs);
      const e = reduce ? 1 : _ease(this.tweenT);
      this.arms = _lerpSet(this.from.arms, this.to.arms, e);
      this.legs = _lerpSet(this.from.legs, this.to.legs, e);
    }
    // Hop physics (y is up-negative: hopY is how far above the ground).
    if (this.vy !== 0 || this.hopY > 0) {
      this.vy += 900 * (dt / 1000);
      this.hopY = Math.max(0, this.hopY - this.vy * (dt / 1000));
      if (this.hopY === 0 && this.vy > 0) { this.vy = 0; this.squash = 0.22; }
    }
    this.squash *= Math.pow(0.002, dt / 1000);
    // Blink.
    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && !this.blinking) { this.blinking = 120; this.blinkAt = 2200 + _rnd(tMs + this.seed) * 3200; }
    if (this.blinking) this.blinking = Math.max(0, this.blinking - dt);
  }

  /** Draw at the current x, y (the ground point), in the context's units. */
  draw(ctx, P, tMs, reduce) {
    const boil = Math.floor(tMs / 110); // the line boil changes about 9 times a second
    const idle = reduce ? 0 : Math.sin(tMs / 520 + this.seed * 2.1);
    const breathe = 1 + idle * 0.012;
    const sy = this.scale * (1 - this.squash * 0.55) * breathe;
    const sx = this.scale * (1 + this.squash * 0.45) * (this.flip ? -1 : 1);
    const lean = reduce ? 0 : idle * 0.025;
    ctx.save();
    ctx.translate(this.x, this.y - this.hopY * this.scale);
    ctx.rotate(lean);
    ctx.scale(sx, sy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ink = P.ink;
    const w = (a, b, c, d, e, f) => this._poly(ctx, a, b, c, d, e, f, boil);
    // Shadow-free: the stage draws the ground. Body.
    ctx.strokeStyle = ink; ctx.lineWidth = 3.2;
    ctx.beginPath();
    w(0, -38, this.legs[0][0], this.legs[0][1], this.legs[0][2], this.legs[0][3]);
    w(0, -38, this.legs[1][0], this.legs[1][1], this.legs[1][2], this.legs[1][3]);
    ctx.moveTo(0, -79); ctx.lineTo(0, -38);
    w(0, -70, this.arms[0][0], this.arms[0][1], this.arms[0][2], this.arms[0][3]);
    w(0, -70, this.arms[1][0], this.arms[1][1], this.arms[1][2], this.arms[1][3]);
    ctx.stroke();
    // Head.
    if (this.robot) this._robotHead(ctx, P);
    else {
      ctx.beginPath();
      const r = 13 + (reduce ? 0 : Math.sin(boil * 1.7 + this.seed) * 0.35);
      ctx.arc(0, -92, r, 0, Math.PI * 2);
      ctx.fillStyle = P.bg; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
      this._face(ctx, P);
    }
    this._accessories(ctx, P, tMs);
    ctx.restore();
  }

  // Two-segment limb with a slight boil so lines never sit perfectly still.
  _poly(ctx, ax, ay, bx, by, cx, cy, boil) {
    const j = (i) => (_rnd(boil * 13 + this.seed * 7 + i) - 0.5) * 1.1;
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx + j(1), by + j(2));
    ctx.lineTo(cx + j(3), cy + j(4));
  }

  _face(ctx, P) {
    const ink = P.ink, acc = P.hot;
    const k = this.face, lx = this.look * 3;
    const eyeY = -94, ex = 4.6;
    const blink = this.blinking > 0 && k !== 'cool' && k !== 'dead' && k !== 'zen';
    ctx.fillStyle = ink; ctx.strokeStyle = ink;
    const dot = (x, y, r = 1.7) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const path = (d, o = {}) => {
      const p = new Path2D(d);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(p); }
      if (o.stroke !== null) { ctx.lineWidth = o.w || 1.7; ctx.strokeStyle = o.stroke || ink; ctx.stroke(p); }
    };
    const mouth = (d) => path(d, { w: 1.7 });
    // Eyes.
    if (k === 'cool') path('M-10 -96.5h20v3.5q-1.5 4 -5.5 4t-4.5 -3.5q-0.5 3.5 -4.5 3.5t-5.5 -4z', { fill: ink, stroke: null });
    else if (k === 'dead') { path('M-7 -96.4l4.8 4.8M-2.2 -96.4l-4.8 4.8M2.2 -96.4l4.8 4.8M7 -96.4l-4.8 4.8', { w: 1.6 }); }
    else if (k === 'zen') { path('M-7 -94q2.5 2 5 0M2 -94q2.5 2 5 0', { w: 1.5 }); }
    else if (blink) path(`M${-ex - 2 + lx} ${eyeY}h4M${ex - 2 + lx} ${eyeY}h4`, { w: 1.6 });
    else if (k === 'spiral') { dot(-ex + lx, eyeY, 2.4); ctx.fillStyle = P.bg; dot(-ex + lx, eyeY, 1.1); dot(ex + lx, eyeY, 0.1); ctx.fillStyle = ink; dot(ex + lx, eyeY, 2.4); ctx.fillStyle = P.bg; dot(ex + lx, eyeY, 1.1); ctx.fillStyle = ink; }
    else { dot(-ex + lx, eyeY); dot(ex + lx, eyeY); }
    // Mouth and brows.
    if (this.mouthOpen !== null) {
      ctx.beginPath(); ctx.ellipse(lx, -86.5, 3.2 + this.mouthOpen * 1.4, 0.7 + this.mouthOpen * 3.4, 0, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
      return;
    }
    switch (k) {
      case 'happy': mouth(`M${-5 + lx} -87.5Q${lx} -82.5 ${5 + lx} -87.5`); break;
      case 'grin': path(`M${-6 + lx} -88.5Q${lx} -79 ${6 + lx} -88.5Z`, { fill: ink, stroke: null }); break;
      case 'sad': mouth(`M${-5 + lx} -84.5Q${lx} -89 ${5 + lx} -84.5`); break;
      case 'flat': mouth(`M${-4 + lx} -86.5h8`); break;
      case 'shock': ctx.beginPath(); ctx.ellipse(lx, -85.5, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.lineWidth = 1.6; ctx.stroke(); break;
      case 'smug': mouth(`M${-3 + lx} -86.5Q${2 + lx} -84.5 ${6 + lx} -89`); path(`M${-7 + lx} -99l5 1.5M${2 + lx} -97.5l5 -1.5`, { w: 1.4 }); break;
      case 'angry': mouth(`M${-5 + lx} -85Q${lx} -89 ${5 + lx} -85`); path(`M${-7 + lx} -100l5 3M${7 + lx} -100l-5 3`, { w: 1.6 }); break;
      case 'dead': mouth('M-4 -86.5q2 -2 4 0t4 0'); break;
      case 'cool': mouth('M-4 -86Q1 -83.5 5 -87'); break;
      case 'cry': mouth('M-5 -84.5Q0 -89 5 -84.5'); path('M-5 -91v6M5 -91v6', { stroke: acc, w: 1.6 }); break;
      case 'zen': mouth('M-4 -87.5Q0 -84.5 4 -87.5'); break;
      case 'spiral': mouth('M-4 -86q2 -2 4 0t4 0'); break;
      default: break;
    }
  }

  _robotHead(ctx, P) {
    const ink = P.ink;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-14, -106, 28, 26, 6); else ctx.rect(-14, -106, 28, 26);
    ctx.fillStyle = P.bg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -106); ctx.lineTo(0, -114); ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -117, 3.6, 0, Math.PI * 2); ctx.fillStyle = P.hot; ctx.fill();
    ctx.fillStyle = ink;
    if (this.blinking > 0) { ctx.fillRect(-8, -96, 4.4, 1.4); ctx.fillRect(3.6, -96, 4.4, 1.4); }
    else { ctx.fillRect(-8 + this.look * 1.5, -98, 4.4, 4.4); ctx.fillRect(3.6 + this.look * 1.5, -98, 4.4, 4.4); }
    const f = this.face;
    ctx.lineWidth = 1.7; ctx.strokeStyle = ink;
    if (this.mouthOpen !== null) { ctx.fillRect(-6, -87 - this.mouthOpen * 3, 12, 1.6 + this.mouthOpen * 6); return; }
    const m = {
      happy: 'M-5 -86q5 4 10 0', grin: 'M-6 -87q6 7 12 0z', sad: 'M-5 -84q5 -4 10 0', smug: 'M-4 -86q6 2 9 -3', cool: 'M-5 -86q5 3 10 0',
    }[f];
    if (f === 'shock') ctx.strokeRect(-2.5, -89, 5, 5);
    else if (f === 'grin') { const p = new Path2D(m); ctx.fillStyle = ink; ctx.fill(p); }
    else if (m) ctx.stroke(new Path2D(m));
    else { ctx.beginPath(); ctx.moveTo(-5, -86); ctx.lineTo(5, -86); ctx.stroke(); }
  }

  _accessories(ctx, P, tMs) {
    const ink = P.ink, acc = P.hot, paper = P.bg;
    const has = (n) => this.wear.includes(n);
    const stroke = (d, c, w) => { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(new Path2D(d)); };
    const fill = (d, c) => { ctx.fillStyle = c; ctx.fill(new Path2D(d)); };
    if (has('hero')) {
      stroke('M-13 -97.5Q0 -101 13 -97.5', acc, 4.2);
      // The tails flutter.
      const f = Math.sin(tMs / 170 + this.seed) * 2;
      stroke(`M-12.5 -97.5q-9 ${-2 + f * 0.3} -16 ${3.5 + f}M-12.5 -97q-8 3 -12 ${10 + f * 0.6}`, acc, 2.6);
    }
    if (has('tie')) fill('M0 -76l-3 4 3 18 3 -18z', ink);
    if (has('glasses')) {
      ctx.fillStyle = paper; ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(-5, -94, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(5, -94, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      stroke('M-1.4 -94h2.8', ink, 1.4);
    }
    if (has('hair')) stroke('M-12 -98l3 -9 3 5 3 -8 3 7 4 -7 2 8 4 -3 -2 8', ink, 2.4);
    if (has('bun')) { ctx.beginPath(); ctx.arc(0, -108, 5.5, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); }
    if (has('steam')) stroke('M-10 -112q-3 -5 0 -9t0 -9M0 -114q-3 -5 0 -9t0 -9M10 -112q-3 -5 0 -9t0 -9', acc, 1.8);
    if (has('sparkle') || this.extras.sparkle) fill('M20 -108l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z', acc);
    if (this.extras.sweat) {
      ctx.fillStyle = paper; ctx.strokeStyle = ink; ctx.lineWidth = 1.3;
      ctx.stroke(new Path2D('M16 -104q-4 6 0 8q4 -2 0 -8z')); ctx.fill(new Path2D('M16 -104q-4 6 0 8q4 -2 0 -8z'));
      ctx.stroke(new Path2D('M20 -94q-3 4 0 6q3 -2 0 -6z')); ctx.fill(new Path2D('M20 -94q-3 4 0 6q3 -2 0 -6z'));
    }
    if (this.extras.bang || this.extras.question) {
      ctx.font = '20px "Archivo Black", Impact, sans-serif'; ctx.fillStyle = acc;
      ctx.fillText(this.extras.bang ? '!' : '?', 15, -104);
    }
  }
}

/**
 * The cast on its stage: four figures drawn onto one canvas texture, reacting to play.
 * Hero is the player's avatar; Bolt, Pro and Spark are the crowd. A streak makes more of them join in.
 */
class Cast {
  constructor(scene, x, y, w, h) {
    this.scene = scene; this.w = w; this.h = h; this.reduce = REDUCE_MOTION;
    const tex = scene.textures.createCanvas('cast_' + Math.random().toString(36).slice(2, 8), Math.round(w * Z), Math.round(h * Z));
    this.tex = tex; this.ctx = tex.getContext();
    this.img = scene.add.image(x, y, tex.key).setOrigin(0, 0).setScale(1 / Z).setDepth(4);
    const ground = h - 26;
    this.ground = ground;
    const wear = (P.wear && P.wear.length) ? P.wear : ['hero'];
    this.hero = new StickFigure({ wear, scale: 1.0, name: 'Hero', seed: 1 });
    this.pro = new StickFigure({ wear: ['glasses', 'tie'], scale: 0.92, name: 'Pro', seed: 2, flip: true });
    this.bolt = new StickFigure({ robot: true, scale: 0.92, name: 'Bolt', seed: 3 });
    this.spark = new StickFigure({ wear: ['bun'], scale: 0.88, name: 'Spark', seed: 4 });
    this.members = [this.spark, this.hero, this.pro, this.bolt];
    const xs = [w * 0.13, w * 0.36, w * 0.62, w * 0.86];
    this.members.forEach((m, i) => { m.x = xs[i]; m.y = ground; });
    this.hero.x = w * 0.37;
    this.last = 0; this.acc = 0; this.revert = 0; this.mood = 'idle'; this.feverOn = false; this.panicOn = false;
    this.setIdle();
  }

  setIdle() {
    this.hero.setPose('hips', 200); this.hero.setFace('happy'); this.hero.mouthOpen = null;
    this.pro.setPose('stand', 200); this.pro.setFace('happy');
    this.bolt.setPose('stand', 200); this.bolt.setFace('happy');
    this.spark.setPose('hips', 200); this.spark.setFace('happy');
    this.members.forEach((m) => { m.extras = {}; });
    this.mood = 'idle';
  }

  /** Hold a reaction for `ms`, then settle back to idle (or to fever / panic when those are on). */
  _hold(ms) { this.revert = ms; }

  /** Eyes follow the action: x is a 0..1 position across the board. */
  lookAt(px) {
    const l = (px - 0.5) * 2;
    this.members.forEach((m) => { m.look = Math.max(-1, Math.min(1, l * (m.flip ? -1 : 1) * 0.9)); });
  }

  onPop(count, streak, px) {
    if (this.feverOn || this.panicOn) return;
    if (px !== undefined) this.lookAt(px);
    this.popN = (this.popN || 0) + 1;
    // Each pop one of the crew reacts in their own way, in turn.
    const who = this.popN % 4;
    if (who === 0) { this.hero.setPose('cheer', 90); this.hero.setFace(count >= 4 ? 'grin' : 'happy'); this.hero.hop(count >= 4 ? 1.1 : 0.6); }
    else if (who === 1) { this.spark.setPose('cheer', 90); this.spark.setFace('grin'); this.spark.hop(0.9); }
    else if (who === 2) { this.pro.setPose('think', 110); this.pro.setFace('smug'); this.pro.hop(0.4); }
    else { this.bolt.setPose('wave', 90); this.bolt.setFace('grin'); this.bolt.hop(0.7); }
    if (streak <= 2) this._hold(520);
  }

  /** A streak tier arrived (1 = NICE at 3, 2 = FIRE at 5, 3 = GODLIKE at 8, 4 = LEGENDARY at 12). */
  onStreak(tier) {
    if (this.feverOn || this.panicOn) return;
    this.mood = 'streak';
    this.hero.setPose('cheer', 110); this.hero.setFace('grin'); this.hero.hop(1.4 + tier * 0.3);
    if (tier >= 1) setTimeout(() => { this.spark.setPose('cheer', 130); this.spark.setFace('grin'); this.spark.hop(1); }, 80);
    if (tier >= 2) setTimeout(() => { this.pro.setPose('present', 130); this.pro.setFace('smug'); this.pro.hop(0.7); }, 160);
    if (tier >= 3) setTimeout(() => { this.bolt.setPose('cheer', 130); this.bolt.setFace('grin'); this.bolt.hop(1.2); this.pro.setPose('cheer', 130); this.pro.setFace('grin'); }, 240);
    if (tier >= 4) { this.hero.setFace('cool'); this.members.forEach((m) => { m.extras.sparkle = true; m.hop(1.6); }); }
    this._hold(1500);
  }

  onPowerUpMade() {
    if (this.feverOn || this.panicOn) return;
    this.hero.setPose('pointUp', 110); this.hero.setFace('shock'); this.hero.extras.bang = true; this.hero.hop(1.6);
    this.pro.setFace('shock'); this.bolt.setFace('shock'); this.bolt.setPose('wave', 120);
    this._hold(900);
  }

  onBlast() {
    if (this.feverOn || this.panicOn) return;
    this.members.forEach((m) => { m.setPose('panic', 90); m.setFace('shock'); m.hop(1.2); });
    this._hold(800);
  }

  onChain(depth) {
    if (this.feverOn || this.panicOn) return;
    this.hero.setPose('cheer', 110); this.hero.setFace('grin'); this.hero.hop(1.2 + depth * 0.3);
    this.spark.setPose('cheer', 110); this.spark.hop(1);
    this._hold(1100);
  }

  onInvalid() {
    if (this.feverOn || this.panicOn) return;
    this.hero.setPose('shrug', 120); this.hero.setFace('flat');
    this.pro.setPose('facepalm', 140); this.pro.setFace('flat');
    this._hold(700);
  }

  onHint() {
    if (this.feverOn || this.panicOn) return;
    this.hero.setPose('think', 160); this.hero.setFace('smug'); this.hero.extras.question = true;
    this._hold(1800);
  }

  setFever(on) {
    this.feverOn = on;
    if (on) {
      this.members.forEach((m, i) => { m.setPose('cheer', 100); m.setFace('grin'); m.extras.sparkle = true; setTimeout(() => m.hop(1.3), i * 70); });
      this.revert = 0;
    } else { this.setIdle(); }
  }

  setPanic(on) {
    if (on === this.panicOn) return;
    this.panicOn = on;
    if (on && !this.feverOn) {
      this.members.forEach((m) => { m.setPose('panic', 160); m.setFace('shock'); m.extras = { sweat: true }; });
      this.revert = 0;
    } else if (!on) this.setIdle();
  }

  /** End of round: a good score celebrates, a low one is a shrug and a smile. */
  finish(good) {
    this.feverOn = false; this.panicOn = false; this.revert = 0;
    if (good) {
      this.members.forEach((m, i) => { m.setPose('cheer', 120); m.setFace(i === 1 ? 'cool' : 'grin'); m.extras = { sparkle: true }; m.hop(1.5); });
    } else {
      this.hero.setPose('shrug', 200); this.hero.setFace('sad'); this.hero.extras = { sweat: true };
      this.pro.setPose('facepalm', 200); this.pro.setFace('sad');
      this.bolt.setPose('shrug', 200); this.bolt.setFace('sad');
      this.spark.setPose('hips', 200); this.spark.setFace('flat');
    }
  }

  update(time, delta) {
    // Idle life: every few seconds one of the crew does a little something, so the stage never freezes.
    if (!this.reduce && !this.feverOn && !this.panicOn && this.mood === 'idle') {
      this.idleIn = (this.idleIn === undefined ? 1800 : this.idleIn) - delta;
      if (this.idleIn <= 0) {
        this.idleIn = 2200 + Math.random() * 2200;
        const m = this.members[Math.floor(Math.random() * 4)];
        const poses = [['wave', 'grin'], ['think', 'smug'], ['shrug', 'happy'], ['cheer', 'grin']];
        const [p, f] = poses[Math.floor(Math.random() * poses.length)];
        m.setPose(p, 160); m.setFace(f); m.hop(0.5);
        this.look = Math.random();
        setTimeout(() => { if (this.mood === 'idle' && !this.feverOn && !this.panicOn) { m.setPose(m === this.hero || m === this.spark ? 'hips' : 'stand', 220); m.setFace('happy'); } }, 1100);
      }
    }
    if (this.revert > 0) {
      this.revert -= delta;
      if (this.revert <= 0 && !this.feverOn && !this.panicOn) this.setIdle();
    }
    this.members.forEach((m) => m.update(delta, time, this.reduce));
    // Redraw at about 30 frames a second; the line boil is slower than that anyway.
    this.acc += delta;
    if (this.acc < 32) return;
    this.acc = 0;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.tex.width, this.tex.height);
    ctx.setTransform(Z, 0, 0, Z, 0, 0);
    ctx.font = '20px "Archivo Black", Impact, sans-serif';
    // Back to front: the small crowd first, then the hero.
    [this.spark, this.bolt, this.pro, this.hero].forEach((m) => {
      m.draw(ctx, P, time, this.reduce);
    });
    this.tex.refresh();
  }

  destroy() { if (this.img) this.img.destroy(); if (this.tex) this.tex.destroy(); }
}
