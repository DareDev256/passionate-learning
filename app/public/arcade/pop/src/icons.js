// What's Poppin — Custom SVG Icon System
// Replaces all emojis with drawn Phaser graphics icons

class Icons {
  // Draw a clock/timer icon
  static timer(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(x, y, size * 0.45);
    // Clock hands
    g.lineBetween(x, y, x, y - size * 0.3);
    g.lineBetween(x, y, x + size * 0.2, y + size * 0.1);
    // Top nub
    g.fillStyle(color, 0.9);
    g.fillRect(x - 2, y - size * 0.5, 4, 3);
    return g;
  }

  // Draw a zen/lotus icon
  static zen(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(2, color, 0.9);
    // Three petals
    const r = size * 0.35;
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (i - 1) * 0.6;
      const cx = x + Math.cos(angle) * r * 0.3;
      const cy = y + Math.sin(angle) * r * 0.3 - 2;
      g.strokeEllipse(cx, cy, r * 0.6, r);
    }
    // Base line
    g.lineBetween(x - size * 0.3, y + size * 0.3, x + size * 0.3, y + size * 0.3);
    return g;
  }

  // Draw a question mark / help icon
  static help(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(x, y, size * 0.45);
    // Question mark body (approximated with lines)
    g.lineStyle(2.5, color, 0.9);
    g.beginPath();
    g.arc(x, y - size * 0.1, size * 0.15, -Math.PI * 0.8, Math.PI * 0.1, false);
    g.strokePath();
    g.lineBetween(x + size * 0.05, y + size * 0.02, x, y + size * 0.12);
    // Dot
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y + size * 0.25, 2);
    return g;
  }

  // Pause icon (two bars)
  static pause(scene, x, y, size = 16, color = 0xaaaaaa) {
    const g = scene.add.graphics();
    g.fillStyle(color, 0.9);
    const barW = size * 0.2;
    const barH = size * 0.6;
    const gap = size * 0.15;
    g.fillRoundedRect(x - gap - barW, y - barH / 2, barW, barH, 2);
    g.fillRoundedRect(x + gap, y - barH / 2, barW, barH, 2);
    return g;
  }

  // Play/resume triangle
  static play(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.fillStyle(color, 0.9);
    const h = size * 0.5;
    g.fillTriangle(
      x - h * 0.4, y - h,
      x - h * 0.4, y + h,
      x + h * 0.7, y
    );
    return g;
  }

  // Restart / circular arrow
  static restart(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(2, color, 0.9);
    const r = size * 0.35;
    g.beginPath();
    g.arc(x, y, r, -Math.PI * 0.7, Math.PI * 0.7, false);
    g.strokePath();
    // Arrow head
    const endX = x + Math.cos(Math.PI * 0.7) * r;
    const endY = y + Math.sin(Math.PI * 0.7) * r;
    g.fillStyle(color, 0.9);
    g.fillTriangle(
      endX - 5, endY - 2,
      endX + 3, endY - 4,
      endX + 1, endY + 4
    );
    return g;
  }

  // X / close icon
  static close(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(2.5, color, 0.9);
    const d = size * 0.3;
    g.lineBetween(x - d, y - d, x + d, y + d);
    g.lineBetween(x + d, y - d, x - d, y + d);
    return g;
  }

  // Back arrow
  static back(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(2.5, color, 0.9);
    const d = size * 0.3;
    g.lineBetween(x + d, y - d, x - d, y);
    g.lineBetween(x - d, y, x + d, y + d);
    g.lineBetween(x - d, y, x + d * 1.5, y);
    return g;
  }

  // Star icon
  static star(scene, x, y, size = 16, color = 0xf1c40f) {
    const g = scene.add.graphics();
    g.fillStyle(color, 0.9);
    const points = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI / 5) - Math.PI / 2;
      const r = i % 2 === 0 ? size * 0.4 : size * 0.18;
      points.push(x + Math.cos(angle) * r);
      points.push(y + Math.sin(angle) * r);
    }
    g.fillPoints(points, true);
    return g;
  }

  // Fire icon
  static fire(scene, x, y, size = 16, color = 0xf1c40f) {
    const g = scene.add.graphics();
    const h = size * 0.5;
    // Outer flame
    g.fillStyle(0xff6b35, 0.9);
    g.fillTriangle(x, y - h, x - h * 0.6, y + h * 0.5, x + h * 0.6, y + h * 0.5);
    g.fillCircle(x, y + h * 0.3, h * 0.5);
    // Inner flame
    g.fillStyle(color, 0.9);
    g.fillTriangle(x, y - h * 0.3, x - h * 0.3, y + h * 0.4, x + h * 0.3, y + h * 0.4);
    return g;
  }

  // Crown icon
  static crown(scene, x, y, size = 16, color = 0xf1c40f) {
    const g = scene.add.graphics();
    g.fillStyle(color, 0.9);
    const w = size * 0.5;
    const h = size * 0.35;
    // Crown shape
    g.fillTriangle(x - w, y + h, x - w, y - h * 0.3, x - w * 0.5, y + h * 0.2);
    g.fillTriangle(x - w * 0.5, y + h * 0.2, x, y - h, x + w * 0.5, y + h * 0.2);
    g.fillTriangle(x + w * 0.5, y + h * 0.2, x + w, y - h * 0.3, x + w, y + h);
    g.fillRect(x - w, y + h * 0.5, w * 2, h * 0.4);
    // Gems
    g.fillStyle(0xe74c3c, 0.9);
    g.fillCircle(x - w * 0.5, y + h * 0.65, 2);
    g.fillCircle(x, y + h * 0.65, 2);
    g.fillCircle(x + w * 0.5, y + h * 0.65, 2);
    return g;
  }

  // Sword icon (for ronin streak)
  static sword(scene, x, y, size = 16, color = 0xe74c3c) {
    const g = scene.add.graphics();
    g.lineStyle(2.5, 0xcccccc, 0.9);
    // Blade
    g.lineBetween(x, y - size * 0.45, x, y + size * 0.15);
    // Cross guard
    g.lineStyle(2.5, color, 0.9);
    g.lineBetween(x - size * 0.2, y + size * 0.15, x + size * 0.2, y + size * 0.15);
    // Handle
    g.lineStyle(3, 0x8b4513, 0.9);
    g.lineBetween(x, y + size * 0.15, x, y + size * 0.4);
    // Pommel
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y + size * 0.43, 2.5);
    return g;
  }

  // Lightbulb icon (for hint system)
  static hint(scene, x, y, size = 16, color = 0xf1c40f) {
    const g = scene.add.graphics();
    const r = size * 0.28;
    // Bulb
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y - size * 0.1, r);
    // Rays
    g.lineStyle(1.5, color, 0.6);
    const rayLen = size * 0.18;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      const rx = x + Math.cos(angle) * (r + 2);
      const ry = (y - size * 0.1) + Math.sin(angle) * (r + 2);
      g.lineBetween(rx, ry, rx + Math.cos(angle) * rayLen, ry + Math.sin(angle) * rayLen);
    }
    // Base
    g.fillStyle(0x888888, 0.8);
    g.fillRect(x - r * 0.5, y + size * 0.18, r, size * 0.15);
    return g;
  }
  // Speaker icon (sound on)
  static sound(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    const s = size * 0.3;
    // Speaker body
    g.fillStyle(color, 0.9);
    g.fillRect(x - s * 0.6, y - s * 0.4, s * 0.5, s * 0.8);
    g.fillTriangle(x - s * 0.1, y - s * 0.4, x + s * 0.6, y - s * 0.9, x + s * 0.6, y + s * 0.9);
    g.fillTriangle(x - s * 0.1, y + s * 0.4, x + s * 0.6, y - s * 0.9, x + s * 0.6, y + s * 0.9);
    // Sound waves
    g.lineStyle(1.5, color, 0.7);
    g.beginPath(); g.arc(x + s * 0.8, y, s * 0.5, -0.6, 0.6, false); g.strokePath();
    g.beginPath(); g.arc(x + s * 0.8, y, s * 0.9, -0.7, 0.7, false); g.strokePath();
    return g;
  }

  // Speaker muted icon (sound off)
  static soundOff(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    const s = size * 0.3;
    // Speaker body (dimmed)
    g.fillStyle(color, 0.5);
    g.fillRect(x - s * 0.6, y - s * 0.4, s * 0.5, s * 0.8);
    g.fillTriangle(x - s * 0.1, y - s * 0.4, x + s * 0.6, y - s * 0.9, x + s * 0.6, y + s * 0.9);
    g.fillTriangle(x - s * 0.1, y + s * 0.4, x + s * 0.6, y - s * 0.9, x + s * 0.6, y + s * 0.9);
    // X mark
    g.lineStyle(2, 0xe74c3c, 0.9);
    g.lineBetween(x + s * 0.6, y - s * 0.5, x + s * 1.4, y + s * 0.5);
    g.lineBetween(x + s * 1.4, y - s * 0.5, x + s * 0.6, y + s * 0.5);
    return g;
  }

  // Trophy icon (for stats)
  static trophy(scene, x, y, size = 16, color = 0xf1c40f) {
    const g = scene.add.graphics();
    const s = size * 0.4;
    // Cup body
    g.fillStyle(color, 0.9);
    g.fillRoundedRect(x - s * 0.7, y - s * 0.8, s * 1.4, s * 1.2, 3);
    // Handles
    g.lineStyle(2, color, 0.7);
    g.beginPath(); g.arc(x - s * 0.8, y - s * 0.1, s * 0.35, -1.2, 1.2, false); g.strokePath();
    g.beginPath(); g.arc(x + s * 0.8, y - s * 0.1, s * 0.35, Math.PI - 1.2, Math.PI + 1.2, false); g.strokePath();
    // Stem + base
    g.fillRect(x - s * 0.15, y + s * 0.4, s * 0.3, s * 0.4);
    g.fillRect(x - s * 0.5, y + s * 0.75, s, s * 0.2);
    // Star on cup
    g.fillStyle(0x0a0a1a, 0.6);
    g.fillCircle(x, y - s * 0.15, s * 0.25);
    return g;
  }

  // Accessibility / eye icon (colorblind mode)
  static a11y(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    const s = size * 0.4;
    g.lineStyle(2, color, 0.9);
    // Top lid arc
    g.beginPath();
    g.arc(x, y + s * 0.6, s * 1.3, Math.PI + 0.4, -0.4, false);
    g.strokePath();
    // Bottom lid arc
    g.beginPath();
    g.arc(x, y - s * 0.6, s * 1.3, 0.4, Math.PI - 0.4, false);
    g.strokePath();
    // Iris
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y, s * 0.45);
    return g;
  }

  // Share / export icon
  static share(scene, x, y, size = 16, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(2, color, 0.9);
    const s = size * 0.35;
    // Arrow pointing up-right
    g.lineBetween(x, y + s, x, y - s * 0.5);
    g.lineBetween(x, y - s * 0.5, x + s * 0.6, y);
    g.lineBetween(x, y - s * 0.5, x - s * 0.6, y);
    // Box bottom
    g.lineBetween(x - s, y + s * 0.2, x - s, y + s);
    g.lineBetween(x - s, y + s, x + s, y + s);
    g.lineBetween(x + s, y + s, x + s, y + s * 0.2);
    return g;
  }
}

window.Icons = Icons;
