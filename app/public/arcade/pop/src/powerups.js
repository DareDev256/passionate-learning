// What's Poppin — Power-Up System
// Match 4 = Line Clear, Match 5+ = Bomb, L/T shape = Color Nuke

/**
 * Power-up type enum. Each match pattern produces a specific power-up:
 * - NONE (0) — no power-up (match < 4)
 * - LINE_H (1) — horizontal line clear (match 4 in a row)
 * - LINE_V (2) — vertical line clear (match 4 in a column)
 * - BOMB (3) — 3×3 area explosion (match 5+ in a line)
 * - NUKE (4) — destroy all bubbles of one color (L/T-shaped match of 5+)
 * @enum {number}
 */
const POWERUP_TYPES = {
  NONE: 0,
  LINE_H: 1,
  LINE_V: 2,
  BOMB: 3,
  NUKE: 4,
};

/** Human-readable labels for each power-up type (used in UI overlays). */
const POWERUP_NAMES = {
  [POWERUP_TYPES.LINE_H]: 'LINE →',
  [POWERUP_TYPES.LINE_V]: 'LINE ↓',
  [POWERUP_TYPES.BOMB]: 'BOMB',
  [POWERUP_TYPES.NUKE]: 'NUKE',
};

/**
 * Stateless analysis engine for match-3 power-up resolution.
 * Determines what power-up a match group earns and which cells it affects.
 */
class PowerUpSystem {
  /**
   * Determine what power-up a match group should produce.
   * Priority: L/T shape (5+) → NUKE, 5+ linear → BOMB, 4 linear → LINE.
   * @param {Array<Phaser.GameObjects.Sprite>} matchGroup — matched bubble sprites
   * @param {Array[]} grid — 2D game grid (used for position lookups)
   * @returns {number} POWERUP_TYPES value
   */
  static analyze(matchGroup, grid) {
    if (!matchGroup || matchGroup.length < 4) return POWERUP_TYPES.NONE;

    const positions = matchGroup.map(b => ({
      r: b.getData('row'),
      c: b.getData('col'),
    }));

    // Check for L or T shape (5+ in non-linear arrangement)
    if (positions.length >= 5 && this.isLOrTShape(positions)) {
      return POWERUP_TYPES.NUKE;
    }

    // 5+ in a line = bomb
    if (positions.length >= 5) {
      return POWERUP_TYPES.BOMB;
    }

    // 4 in a line = line clear (direction based on match orientation)
    if (positions.length === 4) {
      const isHorizontal = positions.every(p => p.r === positions[0].r);
      return isHorizontal ? POWERUP_TYPES.LINE_H : POWERUP_TYPES.LINE_V;
    }

    return POWERUP_TYPES.NONE;
  }

  /**
   * Check whether positions form an L or T shape (spans both axes).
   * @param {{r:number, c:number}[]} positions — grid coordinates
   * @returns {boolean} true if the shape is non-linear (L/T)
   */
  static isLOrTShape(positions) {
    const rows = new Set(positions.map(p => p.r));
    const cols = new Set(positions.map(p => p.c));
    return rows.size > 1 && cols.size > 1;
  }

  /**
   * Calculate which cells a power-up activation destroys.
   * - LINE_H → entire row; LINE_V → entire column
   * - BOMB → 3×3 area centered on (row, col)
   * - NUKE → every bubble matching colorIdx
   * @param {number} type     — POWERUP_TYPES value
   * @param {number} row      — activation row
   * @param {number} col      — activation column
   * @param {number} colorIdx — bubble color index (for NUKE)
   * @param {Array[]} grid    — 2D game grid
   * @param {number} gridRows — total row count
   * @param {number} gridCols — total column count
   * @returns {{r:number, c:number}[]} affected cell coordinates
   */
  static getAffectedCells(type, row, col, colorIdx, grid, gridRows, gridCols) {
    const cells = [];

    switch (type) {
      case POWERUP_TYPES.LINE_H:
        for (let c = 0; c < gridCols; c++) {
          if (grid[row][c]) cells.push({ r: row, c });
        }
        break;

      case POWERUP_TYPES.LINE_V:
        for (let r = 0; r < gridRows; r++) {
          if (grid[r][col]) cells.push({ r, c: col });
        }
        break;

      case POWERUP_TYPES.BOMB:
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < gridRows && c >= 0 && c < gridCols && grid[r][c]) {
              cells.push({ r, c });
            }
          }
        }
        break;

      case POWERUP_TYPES.NUKE:
        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            if (grid[r][c] && grid[r][c].getData('colorIdx') === colorIdx) {
              cells.push({ r, c });
            }
          }
        }
        break;
    }

    return cells;
  }
}

/**
 * Draws animated power-up overlays on special bubbles.
 * Each type has a distinct visual: arrows (LINE), concentric rings (BOMB),
 * or a rotating star burst (NUKE). All animations pulse using sin(time).
 */
class PowerUpRenderer {
  /**
   * Draw a power-up overlay onto a Phaser Graphics object.
   * @param {Phaser.GameObjects.Graphics} graphics — target graphics layer
   * @param {number} type — POWERUP_TYPES value
   * @param {number} x — center x position
   * @param {number} y — center y position
   * @param {number} size — bubble diameter (used for scaling)
   * @param {number} time — game time in ms (drives pulse animation)
   */
  static draw(graphics, type, x, y, size, time) {
    const pulse = Math.sin(time * 0.005) * 0.15 + 0.85;
    const halfSize = size / 2;

    switch (type) {
      case POWERUP_TYPES.LINE_H:
        // Horizontal arrow
        graphics.lineStyle(3, 0xffffff, 0.9 * pulse);
        graphics.lineBetween(x - halfSize + 6, y, x + halfSize - 6, y);
        // Arrow heads
        graphics.lineBetween(x - halfSize + 6, y, x - halfSize + 12, y - 4);
        graphics.lineBetween(x - halfSize + 6, y, x - halfSize + 12, y + 4);
        graphics.lineBetween(x + halfSize - 6, y, x + halfSize - 12, y - 4);
        graphics.lineBetween(x + halfSize - 6, y, x + halfSize - 12, y + 4);
        break;

      case POWERUP_TYPES.LINE_V:
        // Vertical arrow
        graphics.lineStyle(3, 0xffffff, 0.9 * pulse);
        graphics.lineBetween(x, y - halfSize + 6, x, y + halfSize - 6);
        // Arrow heads
        graphics.lineBetween(x, y - halfSize + 6, x - 4, y - halfSize + 12);
        graphics.lineBetween(x, y - halfSize + 6, x + 4, y - halfSize + 12);
        graphics.lineBetween(x, y + halfSize - 6, x - 4, y + halfSize - 12);
        graphics.lineBetween(x, y + halfSize - 6, x + 4, y + halfSize - 12);
        break;

      case POWERUP_TYPES.BOMB:
        // Concentric rings
        graphics.lineStyle(2, 0xffffff, 0.7 * pulse);
        graphics.strokeCircle(x, y, 8 * pulse);
        graphics.lineStyle(1.5, 0xffffff, 0.4 * pulse);
        graphics.strokeCircle(x, y, 14 * pulse);
        // Cross
        graphics.lineStyle(2, 0xff4444, 0.8);
        graphics.lineBetween(x - 5, y - 5, x + 5, y + 5);
        graphics.lineBetween(x + 5, y - 5, x - 5, y + 5);
        break;

      case POWERUP_TYPES.NUKE:
        // Star burst
        graphics.lineStyle(2, 0xffd700, 0.9 * pulse);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + time * 0.002;
          const len = 10 * pulse;
          graphics.lineBetween(
            x + Math.cos(angle) * 4,
            y + Math.sin(angle) * 4,
            x + Math.cos(angle) * len,
            y + Math.sin(angle) * len
          );
        }
        // Center diamond
        graphics.fillStyle(0xffd700, 0.8 * pulse);
        const d = 4;
        graphics.fillTriangle(x, y - d, x + d, y, x, y + d);
        graphics.fillTriangle(x, y - d, x - d, y, x, y + d);
        break;
    }
  }
}

window.PowerUpSystem = PowerUpSystem;
window.PowerUpRenderer = PowerUpRenderer;
window.POWERUP_TYPES = POWERUP_TYPES;
window.POWERUP_NAMES = POWERUP_NAMES;
