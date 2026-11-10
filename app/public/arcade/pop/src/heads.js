// What's Poppin: the crew's heads and the pop frames, drawn ONCE into cached sprite atlases (per theme, since the
// page is opened with one theme), then blitted. 80 live heads cost 80 image draws, not 80 canvas redraws.
// Style: the app's own stick style (src/art/stickKit.ts): ink outline, flat fills, dot eyes, a hand-drawn wobble.
// No gradients, no gloss. Identity is colour + accessory + face habit, so shape alone tells the crew apart.

const HEAD_CELL = 72, HEAD_CX = 36, HEAD_CY = 40, HEAD_R = 23;
const HEAD_FRAMES = ['idle0', 'idle1', 'blink', 'lookL', 'lookR', 'peek', 'squeeze', 'hit', 'cheer0', 'cheer1', 'worry'];
const POP_CELL = 96;
const POP_SPLAT_FRAMES = 6;

function _hrnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/** A circle whose outline wobbles a little, like a pen line. `seed` changes the wobble (the idle "boil"). */
function _wobbleCircle(ctx, cx, cy, r, seed, amp) {
  const n = 44;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amp * (Math.sin(a * 3 + seed) + 0.6 * Math.sin(a * 5 + seed * 1.7));
    const x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Colourblind shape badge: one distinct glyph per crew member, in the chin corner. */
const _CB_GLYPHS = [
  (c, x, y, s) => { c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.7, y); c.closePath(); c.fill(); },
  (c, x, y, s) => { c.lineWidth = 2.6; c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y + s); c.moveTo(x + s, y - s); c.lineTo(x - s, y + s); c.stroke(); },
  (c, x, y, s) => { c.lineWidth = 2.6; c.beginPath(); c.arc(x, y, s * 0.85, 0, Math.PI * 2); c.stroke(); },
  (c, x, y, s) => { c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y + s * 0.7); c.lineTo(x - s, y + s * 0.7); c.closePath(); c.fill(); },
  (c, x, y, s) => { c.fillRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4); },
  (c, x, y, s) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; const rr = i % 2 === 0 ? s : s * 0.45; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); },
];

/**
 * Draw one head frame into a 72x72 logical cell (ctx origin = cell top-left, already scaled by Z).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} crew 0..5
 * @param {string} frame one of HEAD_FRAMES
 * @param {boolean} cb draw the colourblind shape badge
 */
function drawHead(ctx, crew, frame, cb) {
  const fill = P.bubbles[crew];
  const ink = P.ink;
  const fg = contrastPick(fill, ['#0a0a0a', '#ffffff']);        // eyes and mouth
  const acc = contrastPick(fill, [P.hot, '#ffffff', '#0a0a0a']); // accessory colour
  const trait = CREW[crew].trait;
  const cx = HEAD_CX, cy = HEAD_CY, R = HEAD_R;
  const fi = HEAD_FRAMES.indexOf(frame);
  const seed = crew * 3.1 + (frame === 'idle1' ? 4.3 : 0) + fi * 0.37;
  const jx = frame === 'idle1' ? 0.5 : 0, jy = frame === 'idle1' ? -0.4 : 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // Arms for the dance frames (behind the head).
  if (frame === 'cheer0' || frame === 'cheer1') {
    ctx.strokeStyle = ink; ctx.lineWidth = 3.4; ctx.fillStyle = fill;
    const up = frame === 'cheer0';
    for (const s of [-1, 1]) {
      const sx = cx + s * (R - 2), sy = cy + 6;
      const ex = cx + s * (R + (up ? 7 : 11)), ey = up ? cy - 14 : cy + 15;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx + s * (R + 8), up ? cy - 2 : cy + 4, ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  // Behind-the-head accessories.
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  if (trait === 'antenna') {
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - R + 2); ctx.quadraticCurveTo(cx + 3, cy - R - 6, cx + 1, cy - R - 10); ctx.stroke();
    ctx.fillStyle = acc; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(cx + 1, cy - R - 12.5, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.moveTo(cx - 7, cy - R - 14); ctx.lineTo(cx - 10, cy - R - 16); ctx.moveTo(cx + 9, cy - R - 14); ctx.lineTo(cx + 12, cy - R - 16); ctx.moveTo(cx + 1, cy - R - 19); ctx.lineTo(cx + 1, cy - R - 22); ctx.stroke();
  } else if (trait === 'bun') {
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx, cy - R - 3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy - R - 3, 4.4, 0, Math.PI * 2); ctx.stroke();
  } else if (trait === 'spikes') {
    ctx.fillStyle = ink; ctx.beginPath();
    const base = cy - R + 3;
    ctx.moveTo(cx - 17, base + 4);
    const tips = [[-16, -9], [-8, -15], [0, -10], [9, -16], [17, -8]];
    tips.forEach(([tx, ty], i) => { ctx.lineTo(cx + tx, cy - R + ty - 4); ctx.lineTo(cx + tx + (i === 4 ? 4 : 5), base - 1); });
    ctx.lineTo(cx + 17, base + 4); ctx.closePath(); ctx.fill();
  }

  // Hard shadow, then the head: flat fill, ink outline, a pen wobble.
  ctx.fillStyle = P.inkIsLight ? 'rgba(255,255,255,0.4)' : ink;
  ctx.beginPath(); ctx.arc(cx, cy + 3, R + 1.2, 0, Math.PI * 2); ctx.fill();
  _wobbleCircle(ctx, cx + jx, cy + jy, R, seed, 0.014);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 3.2; ctx.strokeStyle = ink; ctx.stroke();

  // Face.
  const dx = frame === 'lookL' ? -3.4 : frame === 'lookR' ? 3.4 : 0;
  const ex = 7.4, ey = cy - 3.5, mx = cx + dx * 0.7, my = cy + 9;
  const eyeY = ey + (frame === 'peek' ? -0.5 : 0);
  const dot = (x, y, r = 2.9) => { ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const line = (x1, y1, x2, y2, w = 2.2) => { ctx.strokeStyle = fg; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const arc = (x1, y1, qx, qy, x2, y2, w = 2.3) => { ctx.strokeStyle = fg; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(qx, qy, x2, y2); ctx.stroke(); };
  const lx = cx - ex + dx, rx = cx + ex + dx;

  if (trait === 'glasses') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 2.2;
    for (const x of [lx, rx]) { ctx.beginPath(); ctx.arc(x, eyeY, 6.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(lx + 6.4, eyeY); ctx.lineTo(rx - 6.4, eyeY); ctx.stroke();
  }
  const eyeInk = trait === 'glasses' ? '#0a0a0a' : fg;
  const eyeDot = (x, y, r = 2.9) => { ctx.fillStyle = eyeInk; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

  switch (frame) {
    case 'blink':
      for (const x of [lx, rx]) { ctx.strokeStyle = eyeInk; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - 3.4, eyeY + 0.6); ctx.quadraticCurveTo(x, eyeY + 2.6, x + 3.4, eyeY + 0.6); ctx.stroke(); }
      arc(mx - 5, my - 1, mx, my + 4.5, mx + 5, my - 1);
      break;
    case 'peek':
      for (const x of [lx, rx]) {
        if (trait !== 'glasses') { ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, eyeY, 4.6, 0, Math.PI * 2); ctx.stroke(); }
        eyeDot(x + 0.8, eyeY - 0.4, trait === 'glasses' ? 2.6 : 2);
      }
      line(lx - 4, eyeY - 8, lx + 3, eyeY - 9.5, 2); line(rx - 3, eyeY - 9.5, rx + 4, eyeY - 8, 2);
      ctx.strokeStyle = fg; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(mx, my + 1, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'squeeze':
      for (const [x, s] of [[lx, 1], [rx, -1]]) { ctx.strokeStyle = eyeInk; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x - 3.6 * s, eyeY - 3.4); ctx.lineTo(x + 3.2 * s, eyeY); ctx.lineTo(x - 3.6 * s, eyeY + 3.4); ctx.stroke(); }
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(mx - 8, my - 2.5); ctx.quadraticCurveTo(mx, my + 12, mx + 8, my - 2.5); ctx.closePath(); ctx.fill();
      break;
    case 'hit':
      for (const x of [lx, rx]) {
        if (trait !== 'glasses') { ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, eyeY, 5, 0, Math.PI * 2); ctx.stroke(); }
        eyeDot(x, eyeY, 1.7);
      }
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(mx, my + 2, 4.2, 5.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2.6;
      for (const [a, b, c, d] of [[-30, -9, -24, -4], [30, -9, 24, -4], [-32, 5, -26, 5], [32, 5, 26, 5]]) { ctx.beginPath(); ctx.moveTo(cx + a, cy + b); ctx.lineTo(cx + c, cy + d); ctx.stroke(); }
      break;
    case 'cheer0': case 'cheer1':
      for (const x of [lx, rx]) { ctx.strokeStyle = eyeInk; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x - 3.6, eyeY + 1.6); ctx.quadraticCurveTo(x, eyeY - 4, x + 3.6, eyeY + 1.6); ctx.stroke(); }
      // Each crew member cheers in their own way, so the dance still tells them apart.
      ctx.fillStyle = fg;
      if (trait === 'antenna') { ctx.beginPath(); ctx.ellipse(mx, my + 2, 4.2, 5.8, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (trait === 'glasses') { ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - 7, my - 1); ctx.quadraticCurveTo(mx, my + 8, mx + 7, my - 1); ctx.stroke(); }
      else if (trait === 'bun') { ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - 8, my - 2); ctx.quadraticCurveTo(mx, my + 11, mx + 8, my - 2); ctx.stroke(); ctx.fillStyle = acc; ctx.globalAlpha = 0.7; for (const x of [cx - 14, cx + 14]) { ctx.beginPath(); ctx.arc(x, my - 3, 3, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
      else if (trait === 'cap') { ctx.beginPath(); ctx.moveTo(mx - 7, my - 3); ctx.quadraticCurveTo(mx + 2, my + 14, mx + 10, my - 4); ctx.closePath(); ctx.fill(); }
      else if (trait === 'spikes') { ctx.beginPath(); ctx.moveTo(mx - 10, my - 3.5); ctx.quadraticCurveTo(mx, my + 16, mx + 10, my - 3.5); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(mx - 8.5, my - 3); ctx.quadraticCurveTo(mx, my + 13, mx + 8.5, my - 3); ctx.closePath(); ctx.fill(); }
      break;
    case 'worry':
      for (const x of [lx, rx]) eyeDot(x, eyeY + 0.6, 2.3);
      line(lx - 4, eyeY - 6, lx + 3, eyeY - 8.5, 2); line(rx + 4, eyeY - 6, rx - 3, eyeY - 8.5, 2);
      ctx.strokeStyle = fg; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(mx - 6, my + 3); ctx.quadraticCurveTo(mx - 3, my - 1, mx, my + 3); ctx.quadraticCurveTo(mx + 3, my + 7, mx + 6, my + 3); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx + R - 3, cy - R + 8); ctx.quadraticCurveTo(cx + R + 5, cy - R + 18, cx + R - 3, cy - R + 20); ctx.quadraticCurveTo(cx + R - 10, cy - R + 18, cx + R - 3, cy - R + 8); ctx.fill(); ctx.stroke();
      break;
    default: { // idle0, idle1, lookL, lookR: dot eyes, and the crew member's own habit
      eyeDot(lx, eyeY); eyeDot(rx, eyeY);
      if (trait === 'headband') { // determined: a firm grin and low brows
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(mx - 6, my - 2); ctx.quadraticCurveTo(mx, my + 8, mx + 6, my - 2); ctx.closePath(); ctx.fill();
        line(lx - 4, eyeY - 6.4, lx + 3.4, eyeY - 6.9, 2.2); line(rx + 4, eyeY - 6.4, rx - 3.4, eyeY - 6.9, 2.2);
      } else if (trait === 'glasses') { // smug: a one-sided smirk
        arc(mx - 4, my, mx + 1, my + 3, mx + 6, my - 3.4);
      } else if (trait === 'spikes') { // cocky: wide open smile
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(mx - 7, my - 2.6); ctx.quadraticCurveTo(mx, my + 10, mx + 7, my - 2.6); ctx.closePath(); ctx.fill();
        line(rx - 3, eyeY - 7, rx + 4, eyeY - 8.8, 2);
      } else if (trait === 'antenna') { // curious: a small round mouth
        ctx.strokeStyle = fg; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(mx, my + 1, 2.4, 2.8, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (trait === 'bun') { // sweet: a smile and two flat cheeks
        arc(mx - 5, my - 1, mx, my + 5, mx + 5, my - 1);
        ctx.fillStyle = acc; ctx.globalAlpha = 0.7;
        for (const x of [cx - 14, cx + 14]) { ctx.beginPath(); ctx.arc(x + dx * 0.5, my - 3, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else { // cap: a lopsided smile and one raised brow
        arc(mx - 5, my - 1, mx, my + 4, mx + 5, my - 2.6);
        line(rx - 3, eyeY - 7, rx + 3.6, eyeY - 8.6, 2);
      }
    }
  }

  // Front accessories.
  if (trait === 'headband') {
    const by = cy - R + 7;
    ctx.strokeStyle = ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx - R + 1.5, by + 1); ctx.quadraticCurveTo(cx, by - 5, cx + R - 1.5, by + 1); ctx.stroke();
    ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.stroke();
    for (const [qx, qy, tx, ty] of [[-R - 5, by - 4, -R - 10, by + 4], [-R - 4, by + 2, -R - 8, by + 12]]) {
      ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - R + 2, by + 1); ctx.quadraticCurveTo(cx + qx, qy, cx + tx, ty); ctx.stroke();
      ctx.strokeStyle = acc; ctx.lineWidth = 2.6; ctx.stroke();
    }
  } else if (trait === 'cap') {
    ctx.fillStyle = acc; ctx.strokeStyle = ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - R + 1, cy - 9); ctx.quadraticCurveTo(cx - R + 1, cy - R - 9, cx + 2, cy - R - 8); ctx.quadraticCurveTo(cx + R - 1, cy - R - 8, cx + R - 1, cy - 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R - 6, cy - 10); ctx.quadraticCurveTo(cx + R + 8, cy - 13, cx + R + 11, cy - 7); ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx + 1, cy - R - 3, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  if (cb) {
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx + R - 4, cy + R - 3, 8.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.bg; ctx.strokeStyle = P.bg; ctx.lineCap = 'round';
    _CB_GLYPHS[crew](ctx, cx + R - 4, cy + R - 3, 4.6);
  }
}

/** The ink splat for pop frame f (0..5) in a POP_CELL cell: a spiky burst that opens, hollows, then breaks into drops. */
function drawSplat(ctx, hex, f) {
  const cx = POP_CELL / 2, cy = POP_CELL / 2, ink = P.ink;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const burst = (spikes, rOut, rIn, seed) => {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + seed;
      const r = (i % 2 ? rIn : rOut) * (0.88 + 0.24 * _hrnd(i * 3.7 + seed * 9));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  ctx.fillStyle = hex; ctx.strokeStyle = ink; ctx.lineWidth = 3;
  if (f <= 2) {
    const sizes = [[9, 21, 12], [10, 35, 18], [11, 45, 26]][f];
    burst(sizes[0], sizes[1], sizes[2], f * 0.3); ctx.fill(); ctx.stroke();
    if (f === 2) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke();
    }
    return;
  }
  const [rad, br, n] = [[36, 5.6, 8], [42, 4.2, 8], [45, 2.4, 9]][f - 3];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2 * (f - 3) + (i % 2 ? 0.1 : 0);
    const rr = rad * (0.9 + 0.12 * _hrnd(i + f * 5));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    ctx.beginPath(); ctx.arc(x, y, br * (0.8 + 0.4 * _hrnd(i * 2 + f)), 0, Math.PI * 2); ctx.fill(); if (f < 5) { ctx.lineWidth = 2.2; ctx.stroke(); }
    if (f === 3) { ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a + 0.2) * (rad - 12), cy + Math.sin(a + 0.2) * (rad - 12)); ctx.lineTo(cx + Math.cos(a + 0.2) * (rad - 5), cy + Math.sin(a + 0.2) * (rad - 5)); ctx.stroke(); }
  }
}

function _star(ctx, cx, cy, rOut, rIn, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? rIn : rOut; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke();
}

/** Build (or rebuild in place) the head atlas. `cb` draws the colourblind shape badge on every head. */
function buildHeadAtlas(scene, cb) {
  const cols = HEAD_FRAMES.length, rows = CREW.length;
  const w = Math.round(cols * HEAD_CELL * Z), h = Math.round(rows * HEAD_CELL * Z);
  let tex = scene.textures.exists('heads') ? scene.textures.get('heads') : null;
  const fresh = !tex;
  if (fresh) tex = scene.textures.createCanvas('heads', w, h);
  const ctx = tex.getContext();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.save();
      ctx.scale(Z, Z); ctx.translate(c * HEAD_CELL, r * HEAD_CELL);
      drawHead(ctx, r, HEAD_FRAMES[c], cb);
      ctx.restore();
      if (fresh) tex.add(`${r}_${HEAD_FRAMES[c]}`, 0, Math.round(c * HEAD_CELL * Z), Math.round(r * HEAD_CELL * Z), Math.round(HEAD_CELL * Z), Math.round(HEAD_CELL * Z));
    }
  }
  tex.refresh();
}

/** The pop frame atlas: six splat frames and a drop per crew colour, then shared stars and a dust puff. */
function buildPopAtlas(scene) {
  if (scene.textures.exists('popfx')) return;
  const cols = POP_SPLAT_FRAMES + 1, rows = CREW.length + 1;
  const tex = scene.textures.createCanvas('popfx', Math.round(cols * POP_CELL * Z), Math.round(rows * POP_CELL * Z));
  const ctx = tex.getContext();
  const at = (c, r, name, fn) => {
    ctx.save(); ctx.scale(Z, Z); ctx.translate(c * POP_CELL, r * POP_CELL); fn(); ctx.restore();
    tex.add(name, 0, Math.round(c * POP_CELL * Z), Math.round(r * POP_CELL * Z), Math.round(POP_CELL * Z), Math.round(POP_CELL * Z));
  };
  for (let r = 0; r < CREW.length; r++) {
    const hex = P.bubbles[r];
    for (let f = 0; f < POP_SPLAT_FRAMES; f++) at(f, r, `${r}_s${f}`, () => drawSplat(ctx, hex, f));
    at(POP_SPLAT_FRAMES, r, `${r}_drop`, () => { ctx.fillStyle = hex; ctx.strokeStyle = P.ink; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(POP_CELL / 2, POP_CELL / 2, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  }
  const sr = CREW.length;
  at(0, sr, 'star_hot', () => _star(ctx, POP_CELL / 2, POP_CELL / 2, 28, 12, P.hot));
  at(1, sr, 'star_white', () => _star(ctx, POP_CELL / 2, POP_CELL / 2, 28, 12, '#ffffff'));
  at(2, sr, 'star_ink', () => _star(ctx, POP_CELL / 2, POP_CELL / 2, 28, 12, P.ink));
  at(3, sr, 'puff', () => {
    ctx.fillStyle = P.card; ctx.strokeStyle = P.ink; ctx.lineWidth = 3.2;
    for (const [x, y, r] of [[34, 52, 16], [62, 52, 16], [48, 40, 20]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(48, 40, 17.5, 0, Math.PI * 2); ctx.arc(34, 52, 13.5, 0, Math.PI * 2); ctx.arc(62, 52, 13.5, 0, Math.PI * 2); ctx.fill();
  });
  at(4, sr, 'bolt', () => {
    ctx.fillStyle = P.hot; ctx.strokeStyle = P.ink; ctx.lineWidth = 3.2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(54, 14); ctx.lineTo(30, 52); ctx.lineTo(46, 52); ctx.lineTo(38, 82); ctx.lineTo(66, 40); ctx.lineTo(50, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  tex.refresh();
}

/** Hit shape for a head image: a circle the size of one board cell, centred on the head, in frame pixels. */
function headHitArea(cell) {
  return new Phaser.Geom.Circle(HEAD_CX * Z, HEAD_CY * Z, (cell / 2) * Z);
}

/** A head as a Phaser image, origin on the head's centre so scale and rotation pivot there. */
function addHead(scene, x, y, crew, frame) {
  return scene.add.image(x, y, 'heads', `${crew}_${frame || 'idle0'}`).setOrigin(0.5, HEAD_CY / HEAD_CELL);
}

/**
 * Pooled one-shot effects drawn from the pop atlas: splat frames, drops, doodle stars, dust, falling mini heads.
 * One update loop moves all of them, so a big chain costs a few dozen image draws and zero allocations.
 */
class PopFx {
  constructor(scene) {
    this.scene = scene; this.live = []; this.free = []; this.cap = 260;
  }

  _take(tex, frame) {
    let img = this.free.pop();
    if (!img) {
      if (this.live.length >= this.cap) return null;
      img = this.scene.add.image(0, 0, tex, frame);
    }
    img.setTexture(tex, frame).setVisible(true).setActive(true).setAlpha(1).setTint(0xffffff).clearTint().setAngle(0).setScale(BS).setOrigin(0.5, 0.5).setBlendMode(Phaser.BlendModes.NORMAL);
    return img;
  }

  /** Spawn one effect. o: tex, frame | frames[], fps, x, y, vx, vy, g, rot, vr, s0, s1, a1, dur, depth, drag, headOrigin */
  spawn(o) {
    const frames = o.frames || null;
    const img = this._take(o.tex || 'popfx', frames ? frames[0] : o.frame);
    if (!img) return null;
    if (o.headOrigin) img.setOrigin(0.5, HEAD_CY / HEAD_CELL);
    img.setPosition(o.x, o.y).setDepth(o.depth == null ? 10 : o.depth).setAngle(o.rot || 0);
    this.live.push({ img, tex: o.tex || 'popfx', frames, fps: o.fps || 18, t: 0, dur: o.dur || 400, x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, drag: o.drag || 0, rot: o.rot || 0, vr: o.vr || 0, s0: o.s0 == null ? 1 : o.s0, s1: o.s1 == null ? 1 : o.s1, a0: o.a0 == null ? 1 : o.a0, a1: o.a1 == null ? 0 : o.a1, fadeAt: o.fadeAt == null ? 0.5 : o.fadeAt, fi: 0 });
    return img;
  }

  /** The ink splat: six drawn frames, quick, scaled by how big the moment is. */
  splat(x, y, crew, size) {
    this.spawn({ frames: [0, 1, 2, 3, 4, 5].map((i) => `${crew}_s${i}`), fps: 17 + size * 3, dur: 6 * (1000 / (17 + size * 3)), x, y, s0: 0.62 * size, s1: 0.86 * size, rot: Math.random() * 360, a1: 1, depth: 10 });
  }

  drops(x, y, crew, n, speed, scale) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = speed * (0.5 + Math.random() * 0.7);
      this.spawn({ frame: `${crew}_drop`, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 520, s0: (0.32 + Math.random() * 0.2) * scale, s1: 0.06, a1: 1, dur: 460 + Math.random() * 220, depth: 11 });
    }
  }

  stars(x, y, n, speed, scale, kind) {
    const kinds = kind ? [kind] : ['star_hot', 'star_white', 'star_ink'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = speed * (0.55 + Math.random() * 0.7);
      this.spawn({ frame: kinds[i % kinds.length], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 380, rot: Math.random() * 90, vr: (Math.random() - 0.5) * 520, s0: (0.26 + Math.random() * 0.2) * scale, s1: 0.1 * scale, dur: 620 + Math.random() * 340, depth: 12, fadeAt: 0.6 });
    }
  }

  puff(x, y, size) {
    for (const s of [-1, 1]) this.spawn({ frame: 'puff', x: x + s * 12, y: y + 4, vx: s * 46, vy: -10, drag: 3, s0: 0.2 * size, s1: 0.46 * size, dur: 340, depth: 9, fadeAt: 0.3 });
  }

  /** Mini cheering heads falling like confetti: the payoff for fever, a chain, a high score. */
  headRain(n, x0, x1, y0, y1, depth) {
    for (let i = 0; i < n; i++) {
      const crew = (Math.random() * CREW.length) | 0;
      this.spawn({ tex: 'heads', frame: `${crew}_${Math.random() < 0.5 ? 'cheer0' : 'cheer1'}`, headOrigin: true, x: x0 + Math.random() * (x1 - x0), y: y0 - Math.random() * 220, vx: (Math.random() - 0.5) * 80, vy: 40 + Math.random() * 120, g: 260, rot: Math.random() * 40 - 20, vr: (Math.random() - 0.5) * 260, s0: 0.55 + Math.random() * 0.35, s1: 0.55, dur: 1500 + Math.random() * 900, depth: depth || 52, fadeAt: 0.7, a1: 0, });
    }
  }

  update(dtMs) {
    const scale = this.scene.tweens ? this.scene.tweens.timeScale : 1;
    const dt = Math.min(dtMs, 50) * scale;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) { f.img.setVisible(false).setActive(false); this.free.push(f.img); this.live.splice(i, 1); continue; }
      const s = dt / 1000;
      f.vy += f.g * s;
      if (f.drag) { const d = Math.max(0, 1 - f.drag * s); f.vx *= d; f.vy *= d; }
      f.x += f.vx * s; f.y += f.vy * s; f.rot += f.vr * s;
      const sc = f.s0 + (f.s1 - f.s0) * k;
      f.img.setPosition(f.x, f.y).setAngle(f.rot).setScale(sc * BS);
      f.img.setAlpha(k < f.fadeAt ? f.a0 : f.a0 + (f.a1 - f.a0) * ((k - f.fadeAt) / (1 - f.fadeAt)));
      if (f.frames) {
        const fi = seqFrame(f.t, 1000 / f.fps, f.frames.length);
        const idx = fi < 0 ? f.frames.length - 1 : fi;
        if (idx !== f.fi) { f.fi = idx; f.img.setFrame(f.frames[idx]); }
      }
    }
  }

  clear() {
    this.live.forEach((f) => { f.img.setVisible(false).setActive(false); this.free.push(f.img); });
    this.live.length = 0;
  }
}

/** Per-head idle life: a blink every few seconds, a glance now and then, and the pen "boil" between two idle frames. */
function newLife(seed) {
  return { seed, nextBlink: 800 + _hrnd(seed) * 3000, blinkEnd: 0, nextGlance: 1500 + _hrnd(seed + 9) * 4000, glanceEnd: 0, glanceDir: 0 };
}

/**
 * Which atlas frame a head shows right now. `mood` (squeeze, hit, cheer0, worry, peek, ...) wins over everything;
 * `look` (-1 or +1) makes the head glance at something; otherwise it idles, blinks and glances on its own.
 */
function lifeFrame(life, t, mood, look, reduce) {
  if (mood && mood !== 'idle') return mood;
  if (look) return look < 0 ? 'lookL' : 'lookR';
  if (reduce) return 'idle0';
  if (t >= life.nextBlink) { life.blinkEnd = t + 120; life.nextBlink = t + 2200 + _hrnd(t * 0.013 + life.seed) * 3600; }
  if (t < life.blinkEnd) return 'blink';
  if (t >= life.nextGlance) { life.glanceEnd = t + 650; life.glanceDir = _hrnd(t * 0.007 + life.seed) < 0.5 ? -1 : 1; life.nextGlance = t + 2600 + _hrnd(t * 0.011 + life.seed * 3) * 5000; }
  if (t < life.glanceEnd) return life.glanceDir < 0 ? 'lookL' : 'lookR';
  return Math.floor(t / 230 + life.seed * 3.3) % 2 ? 'idle1' : 'idle0';
}
