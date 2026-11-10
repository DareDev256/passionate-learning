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
    const pulse = Math.sin(time * 0.005) * 0.5 + 0.5; // 0..1
    const bx = x - size * 0.33, by = y + size * 0.33; // the sticker sits on the head's lower-left
    // A pulsing accent ring marks a special head from across the board.
    graphics.lineStyle(3.5, P.hotN, 0.55 + 0.4 * pulse);
    graphics.strokeCircle(x, y, size / 2 + 1 + pulse * 3);
    graphics.lineStyle(2, P.inkN, 0.9);
    graphics.strokeCircle(x, y, size / 2 + 5 + pulse * 3);
    // The sticker: hard shadow, accent fill, ink outline.
    graphics.fillStyle(P.inkN, 1); graphics.fillCircle(bx, by + 2, 11.5);
    graphics.fillStyle(P.hotN, 1); graphics.fillCircle(bx, by, 11.5);
    graphics.lineStyle(2.6, P.inkN, 1); graphics.strokeCircle(bx, by, 11.5);
    const glyph = contrastPick(P.hot, ['#0a0a0a', '#ffffff']);
    const gn = parseInt(glyph.slice(1), 16);
    graphics.lineStyle(2.4, gn, 1); graphics.fillStyle(gn, 1);

    switch (type) {
      case POWERUP_TYPES.LINE_H:
        graphics.lineBetween(bx - 6, by, bx + 6, by);
        graphics.fillTriangle(bx - 7.5, by, bx - 3, by - 3.4, bx - 3, by + 3.4);
        graphics.fillTriangle(bx + 7.5, by, bx + 3, by - 3.4, bx + 3, by + 3.4);
        break;
      case POWERUP_TYPES.LINE_V:
        graphics.lineBetween(bx, by - 6, bx, by + 6);
        graphics.fillTriangle(bx, by - 7.5, bx - 3.4, by - 3, bx + 3.4, by - 3);
        graphics.fillTriangle(bx, by + 7.5, bx - 3.4, by + 3, bx + 3.4, by + 3);
        break;
      case POWERUP_TYPES.BOMB:
        graphics.strokeCircle(bx, by, 3.6 + pulse * 1.6);
        graphics.lineBetween(bx - 6.5, by, bx - 4.4, by); graphics.lineBetween(bx + 4.4, by, bx + 6.5, by);
        graphics.lineBetween(bx, by - 6.5, bx, by - 4.4); graphics.lineBetween(bx, by + 4.4, bx, by + 6.5);
        break;
      case POWERUP_TYPES.NUKE:
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + time * 0.003;
          graphics.lineBetween(bx + Math.cos(angle) * 2, by + Math.sin(angle) * 2, bx + Math.cos(angle) * (6 + pulse * 1.2), by + Math.sin(angle) * (6 + pulse * 1.2));
        }
        break;
    }
  }
}

window.PowerUpSystem = PowerUpSystem;
window.PowerUpRenderer = PowerUpRenderer;
window.POWERUP_TYPES = POWERUP_TYPES;
window.POWERUP_NAMES = POWERUP_NAMES;
