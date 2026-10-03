// What's Poppin — Run History & Sparkline
// Tracks last 10 game results, renders animated sparkline on title screen

/**
 * RunHistory — persists the last N game results for progression tracking.
 * Stored as JSON via SafeStorage with tamper-resistance.
 * Each entry: { score, grade, mode, streak, ts }
 */
const RunHistory = {
  KEY: 'whatspoppin_run_history',
  MAX: 10,

  /** Max raw JSON string length — prevents memory-bomb via crafted storage values. */
  MAX_RAW_LEN: 4096,

  /** @returns {Array<{score:number, grade:string, mode:string, streak:number, ts:number}>} */
  load() {
    const raw = SafeStorage.get(this.KEY, '[]');
    if (typeof raw !== 'string' || raw.length > this.MAX_RAW_LEN) return [];
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // Validate each entry — reject anything that looks tampered
      return arr.filter(e =>
        e && typeof e === 'object' &&
        typeof e.score === 'number' && Number.isFinite(e.score) && e.score >= 0 &&
        typeof e.grade === 'string' && /^[A-FS]{1,2}$/.test(e.grade) &&
        typeof e.mode === 'string' && (e.mode === 'timed' || e.mode === 'zen' || e.mode === 'daily') &&
        typeof e.streak === 'number' && Number.isFinite(e.streak) && e.streak >= 0
      ).slice(0, this.MAX);
    } catch (_) { return []; }
  },

  /** Record a completed game result. */
  record(entry) {
    const history = this.load();
    history.push({
      score: Math.max(0, Math.floor(entry.score || 0)),
      grade: String(entry.grade || 'F').slice(0, 2),
      mode: entry.mode === 'zen' ? 'zen' : 'timed',
      streak: Math.max(0, Math.floor(entry.streak || 0)),
      ts: Date.now(),
    });
    // Keep only last MAX entries
    while (history.length > this.MAX) history.shift();
    SafeStorage.set(this.KEY, JSON.stringify(history));
  },
};

/**
 * Draw an animated sparkline bar chart showing run history.
 * Each bar = one game, height = score relative to personal best,
 * color = grade tier. Animates bars rising from bottom with staggered delay.
 *
 * @param {Phaser.Scene} scene — target scene
 * @param {number} cx — center X of the sparkline area
 * @param {number} cy — center Y of the sparkline area
 * @param {number} areaW — total width available
 * @param {number} maxH — maximum bar height
 */
function drawRunSparkline(scene, cx, cy, areaW, maxH) {
  const runs = RunHistory.load();
  if (runs.length < 2) return; // Need at least 2 data points

  const GRADE_COLORS = {
    S: 0xffd700, A: 0x2ecc71, B: 0x3498db,
    C: 0xff6b35, D: 0xe74c3c, F: 0x666666,
  };

  // Container for all sparkline elements
  const container = scene.add.container(0, 0).setDepth(5);

  // Subtle label
  const label = scene.add.text(cx, cy - maxH / 2 - 12, 'RECENT RUNS',
    { fontSize: '9px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#444444', letterSpacing: 3 }).setOrigin(0.5);
  container.add(label);

  const maxScore = Math.max(...runs.map(r => r.score), 1);
  const barCount = runs.length;
  const barGap = 4;
  const totalBarSpace = areaW - (barCount - 1) * barGap;
  const barW = Math.min(Math.floor(totalBarSpace / barCount), 24);
  const totalW = barCount * barW + (barCount - 1) * barGap;
  const startX = cx - totalW / 2;
  const baseY = cy + maxH / 2;

  // Baseline
  const baseLine = scene.add.graphics();
  baseLine.lineStyle(1, 0x2a2a4a, 0.5);
  baseLine.lineBetween(startX - 4, baseY, startX + totalW + 4, baseY);
  container.add(baseLine);

  // Draw bars with staggered animation
  runs.forEach((run, i) => {
    const barH = Math.max(4, (run.score / maxScore) * (maxH - 8));
    const bx = startX + i * (barW + barGap);
    const color = GRADE_COLORS[run.grade] || 0x666666;
    const isLatest = i === runs.length - 1;

    const bar = scene.add.graphics();
    bar.fillStyle(color, isLatest ? 0.9 : 0.55);
    // Start with zero height, animate up
    bar.fillRoundedRect(bx, baseY, barW, 0, 2);
    container.add(bar);

    // Animate bar rising
    scene.tweens.addCounter({
      from: 0, to: barH,
      duration: 400, delay: 200 + i * 80,
      ease: 'Back.easeOut',
      onUpdate: (tw) => {
        const h = tw.getValue();
        bar.clear();
        bar.fillStyle(color, isLatest ? 0.9 : 0.55);
        bar.fillRoundedRect(bx, baseY - h, barW, h, 2);
      },
    });

    // Latest bar gets a subtle glow pulse
    if (isLatest) {
      const glow = scene.add.graphics();
      container.add(glow);
      scene.tweens.addCounter({
        from: 0.15, to: 0.35,
        duration: 1200, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          glow.clear();
          glow.fillStyle(color, tw.getValue());
          glow.fillRoundedRect(bx - 1, baseY - barH - 1, barW + 2, barH + 2, 3);
        },
      });
      // Score label on latest bar
      const scoreLabel = scene.add.text(
        bx + barW / 2, baseY - barH - 8,
        run.score >= 1000 ? `${(run.score / 1000).toFixed(1)}k` : String(run.score),
        { fontSize: '10px', fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }
      ).setOrigin(0.5).setAlpha(0);
      container.add(scoreLabel);
      scene.tweens.add({
        targets: scoreLabel, alpha: 1,
        duration: 300, delay: 200 + barCount * 80 + 200,
        ease: 'Quad.easeOut',
      });
    }
  });

  // Trend arrow — compare last game to average of previous
  if (runs.length >= 3) {
    const last = runs[runs.length - 1].score;
    const prevAvg = runs.slice(0, -1).reduce((s, r) => s + r.score, 0) / (runs.length - 1);
    const trending = last > prevAvg * 1.1 ? '↑' : last < prevAvg * 0.9 ? '↓' : '→';
    const trendColor = trending === '↑' ? '#2ecc71' : trending === '↓' ? '#e74c3c' : '#888888';

    const arrow = scene.add.text(cx + totalW / 2 + 14, baseY - maxH / 2,
      trending, { fontSize: '18px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        fontStyle: 'bold', color: trendColor }
    ).setOrigin(0.5).setAlpha(0);
    container.add(arrow);
    scene.tweens.add({
      targets: arrow, alpha: 0.8, duration: 400,
      delay: 200 + barCount * 80 + 100, ease: 'Quad.easeOut',
    });
  }

  return container;
}

window.RunHistory = RunHistory;
window.drawRunSparkline = drawRunSparkline;
