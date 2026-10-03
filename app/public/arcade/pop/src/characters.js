// Passion Pop — Procedural Character Drawing System
// Characters appear in the hype bar during streak combos
// Drawn via Phaser 3 Graphics API — anime/hip-hop/urban style

// =============================================================
// SHARED DRAWING HELPERS — extracted from per-character duplication
// =============================================================

/**
 * Draw one stylized anime eye with sclera, iris, pupil, and highlight.
 * Replaces ~10 lines of duplicated drawing code per eye across 4 characters.
 * @param {Phaser.GameObjects.Graphics} g — graphics context
 * @param {number} cx — eye center X
 * @param {number} cy — eye center Y
 * @param {number} s  — global scale factor
 * @param {object} opts — per-character variation
 * @param {number} opts.irisColor   — hex color for iris (e.g. 0xff4400)
 * @param {number} [opts.w=8]       — sclera ellipse width (before scale)
 * @param {number} [opts.h=5]       — sclera ellipse height (before scale)
 * @param {number} [opts.irisR=2.5] — iris radius
 * @param {number} [opts.pupilR=1.2]— pupil radius
 * @param {number} [opts.hlR=0.8]   — highlight radius
 * @param {number} [opts.hlColor=0xffffff] — highlight color
 * @param {number} [opts.hlAlpha=0.9]      — highlight alpha
 * @param {number} [opts.irisOff=0] — horizontal offset of iris from center
 * @param {{color:number, alpha:number, r:number, dx:number, dy:number}} [opts.extra]
 *        — optional second highlight (Empress uses a purple sub-glow)
 */
function drawEye(g, cx, cy, s, opts) {
  const {
    irisColor, w = 8, h = 5, irisR = 2.5, pupilR = 1.2,
    hlR = 0.8, hlColor = 0xffffff, hlAlpha = 0.9,
    irisOff = 0, extra = null,
  } = opts;

  // Sclera
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(cx, cy, w * s, h * s);
  // Iris
  g.fillStyle(irisColor, 1);
  g.fillCircle(cx + irisOff * s, cy, irisR * s);
  // Pupil
  g.fillStyle(0x000000, 1);
  g.fillCircle(cx + irisOff * s, cy, pupilR * s);
  // Primary highlight
  g.fillStyle(hlColor, hlAlpha);
  g.fillCircle(cx + (irisOff + 1) * s, cy - 1 * s, hlR * s);
  // Optional secondary highlight (e.g. Empress purple sub-glow)
  if (extra) {
    g.fillStyle(extra.color, extra.alpha);
    g.fillCircle(cx + (extra.dx || 0) * s, cy + (extra.dy || 0) * s, (extra.r || 0.6) * s);
  }
}

/**
 * Draw a ground shadow ellipse beneath a character.
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} x — center X
 * @param {number} y — baseline Y position
 * @param {number} s — scale
 * @param {number} [w=36] — ellipse width
 * @param {number} [alpha=0.15] — shadow opacity
 */
function drawShadow(g, x, y, s, w = 36, alpha = 0.15) {
  g.fillStyle(0x000000, alpha);
  g.fillEllipse(x, y + 78 * s, w * s, 8 * s);
}

window.characters = {

  // ─────────────────────────────────────────────
  // KIRA — The Chill One (3-streak)
  // Hoodie, headphones, relaxed smirk
  // Color scheme: greens and teals
  // ─────────────────────────────────────────────
  kira: {
    name: 'Kira',
    title: 'The Chill One',
    streakRequired: 3,
    draw: function (graphics, x, y, scale) {
      graphics.clear();
      const s = scale;

      // Shadow under character
      drawShadow(graphics, x, y, s);

      // --- HOODIE BODY ---
      // Main hoodie shape
      graphics.fillStyle(0x1a6b5a, 1); // deep teal
      graphics.fillRoundedRect(x - 22 * s, y + 28 * s, 44 * s, 42 * s, 6 * s);
      // Hoodie shadow fold left
      graphics.fillStyle(0x145c4c, 1);
      graphics.fillTriangle(
        x - 10 * s, y + 28 * s,
        x - 18 * s, y + 45 * s,
        x - 2 * s, y + 45 * s
      );
      // Hoodie shadow fold right
      graphics.fillTriangle(
        x + 10 * s, y + 28 * s,
        x + 18 * s, y + 45 * s,
        x + 2 * s, y + 45 * s
      );
      // Hood behind head
      graphics.fillStyle(0x1a6b5a, 1);
      graphics.fillRoundedRect(x - 18 * s, y + 4 * s, 36 * s, 20 * s, 10 * s);
      // Hoodie pocket line
      graphics.lineStyle(1.5 * s, 0x145c4c, 0.7);
      graphics.lineBetween(x - 12 * s, y + 52 * s, x + 12 * s, y + 52 * s);
      // Hoodie center line
      graphics.lineStyle(1 * s, 0x145c4c, 0.5);
      graphics.lineBetween(x, y + 30 * s, x, y + 68 * s);
      // Hoodie string left
      graphics.lineStyle(1.5 * s, 0x2dd4a8, 0.8);
      graphics.lineBetween(x - 4 * s, y + 28 * s, x - 6 * s, y + 40 * s);
      // Hoodie string right
      graphics.lineBetween(x + 4 * s, y + 28 * s, x + 6 * s, y + 40 * s);

      // Arms (relaxed, slightly out)
      graphics.fillStyle(0x1a6b5a, 1);
      graphics.fillRoundedRect(x - 30 * s, y + 32 * s, 12 * s, 28 * s, 4 * s);
      graphics.fillRoundedRect(x + 18 * s, y + 32 * s, 12 * s, 28 * s, 4 * s);
      // Hands (skin)
      graphics.fillStyle(0xc68642, 1);
      graphics.fillCircle(x - 24 * s, y + 62 * s, 5 * s);
      graphics.fillCircle(x + 24 * s, y + 62 * s, 5 * s);

      // Legs
      graphics.fillStyle(0x2a2a3a, 1); // dark pants
      graphics.fillRoundedRect(x - 14 * s, y + 64 * s, 12 * s, 16 * s, 3 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 64 * s, 12 * s, 16 * s, 3 * s);
      // Shoes
      graphics.fillStyle(0xf0f0f0, 1);
      graphics.fillRoundedRect(x - 16 * s, y + 76 * s, 14 * s, 5 * s, 2 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 76 * s, 14 * s, 5 * s, 2 * s);
      // Shoe accent
      graphics.fillStyle(0x2dd4a8, 1);
      graphics.fillRect(x - 15 * s, y + 77 * s, 8 * s, 1.5 * s);
      graphics.fillRect(x + 3 * s, y + 77 * s, 8 * s, 1.5 * s);

      // --- HEAD ---
      // Neck
      graphics.fillStyle(0xc68642, 1);
      graphics.fillRect(x - 4 * s, y + 20 * s, 8 * s, 10 * s);

      // Head circle
      graphics.fillStyle(0xd4955a, 1);
      graphics.fillCircle(x, y + 12 * s, 14 * s);

      // Hair — messy short locs/twists
      graphics.fillStyle(0x1a1a2e, 1);
      graphics.fillCircle(x, y + 5 * s, 14 * s);
      graphics.fillCircle(x - 8 * s, y + 3 * s, 6 * s);
      graphics.fillCircle(x + 8 * s, y + 3 * s, 6 * s);
      graphics.fillCircle(x - 4 * s, y, 5 * s);
      graphics.fillCircle(x + 4 * s, y, 5 * s);
      graphics.fillCircle(x, y - 2 * s, 5 * s);

      // --- FACE ---
      // Eyes (almond shaped — Kira has dark iris, no visible pupil ring)
      const kiraEye = { irisColor: 0x1a1a2e, w: 7, h: 4.5, irisR: 2.2, pupilR: 0, hlR: 0.8 };
      drawEye(graphics, x - 5 * s, y + 11 * s, s, { ...kiraEye, irisOff: 1 });
      drawEye(graphics, x + 5 * s, y + 11 * s, s, { ...kiraEye, irisOff: -1 });
      // Eyebrows (relaxed)
      graphics.lineStyle(2 * s, 0x1a1a2e, 0.8);
      graphics.lineBetween(x - 8 * s, y + 7.5 * s, x - 2 * s, y + 8 * s);
      graphics.lineBetween(x + 2 * s, y + 8 * s, x + 8 * s, y + 7.5 * s);

      // Smirk (slight curve, one side up)
      graphics.lineStyle(1.5 * s, 0x8b4513, 0.9);
      graphics.beginPath();
      graphics.arc(x + 2 * s, y + 16 * s, 4 * s, 0.2, Math.PI - 0.5, false);
      graphics.strokePath();

      // Nose
      graphics.lineStyle(1 * s, 0xb07840, 0.5);
      graphics.lineBetween(x, y + 12 * s, x - 1 * s, y + 14 * s);

      // --- HEADPHONES around neck ---
      graphics.lineStyle(3 * s, 0x333344, 1);
      graphics.beginPath();
      graphics.arc(x, y + 24 * s, 14 * s, Math.PI + 0.3, -0.3, false);
      graphics.strokePath();
      // Ear cups
      graphics.fillStyle(0x2dd4a8, 1);
      graphics.fillCircle(x - 14 * s, y + 24 * s, 4 * s);
      graphics.fillCircle(x + 14 * s, y + 24 * s, 4 * s);
      // Cup highlight
      graphics.fillStyle(0x5dfcd2, 0.5);
      graphics.fillCircle(x - 15 * s, y + 23 * s, 1.5 * s);
      graphics.fillCircle(x + 13 * s, y + 23 * s, 1.5 * s);
      // Headphone band detail
      graphics.fillStyle(0x444455, 1);
      graphics.fillRoundedRect(x - 15.5 * s, y + 22 * s, 3 * s, 5 * s, 1 * s);
      graphics.fillRoundedRect(x + 12.5 * s, y + 22 * s, 3 * s, 5 * s, 1 * s);
    }
  },

  // ─────────────────────────────────────────────
  // BLAZE — The Hype Beast (5-streak)
  // Spiked anime hair, fierce, chain pendant, flames
  // Color scheme: golds and oranges
  // ─────────────────────────────────────────────
  blaze: {
    name: 'Blaze',
    title: 'The Hype Beast',
    streakRequired: 5,
    draw: function (graphics, x, y, scale) {
      graphics.clear();
      const s = scale;

      // --- FLAME AURA (behind character) ---
      const flameColors = [0xff6600, 0xff9900, 0xffcc00, 0xff4400];
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.sin(Date.now() / 300) * 0.3;
        const dist = (28 + Math.sin(i * 1.7) * 8) * s;
        const fx = x + Math.cos(angle) * dist;
        const fy = y + 35 * s + Math.sin(angle) * dist * 0.6;
        const color = flameColors[i % flameColors.length];
        graphics.fillStyle(color, 0.35);
        // Each flame is a triangle pointing outward
        graphics.fillTriangle(
          fx, fy - 10 * s,
          fx - 4 * s, fy + 4 * s,
          fx + 4 * s, fy + 4 * s
        );
      }
      // Core glow
      graphics.fillStyle(0xff6600, 0.08);
      graphics.fillCircle(x, y + 35 * s, 40 * s);

      // Shadow
      drawShadow(graphics, x, y, s);

      // --- JACKET BODY ---
      // Main jacket
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillRoundedRect(x - 24 * s, y + 28 * s, 48 * s, 40 * s, 4 * s);
      // Jacket lapels
      graphics.fillStyle(0x2a2a2a, 1);
      graphics.fillTriangle(
        x - 24 * s, y + 28 * s,
        x, y + 50 * s,
        x - 24 * s, y + 50 * s
      );
      graphics.fillTriangle(
        x + 24 * s, y + 28 * s,
        x, y + 50 * s,
        x + 24 * s, y + 50 * s
      );
      // Inner shirt
      graphics.fillStyle(0xff6600, 1);
      graphics.fillTriangle(
        x - 6 * s, y + 30 * s,
        x + 6 * s, y + 30 * s,
        x, y + 48 * s
      );
      // Flame accents on jacket
      graphics.fillStyle(0xff9900, 0.7);
      // Left flame accent
      graphics.fillTriangle(
        x - 22 * s, y + 60 * s,
        x - 18 * s, y + 48 * s,
        x - 14 * s, y + 62 * s
      );
      graphics.fillTriangle(
        x - 16 * s, y + 64 * s,
        x - 12 * s, y + 50 * s,
        x - 8 * s, y + 66 * s
      );
      // Right flame accent
      graphics.fillTriangle(
        x + 22 * s, y + 60 * s,
        x + 18 * s, y + 48 * s,
        x + 14 * s, y + 62 * s
      );
      graphics.fillTriangle(
        x + 16 * s, y + 64 * s,
        x + 12 * s, y + 50 * s,
        x + 8 * s, y + 66 * s
      );

      // Arms
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillRoundedRect(x - 34 * s, y + 30 * s, 14 * s, 30 * s, 4 * s);
      graphics.fillRoundedRect(x + 20 * s, y + 30 * s, 14 * s, 30 * s, 4 * s);
      // Fists (clenched, hype pose)
      graphics.fillStyle(0xc68642, 1);
      graphics.fillCircle(x - 27 * s, y + 32 * s, 5 * s); // left fist up
      graphics.fillCircle(x + 27 * s, y + 32 * s, 5 * s); // right fist up

      // Legs
      graphics.fillStyle(0x2a2a3a, 1);
      graphics.fillRoundedRect(x - 14 * s, y + 64 * s, 12 * s, 14 * s, 3 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 64 * s, 12 * s, 14 * s, 3 * s);
      // Shoes (high tops)
      graphics.fillStyle(0xff4400, 1);
      graphics.fillRoundedRect(x - 16 * s, y + 74 * s, 14 * s, 6 * s, 2 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 74 * s, 14 * s, 6 * s, 2 * s);
      // Shoe soles
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(x - 16 * s, y + 78 * s, 14 * s, 2 * s);
      graphics.fillRect(x + 2 * s, y + 78 * s, 14 * s, 2 * s);

      // --- CHAIN & PENDANT ---
      graphics.lineStyle(2 * s, 0xffd700, 0.9);
      graphics.beginPath();
      graphics.arc(x, y + 30 * s, 10 * s, 0.3, Math.PI - 0.3, false);
      graphics.strokePath();
      // Pendant (diamond shape)
      graphics.fillStyle(0xffd700, 1);
      graphics.fillTriangle(
        x, y + 38 * s,
        x - 3 * s, y + 42 * s,
        x + 3 * s, y + 42 * s
      );
      graphics.fillTriangle(
        x, y + 47 * s,
        x - 3 * s, y + 42 * s,
        x + 3 * s, y + 42 * s
      );
      // Pendant highlight
      graphics.fillStyle(0xffee88, 0.7);
      graphics.fillTriangle(
        x, y + 39 * s,
        x - 1 * s, y + 42 * s,
        x + 1.5 * s, y + 41 * s
      );

      // --- HEAD ---
      // Neck
      graphics.fillStyle(0xc68642, 1);
      graphics.fillRect(x - 5 * s, y + 20 * s, 10 * s, 10 * s);

      // Head
      graphics.fillStyle(0xd4955a, 1);
      graphics.fillCircle(x, y + 13 * s, 14 * s);

      // --- SPIKED ANIME HAIR ---
      graphics.fillStyle(0xff6600, 1);
      // Central spike
      graphics.fillTriangle(
        x, y - 14 * s,
        x - 5 * s, y + 6 * s,
        x + 5 * s, y + 6 * s
      );
      // Left spikes
      graphics.fillTriangle(
        x - 10 * s, y - 8 * s,
        x - 14 * s, y + 6 * s,
        x - 3 * s, y + 4 * s
      );
      graphics.fillTriangle(
        x - 16 * s, y - 2 * s,
        x - 18 * s, y + 10 * s,
        x - 10 * s, y + 6 * s
      );
      // Right spikes
      graphics.fillTriangle(
        x + 10 * s, y - 8 * s,
        x + 3 * s, y + 4 * s,
        x + 14 * s, y + 6 * s
      );
      graphics.fillTriangle(
        x + 16 * s, y - 2 * s,
        x + 10 * s, y + 6 * s,
        x + 18 * s, y + 10 * s
      );
      // Hair highlight streaks
      graphics.fillStyle(0xffcc00, 0.6);
      graphics.fillTriangle(
        x + 1 * s, y - 10 * s,
        x - 2 * s, y + 2 * s,
        x + 3 * s, y + 2 * s
      );
      graphics.fillTriangle(
        x + 11 * s, y - 4 * s,
        x + 6 * s, y + 4 * s,
        x + 13 * s, y + 5 * s
      );

      // --- FACE ---
      // Fierce eyes (angular, orange iris)
      const blazeEye = { irisColor: 0xff4400 };
      drawEye(graphics, x - 5 * s, y + 11 * s, s, { ...blazeEye, irisOff: 1 });
      drawEye(graphics, x + 5 * s, y + 11 * s, s, { ...blazeEye, irisOff: 1 });
      // Fierce eyebrows (angled down toward center)
      graphics.lineStyle(2.5 * s, 0x1a1a1a, 1);
      graphics.lineBetween(x - 9 * s, y + 6 * s, x - 2 * s, y + 8.5 * s);
      graphics.lineBetween(x + 2 * s, y + 8.5 * s, x + 9 * s, y + 6 * s);

      // Open mouth yelling
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillEllipse(x, y + 18 * s, 8 * s, 5 * s);
      // Teeth
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(x - 3 * s, y + 16 * s, 6 * s, 1.5 * s);
      // Tongue hint
      graphics.fillStyle(0xcc3333, 1);
      graphics.fillEllipse(x, y + 19 * s, 4 * s, 2 * s);

      // Nose
      graphics.lineStyle(1 * s, 0xb07840, 0.6);
      graphics.lineBetween(x, y + 12 * s, x - 1 * s, y + 14.5 * s);
      graphics.lineBetween(x - 1 * s, y + 14.5 * s, x + 1 * s, y + 14.5 * s);
    }
  },

  // ─────────────────────────────────────────────
  // RONIN — The Silent Killer (8-streak)
  // Masked samurai, katana, long coat
  // Color scheme: reds and blacks
  // ─────────────────────────────────────────────
  ronin: {
    name: 'Ronin',
    title: 'The Silent Killer',
    streakRequired: 8,
    draw: function (graphics, x, y, scale) {
      graphics.clear();
      const s = scale;

      // --- SLASH EFFECTS (behind character) ---
      graphics.lineStyle(2 * s, 0xff2222, 0.5);
      // Diagonal slash 1
      graphics.lineBetween(x - 30 * s, y + 10 * s, x + 20 * s, y + 50 * s);
      // Diagonal slash 2
      graphics.lineBetween(x + 28 * s, y + 5 * s, x - 18 * s, y + 55 * s);
      // Horizontal slash
      graphics.lineStyle(1.5 * s, 0xff4444, 0.3);
      graphics.lineBetween(x - 35 * s, y + 30 * s, x + 35 * s, y + 28 * s);
      // Slash sparkle points
      graphics.fillStyle(0xff6666, 0.6);
      graphics.fillCircle(x - 30 * s, y + 10 * s, 2 * s);
      graphics.fillCircle(x + 28 * s, y + 5 * s, 2 * s);
      graphics.fillCircle(x + 20 * s, y + 50 * s, 1.5 * s);

      // Shadow
      drawShadow(graphics, x, y, s, 40, 0.2);

      // --- KATANA (on back, diagonal) ---
      // Scabbard
      graphics.lineStyle(3 * s, 0x1a1a1a, 1);
      graphics.lineBetween(x + 8 * s, y + 6 * s, x + 26 * s, y + 60 * s);
      // Scabbard highlight
      graphics.lineStyle(1 * s, 0x333333, 0.6);
      graphics.lineBetween(x + 9 * s, y + 8 * s, x + 25 * s, y + 55 * s);
      // Handle (tsuka)
      graphics.lineStyle(3 * s, 0x8b0000, 1);
      graphics.lineBetween(x + 6 * s, y + 0 * s, x + 8 * s, y + 10 * s);
      // Tsuba (guard)
      graphics.fillStyle(0xcc9900, 1);
      graphics.fillCircle(x + 8 * s, y + 10 * s, 3 * s);
      // Handle wrapping detail
      graphics.lineStyle(1 * s, 0x660000, 0.7);
      graphics.lineBetween(x + 5.5 * s, y + 2 * s, x + 7 * s, y + 4 * s);
      graphics.lineBetween(x + 6 * s, y + 4 * s, x + 7.5 * s, y + 6 * s);
      graphics.lineBetween(x + 6.5 * s, y + 6 * s, x + 8 * s, y + 8 * s);

      // --- LONG COAT / CLOAK ---
      // Coat back (wider, flowing)
      graphics.fillStyle(0x0d0d0d, 1);
      graphics.fillTriangle(
        x - 28 * s, y + 70 * s,
        x, y + 24 * s,
        x + 28 * s, y + 70 * s
      );
      // Coat front
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillRoundedRect(x - 20 * s, y + 28 * s, 40 * s, 42 * s, 3 * s);
      // Coat collar (high, dramatic)
      graphics.fillStyle(0x0d0d0d, 1);
      graphics.fillTriangle(
        x - 16 * s, y + 22 * s,
        x - 20 * s, y + 38 * s,
        x - 6 * s, y + 30 * s
      );
      graphics.fillTriangle(
        x + 16 * s, y + 22 * s,
        x + 6 * s, y + 30 * s,
        x + 20 * s, y + 38 * s
      );
      // Red lining visible at coat opening
      graphics.fillStyle(0x8b0000, 1);
      graphics.fillTriangle(
        x - 4 * s, y + 30 * s,
        x + 4 * s, y + 30 * s,
        x, y + 55 * s
      );
      // Belt / sash
      graphics.fillStyle(0x8b0000, 0.9);
      graphics.fillRect(x - 20 * s, y + 50 * s, 40 * s, 4 * s);
      // Belt knot
      graphics.fillCircle(x + 16 * s, y + 52 * s, 3 * s);
      graphics.lineStyle(1.5 * s, 0x660000, 0.8);
      graphics.lineBetween(x + 16 * s, y + 54 * s, x + 14 * s, y + 62 * s);
      graphics.lineBetween(x + 16 * s, y + 54 * s, x + 18 * s, y + 60 * s);

      // Arms (crossed or at sides)
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillRoundedRect(x - 28 * s, y + 30 * s, 12 * s, 28 * s, 3 * s);
      graphics.fillRoundedRect(x + 16 * s, y + 30 * s, 12 * s, 28 * s, 3 * s);
      // Gloved hands
      graphics.fillStyle(0x0d0d0d, 1);
      graphics.fillCircle(x - 22 * s, y + 60 * s, 4 * s);
      graphics.fillCircle(x + 22 * s, y + 60 * s, 4 * s);

      // Legs (dark, barely visible under coat)
      graphics.fillStyle(0x111111, 1);
      graphics.fillRoundedRect(x - 12 * s, y + 66 * s, 10 * s, 12 * s, 2 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 66 * s, 10 * s, 12 * s, 2 * s);
      // Boots
      graphics.fillStyle(0x0d0d0d, 1);
      graphics.fillRoundedRect(x - 14 * s, y + 74 * s, 12 * s, 6 * s, 2 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 74 * s, 12 * s, 6 * s, 2 * s);

      // --- HEAD ---
      // Neck (barely visible)
      graphics.fillStyle(0xc68642, 1);
      graphics.fillRect(x - 4 * s, y + 20 * s, 8 * s, 8 * s);

      // Head
      graphics.fillStyle(0xd4955a, 1);
      graphics.fillCircle(x, y + 13 * s, 13 * s);

      // Hair (slicked back, dark)
      graphics.fillStyle(0x0d0d0d, 1);
      graphics.fillCircle(x, y + 7 * s, 13 * s);
      // Hair points at back
      graphics.fillTriangle(
        x + 10 * s, y + 4 * s,
        x + 18 * s, y + 8 * s,
        x + 12 * s, y + 12 * s
      );
      graphics.fillTriangle(
        x + 8 * s, y + 2 * s,
        x + 14 * s, y + 2 * s,
        x + 12 * s, y + 10 * s
      );

      // --- FACE ---
      // Mask (covers lower face)
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillRoundedRect(x - 12 * s, y + 14 * s, 24 * s, 10 * s, 3 * s);
      // Mask seam
      graphics.lineStyle(1 * s, 0x333333, 0.5);
      graphics.lineBetween(x, y + 14 * s, x, y + 24 * s);
      // Mask texture lines
      graphics.lineStyle(0.5 * s, 0x2a2a2a, 0.4);
      graphics.lineBetween(x - 10 * s, y + 17 * s, x - 4 * s, y + 17 * s);
      graphics.lineBetween(x + 4 * s, y + 17 * s, x + 10 * s, y + 17 * s);
      // Red accent on mask
      graphics.fillStyle(0x8b0000, 1);
      graphics.fillRect(x - 1 * s, y + 18 * s, 2 * s, 4 * s);

      // Eyes (narrow, intense — red iris, smaller highlight)
      const roninEye = { irisColor: 0xcc0000, h: 3.5, irisR: 1.8, pupilR: 0.9, hlR: 0.6, hlColor: 0xff4444, hlAlpha: 0.8 };
      drawEye(graphics, x - 5 * s, y + 11 * s, s, { ...roninEye, irisOff: 1 });
      drawEye(graphics, x + 5 * s, y + 11 * s, s, { ...roninEye, irisOff: 1 });
      // Eyebrows (sharp, severe)
      graphics.lineStyle(2 * s, 0x0d0d0d, 1);
      graphics.lineBetween(x - 10 * s, y + 7 * s, x - 2 * s, y + 9 * s);
      graphics.lineBetween(x + 2 * s, y + 9 * s, x + 10 * s, y + 7 * s);

      // Scar over left eye
      graphics.lineStyle(1 * s, 0xcc6666, 0.6);
      graphics.lineBetween(x - 8 * s, y + 6 * s, x - 3 * s, y + 15 * s);
    }
  },

  // ─────────────────────────────────────────────
  // EMPRESS — The Final Boss (12-streak)
  // Crown, piercing eyes, flowing hair, cape, royal
  // Color scheme: deep purples and golds
  // ─────────────────────────────────────────────
  empress: {
    name: 'Empress',
    title: 'The Empress',
    streakRequired: 12,
    draw: function (graphics, x, y, scale) {
      graphics.clear();
      const s = scale;

      // --- STARBURST AURA (behind everything) ---
      const rayCount = 16;
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const innerR = 30 * s;
        const outerR = (50 + (i % 2) * 12) * s;
        const alpha = 0.12 + (i % 3) * 0.06;
        graphics.lineStyle(2 * s, 0xffd700, alpha);
        graphics.lineBetween(
          x + Math.cos(angle) * innerR,
          y + 35 * s + Math.sin(angle) * innerR * 0.7,
          x + Math.cos(angle) * outerR,
          y + 35 * s + Math.sin(angle) * outerR * 0.7
        );
      }
      // Outer glow
      graphics.fillStyle(0x6a0dad, 0.06);
      graphics.fillCircle(x, y + 35 * s, 50 * s);
      graphics.fillStyle(0xffd700, 0.04);
      graphics.fillCircle(x, y + 35 * s, 42 * s);

      // Shadow
      drawShadow(graphics, x, y, s, 44, 0.2);

      // --- CAPE (behind body, flowing) ---
      graphics.fillStyle(0x3a0066, 1);
      // Left cape flow
      graphics.fillTriangle(
        x - 14 * s, y + 26 * s,
        x - 38 * s, y + 75 * s,
        x - 10 * s, y + 70 * s
      );
      // Right cape flow
      graphics.fillTriangle(
        x + 14 * s, y + 26 * s,
        x + 10 * s, y + 70 * s,
        x + 38 * s, y + 75 * s
      );
      // Cape center drape
      graphics.fillTriangle(
        x - 12 * s, y + 30 * s,
        x + 12 * s, y + 30 * s,
        x, y + 80 * s
      );
      // Cape inner lining (gold)
      graphics.fillStyle(0xcc9900, 0.4);
      graphics.fillTriangle(
        x - 30 * s, y + 72 * s,
        x - 14 * s, y + 34 * s,
        x - 12 * s, y + 68 * s
      );
      graphics.fillTriangle(
        x + 30 * s, y + 72 * s,
        x + 14 * s, y + 34 * s,
        x + 12 * s, y + 68 * s
      );
      // Cape edge detail
      graphics.lineStyle(1.5 * s, 0xffd700, 0.3);
      graphics.lineBetween(x - 38 * s, y + 75 * s, x - 14 * s, y + 26 * s);
      graphics.lineBetween(x + 38 * s, y + 75 * s, x + 14 * s, y + 26 * s);

      // --- BODY / ROYAL OUTFIT ---
      // Main dress/armor top
      graphics.fillStyle(0x4b0082, 1);
      graphics.fillRoundedRect(x - 18 * s, y + 28 * s, 36 * s, 36 * s, 4 * s);
      // Dress flare bottom
      graphics.fillTriangle(
        x - 22 * s, y + 64 * s,
        x - 14 * s, y + 50 * s,
        x - 6 * s, y + 64 * s
      );
      graphics.fillTriangle(
        x + 22 * s, y + 64 * s,
        x + 14 * s, y + 50 * s,
        x + 6 * s, y + 64 * s
      );
      // Gold chest plate / emblem
      graphics.fillStyle(0xffd700, 0.9);
      graphics.fillTriangle(
        x, y + 30 * s,
        x - 8 * s, y + 42 * s,
        x + 8 * s, y + 42 * s
      );
      // Emblem inner
      graphics.fillStyle(0x6a0dad, 1);
      graphics.fillTriangle(
        x, y + 33 * s,
        x - 4 * s, y + 40 * s,
        x + 4 * s, y + 40 * s
      );
      // Gold belt
      graphics.fillStyle(0xffd700, 1);
      graphics.fillRect(x - 18 * s, y + 50 * s, 36 * s, 3 * s);
      // Belt jewel
      graphics.fillStyle(0xff00ff, 1);
      graphics.fillCircle(x, y + 51.5 * s, 2.5 * s);
      graphics.fillStyle(0xff88ff, 0.6);
      graphics.fillCircle(x - 0.5 * s, y + 50.8 * s, 1 * s);
      // Vertical gold trim
      graphics.fillStyle(0xffd700, 0.5);
      graphics.fillRect(x - 1 * s, y + 42 * s, 2 * s, 22 * s);

      // Shoulders (pauldrons)
      graphics.fillStyle(0x4b0082, 1);
      graphics.fillCircle(x - 20 * s, y + 30 * s, 6 * s);
      graphics.fillCircle(x + 20 * s, y + 30 * s, 6 * s);
      // Pauldron gold trim
      graphics.lineStyle(1.5 * s, 0xffd700, 0.8);
      graphics.beginPath();
      graphics.arc(x - 20 * s, y + 30 * s, 6 * s, -0.5, Math.PI + 0.5, false);
      graphics.strokePath();
      graphics.beginPath();
      graphics.arc(x + 20 * s, y + 30 * s, 6 * s, -0.5, Math.PI + 0.5, false);
      graphics.strokePath();

      // Arms
      graphics.fillStyle(0x4b0082, 1);
      graphics.fillRoundedRect(x - 28 * s, y + 32 * s, 10 * s, 26 * s, 3 * s);
      graphics.fillRoundedRect(x + 18 * s, y + 32 * s, 10 * s, 26 * s, 3 * s);
      // Bracers (gold)
      graphics.fillStyle(0xffd700, 0.8);
      graphics.fillRect(x - 28 * s, y + 52 * s, 10 * s, 4 * s);
      graphics.fillRect(x + 18 * s, y + 52 * s, 10 * s, 4 * s);
      // Hands
      graphics.fillStyle(0xc68642, 1);
      graphics.fillCircle(x - 23 * s, y + 60 * s, 4 * s);
      graphics.fillCircle(x + 23 * s, y + 60 * s, 4 * s);

      // Legs (under dress)
      graphics.fillStyle(0x2a0044, 1);
      graphics.fillRoundedRect(x - 12 * s, y + 62 * s, 10 * s, 14 * s, 2 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 62 * s, 10 * s, 14 * s, 2 * s);
      // Boots (heeled)
      graphics.fillStyle(0xffd700, 0.7);
      graphics.fillRoundedRect(x - 14 * s, y + 74 * s, 12 * s, 6 * s, 2 * s);
      graphics.fillRoundedRect(x + 2 * s, y + 74 * s, 12 * s, 6 * s, 2 * s);
      // Heel detail
      graphics.fillStyle(0x4b0082, 1);
      graphics.fillRect(x - 12 * s, y + 76 * s, 2 * s, 4 * s);
      graphics.fillRect(x + 10 * s, y + 76 * s, 2 * s, 4 * s);

      // --- FLOWING HAIR (behind head, wavy) ---
      graphics.fillStyle(0x1a1a2e, 1);
      // Main hair mass
      graphics.fillCircle(x, y + 5 * s, 16 * s);
      // Left flowing strands
      graphics.fillStyle(0x1a1a2e, 1);
      // Strand 1
      graphics.beginPath();
      graphics.moveTo(x - 12 * s, y + 6 * s);
      graphics.lineTo(x - 18 * s, y + 20 * s);
      graphics.lineTo(x - 22 * s, y + 35 * s);
      graphics.lineTo(x - 16 * s, y + 40 * s);
      graphics.lineTo(x - 14 * s, y + 28 * s);
      graphics.lineTo(x - 10 * s, y + 14 * s);
      graphics.closePath();
      graphics.fillPath();
      // Strand 2
      graphics.beginPath();
      graphics.moveTo(x + 12 * s, y + 6 * s);
      graphics.lineTo(x + 18 * s, y + 20 * s);
      graphics.lineTo(x + 22 * s, y + 35 * s);
      graphics.lineTo(x + 16 * s, y + 40 * s);
      graphics.lineTo(x + 14 * s, y + 28 * s);
      graphics.lineTo(x + 10 * s, y + 14 * s);
      graphics.closePath();
      graphics.fillPath();
      // Hair highlights (purple sheen)
      graphics.fillStyle(0x6a0dad, 0.3);
      graphics.fillCircle(x - 6 * s, y + 4 * s, 5 * s);
      graphics.fillCircle(x + 4 * s, y + 2 * s, 4 * s);

      // --- HEAD ---
      // Neck
      graphics.fillStyle(0xc68642, 1);
      graphics.fillRect(x - 4 * s, y + 20 * s, 8 * s, 10 * s);
      // Necklace
      graphics.lineStyle(1.5 * s, 0xffd700, 0.9);
      graphics.beginPath();
      graphics.arc(x, y + 26 * s, 7 * s, 0.2, Math.PI - 0.2, false);
      graphics.strokePath();
      // Necklace jewel
      graphics.fillStyle(0xff00ff, 1);
      graphics.fillCircle(x, y + 33 * s, 2 * s);

      // Head
      graphics.fillStyle(0xd4955a, 1);
      graphics.fillCircle(x, y + 13 * s, 13 * s);

      // Front hair (bangs)
      graphics.fillStyle(0x1a1a2e, 1);
      graphics.fillCircle(x, y + 5 * s, 13 * s);
      // Side swept bangs
      graphics.fillTriangle(
        x - 14 * s, y + 6 * s,
        x - 8 * s, y + 12 * s,
        x - 4 * s, y + 4 * s
      );
      graphics.fillTriangle(
        x + 14 * s, y + 6 * s,
        x + 8 * s, y + 12 * s,
        x + 4 * s, y + 4 * s
      );

      // --- CROWN / TIARA ---
      graphics.fillStyle(0xffd700, 1);
      // Crown base
      graphics.fillRect(x - 12 * s, y - 1 * s, 24 * s, 5 * s);
      // Crown points
      graphics.fillTriangle(
        x - 10 * s, y - 1 * s,
        x - 8 * s, y - 8 * s,
        x - 6 * s, y - 1 * s
      );
      graphics.fillTriangle(
        x - 3 * s, y - 1 * s,
        x, y - 12 * s,
        x + 3 * s, y - 1 * s
      );
      graphics.fillTriangle(
        x + 6 * s, y - 1 * s,
        x + 8 * s, y - 8 * s,
        x + 10 * s, y - 1 * s
      );
      // Crown jewels
      graphics.fillStyle(0xff00ff, 1);
      graphics.fillCircle(x, y - 8 * s, 1.5 * s);
      graphics.fillStyle(0x00ffff, 1);
      graphics.fillCircle(x - 8 * s, y - 5 * s, 1 * s);
      graphics.fillCircle(x + 8 * s, y - 5 * s, 1 * s);
      // Crown highlight
      graphics.fillStyle(0xffee88, 0.5);
      graphics.fillRect(x - 11 * s, y - 0.5 * s, 22 * s, 2 * s);

      // --- FACE ---
      // Eyes (confident, piercing — purple iris with sub-glow)
      const empressEye = {
        irisColor: 0x9900ff, hlR: 0.9,
        extra: { color: 0xcc88ff, alpha: 0.4, r: 0.6, dy: 1 },
      };
      drawEye(graphics, x - 5 * s, y + 11 * s, s, { ...empressEye, irisOff: 1, extra: { ...empressEye.extra, dx: -1 } });
      drawEye(graphics, x + 5 * s, y + 11 * s, s, { ...empressEye, irisOff: 1, extra: { ...empressEye.extra, dx: 0 } });

      // Eyelashes (thick, dramatic)
      graphics.lineStyle(2 * s, 0x1a1a2e, 1);
      graphics.lineBetween(x - 9 * s, y + 9 * s, x - 6 * s, y + 9.5 * s);
      graphics.lineBetween(x - 8 * s, y + 8.5 * s, x - 5 * s, y + 9 * s);
      graphics.lineBetween(x + 6 * s, y + 9.5 * s, x + 9 * s, y + 9 * s);
      graphics.lineBetween(x + 5 * s, y + 9 * s, x + 8 * s, y + 8.5 * s);

      // Eyebrows (arched, confident)
      graphics.lineStyle(2 * s, 0x1a1a2e, 0.9);
      graphics.lineBetween(x - 9 * s, y + 7 * s, x - 2 * s, y + 7.5 * s);
      graphics.lineBetween(x + 2 * s, y + 7.5 * s, x + 9 * s, y + 7 * s);

      // Nose
      graphics.lineStyle(1 * s, 0xb07840, 0.5);
      graphics.lineBetween(x, y + 12 * s, x - 1 * s, y + 14.5 * s);
      graphics.lineBetween(x - 1 * s, y + 14.5 * s, x + 1 * s, y + 14.5 * s);

      // Lips (defined, confident smile)
      graphics.fillStyle(0x993366, 1);
      // Upper lip
      graphics.fillTriangle(
        x - 4 * s, y + 17.5 * s,
        x, y + 16.5 * s,
        x + 4 * s, y + 17.5 * s
      );
      // Lower lip
      graphics.fillEllipse(x, y + 18.5 * s, 7 * s, 2.5 * s);
      // Lip highlight
      graphics.fillStyle(0xcc6699, 0.5);
      graphics.fillEllipse(x, y + 18 * s, 3 * s, 1 * s);

      // Beauty mark
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillCircle(x + 7 * s, y + 16 * s, 0.8 * s);

      // Earrings
      graphics.fillStyle(0xffd700, 1);
      graphics.fillCircle(x - 13 * s, y + 14 * s, 2 * s);
      graphics.fillCircle(x + 13 * s, y + 14 * s, 2 * s);
      // Earring dangle
      graphics.lineStyle(1 * s, 0xffd700, 0.8);
      graphics.lineBetween(x - 13 * s, y + 16 * s, x - 13 * s, y + 20 * s);
      graphics.lineBetween(x + 13 * s, y + 16 * s, x + 13 * s, y + 20 * s);
      graphics.fillStyle(0xff00ff, 0.8);
      graphics.fillCircle(x - 13 * s, y + 21 * s, 1.5 * s);
      graphics.fillCircle(x + 13 * s, y + 21 * s, 1.5 * s);
    }
  }
};
